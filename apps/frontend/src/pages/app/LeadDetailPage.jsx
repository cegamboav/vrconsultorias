import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { apiFetch } from "../../lib/apiClient";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

const activityLabels = {
  LEAD_CREATED: "Lead creado",
  STATUS_CHANGED: "Cambio de estado",
  NOTE_ADDED: "Nota",
  WHATSAPP_SENT: "WhatsApp",
  REMINDER_CREATED: "Recordatorio",
  MEETING_SCHEDULED: "Reunión",
  LEAD_REACTIVATED: "Reactivación",
  LEAD_CLOSED: "Cierre"
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [newNote, setNewNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [nextStatus, setNextStatus] = useState("");
  const [statusError, setStatusError] = useState("");
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const allowedNext = useMemo(() => {
    const current = lead?.status;
    if (!current) return [];
    const map = {
      NEW: ["CONTACTED"],
      CONTACTED: ["RESPONDED"],
      RESPONDED: ["SCHEDULED"],
      SCHEDULED: ["CLOSED"],
      CLOSED: []
    };
    return map[current] ?? [];
  }, [lead?.status]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const data = await apiFetch(`/api/private/leads/${id}`);
        setLead(data.lead);
        setNextStatus("");
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleAddNote(e) {
    e.preventDefault();
    setNoteError("");
    const description = newNote.trim();
    if (!description) {
      setNoteError("Escribe una nota.");
      return;
    }

    setIsAdding(true);
    try {
      await apiFetch(`/api/private/leads/${id}/activities`, {
        method: "POST",
        body: JSON.stringify({
          type: "NOTE_ADDED",
          description
        })
      });
      const data = await apiFetch(`/api/private/leads/${id}`);
      setLead(data.lead);
      setNewNote("");
    } catch (err) {
      setNoteError(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleChangeStatus(e) {
    e.preventDefault();
    setStatusError("");
    if (!nextStatus) {
      setStatusError("Selecciona el siguiente estado.");
      return;
    }

    setIsChangingStatus(true);
    try {
      const body =
        nextStatus === "CLOSED"
          ? { status: nextStatus, closeSubstatus: "INVESTED" }
          : { status: nextStatus };

      const data = await apiFetch(`/api/private/leads/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setLead(data.lead);
      setNextStatus("");
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setIsChangingStatus(false);
    }
  }

  if (isLoading) return <p className="text-app-muted">Cargando...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!lead) return null;

  return (
    <div className="stack-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-app-muted text-sm">
            <Link className="table-row-link" to="/app/leads">
              Leads
            </Link>{" "}
            / #{lead.leadNumber}
          </p>
          <h2 className="truncate text-xl font-semibold text-gray-900">
            {lead.fullName}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 stack-lg">
          <Card
            variant="surface"
            title="Datos"
            subtitle="Información básica del lead."
          >
            <div className="stack-md">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Teléfono
                </p>
                <p className="text-sm text-gray-900">{lead.phone}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Email
                </p>
                <p className="text-sm text-gray-900">{lead.email ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Fuente
                </p>
                <p className="text-sm text-gray-900">{lead.source}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Última actividad
                </p>
                <p className="text-sm text-gray-900">
                  {formatDate(lead.lastActivityAt)}
                </p>
              </div>
            </div>
          </Card>

          <Card
            variant="surface"
            title="Acciones"
            subtitle="Avanza el lead en el pipeline."
          >
            <form className="stack-md" onSubmit={handleChangeStatus}>
              <div className="form-control">
                <span className="text-sm text-gray-700">Siguiente estado</span>
                <select
                  className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  disabled={allowedNext.length === 0}
                >
                  <option value="">Selecciona…</option>
                  {allowedNext.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              {statusError ? <p className="form-error">{statusError}</p> : null}
              <Button disabled={isChangingStatus || allowedNext.length === 0} type="submit">
                {isChangingStatus ? "Actualizando..." : "Cambiar estado"}
              </Button>
              {allowedNext.length === 0 ? (
                <p className="text-app-muted text-xs">
                  No hay más transiciones disponibles.
                </p>
              ) : null}
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2 stack-lg">
          <Card
            variant="surface"
            title="Timeline"
            subtitle="Actividades y notas registradas."
          >
            <form className="stack-md" onSubmit={handleAddNote}>
              <div className="form-control">
                <span className="text-sm text-gray-700">Agregar nota</span>
                <textarea
                  className="min-h-[96px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escribe una nota para el seguimiento..."
                />
              </div>
              {noteError ? <p className="form-error">{noteError}</p> : null}
              <div className="flex gap-3">
                <Button disabled={isAdding} type="submit">
                  {isAdding ? "Guardando..." : "Guardar nota"}
                </Button>
              </div>
            </form>
          </Card>

          <div className="timeline">
            {lead.activities?.map((activity) => (
              <article key={activity.id} className="timeline-item">
                <div className="timeline-meta">
                  <span>
                    {activityLabels[activity.type] ?? activity.type}
                    {activity.user?.name ? ` · ${activity.user.name}` : ""}
                  </span>
                  <span>{formatDate(activity.createdAt)}</span>
                </div>
                <p className="timeline-title">{activity.description}</p>
              </article>
            ))}
            {lead.activities?.length === 0 ? (
              <p className="text-app-muted">Sin actividades aún.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

