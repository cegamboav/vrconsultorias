import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  followUpReasonLabel,
  leadSourceLabel,
  leadStatusLabel
} from "../../features/leads/labels";
import {
  RANGE_KEYS,
  RANGE_OPTIONS,
  computeRange,
  describeRange
} from "../../features/reports/dateRanges";
import { apiFetch } from "../../lib/apiClient";

const STATUS_ORDER = [
  "NEW",
  "CONTACTED",
  "SCHEDULED",
  "FOLLOW_UP",
  "CLOSED_INVESTED",
  "CLOSED_NOT_INVESTED"
];

const SOURCE_ORDER = ["REFERIDO", "DIRECTO", "PAGINA_WEB", "REDES_SOCIALES", "OTRO"];

const FOLLOW_UP_REASON_ORDER = [
  "NO_RESPONSE",
  "NO_MONEY",
  "CALL_LATER",
  "THINKING",
  "BUSY",
  "OTHER"
];

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="report-kpi">
      <p className="report-kpi-label">{label}</p>
      <p className="report-kpi-value">{value}</p>
      {hint ? <p className="report-kpi-hint">{hint}</p> : null}
    </div>
  );
}

function BarRow({ label, count, total, accent }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="report-bar-row">
      <div className="report-bar-meta">
        <span className="report-bar-label">{label}</span>
        <span className="report-bar-count">{count}</span>
      </div>
      <div className="report-bar-track">
        <div
          className={`report-bar-fill ${accent ?? "report-bar-fill--default"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PipelineMini({ status, count }) {
  return (
    <div className="report-pipeline-cell">
      <StatusBadge status={status} />
      <p className="report-pipeline-count">{count}</p>
      <p className="report-pipeline-label">{leadStatusLabel[status] ?? status}</p>
    </div>
  );
}

function RangeChips({ value, onChange, disabled }) {
  return (
    <div className="report-range-chips" role="tablist" aria-label="Rango temporal">
      {RANGE_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.key)}
            className={
              active ? "report-range-chip report-range-chip--active" : "report-range-chip"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState(RANGE_KEYS.LAST_30);

  const range = useMemo(() => computeRange(rangeKey), [rangeKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (range.from) params.set("from", range.from.toISOString());
        if (range.to) params.set("to", range.to.toISOString());
        const qs = params.toString();
        const res = await apiFetch(`/api/private/reports${qs ? `?${qs}` : ""}`);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range.from?.getTime(), range.to?.getTime()]);

  const sourceMax = useMemo(() => {
    if (!data?.leadsBySource) return 0;
    return Math.max(0, ...Object.values(data.leadsBySource));
  }, [data]);

  const reasonMax = useMemo(() => {
    if (!data?.followUpReasons) return 0;
    return Math.max(0, ...Object.values(data.followUpReasons));
  }, [data]);

  const rangeDescription = describeRange(rangeKey, range);

  return (
    <div className="stack-lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-eyebrow">Inteligencia operativa</p>
          <h2 className="page-title">Reportes</h2>
          <p className="page-desc">
            Visión rápida del estado comercial: conversión, fuentes, motivos de seguimiento y
            referidores que generan valor.
          </p>
        </div>
      </div>

      <div className="report-range-bar">
        <RangeChips value={rangeKey} onChange={setRangeKey} disabled={loading} />
        <p className="report-range-summary">
          Mostrando datos de: <span className="report-range-summary-value">{rangeDescription}</span>
        </p>
      </div>

      {error ? <p className="form-error-surface">{error}</p> : null}
      {loading && !data ? <p className="text-app-muted">Cargando reportes…</p> : null}

      {data ? (
        <>
          {/* Conversión general */}
          <section aria-label="Conversión general">
            <h3 className="dashboard-section-title mb-3">Conversión general</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Total leads (creados)" value={data.conversion.totalLeads ?? 0} />
              <KpiCard label="Invirtieron (cerrados)" value={data.conversion.totalInvested ?? 0} />
              <KpiCard
                label="No invirtieron (cerrados)"
                value={data.conversion.totalNotInvested ?? 0}
              />
              <KpiCard
                label="Tasa de conversión"
                value={formatPercent(data.conversion.conversionRate)}
                hint={
                  data.conversion.conversionOverClosedRate
                    ? `Sobre cerrados: ${formatPercent(data.conversion.conversionOverClosedRate)}`
                    : null
                }
              />
            </div>
          </section>

          {/* Pipeline actual */}
          <section aria-label="Estado actual del pipeline">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="dashboard-section-title">Estado actual del pipeline</h3>
              <p className="text-xs text-slate-400">Foto en vivo (no depende del rango)</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {STATUS_ORDER.map((st) => (
                <PipelineMini key={st} status={st} count={data.pipelineCurrent[st] ?? 0} />
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Leads por fuente */}
            <Card
              variant="surface"
              title="Leads por fuente"
              subtitle="De dónde llegan los leads creados en el período."
            >
              <div className="stack-md">
                {SOURCE_ORDER.map((src) => (
                  <BarRow
                    key={src}
                    label={leadSourceLabel[src] ?? src}
                    count={data.leadsBySource[src] ?? 0}
                    total={sourceMax}
                    accent="report-bar-fill--source"
                  />
                ))}
                {(data.conversion.totalLeads ?? 0) === 0 ? (
                  <p className="text-app-muted text-sm">Sin leads creados en este rango.</p>
                ) : null}
              </div>
            </Card>

            {/* Motivos de FOLLOW_UP */}
            <Card
              variant="surface"
              title="Motivos de seguimiento"
              subtitle="Por qué los leads entraron a seguimiento en el período."
            >
              <div className="stack-md">
                {FOLLOW_UP_REASON_ORDER.map((reason) => (
                  <BarRow
                    key={reason}
                    label={followUpReasonLabel[reason] ?? reason}
                    count={data.followUpReasons[reason] ?? 0}
                    total={reasonMax}
                    accent="report-bar-fill--reason"
                  />
                ))}
                {reasonMax === 0 ? (
                  <p className="text-app-muted text-sm">
                    Sin transiciones a seguimiento en este rango.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>

          {/* Top referidores */}
          <Card
            variant="surface"
            title="Top referidores"
            subtitle="Quiénes traen más leads y conversión en el período."
          >
            {(data.topReferrers ?? []).length === 0 ? (
              <p className="text-app-muted text-sm">Sin referidos en este rango.</p>
            ) : (
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>Referidor</th>
                      <th>Teléfono</th>
                      <th className="text-right">Referidos</th>
                      <th className="text-right">Invirtieron</th>
                      <th className="text-right">Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topReferrers.map((row) => {
                      const rate =
                        row.referredCount > 0
                          ? Math.round((row.investedCount / row.referredCount) * 1000) / 10
                          : 0;
                      return (
                        <tr key={row.referrerId}>
                          <td className="font-medium text-slate-200">
                            <Link
                              className="table-row-link"
                              to={`/app/leads/${row.referrerId}`}
                            >
                              #{row.leadNumber} · {row.fullName}
                            </Link>
                          </td>
                          <td className="text-slate-400">{row.phone}</td>
                          <td className="text-right text-slate-200">{row.referredCount}</td>
                          <td className="text-right text-slate-200">{row.investedCount}</td>
                          <td className="text-right text-slate-300">{formatPercent(rate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
