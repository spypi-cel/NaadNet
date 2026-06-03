import axios from "axios";

const API = axios.create({
  baseURL: "/api",
  timeout: 8000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("naadnet_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ───────────────────────────────────────────────────
export const login    = (email, password)      => API.post("/auth/login", { email, password });
export const register = (name, email, password) => API.post("/auth/register", { name, email, password });
export const getMe    = ()                      => API.get("/auth/me");

// ── Nodes ──────────────────────────────────────────────────
export const getNodes   = ()         => API.get("/nodes");
export const createNode = (data)     => API.post("/nodes", data);
export const updateNode = (id, data) => API.put(`/nodes/${id}`, data);
export const deleteNode = (id)       => API.delete(`/nodes/${id}`);

// ── Heatmap ────────────────────────────────────────────────
export const getHeatmap             = (type = "noise") => API.get(`/heatmap?type=${type}`);
export const getInterpolatedHeatmap = (res) => API.get(`/heatmap/interpolated?resolution=${res || 30}`);

// ── Alerts ─────────────────────────────────────────────────
export const getAlerts    = ()   => API.get("/alerts");
export const dismissAlert = (id) => API.delete(`/alerts/${id}`);

// ── Analytics ─────────────────────────────────────────────
export const getAnalytics = () => API.get("/analytics");

// ── Predictions ───────────────────────────────────────────
export const getPredictions = () => API.get("/predictions");

// ── Health Scores ─────────────────────────────────────────
export const getHealthScores = ()   => API.get("/health-scores");
export const getNodeHealth   = (id) => API.get(`/health-scores/${id}`);

// ── Noise Source ──────────────────────────────────────────
export const getNoiseSources    = ()   => API.get("/noise-source");
export const getNodeNoiseSource = (id) => API.get(`/noise-source/${id}`);

// ── Risk Zones ────────────────────────────────────────────
export const getRiskZones      = () => API.get("/risk-zones");
export const getNoiseRadiation = () => API.get("/noise-radiation");

// ── Geofence ──────────────────────────────────────────────
export const checkGeofence    = (lat, lng) => API.post("/geofence/check", { lat, lng });
export const getGeofenceZones = ()         => API.get("/geofence/zones");

// ── Anomaly ───────────────────────────────────────────────
export const getAnomalies   = ()   => API.get("/anomaly");
export const getNodeAnomaly = (id) => API.get(`/anomaly/${id}`);

// ── Forecast ──────────────────────────────────────────────
export const getNodeForecast = (id, steps) => API.get(`/forecast/${id}?steps=${steps || 8}`);

// ── Reports ───────────────────────────────────────────────
export const exportReport = () => API.get("/export/report");

// ── Users ─────────────────────────────────────────────────
export const getUsers    = ()     => API.get("/users");
export const createUser  = (data) => API.post("/users", data);
export const updateUser  = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser  = (id)   => API.delete(`/users/${id}`);

// ── Logs ──────────────────────────────────────────────────
export const getLogs = () => API.get("/logs");

// ── History ───────────────────────────────────────────────
export const getHistoryRange = (start, end) =>
  API.get(`/history/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);

// ── Training / Pipeline (map to existing endpoints) ───────
export const getTrainingMetrics       = () => API.get("/training/status");
export const getTrainingHistory       = () => API.get("/training/history");
export const getPipelineStats         = () => API.get("/pipeline/stats");
export const getPredictiveMaintenance = () => API.get("/predictive/maintenance");

export default API;
