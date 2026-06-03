import os
import smtplib
import ssl
import threading
from email.message import EmailMessage
from datetime import datetime

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "admin@naadnet.io")

_throttle = {}
_THROTTLE_MAX = 100


def _should_send(node_id: str, severity: str, cooldown_s: int = 300) -> bool:
    key = f"{node_id}:{severity}"
    now = datetime.now().timestamp()
    if key in _throttle:
        if now - _throttle[key] < cooldown_s:
            return False
    _throttle[key] = now
    if len(_throttle) > _THROTTLE_MAX:
        cutoff = now - 3600
        for k in list(_throttle):
            if _throttle[k] < cutoff:
                del _throttle[k]
    return True


def send_email_alert(subject: str, body: str):
    if not SMTP_HOST or not SMTP_USER:
        return
    msg = EmailMessage()
    msg["Subject"] = f"[NaadNet] {subject}"
    msg["From"] = SMTP_USER
    msg["To"] = ALERT_EMAIL
    msg.set_content(body)
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls(context=ctx)
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        print(f"[Notif] Email failed: {e}")


def notify_alert(severity: str, message: str, node_id: str, noise: float, threshold: int):
    if severity not in ("warning", "critical"):
        return
    if not _should_send(node_id, severity):
        return
    body = (
        f"Alert: {severity.upper()}\n"
        f"Node: {node_id}\n"
        f"Message: {message}\n"
        f"Noise: {noise} dB (threshold: {threshold} dB)\n"
        f"Time: {datetime.now().isoformat()}"
    )
    threading.Thread(target=send_email_alert, args=(f"{severity.upper()} — {message}", body), daemon=True).start()
