import { useAuthStore } from "../stores/authStore";

/**
 * Devuelve una función `can(permiso)` que comprueba si el usuario
 * autenticado posee ese permiso. Uso: const can = usePermisos()
 */
export function usePermisos() {
  const permisos = useAuthStore((s) => s.user?.permisos ?? []);
  return (permiso: string) => permisos.includes(permiso);
}
