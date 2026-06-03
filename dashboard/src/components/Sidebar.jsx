import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart2,
  Map,
  Settings,
  Radio,
  Wifi,
  ShieldCheck
} from "lucide-react";
import { useApp } from "../context";

const navItems = [
  { to: "/",            label: "Dashboard",   icon: LayoutDashboard },
  { to: "/analytics",  label: "Analytics",   icon: BarChart2 },
  { to: "/predictions",label: "Predictions", icon: Map },
];

export default function Sidebar() {
  const { nodeCount, user } = useApp();
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  return (
    <aside className="sidebar">
      <NavLink to="/" end style={{ textDecoration: "none", color: "inherit" }}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Radio size={18} color="white" />
          </div>
          <div>
            <h1>NaadNet</h1>
            <span>Noise Monitor</span>
          </div>
        </div>
      </NavLink>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {isAdmin && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">Administration</div>
          <nav className="sidebar-nav">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              <ShieldCheck size={16} />
              Admin Panel
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              <Settings size={16} />
              Settings
            </NavLink>
          </nav>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <div className="status-dot" />
          <Wifi size={13} />
          <span>{nodeCount} nodes online</span>
        </div>
      </div>
    </aside>
  );
}
