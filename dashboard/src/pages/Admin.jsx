import { useState } from "react";
import { ShieldCheck, Map, Cpu, Users, FileText, Settings } from "lucide-react";
import Layout from "../components/Layout";
import AdminMapManager from "../components/admin/AdminMapManager";
import AdminNodeManager from "../components/admin/AdminNodeManager";
import AdminUsers from "../components/admin/AdminUsers";
import AdminLogs from "../components/admin/AdminLogs";
import AdminSettings from "../components/admin/AdminSettings";

const TABS = [
  { id: "map",      label: "Map Manager",  icon: Map },
  { id: "nodes",    label: "Node Manager", icon: Cpu },
  { id: "settings", label: "Settings",     icon: Settings },
  { id: "users",    label: "Users",        icon: Users },
  { id: "logs",     label: "System Logs",  icon: FileText },
];

export default function Admin() {
  const [tab, setTab] = useState("map");

  return (
    <Layout title="Admin Panel" subtitle="Node deployment, user management & system control">
      <div className="admin-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={"admin-tab" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === "map"      && <AdminMapManager />}
        {tab === "nodes"    && <AdminNodeManager />}
        {tab === "settings" && <AdminSettings />}
        {tab === "users"    && <AdminUsers />}
        {tab === "logs"     && <AdminLogs />}
      </div>
    </Layout>
  );
}
