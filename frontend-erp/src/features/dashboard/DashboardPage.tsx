import { useEffect, useState } from "react";
import { Package, Warehouse, TrendingUp, ShieldAlert } from "lucide-react";
import { api } from "../../api/client";
import type { Product, StockLevel, ImmuneStatus } from "../../types";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
}

export function DashboardPage() {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [productsRes, stockRes, immuneRes] = await Promise.all([
          api.get<Product[]>("/inventory/products"),
          api.get<StockLevel[]>("/inventory/stock"),
          api.get<ImmuneStatus>("/immune/status").catch(() => ({ data: null })),
        ]);

        const products = productsRes.data;
        const stock = stockRes.data;
        const immune = immuneRes.data;

        setStats([
          {
            label: "Productos registrados",
            value: products.length,
            icon: Package,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Items en stock",
            value: stock.reduce((sum, s) => sum + s.quantity, 0),
            icon: TrendingUp,
            color: "bg-green-50 text-green-600",
          },
          {
            label: "Bodegas activas",
            value: new Set(stock.map((s) => s.warehouseId)).size,
            icon: Warehouse,
            color: "bg-purple-50 text-purple-600",
          },
          {
            label: "Anomalías pendientes",
            value: immune?.pendingAnomalies ?? 0,
            icon: ShieldAlert,
            color: "bg-red-50 text-red-600",
          },
        ]);
      } catch {
        // Si la API no está disponible, muestra stats vacíos
        setStats([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-sm text-slate-500">Cargando estadísticas...</div>
      ) : stats.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500 text-sm">
            No se pudieron cargar las estadísticas. Verifica que el backend esté corriendo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon size={18} />
                </div>
              </div>
              <p className="text-2xl font-semibold text-slate-800">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Placeholder para futuras secciones */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-medium text-slate-700 mb-2">Actividad reciente</h2>
        <p className="text-sm text-slate-400">
          Los movimientos de inventario recientes aparecerán aquí.
        </p>
      </div>
    </div>
  );
}
