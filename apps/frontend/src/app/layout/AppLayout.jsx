import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getPageTitle } from "../config/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onCloseBackdrop={() => setSidebarOpen(false)} />

      <div className="app-main-wrap">
        <Topbar title={pageTitle} onMenuClick={() => setSidebarOpen((open) => !open)} />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
