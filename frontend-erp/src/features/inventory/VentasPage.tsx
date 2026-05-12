import { useEffect, useState } from "react";
import { Search, Plus } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { usePermisos } from "../../hooks/usePermisos";
import { useAuthStore } from "../../stores/authStore";
import type { Venta, Product, Sucursal } from "../../types";

interface VentaForm {
  fecha: string;
  fechaEntrega: string;
  idProducto: string;
  cantidad: string;
  idSucursal: string;
}

const today = new Date().toISOString().split("T")[0];
const emptyForm: VentaForm = {
  fecha: today,
  fechaEntrega: today,
  idProducto: "",
  cantidad: "",
  idSucursal: "",
};

export function VentasPage() {
  const can = usePermisos();
  const user = useAuthStore((s) => s.user);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<VentaForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Sucursal fija del empleado (si la tiene)
  const empleadoSucursalId = user?.empleado?.idSucursal;
  const isVendedor = user?.rol === "VENDEDOR";

  useEffect(() => {
    Promise.all([
      api.get<Venta[]>("/inventory/ventas"),
      api.get<Product[]>("/inventory/products"),
      api.get<Sucursal[]>("/inventory/sucursales"),
    ])
      .then(([v, p, s]) => {
        setVentas(v.data);
        setProducts(p.data);
        setSucursales(s.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = ventas.filter(
    (v) =>
      (v.producto?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (v.sucursal?.nombre ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const totalVentas = ventas.reduce((sum, v) => sum + Number(v.precio) * v.cantidad, 0);

  // Precio del producto seleccionado (siempre desde el catálogo)
  const selectedProduct = products.find((p) => String(p.id) === form.idProducto);
  const catalogPrice = selectedProduct ? Number(selectedProduct.precio) : null;

  function openCreate() {
    const now = new Date().toISOString().split("T")[0];
    setForm({
      ...emptyForm,
      fecha: now,
      fechaEntrega: now,
      idSucursal: empleadoSucursalId ? String(empleadoSucursalId) : "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function handleProductChange(id: string) {
    setForm((f) => ({ ...f, idProducto: id }));
  }

  async function handleSave() {
    setFormError("");
    if (!form.fecha || !form.fechaEntrega || !form.idProducto || !form.cantidad) {
      setFormError("Fecha, producto y cantidad son obligatorios.");
      return;
    }
    const cantidadNum = parseInt(form.cantidad);
    if (isNaN(cantidadNum) || cantidadNum < 1 || cantidadNum > 9999) {
      setFormError("La cantidad debe estar entre 1 y 9.999 unidades.");
      return;
    }
    if (!form.idSucursal) {
      setFormError("La sucursal es obligatoria.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fecha: form.fecha,
        fechaEntrega: form.fechaEntrega,
        idProducto: parseInt(form.idProducto),
        cantidad: cantidadNum,
        idSucursal: parseInt(form.idSucursal),
        // precio omitido: el backend usa el precio del catálogo
      };
      const { data } = await api.post<Venta>("/inventory/ventas", payload);
      setVentas((prev) => [data, ...prev]);
      setModalOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setFormError(e.response?.data?.error ?? "Error al registrar la venta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Ventas</h1>
          {empleadoSucursalId && sucursales.length > 0 && (
            <p className="text-sm text-indigo-600 mt-0.5 font-medium">
              Sucursal: {sucursales.find((s) => s.id === empleadoSucursalId)?.nombre ?? `#${empleadoSucursalId}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            Total: <span className="font-semibold text-slate-700">${totalVentas.toLocaleString("es-CL")}</span>
          </span>
          {can("ventas:crear") && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Nueva venta
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por producto o sucursal..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando ventas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {ventas.length === 0 ? "No hay ventas registradas." : "No se encontraron resultados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sucursal</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Cant.</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Precio unit.</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{v.id}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(v.fecha).toLocaleDateString("es-CL")}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{v.producto?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{v.sucursal?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{v.cantidad}</td>
                  <td className="px-4 py-3 text-right text-slate-600">${Number(v.precio).toLocaleString("es-CL")}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    ${(Number(v.precio) * v.cantidad).toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal title="Nueva venta" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha venta</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha entrega</label>
              <input
                type="date"
                value={form.fechaEntrega}
                onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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

          {/* Precio del catálogo — solo lectura */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Precio unitario
              <span className="ml-2 text-xs font-normal text-slate-400">(precio de catálogo)</span>
            </label>
            <input
              type="text"
              readOnly
              value={
                catalogPrice !== null
                  ? `$${catalogPrice.toLocaleString("es-CL")}`
                  : "— selecciona un producto —"
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                max="9999"
                step="1"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total estimado</label>
              <input
                type="text"
                readOnly
                value={
                  catalogPrice !== null && form.cantidad
                    ? `$${(catalogPrice * (parseInt(form.cantidad) || 0)).toLocaleString("es-CL")}`
                    : "—"
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sucursal</label>
            {empleadoSucursalId ? (
              // Empleado con sucursal asignada: campo de solo lectura
              <input
                type="text"
                readOnly
                value={
                  sucursales.find((s) => s.id === empleadoSucursalId)?.nombre ??
                  `Sucursal #${empleadoSucursalId}`
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            ) : (
              // Administradores: selector libre
              <select
                value={form.idSucursal}
                onChange={(e) => setForm({ ...form, idSucursal: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar sucursal...</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {formError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{formError}</p>}
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
              {saving ? "Registrando..." : "Registrar venta"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
