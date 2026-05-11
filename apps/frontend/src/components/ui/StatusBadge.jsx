const statusClasses = {
  NEW: "badge badge-neutral",
  CONTACTED: "badge badge-info",
  RESPONDED: "badge badge-warning",
  SCHEDULED: "badge badge-success",
  CLOSED: "badge badge-muted"
};

const labels = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  RESPONDED: "Respondió",
  SCHEDULED: "Agendada",
  CLOSED: "Cierre"
};

export default function StatusBadge({ status }) {
  const className = statusClasses[status] ?? "badge badge-neutral";
  return <span className={className}>{labels[status] ?? status}</span>;
}

