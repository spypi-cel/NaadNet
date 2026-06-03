import asyncio
import json
import random
import secrets
from datetime import datetime
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database
import ai_service
import gis_service
import notifications

STALE_TIMEOUT_S = 120


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    ai_service.load_trained_models()
    ai_service.load_persisted_history()
    retrain_task = asyncio.create_task(auto_retrain_loop())
    persist_task = asyncio.create_task(auto_persist_loop())
    stale_task = asyncio.create_task(stale_checker_loop())
    yield
    retrain_task.cancel()
    persist_task.cancel()
    stale_task.cancel()


app = FastAPI(title="NaadNet API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Background tasks ─────────────────────────────────────────
async def auto_retrain_loop():
    while True:
        await asyncio.sleep(3600)
        try:
            proc = await asyncio.create_subprocess_exec(
                "python", "backend/training/train_models.py",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if stdout:
                print(f"[Retrain] {stdout.decode()}")
            ai_service.load_trained_models()
        except Exception as e:
            print(f"[Retrain] Failed: {e}")


async def auto_persist_loop():
    while True:
        await asyncio.sleep(30)
        try:
            ai_service.save_persisted_history()
        except Exception as e:
            print(f"[Persist] Failed: {e}")


async def stale_checker_loop():
    # Stale checker is disabled in demo/simulation mode.
    # It only activates when real ESP32 hardware is connected and sending heartbeats.
    # In simulation mode the WebSocket loop keeps nodes alive with synthetic data.
    while True:
        await asyncio.sleep(3600)  # sleep forever effectively


# ── Pydantic models ───────────────────────────────────────────
class NodeCreate(BaseModel):
    id: str
    label: str
    lat: float
    lng: float

class NodeUpdate(BaseModel):
    label: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: Optional[str] = None
    firmware: Optional[str] = None
    battery: Optional[int] = None
    threshold: Optional[int] = None

class UserCreate(BaseModel):
    name: str
    email: str
    role: str = "viewer"
    status: str = "active"

class GeoFenceQuery(BaseModel):
    lat: float
    lng: float

class HeartbeatData(BaseModel):
    noise: float = 0
    battery: int = 0
    firmware: str = "v2.3.1"
    temperature: Optional[float] = None
    humidity: Optional[float] = None

class AuthLogin(BaseModel):
    email: str
    password: str

class AuthRegister(BaseModel):
    name: str
    email: str
    password: str


# ── Auth helpers ───────────────────────────────────────────────
def _get_user_from_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    user_id = database.get_user_id_by_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = database.get_auth_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"], "status": user["status"]}


# ── Root ──────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "NaadNet API Running", "version": "1.0.0", "docs": "/docs"}


# ── Nodes ─────────────────────────────────────────────────────
@app.get("/nodes")
def get_nodes():
    return database.get_nodes()


@app.get("/nodes/{node_id}")
def get_node(node_id: str):
    node = database.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@app.post("/nodes", status_code=201)
def create_node(node: NodeCreate):
    existing = database.get_node(node.id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Node {node.id} already exists")
    new = database.create_node(node.id, node.label, node.lat, node.lng)
    database.create_log("info", "system", f"Node {node.id} created at {node.lat},{node.lng}", node.id)
    return new


@app.put("/nodes/{node_id}")
def update_node(node_id: str, update: NodeUpdate):
    existing = database.get_node(node_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Node not found")
    data = update.model_dump(exclude_none=True)
    updated = database.update_node(node_id, **data)
    database.create_log("info", "system", f"Node {node_id} updated", node_id)
    return updated


@app.delete("/nodes/{node_id}")
def delete_node(node_id: str):
    existing = database.get_node(node_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Node not found")
    database.delete_node(node_id)
    database.create_log("warning", "system", f"Node {node_id} removed", node_id)
    return {"deleted": node_id}


# ── Heartbeat (real hardware status) ──────────────────────────
@app.post("/nodes/{node_id}/heartbeat")
def node_heartbeat(node_id: str, data: HeartbeatData):
    existing = database.get_node(node_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Node not found")
    now = datetime.now().isoformat()
    kwargs = {
        "status": "online",
        "last_seen": now,
        "noise": data.noise,
        "battery": data.battery,
        "firmware": data.firmware,
    }
    if data.temperature is not None:
        kwargs["temperature"] = data.temperature
    if data.humidity is not None:
        kwargs["humidity"] = data.humidity
    database.update_node(node_id, **kwargs)
    database.save_node_history(node_id, data.noise, data.temperature, data.humidity)
    ai_service.feed_heartbeat(node_id, data.noise, data.battery, database.get_nodes())
    if data.noise > existing.get("threshold", 70):
        notifications.notify_alert("warning", f"Node {node_id} noise {data.noise}dB exceeds threshold", node_id, data.noise, existing.get("threshold", 70))
    print(f"[Heartbeat] {node_id} - noise={data.noise}dB, batt={data.battery}%, fw={data.firmware}")
    return {"status": "ok", "node_id": node_id, "last_seen": now}


# ── Heatmap ───────────────────────────────────────────────────
@app.get("/heatmap")
def get_heatmap(type: str = "noise"):
    nodes = database.get_nodes()
    result = []
    for n in nodes:
        if n["status"] == "offline":
            continue
        val = n["noise"]
        unit = "dB"
        if type == "temperature":
            val = n.get("temperature") or n.get("noise", 50) * 0.35 + 18
            unit = "°C"
        elif type == "humidity":
            val = n.get("humidity") or 100 - n.get("noise", 50) * 0.5
            unit = "%"
        result.append({"lat": n["lat"], "lng": n["lng"], "db": round(val, 1), "label": n["label"], "unit": unit})
    return result


@app.get("/heatmap/interpolated")
def get_interpolated_heatmap(resolution: int = 30):
    nodes = database.get_nodes()
    points = gis_service.interpolate_heatmap(nodes, resolution=resolution)
    return {"points": points, "count": len(points)}


# ── Alerts ────────────────────────────────────────────────────
@app.get("/alerts")
def get_alerts():
    return database.get_alerts()


@app.delete("/alerts/{alert_id}")
def dismiss_alert(alert_id: int):
    database.delete_alert(alert_id)
    return {"dismissed": alert_id}


# ── Analytics ─────────────────────────────────────────────────
@app.get("/analytics")
def get_analytics():
    nodes = database.get_nodes()
    alerts = database.get_alerts()

    active = [n["noise"] for n in nodes if n["status"] != "offline" and n["noise"] > 0]
    avg = round(sum(active) / len(active), 1) if active else 0
    mx = max(active) if active else 0
    mn = min(active) if active else 0
    peak_db, peak_hour = ai_service.compute_peak_hours(nodes)
    scores = ai_service.compute_scores(nodes)
    hourly = ai_service.generate_hourly_pattern(avg)

    online = [n for n in nodes if n["status"] != "offline"]
    zones = [
        {"zone": n["label"], "avg": n["noise"], "peak": min(n["noise"] + random.randint(3, 10), 100)}
        for n in online
    ]
    violations = sum(1 for n in online if n["noise"] > n.get("threshold", 70))
    quiet_hours = sum(1 for h in hourly if h["noise"] < 55)

    return {
        "average": avg, "max": mx, "min": mn,
        "node_count": len(nodes), "online_count": len(online),
        "alert_count": len(alerts), "peak_hour": peak_hour,
        "peak_db": peak_db, "violations": violations,
        "quiet_hours": quiet_hours, "health_scores": scores,
        "hourly": hourly, "zones": zones,
    }


# ── Predictions ───────────────────────────────────────────────
@app.get("/predictions")
def get_predictions():
    nodes = database.get_nodes()
    hotspots = ai_service.detect_hotspots(nodes)
    forecast_points = ai_service.get_forecast_points(nodes)

    next_10 = hotspots[0]["predicted_db"] if hotspots else 70
    next_1h = hotspots[0]["predicted_db"] if hotspots else 70
    next_24h = sum(h["predicted_db"] for h in hotspots) / len(hotspots) if hotspots else 70

    return {
        "next_10_min": round(next_10, 1),
        "next_1_hour": round(next_1h, 1),
        "next_24_hour": round(next_24h, 1),
        "hotspots": hotspots,
        "forecast_points": forecast_points,
    }


# ── Health Scores ─────────────────────────────────────────────
@app.get("/health-scores")
def get_health_scores():
    nodes = database.get_nodes()
    return ai_service.compute_scores(nodes)


@app.get("/health-scores/{node_id}")
def get_node_health(node_id: str):
    nodes = database.get_nodes()
    for n in nodes:
        if n["id"] == node_id:
            score = ai_service.compute_health_score(n)
            anomaly = ai_service.detect_anomaly(node_id, n["noise"], nodes)
            return {"node_id": node_id, "health_score": score, "anomaly": anomaly}
    raise HTTPException(status_code=404, detail="Node not found")


# ── Risk Zones ────────────────────────────────────────────────
@app.get("/risk-zones")
def get_risk_zones():
    nodes = database.get_nodes()
    return gis_service.analyze_risk_zones(nodes)


# ── Noise Radiation ───────────────────────────────────────────
@app.get("/noise-radiation")
def get_noise_radiation():
    nodes = database.get_nodes()
    return [gis_service.compute_noise_radiation(n) for n in nodes if n["status"] != "offline"]


# ── Geofence ──────────────────────────────────────────────────
@app.post("/geofence/check")
def check_geofence(query: GeoFenceQuery):
    return gis_service.check_geofence(query.lat, query.lng, gis_service.GEOFENCE_ZONES)


@app.get("/geofence/zones")
def get_geofence_zones():
    return [
        {"name": z["name"], "type": z["type"], "boundary": z["boundary"]}
        for z in gis_service.GEOFENCE_ZONES
    ]


# ── Noise Source Identification ────────────────────────────────
@app.get("/noise-source")
def get_all_noise_sources():
    nodes = database.get_nodes()
    return ai_service.classify_all_noise_sources(nodes)


@app.get("/noise-source/{node_id}")
def get_node_noise_source(node_id: str):
    nodes = database.get_nodes()
    result = ai_service.classify_node_noise_source(node_id, nodes)
    if not result["bands"]:
        raise HTTPException(status_code=404, detail="Node not found")
    return result


# ── Anomaly Detection API ─────────────────────────────────────
@app.get("/anomaly/{node_id}")
def get_anomaly(node_id: str):
    nodes = database.get_nodes()
    for n in nodes:
        if n["id"] == node_id:
            return ai_service.detect_anomaly(node_id, n["noise"], nodes)
    raise HTTPException(status_code=404, detail="Node not found")


@app.get("/anomaly")
def get_all_anomalies():
    nodes = database.get_nodes()
    online = [n for n in nodes if n["status"] != "offline"]
    return [ai_service.detect_anomaly(n["id"], n["noise"], nodes) for n in online]


# ── Forecast API ──────────────────────────────────────────────
@app.get("/forecast/{node_id}")
def get_forecast(node_id: str, steps: int = 8):
    nodes = database.get_nodes()
    for n in nodes:
        if n["id"] == node_id:
            values = ai_service.forecast_multi_step(node_id, steps=steps)
            return {"node_id": node_id, "forecast": values, "horizon": f"next {steps} steps"}
    raise HTTPException(status_code=404, detail="Node not found")


# ── Training Status ───────────────────────────────────────────
@app.get("/training/status")
def training_status():
    meta = ai_service.get_training_metadata()
    history = ai_service.get_history_stats()
    return {"model": meta, "history": history, "models_dir": "backend/data/models"}


@app.post("/training/retrain")
def trigger_retraining():
    import subprocess, threading
    def run():
        try:
            result = subprocess.run(
                ["python", "backend/training/train_models.py"],
                capture_output=True, text=True, timeout=120,
            )
            ai_service.load_trained_models()
            print(f"[Manual retrain] OK: {result.stdout[-200:]}")
        except Exception as e:
            print(f"[Manual retrain] Failed: {e}")
    threading.Thread(target=run, daemon=True).start()
    return {"status": "started", "message": "Retraining initiated"}


# ── Report Export ─────────────────────────────────────────────
@app.get("/export/report")
def export_report():
    nodes = database.get_nodes()
    alerts = database.get_alerts()

    scores = ai_service.compute_scores(nodes)
    hotspots = ai_service.detect_hotspots(nodes)
    zones = gis_service.analyze_risk_zones(nodes)
    peak_db, peak_hour = ai_service.compute_peak_hours(nodes)
    meta = ai_service.get_training_metadata()

    return {
        "generated_at": datetime.now().isoformat(),
        "system": "NaadNet Noise Monitoring",
        "location": "Hyderabad, India",
        "summary": {
            "total_nodes": len(nodes),
            "online_nodes": sum(1 for n in nodes if n["status"] != "offline"),
            "active_alerts": len(alerts),
            "overall_health": scores["overall"],
            "peak_noise": peak_db,
            "peak_hour": f"{peak_hour}:00",
        },
        "health_scores": scores,
        "hotspots": hotspots,
        "risk_zones": zones,
        "model_info": {
            "trained_on": meta.get("last_trained", "N/A"),
            "samples": meta.get("samples_anomaly", 0),
        },
        "recommendations": [
            "Schedule maintenance for battery-low nodes",
            "Deploy additional sensors in high-noise corridors",
            "Review threshold policy for commercial zones",
            "Consider noise barriers for hotspots exceeding 85 dB",
        ],
    }


@app.get("/export/report.csv")
def export_report_csv():
    nodes = database.get_nodes()
    scores = ai_service.compute_scores(nodes)
    lines = [
        "timestamp,total_nodes,online_nodes,alerts,health_score,peak_db",
        f"{datetime.now().isoformat()},{len(nodes)},{sum(1 for n in nodes if n['status'] != 'offline')},{len(database.get_alerts())},{scores['overall']},{max((n['noise'] for n in nodes if n['status'] != 'offline'), default=0)}",
    ]
    for n in nodes:
        if n["status"] == "offline":
            continue
        score = ai_service.compute_health_score(n)
        anomaly = ai_service.detect_anomaly(n["id"], n["noise"], nodes)
        lines.append(f"{n['id']},{n['label']},{n['lat']},{n['lng']},{n['noise']},{n['status']},{n['battery']},{score},{anomaly['severity']}")

    content = "\n".join(lines) + "\n"
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=naadnet_report.csv"},
    )


# ── MQTT Simulation Status ────────────────────────────────────
@app.get("/mqtt/status")
def mqtt_status():
    nodes = database.get_nodes()
    return {
        "broker": "mqtt.naadnet.local",
        "connected_nodes": sum(1 for n in nodes if n["status"] != "offline"),
        "protocol": "MQTT v3.1.1",
        "topics": ["naadnet/{node_id}/noise", "naadnet/{node_id}/status", "naadnet/{node_id}/battery"],
    }


# ── History Stats ─────────────────────────────────────────────
@app.get("/history/stats")
def history_stats():
    return ai_service.get_history_stats()


# ── History Range (date-filtered) ──────────────────────────────
@app.get("/history/range")
def history_range(start: str = "", end: str = ""):
    if not start or not end:
        raise HTTPException(status_code=400, detail="Both start and end query params required (ISO format)")
    readings = database.get_node_history_range(start, end)
    return {"readings": readings, "total": len(readings), "start": start, "end": end}


# ── Predictive Maintenance ────────────────────────────────────
@app.get("/predictive/maintenance")
def get_predictive_maintenance():
    nodes = database.get_nodes()
    return [ai_service.predict_node_offline(n) for n in nodes]


# ── Pipeline Stats ─────────────────────────────────────────────
@app.get("/pipeline/stats")
def get_pipeline_stats():
    return ai_service.get_pipeline_stats()


# ── Training Metrics ───────────────────────────────────────────
@app.get("/training/metrics")
def get_training_metrics():
    meta = ai_service.get_training_metadata()
    online = ai_service.get_online_model_metrics()
    history = ai_service.get_history_stats()
    return {**meta, **online, "history": history}


@app.get("/training/history")
def get_training_history():
    return {"events": ai_service.get_training_history()}


# ── Users ─────────────────────────────────────────────────────
@app.get("/users")
def get_users():
    return database.get_users()


@app.post("/users", status_code=201)
def create_user(user: UserCreate):
    existing = database.get_auth_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    default_password = f"{user.name.lower().replace(' ', '_')}123"
    created = database.create_auth_user(user.name, user.email, default_password, user.role)
    database.create_log("info", "system", f"User {user.email} created", "—")
    return {"id": created["id"], "name": created["name"], "email": created["email"],
            "role": created["role"], "status": created["status"], "lastLogin": None}


@app.put("/users/{user_id}")
def update_user(user_id: int, user: UserCreate):
    updated = database.update_user(user_id, user.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    database.create_log("info", "system", f"User {updated['email']} updated", "—")
    return updated

@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    database.delete_user(user_id)
    return {"deleted": user_id}


# ── Logs ──────────────────────────────────────────────────────
@app.get("/logs")
def get_logs():
    return database.get_logs()


# ── Auth ───────────────────────────────────────────────────────
@app.post("/auth/login")
def auth_login(body: AuthLogin):
    user = database.get_auth_user_by_email(body.email)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = secrets.token_hex(32)
    database.save_token(token, user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"],
                 "role": user["role"], "status": user["status"]},
    }


@app.post("/auth/register")
def auth_register(body: AuthRegister):
    existing = database.get_auth_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = database.create_auth_user(body.name, body.email, body.password)
    token = secrets.token_hex(32)
    database.save_token(token, user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"],
                 "role": user["role"], "status": user["status"]},
    }


@app.get("/auth/me")
def auth_me(current_user: dict = Depends(_get_user_from_token)):
    return current_user


# ── WebSocket ─────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active = [c for c in self.active if c != ws]

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(3)
            updates = []
            nodes = database.get_nodes()

            for n in nodes:
                if n["status"] == "offline":
                    continue
                drift = random.randint(-3, 4)
                new_noise = max(30, min(100, n["noise"] + drift))
                new_status = n["status"]
                if new_noise > n["threshold"] and n["status"] == "online":
                    new_status = "warning"
                elif new_noise <= n["threshold"] and n["status"] == "warning":
                    new_status = "online"

                current_temp = n.get("temperature") or 32.0
                current_hum = n.get("humidity") or 60.0
                new_temp = round(max(10, min(50, current_temp + random.uniform(-0.5, 0.5))), 1)
                new_hum = round(max(20, min(95, current_hum + random.uniform(-2, 2))), 1)

                database.update_node(n["id"], noise=new_noise, status=new_status,
                    temperature=new_temp, humidity=new_hum)
                database.save_node_history(n["id"], new_noise, temperature=new_temp, humidity=new_hum)
                ai_service.feed_heartbeat(n["id"], new_noise, n.get("battery", 80), nodes)

                anomaly = ai_service.detect_anomaly(n["id"], new_noise, nodes)

                updates.append({
                    "id": n["id"],
                    "noise": new_noise,
                    "status": new_status,
                    "temperature": new_temp,
                    "humidity": new_hum,
                    "anomaly_score": anomaly["anomaly_score"],
                })

            database.trim_alerts(max_count=50)

            await manager.broadcast({
                "type": "noise_update",
                "nodes": updates,
                "alerts": [],
                "ts": datetime.now().isoformat(),
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
