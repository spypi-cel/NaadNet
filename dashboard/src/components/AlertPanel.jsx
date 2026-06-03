import { AlertTriangle, Info, Zap, X } from "lucide-react";
import { dismissAlert } from "../services/api";

const SEVERITY_META = {
  critical: { icon: Zap,           cls: "critical" },
  warning:  { icon: AlertTriangle, cls: "warning"  },
  info:     { icon: Info,          cls: "info"      },
};

export default function AlertPanel({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
        No active alerts
      </div>
    );
  }

  async function handleDismiss(id) {
    try {
      await dismissAlert(id);
      if (onDismiss) onDismiss(id);
    } catch {}
  }

  return (
    <div className="alerts-list">
      {alerts.map((a) => {
        const sev = a.severity || "warning";
        const { icon: Icon, cls } = SEVERITY_META[sev] || SEVERITY_META.warning;
        return (
          <div key={a.id || a.node_id} className={`alert-item ${cls}`}>
            <div className={`alert-icon ${cls}`}>
              <Icon size={14} />
            </div>
            <div className="alert-content">
              <div className="alert-message">{a.message}</div>
              {a.meta && <div className="alert-meta">{a.meta}</div>}
            </div>
            <button
              onClick={() => handleDismiss(a.id)}
              title="Dismiss alert"
              style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", padding: "4px", borderRadius: 4, flexShrink: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}