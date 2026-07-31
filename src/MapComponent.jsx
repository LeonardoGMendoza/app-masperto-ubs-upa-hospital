import React, { useEffect, useRef, useState, useMemo } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// We will use the actual Waze tile servers as a raster source!
const MAP_STYLE = {
  version: 8,
  sources: {
    'waze-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© Waze'
    }
  },
  layers: [
    {
      id: 'waze-layer',
      type: 'raster',
      source: 'waze-tiles',
      minzoom: 0,
      maxzoom: 20
    }
  ]
};

// We'll create simple HTML markers instead of the old Leaflet divIcons
const UserMarkerIcon = () => (
  <div className="waze-ghost">
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
);

const FacilityMarkerIcon = ({ color }) => (
  <div style={{
    width: 32, height: 32, background: color, border: '3px solid #fff',
    borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
    boxShadow: '0 4px 12px rgba(0,0,0,.3)'
  }}>
    <div style={{
      width: 12, height: 12, background: '#fff', borderRadius: '50%',
      position: 'absolute', top: 7, left: 7
    }}></div>
  </div>
);

const DestinationMarkerIcon = ({ color }) => (
  <div style={{
    width: 48, height: 48, background: color, border: '4px solid #fff',
    borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
    boxShadow: '0 6px 16px rgba(0,0,0,.4)', zIndex: 10
  }}>
    <div style={{
      width: 16, height: 16, background: '#fff', borderRadius: '50%',
      position: 'absolute', top: 12, left: 12
    }}></div>
  </div>
);

const MapComponent = ({
  userLocation,
  facilities,
  activeFacility,
  onFacilitySelect,
  onMapMove,
  getTypeColor,
  navMode,
  routeCoords
}) => {
  const mapRef = useRef();
  
  const defaultCenter = { longitude: -46.4496, latitude: -23.5413, zoom: 13, pitch: 45, bearing: 0 };
  const [viewState, setViewState] = useState(defaultCenter);

  // When userLocation is available initially, center it
  useEffect(() => {
    if (userLocation && !navMode) {
      setViewState(prev => ({
        ...prev,
        longitude: userLocation.lon,
        latitude: userLocation.lat,
        zoom: 14.5,
        pitch: 60, // 3D effect
        transitionDuration: 1000
      }));
    }
  }, [userLocation, navMode]);

  // Fit bounds to route in Nav Mode
  useEffect(() => {
    if (navMode && userLocation && activeFacility && mapRef.current) {
      const map = mapRef.current.getMap();
      
      // Calculate bounding box for route
      const bounds = new maplibregl.LngLatBounds(
        [userLocation.lon, userLocation.lat],
        [userLocation.lon, userLocation.lat]
      );
      bounds.extend([activeFacility.lon, activeFacility.lat]);
      if (routeCoords) {
        routeCoords.forEach(c => bounds.extend([c[1], c[0]])); // routeCoords are [lat, lon], maplibre wants [lon, lat]
      }

      map.fitBounds(bounds, {
        padding: 60,
        pitch: 65, // Max pitch for waze-like view
        bearing: 0, // In a real app we'd calculate the bearing between user and destination
        duration: 2000
      });
    }
  }, [navMode, userLocation, activeFacility, routeCoords]);

  // Prepare Route GeoJSON
  const routeData = useMemo(() => {
    if (!routeCoords || routeCoords.length === 0) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoords.map(c => [c[1], c[0]]) // Leaflet is [lat, lon], MapLibre/GeoJSON is [lon, lat]
      }
    };
  }, [routeCoords]);

  const onMoveEnd = (e) => {
    setViewState(e.viewState);
    if (onMapMove) {
      onMapMove({ lat: e.viewState.latitude, lon: e.viewState.longitude });
    }
  };

  return (
    <div className="map-area">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onMoveEnd={onMoveEnd}
        mapStyle={MAP_STYLE}
        mapLib={maplibregl}
        maxPitch={85} // Allow high pitch for 3D effect
        interactiveLayerIds={['facilities-layer']}
      >
        <NavigationControl position="top-right" showCompass={true} />

        {/* User Marker */}
        {userLocation && (
          <Marker
            longitude={userLocation.lon}
            latitude={userLocation.lat}
            anchor="center"
            style={{ zIndex: 100 }}
          >
            <UserMarkerIcon />
          </Marker>
        )}

        {/* Destination Marker (Nav Mode) */}
        {navMode && activeFacility && (
          <Marker
            longitude={activeFacility.lon}
            latitude={activeFacility.lat}
            anchor="bottom"
            style={{ zIndex: 90 }}
          >
            <DestinationMarkerIcon color={getTypeColor(activeFacility.type)} />
          </Marker>
        )}

        {/* Facility Markers (Normal Mode) */}
        {!navMode && facilities.map(fac => (
          <Marker
            key={fac.id}
            longitude={fac.lon}
            latitude={fac.lat}
            anchor="bottom"
            onClick={e => {
              e.originalEvent.stopPropagation();
              onFacilitySelect(fac);
            }}
          >
            <FacilityMarkerIcon color={getTypeColor(fac.type)} />
          </Marker>
        ))}

        {/* Route Line (Nav Mode) */}
        {navMode && routeData && (
          <Source id="route-source" type="geojson" data={routeData}>
            {/* Outline/Shadow */}
            <Layer
              id="route-line-bg"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#1d4ed8',
                'line-width': 10,
                'line-opacity': 0.3
              }}
            />
            {/* Main Line */}
            <Layer
              id="route-line"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#2563EB',
                'line-width': 6
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
};

export default MapComponent;
