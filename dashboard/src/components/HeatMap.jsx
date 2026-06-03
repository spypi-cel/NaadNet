import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, Tooltip, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function noiseColor(v) {
  if (v < 55) return "#22c55e";
  if (v < 70) return "#eab308";
  if (v < 85) return "#f97316";
  return "#ef4444";
}

function tempColor(v) {
  if (v < 15) return "#3b82f6";
  if (v < 20) return "#60a5fa";
  if (v < 25) return "#22c55e";
  if (v < 30) return "#eab308";
  if (v < 35) return "#f97316";
  if (v < 40) return "#ef4444";
  return "#dc2626";
}

function humidityColor(v) {
  if (v < 30) return "#ef4444";
  if (v < 45) return "#f97316";
  if (v < 55) return "#eab308";
  if (v < 65) return "#22c55e";
  if (v < 75) return "#3b82f6";
  if (v < 85) return "#6366f1";
  return "#8b5cf6";
}

const colorFns = { noise: noiseColor, temperature: tempColor, humidity: humidityColor };

const searchIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], center.zoom || 13, { duration: 1 });
  }, [center, map]);
  return null;
}

const defaultPoints = [
  { lat: 17.385,  lng: 78.486,  db: 85, temperature: 32.1, humidity: 65, label: "Hitech City" },
  { lat: 17.4401, lng: 78.3489, db: 62, temperature: 31.5, humidity: 68, label: "Kukatpally" },
  { lat: 17.3616, lng: 78.4747, db: 78, temperature: 33.0, humidity: 60, label: "Banjara Hills" },
  { lat: 17.4239, lng: 78.4738, db: 91, temperature: 30.8, humidity: 70, label: "Secunderabad" },
  { lat: 17.3850, lng: 78.5500, db: 50, temperature: 31.2, humidity: 66, label: "LB Nagar" },
  { lat: 17.4950, lng: 78.3900, db: 73, temperature: 29.0, humidity: 72, label: "Balanagar" },
  { lat: 17.3300, lng: 78.5500, db: 68, temperature: 30.0, humidity: 64, label: "Dilsukhnagar" },
];

const MODE_UNITS = { noise: "dB", temperature: "°C", humidity: "%" };

export default function HeatMap({ points = defaultPoints, height = "420px", searchMarker, flyTo, mode = "noise" }) {
  const colorFn = colorFns[mode] || noiseColor;
  const unit = MODE_UNITS[mode] || "dB";

  return (
    <div style={{ height, width: "100%", position: "relative" }}>
      <MapContainer
        center={[17.4, 78.47]}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {flyTo && <FlyTo center={flyTo} />}

        {points.map((p, i) => {
          const val = mode === "temperature" ? p.temperature : mode === "humidity" ? p.humidity : p.db;
          return (
            <Circle
              key={i}
              center={[p.lat, p.lng]}
              radius={400}
              pathOptions={{
                color: colorFn(val),
                fillColor: colorFn(val),
                fillOpacity: 0.35,
                weight: 1.5,
              }}
            >
              <Tooltip>
                <div style={{ fontSize: "12px", fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: "11px", color: colorFn(val) }}>{val} {unit}</div>
              </Tooltip>
            </Circle>
          );
        })}

        {searchMarker && (
          <Marker position={[searchMarker.lat, searchMarker.lng]} icon={searchIcon}>
            <Popup>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{searchMarker.label}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                {searchMarker.lat.toFixed(5)}, {searchMarker.lng.toFixed(5)}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}