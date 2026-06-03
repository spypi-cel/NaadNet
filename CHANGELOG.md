# Changelog

## v1.0.0 (2026-06-01)

### Added
- Real-time noise monitoring dashboard with IDW heatmap (noise/temperature/humidity)
- Live WebSocket data streaming with per-second updates
- AI/ML inference: anomaly detection (IsolationForest), noise forecasting (LinearRegression), noise source classification (spectral centroid)
- Predictive maintenance: battery drain tracking, degradation scoring, offline risk (low/medium/high)
- Online/incremental learning pipeline — models retrain on every heartbeat
- Geofencing with haversine radius, risk zone analysis, noise radiation visualization
- Auth system (register/login/token) with superadmin/admin roles
- Admin panel with user/node/alert management
- SMTP email alerts with 5-min throttle per node+severity
- REST API (45+ endpoints) with history date-range filtering
- ESP32 firmware — DHT11 + MAX9814, Wi-Fi, HTTP heartbeat, OTA update stubs
- Docker Compose (backend + dashboard + Mosquitto MQTT)
- 44 pytest API tests covering all endpoints
