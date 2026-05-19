import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LeadForm from "../../features/leads/LeadForm";
import { apiFetch } from "../../lib/apiClient";

function isLeadClosed(status) {
  return status === "CLOSED_SUCCESS" || status === "CLOSED_LOST";
}

export default function EditLeadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError("");
      try {
        const data = await apiFetch(`/api/private/leads/${id}`);
        setLead(data.lead);
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit(payload) {
    setError("");
    setIsSubmitting(true);
    try {
      await apiFetch(`/api/private/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      navigate(`/app/leads/${id}`, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="text-app-muted">Cargando...</p>;
  }
  if (loadError) {
    return <p className="form-error-surface">{loadError}</p>;
  }
  if (!lead) {
    return null;
  }

  if (isLeadClosed(lead.status)) {
    return (
      <div className="stack-lg max-w-3xl">
        <div>
          <Link className="lead-detail-back" to={`/app/leads/${id}`}>
            ← Volver al detalle
          </Link>
          <p className="page-eyebrow mt-3">Leads</p>
          <h2 className="page-title">
            Lead #{lead.leadNumber} · {lead.fullName}
          </h2>
          <div className="lead-closed-banner mt-4">
            <p className="font-medium text-slate-100">Lead cerrado · Solo lectura</p>
            <p className="mt-2 text-sm text-slate-400">
              La ficha no se puede editar hasta reactivar el lead por pipeline, cuando el estado lo
              permita.
            </p>
          </div>
          <Button className="mt-6" type="button" onClick={() => navigate(`/app/leads/${id}`)}>
            Ver detalle del lead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg max-w-3xl">
      <div>
        <p className="page-eyebrow">Leads</p>
        <h2 className="page-title">
          Editar lead <span className="text-brand-gold">#{lead.leadNumber}</span>
        </h2>
      </div>
      <Card
        variant="surface"
        title="Datos del lead"
        subtitle="El teléfono es el identificador único y no se puede cambiar desde aquí."
      >
        <LeadForm
          mode="edit"
          initialValues={lead}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/app/leads/${id}`)}
          isSubmitting={isSubmitting}
          error={error}
        />
      </Card>
    </div>
  );
}
