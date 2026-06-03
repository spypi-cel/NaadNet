import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Radio, Mail, Lock, User, Eye, EyeOff, UserPlus } from "lucide-react";
import { useApp } from "../context";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useApp();
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !email || !password) { setError("Fill in all fields"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError("");
    try {
      await register(name, email, password);
      nav("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
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
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Register for monitoring access</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error"><UserPlus size={14} />{error}</div>}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="auth-input-wrap">
              <User size={15} className="auth-input-icon" />
              <input className="form-input auth-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="auth-input-wrap">
              <Mail size={15} className="auth-input-icon" />
              <input className="form-input auth-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="auth-input-wrap">
              <Lock size={15} className="auth-input-icon" />
              <input className="form-input auth-input" type={showPwd ? "text" : "password"} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="auth-pwd-toggle" onClick={() => setShowPwd((s) => !s)}>{showPwd ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="auth-input-wrap">
              <Lock size={15} className="auth-input-icon" />
              <input className="form-input auth-input" type={showPwd ? "text" : "password"} placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create Account"}
          </button>
        </form>

        <p className="auth-footer-text">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
