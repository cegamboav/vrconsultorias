export default function Input({ label, error, ...props }) {
  return (
    <label className="form-control">
      <span className="form-label">{label}</span>
      <input className={`input ${error ? "input-error" : ""}`} {...props} />
      {error ? <span className="form-error">{error}</span> : null}
    </label>
  );
}
