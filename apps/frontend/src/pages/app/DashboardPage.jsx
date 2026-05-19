import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ServiceCategoryBadge from "../../components/ui/ServiceCategoryBadge";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatActivityDescription } from "../../features/leads/activityDisplay";
import { activityTypeLabel, followUpReasonLabel } from "../../features/leads/labels";
import { followUpDueBucket, formatDateOnly } from "../../features/leads/dateUi";
import { apiFetch } from "../../lib/apiClient";

const ACTIVITY_PAGE = 5;
const CLOSED_PAGE = 5;

function MiniLeadLink({ lead, showNextActionDate = true }) {
  const bucket =
    lead.status === "FOLLOW_UP" && lead.nextActionDate
      ? followUpDueBucket(lead.nextActionDate)
      : null;

  const scheduleClass =
    bucket === "overdue"
      ? "dashboard-lead-schedule dashboard-lead-schedule--overdue"
      : bucket === "today"
        ? "dashboard-lead-schedule dashboard-lead-schedule--today"
        : bucket === "upcoming"
          ? "dashboard-lead-schedule dashboard-lead-schedule--upcoming"
          : "dashboard-lead-meta";

  const scheduleLabel =
    bucket === "overdue"
      ? "Vencido · "
      : bucket === "today"
        ? "Hoy · "
        : "";

  const reasonText =
    lead.status === "FOLLOW_UP" && lead.followUpReason
      ? followUpReasonLabel[lead.followUpReason] ?? null
      : null;

  return (
    <Link to={`/app/leads/${lead.id}`} className="dashboard-lead-card">
      <div className="dashboard-lead-name flex flex-wrap items-center gap-1.5">
        <span className="dashboard-lead-id">#{lead.leadNumber}</span>
        <span className="dashboard-lead-sep">·</span>
        <span className="dashboard-lead-fullname">{lead.fullName}</span>
        {lead.serviceCategory ? (
          <ServiceCategoryBadge category={lead.serviceCategory} />
        ) : null}
      </div>
      {lead.phone ? <div className="dashboard-lead-meta">{lead.phone}</div> : null}
      {reasonText ? (
        <div className="followup-reason-text" title="Motivo de seguimiento">
          Motivo: {reasonText}
        </div>
      ) : null}
      {lead.nextActionDate && showNextActionDate ? (
        <div className={scheduleClass}>
          {scheduleLabel}
          Próximo seguimiento: {formatDateOnly(lead.nextActionDate)}
        </div>
      ) : null}
    </Link>
  );
}

const pipelineConfig = [
  { key: "nuevo", title: "Nuevo", subtitle: "Por contactar", field: "nuevo" },
  { key: "contactado", title: "Contactado", subtitle: "En conversación", field: "contactado" },
  { key: "agendado", title: "Agendado", subtitle: "Reunión programada", field: "agendado" },
  { key: "seguimiento", title: "Seguimiento", subtitle: "Próxima acción", field: "seguimiento" }
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activityVisible, setActivityVisible] = useState(ACTIVITY_PAGE);
  const [closedVisible, setClosedVisible] = useState(CLOSED_PAGE);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch("/api/private/dashboard");
        setData(res);
        setActivityVisible(ACTIVITY_PAGE);
        setClosedVisible(CLOSED_PAGE);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activities = data?.recentActivities ?? [];
  const visibleActivities = useMemo(
    () => activities.slice(0, activityVisible),
    [activities, activityVisible]
  );
  const canShowMoreActivities = activities.length > activityVisible;

  const closedLeads = data?.recentClosedLeads ?? [];
  const visibleClosedLeads = useMemo(
    () => closedLeads.slice(0, closedVisible),
    [closedLeads, closedVisible]
  );
  const canShowMoreClosed = closedLeads.length > closedVisible;

  if (loading) {
    return <p className="text-app-muted">Cargando panel…</p>;
  }
  if (error) {
    return <p className="form-error-surface">{error}</p>;
  }
  if (!data) {
    return null;
  }

  const p = data.pipeline ?? {};
  const pipelineFollowUpCount = (p.seguimiento ?? []).length;

  return (
    <div className="stack-lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-eyebrow">VR Consultorías</p>
          <h2 className="page-title">Panel operativo</h2>
          <p className="page-desc">
            Seguimientos urgentes primero; el pipeline muestra solo el trabajo activo. Los
            cierres aparecen abajo en una sección dedicada.
          </p>
        </div>
        <Link to="/app/leads/new">
          <Button>Nuevo lead</Button>
        </Link>
      </div>

      <section className="dashboard-priority" aria-label="Seguimientos urgentes">
        <div className="dashboard-priority-head">
          <div>
            <h3 className="dashboard-priority-title">Seguimientos urgentes</h3>
            <p className="dashboard-priority-sub">
              Solo leads en seguimiento con fecha vencida o para hoy (no listamos futuros aquí).
              En pipeline hay{" "}
              <strong className="text-app-strong">{pipelineFollowUpCount}</strong> en estado
              seguimiento.
            </p>
          </div>
        </div>
        <div className="dashboard-priority-single">
          {(data.followUpUrgent ?? []).map((lead) => (
            <div key={lead.id} className="dashboard-priority-row">
              <div className="min-w-0 flex-1">
                <MiniLeadLink lead={lead} />
              </div>
              <StatusBadge status={lead.status} />
            </div>
          ))}
          {(data.followUpUrgent ?? []).length === 0 ? (
            <p className="text-app-muted text-sm">Nada urgente en este momento.</p>
          ) : null}
        </div>
      </section>

      <section aria-label="Vista columnas pipeline">
        <h3 className="dashboard-section-title mb-3">Pipeline</h3>
        <div className="dashboard-pipeline">
          {pipelineConfig.map((col) => (
            <div key={col.key} className="dashboard-column">
              <div className="dashboard-column-head">
                <p className="dashboard-column-title">{col.title}</p>
                <p className="dashboard-column-sub">{col.subtitle}</p>
              </div>
              <div className="dashboard-column-body">
                {(p[col.field] ?? []).map((lead) => (
                  <MiniLeadLink
                    key={lead.id}
                    lead={lead}
                    showNextActionDate={col.field === "seguimiento"}
                  />
                ))}
                {(p[col.field] ?? []).length === 0 ? (
                  <p className="text-app-muted text-xs">Sin leads.</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="surface" title="Cierres recientes" subtitle="Últimos cierres registrados.">
          <div className="stack-md">
            {visibleClosedLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <MiniLeadLink lead={lead} showNextActionDate={false} />
                </div>
                <StatusBadge status={lead.status} />
              </div>
            ))}
            {closedLeads.length === 0 ? (
              <p className="text-app-muted text-sm">Sin cierres recientes.</p>
            ) : null}
            {canShowMoreClosed ? (
              <Button
                type="button"
                variant="ghost-surface"
                className="w-full sm:w-auto"
                onClick={() => setClosedVisible((n) => n + CLOSED_PAGE)}
              >
                Ver más
              </Button>
            ) : null}
          </div>
        </Card>

        <Card variant="surface" title="Actividad reciente" subtitle="Últimas acciones en el CRM.">
          <div className="stack-md">
            {visibleActivities.map((row) => (
              <div key={row.id} className="dashboard-activity-item">
                <div className="dashboard-activity-meta">
                  <span className="dashboard-activity-actor">
                    {row.user?.name ?? "Sistema"}
                  </span>
                  <span className="dashboard-activity-sep"> · </span>
                  <span className="dashboard-activity-type">
                    {activityTypeLabel[row.type] ?? "Actividad"}
                  </span>
                  <span className="dashboard-activity-sep"> · </span>
                  {new Date(row.createdAt).toLocaleString("es-CR", {
                    dateStyle: "short",
                    timeStyle: "short"
                  })}
                </div>
                {row.lead ? (
                  <Link
                    className="dashboard-activity-lead-link mt-1 inline-block"
                    to={`/app/leads/${row.lead.id}`}
                  >
                    <span className="dashboard-lead-id">#{row.lead.leadNumber}</span>
                    <span className="dashboard-lead-sep"> · </span>
                    {row.lead.fullName}
                  </Link>
                ) : null}
                <p className="dashboard-activity-text">{formatActivityDescription(row)}</p>
              </div>
            ))}
            {activities.length === 0 ? (
              <p className="text-app-muted text-sm">Sin actividad registrada.</p>
            ) : null}
            {activities.length > 0 && canShowMoreActivities ? (
              <Button
                type="button"
                variant="ghost-surface"
                className="w-full sm:w-auto"
                onClick={() => setActivityVisible((n) => n + ACTIVITY_PAGE)}
              >
                Ver más
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
