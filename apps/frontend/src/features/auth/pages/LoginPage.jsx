import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import VrLogo from "../../../components/brand/VrLogo";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import PasswordField from "../../../components/ui/PasswordField";
import { VR_PHONE } from "../../../brand/vrContent";
import { getLoginInitialState } from "../loginInitialState.js";
import { useAuth } from "../hooks/useAuth";

const initialLogin = getLoginInitialState();

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(initialLogin.email);
  const [password, setPassword] = useState(initialLogin.password);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname ?? "/app/dashboard";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen-branded flex min-h-screen flex-col lg:flex-row">
      <div className="auth-brand-panel">
        <VrLogo variant="crm" linkTo="/" />
        <h1 className="mt-10 text-2xl font-semibold leading-tight text-white">
          Acceso privado del equipo
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
          Herramienta interna de VR Consultorías. Uso exclusivo del equipo autorizado.
        </p>
        <p className="mt-auto pt-10 text-sm text-slate-500">
          <Link to="/" className="text-brand-gold-light hover:text-brand-gold">
            ← Volver al sitio
          </Link>
        </p>
      </div>

      <div className="auth-form-panel">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <VrLogo variant="crm" linkTo="/" />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg sm:p-8">
            <h2 className="text-xl font-semibold text-white">Acceso privado</h2>
            <p className="mt-1 text-sm text-slate-400">
              Ingrese con su cuenta de acceso autorizada.
            </p>

            <form className="mt-6 stack-md" onSubmit={handleSubmit} autoComplete="on">
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                required
              />
              <PasswordField
                label="Contraseña"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Su contraseña"
                required
              />

              {error ? <p className="form-error">{error}</p> : null}

              <Button disabled={isSubmitting} type="submit" className="w-full">
                {isSubmitting ? "Ingresando..." : "Entrar"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              ¿Necesitas ayuda?{" "}
              <a
                href={`tel:${VR_PHONE.replace(/\D/g, "")}`}
                className="text-brand-gold hover:underline"
              >
                {VR_PHONE}
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
