import { useState, useEffect } from "react";
import { Map, Cpu, TrendingUp, Clock } from "lucide-react";
import Layout from "../components/Layout";
import HeatMap from "../components/HeatMap";
import TimelinePlayer from "../components/TimelinePlayer";
import StatsCard from "../components/StatsCard";
import { getPredictions, getNoiseSources } from "../services/api";

const FALLBACK_FORECAST = [
  { lat: 17.385,  lng: 78.486,  db: 92, label: "Hitech City (forecast)" },
  { lat: 17.4401, lng: 78.3489, db: 68, label: "Kukatpally (forecast)" },
  { lat: 17.3616, lng: 78.4747, db: 81, label: "Banjara Hills (forecast)" },
  { lat: 17.4239, lng: 78.4738, db: 96, label: "Secunderabad (forecast)" },
  { lat: 17.3850, lng: 78.5500, db: 55, label: "LB Nagar (forecast)" },
  { lat: 17.4950, lng: 78.3900, db: 77, label: "Balanagar (forecast)" },
  { lat: 17.3300, lng: 78.5500, db: 71, label: "Dilsukhnagar (forecast)" },
];

const FALLBACK_HOTSPOTS = [
  { zone: "Secunderabad",  risk: "High",   db: 96, change: "+8 dB" },
  { zone: "Hitech City",   risk: "High",   db: 92, change: "+7 dB" },
  { zone: "Banjara Hills", risk: "Medium", db: 81, change: "+3 dB" },
  { zone: "Balanagar",     risk: "Medium", db: 77, change: "+4 dB" },
];

const riskColor = { High: "var(--red)", Medium: "var(--orange)", Low: "var(--green)" };

export default function Predictions() {
  const [hour, setHour] = useState(18);
  const [forecastPoints, setForecastPoints] = useState(FALLBACK_FORECAST);
  const [hotspots, setHotspots] = useState(FALLBACK_HOTSPOTS);
  const [meta, setMeta] = useState({ next_10_min: 72, next_1_hour: 75, next_24_hour: 67, hotspot_count: 4, peak: 96 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getPredictions(),
      getNoiseSources(),
    ])
      .then(([predRes, noiseSrcRes]) => {
        const d = predRes.data;
        setMeta({
          next_10_min: d.next_10_min,
          next_1_hour: d.next_1_hour,
          next_24_hour: d.next_24_hour,
          hotspot_count: d.hotspots?.length || 0,
          peak: Math.max(...(d.hotspots || []).map((h) => h.db), 0),
        });
        if (d.forecast_points) setForecastPoints(d.forecast_points);

        let srcMap = {};
        if (noiseSrcRes) {
          noiseSrcRes.data.forEach((s) => { srcMap[s.zone || s.node_id] = s.source; });
        }
        if (d.hotspots) {
          setHotspots(d.hotspots.map((h) => ({
            ...h,
            noise_source: srcMap[h.zone] || srcMap[h.node_id] || "",
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title="Predictions" subtitle="AI-powered noise forecast · Next 6 hours">
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatsCard title="Forecast Hotspots" value={meta.hotspot_count}  icon={Cpu}        trend="up"   trendLabel="Zones at risk" />
        <StatsCard title="Peak Forecast"     value={meta.peak} unit=" dB" icon={TrendingUp} trend="up" trendLabel="Highest predicted" />
        <StatsCard title="10 Min Forecast"   value={meta.next_10_min} unit=" dB" icon={Cpu} trend="up" trendLabel="Near-term prediction" />
        <StatsCard title="24h Avg Forecast"  value={meta.next_24_hour} unit=" dB" icon={Clock} trend="flat" trendLabel="Daily trend estimate" />
      </div>

      <div className="predictions-layout">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Map size={15} />
              Forecast Noise Heatmap
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Showing: {String(hour).padStart(2,"0")}:00
              </span>
              <div className="card-badge">AI</div>
            </div>
          </div>
          <div className="map-wrapper">
            <HeatMap points={forecastPoints} />
          </div>
          <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>
            <TimelinePlayer value={hour} setValue={setHour} />
          </div>
        </div>

        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-header">
            <div className="card-title">
              <TrendingUp size={15} />
              Predicted Hotspots
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hotspots.map((h) => (
                <div
                  key={h.zone}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "var(--bg-surface)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {h.zone}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {h.change} expected
                    </div>
                    {h.noise_source && (
                      <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: 1 }}>
                        Source: {h.noise_source}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: riskColor[h.risk] || "var(--text-primary)" }}>
                      {h.db} dB
                    </div>
                    <div style={{ fontSize: "0.68rem", color: riskColor[h.risk] || "var(--text-muted)", fontWeight: 600 }}>
                      {h.risk} Risk
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
