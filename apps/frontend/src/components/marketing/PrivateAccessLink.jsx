import { Link } from "react-router-dom";

/**
 * Acceso discreto al CRM (uso interno del equipo).
 * @param {{ className?: string }} props
 */
export default function PrivateAccessLink({ className = "" }) {
  return (
    <Link to="/login" className={`marketing-private-link ${className}`.trim()}>
      Acceso privado
    </Link>
  );
}
