import { NavLink, useNavigate } from "react-router-dom";
import { navForRole } from "../config/navigation";
import { useAuth } from "../../features/auth/hooks/useAuth";

export default function Sidebar({ isOpen, onCloseBackdrop }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const nav = navForRole(user?.role);

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
          {nav.map((item) => (
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

        {user ? (
          <div className="app-sidebar-user">
            <p className="app-sidebar-user-name">{user.name}</p>
            <p className="app-sidebar-user-meta">
              {user.role === "ADMIN" ? "Administrador" : "Asesor"} · {user.email}
            </p>
          </div>
        ) : null}

        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
