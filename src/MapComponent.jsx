import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon
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

const createClusterIcon = (cluster) =>
  L.divIcon({
    html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
    className: 'custom-cluster-marker',
    iconSize: L.point(36, 36, true),
  });

const userIcon = createUserIcon();

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

const MapComponent = ({ userLocation, facilities, activeFacility, onFacilitySelect, onMapMove, getTypeColor }) => {
  const defaultCenter = [-23.5505, -46.6333];
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
      <ChangeView center={center} zoom={userLocation ? 15 : 13} />
      <MapEvents onMove={onMapMove} />

      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon}>
          <Popup>Você está aqui</Popup>
        </Marker>
      )}

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
    </MapContainer>
  );
};

export default MapComponent;
