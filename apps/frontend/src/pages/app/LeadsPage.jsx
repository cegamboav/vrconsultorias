import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import { apiFetch } from "../../lib/apiClient";

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const data = await apiFetch("/api/private/leads");
        setLeads(data.leads ?? []);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="stack-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-app-muted text-sm">Gestión</p>
          <h2 className="text-xl font-semibold text-gray-900">Leads</h2>
        </div>
        <Link to="/app/leads/new">
          <Button>Nuevo lead</Button>
        </Link>
      </div>

      {isLoading ? <p className="text-app-muted">Cargando...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link className="table-row-link" to={`/app/leads/${lead.id}`}>
                    #{lead.leadNumber}
                  </Link>
                </td>
                <td>{lead.fullName}</td>
                <td className="text-gray-700">{lead.phone}</td>
                <td>
                  <StatusBadge status={lead.status} />
                </td>
                <td className="text-gray-700">
                  {lead.lastActivityAt
                    ? new Date(lead.lastActivityAt).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
            {leads.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={5} className="text-app-muted">
                  No hay leads todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

