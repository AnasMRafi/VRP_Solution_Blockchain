import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const depotIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to fit map bounds
const MapBounds = ({ positions }) => {
  const map = useMap();
  
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  
  return null;
};

const InteractiveMap = ({ depot, deliveryPoints, route }) => {
  // Default center (Casablanca)
  const defaultCenter = depot?.location 
    ? [depot.location.latitude, depot.location.longitude]
    : [33.5731, -7.5898];
  
  // Collect all positions for bounds calculation
  const allPositions = [];
  if (depot) {
    allPositions.push([depot.location.latitude, depot.location.longitude]);
  }
  if (deliveryPoints) {
    deliveryPoints.forEach(point => {
      allPositions.push([point.location.latitude, point.location.longitude]);
    });
  }
  
  // Create route polyline coordinates
  const routeCoordinates = route && route.optimized_sequence
    ? [
        [depot.location.latitude, depot.location.longitude],
        ...route.optimized_sequence.map(point => [
          point.location.latitude,
          point.location.longitude
        ]),
        [depot.location.latitude, depot.location.longitude]
      ]
    : [];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      style={{ height: '100%', width: '100%', minHeight: '500px' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      <MapBounds positions={allPositions} />
      
      {/* Depot Marker */}
      {depot && (
        <Marker
          position={[depot.location.latitude, depot.location.longitude]}
          icon={depotIcon}
        >
          <Popup>
            <div className="text-sm">
              <strong className="text-primary-600">Dépôt</strong>
              <p className="text-gray-600 mt-1">{depot.name}</p>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Delivery Point Markers */}
      {deliveryPoints && deliveryPoints.map((point, index) => (
        <Marker
          key={point.point_id || index}
          position={[point.location.latitude, point.location.longitude]}
          icon={deliveryIcon}
        >
          <Popup>
            <div className="text-sm">
              <strong className="text-red-600">
                {point.sequence_number ? `Stop ${point.sequence_number + 1}` : `Point ${index + 1}`}
              </strong>
              <p className="font-medium mt-1">{point.customer_name}</p>
              <p className="text-gray-600 text-xs mt-1">
                {point.address.street}, {point.address.city}
              </p>
              {point.package_count && (
                <p className="text-gray-600 text-xs">
                  Packages: {point.package_count}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
      
      {/* Route Polyline */}
      {routeCoordinates.length > 0 && (
        <Polyline
          positions={routeCoordinates}
          color="#3b82f6"
          weight={3}
          opacity={0.7}
        />
      )}
    </MapContainer>
  );
};

export default InteractiveMap;