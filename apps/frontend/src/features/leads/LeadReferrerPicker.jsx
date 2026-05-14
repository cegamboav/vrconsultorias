import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient";

export default function LeadReferrerPicker({ excludeLeadId, selected, onSelectedChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const params = new URLSearchParams({ q: q.trim() });
        if (excludeLeadId) params.set("excludeId", excludeLeadId);
        const data = await apiFetch(`/api/private/leads/search?${params}`);
        setResults(data.leads ?? []);
      } catch {
        setResults([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, excludeLeadId]);

  return (
    <div className="form-control">
      <span className="form-label-surface">Lead que refiere (opcional)</span>
      {selected ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
          <span className="text-sm text-slate-200">
            <span className="font-semibold text-sky-400">#{selected.leadNumber}</span> ·{" "}
            {selected.fullName} · <span className="text-slate-500">{selected.phone}</span>
          </span>
          <button
            type="button"
            className="text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline"
            onClick={() => onSelectedChange(null)}
          >
            Quitar
          </button>
        </div>
      ) : (
        <>
          <input
            className="input-surface h-11"
            placeholder="Buscar por nombre o teléfono…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && results.length > 0 ? (
            <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 py-1 text-sm shadow-lg">
              {results.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      onSelectedChange(lead);
                      setQ("");
                      setOpen(false);
                      setResults([]);
                    }}
                  >
                    <span className="font-semibold text-sky-400">#{lead.leadNumber}</span> · {lead.fullName}{" "}
                    <span className="text-slate-500">{lead.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      <p className="text-xs text-slate-500">
        Si el referidor no está como lead, indica el detalle en el campo de texto siguiente.
      </p>
    </div>
  );
}
