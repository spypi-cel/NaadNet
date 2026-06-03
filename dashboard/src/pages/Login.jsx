import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Radio, Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import { useApp } from "../context";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError("Fill in all fields"); return; }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="auth-logo">
              <div className="auth-logo-icon"><Radio size={22} color="white" /></div>
              <div><h1>NaadNet</h1><span>Noise Monitor</span></div>
            </div>
          </Link>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your monitoring dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error"><LogIn size={14} />{error}</div>}
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="auth-input-wrap">
              <Mail size={15} className="auth-input-icon" />
              <input className="form-input auth-input" type="email" placeholder="admin@naadnet.io" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="auth-input-wrap">
              <Lock size={15} className="auth-input-icon" />
              <input className="form-input auth-input" type={showPwd ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="auth-pwd-toggle" onClick={() => setShowPwd((s) => !s)}>{showPwd ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </div>
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="auth-footer-text">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <div className="auth-demo-hint">
          Demo: <strong>admin@naadnet.io</strong> / <strong>admin123</strong>
        </div>
      </div>
    </div>
  );
}
