import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventario", icon: Package },
  { to: "/immune", label: "Sistema Inmune", icon: ShieldAlert },
];

export function Sidebar() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-slate-900 text-slate-200">
      {/* Logo / Marca */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
        <div className="w-8 h-8 rounded bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
          E
        </div>
        <span className="text-lg font-semibold tracking-tight">ERP System</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
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
