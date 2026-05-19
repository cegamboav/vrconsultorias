import { useCallback, useState } from "react";

function EyeOpenIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 10.036 6.322a1.012 1.012 0 010 .639C20.577 16.49 16.64 19 12 19c-4.638 0-8.573-2.51-10.036-6.322z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeSlashIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

/**
 * Contraseña con icono para ver el valor mientras se mantiene presionado el ojo (pointer/touch).
 */
export default function PasswordField({ label, error, variant = "auth", className = "", ...props }) {
  const labelClass = variant === "surface" ? "form-label-surface" : "form-label";
  const inputClass =
    variant === "surface"
      ? `input-surface password-field-input w-full ${error ? "input-error-surface" : ""}`
      : `input password-field-input w-full ${error ? "input-error" : ""}`;

  const [revealed, setRevealed] = useState(false);
  const show = useCallback(() => setRevealed(true), []);
  const hide = useCallback(() => setRevealed(false), []);

  return (
    <label className={`form-control ${className}`.trim()}>
      <span className={labelClass}>{label}</span>
      <div className="password-field-wrap">
        <input
          className={inputClass.trim()}
          type={revealed ? "text" : "password"}
          autoComplete={props.autoComplete ?? "current-password"}
          {...props}
        />
        <button
          type="button"
          className="password-field-reveal"
          tabIndex={-1}
          aria-label={
            revealed
              ? "Mostrando contraseña (suelta para ocultar)"
              : "Mantén pulsado para mostrar la contraseña"
          }
          onPointerDown={(e) => {
            if (props.disabled || props.readOnly) return;
            e.preventDefault();
            show();
          }}
          onPointerUp={hide}
          onPointerLeave={hide}
          onPointerCancel={hide}
          disabled={props.disabled || props.readOnly}
        >
          {revealed ? <EyeSlashIcon /> : <EyeOpenIcon />}
        </button>
      </div>
      {error ? (
        <span className={variant === "surface" ? "form-error-surface" : "form-error"}>{error}</span>
      ) : null}
    </label>
  );
}
