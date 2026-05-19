import { VR_CONTACT_FORM_FIELDS, VR_PHONE, VR_PHONE_HREF } from "../../brand/vrContent";
import AgendaCitaButton from "./AgendaCitaButton";

/**
 * Sección de contacto preparada para futura integración con CRM.
 * El formulario es visual (no envía datos).
 */
export default function ContactSection() {
  return (
    <section className="marketing-section marketing-contact" id="contacto">
      <div className="marketing-container">
        <div className="marketing-contact-grid">
          <div className="marketing-contact-intro">
            <p className="marketing-section-eyebrow">Contacto</p>
            <h2 className="marketing-section-title">Hablemos de sus metas financieras</h2>
            <p className="marketing-section-desc mt-4">
              Cuéntenos qué necesita y un asesor de VR Consultorías se comunicará con usted. Atención
              cercana, clara y profesional.
            </p>

            <ul className="marketing-contact-highlights">
              <li>
                <span className="marketing-contact-highlight-label">Teléfono</span>
                <a href={VR_PHONE_HREF} className="marketing-contact-highlight-value">
                  {VR_PHONE}
                </a>
              </li>
              <li>
                <span className="marketing-contact-highlight-label">Horario</span>
                <span className="marketing-contact-highlight-value">Lunes a viernes · 8:00 – 17:00</span>
              </li>
            </ul>

            <AgendaCitaButton className="mt-8" />
            <p className="mt-3 text-xs text-slate-500">
              {/* TODO: conectar VR_CALENDLY_URL en vrContent.js */}
              Reserva en línea disponible próximamente.
            </p>
          </div>

          <div className="marketing-contact-form-wrap">
            <form
              className="marketing-contact-form"
              onSubmit={(e) => e.preventDefault()}
              aria-label="Formulario de contacto (próximamente activo)"
            >
              <p className="marketing-contact-form-badge">Próximamente en línea</p>
              <p className="text-sm text-slate-600">
                Pronto podrá enviar su consulta en línea. Por ahora, llámenos o agende su cita.
              </p>

              <div className="mt-6 space-y-4">
                {VR_CONTACT_FORM_FIELDS.map((field) => (
                  <div key={field.name} className="marketing-contact-field">
                    <label htmlFor={`contact-${field.name}`} className="marketing-contact-label">
                      {field.label}
                    </label>
                    {field.type === "select" ? (
                      <select
                        id={`contact-${field.name}`}
                        name={field.name}
                        disabled
                        className="marketing-contact-input"
                        defaultValue=""
                      >
                        <option value="">Seleccione un servicio</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        id={`contact-${field.name}`}
                        name={field.name}
                        disabled
                        rows={4}
                        className="marketing-contact-input marketing-contact-textarea"
                        placeholder="Escriba su mensaje…"
                      />
                    ) : (
                      <input
                        id={`contact-${field.name}`}
                        name={field.name}
                        type={field.type}
                        disabled
                        className="marketing-contact-input"
                        placeholder={field.label}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button type="submit" disabled className="marketing-contact-submit">
                Enviar consulta
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                {/* TODO: enviar consulta al equipo VR (Calendly / API interna) */}
                Activación del formulario en desarrollo.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
