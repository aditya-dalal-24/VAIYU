import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Cyclone, Prediction } from '../../types';
import { WindParticleCanvas } from './WindParticleCanvas';
import { Wind, Layers, ShieldAlert, Navigation } from 'lucide-react';

// Custom Leaflet Cyclone Pulsing Radar Marker Icon
const createCycloneIcon = () => {
  return L.divIcon({
    className: 'custom-cyclone-marker',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        <div class="absolute w-12 h-12 bg-red-500/20 rounded-full animate-ping"></div>
        <div class="absolute w-8 h-8 bg-indigo-600/40 rounded-full border-2 border-indigo-400 radar-sweep-animation"></div>
        <div class="relative w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

interface CycloneMapProps {
  cyclone: Cyclone;
  prediction?: Prediction;
  height?: string;
}

export const CycloneMap: React.FC<CycloneMapProps> = ({
  cyclone,
  prediction,
  height = '550px'
}) => {
  const [showWindParticles, setShowWindParticles] = useState(true);
  const [showPrediction, setShowPrediction] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [tileLayerType, setTileLayerType] = useState<'dark' | 'satellite'>('dark');

  const latestObs = cyclone.latestObservation;
  const centerLat = latestObs ? latestObs.latitude : 18.5;
  const centerLong = latestObs ? latestObs.longitude : 67.5;

  // Extract historical track points
  const historicalTrackPoints: [number, number][] = (cyclone.observations || []).map(obs => [obs.latitude, obs.longitude]);

  // Extract predicted trajectory points
  const predictedTrackPoints: [number, number][] = (prediction?.trajectory || []).map(pt => [pt.lat, pt.longCoord]);
  
  // Combine latest position with predictions for continuous line
  const fullPredictedPolyline: [number, number][] = latestObs 
    ? [[latestObs.latitude, latestObs.longitude], ...predictedTrackPoints]
    : predictedTrackPoints;

  // Build confidence corridor polygon coordinates around predicted points
  const confidencePolygonCoords: [number, number][] = [];
  if (prediction?.trajectory && prediction.trajectory.length > 0) {
    const forwardPoints: [number, number][] = [];
    const returnPoints: [number, number][] = [];

    prediction.trajectory.forEach(pt => {
      const radiusDeg = pt.confidenceRadiusKm / 111.0; // ~111km per lat degree
      forwardPoints.push([pt.lat + radiusDeg * 0.7, pt.longCoord + radiusDeg * 0.7]);
      returnPoints.unshift([pt.lat - radiusDeg * 0.7, pt.longCoord - radiusDeg * 0.7]);
    });

    if (latestObs) {
      confidencePolygonCoords.push([latestObs.latitude, latestObs.longitude]);
    }
    confidencePolygonCoords.push(...forwardPoints, ...returnPoints);
  }

  // Coastal Risk Zones
  const riskZonePolygon: [number, number][] = [
    [22.5, 68.0],
    [23.8, 68.5],
    [24.1, 70.2],
    [23.2, 70.8],
    [22.0, 69.5]
  ];

  const darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const satelliteTileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-800 shadow-2xl glass-panel" style={{ height }}>
      {/* Controls Overlay Bar */}
      <div className="absolute top-4 right-4 z-[500] flex flex-wrap gap-2 glass-panel p-2 rounded-xl">
        <button
          onClick={() => setShowWindParticles(!showWindParticles)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showWindParticles
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
              : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          <span>Wind Particle Field</span>
        </button>

        <button
          onClick={() => setShowPrediction(!showPrediction)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showPrediction
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
              : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Trajectory Cone</span>
        </button>

        <button
          onClick={() => setShowRiskZones(!showRiskZones)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showRiskZones
              ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
              : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Coastal Risk Zone</span>
        </button>

        <button
          onClick={() => setTileLayerType(tileLayerType === 'dark' ? 'satellite' : 'dark')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800/80 text-gray-300 hover:bg-gray-700 transition-all"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{tileLayerType === 'dark' ? 'Satellite View' : 'Dark Base'}</span>
        </button>
      </div>

      {/* Earth.nullschool Particle Canvas Overlay */}
      <WindParticleCanvas
        centerLat={centerLat}
        centerLong={centerLong}
        maxWindSpeedKph={latestObs ? latestObs.windSpeedKph : 150}
        isActive={showWindParticles}
      />

      {/* Leaflet Base Map */}
      <MapContainer
        center={[centerLat, centerLong]}
        zoom={6}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url={tileLayerType === 'dark' ? darkTileUrl : satelliteTileUrl}
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Historical Track Line */}
        {historicalTrackPoints.length > 0 && (
          <Polyline
            positions={historicalTrackPoints}
            pathOptions={{ color: '#6366F1', weight: 4, opacity: 0.8 }}
          />
        )}

        {/* Predicted Trajectory Dashed Line */}
        {showPrediction && fullPredictedPolyline.length > 1 && (
          <Polyline
            positions={fullPredictedPolyline}
            pathOptions={{ color: '#A855F7', weight: 3, dashArray: '8, 8', opacity: 0.9 }}
          />
        )}

        {/* Confidence Corridor Polygon */}
        {showPrediction && confidencePolygonCoords.length > 2 && (
          <Polygon
            positions={confidencePolygonCoords}
            pathOptions={{ color: '#C084FC', fillColor: '#A855F7', fillOpacity: 0.15, weight: 1, dashArray: '4, 4' }}
          />
        )}

        {/* Coastal Risk Zone */}
        {showRiskZones && (
          <Polygon
            positions={riskZonePolygon}
            pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.2, weight: 2 }}
          />
        )}

        {/* Active Cyclone Marker */}
        {latestObs && (
          <Marker
            position={[latestObs.latitude, latestObs.longitude]}
            icon={createCycloneIcon()}
          >
            <Popup>
              <div className="p-1 space-y-1.5 min-w-[200px]">
                <div className="flex items-center justify-between border-b border-gray-700 pb-1">
                  <span className="font-bold text-sm text-indigo-400">{cyclone.name}</span>
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-mono">
                    {cyclone.currentCategory}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Position</span>
                    <span className="font-mono font-medium">{latestObs.latitude}°N, {latestObs.longitude}°E</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Wind Speed</span>
                    <span className="font-mono font-bold text-amber-400">{latestObs.windSpeedKph} km/h</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Central Pressure</span>
                    <span className="font-mono">{latestObs.pressureHpa} hPa</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Movement</span>
                    <span className="font-mono">{latestObs.movementSpeedKph || 14} km/h</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Forecast Points Markers */}
        {showPrediction && prediction?.trajectory?.map((pt, idx) => (
          <Marker
            key={idx}
            position={[pt.lat, pt.longCoord]}
            icon={L.divIcon({
              className: 'custom-forecast-marker',
              html: `<div class="w-3.5 h-3.5 bg-purple-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[8px] font-bold text-white">+${pt.forecastHour}h</div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <p className="font-bold text-purple-400">+{pt.forecastHour} Hours Forecast</p>
                <p className="font-mono">Coordinates: {pt.lat}°N, {pt.longCoord}°E</p>
                <p className="text-gray-400">Confidence Radius: <span className="text-white font-bold">{pt.confidenceRadiusKm} km</span></p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};






