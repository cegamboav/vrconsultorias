import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import PasswordField from "../../components/ui/PasswordField";
import ServiceCategoryBadge from "../../components/ui/ServiceCategoryBadge";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { apiFetch } from "../../lib/apiClient";

const TABS = [
  { id: "services", label: "Servicios" },
  { id: "profile", label: "Mi Perfil" }
];

function emptyServiceForm() {
  return { name: "", color: "#6B9BD1" };
}

function ColorField({ value, onChange }) {
  return (
    <label className="form-control">
      <span className="form-label-surface">Color</span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          className="h-11 w-14 cursor-pointer rounded border border-slate-700 bg-slate-950"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input variant="surface" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      </div>
    </label>
  );
}

function ServicesTab({ isAdmin }) {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState({ kind: "idle" });
  const [createForm, setCreateForm] = useState(emptyServiceForm());
  const [editForm, setEditForm] = useState({ name: "", color: "#6B9BD1" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/private/service-categories/all");
      setCategories(data.categories ?? []);
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
    setCreateForm(emptyServiceForm());
    setMode({ kind: "create" });
  }

  function openEdit(cat) {
    setEditForm({ name: cat.name ?? "", color: cat.color ?? "#6B9BD1" });
    setMode({ kind: "edit", categoryId: cat.id });
  }

  function closePanel() {
    setMode({ kind: "idle" });
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!isAdmin || submitting) return;
    setSubmitting(true);
    try {
      const data = await apiFetch("/api/private/service-categories", {
        method: "POST",
        body: JSON.stringify(createForm)
      });
      toast.success(`Servicio ${data.category.name} creado.`);
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
    if (!isAdmin || submitting || mode.kind !== "edit") return;
    setSubmitting(true);
    try {
      const data = await apiFetch(`/api/private/service-categories/${mode.categoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editForm.name, color: editForm.color })
      });
      toast.success(`Servicio ${data.category.name} actualizado.`);
      await load();
      closePanel();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(cat) {
    if (!isAdmin) return;
    try {
      const data = await apiFetch(`/api/private/service-categories/${cat.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !cat.isActive })
      });
      toast.success(
        `Servicio ${data.category.name} ${data.category.isActive ? "activado" : "desactivado"}.`
      );
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="stack-lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="page-desc">
          Líneas de negocio disponibles para clasificar leads. Los servicios inactivos no aparecen
          en formularios nuevos.
        </p>
        {isAdmin ? (
          <Button onClick={openCreate} disabled={mode.kind === "create"}>
            Nuevo servicio
          </Button>
        ) : null}
      </div>

      {!isAdmin ? (
        <p className="settings-readonly-hint">
          Solo lectura. Un administrador puede crear o modificar servicios.
        </p>
      ) : null}

      {error ? <p className="form-error-surface">{error}</p> : null}
      {isLoading ? <p className="text-app-muted">Cargando servicios…</p> : null}

      {isAdmin && mode.kind === "create" ? (
        <Card
          variant="surface"
          title="Nuevo servicio"
          subtitle="El identificador interno (slug) se genera automáticamente."
        >
          <form className="stack-md" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                variant="surface"
                label="Nombre"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
              <ColorField
                value={createForm.color}
                onChange={(color) => setCreateForm({ ...createForm, color })}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={submitting} type="submit">
                {submitting ? "Creando…" : "Crear servicio"}
              </Button>
              <Button type="button" variant="ghost-surface" onClick={closePanel}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {isAdmin && mode.kind === "edit" ? (
        <Card variant="surface" title="Editar servicio">
          <form className="stack-md" onSubmit={handleEdit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                variant="surface"
                label="Nombre"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
              <ColorField
                value={editForm.color}
                onChange={(color) => setEditForm({ ...editForm, color })}
              />
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

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Slug</th>
              <th>Leads</th>
              <th>Estado</th>
              {isAdmin ? <th className="text-right">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td>
                  <ServiceCategoryBadge category={cat} />
                </td>
                <td className="font-mono text-xs text-slate-500">{cat.slug}</td>
                <td className="text-slate-400">{cat._count?.leads ?? 0}</td>
                <td>
                  {cat.isActive ? (
                    <span className="inline-flex items-center rounded-md border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-200">
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-rose-800/60 bg-rose-950/40 px-2 py-0.5 text-xs font-medium text-rose-200">
                      Inactivo
                    </span>
                  )}
                </td>
                {isAdmin ? (
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost-surface"
                        className="!h-8 px-2 text-xs"
                        onClick={() => openEdit(cat)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost-surface"
                        className="!h-8 px-2 text-xs"
                        onClick={() => handleToggle(cat)}
                      >
                        {cat.isActive ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {categories.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="text-app-muted">
                  No hay servicios configurados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfileTab() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const data = await apiFetch("/api/private/profile");
      setProfile(data.user);
      setProfileForm({
        name: data.user.name ?? "",
        email: data.user.email ?? "",
        phone: data.user.phone ?? ""
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    if (submittingProfile) return;
    setSubmittingProfile(true);
    try {
      const data = await apiFetch("/api/private/profile", {
        method: "PATCH",
        body: JSON.stringify(profileForm)
      });
      setProfile(data.user);
      await refreshUser();
      toast.success("Perfil actualizado.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingProfile(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    if (submittingPassword) return;
    if (passwordForm.newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setSubmittingPassword(true);
    try {
      await apiFetch("/api/private/profile/password", {
        method: "POST",
        body: JSON.stringify(passwordForm)
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Contraseña actualizada.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingPassword(false);
    }
  }

  if (isLoading) {
    return <p className="text-app-muted">Cargando perfil…</p>;
  }

  return (
    <div className="stack-lg">
      <Card
        variant="surface"
        title="Datos personales"
        subtitle="Nombre, correo de acceso y teléfono de contacto."
      >
        <form className="stack-md" onSubmit={handleProfileSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              variant="surface"
              label="Nombre completo"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              required
            />
            <Input
              variant="surface"
              label="Email (login)"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              required
            />
            <Input
              variant="surface"
              label="Teléfono"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            />
          </div>
          {profile?.role ? (
            <p className="text-xs text-slate-500">
              Rol: {profile.role === "ADMIN" ? "Administrador" : "Asesor"}
            </p>
          ) : null}
          <Button disabled={submittingProfile} type="submit">
            {submittingProfile ? "Guardando…" : "Guardar perfil"}
          </Button>
        </form>
      </Card>

      <Card
        variant="surface"
        title="Cambiar contraseña"
        subtitle="Necesitas tu contraseña actual para confirmar el cambio."
      >
        <form className="stack-md" onSubmit={handlePasswordSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <PasswordField
              variant="surface"
              label="Contraseña actual"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              required
            />
            <div className="hidden md:block" />
            <PasswordField
              variant="surface"
              label="Nueva contraseña (mín. 8 caracteres)"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
              }
              required
            />
            <PasswordField
              variant="surface"
              label="Confirmar nueva contraseña"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              required
            />
          </div>
          <Button disabled={submittingPassword} type="submit">
            {submittingPassword ? "Actualizando…" : "Cambiar contraseña"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("services");

  return (
    <div className="stack-lg">
      <div>
        <p className="page-eyebrow">Sistema</p>
        <h2 className="page-title">Configuración</h2>
        <p className="page-desc">Servicios del CRM y tu perfil de usuario.</p>
      </div>

      <div className="settings-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`settings-tab ${tab === t.id ? "settings-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "services" ? <ServicesTab isAdmin={isAdmin} /> : null}
      {tab === "profile" ? <ProfileTab /> : null}
    </div>
  );
}
