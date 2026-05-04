import { useAuthStore } from "../../stores/authStore";

export function Header() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-slate-200">
      <h2 className="text-sm font-medium text-slate-500">
        Sistema de Gestión Empresarial
      </h2>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">{user?.name}</p>
          <p className="text-xs text-slate-400">{user?.rol}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-semibold">
          {user?.name?.charAt(0).toUpperCase() ?? "U"}
        </div>
      </div>
    </header>
  );
}
