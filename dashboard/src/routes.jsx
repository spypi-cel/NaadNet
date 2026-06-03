import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Predictions from "./pages/Predictions.jsx";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";

export default function RoutesConfig() {
  return (
    <Routes>
      <Route path="/login"       element={<Login />} />
      <Route path="/register"    element={<Register />} />
      <Route path="/"            element={<Dashboard />} />
      <Route path="/analytics"   element={<Analytics />} />
      <Route path="/predictions" element={<Predictions />} />
      <Route path="/settings"    element={<Settings />} />
      <Route path="/admin"       element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
    </Routes>
  );
}
