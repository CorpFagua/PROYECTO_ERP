import { useEffect, useState } from "react";
import { Search, Plus } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { usePermisos } from "../../hooks/usePermisos";
import type { Compra, Product, Proveedor } from "../../types";

interface CompraForm {
  fecha: string;
  idProducto: string;
  cantidad: string;
  precio: string;
  idProveedor: string;
}

const today = new Date().toISOString().split("T")[0];
const emptyForm: CompraForm = { fecha: today, idProducto: "", cantidad: "", precio: "", idProveedor: "" };

export function ComprasPage() {
  const can = usePermisos();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CompraForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Compra[]>("/inventory/compras"),
      api.get<Product[]>("/inventory/products"),
      api.get<Proveedor[]>("/inventory/proveedores").catch(() => ({ data: [] as Proveedor[] })),
    ])
      .then(([c, p, pr]) => {
        setCompras(c.data);
        setProducts(p.data);
        setProveedores(pr.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = compras.filter(
    (c) =>
      (c.producto?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.proveedor?.nombre ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const totalCompras = compras.reduce((sum, c) => sum + Number(c.precio) * c.cantidad, 0);

  function openCreate() {
    setForm({ ...emptyForm, fecha: new Date().toISOString().split("T")[0] });
    setFormError("");
    setModalOpen(true);
  }

  // Autocompletar precio desde el producto seleccionado
  function handleProductChange(id: string) {
    const producto = products.find((p) => String(p.id) === id);
    setForm((f) => ({
      ...f,
      idProducto: id,
      precio: producto ? String(producto.precio) : f.precio,
    }));
  }

  async function handleSave() {
    setFormError("");
    if (!form.fecha || !form.idProducto || !form.cantidad || !form.precio || !form.idProveedor) {
      setFormError("Todos los campos son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fecha: form.fecha,
        idProducto: parseInt(form.idProducto),
        cantidad: parseInt(form.cantidad),
        precio: parseFloat(form.precio),
        idProveedor: parseInt(form.idProveedor),
      };
      const { data } = await api.post<Compra>("/inventory/compras", payload);
      setCompras((prev) => [data, ...prev]);
      setModalOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setFormError(e.response?.data?.error ?? "Error al registrar la compra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Compras</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            Total: <span className="font-semibold text-slate-700">${totalCompras.toLocaleString("es-CL")}</span>
          </span>
          {can("compras:crear") && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Nueva compra
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por producto o proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando compras...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {compras.length === 0 ? "No hay compras registradas." : "No se encontraron resultados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Proveedor</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Cant.</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Precio unit.</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.id}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(c.fecha).toLocaleDateString("es-CL")}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{c.producto?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.proveedor?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{c.cantidad}</td>
                  <td className="px-4 py-3 text-right text-slate-600">${Number(c.precio).toLocaleString("es-CL")}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    ${(Number(c.precio) * c.cantidad).toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal title="Nueva compra" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Producto</label>
            <select
              value={form.idProducto}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar producto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Precio unitario</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precio}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
            <select
              value={form.idProveedor}
              onChange={(e) => setForm({ ...form, idProveedor: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar proveedor...</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre ?? `ID ${p.id}`}</option>
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
              {saving ? "Registrando..." : "Registrar compra"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
