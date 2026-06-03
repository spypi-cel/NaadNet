import { useState, useEffect } from "react";
import {
  Activity, Cpu, AlertTriangle, Wifi,
  MapPin, Clock, Search, X, Navigation, Download, Heart
} from "lucide-react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import HeatMap from "../components/HeatMap";
import AlertPanel from "../components/AlertPanel";
import NodeStatus from "../components/NodeStatus";
import TimelinePlayer from "../components/TimelinePlayer";
import { getNodes, getAlerts, getAnalytics, getHealthScores, getNoiseSources, getHeatmap } from "../services/api";
import { connectWS, onMessage } from "../services/websocket";
import { useApp } from "../context";

const FALLBACK_NODES = [
  { id: "HTC-01", location: "Hitech City",   lat: 17.3850, lng: 78.4860, noise: 85, status: "warning", temperature: 32.1, humidity: 65.0 },
  { id: "KKP-02", location: "Kukatpally",    lat: 17.4401, lng: 78.3489, noise: 62, status: "online",  temperature: 31.5, humidity: 68.0 },
  { id: "BNH-03", location: "Banjara Hills", lat: 17.3616, lng: 78.4747, noise: 78, status: "online",  temperature: 33.0, humidity: 60.0 },
  { id: "SEC-04", location: "Secunderabad",  lat: 17.4239, lng: 78.4738, noise: 91, status: "warning", temperature: 30.8, humidity: 70.0 },
  { id: "LBN-05", location: "LB Nagar",      lat: 17.3850, lng: 78.5500, noise: 50, status: "online",  temperature: 31.2, humidity: 66.0 },
  { id: "BAL-06", location: "Balanagar",     lat: 17.4950, lng: 78.3900, noise: 73, status: "online",  temperature: 29.0, humidity: 72.0 },
];

const FALLBACK_ALERTS = [
  { severity: "critical", message: "Node SEC-04 exceeded 91 dB threshold", meta: "Secunderabad · 2 min ago" },
  { severity: "warning",  message: "Node HTC-01 noise spike detected",      meta: "Hitech City · 8 min ago" },
  { severity: "warning",  message: "Node BNH-03 battery low (12%)",         meta: "Banjara Hills · 15 min ago" },
  { severity: "info",     message: "OTA firmware update available (v2.4.1)", meta: "All nodes · 1 hr ago" },
];

export default function Dashboard() {
  const [hour, setHour]         = useState(12);
  const [nodes, setNodes]       = useState(FALLBACK_NODES);
  const [alerts, setAlerts]     = useState(FALLBACK_ALERTS);
  const [stats, setStats]       = useState({ average: 67, alert_count: 3 });
  const [health, setHealth]     = useState({ overall: 78 });
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [searchMarker, setSearchMarker] = useState(null);
  const [flyTo, setFlyTo]       = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [directLat, setDirectLat] = useState("");
  const [directLng, setDirectLng] = useState("");
  const [heatmapMode, setHeatmapMode] = useState("noise");

  const { setNodeCount, setAlertCount, live, setLive } = useApp();

  // Initial data fetch
  useEffect(() => {
    Promise.all([
      getNodes().catch(() => null),
      getAlerts().catch(() => null),
      getAnalytics().catch(() => null),
      getHealthScores().catch(() => null),
      getNoiseSources().catch(() => null),
    ]).then(([nodesRes, alertsRes, analyticsRes, healthRes, noiseSrcRes]) => {
      const sourceMap = {};
      if (noiseSrcRes?.data) {
        noiseSrcRes.data.forEach((s) => {
          sourceMap[s.node_id] = { source: s.primary_source, bands: s.bands };
        });
      }
      if (nodesRes?.data) {
        setNodes(nodesRes.data.map((n) => ({
          id: n.id,
          location: n.label,
          lat: n.lat,
          lng: n.lng,
          noise: n.noise,
          status: n.status,
          temperature: n.temperature,
          humidity: n.humidity,
          noise_source: sourceMap[n.id]?.source,
          bands: sourceMap[n.id]?.bands,
        })));
      }
      if (alertsRes?.data) setAlerts(alertsRes.data);
      if (analyticsRes?.data) setStats(analyticsRes.data);
      if (healthRes?.data) setHealth(healthRes.data);
    }).finally(() => setLoading(false));
  }, []);

  // Sync counts to context
  useEffect(() => {
    setNodeCount(nodes.filter((n) => n.status !== "offline").length);
    setAlertCount(alerts.length);
  }, [nodes, alerts, setNodeCount, setAlertCount]);

  // WebSocket live updates
  useEffect(() => {
    connectWS();
    const unsub = onMessage((data) => {
      if (data.type === "noise_update") {
        setLive(true);
        setNodes((prev) =>
          prev.map((n) => {
            const u = data.nodes?.find((x) => x.id === n.id);
            return u ? { ...n, noise: u.noise, status: u.status, temperature: u.temperature, humidity: u.humidity } : n;
          })
        );
      }
    });
    return unsub;
  }, [setLive]);

  // Map search
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchErr("");
    setSearchResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      if (!data.length) setSearchErr("No locations found.");
      setSearchResults(data);
    } catch {
      setSearchErr("Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setSearchMarker({ lat, lng, label: r.display_name.split(",")[0] });
    setFlyTo({ lat, lng, zoom: 15 });
    setSearchResults([]);
    setSearchQuery(r.display_name.split(",")[0]);
    setShowSearch(false);
  }

  function handleDirectCoord() {
    const lat = parseFloat(directLat);
    const lng = parseFloat(directLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setSearchMarker({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      setFlyTo({ lat, lng, zoom: 16 });
    }
  }

  function handleExport() {
    const link = document.createElement("a");
    link.href = "/api/export/report.csv";
    link.download = "naadnet_report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const heatmapPoints = nodes
    .filter((n) => n.status !== "offline" && n.lat)
    .map((n) => ({ lat: n.lat, lng: n.lng, db: n.noise, temperature: n.temperature, humidity: n.humidity, label: n.location }));

  const onlineCount = nodes.filter((n) => n.status !== "offline").length;
  const avgNoise = nodes.filter((n) => n.noise > 0).length
    ? Math.round(nodes.filter((n) => n.noise > 0).reduce((s, n) => s + n.noise, 0) / nodes.filter((n) => n.noise > 0).length)
    : (stats.average || 0);

  const healthVal = health?.overall ?? 0;
  const healthColor = healthVal >= 80 ? "var(--green)" : healthVal >= 50 ? "var(--orange)" : "var(--red)";

  if (loading) {
    return (
      <Layout title="Dashboard" subtitle="Real-time noise monitoring · Hyderabad">
        <div className="stats-grid">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="stats-card">
              <div className="loading-shimmer" style={{ height: 14, width: "60%", marginBottom: 12 }} />
              <div className="loading-shimmer" style={{ height: 28, width: "40%", marginBottom: 8 }} />
              <div className="loading-shimmer" style={{ height: 12, width: "70%" }} />
            </div>
          ))}
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-col">
            <div className="card"><div className="loading-shimmer" style={{ height: 420 }} /></div>
          </div>
          <div className="dashboard-col">
            <div className="card"><div className="loading-shimmer" style={{ height: 300 }} /></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard" subtitle="Real-time noise monitoring · Hyderabad">
      {/* Stats */}
      <div className="stats-grid">
        <StatsCard title="Active Nodes"   value={onlineCount}   icon={Wifi}          iconBg="rgba(34,197,94,0.2)"   trend="flat" trendLabel="All online" />
        <StatsCard title="Avg Noise"      value={avgNoise}      unit=" dB" icon={Activity} iconBg="rgba(56,189,248,0.15)" trend="up" trendLabel="+4 dB from last hour" />
        <StatsCard title="Active Alerts"  value={alerts.length} icon={AlertTriangle}  iconBg="rgba(239,68,68,0.15)"  trend="up"   trendLabel="2 new since 10:00" />
        <StatsCard title="System Health"  value={`${healthVal}%`} icon={Heart}        iconBg={healthColor.replace(")", ",0.15)")} trend={healthVal >= 80 ? "flat" : "down"} trendLabel="Node health score" />
        <StatsCard title="AI Predictions" value={stats.alert_count || 0} icon={Cpu}  iconBg="rgba(99,102,241,0.2)"  trend="flat" trendLabel="Hotspots forecast" />
      </div>

      {/* Main grid */}
      <div className="dashboard-grid">
        {/* Left — map + timeline */}
        <div className="dashboard-col">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><MapPin size={15} /> Live Heatmap</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="noise-legend">
                  <button className={`legend-mode-btn ${heatmapMode === "noise" ? "active" : ""}`}
                    onClick={() => setHeatmapMode("noise")} style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                    Noise
                  </button>
                  <button className={`legend-mode-btn ${heatmapMode === "temperature" ? "active" : ""}`}
                    onClick={() => setHeatmapMode("temperature")} style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                    Temp
                  </button>
                  <button className={`legend-mode-btn ${heatmapMode === "humidity" ? "active" : ""}`}
                    onClick={() => setHeatmapMode("humidity")} style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                    Humidity
                  </button>
                  {heatmapMode === "noise" && <>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#22c55e" }} /> Safe</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#eab308" }} /> Moderate</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#f97316" }} /> Loud</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#ef4444" }} /> Danger</span>
                  </>}
                  {heatmapMode === "temperature" && <>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#3b82f6" }} /> &lt;15°C</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#22c55e" }} /> 15-25°C</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#f97316" }} /> 25-35°C</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#ef4444" }} /> &gt;35°C</span>
                  </>}
                  {heatmapMode === "humidity" && <>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#ef4444" }} /> Dry (&lt;40%)</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#22c55e" }} /> Comfort</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#3b82f6" }} /> Humid</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: "#8b5cf6" }} /> Saturated</span>
                  </>}
                </div>
                <button
                  className="card-badge"
                  style={{ cursor: "pointer", background: showSearch ? "var(--accent-glow)" : undefined }}
                  onClick={() => setShowSearch((s) => !s)}
                  title="Search location"
                >
                  <Search size={11} />
                </button>
                <button className="card-badge" style={{ cursor: "pointer" }} onClick={handleExport} title="Export CSV">
                  <Download size={11} />
                </button>
                <div className="card-badge" style={live ? { background: "rgba(34,197,94,0.15)", color: "var(--green)", borderColor: "rgba(34,197,94,0.3)" } : {}}>
                  {live ? "● LIVE" : "LIVE"}
                </div>
              </div>
            </div>

            {/* Search panel */}
            {showSearch && (
              <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Search city, area…"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchResults([]); }}
                    style={{ fontSize: "0.8rem" }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={searching} style={{ padding: "6px 12px" }}>
                    {searching ? "…" : <Search size={13} />}
                  </button>
                </form>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input className="form-input" placeholder="Lat" value={directLat} onChange={(e) => setDirectLat(e.target.value)} style={{ fontSize: "0.75rem", width: 90 }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>,</span>
                  <input className="form-input" placeholder="Lng" value={directLng} onChange={(e) => setDirectLng(e.target.value)} style={{ fontSize: "0.75rem", width: 90 }} />
                  <button className="btn btn-ghost" type="button" onClick={handleDirectCoord} style={{ padding: "6px 10px", fontSize: "0.75rem" }}>
                    <Navigation size={12} /> Go
                  </button>
                </div>
                {searchErr && <div style={{ fontSize: "0.75rem", color: "var(--red)", marginTop: 6 }}>{searchErr}</div>}
                {searchResults.length > 0 && (
                  <div className="admin-search-results" style={{ marginTop: 8 }}>
                    {searchResults.map((r) => (
                      <div key={r.place_id} className="admin-search-item" onClick={() => selectResult(r)}>
                        <MapPin size={12} style={{ flexShrink: 0, color: "var(--accent)" }} />
                        <div>
                          <div style={{ fontSize: "0.75rem" }}>{r.display_name.split(",")[0]}</div>
                          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                            {parseFloat(r.lat).toFixed(4)}, {parseFloat(r.lon).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search marker banner */}
            {searchMarker && !showSearch && (
              <div style={{ padding: "6px 18px", borderBottom: "1px solid var(--border)", background: "rgba(234,179,8,0.06)", fontSize: "0.75rem", color: "var(--yellow)", display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={12} />
                {searchMarker.label} · {searchMarker.lat.toFixed(4)}, {searchMarker.lng.toFixed(4)}
                <button onClick={() => { setSearchMarker(null); setFlyTo(null); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="map-wrapper">
              <HeatMap points={heatmapPoints} searchMarker={searchMarker} flyTo={flyTo} mode={heatmapMode} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title"><Clock size={15} /> Timeline Playback</div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Drag to replay historical data</span>
            </div>
            <div className="card-body">
              <TimelinePlayer value={hour} setValue={setHour} />
            </div>
          </div>
        </div>

        {/* Right — alerts + nodes */}
        <div className="dashboard-col">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><AlertTriangle size={15} /> Active Alerts</div>
              <span className="card-badge">{alerts.length}</span>
            </div>
            <div className="card-body">
              <AlertPanel alerts={alerts} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title"><Wifi size={15} /> Node Status</div>
              <span className="card-badge">{nodes.length} nodes</span>
            </div>
            <div className="card-body">
              <div className="node-list">
                {nodes.map((n) => (
                  <NodeStatus key={n.id} node={n} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
