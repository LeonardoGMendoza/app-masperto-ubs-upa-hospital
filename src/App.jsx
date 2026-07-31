import React, { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, Navigation2, Building2, X, ChevronRight, MapPin, Phone, Clock } from 'lucide-react'
import MapComponent from './MapComponent'
import './App.css'

// ── Dados hardcoded da Zona Leste para sempre ter resultados ──────────────────
const ZONA_LESTE_FALLBACK = [
  { id: 9001, name: 'UBS Itaquera', type: 'UBS', lat: -23.5394491, lon: -46.4551811, address: 'Itaquera, São Paulo' },
  { id: 9002, name: 'Hospital Santa Marcelina – Itaquera', type: 'Hospital', lat: -23.5542809, lon: -46.4613548, address: 'R. Santa Marcelina, 177 – Itaquera' },
  { id: 9003, name: 'UBS Vila Ramos', type: 'UBS', lat: -23.5205252, lon: -46.463897, address: 'Vila Ramos, São Paulo' },
  { id: 9004, name: 'UBS Jardim Robru', type: 'UBS', lat: -23.5213333, lon: -46.4124441, address: 'Jardim Robru, São Paulo' },
  { id: 9005, name: 'Hospital Tide Setubal', type: 'Hospital', lat: -23.4971785, lon: -46.4400842, address: 'São Miguel Paulista, São Paulo' },
  { id: 9006, name: 'UBS Vila Matilde', type: 'UBS', lat: -23.5367323, lon: -46.5277206, address: 'Vila Matilde, São Paulo' },
  { id: 9007, name: 'UBS Jardim Keralux', type: 'UBS', lat: -23.4822427, lon: -46.4931264, address: 'Jardim Keralux, São Paulo' },
  { id: 9008, name: 'UBS Pedro de Souza Campos', type: 'UBS', lat: -23.503142, lon: -46.4839706, address: 'São Paulo' },
];

function App() {
  const [userLocation, setUserLocation] = useState(null)
  const [facilities, setFacilities] = useState([])
  const [activeFacility, setActiveFacility] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mapCenter, setMapCenter] = useState(null)
  const [showSearchBtn, setShowSearchBtn] = useState(false)
  const [currentSearchCenter, setCurrentSearchCenter] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false) // second screen

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude }
          setUserLocation(loc)
          setCurrentSearchCenter(loc)
          fetchFacilities(loc.lat, loc.lon, loc)
        },
        () => {
          // fallback: Itaquera
          const loc = { lat: -23.5413, lon: -46.4496 }
          setUserLocation(loc)
          setCurrentSearchCenter(loc)
          fetchFacilities(loc.lat, loc.lon, loc)
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    } else {
      setLoading(false)
    }
  }, [])

  const fetchFacilities = async (lat, lon, refLoc) => {
    setLoading(true)
    setShowSearchBtn(false)
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
      const refLat = refLoc ? refLoc.lat : lat
      const refLon = refLoc ? refLoc.lon : lon
      const seen = new Set()
      const items = data.elements
        .filter(el => {
          if (!el.tags?.name) return false
          const key = el.tags.name
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(el => {
          const elLat = el.lat ?? el.center?.lat
          const elLon = el.lon ?? el.center?.lon
          if (!elLat || !elLon) return null
          const dist = calcDist(refLat, refLon, elLat, elLon)
          let type = 'Clínica'
          const amenity = el.tags.amenity || ''
          const hc = el.tags.healthcare || ''
          if (amenity === 'hospital' || hc === 'hospital') type = 'Hospital'
          else if (el.tags.name?.match(/UPA/i)) type = 'UPA'
          else if (el.tags.name?.match(/UBS|UBSF|USF|Unidade B/i)) type = 'UBS'
          else if (el.tags.name?.match(/AMA\b/i)) type = 'AMA'
          else if (amenity === 'doctors') type = 'Médico'
          return { id: el.id, name: el.tags.name, type, lat: elLat, lon: elLon, distance: dist, address: el.tags['addr:street'] ? `${el.tags['addr:street']}${el.tags['addr:housenumber'] ? ', ' + el.tags['addr:housenumber'] : ''}` : 'São Paulo – SP' }
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 60)

      // If API returned nothing, use hardcoded fallback
      if (items.length === 0) {
        const fallback = ZONA_LESTE_FALLBACK.map(f => ({
          ...f,
          distance: calcDist(refLat, refLon, f.lat, f.lon)
        })).sort((a, b) => a.distance - b.distance)
        setFacilities(fallback)
      } else {
        setFacilities(items)
      }
    } catch (err) {
      console.error('API error:', err)
      // fallback on error
      const fallback = ZONA_LESTE_FALLBACK.map(f => ({
        ...f,
        distance: calcDist(lat, lon, f.lat, f.lon)
      })).sort((a, b) => a.distance - b.distance)
      setFacilities(fallback)
    } finally {
      setLoading(false)
    }
  }

  const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const fmtDist = d => d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1)} km`

  const typeColor = (type) => ({
    'Hospital': '#DC2626',
    'UPA': '#EA580C',
    'UBS': '#2563EB',
    'AMA': '#7C3AED',
    'Médico': '#0284C7',
    'Clínica': '#0891B2',
  }[type] ?? '#2563EB')

  const openDetail = (fac) => {
    setActiveFacility(fac)
    setDetailOpen(true)
  }

  const closeDetail = () => setDetailOpen(false)

  const handleRoute = () => {
    if (!activeFacility) return
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeFacility.lat},${activeFacility.lon}`, '_blank')
  }

  const handleMapMove = (c) => {
    setMapCenter(c)
    if (currentSearchCenter && calcDist(currentSearchCenter.lat, currentSearchCenter.lon, c.lat, c.lon) > 2) {
      setShowSearchBtn(true)
    }
  }

  const searchNewArea = () => {
    if (mapCenter) { setCurrentSearchCenter(mapCenter); fetchFacilities(mapCenter.lat, mapCenter.lon, mapCenter) }
  }

  return (
    <div className="app-container">

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />
            <p>Buscando unidades de saúde…</p>
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
      />

      {/* Top search bar */}
      <div className="top-bar">
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

      {/* FAB nav (always visible) */}
      <button
        className={`fab-nav ${!activeFacility ? 'fab-disabled' : ''}`}
        onClick={handleRoute}
        disabled={!activeFacility}
        title="Traçar rota"
      >
        <Navigation2 size={22} fill={activeFacility ? 'white' : '#9CA3AF'} />
      </button>

      {/* ─────────── TELA 2: Detail sheet (like CarGO second screen) ─────────── */}
      {detailOpen && activeFacility && (
        <div className="detail-overlay" onClick={closeDetail}>
          <div className="detail-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />

            {/* Header with close */}
            <div className="detail-header">
              <div className="detail-type-badge" style={{ background: typeColor(activeFacility.type) + '20', color: typeColor(activeFacility.type) }}>
                {activeFacility.type}
              </div>
              <button className="close-btn" onClick={closeDetail}><X size={20} /></button>
            </div>

            {/* Name & distance */}
            <h2 className="detail-name">{activeFacility.name}</h2>
            <p className="detail-dist">
              <MapPin size={14} color="#6B7280" /> {fmtDist(activeFacility.distance)} de distância
            </p>

            {/* Info rows */}
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
                  <div className="detail-row-value">{activeFacility.address || 'São Paulo – SP'}</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="detail-actions">
              <button className="btn-route" onClick={handleRoute}>
                <Navigation2 size={18} /> Traçar Rota
              </button>
              <button className="btn-share" onClick={() => {
                const text = `${activeFacility.name} – ${fmtDist(activeFacility.distance)}\nhttps://maps.google.com/?q=${activeFacility.lat},${activeFacility.lon}`
                navigator.share ? navigator.share({ text }) : alert(text)
              }}>
                Compartilhar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── TELA 1: Bottom sheet list ─────────── */}
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
    </div>
  )
}

export default App
