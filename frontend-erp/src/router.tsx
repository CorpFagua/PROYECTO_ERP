import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { InventoryPage } from "./features/inventory/InventoryPage";
import { SucursalesPage } from "./features/inventory/SucursalesPage";
import { StockPage } from "./features/inventory/StockPage";
import { VentasPage } from "./features/inventory/VentasPage";
import { ComprasPage } from "./features/inventory/ComprasPage";
import { ProveedoresPage } from "./features/inventory/ProveedoresPage";
import { ImmunePage } from "./features/immune/ImmunePage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "sucursales", element: <SucursalesPage /> },
      { path: "stock", element: <StockPage /> },
      { path: "ventas", element: <VentasPage /> },
      { path: "compras", element: <ComprasPage /> },
      { path: "proveedores", element: <ProveedoresPage /> },
      { path: "immune", element: <ImmunePage /> },
    ],
  },
]);
