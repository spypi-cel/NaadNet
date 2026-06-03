import { useState, useEffect } from "react";
import { FileText, RefreshCw, Download } from "lucide-react";
import { getLogs } from "../../services/api";

const LEVEL_META = {
  info:     { color: "var(--accent)",  bg: "rgba(56,189,248,0.08)"  },
  warning:  { color: "var(--yellow)", bg: "rgba(234,179,8,0.08)"   },
  critical: { color: "var(--red)",    bg: "rgba(239,68,68,0.08)"   },
};

export default function AdminLogs() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  function fetchLogs() {
    setLoading(true);
    getLogs()
      .then((r) => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter((l) => {
    const matchLevel  = filter === "all" || l.level === filter;
    const matchSearch = l.action.toLowerCase().includes(search.toLowerCase()) ||
                        l.user.toLowerCase().includes(search.toLowerCase()) ||
                        (l.node || "").toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  function exportCsv() {
    const rows = ["Time,Level,User,Action,Node",
      ...filtered.map((l) => `"${l.time}","${l.level}","${l.user}","${l.action}","${l.node}"`)
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "naadnet_logs.csv";
    a.click();
  }

  return (
    <div>
      <div className="admin-toolbar">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, flexWrap: "wrap" }}>
          <input className="form-input" style={{ maxWidth: 260 }} placeholder="Search logs…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="admin-filter-group">
            {["all", "info", "warning", "critical"].map((l) => (
              <button key={l} className={"admin-filter-btn" + (filter === l ? " active" : "")} onClick={() => setFilter(l)}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={13} /> {loading ? "Loading…" : "Refresh"}
          </button>
          <button className="btn btn-ghost" onClick={exportCsv}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><FileText size={14} /> Activity Log</div>
          <span className="card-badge">{filtered.length} entries</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>Timestamp</th><th>Level</th><th>User / Source</th><th>Action</th><th>Node</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No log entries found</td></tr>
              ) : filtered.map((l) => {
                const lm = LEVEL_META[l.level] || LEVEL_META.info;
                return (
                  <tr key={l.id}>
                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{l.time}</td>
                    <td><span className="admin-status-badge" style={{ background: lm.bg, color: lm.color }}>{l.level}</span></td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{l.user}</td>
                    <td style={{ fontSize: "0.8rem" }}>{l.action}</td>
                    <td style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>{l.node}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
