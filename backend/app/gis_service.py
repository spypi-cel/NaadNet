import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel


def _point_in_polygon(lng, lat, boundary):
    n = len(boundary)
    inside = False
    j = n - 1
    for i in range(n):
        yi, xi = boundary[i]
        yj, xj = boundary[j]
        if ((xi > lat) != (xj > lat)) and (lng < (yj - yi) * (lat - yi) / (xj - xi) + yi):
            inside = not inside
        j = i
    return inside


def interpolate_heatmap(nodes, resolution=30):
    online = [n for n in nodes if n["status"] != "offline"]
    if len(online) < 2:
        return _fallback_heatmap(nodes)

    lats = np.array([n["lat"] for n in online])
    lngs = np.array([n["lng"] for n in online])
    noise = np.array([n["noise"] for n in online])

    X = np.column_stack([lats, lngs])
    y = noise

    kernel = RBF(length_scale=0.05, length_scale_bounds=(0.01, 0.5)) + WhiteKernel(noise_level=5)
    gp = GaussianProcessRegressor(kernel=kernel, alpha=1.0, n_restarts_optimizer=2, random_state=42)

    try:
        gp.fit(X, y)
    except Exception:
        return _fallback_heatmap(nodes)

    lat_min, lat_max = lats.min() - 0.02, lats.max() + 0.02
    lng_min, lng_max = lngs.min() - 0.02, lngs.max() + 0.02
    lat_grid = np.linspace(lat_min, lat_max, resolution)
    lng_grid = np.linspace(lng_min, lng_max, resolution)
    LL, LG = np.meshgrid(lat_grid, lng_grid)
    grid_points = np.column_stack([LL.ravel(), LG.ravel()])

    try:
        predictions, std = gp.predict(grid_points, return_std=True)
    except Exception:
        predictions = np.full(len(grid_points), np.mean(y))
        std = np.full(len(grid_points), 5.0)

    predictions = np.clip(predictions, 30, 100)

    return [
        {
            "lat": round(float(grid_points[i, 0]), 5),
            "lng": round(float(grid_points[i, 1]), 5),
            "db": round(float(predictions[i]), 1),
            "uncertainty": round(float(std[i]), 1) if isinstance(std[i], (np.floating, float)) else 5.0,
        }
        for i in range(len(grid_points))
    ]


def _fallback_heatmap(nodes):
    points = []
    for n in nodes:
        if n["status"] == "offline":
            continue
        for dlat in np.arange(-0.02, 0.025, 0.01):
            for dlng in np.arange(-0.02, 0.025, 0.01):
                dist = np.sqrt(dlat**2 + dlng**2)
                decay = max(0.3, 1.0 - dist * 20)
                points.append({
                    "lat": round(n["lat"] + dlat, 5),
                    "lng": round(n["lng"] + dlng, 5),
                    "db": round(n["noise"] * decay, 1),
                    "uncertainty": 5.0,
                })
    return points


def check_geofence(point_lat, point_lng, zones):
    for zone in zones:
        if _point_in_polygon(point_lng, point_lat, zone["boundary"]):
            return {
                "in_zone": True,
                "zone_name": zone.get("name", "Unknown"),
                "zone_type": zone.get("type", "general"),
            }
    return {"in_zone": False, "zone_name": None, "zone_type": None}


GEOFENCE_ZONES = [
    {
        "name": "Hitech City Core",
        "type": "commercial",
        "boundary": [
            [78.470, 17.375], [78.500, 17.375], [78.500, 17.395],
            [78.470, 17.395],
        ],
    },
    {
        "name": "Residential Zone A",
        "type": "residential",
        "boundary": [
            [78.340, 17.430], [78.360, 17.430], [78.360, 17.450],
            [78.340, 17.450],
        ],
    },
    {
        "name": "Industrial Corridor",
        "type": "industrial",
        "boundary": [
            [78.460, 17.410], [78.490, 17.410], [78.490, 17.435],
            [78.460, 17.435],
        ],
    },
]


def analyze_risk_zones(nodes):
    risk_zones = []
    for n in nodes:
        if n["status"] == "offline":
            continue
        noise = n["noise"]
        if noise > 80:
            risk = "HIGH"
            radius = min(800, 300 + (noise - 80) * 20)
        elif noise > 65:
            risk = "MEDIUM"
            radius = min(500, 200 + (noise - 65) * 15)
        else:
            continue

        risk_zones.append({
            "lat": n["lat"],
            "lng": n["lng"],
            "risk": risk,
            "radius": radius,
            "noise": noise,
            "label": n["label"],
        })

    risk_zones.sort(key=lambda z: z["noise"], reverse=True)
    return risk_zones


def compute_noise_radiation(node):
    noise = node.get("noise", 0)
    if noise < 40:
        radius = 50
    elif noise < 60:
        radius = 150
    elif noise < 80:
        radius = 300
    else:
        radius = 500

    return {
        "lat": node["lat"],
        "lng": node["lng"],
        "radius": radius,
        "noise": noise,
        "label": node.get("label", ""),
    }
