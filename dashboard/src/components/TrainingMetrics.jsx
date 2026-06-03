import { useState, useEffect } from "react";
import { Cpu, TrendingUp, Clock, Database } from "lucide-react";
import { getTrainingMetrics, getTrainingHistory } from "../services/api";

export default function TrainingMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getTrainingMetrics().then((r) => r && setMetrics(r.data)).catch(() => {});
    getTrainingHistory().then((r) => r && setHistory(r.data?.events || [])).catch(() => {});
  }, []);

  const m = metrics || {};
  const lastTrained = m.last_trained ? new Date(m.last_trained).toLocaleString() : "N/A";
  const isTrained = m.anomaly_model_loaded;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><Cpu size={15} /> AI Model Training</div>
        <span className="card-badge" style={{ background: isTrained ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: isTrained ? "var(--green)" : "var(--red)" }}>
          {isTrained ? "● Active" : "○ Idle"}
        </span>
      </div>
      <div className="card-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 2 }}>Anomaly Samples</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>{m.anomaly_samples?.toLocaleString() || 0}</div>
          </div>
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 2 }}>Forecast Samples</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--green)" }}>{m.forecast_samples?.toLocaleString() || 0}</div>
          </div>
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 2 }}>Online Anomaly</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: m.anomaly_model_loaded ? "var(--green)" : "var(--text-dim)" }}>
              {m.anomaly_model_loaded ? "Loaded" : "Waiting…"}
            </div>
          </div>
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 2 }}>Online Forecast</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: m.forecast_model_loaded ? "var(--green)" : "var(--text-dim)" }}>
              {m.forecast_model_loaded ? "Loaded" : "Waiting…"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem", color: "var(--text-muted)", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
          <Clock size={11} />
          Last trained: {lastTrained}
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
              Recent Training Events ({history.length})
            </div>
            <div style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {history.slice(-8).reverse().map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-dim)", padding: "2px 4px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)" }}>
                  <span>{e.event}</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {e.samples && `${e.samples} samples`}
                    {e.mae && ` · MAE: ${e.mae}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}