import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Save, ShieldCheck } from "lucide-react";
import { api } from "../../api/client";
import { usePermisos } from "../../hooks/usePermisos";
import type { RolConPermisos, Permiso } from "../../types";

// Agrupa permisos por módulo
function groupByModule(permisos: Permiso[]) {
  return permisos.reduce<Record<string, Permiso[]>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = [];
    acc[p.modulo].push(p);
    return acc;
  }, {});
}

export function PermisosPage() {
  const can = usePermisos();
  const [roles, setRoles] = useState<RolConPermisos[]>([]);
  const [allPermisos, setAllPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRolId, setSelectedRolId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [expandedModulos, setExpandedModulos] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      api.get<RolConPermisos[]>("/users/roles"),
      api.get<Permiso[]>("/users/permisos"),
    ])
      .then(([r, p]) => {
        setRoles(r.data);
        setAllPermisos(p.data);
        // Expandir todos los módulos por defecto
        const modulos = [...new Set(p.data.map((x) => x.modulo))];
        setExpandedModulos(new Set(modulos));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function selectRol(rol: RolConPermisos) {
    setSelectedRolId(rol.id);
    setCheckedIds(new Set(rol.permisos.map((rp) => rp.permiso.id)));
    setSaveMsg("");
  }

  function togglePermiso(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaveMsg("");
  }

  function toggleModulo(modulo: string, permisosDelModulo: Permiso[]) {
    const ids = permisosDelModulo.map((p) => p.id);
    const allChecked = ids.every((id) => checkedIds.has(id));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
    setSaveMsg("");
  }

  function toggleExpandModulo(modulo: string) {
    setExpandedModulos((prev) => {
      const next = new Set(prev);
      if (next.has(modulo)) next.delete(modulo);
      else next.add(modulo);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedRolId) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await api.put<RolConPermisos>(`/users/roles/${selectedRolId}/permisos`, {
        permisoIds: Array.from(checkedIds),
      });
      // Actualizar en local
      setRoles((prev) =>
        prev.map((r) => (r.id === selectedRolId ? res.data : r)),
      );
      setSaveMsg("Permisos guardados correctamente.");
    } catch {
      setSaveMsg("Error al guardar los permisos.");
    } finally {
      setSaving(false);
    }
  }

  const grouped = groupByModule(allPermisos);
  const selectedRol = roles.find((r) => r.id === selectedRolId);

  const moduloLabels: Record<string, string> = {
    inventario: "Inventario",
    compras: "Compras",
    ventas: "Ventas",
    proveedores: "Proveedores",
    sucursales: "Sucursales",
    usuarios: "Usuarios",
    reportes: "Reportes",
    anomalias: "Anomalías",
    sistema: "Sistema",
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Permisos por rol</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Selecciona un rol para ver y modificar sus permisos de acceso
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-12 text-center">Cargando...</p>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Panel izquierdo: lista de roles */}
          <div className="w-56 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Roles</p>
            </div>
            <ul>
              {roles.map((rol) => (
                <li key={rol.id}>
                  <button
                    onClick={() => selectRol(rol)}
                    className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 transition-colors flex items-center gap-2 ${
                      selectedRolId === rol.id
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <ShieldCheck size={14} className="shrink-0 opacity-60" />
                    {rol.nombre}
                    <span className="ml-auto text-xs text-slate-400 font-normal">
                      {rol.permisos.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Panel derecho: permisos del rol seleccionado */}
          {!selectedRol ? (
            <div className="flex-1 bg-white rounded-xl border border-slate-200 flex items-center justify-center min-h-[300px]">
              <p className="text-sm text-slate-400">Selecciona un rol para editar sus permisos</p>
            </div>
          ) : (
            <div className="flex-1 space-y-4">
              {/* Header del panel */}
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">{selectedRol.nombre}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {checkedIds.size} de {allPermisos.length} permisos habilitados
                  </p>
                </div>
                {can("sistema:configurar") && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <Save size={14} />
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                )}
              </div>

              {saveMsg && (
                <p
                  className={`text-sm px-4 py-2 rounded-lg ${
                    saveMsg.includes("Error")
                      ? "bg-red-50 text-red-600"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {saveMsg}
                </p>
              )}

              {/* Permisos agrupados por módulo */}
              <div className="space-y-3">
                {Object.entries(grouped).map(([modulo, permisosModulo]) => {
                  const checkedCount = permisosModulo.filter((p) => checkedIds.has(p.id)).length;
                  const allChecked = checkedCount === permisosModulo.length;
                  const expanded = expandedModulos.has(modulo);

                  return (
                    <div key={modulo} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {/* Header módulo */}
                      <div className="flex items-center px-5 py-3 border-b border-slate-100 bg-slate-50 gap-3">
                        {can("sistema:configurar") && (
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={() => toggleModulo(modulo, permisosModulo)}
                            className="accent-indigo-600 w-4 h-4 cursor-pointer"
                          />
                        )}
                        <span className="text-sm font-semibold text-slate-700 flex-1">
                          {moduloLabels[modulo] ?? modulo}
                        </span>
                        <span className="text-xs text-slate-400">
                          {checkedCount}/{permisosModulo.length}
                        </span>
                        <button
                          onClick={() => toggleExpandModulo(modulo)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {/* Permisos del módulo */}
                      {expanded && (
                        <div className="divide-y divide-slate-50">
                          {permisosModulo.map((p) => (
                            <label
                              key={p.id}
                              className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${
                                can("sistema:configurar")
                                  ? "hover:bg-slate-50"
                                  : "cursor-default"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checkedIds.has(p.id)}
                                onChange={() => can("sistema:configurar") && togglePermiso(p.id)}
                                disabled={!can("sistema:configurar")}
                                className="accent-indigo-600 w-4 h-4"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-mono text-slate-700">{p.codigo}</span>
                                {p.descripcion && (
                                  <span className="text-xs text-slate-400 ml-2">{p.descripcion}</span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 capitalize">{p.accion}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
