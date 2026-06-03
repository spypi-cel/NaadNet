import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, authLoading } = useApp();
  const location = useLocation();

  // While checking stored token, show nothing (avoids flash redirect)
  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg-base)", color: "var(--text-muted)",
        fontSize: "0.875rem"
      }}>
        Loading…
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but not admin → redirect to dashboard
  if (requireAdmin && user.role !== "superadmin" && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
