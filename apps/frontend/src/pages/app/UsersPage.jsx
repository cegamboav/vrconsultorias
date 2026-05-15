import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import PasswordField from "../../components/ui/PasswordField";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { apiFetch } from "../../lib/apiClient";

const ROLE_LABEL = {
  ADMIN: "Administrador",
  USER: "Asesor"
};

function emptyForm() {
  return { name: "", email: "", phone: "", role: "USER", password: "" };
}

function RoleBadge({ role }) {
  const isAdmin = role === "ADMIN";
  return (
    <span
      className={
        isAdmin
          ? "inline-flex items-center rounded-md border border-sky-700/60 bg-sky-950/40 px-2 py-0.5 text-xs font-medium text-sky-200"
          : "inline-flex items-center rounded-md border border-slate-700/70 bg-slate-900/60 px-2 py-0.5 text-xs font-medium text-slate-300"
      }
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function ActiveBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center rounded-md border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-200">
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-rose-800/60 bg-rose-950/40 px-2 py-0.5 text-xs font-medium text-rose-200">
      Inactivo
    </span>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [mode, setMode] = useState({ kind: "idle" });
  // kind: "idle" | "create" | "edit" | "password"
  // edit/password incluyen { userId }

  const [createForm, setCreateForm] = useState(emptyForm());
  const [editForm, setEditForm] = useState({ name: "", phone: "", role: "USER" });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });

  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/private/users");
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setCreateForm(emptyForm());
    setMode({ kind: "create" });
  }

  function openEdit(u) {
    setEditForm({ name: u.name ?? "", phone: u.phone ?? "", role: u.role ?? "USER" });
    setMode({ kind: "edit", userId: u.id });
  }

  function openPassword(u) {
    setPasswordForm({ password: "", confirm: "" });
    setMode({ kind: "password", userId: u.id, userName: u.name });
  }

  function closePanel() {
    setMode({ kind: "idle" });
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const data = await apiFetch("/api/private/users", {
        method: "POST",
        body: JSON.stringify(createForm)
      });
      toast.success(`Usuario ${data.user.name} creado.`);
      await load();
      closePanel();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (submitting || mode.kind !== "edit") return;
    setSubmitting(true);
    try {
      const data = await apiFetch(`/api/private/users/${mode.userId}`, {
        method: "PATCH",
        body: JSON.stringify(editForm)
      });
      toast.success(`Usuario ${data.user.name} actualizado.`);
      await load();
      closePanel();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (submitting || mode.kind !== "password") return;
    if (passwordForm.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/private/users/${mode.userId}/password`, {
        method: "POST",
        body: JSON.stringify({ password: passwordForm.password })
      });
      toast.success(`Contraseña actualizada para ${mode.userName}.`);
      closePanel();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(u) {
    if (u.id === currentUser?.id && u.isActive) {
      toast.error("No puedes desactivarte a ti mismo.");
      return;
    }
    try {
      const data = await apiFetch(`/api/private/users/${u.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive })
      });
      toast.success(
        `Usuario ${data.user.name} ${data.user.isActive ? "activado" : "desactivado"}.`
      );
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="stack-lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-eyebrow">Administración</p>
          <h2 className="page-title">Usuarios</h2>
          <p className="page-desc">
            Asesores comerciales y administradores con acceso al CRM.
          </p>
        </div>
        <Button onClick={openCreate} disabled={mode.kind === "create"}>
          Nuevo usuario
        </Button>
      </div>

      {error ? <p className="form-error-surface">{error}</p> : null}

      {mode.kind === "create" ? (
        <Card
          variant="surface"
          title="Nuevo usuario"
          subtitle="Configura la cuenta inicial. El usuario podrá ingresar con su email y contraseña."
        >
          <form className="stack-md" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                variant="surface"
                label="Nombre completo"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
              <Input
                variant="surface"
                label="Email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
              />
              <Input
                variant="surface"
                label="Teléfono (opcional)"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
              <label className="form-control">
                <span className="form-label-surface">Rol</span>
                <select
                  className="input-surface h-11"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  <option value="USER">Asesor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <PasswordField
                variant="surface"
                label="Contraseña inicial (mín. 8 caracteres)"
                autoComplete="new-password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={submitting} type="submit">
                {submitting ? "Creando…" : "Crear usuario"}
              </Button>
              <Button type="button" variant="ghost-surface" onClick={closePanel}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {mode.kind === "edit" ? (
        <Card variant="surface" title="Editar usuario" subtitle="Actualiza datos básicos y rol.">
          <form className="stack-md" onSubmit={handleEdit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                variant="surface"
                label="Nombre completo"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
              <Input
                variant="surface"
                label="Teléfono"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
              <label className="form-control">
                <span className="form-label-surface">Rol</span>
                <select
                  className="input-surface h-11"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="USER">Asesor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={submitting} type="submit">
                {submitting ? "Guardando…" : "Guardar cambios"}
              </Button>
              <Button type="button" variant="ghost-surface" onClick={closePanel}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {mode.kind === "password" ? (
        <Card
          variant="surface"
          title={`Restablecer contraseña · ${mode.userName ?? ""}`}
          subtitle="Define una contraseña temporal. El usuario podrá ingresar con ella de inmediato."
        >
          <form className="stack-md" onSubmit={handleResetPassword}>
            <div className="grid gap-4 md:grid-cols-2">
              <PasswordField
                variant="surface"
                label="Nueva contraseña (mín. 8 caracteres)"
                autoComplete="new-password"
                value={passwordForm.password}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, password: e.target.value })
                }
                required
              />
              <PasswordField
                variant="surface"
                label="Confirmar contraseña"
                autoComplete="new-password"
                value={passwordForm.confirm}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirm: e.target.value })
                }
                required
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={submitting} type="submit">
                {submitting ? "Guardando…" : "Restablecer contraseña"}
              </Button>
              <Button type="button" variant="ghost-surface" onClick={closePanel}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Creado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id}>
                  <td className="font-medium text-slate-200">
                    {u.name}
                    {isSelf ? (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-slate-500">
                        (tú)
                      </span>
                    ) : null}
                  </td>
                  <td className="text-slate-400">{u.email}</td>
                  <td className="text-slate-400">{u.phone ?? "—"}</td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td>
                    <ActiveBadge active={u.isActive} />
                  </td>
                  <td className="text-slate-400">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost-surface"
                        className="!h-8 px-2 text-xs"
                        onClick={() => openEdit(u)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost-surface"
                        className="!h-8 px-2 text-xs"
                        onClick={() => openPassword(u)}
                      >
                        Restablecer contraseña
                      </Button>
                      <Button
                        type="button"
                        variant="ghost-surface"
                        className="!h-8 px-2 text-xs"
                        disabled={isSelf && u.isActive}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.isActive ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7} className="text-app-muted">
                  No hay usuarios todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
