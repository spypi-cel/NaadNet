import SpectrogramBands from "./SpectrogramBands";

function dbClass(db) {
  if (db < 55) return "db-safe";
  if (db < 70) return "db-moderate";
  if (db < 85) return "db-loud";
  return "db-danger";
}

function statusClass(status) {
  if (status === "online")  return "online";
  if (status === "warning") return "warning";
  return "offline";
}

const SOURCE_COLORS = {
  "Traffic":        "#f97316",
  "Construction":   "#eab308",
  "Industrial":     "#ef4444",
  "People / Crowd": "#22c55e",
  "Nature / Wind":  "#3b82f6",
  "Mixed":          "#a855f7",
};

export default function NodeStatus({ node }) {
  const hasTemp = node.temperature != null && !isNaN(node.temperature);
  const hasHum  = node.humidity    != null && !isNaN(node.humidity);

  return (
    <div className="node-card">
      <div className={`node-indicator ${statusClass(node.status)}`} />
      <div className="node-info">
        <div className="node-id">{node.id}</div>
        <div className="node-location">{node.location}</div>

        {(hasTemp || hasHum) && (
          <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: 1, display: "flex", gap: 8 }}>
            {hasTemp && <span>🌡 {node.temperature}°C</span>}
            {hasHum  && <span>💧 {node.humidity}%</span>}
          </div>
        )}

        {node.noise_source && (
          <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
              background: SOURCE_COLORS[node.noise_source] || "#888",
            }} />
            {node.noise_source}
          </div>
        )}

        {node.bands && (
          <div style={{ marginTop: 2 }}>
            <SpectrogramBands bands={node.bands} size="sm" />
          </div>
        )}
      </div>

      <div className={`node-db ${dbClass(node.noise)}`}>
        {node.noise > 0 ? `${node.noise} dB` : "—"}
      </div>
    </div>
  );
}
