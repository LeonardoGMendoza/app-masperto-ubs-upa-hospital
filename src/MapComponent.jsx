import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createPinIcon = (color = '#2563EB') =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-pin" style="background:${color}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const createUserIcon = () =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div class="user-dot"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const createDestIcon = (color) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width:36px;height:36px;
      background:${color};
      border:3px solid #fff;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 4px 12px rgba(0,0,0,.3);
    "></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });

const createClusterIcon = (cluster) =>
  L.divIcon({
    html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
    className: 'custom-cluster-marker',
    iconSize: L.point(36, 36, true),
  });

const userIcon = createUserIcon();

// Fit map to show both user and destination
const FitBounds = ({ userLocation, destination }) => {
  const map = useMap();
  useEffect(() => {
    if (userLocation && destination) {
      map.fitBounds(
        [[userLocation.lat, userLocation.lon], [destination.lat, destination.lon]],
        { padding: [60, 60], animate: true }
      );
    }
  }, [userLocation, destination, map]);
  return null;
};

const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
};

const MapEvents = ({ onMove }) => {
  useMapEvents({
    dragend: (e) => { const c = e.target.getCenter(); onMove({ lat: c.lat, lon: c.lng }); },
    zoomend: (e) => { const c = e.target.getCenter(); onMove({ lat: c.lat, lon: c.lng }); },
  });
  return null;
};

const MapComponent = ({ userLocation, facilities, activeFacility, onFacilitySelect, onMapMove, getTypeColor, navMode, routeCoords }) => {
  const defaultCenter = [-23.5413, -46.4496];
  const center = userLocation ? [userLocation.lat, userLocation.lon] : defaultCenter;

  return (
    <MapContainer
      center={center}
      zoom={14}
      className="map-area"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {!navMode && <ChangeView center={center} zoom={userLocation ? 15 : 13} />}
      {navMode && activeFacility && userLocation && (
        <FitBounds userLocation={userLocation} destination={activeFacility} />
      )}

      <MapEvents onMove={onMapMove} />

      {/* Route polyline */}
      {navMode && routeCoords && routeCoords.length > 0 && (
        <>
          {/* Shadow */}
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: '#1d4ed8', weight: 10, opacity: 0.2 }}
          />
          {/* Main route */}
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: '#2563EB', weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
          />
        </>
      )}

      {/* User location */}
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon}>
          <Popup>Você está aqui</Popup>
        </Marker>
      )}

      {/* Destination pin in nav mode */}
      {navMode && activeFacility && (
        <Marker
          position={[activeFacility.lat, activeFacility.lon]}
          icon={createDestIcon(getTypeColor ? getTypeColor(activeFacility.type) : '#2563EB')}
        >
          <Popup>{activeFacility.name}</Popup>
        </Marker>
      )}

      {/* Facility cluster markers (hidden in nav mode) */}
      {!navMode && (
        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          maxClusterRadius={50}
        >
          {facilities.map((fac) => (
            <Marker
              key={fac.id}
              position={[fac.lat, fac.lon]}
              icon={createPinIcon(getTypeColor ? getTypeColor(fac.type) : '#2563EB')}
              eventHandlers={{ click: () => onFacilitySelect(fac) }}
            >
              <Popup><strong>{fac.name}</strong><br />{fac.type}</Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      )}
    </MapContainer>
  );
};

export default MapComponent;
