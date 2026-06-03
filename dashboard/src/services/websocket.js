let ws = null;
const listeners = new Set();
let reconnectDelay = 2000;
const MAX_DELAY = 30000;

export function connectWS() {
  if (ws && ws.readyState < 2) return ws;

  // Connect via env var or default localhost
  const url = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
  ws = new WebSocket(url);

  ws.onmessage = (event) => {
    reconnectDelay = 2000;
    try {
      const data = JSON.parse(event.data);
      listeners.forEach((cb) => cb(data));
    } catch {}
  };

  ws.onerror = () => {};

  ws.onclose = () => {
    ws = null;
    setTimeout(connectWS, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  };

  return ws;
}

export function onMessage(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function disconnectWS() {
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}
