import { useState, useEffect } from "react";
import {
  Plus, Trash2, Edit2, Check, X, Wifi, WifiOff, AlertTriangle, Download
} from "lucide-react";
import { getNodes, createNode, updateNode, deleteNode } from "../../services/api";

const EMPTY = { id: "", label: "", lat: "", lng: "", status: "online", firmware: "v2.3.1", battery: 100, noise: 0, threshold: 70 };

const STATUS_META = {
  online:  { icon: Wifi,          color: "var(--green)",      bg: "rgba(34,197,94,0.1)"   },
  warning: { icon: AlertTriangle, color: "var(--yellow)",     bg: "rgba(234,179,8,0.1)"   },
  offline: { icon: WifiOff,       color: "var(--text-muted)", bg: "rgba(100,116,139,0.1)" },
};

export default function AdminNodeManager() {
  const [nodes, setNodes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editId, setEditId]     = useState(null);
  const [editBuf, setEditBuf]   = useState({});
  const [showAdd, setShowAdd]   = useState(false);
  const [addForm, setAddForm]   = useState(EMPTY);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    getNodes()
      .then((r) => setNodes(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = nodes.filter((n) => {
    const matchStatus = filter === "all" || n.status === filter;
    const matchSearch = n.id.toLowerCase().includes(search.toLowerCase()) ||
                        n.label.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  function startEdit(node) { setEditId(node.id); setEditBuf({ ...node }); }
  function cancelEdit()    { setEditId(null); }

  async function saveEdit() {
    setSaving(true);
    try {
      await updateNode(editId, editBuf);
    } catch { /* offline — update locally */ }
    setNodes((ns) => ns.map((n) => n.id === editId ? { ...editBuf } : n));
    setEditId(null);
    setSaving(false);
  }

  async function addNode() {
    if (!addForm.id.trim() || !addForm.label.trim()) return;
    setSaving(true);
    const payload = {
      ...addForm,
      lat: parseFloat(addForm.lat) || 17.4,
      lng: parseFloat(addForm.lng) || 78.47,
      battery: parseInt(addForm.battery) || 100,
      threshold: parseInt(addForm.threshold) || 70,
    };
    try {
      const res = await createNode(payload);
      setNodes((ns) => [...ns, res.data]);
    } catch {
      setNodes((ns) => [...ns, payload]);
    }
    setAddForm(EMPTY);
    setShowAdd(false);
    setSaving(false);
  }

  async function removeNode(id) {
    try { await deleteNode(id); } catch { /* offline */ }
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setConfirmDel(null);
  }

  function sendOta(id) {
    alert(`OTA update dispatched to ${id}`);
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading nodes…</div>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="admin-toolbar">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, flexWrap: "wrap" }}>
          <input className="form-input" style={{ maxWidth: 240 }} placeholder="Search nodes…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="admin-filter-group">
            {["all", "online", "warning", "offline"].map((s) => (
              <button key={s} className={"admin-filter-btn" + (filter === s ? " active" : "")} onClick={() => setFilter(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Node
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title"><Plus size={14} /> New Node</div>
            <button className="admin-icon-btn" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                { key: "id",        label: "Node ID",        ph: "e.g. NEW-07" },
                { key: "label",     label: "Location Label", ph: "e.g. Gachibowli" },
                { key: "lat",       label: "Latitude",       ph: "17.4400" },
                { key: "lng",       label: "Longitude",      ph: "78.3800" },
                { key: "firmware",  label: "Firmware",       ph: "v2.3.1" },
                { key: "threshold", label: "dB Threshold",   ph: "70" },
              ].map(({ key, label, ph }) => (
                <div className="form-group" key={key} style={{ marginBottom: 0 }}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" placeholder={ph} value={addForm[key]}
                    onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={addNode} disabled={saving}>
                <Check size={13} /> {saving ? "Adding…" : "Confirm Add"}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Node Registry</div>
          <span className="card-badge">{filtered.length} nodes</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Node ID</th><th>Location</th><th>Status</th>
                <th>Noise</th><th>Threshold</th><th>Battery</th>
                <th>Firmware</th><th>Lat / Lng</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const isEditing = editId === n.id;
                const sm = STATUS_META[n.status] || STATUS_META.offline;
                const StatusIcon = sm.icon;
                return (
                  <tr key={n.id} className={isEditing ? "editing-row" : ""}>
                    <td className="node-id-cell">
                      {isEditing
                        ? <input className="form-input table-input" value={editBuf.id} onChange={(e) => setEditBuf((b) => ({ ...b, id: e.target.value }))} />
                        : <span style={{ fontWeight: 600, color: "var(--accent)" }}>{n.id}</span>}
                    </td>
                    <td>
                      {isEditing
                        ? <input className="form-input table-input" value={editBuf.label} onChange={(e) => setEditBuf((b) => ({ ...b, label: e.target.value }))} />
                        : n.label}
                    </td>
                    <td>
                      {isEditing
                        ? <select className="form-select table-input" value={editBuf.status} onChange={(e) => setEditBuf((b) => ({ ...b, status: e.target.value }))}>
                            <option value="online">Online</option>
                            <option value="warning">Warning</option>
                            <option value="offline">Offline</option>
                          </select>
                        : <span className="admin-status-badge" style={{ background: sm.bg, color: sm.color }}>
                            <StatusIcon size={11} /> {n.status}
                          </span>}
                    </td>
                    <td className={n.noise >= 85 ? "db-danger" : n.noise >= 70 ? "db-loud" : n.noise > 0 ? "db-safe" : ""}>
                      {n.noise > 0 ? `${n.noise} dB` : "—"}
                    </td>
                    <td>
                      {isEditing
                        ? <input className="form-input table-input" type="number" value={editBuf.threshold} onChange={(e) => setEditBuf((b) => ({ ...b, threshold: e.target.value }))} />
                        : `${n.threshold} dB`}
                    </td>
                    <td>
                      <div className="battery-cell">
                        <div className="battery-bar">
                          <div className="battery-fill" style={{ width: `${n.battery}%`, background: n.battery < 20 ? "var(--red)" : n.battery < 50 ? "var(--yellow)" : "var(--green)" }} />
                        </div>
                        <span>{n.battery}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{n.firmware}</td>
                    <td style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {Number(n.lat).toFixed(4)}, {Number(n.lng).toFixed(4)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isEditing ? (
                          <>
                            <button className="admin-icon-btn success" title="Save" onClick={saveEdit} disabled={saving}><Check size={13} /></button>
                            <button className="admin-icon-btn" title="Cancel" onClick={cancelEdit}><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <button className="admin-icon-btn" title="Edit" onClick={() => startEdit(n)}><Edit2 size={13} /></button>
                            <button className="admin-icon-btn" title="OTA Update" onClick={() => sendOta(n.id)}><Download size={13} /></button>
                            <button className="admin-icon-btn danger" title="Remove" onClick={() => setConfirmDel(n.id)}><Trash2 size={13} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDel && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-title">Remove Node</div>
            <p style={{ color: "var(--text-dim)", fontSize: "0.875rem", margin: "12px 0 20px" }}>
              Are you sure you want to remove <strong style={{ color: "var(--red)" }}>{confirmDel}</strong>? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => removeNode(confirmDel)}>
                <Trash2 size={13} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
