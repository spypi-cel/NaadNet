import os
import json
import pickle
import numpy as np
from collections import deque
from datetime import datetime
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

HISTORY_LEN = 200
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
MODELS_DIR = os.path.join(DATA_DIR, "models")
HISTORY_DIR = os.path.join(DATA_DIR, "history")
HISTORY_FILE = os.path.join(HISTORY_DIR, "live_history.json")

_node_history = {}
_history_persisted = False

_trained_anomaly_model = None
_trained_forecast_model = None
_trained_forecast_scaler = None
_trained_cluster_model = None
_trained_cluster_scaler = None
_training_metadata = {}

_hourly_patterns = {
    0: 42, 1: 39, 2: 36, 3: 34, 4: 33, 5: 35,
    6: 45, 7: 60, 8: 74, 9: 78, 10: 80, 11: 82,
    12: 83, 13: 81, 14: 79, 15: 82, 16: 85, 17: 88,
    18: 86, 19: 80, 20: 74, 21: 66, 22: 55, 23: 47,
}


def _load_model(name):
    path = os.path.join(MODELS_DIR, f"{name}.pkl")
    if os.path.exists(path):
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


def load_trained_models():
    global _trained_anomaly_model, _trained_forecast_model, _trained_forecast_scaler
    global _trained_cluster_model, _trained_cluster_scaler, _training_metadata

    _trained_anomaly_model = _load_model("anomaly_detector")
    _trained_forecast_model = _load_model("forecast_model")
    _trained_forecast_scaler = _load_model("forecast_scaler")
    _trained_cluster_model = _load_model("cluster_model")
    _trained_cluster_scaler = _load_model("cluster_scaler")

    meta_path = os.path.join(MODELS_DIR, "training_metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            _training_metadata = json.load(f)

    print(f"[AI] Loaded trained models:")
    print(f"  Anomaly: {'Y' if _trained_anomaly_model else 'N'}")
    print(f"  Forecast: {'Y' if _trained_forecast_model else 'N'}")
    print(f"  Clustering: {'Y' if _trained_cluster_model else 'N'}")

    if _training_metadata:
        print(f"  Last trained: {_training_metadata.get('last_trained', 'unknown')}")
        print(f"  Samples: {_training_metadata.get('samples_anomaly', 0)} anomaly, {_training_metadata.get('samples_forecast', 0)} forecast")


def load_persisted_history():
    global _node_history, _history_persisted
    if not os.path.exists(HISTORY_FILE):
        return

    try:
        with open(HISTORY_FILE, "r") as f:
            raw = json.load(f)
        for item in raw:
            nid = item["node_id"]
            if nid not in _node_history:
                _node_history[nid] = deque(maxlen=HISTORY_LEN)
            _node_history[nid].append(item["noise"])
        _history_persisted = True
        counts = {nid: len(q) for nid, q in _node_history.items()}
        print(f"[AI] Loaded persisted history: {sum(counts.values())} readings across {len(counts)} nodes")
    except Exception as e:
        print(f"[AI] Failed to load history: {e}")


def save_persisted_history():
    records = []
    for nid, q in _node_history.items():
        for val in q:
            records.append({"node_id": nid, "noise": val, "ts": datetime.now().isoformat()})

    os.makedirs(HISTORY_DIR, exist_ok=True)
    with open(HISTORY_FILE, "w") as f:
        json.dump(records[-5000:], f, indent=2)


def get_training_metadata():
    return _training_metadata


def _ensure_history(node_id, noise):
    if node_id not in _node_history:
        _node_history[node_id] = deque(maxlen=HISTORY_LEN)
    _node_history[node_id].append(noise)


def _get_baseline(node_id, nodes):
    history = list(_node_history.get(node_id, []))
    if len(history) >= 5:
        return np.mean(history[-5:])
    for n in nodes:
        if n["id"] == node_id and n["status"] != "offline":
            return float(n.get("noise", 70))
    return 70.0


def detect_anomaly(node_id, current_noise, nodes):
    _ensure_history(node_id, current_noise)
    history = list(_node_history.get(node_id, []))
    baseline = _get_baseline(node_id, nodes)

    anomaly_score = 0.0

    if _trained_anomaly_model and len(history) >= 5:
        try:
            hour = datetime.now().hour
            features = np.array([[
                current_noise,
                80,
                hour,
                np.sin(2 * np.pi * hour / 24),
                np.cos(2 * np.pi * hour / 24),
            ]])
            score = _trained_anomaly_model.score_samples(features)[0]
            anomaly_score = max(0.0, min(1.0, 1.0 - (score + 0.5) / 1.2))
        except Exception:
            pass

    if anomaly_score < 0.3 and len(history) >= 10:
        arr = np.array(history[-10:]).reshape(-1, 1)
        if len(set(history[-10:])) > 1:
            try:
                iso = IsolationForest(n_estimators=50, contamination=0.1, random_state=42)
                iso.fit(arr)
                score2 = iso.score_samples(np.array([[current_noise]]))[0]
                anomaly_score = max(anomaly_score, max(0.0, min(1.0, 1.0 - (score2 + 0.5) / 1.5)))
            except Exception:
                pass

    deviation = abs(current_noise - baseline)
    severity = "normal"
    if deviation > 20 or anomaly_score > 0.8:
        severity = "critical"
    elif deviation > 12 or anomaly_score > 0.6:
        severity = "warning"
    elif anomaly_score > 0.4:
        severity = "info"

    return {
        "node_id": node_id,
        "current": current_noise,
        "baseline": round(baseline, 1),
        "deviation": round(deviation, 1),
        "anomaly_score": round(anomaly_score, 3),
        "severity": severity,
    }


def _poly_forecast(series, steps=1):
    n = len(series)
    x = np.arange(n)
    coeffs = np.polyfit(x, series, min(2, n - 1))
    next_x = n + steps - 1
    pred = np.polyval(coeffs, next_x)
    return max(30, min(100, round(float(pred), 1)))


def forecast_node(node_id, horizon_minutes=60):
    history = list(_node_history.get(node_id, []))
    if len(history) < 5:
        return None

    series = np.array(history[-30:]) if len(history) >= 30 else np.array(history)
    if len(series) < 5:
        return None

    if _trained_forecast_model and len(history) >= 12:
        try:
            window = 10
            recent = np.array(history[-window:]).reshape(1, window, 1)
            n_samps, n_wins, n_feat = recent.shape
            x_flat = recent.reshape(n_samps, n_wins * n_feat)
            if _trained_forecast_scaler:
                x_flat = _trained_forecast_scaler.transform(x_flat)
            pred = _trained_forecast_model.predict(x_flat)[0]
            return max(30, min(100, round(float(pred), 1)))
        except Exception:
            pass

    return _poly_forecast(series, steps=max(1, horizon_minutes // 3))


def forecast_multi_step(node_id, steps=8):
    history = list(_node_history.get(node_id, []))
    if len(history) < 5:
        current = history[-1] if history else 70
        return [max(30, min(100, current + np.random.randint(-3, 4))) for _ in range(steps)]

    series = np.array(history[-30:]) if len(history) >= 30 else np.array(history)
    n = len(series)

    if _trained_forecast_model and len(history) >= 12:
        try:
            results = []
            working = list(history)
            for _ in range(steps):
                window = 10
                recent = np.array(working[-window:]).reshape(1, window, 1)
                x_flat = recent.reshape(1, window)
                if _trained_forecast_scaler:
                    x_flat = _trained_forecast_scaler.transform(x_flat)
                pred = _trained_forecast_model.predict(x_flat)[0]
                pred = max(30, min(100, round(float(pred), 1)))
                results.append(pred)
                working.append(pred)
            return results
        except Exception:
            pass

    x = np.arange(n)
    coeffs = np.polyfit(x, series, min(2, n - 1))
    results = []
    for i in range(steps):
        pred = np.polyval(coeffs, n + i)
        results.append(max(30, min(100, round(float(pred), 1))))
    return results


def detect_hotspots(nodes):
    online = [n for n in nodes if n["status"] != "offline"]
    if len(online) < 2:
        return _fallback_hotspots(nodes)

    coords = np.array([[n["lat"], n["lng"]] for n in online])
    noise_vals = np.array([n["noise"] for n in online]).reshape(-1, 1)
    features = np.hstack([coords * 0.1, noise_vals * 0.01])

    try:
        if _trained_cluster_model and _trained_cluster_scaler:
            cluster_features = np.array([[
                np.mean([n["lat"]]), np.mean([n["lng"]]),
                n["noise"], 5, n["noise"],
            ] for n in online])
            scaled = _trained_cluster_scaler.transform(cluster_features)
            labels = _trained_cluster_model.fit_predict(scaled)
        else:
            clusters = DBSCAN(eps=0.3, min_samples=1).fit(features)
            labels = clusters.labels_
    except Exception:
        labels = np.zeros(len(online))

    hotspots = []
    for i, n in enumerate(online):
        predicted = forecast_node(n["id"])
        risk = "Low"
        if n["noise"] > 85:
            risk = "High"
        elif n["noise"] > 70:
            risk = "Medium"

        hotspots.append({
            "zone": n["label"],
            "lat": n["lat"],
            "lng": n["lng"],
            "risk": risk,
            "db": n["noise"],
            "predicted_db": predicted or n["noise"],
            "change": f"{'+' if (predicted or n['noise']) >= n['noise'] else '-'}{abs(round((predicted or n['noise']) - n['noise']))} dB",
            "cluster": int(labels[i]),
        })

    hotspots.sort(key=lambda h: h["db"], reverse=True)
    return hotspots


def _fallback_hotspots(nodes):
    return [
        {
            "zone": n["label"], "lat": n["lat"], "lng": n["lng"],
            "risk": "High" if n["noise"] > 80 else "Medium" if n["noise"] > 65 else "Low",
            "db": n["noise"], "predicted_db": n["noise"],
            "change": "+0 dB", "cluster": 0,
        }
        for n in nodes if n["status"] != "offline"
    ]


def compute_health_score(node):
    if node["status"] == "offline":
        return 0

    noise = node.get("noise", 0)
    battery = node.get("battery", 100)
    threshold = node.get("threshold", 70)

    noise_score = max(0, 100 - max(0, noise - threshold) * 2.5)
    battery_score = battery
    status_score = 100 if node["status"] == "online" else 50 if node["status"] == "warning" else 0

    history = list(_node_history.get(node["id"], []))
    stability_score = 100
    if len(history) >= 5:
        std = np.std(history[-5:])
        stability_score = max(0, 100 - std * 5)

    overall = round(noise_score * 0.3 + battery_score * 0.3 + status_score * 0.25 + stability_score * 0.15)
    return max(0, min(100, overall))


def compute_scores(nodes):
    scores = [compute_health_score(n) for n in nodes]
    avg = round(np.mean(scores)) if scores else 0
    return {
        "overall": avg,
        "nodes": {n["id"]: compute_health_score(n) for n in nodes},
        "counts": {
            "good": sum(1 for s in scores if s >= 80),
            "fair": sum(1 for s in scores if 50 <= s < 80),
            "poor": sum(1 for s in scores if s < 50),
        },
    }


def generate_hourly_pattern(base_noise=70):
    pattern = []
    for h in range(24):
        val = base_noise + (_hourly_patterns[h] - 50) * 0.6
        val += np.random.uniform(-5, 5)
        pattern.append({"hour": f"{h:02d}", "noise": round(max(30, min(100, val)), 1)})
    return pattern


def compute_peak_hours(nodes):
    online = [n for n in nodes if n["status"] != "offline" and n["noise"] > 0]
    peak_db = max((n["noise"] for n in online), default=70)
    peak_hour = max(
        range(24), key=lambda h: sum(
            n["noise"] * max(0, 1 - 0.05 * abs(h - 17) + 0.02 * (12 - abs(h - 12)))
            for n in online
        )
    )
    return peak_db, peak_hour


def get_forecast_points(nodes):
    points = []
    for n in nodes:
        if n["status"] == "offline":
            continue
        pred = forecast_node(n["id"], horizon_minutes=30)
        points.append({
            "lat": n["lat"],
            "lng": n["lng"],
            "db": pred or n["noise"],
            "label": f"{n['label']} (forecast)",
        })
    return points


NOISE_SOURCE_CENTROIDS = {
    "Traffic":      {"low": 0.25, "mid_low": 0.45, "mid_high": 0.20, "high": 0.10},
    "Construction": {"low": 0.40, "mid_low": 0.35, "mid_high": 0.15, "high": 0.10},
    "Industrial":   {"low": 0.50, "mid_low": 0.25, "mid_high": 0.15, "high": 0.10},
    "People / Crowd": {"low": 0.05, "mid_low": 0.20, "mid_high": 0.50, "high": 0.25},
    "Nature / Wind":  {"low": 0.10, "mid_low": 0.15, "mid_high": 0.30, "high": 0.45},
}

NOISE_SOURCE_LABELS = ["Traffic", "Construction", "Industrial", "People / Crowd", "Nature / Wind"]


def _infer_spectral_bands(node):
    db = node.get("noise", 60)
    label = node.get("label", "").lower()
    threshold = node.get("threshold", 70)

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

    centroid = NOISE_SOURCE_CENTROIDS[base].copy()

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


def classify_noise_source(node):
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

    for src_name, centroid in NOISE_SOURCE_CENTROIDS.items():
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


def classify_node_noise_source(node_id, nodes):
    for n in nodes:
        if n["id"] == node_id:
            return classify_noise_source(n)
    return {"source": "Unknown", "confidence": 0, "bands": {}}


def classify_all_noise_sources(nodes):
    return [
        {"node_id": n["id"], "zone": n["label"], **classify_noise_source(n)}
        for n in nodes if n["status"] != "offline"
    ]


def get_history_stats():
    total = sum(len(q) for q in _node_history.values())
    return {
        "total_readings": total,
        "nodes_tracked": len(_node_history),
        "per_node": {nid: len(q) for nid, q in _node_history.items()},
    }
