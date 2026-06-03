export default function SpectrogramBands({ bands = {}, size = "sm" }) {
  const keys = ["low", "mid_low", "mid_high", "high"];
  const labels = ["Low", "Mid-L", "Mid-H", "High"];
  const colors = ["#22c55e", "#eab308", "#f97316", "#ef4444"];
  const h = size === "sm" ? 40 : 80;
  const barW = size === "sm" ? 14 : 28;

  if (!bands || !bands.low) return null;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: h, padding: "4px 0" }}>
      {keys.map((k, i) => {
        const val = bands[k] || 0;
        const pct = Math.min(100, val * 100);
        return (
          <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div
              title={`${labels[i]}: ${(val * 100).toFixed(0)}%`}
              style={{
                width: barW,
                height: Math.max(4, (pct / 100) * h * 0.85),
                background: colors[i],
                borderRadius: "3px 3px 0 0",
                opacity: 0.8,
                transition: "height 0.3s",
              }}
            />
            {size !== "sm" && (
              <span style={{ fontSize: "0.55rem", color: "var(--text-dim)", writingMode: "vertical-lr", textOrientation: "mixed" }}>
                {labels[i]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}