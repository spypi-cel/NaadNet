import numpy as np
import json
import os
from datetime import datetime, timedelta
import random

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def generate_synthetic_dataset(nodes=6, days=30, readings_per_hour=2):
    np.random.seed(42)
    random.seed(42)
    records = []

    base_nodes = [
        {"id": "HTC-01", "label": "Hitech City", "lat": 17.3850, "lng": 78.4860, "base": 75, "amp": 15},
        {"id": "KKP-02", "label": "Kukatpally", "lat": 17.4401, "lng": 78.3489, "base": 55, "amp": 12},
        {"id": "BNH-03", "label": "Banjara Hills", "lat": 17.3616, "lng": 78.4747, "base": 65, "amp": 18},
        {"id": "SEC-04", "label": "Secunderabad", "lat": 17.4239, "lng": 78.4738, "base": 80, "amp": 14},
        {"id": "LBN-05", "label": "LB Nagar", "lat": 17.3850, "lng": 78.5500, "base": 48, "amp": 10},
        {"id": "BAL-06", "label": "Balanagar", "lat": 17.4950, "lng": 78.3900, "base": 60, "amp": 16},
    ]

    total_readings = days * 24 * readings_per_hour
    start = datetime(2026, 5, 1)

    for i in range(total_readings):
        ts = start + timedelta(hours=i / readings_per_hour)
        hour = ts.hour
        day_factor = np.sin(2 * np.pi * ts.timetuple().tm_yday / 365) * 3

        diurnal = -np.cos(2 * np.pi * (hour - 14) / 24) * 8
        noise_floor = np.random.exponential(2)

        for node in base_nodes:
            if random.random() < 0.05:
                continue

            spike = 0
            if random.random() < 0.03:
                spike = np.random.uniform(10, 25)

            noise = node["base"] + diurnal * 0.6 + day_factor + noise_floor + spike + np.random.normal(0, 2)
            noise = max(25, min(105, round(noise, 1)))

            battery = max(5, min(100, 100 - (i / total_readings) * random.uniform(10, 40) + np.random.normal(0, 3)))
            battery = round(battery, 1)

            status = "offline" if battery < 5 or random.random() < 0.005 else \
                     "warning" if noise > 85 or battery < 15 else "online"

            records.append({
                "ts": ts.isoformat(),
                "node_id": node["id"],
                "label": node["label"],
                "lat": node["lat"],
                "lng": node["lng"],
                "noise": noise,
                "battery": battery,
                "status": status,
                "hour": hour,
                "day_of_year": ts.timetuple().tm_yday,
            })

    return records


def save_dataset(records, filename="noise_history.json"):
    path = os.path.join(DATA_DIR, "history", filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(records, f, indent=2)
    print(f"Saved {len(records)} records to {path}")
    return path


def load_dataset(filename="noise_history.json"):
    path = os.path.join(DATA_DIR, "history", filename)
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)


def prepare_training_data(records):
    X_anomaly = []
    X_forecast = []
    y_forecast = []
    node_sequences = {}

    for r in records:
        nid = r["node_id"]
        if nid not in node_sequences:
            node_sequences[nid] = []
        node_sequences[nid].append(r["noise"])

        X_anomaly.append([
            r["noise"], r["battery"], r["hour"],
            np.sin(2 * np.pi * r["hour"] / 24),
            np.cos(2 * np.pi * r["hour"] / 24),
        ])

    window = 10
    for nid, seq in node_sequences.items():
        for i in range(window, len(seq)):
            X_forecast.append(seq[i - window:i])
            y_forecast.append(seq[i])

    return (
        np.array(X_anomaly, dtype=np.float32),
        np.array(X_forecast, dtype=np.float32).reshape(-1, window, 1),
        np.array(y_forecast, dtype=np.float32),
    )


if __name__ == "__main__":
    print("Generating synthetic noise pollution dataset...")
    records = generate_synthetic_dataset(nodes=6, days=30, readings_per_hour=4)
    path = save_dataset(records)
    print(f"Done. Dataset: {path}")

    X_a, X_f, y_f = prepare_training_data(records)
    print(f"Anomaly samples: {X_a.shape}")
    print(f"Forecast samples: {X_f.shape}")
    print(f"Forecast targets: {y_f.shape}")
