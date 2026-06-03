import { useState, useRef, useCallback, useEffect } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap
} from "react-leaflet";
import L from "leaflet";
import { Search, MapPin, Plus, Trash2, Navigation, Cpu } from "lucide-react";
import { getNodes, createNode, deleteNode } from "../../services/api";

// ── Fix default Leaflet marker icons ──────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pendingIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const nodeIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

// ── Map click handler (must live inside MapContainer) ─────────
function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ── FlyTo controller (must live inside MapContainer) ──────────
function FlyToController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 15, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
}

const FALLBACK_NODES = [
  { id: "HTC-01", label: "Hitech City",   lat: 17.3850, lng: 78.4860, status: "online"  },
  { id: "KKP-02", label: "Kukatpally",    lat: 17.4401, lng: 78.3489, status: "online"  },
  { id: "BNH-03", label: "Banjara Hills", lat: 17.3616, lng: 78.4747, status: "warning" },
  { id: "SEC-04", label: "Secunderabad",  lat: 17.4239, lng: 78.4738, status: "online"  },
];

export default function AdminMapManager() {
  const [nodes, setNodes]           = useState(FALLBACK_NODES);
  const [pending, setPending]       = useState(null);
  const [flyTarget, setFlyTarget]   = useState(null);
  const [search, setSearch]         = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [searchErr, setSearchErr]   = useState("");
  const [newNodeForm, setNewNodeForm] = useState({ id: "", label: "" });
  const [pinMode, setPinMode]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [apiErr, setApiErr]         = useState("");

  // Load nodes from backend on mount
  useEffect(() => {
    getNodes()
      .then((r) => setNodes(r.data))
      .catch(() => {}); // fallback to FALLBACK_NODES
  }, []);

  // ── Geocode via Nominatim ──────────────────────────────────
  async function handleSearch(e) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setSearchErr("");
    setSearchResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=5`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      if (data.length === 0) setSearchErr("No results found.");
      setSearchResults(data);
    } catch {
      setSearchErr("Search failed. Check your connection.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r) {
    const target = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    setFlyTarget(target);
    setPending(target);
    setSearchResults([]);
    setSearch(r.display_name.split(",")[0]);
    setPinMode(false);
  }

  const handleMapClick = useCallback((latlng) => {
    if (!pinMode) return;
    setPending({ lat: latlng.lat, lng: latlng.lng });
    setPinMode(false);
  }, [pinMode]);

  // ── Add node ───────────────────────────────────────────────
  async function confirmNode() {
    if (!pending || !newNodeForm.id.trim() || !newNodeForm.label.trim()) return;
    setSaving(true);
    setApiErr("");
    const payload = {
      id: newNodeForm.id.trim(),
      label: newNodeForm.label.trim(),
      lat: pending.lat,
      lng: pending.lng,
      status: "online",
    };
    try {
      const res = await createNode(payload);
      setNodes((n) => [...n, res.data]);
    } catch (err) {
      // If backend returns 409 (duplicate) or is offline, add locally
      if (!err.response || err.response.status !== 409) {
        setNodes((n) => [...n, { ...payload, noise: 0, battery: 100, firmware: "v2.3.1", threshold: 70 }]);
      } else {
        setApiErr(`Node ID "${payload.id}" already exists.`);
        setSaving(false);
        return;
      }
    }
    setPending(null);
    setNewNodeForm({ id: "", label: "" });
    setSaving(false);
  }

  // ── Remove node ────────────────────────────────────────────
  async function removeNode(id) {
    try {
      await deleteNode(id);
    } catch {
      // remove locally even if backend is offline
    }
    setNodes((n) => n.filter((x) => x.id !== id));
  }

  function flyToNode(node) {
    setFlyTarget({ lat: node.lat, lng: node.lng });
  }

  return (
    <div className="admin-map-layout">
      {/* ── Left panel ── */}
      <div className="admin-map-panel">

        {/* Search */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title"><Search size={14} /> Search Location</div>
          </div>
          <div className="card-body">
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                placeholder="Search city, area, address…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchResults([]); }}
              />
              <button className="btn btn-primary" type="submit" disabled={searching}>
                {searching ? "…" : <Search size={14} />}
              </button>
            </form>
            {searchErr && <div className="admin-search-err">{searchErr}</div>}
            {searchResults.length > 0 && (
              <div className="admin-search-results">
                {searchResults.map((r) => (
                  <div key={r.place_id} className="admin-search-item" onClick={() => selectResult(r)}>
                    <MapPin size={12} style={{ flexShrink: 0, color: "var(--accent)" }} />
                    <span>{r.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Place Node */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title"><Plus size={14} /> Place Node</div>
            {pinMode && (
              <span className="card-badge" style={{ background: "rgba(234,179,8,0.15)", color: "var(--yellow)", borderColor: "rgba(234,179,8,0.3)" }}>
                Click map to pin
              </span>
            )}
          </div>
          <div className="card-body">
            <button
              className={"btn " + (pinMode ? "btn-primary" : "btn-ghost")}
              style={{ width: "100%", marginBottom: 12, justifyContent: "center" }}
              onClick={() => { setPinMode((p) => !p); setPending(null); }}
            >
              <MapPin size={14} />
              {pinMode ? "Cancel — click map to place" : "Click Map to Place Pin"}
            </button>

            {pending && (
              <div className="admin-pending-box">
                <div className="admin-pending-coords">
                  📍 {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)}
                </div>
                {apiErr && <div className="admin-search-err" style={{ marginBottom: 8 }}>{apiErr}</div>}
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Node ID</label>
                  <input className="form-input" placeholder="e.g. NEW-07" value={newNodeForm.id}
                    onChange={(e) => setNewNodeForm((f) => ({ ...f, id: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Location Label</label>
                  <input className="form-input" placeholder="e.g. Gachibowli" value={newNodeForm.label}
                    onChange={(e) => setNewNodeForm((f) => ({ ...f, label: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={confirmNode}
                    disabled={saving || !newNodeForm.id.trim() || !newNodeForm.label.trim()}
                  >
                    <Plus size={13} /> {saving ? "Adding…" : "Add Node"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setPending(null); setApiErr(""); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Deployed Nodes list */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Cpu size={14} /> Deployed Nodes</div>
            <span className="card-badge">{nodes.length}</span>
          </div>
          <div className="card-body" style={{ padding: "8px 12px" }}>
            <div className="node-list">
              {nodes.map((n) => (
                <div key={n.id} className="node-card">
                  <div className={`node-indicator ${n.status || "online"}`} />
                  <div className="node-info">
                    <div className="node-id">{n.id}</div>
                    <div className="node-location">{n.label}</div>
                  </div>
                  <button className="admin-icon-btn" title="Fly to node" onClick={() => flyToNode(n)}>
                    <Navigation size={13} />
                  </button>
                  <button className="admin-icon-btn danger" title="Remove node" onClick={() => removeNode(n.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="admin-map-container">
        <MapContainer
          center={[17.4, 78.47]}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
          />
          <ClickHandler onMapClick={handleMapClick} />
          {flyTarget && <FlyToController target={flyTarget} />}

          {nodes.map((n) => (
            <Marker key={n.id} position={[n.lat, n.lng]} icon={nodeIcon}>
              <Popup>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.id}</div>
                <div style={{ fontSize: 12, color: "#555" }}>{n.label}</div>
                <div style={{ fontSize: 11, marginTop: 4, color: n.status === "online" ? "#16a34a" : "#d97706" }}>
                  ● {n.status || "online"}
                </div>
                {n.noise > 0 && (
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{n.noise} dB</div>
                )}
              </Popup>
            </Marker>
          ))}

          {pending && (
            <Marker position={[pending.lat, pending.lng]} icon={pendingIcon}>
              <Popup>
                <div style={{ fontSize: 12, fontWeight: 600 }}>📍 Pending placement</div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {pinMode && (
          <div className="admin-map-overlay-hint">
            🖱 Click anywhere on the map to place a node pin
          </div>
        )}
      </div>
    </div>
  );
}
