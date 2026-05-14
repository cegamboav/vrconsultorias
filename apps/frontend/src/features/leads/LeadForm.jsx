import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { toLocalYmd } from "./dateUi";
import LeadReferrerPicker from "./LeadReferrerPicker";

const sourceOptions = [
  { value: "REFERIDO", label: "Referido" },
  { value: "DIRECTO", label: "Directo" },
  { value: "PAGINA_WEB", label: "Página web" },
  { value: "REDES_SOCIALES", label: "Redes sociales" },
  { value: "OTRO", label: "Otro" }
];

const KNOWN_SOURCES = new Set(["REFERIDO", "DIRECTO", "PAGINA_WEB", "REDES_SOCIALES", "OTRO"]);

function normalizeInitialSource(s) {
  const legacy = { REFERRAL: "REFERIDO", DIRECT: "DIRECTO", ORGANIC: "PAGINA_WEB", OTHER: "OTRO" };
  if (!s) return "OTRO";
  if (legacy[s]) return legacy[s];
  if (KNOWN_SOURCES.has(s)) return s;
  return "OTRO";
}

export default function LeadForm({
  mode,
  initialValues = {},
  onSubmit,
  onCancel,
  isSubmitting,
  error
}) {
  const [fullName, setFullName] = useState(initialValues.fullName ?? "");
  const [phone, setPhone] = useState(initialValues.phone ?? "");
  const [email, setEmail] = useState(initialValues.email ?? "");
  const [source, setSource] = useState(normalizeInitialSource(initialValues.source));
  const [referredBy, setReferredBy] = useState(initialValues.referredBy ?? "");
  const [selectedReferrer, setSelectedReferrer] = useState(initialValues.referredByLead ?? null);
  const [observations, setObservations] = useState(initialValues.observations ?? "");
  const [nextActionDate, setNextActionDate] = useState(
    initialValues.nextActionDate ? toLocalYmd(initialValues.nextActionDate) : ""
  );

  useEffect(() => {
    if (mode !== "edit" || !initialValues?.id) return;
    setFullName(initialValues.fullName ?? "");
    setPhone(initialValues.phone ?? "");
    setEmail(initialValues.email ?? "");
    setSource(normalizeInitialSource(initialValues.source));
    setReferredBy(initialValues.referredBy ?? "");
    setSelectedReferrer(initialValues.referredByLead ?? null);
    setObservations(initialValues.observations ?? "");
    setNextActionDate(
      initialValues.nextActionDate ? toLocalYmd(initialValues.nextActionDate) : ""
    );
  }, [mode, initialValues]);

  const isReferral = source === "REFERIDO";

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      fullName,
      email: email.trim() ? email.trim() : undefined,
      source,
      referredBy: isReferral && referredBy.trim() ? referredBy.trim() : null,
      referredByLeadId: isReferral && selectedReferrer ? selectedReferrer.id : null,
      observations: observations.trim() ? observations.trim() : undefined,
      nextActionDate: nextActionDate ? nextActionDate : undefined
    };
    if (mode === "create") {
      payload.phone = phone;
    }
    await onSubmit(payload);
  }

  return (
    <form className="stack-md" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          variant="surface"
          label="Nombre completo"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <Input
          variant="surface"
          label="Teléfono"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="50670000000"
          required={mode === "create"}
          readOnly={mode === "edit"}
          disabled={mode === "edit"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          variant="surface"
          label="Email (opcional)"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="form-control">
          <span className="form-label-surface">Fuente</span>
          <select
            className="input-surface h-11"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            {sourceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isReferral ? (
        <div className="stack-md rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Referido por
          </p>
          <LeadReferrerPicker
            excludeLeadId={mode === "edit" ? initialValues.id : undefined}
            selected={selectedReferrer}
            onSelectedChange={setSelectedReferrer}
          />
          <Input
            variant="surface"
            label="Notas adicionales del referido (opcional)"
            value={referredBy}
            onChange={(event) => setReferredBy(event.target.value)}
            placeholder="Contexto humano del referido (no reemplaza al lead vinculado)"
          />
        </div>
      ) : null}

      <label className="form-control">
        <span className="form-label-surface">Observaciones (opcional)</span>
        <textarea
          className="textarea-surface"
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          rows={4}
        />
      </label>

      <label className="form-control">
        <span className="form-label-surface">Próxima fecha de seguimiento (opcional, solo día)</span>
        <input
          className="input-surface h-11"
          type="date"
          value={nextActionDate}
          onChange={(event) => setNextActionDate(event.target.value)}
        />
      </label>

      {error ? <p className="form-error-surface">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Guardando..." : mode === "create" ? "Crear lead" : "Guardar cambios"}
        </Button>
        <Button type="button" variant="ghost-surface" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
