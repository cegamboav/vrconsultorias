export default function Input({ label, error, variant = "auth", ...props }) {
  const labelClass = variant === "surface" ? "form-label-surface" : "form-label";
  const inputClass =
    variant === "surface"
      ? `input-surface ${error ? "input-error-surface" : ""}`
      : `input ${error ? "input-error" : ""}`;
  return (
    <label className="form-control">
      <span className={labelClass}>{label}</span>
      <input className={inputClass} {...props} />
      {error ? <span className="form-error-surface">{error}</span> : null}
    </label>
  );
}
