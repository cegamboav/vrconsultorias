import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAuth } from "../features/auth/hooks/useAuth";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main className="page-bg min-h-screen p-6">
      <section className="mx-auto max-w-5xl stack-lg">
        <header className="page-header">
          <div>
            <p className="eyebrow">CRM Referidos</p>
            <h1 className="heading">Dashboard</h1>
            <p className="muted">
              Sesion activa como {user?.name} ({user?.role})
            </p>
          </div>
          <Button variant="ghost" onClick={logout}>
            Cerrar sesion
          </Button>
        </header>

        <Card
          title="Estado inicial"
          subtitle="Autenticacion funcional con JWT, rutas protegidas y roles basicos."
        >
          <p className="muted">
            Proximo paso: agregar CRUD de leads protegido por rol.
          </p>
        </Card>
      </section>
    </main>
  );
}
