export default function Card({ title, subtitle, children }) {
  return (
    <section className="card">
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
