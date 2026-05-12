import { useEffect, useState } from "react";
import { Search, Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { usePermisos } from "../../hooks/usePermisos";
import type { UsuarioListItem, RolSimple } from "../../types";

interface UserForm {
  name: string;
  email: string;
  password: string;
  rolId: string;
}

const emptyForm: UserForm = { name: "", email: "", password: "", rolId: "" };

export function UsuariosPage() {
  const can = usePermisos();
  const [users, setUsers] = useState<UsuarioListItem[]>([]);
  const [roles, setRoles] = useState<RolSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UsuarioListItem | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      api.get<UsuarioListItem[]>("/users"),
      api.get<RolSimple[]>("/users/roles"),
    ])
      .then(([u, r]) => {
        setUsers(u.data);
        setRoles(r.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.rol.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(u: UsuarioListItem) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", rolId: String(u.rol.id) });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError("");
    if (!form.name.trim() || !form.email.trim() || !form.rolId) {
      setFormError("Nombre, email y rol son obligatorios.");
      return;
    }
    if (!editing && !form.password.trim()) {
      setFormError("La contraseña es obligatoria para usuarios nuevos.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        rolId: parseInt(form.rolId),
      };
      if (form.password.trim()) payload.password = form.password.trim();

      if (editing) {
        const updated = await api.put<UsuarioListItem>(`/users/${editing.id}`, payload);
        setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, ...updated.data } : u)));
      } else {
        const created = await api.post<UsuarioListItem>("/users", payload);
        setUsers((prev) => [created.data, ...prev]);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? "Error al guardar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(u: UsuarioListItem) {
    try {
      const res = await api.patch<UsuarioListItem>(`/users/${u.id}/toggle-active`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: res.data.active } : x)));
    } catch {
      // silencioso
    }
  }

  const rolBadgeColor: Record<string, string> = {
    SUPER_ADMIN: "bg-purple-100 text-purple-800",
    ADMINISTRADOR: "bg-blue-100 text-blue-800",
    GERENTE: "bg-indigo-100 text-indigo-800",
    VENDEDOR: "bg-green-100 text-green-800",
    TECNICO: "bg-yellow-100 text-yellow-800",
    OPERADOR: "bg-slate-100 text-slate-700",
    AUDITOR: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Usuarios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de cuentas de acceso al sistema</p>
        </div>
        {can("usuarios:gestionar") && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Nuevo usuario
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o rol..."
          className="pl-9 pr-4 py-2 w-full text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="text-center py-12 text-slate-400 text-sm">Cargando usuarios...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Nombre</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Rol</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Estado</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Creado</th>
                {can("usuarios:gestionar") && (
                  <th className="text-right px-5 py-3 text-slate-500 font-medium">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-5 py-3 text-slate-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        rolBadgeColor[u.rol.nombre] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {u.rol.nombre}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                      }`}
                    >
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString("es-AR")}
                  </td>
                  {can("usuarios:gestionar") && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          title="Editar"
                          className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleToggle(u)}
                          title={u.active ? "Desactivar" : "Activar"}
                          className={`p-1.5 rounded transition-colors ${
                            u.active
                              ? "text-emerald-500 hover:text-red-500 hover:bg-red-50"
                              : "text-red-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {u.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear/editar */}
      <Modal
        title={editing ? "Editar usuario" : "Nuevo usuario"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{formError}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre completo</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre y apellido"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="correo@empresa.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Contraseña {editing && <span className="text-slate-400">(dejar vacío para no cambiar)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? "Nueva contraseña (opcional)" : "Mínimo 6 caracteres"}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
            <select
              value={form.rolId}
              onChange={(e) => setForm({ ...form, rolId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Seleccionar rol...</option>
              {roles
                .filter((r) => r.nombre !== "SUPER_ADMIN")
                .map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
