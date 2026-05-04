import { useEffect, useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { usePermisos } from "../../hooks/usePermisos";
import type { Product, TipoProducto } from "../../types";

interface ProductForm {
  nombre: string;
  precio: string;
  idTipoProducto: string;
}

const emptyForm: ProductForm = { nombre: "", precio: "", idTipoProducto: "" };

export function InventoryPage() {
  const can = usePermisos();
  const [products, setProducts] = useState<Product[]>([]);
  const [tipos, setTipos] = useState<TipoProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Product[]>("/inventory/products"),
      api.get<TipoProducto[]>("/inventory/product-types"),
    ])
      .then(([p, t]) => {
        setProducts(p.data);
        setTipos(t.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.tipoProducto?.nombre ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      nombre: p.nombre,
      precio: String(p.precio),
      idTipoProducto: String(p.idTipoProducto),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError("");
    if (!form.nombre.trim() || !form.precio || !form.idTipoProducto) {
      setFormError("Todos los campos son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        precio: parseFloat(form.precio),
        idTipoProducto: parseInt(form.idTipoProducto),
      };
      if (editing) {
        const { data } = await api.patch<Product>(`/inventory/products/${editing.id}`, payload);
        setProducts((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      } else {
        const { data } = await api.post<Product>("/inventory/products", payload);
        setProducts((prev) => [data, ...prev]);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setFormError(e.response?.data?.error ?? "Error al guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Product) {
    if (!confirm(`¿Dar de baja "${p.nombre}"? El producto quedará inactivo.`)) return;
    try {
      await api.delete(`/inventory/products/${p.id}`);
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      alert("No se pudo dar de baja el producto.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Productos</h1>
        {can("inventario:crear") && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nuevo producto
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o tipo de producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando productos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {products.length === 0 ? "No hay productos registrados." : "No se encontraron resultados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Precio</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Activo</th>
                {(can("inventario:editar") || can("inventario:eliminar")) && (
                  <th className="px-4 py-3" />
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{product.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{product.tipoProducto?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    ${Number(product.precio).toLocaleString("es-CL")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        product.activo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {product.activo ? "Sí" : "No"}
                    </span>
                  </td>
                  {(can("inventario:editar") || can("inventario:eliminar")) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can("inventario:editar") && (
                          <button
                            onClick={() => openEdit(product)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {can("inventario:eliminar") && (
                          <button
                            onClick={() => handleDelete(product)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Dar de baja"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear / editar */}
      <Modal
        title={editing ? "Editar producto" : "Nuevo producto"}
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
              placeholder="Nombre del producto"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de producto</label>
            <select
              value={form.idTipoProducto}
              onChange={(e) => setForm({ ...form, idTipoProducto: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar tipo...</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Precio</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.000"
            />
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
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
