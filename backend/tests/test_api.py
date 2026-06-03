import sys, os, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi.testclient import TestClient
from backend.app.main import app

# Import database the same way main.py does (avoid duplicate module instances)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import database

client = TestClient(app)


def setup_module():
    database.init_db()


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert "message" in data
    assert data["version"] == "1.0.0"


def test_get_nodes():
    r = client.get("/nodes")
    assert r.status_code == 200
    nodes = r.json()
    assert isinstance(nodes, list)
    assert len(nodes) >= 6
    ids = [n["id"] for n in nodes]
    assert "HTC-01" in ids


def test_get_node_detail():
    r = client.get("/nodes/HTC-01")
    assert r.status_code == 200
    node = r.json()
    assert node["label"] == "Hitech City"


def test_create_node():
    r = client.post("/nodes", json={"id": "TST-99", "label": "Test Zone", "lat": 17.0, "lng": 78.0})
    assert r.status_code == 201
    data = r.json()
    assert data["id"] == "TST-99"
    assert data["status"] == "offline"
    database.delete_node("TST-99")


def test_create_duplicate_node():
    r = client.post("/nodes", json={"id": "HTC-01", "label": "Dup", "lat": 17.0, "lng": 78.0})
    assert r.status_code == 409


def test_update_node():
    r = client.put("/nodes/HTC-01", json={"label": "Hitech City Updated"})
    assert r.status_code == 200
    data = r.json()
    assert data["label"] == "Hitech City Updated"
    client.put("/nodes/HTC-01", json={"label": "Hitech City"})


def test_delete_node():
    database.create_node("DEL-01", "To Delete", 17.0, 78.0)
    r = client.delete("/nodes/DEL-01")
    assert r.status_code == 200
    r = client.get("/nodes/DEL-01")
    assert r.status_code == 404


def test_heartbeat():
    r = client.post("/nodes/HTC-01/heartbeat", json={"noise": 72, "battery": 89, "firmware": "v2.3.1"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    node = database.get_node("HTC-01")
    assert node["status"] == "online"
    assert node["noise"] == 72
    assert node["battery"] == 89
    database.get_node("HTC-01")


def test_heartbeat_not_found():
    r = client.post("/nodes/NONEXIST/heartbeat", json={"noise": 50, "battery": 50})
    assert r.status_code == 404


def test_heatmap():
    r = client.get("/heatmap")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_heatmap_interpolated():
    r = client.get("/heatmap/interpolated?resolution=20")
    assert r.status_code == 200
    data = r.json()
    assert "points" in data


def test_alerts():
    r = client.get("/alerts")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 4


def test_dismiss_alert():
    new = database.create_alert("info", "Dismiss me", "test", "TST")
    r = client.delete(f"/alerts/{new['id']}")
    assert r.status_code == 200
    r = client.get("/alerts")
    ids = [a["id"] for a in r.json()]
    assert new["id"] not in ids


def test_analytics():
    r = client.get("/analytics")
    assert r.status_code == 200
    data = r.json()
    assert "average" in data
    assert "max" in data
    assert "hourly" in data


def test_predictions():
    r = client.get("/predictions")
    assert r.status_code == 200
    data = r.json()
    assert "hotspots" in data
    assert "forecast_points" in data


def test_health_scores():
    r = client.get("/health-scores")
    assert r.status_code == 200
    data = r.json()
    assert "overall" in data


def test_node_health():
    r = client.get("/health-scores/HTC-01")
    assert r.status_code == 200
    data = r.json()
    assert data["node_id"] == "HTC-01"


def test_noise_source():
    r = client.get("/noise-source")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for item in data:
        assert "source" in item
        assert "confidence" in item


def test_noise_source_single():
    r = client.get("/noise-source/HTC-01")
    assert r.status_code == 200
    data = r.json()
    assert "source" in data


def test_noise_source_not_found():
    r = client.get("/noise-source/NONEXIST")
    assert r.status_code == 404


def test_anomaly():
    r = client.get("/anomaly/HTC-01")
    assert r.status_code == 200
    data = r.json()
    assert "severity" in data


def test_all_anomalies():
    r = client.get("/anomaly")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_forecast():
    r = client.get("/forecast/HTC-01?steps=6")
    assert r.status_code == 200
    data = r.json()
    assert "forecast" in data
    assert len(data["forecast"]) == 6


def test_forecast_not_found():
    r = client.get("/forecast/NONEXIST")
    assert r.status_code == 404


def test_risk_zones():
    r = client.get("/risk-zones")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_noise_radiation():
    r = client.get("/noise-radiation")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_geofence_check():
    r = client.post("/geofence/check", json={"lat": 17.385, "lng": 78.486})
    assert r.status_code == 200
    data = r.json()
    assert "inside_zones" in data or "in_zone" in data


def test_geofence_zones():
    r = client.get("/geofence/zones")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_training_status():
    r = client.get("/training/status")
    assert r.status_code == 200
    data = r.json()
    assert "model" in data


def test_export_report():
    r = client.get("/export/report")
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data
    assert "system" in data


def test_export_csv():
    r = client.get("/export/report.csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert r.headers["content-disposition"] == 'attachment; filename=naadnet_report.csv'


def test_mqtt_status():
    r = client.get("/mqtt/status")
    assert r.status_code == 200
    data = r.json()
    assert "broker" in data


def test_history_stats():
    r = client.get("/history/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total_readings" in data


def test_users():
    r = client.get("/users")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_create_user():
    r = client.post("/users", json={"name": "Test User", "email": "test@test.com", "role": "viewer"})
    assert r.status_code == 201
    data = r.json()
    assert data["email"] == "test@test.com"
    database.delete_user(data["id"])


def test_create_duplicate_user():
    r = client.post("/users", json={"name": "Dup", "email": "admin@naadnet.io", "role": "viewer"})
    assert r.status_code == 409


def test_logs():
    r = client.get("/logs")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_auth_login():
    r = client.post("/auth/login", json={"email": "admin@naadnet.io", "password": "admin123"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert "user" in data
    assert data["user"]["role"] == "superadmin"


def test_auth_login_wrong():
    r = client.post("/auth/login", json={"email": "admin@naadnet.io", "password": "wrong"})
    assert r.status_code == 401


def test_auth_register_and_me():
    ts = str(int(time.time()))
    email = f"temp{ts}@temp.com"
    r = client.post("/auth/register", json={"name": "Temp", "email": email, "password": "temp123"})
    assert r.status_code == 200
    data = r.json()
    token = data["token"]
    r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["email"] == email
    database.delete_user_by_email(email)


def test_auth_me_unauthorized():
    r = client.get("/auth/me", headers={"Authorization": "Bearer badtoken"})
    assert r.status_code == 401


def test_auth_register_duplicate():
    r = client.post("/auth/register", json={"name": "Dup", "email": "admin@naadnet.io", "password": "x"})
    assert r.status_code == 409


def test_history_range():
    r = client.get("/history/range?start=2026-01-01&end=2027-01-01")
    assert r.status_code == 200
    data = r.json()
    assert "readings" in data


def test_history_range_missing():
    r = client.get("/history/range")
    assert r.status_code == 400
