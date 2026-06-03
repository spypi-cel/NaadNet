import { useState, useEffect } from "react";
import { Database, Activity, BarChart3, Clock } from "lucide-react";
import { getPipelineStats } from "../services/api";

export default function PipelineStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getPipelineStats().then((r) => r && setStats(r.data)).catch(() => {});
    const iv = setInterval(() => {
      getPipelineStats().then((r) => r && setStats(r.data)).catch(() => {});
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  const s = stats || {};

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><Database size={15} /> Data Pipeline</div>
        <span className="card-badge" style={{ background: "rgba(99,102,241,0.12)", color: "var(--accent)" }}>
          {s.readings_last_hour || 0}/hr
        </span>
      </div>
      <div className="card-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
            <Activity size={12} style={{ color: "var(--accent)", marginBottom: 2 }} />
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Total Readings</div>
            <div style={{ fontSize: "1rem", fontWeight: 700 }}>{(s.total_readings || 0).toLocaleString()}</div>
          </div>
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
            <BarChart3 size={12} style={{ color: "var(--green)", marginBottom: 2 }} />
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Nodes Tracked</div>
            <div style={{ fontSize: "1rem", fontWeight: 700 }}>{s.nodes_tracked || 0}</div>
          </div>
        </div>
        {s.started_at && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 8, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
            <Clock size={10} />
            Collecting since {new Date(s.started_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}