/**
 * Estado inicial del formulario de login.
 * En producción siempre devuelve campos vacíos (sin credenciales en el bundle).
 */
export function getLoginInitialState() {
  if (!import.meta.env.DEV) {
    return { email: "", password: "" };
  }

  return {
    email: String(import.meta.env.VITE_DEV_LOGIN_EMAIL ?? "").trim(),
    password: String(import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? "").trim()
  };
}
