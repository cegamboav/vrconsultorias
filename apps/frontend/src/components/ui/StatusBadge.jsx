import { leadStatusLabel } from "../../features/leads/labels";

const statusClasses = {
  NEW: "badge badge-neutral",
  CONTACTED: "badge badge-info",
  SCHEDULED: "badge badge-success",
  FOLLOW_UP: "badge badge-warning",
  CLOSED_INVESTED: "badge badge-success",
  CLOSED_NOT_INVESTED: "badge badge-muted"
};

export default function StatusBadge({ status }) {
  const className = statusClasses[status] ?? "badge badge-neutral";
  const label = leadStatusLabel[status] ?? "—";
  return <span className={className}>{label}</span>;
}
