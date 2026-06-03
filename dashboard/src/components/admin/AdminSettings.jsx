import { useState } from "react";
import { Save, Wifi, Bell, Shield, Database } from "lucide-react";

const STORAGE_KEY = "naadnet_admin_settings";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const DEFAULTS = {
  mqttBroker:    "mqtt://localhost:1883",
  mqttTopic:     "naadnet/nodes/#",
  noiseThreshold: "70",
  alertEmail:    "admin@naadnet.io",
  sampleRate:    "1000",
  mapCenter:     "17.385,78.486",
  timezone:      "Asia/Kolkata",
  retentionDays: "30",
};

const TOGGLE_DEFAULTS = {
  emailAlerts:   true,
  smsAlerts:     false,
  autoOta:       true,
  edgeInference: true,
  dataLogging:   true,
  darkMode:      true,
};

export default function AdminSettings() {
  const saved = loadSettings();
  const [form, setForm] = useState(saved?.form || DEFAULTS);
  const [toggles, setToggles] = useState(saved?.toggles || TOGGLE_DEFAULTS);
  const [flash, setFlash] = useState("");

  function handleChange(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleToggle(key) {
    setToggles((t) => ({ ...t, [key]: !t[key] }));
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, toggles }));
    setFlash("Saved!");
    setTimeout(() => setFlash(""), 2500);
  }

  function handleReset() {
    setForm(DEFAULTS);
    setToggles(TOGGLE_DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
    setFlash("Defaults restored");
    setTimeout(() => setFlash(""), 2500);
  }

  return (
    <div className="settings-grid">
      <div className="card">
        <div className="card-header">
          <div className="card-title"><Wifi size={15} /> MQTT & Network</div>
        </div>
        <div className="card-body">
          {[
            { label: "MQTT Broker URL",  key: "mqttBroker",  hint: "Protocol + host + port" },
            { label: "MQTT Topic",       key: "mqttTopic",   hint: "Wildcard # supported" },
            { label: "Sample Rate (ms)", key: "sampleRate",  hint: "Sensor polling interval" },
          ].map(({ label, key, hint }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input className="form-input" value={form[key]} onChange={(e) => handleChange(key, e.target.value)} />
              <span className="form-hint">{hint}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><Shield size={15} /> Thresholds & Alerts</div>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Noise Threshold (dB)</label>
            <input className="form-input" type="number" min="40" max="120" value={form.noiseThreshold}
              onChange={(e) => handleChange("noiseThreshold", e.target.value)} />
            <span className="form-hint">Alerts trigger above this level</span>
          </div>
          <div className="form-group">
            <label className="form-label">Alert Email</label>
            <input className="form-input" type="email" value={form.alertEmail}
              onChange={(e) => handleChange("alertEmail", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Timezone</label>
            <select className="form-select" value={form.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><Bell size={15} /> Notifications</div>
        </div>
        <div className="card-body">
          {[
            { key: "emailAlerts",   label: "Email Alerts",    desc: "Send email on threshold breach" },
            { key: "smsAlerts",     label: "SMS Alerts",      desc: "Send SMS for critical events" },
            { key: "autoOta",       label: "Auto OTA Updates",desc: "Automatically push firmware updates" },
          ].map(({ key, label, desc }) => (
            <div className="toggle-row" key={key}>
              <div>
                <div className="toggle-label">{label}</div>
                <div className="toggle-desc">{desc}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={toggles[key]} onChange={() => handleToggle(key)} />
                <span className="toggle-track" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><Database size={15} /> Data & AI</div>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Data Retention (days)</label>
            <input className="form-input" type="number" min="1" max="365" value={form.retentionDays}
              onChange={(e) => handleChange("retentionDays", e.target.value)} />
            <span className="form-hint">Time-series data retention period</span>
          </div>
          <div className="form-group">
            <label className="form-label">Map Center (lat,lng)</label>
            <input className="form-input" value={form.mapCenter}
              onChange={(e) => handleChange("mapCenter", e.target.value)} />
          </div>
          {[
            { key: "edgeInference", label: "Edge AI Inference", desc: "Run TinyML on ESP32 nodes" },
            { key: "dataLogging",   label: "Data Logging",      desc: "Log all readings to database" },
          ].map(({ key, label, desc }) => (
            <div className="toggle-row" key={key}>
              <div>
                <div className="toggle-label">{label}</div>
                <div className="toggle-desc">{desc}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={toggles[key]} onChange={() => handleToggle(key)} />
                <span className="toggle-track" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={handleReset}>Reset to Defaults</button>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={14} />
          {flash || "Save Configuration"}
        </button>
      </div>
    </div>
  );
}