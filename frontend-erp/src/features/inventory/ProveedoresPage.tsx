import { useEffect, useState } from "react";
import { Search, Plus, Pencil } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { usePermisos } from "../../hooks/usePermisos";
import type { Proveedor, Localidad } from "../../types";

interface ProveedorForm {
  nombre: string;
  domicilio: string;
  idLocalidad: string;
}

const emptyForm: ProveedorForm = { nombre: "", domicilio: "", idLocalidad: "" };

export function ProveedoresPage() {
  const can = usePermisos();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [form, setForm] = useState<ProveedorForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Proveedor[]>("/inventory/proveedores"),
      api.get<Localidad[]>("/inventory/localidades"),
    ])
      .then(([p, l]) => {
        setProveedores(p.data);
        setLocalidades(l.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = proveedores.filter(
    (p) =>
      (p.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.domicilio ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.localidad?.nombre ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(p: Proveedor) {
    setEditing(p);
    setForm({
      nombre: p.nombre ?? "",
      domicilio: p.domicilio ?? "",
      idLocalidad: String(p.idLocalidad),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError("");
    if (!form.idLocalidad) {
      setFormError("La localidad es obligatoria.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim() || undefined,
        domicilio: form.domicilio.trim() || undefined,
        idLocalidad: parseInt(form.idLocalidad),
      };
      if (editing) {
        const { data } = await api.patch<Proveedor>(`/inventory/proveedores/${editing.id}`, payload);
        setProveedores((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      } else {
        const { data } = await api.post<Proveedor>("/inventory/proveedores", payload);
        setProveedores((prev) => [...prev, data].sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")));
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setFormError(e.response?.data?.error ?? "Error al guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Proveedores</h1>
        {can("proveedores:gestionar") && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nuevo proveedor
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, domicilio o localidad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando proveedores...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {proveedores.length === 0 ? "No hay proveedores registrados." : "No se encontraron resultados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Domicilio</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Localidad</th>
                {can("proveedores:gestionar") && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{p.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.domicilio ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.localidad?.nombre ?? "—"}</td>
                  {can("proveedores:gestionar") && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        title={editing ? "Editar proveedor" : "Nuevo proveedor"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nombre del proveedor"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Domicilio</label>
            <input
              type="text"
              value={form.domicilio}
              onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Dirección (opcional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Localidad</label>
            <select
              value={form.idLocalidad}
              onChange={(e) => setForm({ ...form, idLocalidad: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar localidad...</option>
              {localidades.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear proveedor"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
