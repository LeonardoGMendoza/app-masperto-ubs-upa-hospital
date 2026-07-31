import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, Navigation2, Building2, X, ChevronRight, 
  MapPin, Clock, ArrowLeft, Menu, User, Map, Inbox, Settings, HelpCircle, Power,
  Briefcase, Home as HomeIcon, Award, Shield, Edit2
} from 'lucide-react';
import MapComponent from './MapComponent';
import { auth, loginWithGoogle, logout, addPoints, updateUserData, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import './App.css';

// ── Zona Leste fallback data ──────────────────────────────────────────────────
const FALLBACK = [
  { id: 9001, name: 'UBS Itaquera', type: 'UBS', lat: -23.5394491, lon: -46.4551811, address: 'Itaquera, São Paulo – SP' },
  { id: 9002, name: 'Hospital Santa Marcelina – Itaquera', type: 'Hospital', lat: -23.5542809, lon: -46.4613548, address: 'R. Santa Marcelina, 177 – Itaquera' },
  { id: 9003, name: 'UBS Vila Ramos', type: 'UBS', lat: -23.5205252, lon: -46.463897, address: 'Vila Ramos, São Paulo – SP' },
  { id: 9004, name: 'UBS Jardim Robru', type: 'UBS', lat: -23.5213333, lon: -46.4124441, address: 'Jardim Robru, São Paulo – SP' },
  { id: 9005, name: 'Hospital Tide Setubal', type: 'Hospital', lat: -23.4971785, lon: -46.4400842, address: 'São Miguel Paulista, São Paulo – SP' },
  { id: 9006, name: 'UBS Vila Matilde', type: 'UBS', lat: -23.5367323, lon: -46.5277206, address: 'Vila Matilde, São Paulo – SP' },
  { id: 9007, name: 'UBS Jardim Keralux', type: 'UBS', lat: -23.4822427, lon: -46.4931264, address: 'Jardim Keralux, São Paulo – SP' },
  { id: 9008, name: 'UBS Pedro de Souza Campos', type: 'UBS', lat: -23.503142, lon: -46.4839706, address: 'São Paulo – SP' },
  { id: 9009, name: 'UPA Penha', type: 'UPA', lat: -23.5199, lon: -46.5309, address: 'Penha, São Paulo – SP' },
  { id: 9010, name: 'AMA/UBS Jardim Nordeste', type: 'AMA', lat: -23.5064, lon: -46.4715, address: 'Jardim Nordeste, São Paulo – SP' },
];

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [activeFacility, setActiveFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState(null);
  const [showSearchBtn, setShowSearchBtn] = useState(false);
  const [currentSearchCenter, setCurrentSearchCenter] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Firebase Auth & User State ──────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState({ points: 0, joinedAt: null, home: '', work: '' });
  
  // Modals state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [homeWorkOpen, setHomeWorkOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);

  // Forms state
  const [homeInput, setHomeInput] = useState('');
  const [workInput, setWorkInput] = useState('');
  const [editingHome, setEditingHome] = useState(false);
  const [editingWork, setEditingWork] = useState(false);
  const [invisible, setInvisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setHomeInput(data.home || '');
          setWorkInput(data.work || '');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error(error);
      alert("Erro ao fazer login com o Google.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setSidebarOpen(false);
      setProfileOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const saveHomeWork = async () => {
    if (!currentUser) { alert("Faça login primeiro."); return; }
    await updateUserData(currentUser.uid, { home: homeInput, work: workInput });
    setUserData(prev => ({...prev, home: homeInput, work: workInput}));
    alert("Salvo com sucesso!");
  };

  // ── Route to Home or Work ──────────────────────────────────────────────────
  const routeToPlace = async (placeType) => {
    const address = placeType === 'home' ? userData.home : userData.work;
    if (!address) {
      setHomeWorkOpen(true);
      return;
    }
    
    setLoading(true);
    try {
      // Geocode the address
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await resp.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const pseudoFac = {
          id: 'custom-' + placeType,
          name: placeType === 'home' ? 'Casa' : 'Trabalho',
          type: placeType === 'home' ? 'Residência' : 'Escritório',
          lat, lon, address
        };
        startNav(pseudoFac);
      } else {
        alert('Endereço não encontrado pelo GPS. Edite em Perfil > Casa e Trabalho.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar o endereço salvo.');
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation mode state ──────────────────────────────────────────────────
  const [navMode, setNavMode] = useState(false);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setUserLocation(loc); setCurrentSearchCenter(loc);
          fetchFacilities(loc.lat, loc.lon, loc);
        },
        () => {
          const loc = { lat: -23.5413, lon: -46.4496 };
          setUserLocation(loc); setCurrentSearchCenter(loc);
          fetchFacilities(loc.lat, loc.lon, loc);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else { setLoading(false); }
  }, []);

  const fetchFacilities = async (lat, lon, refLoc) => {
    setLoading(true); setShowSearchBtn(false);
    const radius = 8000;
    const query = `[out:json][timeout:30];
(
  node["amenity"~"hospital|clinic|doctors|health_post"](around:${radius},${lat},${lon});
  way["amenity"~"hospital|clinic|doctors|health_post"](around:${radius},${lat},${lon});
  node["healthcare"~"hospital|clinic|centre|doctor"](around:${radius},${lat},${lon});
  way["healthcare"~"hospital|clinic|centre|doctor"](around:${radius},${lat},${lon});
);
out center;`;
    try {
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'User-Agent': 'PerToSaude/1.0' },
        body: query
      });
      const data = await resp.json();
      const refLat = refLoc?.lat ?? lat; const refLon = refLoc?.lon ?? lon;
      const seen = new Set();
      const items = data.elements.filter(el => {
        if (!el.tags?.name) return false;
        if (seen.has(el.tags.name)) return false;
        seen.add(el.tags.name); return true;
      }).map(el => {
        const elLat = el.lat ?? el.center?.lat; const elLon = el.lon ?? el.center?.lon;
        if (!elLat || !elLon) return null;
        const dist = calcDist(refLat, refLon, elLat, elLon);
        let type = 'Clínica';
        const amenity = el.tags.amenity || ''; const hc = el.tags.healthcare || '';
        if (amenity === 'hospital' || hc === 'hospital') type = 'Hospital';
        else if (el.tags.name?.match(/UPA/i)) type = 'UPA';
        else if (el.tags.name?.match(/UBS|UBSF|USF|Unidade B/i)) type = 'UBS';
        else if (el.tags.name?.match(/AMA\b/i)) type = 'AMA';
        else if (amenity === 'doctors') type = 'Médico';
        const street = el.tags['addr:street'];
        const num = el.tags['addr:housenumber'];
        return { id: el.id, name: el.tags.name, type, lat: elLat, lon: elLon, distance: dist, address: street ? `${street}${num ? ', ' + num : ''} – SP` : 'São Paulo – SP' };
      }).filter(Boolean).sort((a, b) => a.distance - b.distance).slice(0, 60);
      setFacilities(items.length > 0 ? items : withDist(FALLBACK, refLat, refLon));
    } catch { setFacilities(withDist(FALLBACK, lat, lon)); }
    finally { setLoading(false); }
  };

  const withDist = (arr, lat, lon) =>
    arr.map(f => ({ ...f, distance: calcDist(lat, lon, f.lat, f.lon) })).sort((a, b) => a.distance - b.distance);

  const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fmtDist = d => d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1)} km`;

  const fmtDuration = (secs) => {
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  const typeColor = (type) => ({
    'Hospital': '#DC2626', 'UPA': '#EA580C', 'UBS': '#2563EB',
    'AMA': '#7C3AED', 'Médico': '#0284C7', 'Clínica': '#0891B2',
    'Residência': '#059669', 'Escritório': '#D97706'
  }[type] ?? '#2563EB');

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      setLoading(true);
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
        const data = await resp.json();
        if (data && data.length > 0) {
          const loc = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
          setUserLocation(loc);
          setCurrentSearchCenter(loc);
          fetchFacilities(loc.lat, loc.lon, loc);
        } else {
          alert('Local não encontrado.');
        }
      } catch (e) {
        console.error('Search error:', e);
        alert('Erro ao buscar local.');
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchRoute = async (fac) => {
    if (!userLocation) return;
    setRouteLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lon},${userLocation.lat};${fac.lon},${fac.lat}?overview=full&geometries=geojson`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        setRouteCoords(coords);
        setRouteInfo({
          distance: route.distance,
          duration: route.duration,
        });
        
        if (currentUser) {
          await addPoints(currentUser.uid, 50);
          setUserData(prev => ({...prev, points: (prev.points || 0) + 50}));
        }
      }
    } catch (e) {
      console.error('Route fetch error:', e);
    } finally {
      setRouteLoading(false);
    }
  };

  const startNav = async (fac) => {
    setActiveFacility(fac);
    setDetailOpen(false);
    setNavMode(true);
    await fetchRoute(fac);
  };

  const exitNav = () => {
    setNavMode(false);
    setRouteCoords(null);
    setRouteInfo(null);
  };

  const openInMaps = () => {
    if (!activeFacility) return;
    window.open(`https://waze.com/ul?ll=${activeFacility.lat},${activeFacility.lon}&navigate=yes`, '_blank');
  };

  const openDetail = (fac) => { setActiveFacility(fac); setDetailOpen(true); };
  const closeDetail = () => setDetailOpen(false);

  const handleMapMove = (c) => {
    setMapCenter(c);
    if (currentSearchCenter && calcDist(currentSearchCenter.lat, currentSearchCenter.lon, c.lat, c.lon) > 2)
      setShowSearchBtn(true);
  };

  const searchNewArea = () => {
    if (mapCenter) { setCurrentSearchCenter(mapCenter); fetchFacilities(mapCenter.lat, mapCenter.lon, mapCenter); }
  };

  return (
    <div className="app-container">

      {/* Loading */}
      {(loading || routeLoading) && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />
            <p>{routeLoading ? 'Calculando rota…' : 'Carregando mapa…'}</p>
          </div>
        </div>
      )}

      {/* Hamburger Menu Button */}
      {!navMode && (
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} color="#111827" />
          {!currentUser && <div className="hamburger-dot" />}
        </button>
      )}

      {/* Sidebar Overlay & Menu */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={24} /></button>
          {currentUser ? (
            <div className="sidebar-user">
              <img src={currentUser.photoURL} alt="Avatar" className="sidebar-avatar" />
              <div className="sidebar-user-info">
                <div className="sidebar-username">{currentUser.displayName}</div>
                <button className="sidebar-profile-btn" onClick={() => setProfileOpen(true)}>Ver perfil</button>
              </div>
            </div>
          ) : (
            <div className="sidebar-user">
              <div className="sidebar-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
                <User size={28} color="#9CA3AF" />
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-username">Olá, Convidado</div>
                <button className="sidebar-login-btn" onClick={handleLogin}>
                  Login com Google
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="sidebar-menu">
          <div className="sidebar-item" onClick={() => setSidebarOpen(false)}>
            <Map size={22} /> Planejar percurso
          </div>
          <div className="sidebar-item">
            <Inbox size={22} /> Caixa de entrada <div className="dot" />
          </div>
          <div className="sidebar-item">
            <Settings size={22} /> Configurações
          </div>
          <div className="sidebar-item">
            <HelpCircle size={22} /> Ajuda e comentários
          </div>
          {currentUser && (
            <div className="sidebar-item" onClick={handleLogout} style={{color: '#DC2626'}}>
              <Power size={22} color="#DC2626" /> Sair
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <div className={`profile-modal ${profileOpen ? 'open' : ''}`}>
        <div className="profile-top">
          <button className="close-btn" style={{ background: 'transparent' }} onClick={() => setProfileOpen(false)}>
            <ArrowLeft size={24} color="#111827" />
          </button>
          <h2>Perfil</h2>
          <div style={{width: 24}}></div>
        </div>
        <div className="profile-content">
          <div className="profile-card">
            {currentUser && <img src={currentUser.photoURL} alt="Avatar" className="profile-card-avatar" />}
            <h3>{currentUser?.displayName}</h3>
            
            <div className="profile-stats">
              <div className="profile-points-label">PONTOS</div>
              <div className="profile-points-value">
                <Shield size={24} fill="#0ea5e9" color="#0284c7" />
                {userData.points || 0}
              </div>
              <div className="profile-joined">
                Juntou-se em {userData.joinedAt ? new Date(userData.joinedAt).getFullYear() : new Date().getFullYear()}
              </div>
            </div>
            <div className="profile-humor-icon" style={{margin: '0 auto 20px', display: 'flex', justifyContent: 'center'}}>
              {invisible ? (
                <div className="waze-ghost" style={{transform: 'scale(1.5)', margin: '10px 0'}}>
                  <div className="waze-ghost-wheel-left"></div>
                  <div className="waze-ghost-wheel-right"></div>
                  <div className="waze-ghost-face">
                    <div className="waze-ghost-eyes">
                      <div className="waze-ghost-eye"></div>
                      <div className="waze-ghost-eye"></div>
                    </div>
                    <div className="waze-ghost-mouth">
                      <div className="waze-ghost-tongue"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="custom-red-pin" style={{transform: 'scale(1.2) rotate(-45deg)', margin: '10px 0'}}>
                  <div className="custom-red-pin-inner">
                    <div className="red-pin-cross"></div>
                    <div className="red-pin-eyes">
                      <div className="red-pin-eye"></div>
                      <div className="red-pin-eye"></div>
                    </div>
                    <div className="red-pin-smile"></div>
                  </div>
                </div>
              )}
            </div>
            
            <p style={{fontSize: '0.85rem', color: '#6B7280', margin: '14px 20px 10px'}}>
              Outros motoristas podem ver seu nome de usuário e Humor
            </p>
          </div>

          <div className="profile-settings-list">
            <div className="profile-setting-item" onClick={() => setInvisible(!invisible)} style={{cursor: 'pointer'}}>
              Ficar invisível
              <div style={{width: 44, height: 24, background: invisible ? '#34D399' : '#E5E7EB', borderRadius: 12, position: 'relative', transition: '0.3s'}}>
                <div style={{width: 20, height: 20, background: '#fff', borderRadius: 10, position: 'absolute', top: 2, left: invisible ? 22 : 2, boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: '0.3s'}}></div>
              </div>
            </div>
            <div className="profile-setting-item" onClick={() => setAchievementsOpen(true)}>
              <div className="profile-setting-left">
                <Award size={22} color="#6B7280" />
                <div>
                  <div>Conquistas</div>
                  <div className="profile-setting-sub">1 novo distintivo</div>
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <div className="dot" style={{width: 8, height: 8, background: '#EF4444', borderRadius: 4}}></div>
                <ChevronRight size={20} color="#D1D5DB" />
              </div>
            </div>
            <div className="profile-setting-item" onClick={() => setAccountOpen(true)}>
              <div className="profile-setting-left">
                <User size={22} color="#6B7280" />
                Conta e login
              </div>
              <ChevronRight size={20} color="#D1D5DB" />
            </div>
            <div className="profile-setting-item" onClick={() => setHomeWorkOpen(true)}>
              <div className="profile-setting-left">
                <HomeIcon size={22} color="#6B7280" />
                Casa e trabalho
              </div>
              <ChevronRight size={20} color="#D1D5DB" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub Modals (Home/Work, Account, Achievements) ── */}

      {/* Home & Work Modal */}
      <div className={`sub-modal ${homeWorkOpen ? 'open' : ''}`}>
        <div className="sub-modal-header">
          <button className="close-btn" style={{ background: 'transparent' }} onClick={() => setHomeWorkOpen(false)}>
            <ArrowLeft size={24} color="#111827" />
          </button>
          <div className="sub-modal-title">Casa e trabalho</div>
        </div>
        <div className="sub-modal-content">
          <div className="sub-modal-banner" style={{textAlign: 'center', padding: '24px 20px 16px', background: '#F8FAFC'}}>
            <div style={{width: 120, height: 120, borderRadius: '50%', background: '#BAE6FD', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '6px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative'}}>
              {/* CSS Illustration of House and Building */}
              <div style={{position: 'absolute', bottom: 12, left: 15, width: 40, height: 40, background: '#fff', border: '3px solid #374151', borderRadius: '4px 4px 0 0', zIndex: 2}}>
                <div style={{width: 0, height: 0, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderBottom: '22px solid #EF4444', position: 'absolute', top: -23, left: -5}}></div>
                <div style={{width: 12, height: 16, background: '#8B5CF6', position: 'absolute', bottom: 0, left: 11, borderRadius: '4px 4px 0 0', border: '3px solid #374151', borderBottom: 'none'}}></div>
                <div style={{width: 8, height: 8, background: '#93C5FD', borderRadius: '50%', border: '2px solid #374151', position: 'absolute', top: 6, left: 13}}></div>
              </div>
              <div style={{position: 'absolute', bottom: 25, right: 15, width: 45, height: 60, background: '#E0F2FE', border: '3px solid #374151', borderRadius: '4px 4px 0 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4}}>
                <div style={{background: '#93C5FD', height: 8, border: '1px solid #374151'}}></div><div style={{background: '#93C5FD', height: 8, border: '1px solid #374151'}}></div>
                <div style={{background: '#93C5FD', height: 8, border: '1px solid #374151'}}></div><div style={{background: '#93C5FD', height: 8, border: '1px solid #374151'}}></div>
                <div style={{background: '#93C5FD', height: 8, border: '1px solid #374151'}}></div><div style={{background: '#93C5FD', height: 8, border: '1px solid #374151'}}></div>
              </div>
              <div style={{position: 'absolute', bottom: -5, left: -20, right: -20, height: 22, background: '#9CA3AF', borderTop: '3px solid #374151', borderRadius: '50%'}}></div>
              <div style={{position: 'absolute', bottom: 5, left: 10, right: 10, height: 4, background: '#D1D5DB'}}></div>
            </div>
            <h3 style={{fontSize: '1.25rem', fontWeight: 800, marginBottom: 8}}>O Waze te dá cobertura</h3>
            <p style={{fontSize: '0.9rem', color: '#4B5563', lineHeight: 1.4}}>Receba atualizações do trânsito personalizadas para seu percurso diário ao configurar sua casa e trabalho</p>
          </div>
          <div className="sub-modal-list">
            <div className="sub-modal-list-item" style={{flexDirection: 'column', alignItems: 'stretch'}} onClick={() => !editingHome && setEditingHome(true)}>
              <div style={{display: 'flex', gap: 16, alignItems: 'center', width: '100%'}}>
                <HomeIcon size={24} className="sub-modal-list-icon" color="#6B7280" />
                <div className="sub-modal-list-text">
                  <div className="sub-modal-list-title">Casa</div>
                  <div className="sub-modal-list-desc">{userData.home || 'Toque para adicionar'}</div>
                </div>
                {!editingHome && <Edit2 size={18} color="#9CA3AF" />}
              </div>
              {editingHome && (
                <div style={{marginTop: 12, display: 'flex', gap: 8}}>
                  <input 
                    className="sub-modal-input" style={{marginTop: 0, flex: 1}}
                    placeholder="Digite o endereço da sua Casa"
                    value={homeInput} onChange={e => setHomeInput(e.target.value)}
                  />
                  <button className="sub-modal-save-btn" style={{marginTop: 0}} onClick={(e) => { e.stopPropagation(); saveHomeWork(); setEditingHome(false); }}>Salvar</button>
                </div>
              )}
            </div>
            
            <div className="sub-modal-list-item" style={{flexDirection: 'column', alignItems: 'stretch'}} onClick={() => !editingWork && setEditingWork(true)}>
              <div style={{display: 'flex', gap: 16, alignItems: 'center', width: '100%'}}>
                <Briefcase size={24} className="sub-modal-list-icon" color="#6B7280" />
                <div className="sub-modal-list-text">
                  <div className="sub-modal-list-title">Trabalho</div>
                  <div className="sub-modal-list-desc">{userData.work || 'Toque para adicionar'}</div>
                </div>
                {!editingWork && <Edit2 size={18} color="#9CA3AF" />}
              </div>
              {editingWork && (
                <div style={{marginTop: 12, display: 'flex', gap: 8}}>
                  <input 
                    className="sub-modal-input" style={{marginTop: 0, flex: 1}}
                    placeholder="Digite o endereço do seu Trabalho"
                    value={workInput} onChange={e => setWorkInput(e.target.value)}
                  />
                  <button className="sub-modal-save-btn" style={{marginTop: 0}} onClick={(e) => { e.stopPropagation(); saveHomeWork(); setEditingWork(false); }}>Salvar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account & Login Modal */}
      <div className={`sub-modal ${accountOpen ? 'open' : ''}`}>
        <div className="sub-modal-header">
          <button className="close-btn" style={{ background: 'transparent' }} onClick={() => setAccountOpen(false)}>
            <ArrowLeft size={24} color="#111827" />
          </button>
          <div className="sub-modal-title">Conta e login</div>
        </div>
        <div className="sub-modal-content">
          <div className="sub-modal-banner" style={{paddingBottom: 16}}>
             <img src={currentUser?.photoURL || '/logo.png'} style={{width: 80, height: 80, borderRadius: '50%'}} alt="Avatar" />
          </div>
          <div className="sub-modal-list">
            <div className="sub-modal-list-item">
              <div className="sub-modal-list-text">
                <div className="sub-modal-list-title">Nome completo</div>
                <div className="sub-modal-list-desc">{currentUser?.displayName || 'Convidado'}</div>
              </div>
            </div>
          </div>
          <div style={{padding: '16px 20px', fontSize: '0.85rem', color: '#6B7280', fontWeight: 600}}>Dados de acesso</div>
          <div className="sub-modal-list">
            <div className="sub-modal-list-item">
              <div className="sub-modal-list-icon">
                <Shield size={24} color="#34A853" fill="#E8F5E9"/>
              </div>
              <div className="sub-modal-list-text">
                <div className="sub-modal-list-title">E-mail (Google)</div>
                <div className="sub-modal-list-desc">{currentUser?.email || 'Faça login para ver'}</div>
              </div>
            </div>
            <div className="sub-modal-list-item">
              <div className="sub-modal-list-text">
                <div className="sub-modal-list-title">Data de nascimento</div>
                <div className="sub-modal-list-desc">1 de janeiro de 1970</div>
              </div>
              <div className="sub-modal-list-action">Editar</div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Modal */}
      <div className={`sub-modal ${achievementsOpen ? 'open' : ''}`}>
        <div className="sub-modal-header">
          <button className="close-btn" style={{ background: 'transparent' }} onClick={() => setAchievementsOpen(false)}>
            <ArrowLeft size={24} color="#111827" />
          </button>
          <div className="sub-modal-title">Conquistas</div>
        </div>
        <div className="sub-modal-content">
          <div className="achievements-level">
            <div className="achievements-level-title">Nível</div>
            <div className="achievements-level-name">Waze Adulto</div>
            <div className="achievements-badges">
              <Shield size={48} className="achievements-badge" color="#9CA3AF" />
              <Award size={48} className="achievements-badge active" color="#2563EB" />
              <Shield size={48} className="achievements-badge" color="#9CA3AF" />
              <Award size={48} className="achievements-badge" color="#9CA3AF" />
            </div>
          </div>
          
          <div className="stats-row">
            <div className="stats-col">
              <div className="stats-col-val">{userData.points ? Math.floor(userData.points / 50) : 0}</div>
              <div className="stats-col-lbl">Rotas Feitas</div>
            </div>
            <div className="stats-col">
              <div className="stats-col-val">{userData.points || 0}</div>
              <div className="stats-col-lbl">Pontos Totais</div>
            </div>
          </div>
        </div>
      </div>


      {/* Map (now using MapLibre) */}
      <MapComponent
        userLocation={userLocation}
        facilities={facilities}
        activeFacility={activeFacility}
        onFacilitySelect={openDetail}
        onMapMove={handleMapMove}
        getTypeColor={typeColor}
        navMode={navMode}
        routeCoords={routeCoords}
        invisible={invisible}
      />

      {/* ═══════════════ NAVIGATION MODE (Screen 3 - Waze style) ═══════════════ */}
      {navMode && (
        <>
          <div className="nav-top-bar">
            <button className="nav-back-btn" onClick={exitNav}>
              <ArrowLeft size={20} />
            </button>
            <div className="nav-top-info">
              <span className="nav-top-name">{activeFacility?.name}</span>
              <span className="nav-top-type" style={{ color: typeColor(activeFacility?.type) }}>
                {activeFacility?.type}
              </span>
            </div>
          </div>

          <div className="nav-bottom-panel">
            {routeInfo ? (
              <>
                <div className="nav-stats">
                  <div className="nav-stat-main">
                    <span className="nav-stat-value">{fmtDuration(routeInfo.duration)}</span>
                    <span className="nav-stat-label">tempo estimado</span>
                  </div>
                  <div className="nav-stat-divider" />
                  <div className="nav-stat-secondary">
                    <span className="nav-stat-value nav-stat-value--sm">
                      {routeInfo.distance >= 1000
                        ? `${(routeInfo.distance / 1000).toFixed(1)} km`
                        : `${Math.round(routeInfo.distance)} m`}
                    </span>
                    <span className="nav-stat-label">distância</span>
                  </div>
                  <div className="nav-stat-divider" />
                  <div className="nav-stat-secondary">
                    <span className="nav-stat-value nav-stat-value--sm">
                      {new Date(Date.now() + routeInfo.duration * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="nav-stat-label">chegada prevista</span>
                  </div>
                </div>

                <div className="nav-actions">
                  <button className="nav-btn-maps" onClick={openInMaps}>
                    <Navigation2 size={18} />
                    Abrir no Waze
                  </button>
                  <button className="nav-btn-cancel" onClick={exitNav}>
                    <X size={18} />
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ marginBottom: 16 }}>Calculando rota…</div>
                <button className="nav-btn-cancel" onClick={exitNav} style={{ maxWidth: 200 }}>
                  <X size={18} />
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════ NORMAL MODE ═══════════════ */}
      {!navMode && (
        <>
          <div className="top-bar">
            <div className="search-bar">
              <Search size={18} color="#6B7280" />
              <input 
                type="text" 
                placeholder="Para onde?" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
              />
              <div className="divider" />
              <button className="filter-icon-btn"><SlidersHorizontal size={18} color="#2563EB" /></button>
            </div>

            {/* Quick Home / Work Buttons */}
            <div className="quick-buttons-row">
              <div className="quick-btn" onClick={() => routeToPlace('home')}>
                <HomeIcon size={18} /> Casa
              </div>
              <div className="quick-btn" onClick={() => routeToPlace('work')}>
                <Briefcase size={18} style={{color: '#D97706'}} /> Trabalho
              </div>
            </div>
          </div>

          <div className={`search-area-wrap ${!showSearchBtn ? 'hidden' : ''}`} style={{top: 140}}>
            <button className="search-area-btn" onClick={searchNewArea}>
              <MapPin size={15} /> Buscar nesta área
            </button>
          </div>

          <button
            className={`fab-nav ${!activeFacility ? 'fab-disabled' : ''}`}
            onClick={() => activeFacility && startNav(activeFacility)}
            disabled={!activeFacility}
          >
            <Navigation2 size={22} fill={activeFacility ? 'white' : '#9CA3AF'} />
          </button>

          {detailOpen && activeFacility && (
            <div className="detail-overlay" onClick={closeDetail}>
              <div className="detail-sheet" onClick={e => e.stopPropagation()}>
                <div className="sheet-handle" />
                <div className="detail-header">
                  <div className="detail-type-badge" style={{ background: typeColor(activeFacility.type) + '20', color: typeColor(activeFacility.type) }}>
                    {activeFacility.type}
                  </div>
                  <button className="close-btn" onClick={closeDetail}><X size={20} /></button>
                </div>
                <h2 className="detail-name">{activeFacility.name}</h2>
                <p className="detail-dist"><MapPin size={14} color="#6B7280" /> {fmtDist(activeFacility.distance)} de distância</p>
                <div className="detail-rows">
                  <div className="detail-row">
                    <div className="detail-row-icon" style={{ background: typeColor(activeFacility.type) + '18' }}>
                      <Building2 size={18} color={typeColor(activeFacility.type)} />
                    </div>
                    <div>
                      <div className="detail-row-label">Tipo de unidade</div>
                      <div className="detail-row-value">{activeFacility.type}</div>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-row-icon" style={{ background: '#F0FDF4' }}>
                      <Clock size={18} color="#16A34A" />
                    </div>
                    <div>
                      <div className="detail-row-label">Status</div>
                      <div className="detail-row-value status-open">● Disponível</div>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-row-icon" style={{ background: '#F0F9FF' }}>
                      <MapPin size={18} color="#0284C7" />
                    </div>
                    <div>
                      <div className="detail-row-label">Endereço</div>
                      <div className="detail-row-value">{activeFacility.address}</div>
                    </div>
                  </div>
                </div>
                <div className="detail-actions">
                  <button className="btn-route" onClick={() => startNav(activeFacility)}>
                    <Navigation2 size={18} /> Ir agora
                  </button>
                  <button className="btn-share" onClick={() => {
                    const text = `${activeFacility.name}\n${activeFacility.address}\nhttps://waze.com/ul?ll=${activeFacility.lat},${activeFacility.lon}`;
                    navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text);
                  }}>Compartilhar</button>
                </div>
              </div>
            </div>
          )}

          {!detailOpen && (
            <div className="bottom-sheet">
              <div className="sheet-handle" />
              <div className="sheet-label">UNIDADES PRÓXIMAS · {facilities.length} encontradas</div>
              <div className="facility-list">
                {facilities.length === 0 && !loading && (
                  <p className="empty-msg">Nenhuma unidade encontrada. Arraste o mapa e toque em "Buscar nesta área".</p>
                )}
                {facilities.map(fac => (
                  <div
                    key={fac.id}
                    className={`facility-card ${activeFacility?.id === fac.id ? 'fc-active' : ''}`}
                    onClick={() => openDetail(fac)}
                  >
                    <div className="fc-icon" style={{ background: typeColor(fac.type) + '18', color: typeColor(fac.type) }}>
                      <Building2 size={18} />
                    </div>
                    <div className="fc-info">
                      <div className="fc-name">{fac.name}</div>
                      <div className="fc-type" style={{ color: typeColor(fac.type) }}>{fac.type}</div>
                    </div>
                    <div className="fc-right">
                      <div className="fc-dist">{fmtDist(fac.distance)}</div>
                      <ChevronRight size={16} color="#D1D5DB" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
