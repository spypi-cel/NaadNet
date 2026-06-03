import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

export default function TimelinePlayer({ value, setValue }) {
  const [playing, setPlaying] = useState(false);

  const pad = (n) => String(n).padStart(2, "0");
  const display = `${pad(value)}:00`;

  function step(dir) {
    setValue((v) => {
      const next = Number(v) + dir;
      return Math.max(0, Math.min(24, next));
    });
  }

  return (
    <div className="timeline-player">
      <div className="timeline-header">
        <div className="timeline-time">{display}</div>
        <div className="timeline-controls">
          <button className="timeline-btn" onClick={() => step(-1)} title="Back 1h">
            <SkipBack size={12} />
          </button>
          <button
            className="timeline-btn"
            onClick={() => setPlaying((p) => !p)}
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button className="timeline-btn" onClick={() => step(1)} title="Forward 1h">
            <SkipForward size={12} />
          </button>
        </div>
      </div>

      <input
        type="range"
        className="timeline-slider"
        min="0"
        max="24"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />

      <div className="timeline-labels">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
