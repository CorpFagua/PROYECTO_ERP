import { useEffect, useState } from "react";
import { Search, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { usePermisos } from "../../hooks/usePermisos";
import { useAuthStore } from "../../stores/authStore";
import type { StockLevel, Sucursal, Product } from "../../types";

interface TransferForm {
  idProducto: string;
  idSucursalOrigen: string;
  idSucursalDestino: string;
  cantidad: string;
}

const emptyTransfer: TransferForm = {
  idProducto: "",
  idSucursalOrigen: "",
  idSucursalDestino: "",
  cantidad: "",
};

export function StockPage() {
  const can = usePermisos();
  const user = useAuthStore((s) => s.user);
  const empleadoSucursalId = user?.empleado?.idSucursal;

  const [stock, setStock] = useState<StockLevel[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Filtro de sucursal solo para admins (sin sucursal fija)
  const [filtroSucursal, setFiltroSucursal] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [transfer, setTransfer] = useState<TransferForm>(emptyTransfer);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [transferOk, setTransferOk] = useState("");

  function buildStockUrl(sucursalId?: string) {
    if (sucursalId) return `/inventory/stock?idSucursal=${sucursalId}`;
    return "/inventory/stock";
  }

  function loadStock(sucursalId?: string) {
    setLoading(true);
    api
      .get<StockLevel[]>(buildStockUrl(sucursalId))
      .then(({ data }) => setStock(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    Promise.all([
      api.get<Sucursal[]>("/inventory/sucursales"),
      api.get<Product[]>("/inventory/products"),
    ]).then(([s, p]) => {
      setSucursales(s.data);
      setProducts(p.data);
    }).catch(() => {});

    loadStock(empleadoSucursalId ? String(empleadoSucursalId) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiltroChange(val: string) {
    setFiltroSucursal(val);
    loadStock(val || undefined);
  }

  const filtered = stock.filter(
    (s) =>
      (s.producto?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.sucursal?.nombre ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const totalItems = stock.reduce((sum, s) => sum + s.cantidad, 0);
  const criticalItems = stock.filter((s) => s.cantidad <= 0).length;

  const sucursalActivaNombre = empleadoSucursalId
    ? (sucursales.find((s) => s.id === empleadoSucursalId)?.nombre ?? `Sucursal #${empleadoSucursalId}`)
    : filtroSucursal
    ? (sucursales.find((s) => String(s.id) === filtroSucursal)?.nombre ?? "")
    : null;

  // Para el modal de transferencia: stock origen por producto/sucursal
  const origenStock = transfer.idProducto && transfer.idSucursalOrigen
    ? stock.find(
        (s) =>
          String(s.idProducto) === transfer.idProducto &&
          String(s.idSucursal) === transfer.idSucursalOrigen,
      )
    : null;

  function openTransfer() {
    setTransfer(emptyTransfer);
    setTransferError("");
    setTransferOk("");
    setModalOpen(true);
  }

  async function handleTransfer() {
    setTransferError("");
    setTransferOk("");
    if (!transfer.idProducto || !transfer.idSucursalOrigen || !transfer.idSucursalDestino || !transfer.cantidad) {
      setTransferError("Todos los campos son obligatorios.");
      return;
    }
    if (transfer.idSucursalOrigen === transfer.idSucursalDestino) {
      setTransferError("Origen y destino no pueden ser la misma sucursal.");
      return;
    }
    const cant = parseInt(transfer.cantidad);
    if (isNaN(cant) || cant < 1) {
      setTransferError("La cantidad debe ser mayor a 0.");
      return;
    }
    setTransferSaving(true);
    try {
      const res = await api.post<{ mensaje: string }>("/inventory/stock/transferir", {
        idProducto: parseInt(transfer.idProducto),
        idSucursalOrigen: parseInt(transfer.idSucursalOrigen),
        idSucursalDestino: parseInt(transfer.idSucursalDestino),
        cantidad: cant,
      });
      setTransferOk(res.data.mensaje);
      // Recargar stock
      loadStock(empleadoSucursalId ? String(empleadoSucursalId) : filtroSucursal || undefined);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setTransferError(e.response?.data?.error ?? "Error al transferir.");
    } finally {
      setTransferSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Stock por sucursal</h1>
          {sucursalActivaNombre && (
            <p className="text-sm text-indigo-600 mt-0.5 font-medium">
              Sucursal: {sucursalActivaNombre}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              Total:{" "}
              <span className="font-semibold text-slate-700">
                {totalItems.toLocaleString("es-CL")} u.
              </span>
            </span>
            {criticalItems > 0 && (
              <span className="flex items-center gap-1.5 text-red-600 font-medium">
                <AlertTriangle size={14} />
                {criticalItems} sin stock
              </span>
            )}
          </div>
          {can("inventario:editar") && (
            <button
              onClick={openTransfer}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ArrowRightLeft size={15} />
              Transferir stock
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        {/* Selector de sucursal — solo para usuarios sin sucursal fija (SUPER_ADMIN, ADMIN) */}
        {!empleadoSucursalId && (
          <select
            value={filtroSucursal}
            onChange={(e) => handleFiltroChange(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por producto o sucursal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando niveles de stock...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {stock.length === 0
              ? "No hay registros de stock. Las compras registradas cargan stock al Depósito."
              : "No se encontraron resultados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Producto</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Tipo</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Sucursal</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-slate-700">{s.producto?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{s.producto?.tipoProducto?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{s.sucursal?.nombre ?? `#${s.idSucursal}`}</td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`font-semibold ${
                        s.cantidad <= 0
                          ? "text-red-600"
                          : s.cantidad <= 10
                          ? "text-amber-600"
                          : "text-slate-700"
                      }`}
                    >
                      {s.cantidad.toLocaleString("es-CL")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal transferencia */}
      <Modal title="Transferir stock entre sucursales" open={modalOpen} onClose={() => setModalOpen(false)} size="md">
        <div className="space-y-4">
          {transferError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{transferError}</p>
          )}
          {transferOk && (
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded px-3 py-2">{transferOk}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Producto</label>
            <select
              value={transfer.idProducto}
              onChange={(e) => setTransfer({ ...transfer, idProducto: e.target.value, idSucursalOrigen: "" })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Seleccionar producto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sucursal origen</label>
              <select
                value={transfer.idSucursalOrigen}
                onChange={(e) => setTransfer({ ...transfer, idSucursalOrigen: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Seleccionar...</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {origenStock !== undefined && transfer.idSucursalOrigen && (
                <p className="text-xs text-slate-400 mt-1">
                  Disponible: <span className="font-medium text-slate-600">{origenStock ? origenStock.cantidad : 0} u.</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sucursal destino</label>
              <select
                value={transfer.idSucursalDestino}
                onChange={(e) => setTransfer({ ...transfer, idSucursalDestino: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Seleccionar...</option>
                {sucursales
                  .filter((s) => String(s.id) !== transfer.idSucursalOrigen)
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad a transferir</label>
            <input
              type="number"
              min="1"
              value={transfer.cantidad}
              onChange={(e) => setTransfer({ ...transfer, cantidad: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cerrar
            </button>
            {!transferOk && (
              <button
                onClick={handleTransfer}
                disabled={transferSaving}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {transferSaving ? "Transfiriendo..." : "Confirmar transferencia"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
