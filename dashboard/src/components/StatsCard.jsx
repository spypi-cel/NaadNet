export default function StatsCard({ title, value, unit, icon: Icon, iconBg, trend, trendLabel }) {
  const trendClass =
    trend === "up" ? "trend-up" :
    trend === "down" ? "trend-down" : "trend-flat";

  const trendArrow =
    trend === "up" ? "↑" :
    trend === "down" ? "↓" : "→";

  return (
    <div className="stats-card">
      <div className="stats-card-header">
        <div className="stats-card-label">{title}</div>
        {Icon && (
          <div
            className="stats-card-icon"
            style={{ background: iconBg || "rgba(56,189,248,0.12)" }}
          >
            <Icon size={16} color={iconBg ? "white" : "var(--accent)"} />
          </div>
        )}
      </div>

      <div className="stats-card-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>

      {trendLabel && (
        <div className={`stats-card-trend ${trendClass}`}>
          <span>{trendArrow}</span>
          {trendLabel}
        </div>
      )}
    </div>
  );
}
