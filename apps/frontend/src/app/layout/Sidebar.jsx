import { NavLink, useNavigate } from "react-router-dom";
import { APP_NAV } from "../config/navigation";
import { useAuth } from "../../features/auth/hooks/useAuth";

export default function Sidebar({ isOpen, onCloseBackdrop }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={onCloseBackdrop}
        />
      ) : null}

      <aside
        className={`app-sidebar ${isOpen ? "" : "app-sidebar--closed"}`}
        aria-label="Navegación principal"
      >
        <div className="app-sidebar-header">
          <div className="min-w-0">
            <p className="app-sidebar-brand">VR Consultorías</p>
            <p className="app-sidebar-tagline">Plataforma</p>
          </div>
        </div>

        <nav className="app-sidebar-nav">
          {APP_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
