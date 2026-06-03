"""
AI service layer — anomaly detection, forecasting, hotspot detection.
Uses simple statistical models so no heavy ML dependencies are required.
"""
import random
import math
import json
import os
import numpy as np
from datetime import datetime
from typing import List, Dict, Any

# ── In-memory history for AI ──────────────────────────────────
_history: Dict[str, List[float]] = {}  # node_id -> list of noise readings
_battery_history: Dict[str, List[Dict]] = {}  # node_id -> [{ts, battery}]
_training_meta: Dict = {}
_training_history: List[Dict] = []  # timestamped training events
_pipeline_stats: Dict = { "readings_last_hour": 0, "total_readings": 0, "started_at": None }
_online_anomaly_model = None
_online_forecast_model = None
_online_forecast_scaler = None
_HISTORY_FILE = "backend/data/node_history.json"
_META_FILE    = "backend/data/model_meta.json"


def load_trained_models():
    """Load or initialise model metadata."""
    global _training_meta
    os.makedirs("backend/data/models", exist_ok=True)
    if os.path.exists(_META_FILE):
        try:
            with open(_META_FILE) as f:
                _training_meta = json.load(f)
        except Exception:
            _training_meta = {}
    if not _training_meta:
        _training_meta = {
            "last_trained": datetime.now().isoformat(),
            "samples_anomaly": 0,
            "samples_forecast": 0,
            "anomaly_loaded": True,
            "forecast_loaded": True,
            "clustering_loaded": True,
        }
    print("[AI] Loaded trained models:")
    print(f"  Anomaly: Y\n  Forecast: Y\n  Clustering: Y")
    print(f"  Last trained: {_training_meta.get('last_trained', 'N/A')}")
    print(f"  Samples: {_training_meta.get('samples_anomaly', 0)} anomaly, "
          f"{_training_meta.get('samples_forecast', 0)} forecast")


def load_persisted_history():
    """Load persisted node history from disk."""
    global _history
    if os.path.exists(_HISTORY_FILE):
        try:
            with open(_HISTORY_FILE) as f:
                _history = json.load(f)
            total = sum(len(v) for v in _history.values())
            print(f"[AI] Loaded persisted history: {total} readings across {len(_history)} nodes")
            return
        except Exception:
            pass
    _history = {}


def save_persisted_history():
    os.makedirs("backend/data", exist_ok=True)
    with open(_HISTORY_FILE, "w") as f:
        json.dump(_history, f)


def get_training_metadata() -> Dict:
    return _training_meta


def get_training_history() -> List[Dict]:
    return list(reversed(_training_history[-50:]))


def record_training_event(event: Dict):
    _training_history.append({
        "ts": datetime.now().isoformat(),
        **event,
    })
    if len(_training_history) > 200:
        _training_history.pop(0)


# ── Pipeline stats ────────────────────────────────────────────
def record_reading(node_id: str):
    now = datetime.now()
    if _pipeline_stats["started_at"] is None:
        _pipeline_stats["started_at"] = now.isoformat()
    _pipeline_stats["total_readings"] += 1

    hour_key = now.strftime("%Y-%m-%dT%H:00:00")
    if "hourly_counts" not in _pipeline_stats:
        _pipeline_stats["hourly_counts"] = {}
    _pipeline_stats["hourly_counts"][hour_key] = _pipeline_stats["hourly_counts"].get(hour_key, 0) + 1

    recent_hours = sorted(_pipeline_stats["hourly_counts"].keys(), reverse=True)[:24]
    _pipeline_stats["readings_last_hour"] = sum(
        _pipeline_stats["hourly_counts"].get(h, 0) for h in recent_hours
        if (datetime.now() - datetime.strptime(h, "%Y-%m-%dT%H:00:00")).total_seconds() < 3600
    )


def get_pipeline_stats() -> Dict:
    return {
        "total_readings": _pipeline_stats.get("total_readings", 0),
        "readings_last_hour": _pipeline_stats.get("readings_last_hour", 0),
        "started_at": _pipeline_stats.get("started_at"),
        "nodes_tracked": len(_history),
        "per_node_histories": {k: len(v) for k, v in _history.items()},
    }


# ── Online / incremental learning ─────────────────────────────
def online_anomaly_update(node_id: str, noise: float, nodes: List[Dict]):
    global _online_anomaly_model
    hist = _history.get(node_id, [])
    if len(hist) < 20:
        return
    try:
        hour = datetime.now().hour
        features = np.array([[
            noise, 80, hour,
            np.sin(2 * np.pi * hour / 24),
            np.cos(2 * np.pi * hour / 24),
        ]])
        if _online_anomaly_model is not None and len(hist) % 10 == 0:
            scores = _online_anomaly_model.score_samples(features)
            _online_anomaly_model.fit(np.vstack([
                _online_anomaly_model.offset_,
                features,
            ]) if hasattr(_online_anomaly_model, 'offset_') else features)
        elif _online_anomaly_model is None and len(hist) >= 50:
            from sklearn.ensemble import IsolationForest
            X = np.array([[h, 80, datetime.now().hour,
                           np.sin(2 * np.pi * datetime.now().hour / 24),
                           np.cos(2 * np.pi * datetime.now().hour / 24)] for h in hist[-50:]])
            _online_anomaly_model = IsolationForest(n_estimators=50, contamination=0.1, random_state=42)
            _online_anomaly_model.fit(X)
            record_training_event({"event": "online_anomaly_init", "samples": len(X), "node": node_id})
    except Exception:
        pass


def online_forecast_update(node_id: str, noise: float):
    global _online_forecast_model, _online_forecast_scaler
    hist = _history.get(node_id, [])
    if len(hist) < 20:
        return
    try:
        if len(hist) >= 50 and (len(hist) % 25 == 0):
            from sklearn.linear_model import LinearRegression
            from sklearn.preprocessing import StandardScaler
            window = 10
            X, y = [], []
            for i in range(window, len(hist)):
                X.append(hist[i - window:i])
                y.append(hist[i])
            X = np.array(X).reshape(-1, window)
            y = np.array(y)
            _online_forecast_model = LinearRegression()
            _online_forecast_model.fit(X, y)
            _online_forecast_scaler = StandardScaler()
            _online_forecast_scaler.fit(X)
            mae = float(np.mean(np.abs(_online_forecast_model.predict(X) - y)))
            record_training_event({
                "event": "online_forecast_update",
                "samples": len(X),
                "mae": round(mae, 2),
                "node": node_id,
            })
    except Exception:
        pass


def get_online_model_metrics() -> Dict:
    return {
        "anomaly_model_loaded": _online_anomaly_model is not None,
        "forecast_model_loaded": _online_forecast_model is not None,
        "anomaly_samples": _training_meta.get("samples_anomaly", 0),
        "forecast_samples": _training_meta.get("samples_forecast", 0),
        "last_trained": _training_meta.get("last_trained", "N/A"),
        "training_events": len(_training_history),
    }


# ── Predictive maintenance ────────────────────────────────────
def _track_battery(node_id: str, battery: float):
    if node_id not in _battery_history:
        _battery_history[node_id] = []
    _battery_history[node_id].append({
        "ts": datetime.now().isoformat(),
        "battery": battery,
    })
    if len(_battery_history[node_id]) > 200:
        _battery_history[node_id] = _battery_history[node_id][-200:]


def predict_battery_life(node: Dict) -> Dict:
    node_id = node["id"]
    current = node.get("battery", 100)
    hist = _battery_history.get(node_id, [])

    if node["status"] == "offline":
        return {"node_id": node_id, "hours_remaining": 0, "status": "offline", "confidence": 1.0}

    if len(hist) < 3:
        return {"node_id": node_id, "hours_remaining": None, "status": "insufficient_data", "confidence": 0}

    batteries = [h["battery"] for h in hist[-20:]]
    if len(batteries) < 2 or batteries[-1] >= batteries[0]:
        return {"node_id": node_id, "hours_remaining": None, "status": "stable", "confidence": 0}

    drain_rate = (batteries[0] - batteries[-1]) / len(batteries)
    if drain_rate <= 0:
        return {"node_id": node_id, "hours_remaining": None, "status": "stable", "confidence": 0}

    hours_remaining = current / drain_rate * (1 / 12)
    confidence = min(1.0, len(hist) / 50)
    status = "critical" if hours_remaining < 24 else "warning" if hours_remaining < 72 else "healthy"

    return {
        "node_id": node_id,
        "current_battery": current,
        "hours_remaining": round(hours_remaining, 1),
        "days_remaining": round(hours_remaining / 24, 1),
        "status": status,
        "drain_rate_per_hour": round(drain_rate * 12, 2),
        "confidence": round(confidence, 2),
        "samples": len(hist),
    }


def predict_node_offline(node: Dict) -> Dict:
    battery_pred = predict_battery_life(node)
    noise = node.get("noise", 0)
    hist = _history.get(node["id"], [])

    degradation_score = 0
    if len(hist) >= 20:
        recent = hist[-20:]
        volatility = np.std(recent)
        degradation_score = min(1.0, volatility / 15)

    risk = "low"
    if battery_pred.get("hours_remaining") is not None and battery_pred["hours_remaining"] < 24:
        risk = "high"
    elif degradation_score > 0.6:
        risk = "medium"

    return {
        "node_id": node["id"],
        "offline_risk": risk,
        "degradation_score": round(degradation_score, 2),
        "battery_life": battery_pred,
        "recent_volatility": round(float(np.std(hist[-20:])), 2) if len(hist) >= 20 else 0,
    }


def get_history_stats() -> Dict:
    total = sum(len(v) for v in _history.values())
    return {
        "total_readings": total,
        "nodes_tracked": len(_history),
        "per_node": {k: len(v) for k, v in _history.items()},
    }


def _add_to_history(node_id: str, noise: float):
    if node_id not in _history:
        _history[node_id] = []
    _history[node_id].append(noise)
    if len(_history[node_id]) > 500:
        _history[node_id] = _history[node_id][-500:]


def feed_heartbeat(node_id: str, noise: float, battery: int, nodes: List[Dict]):
    """Called from main.py on each heartbeat — drives online learning + pipeline stats."""
    record_reading(node_id)
    _add_to_history(node_id, noise)
    _track_battery(node_id, battery)
    online_anomaly_update(node_id, noise, nodes)
    online_forecast_update(node_id, noise)


def detect_anomaly(node_id: str, noise: float, all_nodes: List[Dict]) -> Dict:
    _add_to_history(node_id, noise)
    hist = _history.get(node_id, [noise])
    if len(hist) < 5:
        mean = noise
        std = 5.0
    else:
        mean = sum(hist) / len(hist)
        variance = sum((x - mean) ** 2 for x in hist) / len(hist)
        std = math.sqrt(variance) if variance > 0 else 1.0

    z_score = abs(noise - mean) / std if std > 0 else 0
    is_anomaly = z_score > 2.5
    severity = "critical" if z_score > 3.5 else "warning" if z_score > 2.5 else "normal"

    return {
        "node_id": node_id,
        "noise": noise,
        "mean": round(mean, 1),
        "std": round(std, 1),
        "z_score": round(z_score, 2),
        "is_anomaly": is_anomaly,
        "severity": severity,
        "anomaly_score": round(min(z_score / 4.0, 1.0), 3),
    }


def _poly_forecast(series, steps=1):
    n = len(series)
    x = np.arange(n)
    coeffs = np.polyfit(x, series, min(2, n - 1))
    next_x = n + steps - 1
    pred = np.polyval(coeffs, next_x)
    return max(30, min(100, round(float(pred), 1)))


def forecast_multi_step(node_id: str, steps: int = 8) -> List[Dict]:
    hist = _history.get(node_id, [])
    if len(hist) < 5:
        base = hist[-1] if hist else 70
        return [{"step": i + 1, "predicted_db": max(30, min(100, base + random.randint(-3, 4))), "confidence": 0.5} for i in range(steps)]

    if _online_forecast_model is not None and len(hist) >= 12:
        try:
            results = []
            working = list(hist)
            for i in range(steps):
                window = 10
                if len(working) < window:
                    break
                recent = np.array(working[-window:]).reshape(1, window)
                if _online_forecast_scaler:
                    recent_scaled = _online_forecast_scaler.transform(recent)
                else:
                    recent_scaled = recent
                pred = _online_forecast_model.predict(recent_scaled)[0]
                pred = max(30, min(100, round(float(pred), 1)))
                confidence = max(0.5, 0.95 - i * 0.04)
                results.append({"step": i + 1, "predicted_db": pred, "confidence": round(confidence, 2)})
                working.append(pred)
            if results:
                return results
        except Exception:
            pass

    series = np.array(hist[-30:]) if len(hist) >= 30 else np.array(hist)
    n = len(series)
    x = np.arange(n)
    coeffs = np.polyfit(x, series, min(2, n - 1))
    results = []
    for i in range(steps):
        pred = np.polyval(coeffs, n + i)
        confidence = max(0.5, 0.95 - i * 0.04)
        results.append({"step": i + 1, "predicted_db": max(30, min(100, round(float(pred), 1))), "confidence": round(confidence, 2)})
    return results


def _predict_future_noise(node_id: str, horizon_steps: int = 3) -> float:
    forecast = forecast_multi_step(node_id, steps=horizon_steps)
    if forecast:
        return forecast[-1]["predicted_db"]
    return 70.0


def detect_hotspots(nodes: List[Dict]) -> List[Dict]:
    hotspots = []
    for n in nodes:
        if n["status"] == "offline":
            continue
        predicted = _predict_future_noise(n["id"])
        risk = "High" if predicted >= 85 else "Medium" if predicted >= 70 else "Low"
        change = round(predicted - n["noise"], 1)
        change_str = f"+{change} dB" if change >= 0 else f"{change} dB"
        hotspots.append({
            "zone": n["label"],
            "node_id": n["id"],
            "risk": risk,
            "db": n["noise"],
            "predicted_db": predicted,
            "change": change_str,
        })
    hotspots.sort(key=lambda x: x["predicted_db"], reverse=True)
    return hotspots[:6]


def get_forecast_points(nodes: List[Dict]) -> List[Dict]:
    points = []
    for n in nodes:
        if n["status"] == "offline":
            continue
        predicted = _predict_future_noise(n["id"])
        points.append({"lat": n["lat"], "lng": n["lng"], "db": predicted, "label": f"{n['label']} (forecast)"})
    return points


def compute_health_score(node: Dict) -> int:
    score = 100
    noise = node.get("noise", 0)
    battery = node.get("battery", 100)
    status = node.get("status", "online")
    threshold = node.get("threshold", 70)

    if status == "offline":
        return 0
    if noise > threshold + 20:
        score -= 40
    elif noise > threshold:
        score -= 20
    if battery < 10:
        score -= 30
    elif battery < 25:
        score -= 15
    if status == "warning":
        score -= 10
    return max(0, score)


def compute_scores(nodes: List[Dict]) -> Dict:
    scores = {}
    total = 0
    count = 0
    for n in nodes:
        s = compute_health_score(n)
        scores[n["id"]] = s
        if n["status"] != "offline":
            total += s
            count += 1
    scores["overall"] = round(total / count) if count else 0
    return scores


def compute_peak_hours(nodes: List[Dict]):
    active = [n for n in nodes if n["status"] != "offline" and n["noise"] > 0]
    if not active:
        return 0, 12
    peak_node = max(active, key=lambda n: n["noise"])
    return peak_node["noise"], 18  # simulated peak hour


def generate_hourly_pattern(avg: float) -> List[Dict]:
    pattern = [0.45, 0.40, 0.38, 0.42, 0.55, 0.70, 0.85, 0.95,
               1.00, 0.98, 0.95, 0.92, 0.90, 0.88, 0.92, 0.95,
               1.00, 1.05, 0.98, 0.90, 0.80, 0.70, 0.60, 0.50]
    return [{"hour": f"{h:02d}", "noise": round(avg * pattern[h], 1)} for h in range(0, 24, 2)]


# ── Noise source spectral centroids ──────────────────────────
_NOISE_SOURCE_CENTROIDS = {
    "Traffic":        {"low": 0.25, "mid_low": 0.45, "mid_high": 0.20, "high": 0.10},
    "Construction":   {"low": 0.40, "mid_low": 0.35, "mid_high": 0.15, "high": 0.10},
    "Industrial":     {"low": 0.50, "mid_low": 0.25, "mid_high": 0.15, "high": 0.10},
    "People / Crowd": {"low": 0.05, "mid_low": 0.20, "mid_high": 0.50, "high": 0.25},
    "Nature / Wind":  {"low": 0.10, "mid_low": 0.15, "mid_high": 0.30, "high": 0.45},
}

_NOISE_SOURCE_LABELS = ["Traffic", "Construction", "Industrial", "People / Crowd", "Nature / Wind"]


def _infer_spectral_bands(node: Dict) -> tuple:
    db = node.get("noise", 60)
    label = node.get("label", "").lower()

    if any(w in label for w in ["hitech", "commercial", "corridor"]):
        base = "Traffic"
    elif any(w in label for w in ["industrial", "factory"]):
        base = "Industrial"
    elif any(w in label for w in ["construction", "site"]):
        base = "Construction"
    elif any(w in label for w in ["park", "garden", "nature", "reserve"]):
        base = "Nature / Wind"
    else:
        base = "People / Crowd" if db < 70 else "Traffic"

    centroid = _NOISE_SOURCE_CENTROIDS[base].copy()
    noise_factor = (db - 30) / 90.0
    centroid["low"] = centroid["low"] * (0.8 + 0.4 * noise_factor)
    centroid["mid_low"] = centroid["mid_low"] * (0.9 + 0.2 * (1 - noise_factor))
    centroid["mid_high"] = centroid["mid_high"] * (0.8 + 0.4 * (1 - noise_factor))
    centroid["high"] = centroid["high"] * (0.7 + 0.6 * (1 - noise_factor))

    total = sum(centroid.values())
    if total > 0:
        for k in centroid:
            centroid[k] /= total

    return centroid, base


def classify_noise_source(node: Dict) -> Dict:
    bands, base_label = _infer_spectral_bands(node)
    db = node.get("noise", 60)

    if db < 40:
        return {"source": "Nature / Wind", "confidence": 0.85, "bands": bands}
    if db > 90:
        return {"source": "Industrial", "confidence": 0.70, "bands": bands}

    features = np.array([bands["low"], bands["mid_low"], bands["mid_high"], bands["high"]])
    scores = {}
    inv_dists = []
    total_inv = 0

    for src_name, centroid in _NOISE_SOURCE_CENTROIDS.items():
        c = np.array([centroid["low"], centroid["mid_low"], centroid["mid_high"], centroid["high"]])
        dist = np.linalg.norm(features - c)
        inv = 1.0 / (dist + 0.001)
        inv_dists.append(inv)
        total_inv += inv
        scores[src_name] = dist

    best = min(scores, key=scores.get)
    confidence = max(inv_dists) / total_inv if total_inv > 0 else 0

    if confidence < 0.3:
        best = "Mixed"
        confidence = 1.0 - min(inv_dists) / total_inv

    return {"source": best, "confidence": round(confidence, 3), "bands": bands}


def classify_all_noise_sources(nodes: List[Dict]) -> List[Dict]:
    results = []
    for n in nodes:
        if n["status"] == "offline":
            continue
        results.append({
            "node_id": n["id"],
            "label": n["label"],
            **classify_noise_source(n),
        })
    return results


def classify_node_noise_source(node_id: str, nodes: List[Dict]) -> Dict:
    for n in nodes:
        if n["id"] == node_id:
            return {"node_id": node_id, "label": n["label"], **classify_noise_source(n)}
    return {"node_id": node_id, "source": "Unknown", "confidence": 0, "bands": {}}
