"""
Notification service — creates alerts when thresholds are breached.
"""
from datetime import datetime
from typing import Optional

# Import lazily to avoid circular imports
def notify_alert(severity: str, message: str, node_id: str, noise: float, threshold: float):
    """Create an alert entry when a node breaches its threshold."""
    try:
        from backend import database
        meta = f"{node_id} · {datetime.now().strftime('%H:%M')}"
        database.create_alert(severity, message, node_id, meta)
        database.create_log(severity, "system", message, node_id)
    except Exception as e:
        print(f"[Notifications] Failed to create alert: {e}")
