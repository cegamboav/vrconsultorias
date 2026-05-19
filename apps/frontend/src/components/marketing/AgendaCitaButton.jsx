import { VR_CALENDLY_URL } from "../../brand/vrContent";

/**
 * CTA principal de la landing. Usa Calendly cuando VR_CALENDLY_URL esté definido.
 * @param {{ className?: string, variant?: "primary" | "outline-light" }} props
 */
export default function AgendaCitaButton({ className = "", variant = "primary" }) {
  const base =
    variant === "outline-light" ? "marketing-btn-outline-light" : "marketing-btn-primary";
  const classes = `${base} ${className}`.trim();

  if (VR_CALENDLY_URL) {
    return (
      <a
        href={VR_CALENDLY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        Agenda tu cita
      </a>
    );
  }

  return (
    <a href="#contacto" className={classes} title="Próximamente: enlace a Calendly">
      Agenda tu cita
    </a>
  );
}
