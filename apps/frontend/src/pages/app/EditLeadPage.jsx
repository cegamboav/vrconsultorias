import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import LeadForm from "../../features/leads/LeadForm";
import { apiFetch } from "../../lib/apiClient";

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

  return (
    <div className="stack-lg max-w-3xl">
      <div>
        <p className="page-eyebrow">Leads</p>
        <h2 className="page-title">
          Editar lead <span className="text-sky-400">#{lead.leadNumber}</span>
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
