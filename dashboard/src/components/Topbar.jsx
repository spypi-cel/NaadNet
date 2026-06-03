import { useState, useEffect } from "react";
import { Bell, LogOut, LogIn, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context";
import { getAlerts } from "../services/api";

export default function Topbar({ title = "Dashboard", subtitle }) {
  const [time, setTime] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const { alertCount, live, user, logout, setAlertCount } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getAlerts()
      .then((r) => {
        setAlerts(r.data);
        if (setAlertCount) setAlertCount(r.data.length);
      })
      .catch(() => {});
  }, []);

  const fmt = time.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const dateFmt = time.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "NN";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
      </div>

      <div className="topbar-right">
        {live && <div className="topbar-badge live-badge">● LIVE</div>}
        <div className="topbar-badge alert-bell" onClick={() => setShowAlerts((s) => !s)} style={{ cursor: "pointer", position: "relative" }}>
          <Bell size={12} />
          {alertCount} {alertCount === 1 ? "Alert" : "Alerts"}
          {showAlerts && (
            <div className="alert-dropdown" onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                width: 320, maxHeight: 360, overflowY: "auto",
                background: "var(--card-bg)", border: "1px solid var(--border)",
                borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                zIndex: 1000, padding: 8,
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px 8px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>Recent Alerts</span>
                <button onClick={() => setShowAlerts(false)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  <X size={12} />
                </button>
              </div>
              {alerts.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  No active alerts
                </div>
              ) : (
                alerts.slice(0, 10).map((a) => (
                  <div key={a.id} style={{
                    padding: "6px 8px", fontSize: "0.75rem", borderRadius: 4, marginBottom: 2,
                    borderLeft: `3px solid ${a.severity === "critical" ? "var(--red)" : a.severity === "warning" ? "var(--yellow)" : "var(--blue)"}`,
                  }}>
                    <div style={{ fontWeight: 500 }}>{a.message}</div>
                    {a.node_id && <div style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>{a.node_id}</div>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="topbar-time">
          {dateFmt} &nbsp;·&nbsp; {fmt}
        </div>
        {user ? (
          <div className="topbar-avatar-wrap">
            <div className="topbar-avatar" onClick={() => { setShowMenu((s) => !s); setShowAlerts(false); }}>{initials}</div>
            {showMenu && (
              <div className="topbar-dropdown">
                <div className="topbar-dropdown-user">
                  <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>{user?.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{user?.email}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--accent)", marginTop: 2, textTransform: "capitalize" }}>{user?.role}</div>
                </div>
                <hr style={{ borderColor: "var(--border)", margin: "4px 0" }} />
                <button className="topbar-dropdown-item" onClick={() => { logout(); setShowMenu(false); }}>
                  <LogOut size={13} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="topbar-login-btn" onClick={() => navigate("/login")}>
            <LogIn size={13} /> Admin Login
          </button>
        )}
      </div>
    </header>
  );
}