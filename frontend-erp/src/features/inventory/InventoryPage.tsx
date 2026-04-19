import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "../../api/client";
import type { Product } from "../../types";

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get<Product[]>("/inventory/products");
      setProducts(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Inventario</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo producto
        </button>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <CreateProductForm
          onCreated={() => {
            setShowForm(false);
            fetchProducts();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Buscador */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder="Buscar por nombre, SKU o categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando productos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {products.length === 0
              ? "No hay productos registrados. Crea el primero."
              : "No se encontraron resultados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unidad</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Stock Mín</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Stock Máx</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {product.sku}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{product.name}</td>
                  <td className="px-4 py-3 text-slate-600">{product.category}</td>
                  <td className="px-4 py-3 text-slate-600">{product.unit}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{product.minStock}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {product.maxStock ?? "—"}
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

// ─── Formulario de creación ──────────────────────────────────

function CreateProductForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    unit: "unidad",
    minStock: 0,
    maxStock: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/inventory/products", {
        ...form,
        minStock: Number(form.minStock),
        maxStock: form.maxStock ? Number(form.maxStock) : undefined,
      });
      onCreated();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error ?? "Error al crear producto");
      } else {
        setError("Error de conexión");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
      <h2 className="text-base font-medium text-slate-700 mb-4">Nuevo producto</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          required
          placeholder="SKU"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          required
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          required
          placeholder="Categoría"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          placeholder="Unidad (ej: kg, litro, unidad)"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="number"
          min="0"
          placeholder="Stock mínimo"
          value={form.minStock}
          onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="number"
          min="0"
          placeholder="Stock máximo (opcional)"
          value={form.maxStock}
          onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {error && (
          <p className="col-span-full text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="col-span-full flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
