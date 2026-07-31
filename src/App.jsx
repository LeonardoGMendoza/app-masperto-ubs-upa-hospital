import React, { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, Navigation2, Building2, X, ChevronRight, MapPin, Clock, ArrowLeft, Car } from 'lucide-react'
import MapComponent from './MapComponent'
import './App.css'

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
]

function App() {
  const [userLocation, setUserLocation] = useState(null)
  const [facilities, setFacilities] = useState([])
  const [activeFacility, setActiveFacility] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mapCenter, setMapCenter] = useState(null)
  const [showSearchBtn, setShowSearchBtn] = useState(false)
  const [currentSearchCenter, setCurrentSearchCenter] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ── Navigation mode state ──────────────────────────────────────────────────
  const [navMode, setNavMode] = useState(false)
  const [routeCoords, setRouteCoords] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null) // { distance, duration }
  const [routeLoading, setRouteLoading] = useState(false)

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude }
          setUserLocation(loc); setCurrentSearchCenter(loc)
          fetchFacilities(loc.lat, loc.lon, loc)
        },
        () => {
          const loc = { lat: -23.5413, lon: -46.4496 }
          setUserLocation(loc); setCurrentSearchCenter(loc)
          fetchFacilities(loc.lat, loc.lon, loc)
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    } else { setLoading(false) }
  }, [])

  const fetchFacilities = async (lat, lon, refLoc) => {
    setLoading(true); setShowSearchBtn(false)
    const radius = 8000
    const query = `[out:json][timeout:30];
(
  node["amenity"~"hospital|clinic|doctors|health_post"](around:${radius},${lat},${lon});
  way["amenity"~"hospital|clinic|doctors|health_post"](around:${radius},${lat},${lon});
  node["healthcare"~"hospital|clinic|centre|doctor"](around:${radius},${lat},${lon});
  way["healthcare"~"hospital|clinic|centre|doctor"](around:${radius},${lat},${lon});
);
out center;`
    try {
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'User-Agent': 'PerToSaude/1.0' },
        body: query
      })
      const data = await resp.json()
      const refLat = refLoc?.lat ?? lat; const refLon = refLoc?.lon ?? lon
      const seen = new Set()
      const items = data.elements.filter(el => {
        if (!el.tags?.name) return false
        if (seen.has(el.tags.name)) return false
        seen.add(el.tags.name); return true
      }).map(el => {
        const elLat = el.lat ?? el.center?.lat; const elLon = el.lon ?? el.center?.lon
        if (!elLat || !elLon) return null
        const dist = calcDist(refLat, refLon, elLat, elLon)
        let type = 'Clínica'
        const amenity = el.tags.amenity || ''; const hc = el.tags.healthcare || ''
        if (amenity === 'hospital' || hc === 'hospital') type = 'Hospital'
        else if (el.tags.name?.match(/UPA/i)) type = 'UPA'
        else if (el.tags.name?.match(/UBS|UBSF|USF|Unidade B/i)) type = 'UBS'
        else if (el.tags.name?.match(/AMA\b/i)) type = 'AMA'
        else if (amenity === 'doctors') type = 'Médico'
        const street = el.tags['addr:street']
        const num = el.tags['addr:housenumber']
        return { id: el.id, name: el.tags.name, type, lat: elLat, lon: elLon, distance: dist, address: street ? `${street}${num ? ', ' + num : ''} – SP` : 'São Paulo – SP' }
      }).filter(Boolean).sort((a, b) => a.distance - b.distance).slice(0, 60)
      setFacilities(items.length > 0 ? items : withDist(FALLBACK, refLat, refLon))
    } catch { setFacilities(withDist(FALLBACK, lat, lon)) }
    finally { setLoading(false) }
  }

  const withDist = (arr, lat, lon) =>
    arr.map(f => ({ ...f, distance: calcDist(lat, lon, f.lat, f.lon) })).sort((a, b) => a.distance - b.distance)

  const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const fmtDist = d => d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1)} km`

  const fmtDuration = (secs) => {
    const mins = Math.round(secs / 60)
    if (mins < 60) return `${mins} min`
    return `${Math.floor(mins / 60)}h ${mins % 60}min`
  }

  const typeColor = (type) => ({
    'Hospital': '#DC2626', 'UPA': '#EA580C', 'UBS': '#2563EB',
    'AMA': '#7C3AED', 'Médico': '#0284C7', 'Clínica': '#0891B2',
  }[type] ?? '#2563EB')

  // ── Fetch route from OSRM (free, OpenStreetMap routing) ───────────────────
  const fetchRoute = async (fac) => {
    if (!userLocation) return
    setRouteLoading(true)
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lon},${userLocation.lat};${fac.lon},${fac.lat}?overview=full&geometries=geojson`
      const resp = await fetch(url)
      const data = await resp.json()
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        // Convert GeoJSON [lon, lat] → Leaflet [lat, lon]
        const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon])
        setRouteCoords(coords)
        setRouteInfo({
          distance: route.distance,  // in meters
          duration: route.duration,  // in seconds
        })
      }
    } catch (e) {
      console.error('Route fetch error:', e)
    } finally {
      setRouteLoading(false)
    }
  }

  // ── Start navigation mode ──────────────────────────────────────────────────
  const startNav = async (fac) => {
    setActiveFacility(fac)
    setDetailOpen(false)
    setNavMode(true)
    await fetchRoute(fac)
  }

  const exitNav = () => {
    setNavMode(false)
    setRouteCoords(null)
    setRouteInfo(null)
  }

  const openInMaps = () => {
    if (!activeFacility) return
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeFacility.lat},${activeFacility.lon}`, '_blank')
  }

  const openDetail = (fac) => { setActiveFacility(fac); setDetailOpen(true) }
  const closeDetail = () => setDetailOpen(false)

  const handleMapMove = (c) => {
    setMapCenter(c)
    if (currentSearchCenter && calcDist(currentSearchCenter.lat, currentSearchCenter.lon, c.lat, c.lon) > 2)
      setShowSearchBtn(true)
  }

  const searchNewArea = () => {
    if (mapCenter) { setCurrentSearchCenter(mapCenter); fetchFacilities(mapCenter.lat, mapCenter.lon, mapCenter) }
  }

  return (
    <div className="app-container">

      {/* Loading */}
      {(loading || routeLoading) && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />
            <p>{routeLoading ? 'Calculando rota…' : 'Buscando unidades de saúde…'}</p>
          </div>
        </div>
      )}

      {/* Map */}
      <MapComponent
        userLocation={userLocation}
        facilities={facilities}
        activeFacility={activeFacility}
        onFacilitySelect={openDetail}
        onMapMove={handleMapMove}
        getTypeColor={typeColor}
        navMode={navMode}
        routeCoords={routeCoords}
      />

      {/* ═══════════════ NAVIGATION MODE (Screen 3 - Waze style) ═══════════════ */}
      {navMode && (
        <>
          {/* Top nav bar */}
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

          {/* Bottom navigation panel - Waze style */}
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
                    Abrir no Google Maps
                  </button>
                  <button className="nav-btn-cancel" onClick={exitNav}>
                    <X size={18} />
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: '8px 0' }}>
                Calculando rota…
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════ NORMAL MODE ═══════════════ */}
      {!navMode && (
        <>
          {/* Top search bar */}
          <div className="top-bar">
            <div className="app-logo-bar">
              <img src="/logo.png" alt="PerTo Saúde" className="app-logo-img" />
              <div className="app-logo-text">
                <span className="app-logo-name">PerTo <span style={{color:'#2563EB'}}>Saúde</span></span>
                <span className="app-logo-tagline">Saúde perto de você</span>
              </div>
            </div>
            <div className="search-bar">
              <Search size={18} color="#6B7280" />
              <input type="text" placeholder="Buscar local ou endereço" readOnly />
              <div className="divider" />
              <button className="filter-icon-btn"><SlidersHorizontal size={18} color="#2563EB" /></button>
            </div>
          </div>

          {/* Search this area */}
          <div className={`search-area-wrap ${!showSearchBtn ? 'hidden' : ''}`}>
            <button className="search-area-btn" onClick={searchNewArea}>
              <MapPin size={15} /> Buscar nesta área
            </button>
          </div>

          {/* FAB */}
          <button
            className={`fab-nav ${!activeFacility ? 'fab-disabled' : ''}`}
            onClick={() => activeFacility && startNav(activeFacility)}
            disabled={!activeFacility}
          >
            <Navigation2 size={22} fill={activeFacility ? 'white' : '#9CA3AF'} />
          </button>

          {/* Detail sheet (screen 2) */}
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
                    <Navigation2 size={18} /> Traçar Rota
                  </button>
                  <button className="btn-share" onClick={() => {
                    const text = `${activeFacility.name}\n${activeFacility.address}\nhttps://maps.google.com/?q=${activeFacility.lat},${activeFacility.lon}`
                    navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text)
                  }}>Compartilhar</button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom list sheet (screen 1) */}
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
  )
}

export default App
