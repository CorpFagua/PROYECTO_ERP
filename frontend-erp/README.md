# Frontend ERP

SPA construida con **React 19 + Vite + TypeScript + Tailwind CSS v4**.

## Estructura

```
src/
├── api/client.ts                     # Axios instance con interceptores JWT
├── components/
│   ├── layout/                       # Sidebar, Header, MainLayout
│   └── ProtectedRoute.tsx            # Guard de autenticación
├── features/
│   ├── auth/LoginPage.tsx            # Login / Registro
│   ├── dashboard/DashboardPage.tsx   # Panel principal
│   ├── inventory/InventoryPage.tsx   # Gestión de productos
│   └── immune/ImmunePage.tsx         # Vista del sistema inmunológico
├── stores/authStore.ts               # Zustand (auth state persistente)
├── types/index.ts                    # Tipos compartidos
├── router.tsx                        # React Router config
├── App.tsx                           # Providers (QueryClient, Router)
└── main.tsx                          # Entry point
```

## Scripts

```bash
npm run dev      # Desarrollo en http://localhost:5173
npm run build    # Build de producción
npm run preview  # Preview del build
```

## Proxy

El servidor de desarrollo tiene configurado un proxy:
- `/api/*` → `http://localhost:3001` (backend)

No es necesario configurar CORS en desarrollo.
