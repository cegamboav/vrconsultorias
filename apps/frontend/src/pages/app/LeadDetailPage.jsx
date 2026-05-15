import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { useToast } from "../../components/ui/Toast";
import { formatActivityDescription } from "../../features/leads/activityDisplay";
import {
  activityTypeLabel,
  displayLeadSource,
  followUpReasonLabel,
  followUpReasonOptions,
  leadStatusLabel
} from "../../features/leads/labels";
import {
  followUpDueBucket,
  formatDateOnly,
  minFollowUpYmd,
  toLocalYmd
} from "../../features/leads/dateUi";
import { apiFetch } from "../../lib/apiClient";
import { useAuth } from "../../features/auth/hooks/useAuth";

const TIMELINE_PAGE = 5;

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

const allowedNextByStatus = {
  NEW: ["CONTACTED"],
  CONTACTED: ["SCHEDULED", "FOLLOW_UP"],
  SCHEDULED: ["CLOSED_INVESTED", "CLOSED_NOT_INVESTED", "FOLLOW_UP"],
  FOLLOW_UP: ["CONTACTED", "SCHEDULED", "CLOSED_INVESTED", "CLOSED_NOT_INVESTED"],
  CLOSED_INVESTED: [],
  CLOSED_NOT_INVESTED: ["FOLLOW_UP", "CONTACTED", "SCHEDULED"]
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [agentConfig, setAgentConfig] = useState(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [whatsappError, setWhatsappError] = useState("");

  const [newNote, setNewNote] = useState("");
  const [noteError, setNoteError] = useState("");

  const isMountedRef = useRef(true);
  const [isAdding, setIsAdding] = useState(false);

  const [nextStatus, setNextStatus] = useState("");
  const [followUpDateStr, setFollowUpDateStr] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [statusError, setStatusError] = useState("");
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Flujo de FOLLOW_UP en dos pasos: primero se elige fecha, luego motivo.
  // pendingFollow = { kind: "days"|"date", days?, ymd? } | null
  const [pendingFollow, setPendingFollow] = useState(null);

  const [timelineVisible, setTimelineVisible] = useState(TIMELINE_PAGE);
  const [suggestionLoading, setSuggestionLoading] = useState({});

  const allowedNext = useMemo(() => {
    const current = lead?.status;
    if (!current) return [];
    return allowedNextByStatus[current] ?? [];
  }, [lead?.status]);

  const activities = lead?.activities ?? [];
  const visibleActivities = useMemo(
    () => activities.slice(0, timelineVisible),
    [activities, timelineVisible]
  );
  const canShowMoreTimeline = activities.length > timelineVisible;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const data = await apiFetch(`/api/private/leads/${id}`);
        setLead(data.lead);
        setNextStatus("");
        setCloseReason(data.lead.noInvestmentReason ?? "");
        setPendingFollow(null);
        setTimelineVisible(TIMELINE_PAGE);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (nextStatus === "CLOSED_NOT_INVESTED") {
      setCloseReason((prev) => prev || (lead?.noInvestmentReason ?? ""));
    }
  }, [nextStatus, lead?.noInvestmentReason]);

  useEffect(() => {
    async function loadAgentConfig() {
      try {
        const data = await apiFetch("/api/private/follow-up-agent/config");
        setAgentConfig(data);
      } catch {
        // non-critical — silently ignore
      }
    }
    loadAgentConfig();
  }, []);

  useEffect(() => {
    if (nextStatus === "FOLLOW_UP") {
      setFollowUpDateStr(minFollowUpYmd());
      setPendingFollow(null);
      return;
    }
    if (lead?.status === "FOLLOW_UP" && lead.nextActionDate) {
      setFollowUpDateStr(toLocalYmd(lead.nextActionDate));
    } else {
      setFollowUpDateStr("");
    }
  }, [nextStatus, lead?.status, lead?.nextActionDate, lead?.id]);

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

  function startPendingByDays(days) {
    if (isChangingStatus) return;
    setStatusError("");
    setPendingFollow({ kind: "days", days });
  }

  function startPendingByDate() {
    if (isChangingStatus) return;
    if (!followUpDateStr) {
      setStatusError("Selecciona una fecha.");
      return;
    }
    if (followUpDateStr < minFollowUpYmd()) {
      setStatusError("La fecha debe ser al menos dentro de 7 días.");
      return;
    }
    setStatusError("");
    setPendingFollow({ kind: "date", ymd: followUpDateStr });
  }

  async function confirmFollowUpWithReason(reason) {
    if (isChangingStatus || !pendingFollow) return;
    setStatusError("");
    setIsChangingStatus(true);
    try {
      const body = { followUpReason: reason };
      if (pendingFollow.kind === "days") body.days = pendingFollow.days;
      else body.nextActionDate = pendingFollow.ymd;

      const wasFollowUp = lead.status === "FOLLOW_UP";

      const data = await apiFetch(`/api/private/leads/${id}/follow-up-quick`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      setLead(data.lead);
      setPendingFollow(null);
      setNextStatus("");
      setFollowUpDateStr("");

      const reasonLabel = followUpReasonLabel[reason] ?? "Motivo";
      if (wasFollowUp) {
        toast.success(`Seguimiento actualizado · ${reasonLabel}.`);
      } else {
        toast.success(`Lead enviado a seguimiento · ${reasonLabel}.`);
        navigate("/app/dashboard");
      }
    } catch (err) {
      setStatusError(err.message);
      toast.error(err.message);
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function handleSendWhatsApp() {
    setIsSendingWhatsApp(true);
    setWhatsappError("");
    try {
      await apiFetch(`/api/private/leads/${id}/whatsapp/send`, {
        method: "POST",
        body: JSON.stringify({ dryRun: false })
      });
      if (isMountedRef.current) {
        toast.success("WhatsApp enviado correctamente.");
        const data = await apiFetch(`/api/private/leads/${id}`);
        setLead(data.lead);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setWhatsappError(err.message);
        toast.error(err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSendingWhatsApp(false);
      }
    }
  }

  async function handleChangeStatus(e) {
    e.preventDefault();
    setStatusError("");
    if (!nextStatus) {
      setStatusError("Selecciona el siguiente estado.");
      return;
    }

    // FOLLOW_UP nunca debe guardarse desde el botón "Actualizar estado":
    // siempre pasa por el flujo de fecha + motivo (auto-guardado).
    if (nextStatus === "FOLLOW_UP") {
      setStatusError("Selecciona una fecha y luego el motivo para enviar a seguimiento.");
      return;
    }

    if (nextStatus === "CLOSED_NOT_INVESTED") {
      const reason = closeReason.trim();
      if (!reason) {
        setStatusError("Indica el motivo de no inversión.");
        return;
      }
    }

    setIsChangingStatus(true);
    try {
      const body = { status: nextStatus };
      if (nextStatus === "CLOSED_NOT_INVESTED") {
        body.noInvestmentReason = closeReason.trim();
      }

      const data = await apiFetch(`/api/private/leads/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setLead(data.lead);
      setNextStatus("");
      setCloseReason(data.lead.noInvestmentReason ?? "");
      toast.success(`Estado actualizado a "${leadStatusLabel[nextStatus] ?? nextStatus}".`);
      navigate("/app/dashboard");
    } catch (err) {
      setStatusError(err.message);
      toast.error(err.message);
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function handleSuggestion(activityId, status, sentText) {
    setSuggestionLoading((prev) => ({ ...prev, [activityId]: true }));
    try {
      await apiFetch(`/api/private/leads/${id}/activities/${activityId}/suggestion`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(sentText ? { sentText } : {}) }),
      });
      const data = await apiFetch(`/api/private/leads/${id}`);
      if (isMountedRef.current) setLead(data.lead);
    } catch (err) {
      if (isMountedRef.current) toast.error(err.message);
    } finally {
      if (isMountedRef.current) setSuggestionLoading((prev) => ({ ...prev, [activityId]: false }));
    }
  }

  if (isLoading) return <p className="text-app-muted">Cargando...</p>;
  if (error) return <p className="form-error-surface">{error}</p>;
  if (!lead) return null;

  const followBucket =
    lead.status === "FOLLOW_UP" && lead.nextActionDate
      ? followUpDueBucket(lead.nextActionDate)
      : null;

  const showFollowUpQuick =
    nextStatus === "FOLLOW_UP" || (lead.status === "FOLLOW_UP" && !nextStatus);

  const showStatusSubmit = nextStatus && nextStatus !== "FOLLOW_UP";
  const pendingFollowLabel = pendingFollow
    ? pendingFollow.kind === "days"
      ? `${pendingFollow.days} días`
      : formatDateOnly(pendingFollow.ymd)
    : null;

  const followUpCount = lead.followUpCount ?? 0;
  const showCloseSuggestion = lead.status === "FOLLOW_UP" && followUpCount >= 2;

  return (
    <div className="stack-lg">
      <div>
        <Link className="lead-detail-back" to="/app/leads">
          ← Volver a Leads
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="lead-detail-kicker">Lead #{lead.leadNumber}</p>
            <h2 className="page-title mt-1 max-w-2xl">{lead.fullName}</h2>
            <div className="lead-detail-meta-row">
              <StatusBadge status={lead.status} />
              {lead.status === "FOLLOW_UP" && lead.followUpReason ? (
                <span
                  className="followup-reason-badge"
                  title="Motivo de seguimiento"
                >
                  {followUpReasonLabel[lead.followUpReason] ?? "Motivo"}
                </span>
              ) : null}
              {lead.status === "FOLLOW_UP" && lead.nextActionDate ? (
                <span
                  className={
                    followBucket === "overdue"
                      ? "rounded-md border border-rose-800/60 bg-rose-950/50 px-2 py-1 text-xs font-medium text-rose-200"
                      : followBucket === "today"
                        ? "rounded-md border border-amber-800/50 bg-amber-950/40 px-2 py-1 text-xs font-medium text-amber-100"
                        : "rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-300"
                  }
                >
                  Seguimiento: {formatDateOnly(lead.nextActionDate)}
                  {followBucket === "overdue" ? " · Vencido" : null}
                  {followBucket === "today" ? " · Hoy" : null}
                </span>
              ) : null}
            </div>
          </div>
          <Link to={`/app/leads/${id}/edit`}>
            <Button variant="ghost-surface" type="button">
              Editar datos
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="stack-lg lg:col-span-1">
          <Card variant="surface" title="Datos" subtitle="Información del lead.">
            <div className="stack-md">
              <div>
                <p className="page-label">Teléfono</p>
                <p className="page-value">{lead.phone}</p>
              </div>
              <div>
                <p className="page-label">Email</p>
                <p className="page-value">{lead.email ?? "—"}</p>
              </div>
              <div>
                <p className="page-label">Fuente</p>
                <p className="page-value">{displayLeadSource(lead.source)}</p>
              </div>
              {lead.referredByLead ? (
                <div>
                  <p className="page-label">Referido por (lead)</p>
                  <Link className="table-row-link text-sm" to={`/app/leads/${lead.referredByLead.id}`}>
                    Lead #{lead.referredByLead.leadNumber} · {lead.referredByLead.fullName} ·{" "}
                    {lead.referredByLead.phone}
                  </Link>
                </div>
              ) : null}
              {lead.referredBy ? (
                <div>
                  <p className="page-label">Referido por (texto)</p>
                  <p className="page-value">{lead.referredBy}</p>
                </div>
              ) : null}
              <div>
                <p className="page-label">Estado en pipeline</p>
                <p className="page-value">{leadStatusLabel[lead.status] ?? lead.status}</p>
              </div>
              {lead.status === "FOLLOW_UP" && lead.followUpReason ? (
                <div>
                  <p className="page-label">Motivo de seguimiento</p>
                  <p className="page-value">
                    {followUpReasonLabel[lead.followUpReason] ?? lead.followUpReason}
                  </p>
                </div>
              ) : null}
              {lead.noInvestmentReason ? (
                <div>
                  <p className="page-label">Motivo (no inversión)</p>
                  <p className="page-value">{lead.noInvestmentReason}</p>
                </div>
              ) : null}
              {lead.observations ? (
                <div>
                  <p className="page-label">Observaciones</p>
                  <p className="page-value whitespace-pre-wrap">{lead.observations}</p>
                </div>
              ) : null}
              <div>
                <p className="page-label">Última actividad</p>
                <p className="page-value">{formatDate(lead.lastActivityAt)}</p>
              </div>
              {lead.status === "FOLLOW_UP" && lead.nextActionDate ? (
                <div
                  className={
                    followBucket === "overdue"
                      ? "rounded-lg border border-rose-800/60 bg-rose-950/40 p-3"
                      : followBucket === "today"
                        ? "rounded-lg border border-amber-800/50 bg-amber-950/30 p-3"
                        : "rounded-lg border border-slate-700 bg-slate-950/50 p-3"
                  }
                >
                  <p className="page-label">Próximo seguimiento</p>
                  <p className="mt-1 text-base font-semibold text-slate-100">
                    {formatDateOnly(lead.nextActionDate)}
                  </p>
                  {followBucket === "overdue" ? (
                    <p className="mt-1 text-sm font-medium text-rose-300">Vencido: ya debió contactarse.</p>
                  ) : null}
                  {followBucket === "today" ? (
                    <p className="mt-1 text-sm font-medium text-amber-200">Pendiente para hoy.</p>
                  ) : null}
                  {followBucket === "upcoming" ? (
                    <p className="mt-1 text-sm text-slate-400">Aún dentro del plazo programado.</p>
                  ) : null}
                </div>
              ) : lead.nextActionDate ? (
                <div>
                  <p className="page-label">Próxima acción</p>
                  <p className="page-value">{formatDateOnly(lead.nextActionDate)}</p>
                </div>
              ) : null}
              {lead.status === "FOLLOW_UP" && agentConfig?.enabled && lead.nextActionDate ? (
                <div className="rounded-lg border border-sky-800/50 bg-sky-950/30 p-3">
                  <p className="text-xs font-medium text-sky-200">Agente programado</p>
                  <p className="mt-1 text-sm text-sky-100">
                    Enviará WhatsApp el {formatDateOnly(lead.nextActionDate)}
                    {agentConfig.dryRun ? " (modo simulación)" : ""}.
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card variant="surface" title="Pipeline" subtitle="Avanza el estado del lead.">
            {showCloseSuggestion ? (
              <div className="mb-3 rounded-lg border border-rose-800/50 bg-rose-950/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-200">
                  Sugerencia operativa
                </p>
                <p className="mt-1 text-sm text-rose-100">
                  Este lead ha estado {followUpCount} veces en seguimiento.
                  ¿Desea cerrarlo como No invirtió?
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="ghost-surface"
                    className="!h-9 text-xs"
                    onClick={() => {
                      setPendingFollow(null);
                      setNextStatus("CLOSED_NOT_INVESTED");
                    }}
                  >
                    Cerrar sin invertir
                  </Button>
                </div>
              </div>
            ) : null}
            <form className="stack-md" onSubmit={handleChangeStatus}>
              <label className="form-control">
                <span className="form-label-surface">Siguiente estado</span>
                <select
                  className="input-surface h-11"
                  value={nextStatus}
                  onChange={(event) => {
                    setNextStatus(event.target.value);
                    setPendingFollow(null);
                  }}
                  disabled={allowedNext.length === 0}
                >
                  <option value="">Selecciona…</option>
                  {allowedNext.map((st) => (
                    <option key={st} value={st}>
                      {leadStatusLabel[st] ?? "Estado"}
                    </option>
                  ))}
                </select>
              </label>

              {showFollowUpQuick ? (
                <div className="stack-md rounded-lg border border-amber-700/60 bg-amber-950/30 p-3">
                  {!pendingFollow ? (
                    <>
                      <p className="text-xs font-medium text-amber-200">
                        Paso 1 · Elige cuándo retomar el lead (mínimo 7 días, solo fecha).
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[7, 15, 30, 90].map((d) => (
                          <Button
                            key={d}
                            type="button"
                            variant="ghost-surface"
                            className="!h-9 min-w-[4.5rem] px-2 text-xs"
                            disabled={isChangingStatus}
                            onClick={() => startPendingByDays(d)}
                          >
                            {d} días
                          </Button>
                        ))}
                      </div>
                      <label className="form-control">
                        <span className="form-label-surface">Fecha personalizada</span>
                        <div className="flex flex-wrap items-end gap-2">
                          <input
                            className="input-surface h-11 min-w-[10rem] flex-1"
                            type="date"
                            min={minFollowUpYmd()}
                            value={followUpDateStr}
                            onChange={(event) => setFollowUpDateStr(event.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost-surface"
                            className="!h-9 shrink-0"
                            disabled={isChangingStatus}
                            onClick={startPendingByDate}
                          >
                            Usar fecha
                          </Button>
                        </div>
                      </label>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-amber-200">
                          Paso 2 · Indica el motivo para retomar en {pendingFollowLabel}.
                        </p>
                        <button
                          type="button"
                          className="text-xs text-amber-200 underline-offset-2 hover:underline"
                          onClick={() => setPendingFollow(null)}
                          disabled={isChangingStatus}
                        >
                          Cambiar fecha
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {followUpReasonOptions.map((opt) => (
                          <Button
                            key={opt.value}
                            type="button"
                            variant="ghost-surface"
                            className="!h-10 px-2 text-xs"
                            disabled={isChangingStatus}
                            onClick={() => confirmFollowUpWithReason(opt.value)}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                      {isChangingStatus ? (
                        <p className="text-xs text-amber-200">Guardando…</p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {nextStatus === "CLOSED_NOT_INVESTED" ? (
                <label className="form-control">
                  <span className="form-label-surface">Motivo de no inversión</span>
                  <textarea
                    className="textarea-surface"
                    value={closeReason}
                    onChange={(event) => setCloseReason(event.target.value)}
                    placeholder="Ej. falta de liquidez, timing, etc."
                    rows={3}
                  />
                </label>
              ) : null}

              {lead.status === "FOLLOW_UP" && user?.role === "ADMIN" ? (
                <Button
                  type="button"
                  variant="ghost-surface"
                  disabled={isSendingWhatsApp}
                  onClick={handleSendWhatsApp}
                >
                  {isSendingWhatsApp ? "Enviando…" : "Enviar WhatsApp ahora"}
                </Button>
              ) : null}
              {whatsappError ? <p className="form-error-surface">{whatsappError}</p> : null}

              {statusError ? <p className="form-error-surface">{statusError}</p> : null}

              {showStatusSubmit ? (
                <Button disabled={isChangingStatus || allowedNext.length === 0} type="submit">
                  {isChangingStatus ? "Actualizando…" : "Actualizar estado"}
                </Button>
              ) : null}

              {allowedNext.length === 0 ? (
                <p className="text-app-muted text-xs">No hay más transiciones desde este estado.</p>
              ) : null}
            </form>
          </Card>
        </div>

        <div className="stack-lg lg:col-span-2">
          <Card variant="surface" title="Actividad" subtitle="Notas y bitácora del lead.">
            <form className="stack-md" onSubmit={handleAddNote}>
              <label className="form-control">
                <span className="form-label-surface">Nueva nota</span>
                <textarea
                  className="textarea-surface"
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Escribe una nota para el seguimiento…"
                  rows={4}
                />
              </label>
              {noteError ? <p className="form-error-surface">{noteError}</p> : null}
              <Button disabled={isAdding} type="submit">
                {isAdding ? "Guardando…" : "Guardar nota"}
              </Button>
            </form>
          </Card>

          <div>
            <h3 className="page-heading mb-3">Línea de tiempo</h3>
            <div className="timeline">
              {visibleActivities.map((activity) => {
                if (activity.type === "WHATSAPP_RECEIVED") {
                  const cls = activity.metadata?.classification;
                  const clsBorder =
                    cls === "interested"
                      ? "border-green-700/60 bg-green-950/30"
                      : cls === "objection"
                        ? "border-amber-700/60 bg-amber-950/30"
                        : cls === "question"
                          ? "border-sky-700/60 bg-sky-950/30"
                          : cls === "not_interested"
                            ? "border-slate-600/60 bg-slate-900/40"
                            : "border-slate-700/50 bg-slate-900/30";
                  const clsLabel =
                    cls === "interested"
                      ? "Interesado"
                      : cls === "objection"
                        ? "Objeción"
                        : cls === "question"
                          ? "Consulta"
                          : cls === "not_interested"
                            ? "No interesado"
                            : cls
                              ? cls
                              : null;
                  const hasSuggestion =
                    activity.metadata?.suggestedReply &&
                    activity.metadata?.suggestionStatus === "pending";
                  const isLoading = suggestionLoading[activity.id] ?? false;

                  return (
                    <article key={activity.id} className={`timeline-item rounded-lg border p-3 ${clsBorder}`}>
                      <div className="timeline-meta">
                        <span>
                          <span className="timeline-type">
                            {activityTypeLabel[activity.type] ?? "WhatsApp recibido"}
                          </span>
                          {clsLabel ? (
                            <span className="ml-2 rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-200">
                              {clsLabel}
                            </span>
                          ) : null}
                        </span>
                        <span>{formatDate(activity.createdAt)}</span>
                      </div>
                      {activity.metadata?.text ? (
                        <blockquote className="mt-2 rounded border-l-2 border-slate-500 pl-3 text-sm italic text-slate-300">
                          {activity.metadata.text}
                        </blockquote>
                      ) : (
                        <p className="timeline-title">{activity.description}</p>
                      )}
                      {hasSuggestion ? (
                        <div className="mt-3 rounded-lg border border-sky-800/50 bg-sky-950/20 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                            Respuesta sugerida por IA
                          </p>
                          <p className="mt-1 text-sm text-sky-100">
                            {activity.metadata.suggestedReply}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isLoading}
                              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                              onClick={() => {
                                navigator.clipboard
                                  .writeText(activity.metadata.suggestedReply)
                                  .then(() => toast.success("Copiado al portapapeles."))
                                  .catch(() => toast.error("No se pudo copiar al portapapeles."));
                              }}
                            >
                              Copiar
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              className="rounded-md border border-green-700/60 bg-green-950/40 px-3 py-1 text-xs text-green-200 hover:bg-green-900/40 disabled:opacity-50"
                              onClick={() =>
                                handleSuggestion(
                                  activity.id,
                                  "sent",
                                  activity.metadata.suggestedReply
                                )
                              }
                            >
                              {isLoading ? "Guardando…" : "Marcar como enviada"}
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              className="rounded-md border border-slate-600 bg-slate-800/60 px-3 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                              onClick={() => handleSuggestion(activity.id, "discarded")}
                            >
                              Descartar
                            </button>
                          </div>
                        </div>
                      ) : activity.metadata?.suggestionStatus === "sent" ? (
                        <p className="mt-2 text-xs text-green-400">Respuesta enviada.</p>
                      ) : activity.metadata?.suggestionStatus === "discarded" ? (
                        <p className="mt-2 text-xs text-slate-500">Sugerencia descartada.</p>
                      ) : null}
                    </article>
                  );
                }

                return (
                  <article key={activity.id} className="timeline-item">
                    <div className="timeline-meta">
                      <span>
                        <span className="timeline-type">
                          {activityTypeLabel[activity.type] ?? "Actividad"}
                        </span>
                        {activity.user?.name ? ` · ${activity.user.name}` : ""}
                      </span>
                      <span>{formatDate(activity.createdAt)}</span>
                    </div>
                    <p className="timeline-title">{formatActivityDescription(activity)}</p>
                  </article>
                );
              })}
              {activities.length === 0 ? (
                <p className="text-app-muted">Sin actividades aún.</p>
              ) : null}
              {canShowMoreTimeline ? (
                <Button
                  type="button"
                  variant="ghost-surface"
                  className="mt-2"
                  onClick={() => setTimelineVisible((n) => n + TIMELINE_PAGE)}
                >
                  Ver más
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
