import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";
import LeadForm from "../../features/leads/LeadForm";
import { apiFetch } from "../../lib/apiClient";

export default function CreateLeadPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(payload) {
    setError("");
    setIsSubmitting(true);
    try {
      const data = await apiFetch("/api/private/leads", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast.success(`Lead #${data.lead.leadNumber} · ${data.lead.fullName} creado.`);
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="stack-lg max-w-3xl">
      <div>
        <p className="page-eyebrow">Leads</p>
        <h2 className="page-title">Crear lead</h2>
      </div>
      <Card
        variant="surface"
        title="Información básica"
        subtitle="Crea un lead y empieza el seguimiento en el pipeline."
      >
        <LeadForm
          mode="create"
          initialValues={{}}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/app/leads")}
          isSubmitting={isSubmitting}
          error={error}
        />
      </Card>
    </div>
  );
}
