import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { apiFetch } from "../../lib/apiClient";

export default function CreateLeadPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("OTHER");
  const [referredBy, setReferredBy] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = await apiFetch("/api/private/leads", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          phone,
          email: email || undefined,
          source,
          referredBy: referredBy || undefined
        })
      });
      navigate(`/app/leads/${data.lead.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="stack-lg max-w-3xl">
      <div>
        <p className="text-app-muted text-sm">Leads</p>
        <h2 className="text-xl font-semibold text-gray-900">Crear lead</h2>
      </div>

      <Card
        variant="surface"
        title="Información básica"
        subtitle="Crea un lead y empieza el seguimiento en el pipeline."
      >
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="form-control">
              <span className="text-sm text-gray-700">Nombre</span>
              <input
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="form-control">
              <span className="text-sm text-gray-700">Teléfono</span>
              <input
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                placeholder="50670000000"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="form-control">
              <span className="text-sm text-gray-700">Email (opcional)</span>
              <input
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="correo@ejemplo.com"
                type="email"
              />
            </div>

            <div className="form-control">
              <span className="text-sm text-gray-700">Fuente</span>
              <select
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={source}
                onChange={(ev) => setSource(ev.target.value)}
              >
                <option value="REFERRAL">Referido</option>
                <option value="DIRECT">Directo</option>
                <option value="ORGANIC">Orgánico</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          </div>

          <div className="form-control">
            <span className="text-sm text-gray-700">Referido por (opcional)</span>
            <input
              className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              value={referredBy}
              onChange={(ev) => setReferredBy(ev.target.value)}
              placeholder="Nombre del referido"
            />
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="flex gap-3">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creando..." : "Crear lead"}
            </Button>
            <Button
              type="button"
              variant="ghost-surface"
              onClick={() => navigate("/app/leads")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

