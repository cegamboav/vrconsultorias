import { Link, NavLink, useNavigate } from "react-router-dom";
import VrLogo from "../../components/brand/VrLogo";
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
        <div className="app-sidebar-header flex flex-col gap-1 px-4 py-4">
          <VrLogo variant="crm" linkTo="/" className="origin-left scale-[0.92]" />
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            CRM Referidos
          </p>
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

        <div className="sidebar-footer space-y-2">
          <Link
            to="/"
            className="flex w-full items-center justify-center rounded-lg border border-slate-700/80 px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          >
            Sitio VR Consultorías
          </Link>
          <button type="button" className="sidebar-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
