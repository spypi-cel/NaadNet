import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, ReferenceLine, Cell, PieChart, Pie
} from "recharts";
import { BarChart2, TrendingUp, Activity, Ear, Calendar, RefreshCw } from "lucide-react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import { getAnalytics, getNoiseSources, getHistoryRange } from "../services/api";

const FALLBACK_HOURLY = [
  { hour: "00", noise: 42, threshold: 70 },
  { hour: "02", noise: 38, threshold: 70 },
  { hour: "04", noise: 35, threshold: 70 },
  { hour: "06", noise: 55, threshold: 70 },
  { hour: "08", noise: 74, threshold: 70 },
  { hour: "10", noise: 80, threshold: 70 },
  { hour: "12", noise: 83, threshold: 70 },
  { hour: "14", noise: 79, threshold: 70 },
  { hour: "16", noise: 85, threshold: 70 },
  { hour: "18", noise: 88, threshold: 70 },
  { hour: "20", noise: 76, threshold: 70 },
  { hour: "22", noise: 60, threshold: 70 },
];

const FALLBACK_ZONES = [
  { zone: "Hitech City",   avg: 82, peak: 91 },
  { zone: "Secunderabad",  avg: 78, peak: 95 },
  { zone: "Banjara Hills", avg: 71, peak: 84 },
  { zone: "Kukatpally",    avg: 65, peak: 78 },
  { zone: "LB Nagar",      avg: 58, peak: 70 },
  { zone: "Balanagar",     avg: 62, peak: 75 },
];

const tooltipStyle = {
  contentStyle: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    fontSize: "12px",
  },
  labelStyle: { color: "var(--text-dim)" },
};

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function Analytics() {
  const [hourlyData, setHourlyData] = useState(FALLBACK_HOURLY);
  const [zoneData, setZoneData] = useState(FALLBACK_ZONES);
  const [noiseSourceData, setNoiseSourceData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [stats, setStats] = useState({ average: 69, max: 95, peak_hour: 17, violations: 14, quiet_hours: 6 });
  const [loading, setLoading] = useState(true);
  const [histStart, setHistStart] = useState(weekAgoStr());
  const [histEnd, setHistEnd] = useState(todayStr());
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      getAnalytics(),
      getNoiseSources(),
    ])
      .then(([analyticsRes, noiseSrcRes]) => {
        const d = analyticsRes.data;
        setStats({
          average: d.average,
          max: d.peak_db || d.max,
          peak_hour: d.peak_hour || 17,
          violations: d.violations,
          quiet_hours: d.quiet_hours,
        });
        if (d.hourly) {
          setHourlyData(d.hourly.map((h) => ({ ...h, threshold: 70 })));
        }
        if (d.zones) {
          setZoneData(d.zones);
        }
        if (noiseSrcRes) {
          const counts = {};
          noiseSrcRes.data.forEach((s) => {
            counts[s.source] = (counts[s.source] || 0) + 1;
          });
          setNoiseSourceData(
            Object.entries(counts).map(([name, value]) => ({ name, value }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, []);

  function loadHistory() {
    setHistLoading(true);
    getHistoryRange(histStart, histEnd)
      .then((res) => {
        if (!res.data?.readings) return;
        const grouped = {};
        res.data.readings.forEach((r) => {
          const key = r.label || r.node_id;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(r.noise);
        });
        const lines = Object.entries(grouped).map(([label, vals]) => ({
          label,
          avg: (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1),
          max: Math.max(...vals),
          min: Math.min(...vals),
          readings: vals.length,
        }));
        setHistoryData(lines);
      })
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }

  return (
    <Layout title="Analytics" subtitle="Noise trend analysis across all zones">
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatsCard title="Peak Today"    value={stats.max}  unit=" dB" icon={TrendingUp} trend="up"   trendLabel={`Hour ${stats.peak_hour}:00`} />
        <StatsCard title="Daily Average" value={stats.average}  unit=" dB" icon={Activity}   trend="up"   trendLabel="+3 dB vs yesterday" />
        <StatsCard title="Quiet Hours"   value={stats.quiet_hours}   unit=" hrs" icon={BarChart2}  trend="down" trendLabel="Below 55 dB" />
        <StatsCard title="Violations"    value={stats.violations}  icon={TrendingUp}             trend="up"   trendLabel="Exceeded 70 dB threshold" />
      </div>

      <div className="analytics-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={15} />
              Hourly Noise Trend
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Today · All zones avg</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={(v) => `${v}:00`} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[30, 100]} unit=" dB" />
                  <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} dB`, n === "noise" ? "Avg Noise" : "Threshold"]} labelFormatter={(l) => `${l}:00`} />
                  <ReferenceLine y={70} stroke="var(--orange)" strokeDasharray="4 4" label={{ value: "Limit", fill: "var(--orange)", fontSize: 10 }} />
                  <Line type="monotone" dataKey="noise" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)" }} activeDot={{ r: 5 }} name="noise" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <BarChart2 size={15} />
              Zone Comparison
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Avg vs Peak dB</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="zone" tick={{ fill: "var(--text-muted)", fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 100]} unit=" dB" />
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v} dB`]} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text-dim)", paddingTop: "8px" }} />
                  <Bar dataKey="avg"  name="Average" fill="var(--accent)"  radius={[4,4,0,0]} />
                  <Bar dataKey="peak" name="Peak"    fill="var(--orange)"  radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Ear size={15} />
              Noise Source Distribution
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>AI-classified sources per node</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={noiseSourceData.length ? noiseSourceData : [{ name: "No Data", value: 1 }]}
                    cx="50%" cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {noiseSourceData.map((entry, idx) => {
                      const COLORS = { "Traffic":"#f97316","Construction":"#eab308","Industrial":"#ef4444","People / Crowd":"#22c55e","Nature / Wind":"#3b82f6","Mixed":"#a855f7" };
                      return <Cell key={idx} fill={COLORS[entry.name] || "#888"} />;
                    })}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-title">
            <Calendar size={15} />
            Historical Noise Data
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="date"
              value={histStart}
              onChange={(e) => setHistStart(e.target.value)}
              style={{ fontSize: "0.75rem", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
            />
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>to</span>
            <input
              type="date"
              value={histEnd}
              onChange={(e) => setHistEnd(e.target.value)}
              style={{ fontSize: "0.75rem", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
            />
            <button className="btn btn-primary" onClick={loadHistory} disabled={histLoading} style={{ padding: "4px 12px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
              <RefreshCw size={12} />
              {histLoading ? "…" : "Load"}
            </button>
          </div>
        </div>
        <div className="card-body">
          {historyData.length > 0 ? (
            <div className="chart-container" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 100]} unit=" dB" />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text-dim)", paddingTop: "8px" }} />
                  <Bar dataKey="avg" name="Avg dB" fill="var(--accent)" radius={[4,4,0,0]} />
                  <Bar dataKey="max" name="Max dB" fill="var(--orange)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No history data for selected range. Start the server and wait for readings to accumulate.
            </div>
          )}
          {historyData.length > 0 && (
            <div style={{ marginTop: 12, fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
              {historyData.map((h) => (
                <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{h.label}</span>
                  <span>avg {h.avg} dB</span>
                  <span style={{ color: "var(--orange)" }}>max {h.max} dB</span>
                  <span style={{ color: "var(--text-dim)" }}>({h.readings} readings)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
