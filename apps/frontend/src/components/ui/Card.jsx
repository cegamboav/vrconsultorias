export default function Card({ title, subtitle, children, variant = "auth" }) {
  const cardClass = variant === "surface" ? "card-surface" : "card";
  return (
    <section className={cardClass}>
      {(title || subtitle) && (
        <header className="card-header">
          {title ? <h2 className="card-title">{title}</h2> : null}
          {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}
