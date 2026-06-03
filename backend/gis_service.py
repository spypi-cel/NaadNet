"""
GIS service layer — interpolation, risk zones, noise radiation, geofencing.
"""
import math
from typing import List, Dict, Any

# ── Geofence zones ────────────────────────────────────────────
GEOFENCE_ZONES = [
    {"name": "Hitech City IT Corridor", "type": "commercial",  "boundary": {"lat": 17.385, "lng": 78.486, "radius_km": 2.0}},
    {"name": "Secunderabad Cantonment", "type": "residential", "boundary": {"lat": 17.424, "lng": 78.474, "radius_km": 1.5}},
    {"name": "Banjara Hills Quiet Zone","type": "residential", "boundary": {"lat": 17.362, "lng": 78.475, "radius_km": 1.0}},
    {"name": "LB Nagar Industrial",     "type": "industrial",  "boundary": {"lat": 17.385, "lng": 78.550, "radius_km": 1.8}},
]


def _haversine(lat1, lng1, lat2, lng2) -> float:
    """Distance in km between two lat/lng points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def interpolate_heatmap(nodes: List[Dict], resolution: int = 30) -> List[Dict]:
    """Simple IDW interpolation over a bounding grid."""
    active = [n for n in nodes if n["status"] != "offline" and n["noise"] > 0]
    if not active:
        return []

    lats = [n["lat"] for n in active]
    lngs = [n["lng"] for n in active]
    lat_min, lat_max = min(lats) - 0.05, max(lats) + 0.05
    lng_min, lng_max = min(lngs) - 0.05, max(lngs) + 0.05

    points = []
    for i in range(resolution):
        for j in range(resolution):
            lat = lat_min + (lat_max - lat_min) * i / resolution
            lng = lng_min + (lng_max - lng_min) * j / resolution
            weights, values = [], []
            for n in active:
                d = _haversine(lat, lng, n["lat"], n["lng"])
                w = 1.0 / max(d, 0.001) ** 2
                weights.append(w)
                values.append(n["noise"])
            total_w = sum(weights)
            db = sum(v * w for v, w in zip(values, weights)) / total_w if total_w > 0 else 0
            points.append({"lat": round(lat, 5), "lng": round(lng, 5), "db": round(db, 1)})
    return points


def analyze_risk_zones(nodes: List[Dict]) -> List[Dict]:
    zones = []
    for n in nodes:
        if n["status"] == "offline":
            continue
        noise = n["noise"]
        risk = "critical" if noise >= 85 else "high" if noise >= 75 else "medium" if noise >= 65 else "low"
        zones.append({
            "node_id": n["id"],
            "label": n["label"],
            "lat": n["lat"],
            "lng": n["lng"],
            "noise": noise,
            "risk_level": risk,
            "radius_m": int(noise * 4),
        })
    return zones


def compute_noise_radiation(node: Dict) -> Dict:
    """Estimate noise radiation rings around a node."""
    noise = node.get("noise", 0)
    rings = []
    for db_drop in [0, 6, 12, 18]:
        effective_db = max(0, noise - db_drop)
        radius_m = int(10 ** ((noise - db_drop) / 20) * 0.5) if effective_db > 0 else 0
        rings.append({"db": effective_db, "radius_m": radius_m})
    return {
        "node_id": node["id"],
        "label": node["label"],
        "lat": node["lat"],
        "lng": node["lng"],
        "source_db": noise,
        "rings": rings,
    }


def check_geofence(lat: float, lng: float, zones: List[Dict]) -> Dict:
    results = []
    for z in zones:
        b = z["boundary"]
        dist = _haversine(lat, lng, b["lat"], b["lng"])
        inside = dist <= b["radius_km"]
        results.append({
            "zone": z["name"],
            "type": z["type"],
            "inside": inside,
            "distance_km": round(dist, 3),
        })
    inside_zones = [r for r in results if r["inside"]]
    return {
        "lat": lat, "lng": lng,
        "inside_zones": inside_zones,
        "zone_count": len(inside_zones),
        "all_zones": results,
    }
