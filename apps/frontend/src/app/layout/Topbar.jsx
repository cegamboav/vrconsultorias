import { useAuth } from "../../features/auth/hooks/useAuth";

export default function Topbar({ title, onMenuClick }) {
  const { user } = useAuth();

  return (
    <header className="app-topbar">
      <div className="app-topbar-left">
        <button
          type="button"
          className="app-menu-btn"
          aria-label="Abrir menú"
          onClick={onMenuClick}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 7h16M4 12h16M4 17h16"
            />
          </svg>
        </button>
        <h1 className="app-topbar-title">{title}</h1>
      </div>

      <div className="app-topbar-user min-w-0 max-w-[45%] text-right sm:max-w-xs">
        <p className="app-topbar-user-name">{user?.name ?? "Usuario"}</p>
        <p className="app-topbar-user-role">{user?.role ?? ""}</p>
      </div>
    </header>
  );
}
