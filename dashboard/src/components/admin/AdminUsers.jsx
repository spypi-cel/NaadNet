import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, X, ShieldCheck, User, Eye, EyeOff } from "lucide-react";
import { getUsers, createUser, updateUser, deleteUser } from "../../services/api";

const ROLE_META = {
  superadmin: { color: "var(--accent)",  bg: "var(--accent-glow)" },
  admin:      { color: "var(--green)",   bg: "rgba(34,197,94,0.1)" },
  viewer:     { color: "var(--text-dim)", bg: "rgba(100,116,139,0.1)" },
};

const EMPTY_USER = { name: "", email: "", role: "viewer" };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_USER);
  const [editId, setEditId] = useState(null);
  const [editBuf, setEditBuf] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);

  function loadUsers() {
    setLoading(true);
    getUsers()
      .then((r) => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(loadUsers, []);

  async function addUser() {
    if (!addForm.name.trim() || !addForm.email.trim()) return;
    try {
      await createUser(addForm);
      setAddForm(EMPTY_USER);
      setShowAdd(false);
      loadUsers();
    } catch {}
  }

  function startEdit(u) { setEditId(u.id); setEditBuf({ ...u }); }

  async function saveEdit() {
    try {
      await updateUser(editId, {
        name: editBuf.name,
        email: editBuf.email,
        role: editBuf.role,
        status: editBuf.status,
      });
      setEditId(null);
      loadUsers();
    } catch {}
  }

  async function deleteUserAction(id) {
    try {
      await deleteUser(id);
      setConfirmDel(null);
      loadUsers();
    } catch {}
  }

  if (loading) {
    return <div className="loading-shimmer" style={{ height: 200, borderRadius: 8 }} />;
  }

  return (
    <div>
      <div className="admin-toolbar">
        <div style={{ fontSize: "0.875rem", color: "var(--text-dim)" }}>
          {users.length} registered users
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add User
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title"><Plus size={14} /> New User</div>
            <button className="admin-icon-btn" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="e.g. Rahul Verma" value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="user@naadnet.io" value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Role</label>
                <select className="form-select" value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="superadmin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={addUser}><Check size={13} /> Create User</button>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title"><User size={14} /> User Accounts</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isEditing = editId === u.id;
                const rm = ROLE_META[u.role] || ROLE_META.viewer;
                return (
                  <tr key={u.id} className={isEditing ? "editing-row" : ""}>
                    <td style={{ fontWeight: 600 }}>
                      {isEditing
                        ? <input className="form-input table-input" value={editBuf.name} onChange={(e) => setEditBuf((b) => ({ ...b, name: e.target.value }))} />
                        : <span style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={13} style={{ color: rm.color }} />{u.name}</span>}
                    </td>
                    <td style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
                      {isEditing
                        ? <input className="form-input table-input" value={editBuf.email} onChange={(e) => setEditBuf((b) => ({ ...b, email: e.target.value }))} />
                        : u.email}
                    </td>
                    <td>
                      {isEditing
                        ? <select className="form-select table-input" value={editBuf.role} onChange={(e) => setEditBuf((b) => ({ ...b, role: e.target.value }))}>
                            <option value="superadmin">Super Admin</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        : <span className="admin-status-badge" style={{ background: rm.bg, color: rm.color }}>{u.role}</span>}
                    </td>
                    <td>
                      {isEditing
                        ? <select className="form-select table-input" value={editBuf.status} onChange={(e) => setEditBuf((b) => ({ ...b, status: e.target.value }))}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        : <span className="admin-status-badge" style={{ background: u.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.1)", color: u.status === "active" ? "var(--green)" : "var(--text-muted)" }}>
                            {u.status}
                          </span>}
                    </td>
                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.lastLogin || "Never"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isEditing ? (
                          <>
                            <button className="admin-icon-btn success" onClick={saveEdit}><Check size={13} /></button>
                            <button className="admin-icon-btn" onClick={() => setEditId(null)}><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <button className="admin-icon-btn" onClick={() => startEdit(u)}><Edit2 size={13} /></button>
                            <button className="admin-icon-btn danger" onClick={() => setConfirmDel(u.id)}><Trash2 size={13} /></button>
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

      {confirmDel && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-title">Remove User</div>
            <p style={{ color: "var(--text-dim)", fontSize: "0.875rem", margin: "12px 0 20px" }}>
              This will permanently delete the user account.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteUserAction(confirmDel)}><Trash2 size={13} /> Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}