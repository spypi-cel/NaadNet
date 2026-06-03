import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, register as apiRegister, getMe } from "./services/api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [nodeCount, setNodeCount]   = useState(6);
  const [alertCount, setAlertCount] = useState(3);
  const [live, setLive]             = useState(false);
  const [user, setUser]             = useState(null);
  const [token, setToken]           = useState(() => localStorage.getItem("naadnet_token"));
  const [authLoading, setAuthLoading] = useState(false); // don't block on startup

  // Restore session from stored token
  useEffect(() => {
    const stored = localStorage.getItem("naadnet_token");
    if (!stored) return;
    setAuthLoading(true);
    getMe()
      .then((r) => setUser(r.data))
      .catch(() => {
        // Token expired or invalid — clear it silently
        localStorage.removeItem("naadnet_token");
        setToken(null);
      })
      .finally(() => setAuthLoading(false));
  }, []); // only on mount

  const login = useCallback(async (email, password) => {
    const res = await apiLogin(email, password);
    localStorage.setItem("naadnet_token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await apiRegister(name, email, password);
    localStorage.setItem("naadnet_token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("naadnet_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AppContext.Provider value={{
      nodeCount, setNodeCount,
      alertCount, setAlertCount,
      live, setLive,
      user, token,
      login, register, logout,
      authLoading,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
