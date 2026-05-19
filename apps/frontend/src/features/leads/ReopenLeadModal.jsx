import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";

export default function ReopenLeadModal({ open, isSubmitting, error, onClose, onSubmit }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const text = reason.trim();
    onSubmit(text ? { reason: text } : {});
  }

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="app-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reopen-lead-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 id="reopen-lead-title" className="app-modal-title">
          Reabrir lead
        </h3>
        <p className="app-modal-body">
          ¿Deseas reabrir este lead y devolverlo al pipeline?
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Volverá a estado Contactado para reiniciar el proceso comercial.
        </p>
        <label className="form-control mt-4">
          <span className="form-label-surface">Motivo de reapertura (opcional)</span>
          <textarea
            className="textarea-surface"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="¿Por qué se está reabriendo este lead?"
            rows={3}
            disabled={isSubmitting}
          />
        </label>
        {error ? <p className="form-error-surface mt-3">{error}</p> : null}
        <div className="app-modal-actions">
          <Button type="button" variant="ghost-surface" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Reabriendo…" : "Reabrir"}
          </Button>
        </div>
      </form>
    </div>
  );
}
