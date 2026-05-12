import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Store,
  BarChart2,
  ShoppingCart,
  TrendingUp,
  Truck,
  ShieldAlert,
  Users,
  KeyRound,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { usePermisos } from "../../hooks/usePermisos";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permiso: null },
  { to: "/inventory", label: "Productos", icon: Package, permiso: "inventario:ver" },
  { to: "/sucursales", label: "Sucursales", icon: Store, permiso: "inventario:ver" },
  { to: "/stock", label: "Stock", icon: BarChart2, permiso: "inventario:ver" },
  { to: "/ventas", label: "Ventas", icon: TrendingUp, permiso: "ventas:ver" },
  { to: "/compras", label: "Compras", icon: ShoppingCart, permiso: "compras:ver" },
  { to: "/proveedores", label: "Proveedores", icon: Truck, permiso: "compras:ver" },
  { to: "/immune", label: "Sistema Inmune", icon: ShieldAlert, permiso: "anomalias:ver" },
];

const adminItems = [
  { to: "/usuarios", label: "Usuarios", icon: Users, permiso: "usuarios:ver" },
  { to: "/permisos", label: "Permisos", icon: KeyRound, permiso: "usuarios:ver" },
];

export function Sidebar() {
  const logout = useAuthStore((s) => s.logout);
  const can = usePermisos();

  const visibleNav = navItems.filter((item) => !item.permiso || can(item.permiso));
  const visibleAdmin = adminItems.filter((item) => can(item.permiso));

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-slate-900 text-slate-200">
      {/* Logo / Marca */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
        <div className="w-8 h-8 rounded bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
          E
        </div>
        <span className="text-lg font-semibold tracking-tight">ERP System</span>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        {/* Sección de administración */}
        {visibleAdmin.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Administración
              </p>
            </div>
            {visibleAdmin.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-600/20 text-indigo-300"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
