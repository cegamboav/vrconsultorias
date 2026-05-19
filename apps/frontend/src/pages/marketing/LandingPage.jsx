import { VR_BENEFITS, VR_PHONE, VR_PHONE_HREF, VR_SERVICES, VR_STATS } from "../../brand/vrContent";
import AgendaCitaButton from "../../components/marketing/AgendaCitaButton";
import ContactSection from "../../components/marketing/ContactSection";
import MarketingFooter from "../../components/marketing/MarketingFooter";
import MarketingHeader from "../../components/marketing/MarketingHeader";

const TRUST_PILLARS = [
  "Asesoría en Bolsa de Comercio",
  "Enfoque conservador y transparente",
  "Acompañamiento personalizado"
];

export default function LandingPage() {
  return (
    <div className="marketing-page">
      <MarketingHeader />

      <main>
        <section className="marketing-hero">
          <div className="marketing-hero-bg" aria-hidden />
          <div className="marketing-container marketing-hero-inner">
            <div className="marketing-hero-content">
              <p className="marketing-eyebrow">VR Consultorías · Costa Rica</p>
              <h1 className="marketing-hero-title">
                Su aliado en inversiones, educación financiera y contabilidad
              </h1>
              <p className="marketing-hero-lead">
                Más de dos décadas acompañando personas y empresas con asesoría clara, cercana y
                respaldada por experiencia real en el mercado.
              </p>
              <div className="marketing-hero-actions">
                <AgendaCitaButton />
                <a href={VR_PHONE_HREF} className="marketing-btn-ghost">
                  Llamar {VR_PHONE}
                </a>
              </div>
            </div>

            <aside className="marketing-hero-aside" aria-label="Resumen de confianza">
              <div className="marketing-trust-card">
                <p className="marketing-trust-kicker">Por qué confiar en nosotros</p>
                <ul className="marketing-trust-list">
                  {TRUST_PILLARS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="marketing-trust-quote">
                  <p className="text-sm leading-relaxed text-slate-200">
                    “La excelencia no es un acto, sino un hábito.”
                  </p>
                  <p className="mt-2 text-xs text-brand-gold-light">— Aristóteles</p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="marketing-stats">
          <div className="marketing-container">
            <div className="marketing-stats-grid">
              {VR_STATS.map((s) => (
                <div key={s.label} className="marketing-stat">
                  <p className="marketing-stat-value">{s.value}</p>
                  <p className="marketing-stat-label">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section" id="servicios">
          <div className="marketing-container">
            <div className="marketing-section-head">
              <p className="marketing-section-eyebrow">Nuestros servicios</p>
              <h2 className="marketing-section-title">Soluciones para cada etapa de su vida financiera</h2>
              <p className="marketing-section-desc">
                Tres áreas de especialidad con el mismo estándar de atención: cercana, profesional y
                orientada a resultados.
              </p>
            </div>
            <div className="marketing-services-grid">
              {VR_SERVICES.map((svc) => (
                <article key={svc.id} className="marketing-service-card">
                  <span
                    className="marketing-service-dot"
                    style={{
                      backgroundColor: `${svc.color}18`,
                      borderColor: `${svc.color}55`,
                      color: svc.color
                    }}
                  >
                    {svc.title.charAt(0)}
                  </span>
                  <h3 className="marketing-service-title">{svc.title}</h3>
                  <p className="marketing-service-subtitle">{svc.subtitle}</p>
                  <p className="marketing-service-desc">{svc.description}</p>
                  <a href="#contacto" className="marketing-service-link">
                    Consultar sobre {svc.title.toLowerCase()}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-section-alt" id="beneficios">
          <div className="marketing-container">
            <div className="marketing-section-head">
              <p className="marketing-section-eyebrow">Por qué escogernos</p>
              <h2 className="marketing-section-title">Confianza, profesionalismo y cercanía</h2>
            </div>
            <div className="marketing-benefits-grid">
              {VR_BENEFITS.map((b) => (
                <div key={b.title} className="marketing-benefit">
                  <span className="marketing-benefit-accent" aria-hidden />
                  <h3 className="font-semibold text-brand-navy">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-cta">
          <div className="marketing-cta-bg" aria-hidden />
          <div className="marketing-container marketing-cta-inner">
            <h2 className="marketing-cta-title">¿Listo para dar el siguiente paso?</h2>
            <p className="marketing-cta-desc">
              Agende una conversación con nuestro equipo y descubra cómo podemos ayudarle en
              inversiones, charlas o contabilidad.
            </p>
            <div className="marketing-cta-actions">
              <AgendaCitaButton />
              <a href={VR_PHONE_HREF} className="marketing-btn-outline-light">
                Llamar ahora
              </a>
            </div>
          </div>
        </section>

        <ContactSection />
      </main>

      <MarketingFooter />
    </div>
  );
}
