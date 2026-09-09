import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

import { useCyclone } from "@/state/cyclone-store";
import { WindParticleCanvas } from "./WindParticleCanvas";

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 5, { duration: 1.1 });
  }, [lat, lon, map]);
  return null;
}

export default function CycloneMap() {
  const { cyclone, layers, prediction, compareId, setFocusHour } = useCyclone();

  const revealed =
    prediction.status === "idle" ? cyclone.forecast : cyclone.forecast.filter((f) => prediction.revealedHours.includes(f.hour));
  const forecast = layers.prediction ? revealed : [];
  const compare = compareId ? cyclone.historical.find((h) => h.id === compareId) : null;

  const hasCoords = cyclone.lat !== 0 || cyclone.lon !== 0;
  const mapLat = hasCoords ? cyclone.lat : 16.0;
  const mapLon = hasCoords ? cyclone.lon : 78.0;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[18px]">
      <MapContainer center={[mapLat, mapLon]} zoom={5} className="h-full w-full" zoomControl={false}>
        {layers.satellite ? (
          <TileLayer
            attribution="Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution="&copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        )}

        <Recenter lat={mapLat} lon={mapLon} />

        {layers.history && cyclone.track.length > 1 ? (
          <Polyline positions={cyclone.track.map((p) => [p.lat, p.lon] as [number, number])} pathOptions={{ color: "#e8c79a", weight: 2 }} />
        ) : null}

        {forecast.length > 0 && hasCoords ? (
          <Polyline
            positions={[[cyclone.lat, cyclone.lon], ...forecast.map((f) => [f.lat, f.lon] as [number, number])]}
            pathOptions={{ color: "#e08a44", weight: 2, dashArray: "6 8" }}
          />
        ) : null}

        {layers.corridor
          ? forecast.map((f) => (
              <Circle
                key={`cor-${f.hour}`}
                center={[f.lat, f.lon]}
                radius={f.confidenceRadiusKm * 1000}
                pathOptions={{ color: "#e08a44", weight: 1, fillOpacity: 0.08 }}
              />
            ))
          : null}

        {layers.risk && cyclone.risk.score > 0 && hasCoords ? (
          <Circle
            center={[
              cyclone.forecast[cyclone.forecast.length - 1]?.lat ?? cyclone.lat,
              cyclone.forecast[cyclone.forecast.length - 1]?.lon ?? cyclone.lon,
            ]}
            radius={cyclone.risk.score * 6000}
            pathOptions={{ color: cyclone.risk.level === "LOW" ? "#8aa06a" : "#c74a34", weight: 1, fillOpacity: 0.12 }}
          />
        ) : null}

        {compare && compare.track.length > 0 ? (
          <Polyline
            positions={compare.track.map((p) => [p.lat, p.lon] as [number, number])}
            pathOptions={{ color: "#b79a7a", weight: 2, dashArray: "3 6" }}
          />
        ) : null}

        {forecast.map((f) => (
          <CircleMarker
            key={f.hour}
            center={[f.lat, f.lon]}
            radius={6}
            pathOptions={{ color: "#f2e5d3", fillColor: "#e08a44", fillOpacity: 1, weight: 1 }}
            eventHandlers={{ click: () => setFocusHour(f.hour) }}
          >
            <Popup>
              <div className="font-display text-[11px] uppercase tracking-[0.14em]">+{f.hour} hours</div>
              <div className="mt-1 text-[12px]">
                {f.lat.toFixed(1)}°N {f.lon.toFixed(1)}°E
              </div>
              <div className="text-[12px] opacity-70">Confidence ±{f.confidenceRadiusKm} km</div>
              <div className="text-[12px] opacity-70">
                {f.windKph > 0 ? `${f.windKph} km/h` : "Pending"} · {f.intensityTrend}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {hasCoords ? (
          <CircleMarker
            center={[cyclone.lat, cyclone.lon]}
            radius={10}
            pathOptions={{ color: "#ffffff", fillColor: "#c74a34", fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <div className="font-display text-[11px] uppercase tracking-[0.14em]">{cyclone.name}</div>
              <div className="mt-1 text-[12px]">
                {cyclone.windKph > 0 ? `${cyclone.windKph} km/h` : "Wind unavailable"} · {cyclone.pressureHpa > 0 ? `${cyclone.pressureHpa} hPa` : "Pressure unavailable"}
              </div>
              <div className="text-[12px] opacity-70">{cyclone.category}</div>
            </Popup>
          </CircleMarker>
        ) : null}
      </MapContainer>

      {layers.wind && cyclone.windKph > 0 ? <WindParticleCanvas speed={cyclone.windKph / 120} /> : null}
    </div>
  );
}
