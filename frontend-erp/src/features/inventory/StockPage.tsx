import { useEffect, useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
import { api } from "../../api/client";
import type { StockLevel } from "../../types";

export function StockPage() {
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get<StockLevel[]>("/inventory/stock")
      .then(({ data }) => setStock(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = stock.filter(
    (s) =>
      (s.producto?.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.sucursal?.nombre ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = stock.reduce((sum, s) => sum + s.cantidad, 0);
  const criticalItems = stock.filter((s) => s.cantidad <= 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Stock por Sucursal</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">
            Total: <span className="font-semibold text-slate-700">{totalItems.toLocaleString("es-CL")} unidades</span>
          </span>
          {criticalItems > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
              <AlertTriangle size={14} />
              {criticalItems} sin stock
            </span>
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
          <div className="p-8 text-center text-sm text-slate-500">Cargando niveles de stock...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {stock.length === 0 ? "No hay registros de stock." : "No se encontraron resultados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sucursal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Localidad</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700">{s.producto?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{s.producto?.tipoProducto?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.sucursal?.nombre ?? `ID ${s.idSucursal}`}</td>
                  <td className="px-4 py-3 text-slate-500">{s.sucursal?.localidad?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-semibold ${
                        s.cantidad <= 0
                          ? "text-red-600"
                          : s.cantidad <= 5
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
    </div>
  );
}
