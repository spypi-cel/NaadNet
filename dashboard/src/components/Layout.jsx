import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children, title, subtitle }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title={title} subtitle={subtitle} />
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}
