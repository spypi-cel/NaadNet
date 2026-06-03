"""
In-memory database layer for NaadNet backend.
Provides all CRUD operations used by main.py.
"""
import hashlib
from datetime import datetime
from typing import List, Optional, Dict, Any

# ── In-memory stores ──────────────────────────────────────────
_nodes: List[Dict] = [
    {"id": "HTC-01", "label": "Hitech City",   "lat": 17.3850, "lng": 78.4860, "status": "online",  "noise": 85, "battery": 87, "firmware": "v2.3.1", "threshold": 70, "last_seen": datetime.now().isoformat(), "temperature": 32.1, "humidity": 65.0},
    {"id": "KKP-02", "label": "Kukatpally",    "lat": 17.4401, "lng": 78.3489, "status": "online",  "noise": 62, "battery": 62, "firmware": "v2.3.1", "threshold": 70, "last_seen": datetime.now().isoformat(), "temperature": 31.5, "humidity": 68.0},
    {"id": "BNH-03", "label": "Banjara Hills", "lat": 17.3616, "lng": 78.4747, "status": "warning", "noise": 78, "battery": 12, "firmware": "v2.2.0", "threshold": 70, "last_seen": datetime.now().isoformat(), "temperature": 33.0, "humidity": 60.0},
    {"id": "SEC-04", "label": "Secunderabad",  "lat": 17.4239, "lng": 78.4738, "status": "online",  "noise": 91, "battery": 95, "firmware": "v2.3.1", "threshold": 70, "last_seen": datetime.now().isoformat(), "temperature": 30.8, "humidity": 70.0},
    {"id": "LBN-05", "label": "LB Nagar",      "lat": 17.3850, "lng": 78.5500, "status": "online",  "noise": 50, "battery": 78, "firmware": "v2.3.1", "threshold": 70, "last_seen": datetime.now().isoformat(), "temperature": 31.2, "humidity": 66.0},
    {"id": "BAL-06", "label": "Balanagar",     "lat": 17.4950, "lng": 78.3900, "status": "offline", "noise": 0,  "battery": 0,  "firmware": "v2.1.0", "threshold": 70, "last_seen": None, "temperature": None, "humidity": None},
]

_alerts: List[Dict] = [
    {"id": 1, "severity": "critical", "message": "Node SEC-04 exceeded 91 dB threshold", "meta": "Secunderabad · 2 min ago", "node": "SEC-04"},
    {"id": 2, "severity": "warning",  "message": "Node HTC-01 noise spike detected",      "meta": "Hitech City · 8 min ago",  "node": "HTC-01"},
    {"id": 3, "severity": "warning",  "message": "Node BNH-03 battery low (12%)",         "meta": "Banjara Hills · 15 min ago","node": "BNH-03"},
    {"id": 4, "severity": "info",     "message": "OTA firmware update available (v2.4.1)","meta": "All nodes · 1 hr ago",     "node": "ALL"},
]

_users: List[Dict] = [
    {"id": 1, "name": "Arjun Sharma", "email": "admin@naadnet.io",  "role": "superadmin", "status": "active",   "lastLogin": "2026-05-30 11:42", "password": "admin123"},
    {"id": 2, "name": "Priya Reddy",  "email": "priya@naadnet.io",  "role": "admin",      "status": "active",   "lastLogin": "2026-05-29 09:15", "password": "admin123"},
    {"id": 3, "name": "Kiran Babu",   "email": "kiran@naadnet.io",  "role": "viewer",     "status": "active",   "lastLogin": "2026-05-28 14:30", "password": "viewer123"},
]

_logs: List[Dict] = [
    {"id": 1,  "time": "2026-05-30 12:08", "level": "info",     "user": "arjun@naadnet.io", "action": "Node SEC-04 added to map",              "node": "SEC-04"},
    {"id": 2,  "time": "2026-05-30 11:55", "level": "warning",  "user": "system",           "action": "Node BNH-03 battery critical (12%)",     "node": "BNH-03"},
    {"id": 3,  "time": "2026-05-30 11:42", "level": "critical", "user": "system",           "action": "Noise threshold exceeded — SEC-04 91dB", "node": "SEC-04"},
    {"id": 4,  "time": "2026-05-30 11:30", "level": "info",     "user": "priya@naadnet.io", "action": "OTA firmware v2.3.1 pushed to HTC-01",   "node": "HTC-01"},
    {"id": 5,  "time": "2026-05-30 10:15", "level": "info",     "user": "arjun@naadnet.io", "action": "Settings updated — threshold 70dB",      "node": "—"},
    {"id": 6,  "time": "2026-05-30 09:50", "level": "warning",  "user": "system",           "action": "Node BAL-06 went offline",               "node": "BAL-06"},
]

_node_history: List[Dict] = []
_tokens: Dict[str, int] = {}  # token -> user_id
_alert_id_counter = 5
_log_id_counter = 7
_user_id_counter = 4


def init_db():
    """Called on startup — nothing to do for in-memory store."""
    pass


# ── Nodes ─────────────────────────────────────────────────────
def get_nodes() -> List[Dict]:
    return list(_nodes)


def get_node(node_id: str) -> Optional[Dict]:
    return next((n for n in _nodes if n["id"] == node_id), None)


def create_node(node_id: str, label: str, lat: float, lng: float) -> Dict:
    node = {
        "id": node_id, "label": label, "lat": lat, "lng": lng,
        "status": "offline", "noise": 0, "battery": 100,
        "firmware": "v2.3.1", "threshold": 70,
        "last_seen": datetime.now().isoformat(),
        "temperature": None, "humidity": None,
    }
    _nodes.append(node)
    return node


def update_node(node_id: str, **kwargs) -> Optional[Dict]:
    for n in _nodes:
        if n["id"] == node_id:
            n.update(kwargs)
            return n
    return None


def delete_node(node_id: str):
    global _nodes
    _nodes = [n for n in _nodes if n["id"] != node_id]


# ── Alerts ────────────────────────────────────────────────────
def get_alerts() -> List[Dict]:
    return list(_alerts)


def create_alert(severity: str, message: str, node: str, meta: str = "") -> Dict:
    global _alert_id_counter
    _alert_id_counter += 1
    alert = {"id": _alert_id_counter, "severity": severity, "message": message, "node": node, "meta": meta}
    _alerts.append(alert)
    return alert


def delete_alert(alert_id: int):
    global _alerts
    _alerts = [a for a in _alerts if a["id"] != alert_id]


def trim_alerts(max_count: int = 50):
    global _alerts
    if len(_alerts) > max_count:
        _alerts = _alerts[-max_count:]


# ── Users ─────────────────────────────────────────────────────
def get_users() -> List[Dict]:
    return [{"id": u["id"], "name": u["name"], "email": u["email"],
             "role": u["role"], "status": u["status"], "lastLogin": u.get("lastLogin")}
            for u in _users]


def get_auth_user_by_email(email: str) -> Optional[Dict]:
    return next((u for u in _users if u["email"] == email), None)


def get_auth_user_by_id(user_id: int) -> Optional[Dict]:
    return next((u for u in _users if u["id"] == user_id), None)


def create_auth_user(name: str, email: str, password: str, role: str = "viewer") -> Dict:
    global _user_id_counter
    _user_id_counter += 1
    user = {"id": _user_id_counter, "name": name, "email": email,
            "password": password, "role": role, "status": "active", "lastLogin": None}
    _users.append(user)
    return user


def update_user(user_id: int, data: dict) -> Optional[Dict]:
    for u in _users:
        if u["id"] == user_id:
            u.update({k: v for k, v in data.items() if v is not None})
            return {"id": u["id"], "name": u["name"], "email": u["email"],
                    "role": u["role"], "status": u["status"], "lastLogin": u.get("lastLogin")}
    return None

def delete_user(user_id: int):
    global _users
    _users = [u for u in _users if u["id"] != user_id]


def delete_user_by_email(email: str):
    global _users
    _users = [u for u in _users if u["email"] != email]


# ── Tokens ────────────────────────────────────────────────────
def save_token(token: str, user_id: int):
    _tokens[token] = user_id


def get_user_id_by_token(token: str) -> Optional[int]:
    return _tokens.get(token)


# ── Logs ──────────────────────────────────────────────────────
def get_logs() -> List[Dict]:
    return list(reversed(_logs))


def create_log(level: str, user: str, action: str, node: str) -> Dict:
    global _log_id_counter
    _log_id_counter += 1
    entry = {
        "id": _log_id_counter,
        "time": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "level": level, "user": user, "action": action, "node": node,
    }
    _logs.append(entry)
    return entry


# ── Node History ──────────────────────────────────────────────
def save_node_history(node_id: str, noise: float, temperature: float = None, humidity: float = None):
    _node_history.append({
        "node_id": node_id, "noise": noise,
        "temperature": temperature, "humidity": humidity,
        "ts": datetime.now().isoformat(),
    })
    # Keep last 10000 readings
    if len(_node_history) > 10000:
        _node_history.pop(0)


def get_node_history(node_id: str, limit: int = 100) -> List[Dict]:
    hist = [h for h in _node_history if h["node_id"] == node_id]
    return hist[-limit:]


def get_node_history_range(start: str, end: str) -> List[Dict]:
    try:
        s = datetime.fromisoformat(start)
        e = datetime.fromisoformat(end)
        return [h for h in _node_history
                if s <= datetime.fromisoformat(h["ts"]) <= e]
    except Exception:
        return []
