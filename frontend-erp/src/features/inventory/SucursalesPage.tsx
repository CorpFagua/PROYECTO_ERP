import { useEffect, useState } from "react";
import { MapPin, Search, Plus, Pencil } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { usePermisos } from "../../hooks/usePermisos";
import type { Sucursal, Localidad } from "../../types";

interface SucursalForm {
  nombre: string;
  domicilio: string;
  idLocalidad: string;
}

const emptyForm: SucursalForm = { nombre: "", domicilio: "", idLocalidad: "" };

export function SucursalesPage() {
  const can = usePermisos();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sucursal | null>(null);
  const [form, setForm] = useState<SucursalForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Sucursal[]>("/inventory/sucursales"),
      api.get<Localidad[]>("/inventory/localidades"),
    ])
      .then(([s, l]) => {
        setSucursales(s.data);
        setLocalidades(l.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = sucursales.filter(
    (s) =>
      s.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (s.domicilio ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.localidad?.nombre ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(s: Sucursal) {
    setEditing(s);
    setForm({
      nombre: s.nombre,
      domicilio: s.domicilio ?? "",
      idLocalidad: String(s.idLocalidad),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError("");
    if (!form.nombre.trim() || !form.idLocalidad) {
      setFormError("El nombre y la localidad son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        domicilio: form.domicilio.trim() || undefined,
        idLocalidad: parseInt(form.idLocalidad),
      };
      if (editing) {
        const { data } = await api.patch<Sucursal>(`/inventory/sucursales/${editing.id}`, payload);
        setSucursales((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      } else {
        const { data } = await api.post<Sucursal>("/inventory/sucursales", payload);
        setSucursales((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setFormError(e.response?.data?.error ?? "Error al guardar la sucursal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Sucursales</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{sucursales.length} activas</span>
          {can("sucursales:gestionar") && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Nueva sucursal
            </button>
          )}
        </div>
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
          <div className="p-8 text-center text-sm text-slate-500">Cargando sucursales...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {sucursales.length === 0 ? "No hay sucursales registradas." : "No se encontraron resultados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sucursal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Domicilio</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Localidad</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Activa</th>
                {can("sucursales:gestionar") && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-indigo-400 shrink-0" />
                      {s.nombre}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.domicilio ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.localidad?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.activa ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.activa ? "Sí" : "No"}
                    </span>
                  </td>
                  {can("sucursales:gestionar") && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(s)}
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
        title={editing ? "Editar sucursal" : "Nueva sucursal"}
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
              placeholder="Nombre de la sucursal"
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
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear sucursal"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
