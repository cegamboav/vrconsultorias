import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  displayLeadSource,
  followUpReasonLabel
} from "../../features/leads/labels";
import { apiFetch } from "../../lib/apiClient";

const STATUS_PRIORITY = {
  NEW: 1,
  CONTACTED: 2,
  SCHEDULED: 3,
  FOLLOW_UP: 4,
  CLOSED_INVESTED: 5,
  CLOSED_NOT_INVESTED: 6
};

function compareByKey(a, b, key) {
  switch (key) {
    case "leadNumber":
      return (a.leadNumber ?? 0) - (b.leadNumber ?? 0);
    case "fullName":
      return (a.fullName ?? "").localeCompare(b.fullName ?? "", "es", { sensitivity: "base" });
    case "status": {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      return pa - pb;
    }
    case "createdAt":
      return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    case "lastActivityAt":
      return new Date(a.lastActivityAt ?? 0).getTime() - new Date(b.lastActivityAt ?? 0).getTime();
    default:
      return 0;
  }
}

function SortHeader({ label, sortKey, currentKey, currentDir, onSort }) {
  const active = currentKey === sortKey;
  const arrow = active ? (currentDir === "asc" ? "▲" : "▼") : "↕";
  return (
    <th>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide ${
          active ? "text-slate-100" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <span>{label}</span>
        <span className={`text-[10px] ${active ? "opacity-100" : "opacity-50"}`}>{arrow}</span>
      </button>
    </th>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // null = orden operativo (el que llega del backend)
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const data = await apiFetch("/api/private/leads");
        setLeads(data.leads ?? []);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function handleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      // tercer clic en la misma columna → volver al orden operativo del backend
      return { key: null, dir: "asc" };
    });
  }

  const orderedLeads = useMemo(() => {
    if (!sort.key) return leads;
    const arr = [...leads];
    arr.sort((a, b) => {
      const r = compareByKey(a, b, sort.key);
      return sort.dir === "asc" ? r : -r;
    });
    return arr;
  }, [leads, sort]);

  return (
    <div className="stack-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="page-eyebrow">Gestión</p>
          <h2 className="page-title">Leads</h2>
          <p className="page-desc">
            Bandeja operativa: ordenada por prioridad de estado. Toca una columna para ordenar.
          </p>
        </div>
        <Link to="/app/leads/new">
          <Button>Nuevo lead</Button>
        </Link>
      </div>

      {isLoading ? <p className="text-app-muted">Cargando...</p> : null}
      {error ? <p className="form-error-surface">{error}</p> : null}

      <div className="table">
        <table>
          <thead>
            <tr>
              <SortHeader
                label="Lead #"
                sortKey="leadNumber"
                currentKey={sort.key}
                currentDir={sort.dir}
                onSort={handleSort}
              />
              <SortHeader
                label="Nombre"
                sortKey="fullName"
                currentKey={sort.key}
                currentDir={sort.dir}
                onSort={handleSort}
              />
              <th>Teléfono</th>
              <th>Fuente</th>
              <SortHeader
                label="Estado"
                sortKey="status"
                currentKey={sort.key}
                currentDir={sort.dir}
                onSort={handleSort}
              />
              <SortHeader
                label="Creación"
                sortKey="createdAt"
                currentKey={sort.key}
                currentDir={sort.dir}
                onSort={handleSort}
              />
              <SortHeader
                label="Última actividad"
                sortKey="lastActivityAt"
                currentKey={sort.key}
                currentDir={sort.dir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {orderedLeads.map((lead) => {
              const count = lead.followUpCount ?? 0;
              return (
                <tr key={lead.id}>
                  <td>
                    <Link className="table-row-link" to={`/app/leads/${lead.id}`}>
                      #{lead.leadNumber}
                    </Link>
                  </td>
                  <td className="font-medium text-slate-200">{lead.fullName}</td>
                  <td className="text-slate-400">{lead.phone}</td>
                  <td className="text-slate-400">{displayLeadSource(lead.source)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={lead.status} />
                      {lead.status === "FOLLOW_UP" && lead.followUpReason ? (
                        <span
                          className="followup-reason-badge"
                          title="Motivo de seguimiento"
                        >
                          {followUpReasonLabel[lead.followUpReason] ?? "Motivo"}
                        </span>
                      ) : null}
                      {count > 0 ? (
                        <span
                          className="followup-count-chip"
                          title={`El lead ha entrado a seguimiento ${count} ${
                            count === 1 ? "vez" : "veces"
                          }`}
                        >
                          Seg. ×{count}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="text-slate-400">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="text-slate-400">
                    {lead.lastActivityAt
                      ? new Date(lead.lastActivityAt).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              );
            })}
            {orderedLeads.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7} className="text-app-muted">
                  No hay leads todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

