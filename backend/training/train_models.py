import os
import sys
import json
import pickle
import numpy as np
from datetime import datetime
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from training.dataset_loader import generate_synthetic_dataset, save_dataset, load_dataset, prepare_training_data

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
MODELS_DIR = os.path.join(DATA_DIR, "models")
HISTORY_DIR = os.path.join(DATA_DIR, "history")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)


def train_anomaly_detector(X):
    print(f"Training IsolationForest on {X.shape[0]} samples...")
    model = IsolationForest(
        n_estimators=200,
        contamination=0.1,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)
    return model


def train_forecast_model(X, y):
    print(f"Training forecast model on {X.shape[0]} samples...")
    n_samples, n_windows, n_features = X.shape
    X_flat = X.reshape(n_samples, n_windows * n_features)
    model = LinearRegression()
    model.fit(X_flat, y)
    scaler = StandardScaler()
    scaler.fit(X_flat)
    return model, scaler


def train_clustering_model(records):
    nodes = {}
    for r in records:
        nid = r["node_id"]
        if nid not in nodes:
            nodes[nid] = {"readings": [], "lats": [], "lngs": []}
        nodes[nid]["readings"].append(r["noise"])
        nodes[nid]["lats"].append(r["lat"])
        nodes[nid]["lngs"].append(r["lng"])

    features = []
    labels = []
    for nid, data in nodes.items():
        if len(data["readings"]) < 5:
            continue
        features.append([
            np.mean(data["lats"]),
            np.mean(data["lngs"]),
            np.mean(data["readings"]),
            np.std(data["readings"]),
            np.max(data["readings"]),
        ])
        labels.append(nid)

    X = np.array(features)
    if len(X) >= 2:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        cluster_model = DBSCAN(eps=1.5, min_samples=1)
        cluster_model.fit(X_scaled)
        print(f"Clustering: {len(set(cluster_model.labels_))} clusters from {len(X)} nodes")
        return cluster_model, scaler, labels

    return None, None, None


def save_model(model, name):
    path = os.path.join(MODELS_DIR, f"{name}.pkl")
    with open(path, "wb") as f:
        pickle.dump(model, f)
    print(f"Saved model: {path}")
    return path


def load_model(name):
    path = os.path.join(MODELS_DIR, f"{name}.pkl")
    if os.path.exists(path):
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


def save_metadata(info):
    path = os.path.join(MODELS_DIR, "training_metadata.json")
    with open(path, "w") as f:
        json.dump(info, f, indent=2)


def load_metadata():
    path = os.path.join(MODELS_DIR, "training_metadata.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {}


def run_full_training(force_generate=False):
    print(f"\n=== NaadNet Model Training Pipeline ===")
    print(f"Started: {datetime.now().isoformat()}")

    history_path = os.path.join(HISTORY_DIR, "noise_history.json")

    if force_generate or not os.path.exists(history_path):
        print("Generating synthetic training dataset...")
        records = generate_synthetic_dataset(nodes=6, days=30, readings_per_hour=4)
        save_dataset(records)
    else:
        records = load_dataset()
        print(f"Loaded {len(records)} existing records")

    X_a, X_f, y_f = prepare_training_data(records)

    if len(X_a) < 10:
        print("Insufficient training data, generating synthetic...")
        records = generate_synthetic_dataset(nodes=6, days=30, readings_per_hour=4)
        save_dataset(records)
        X_a, X_f, y_f = prepare_training_data(records)

    anomaly_model = train_anomaly_detector(X_a)
    save_model(anomaly_model, "anomaly_detector")

    forecast_model, forecast_scaler = train_forecast_model(X_f, y_f)
    save_model(forecast_model, "forecast_model")
    save_model(forecast_scaler, "forecast_scaler")

    cluster_model, cluster_scaler, cluster_labels = train_clustering_model(records)
    if cluster_model is not None:
        save_model(cluster_model, "cluster_model")
        save_model(cluster_scaler, "cluster_scaler")

    metadata = {
        "last_trained": datetime.now().isoformat(),
        "samples_anomaly": int(len(X_a)),
        "samples_forecast": int(len(X_f)),
        "nodes": len(set(r["node_id"] for r in records)),
        "date_range": {
            "start": records[0]["ts"] if records else None,
            "end": records[-1]["ts"] if records else None,
        },
    }
    save_metadata(metadata)

    print(f"Training complete. Models saved to {MODELS_DIR}")
    print(f"Anomaly model: anomaly_detector.pkl ({X_a.shape[0]} samples)")
    print(f"Forecast model: forecast_model.pkl ({X_f.shape[0]} samples)")
    print(f"Metadata: {metadata}")
    print("=== Training Pipeline Complete ===\n")

    return metadata


if __name__ == "__main__":
    run_full_training(force_generate=True)
