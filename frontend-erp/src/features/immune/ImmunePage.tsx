import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Scan, CheckCircle } from "lucide-react";
import { api } from "../../api/client";
import type { AnomalyLog, ImmuneStatus, ScanResult, Severity } from "../../types";

const severityConfig: Record<Severity, { label: string; class: string }> = {
  CRITICAL: { label: "Crítico", class: "bg-red-100 text-red-700" },
  HIGH: { label: "Alto", class: "bg-orange-100 text-orange-700" },
  MEDIUM: { label: "Medio", class: "bg-yellow-100 text-yellow-700" },
  LOW: { label: "Bajo", class: "bg-blue-100 text-blue-700" },
};

export function ImmunePage() {
  const [status, setStatus] = useState<ImmuneStatus | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statusRes, anomaliesRes] = await Promise.all([
        api.get<ImmuneStatus>("/immune/status"),
        api.get<AnomalyLog[]>("/immune/anomalies"),
      ]);
      setStatus(statusRes.data);
      setAnomalies(anomaliesRes.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data } = await api.post<ScanResult>("/immune/scan");
      alert(
        `Escaneo completado: ${data.anomaliesFound} anomalía(s) encontrada(s) con ${data.detectorsRun.length} detector(es).`
      );
      fetchData();
    } catch {
      alert("Error al ejecutar escaneo. Verifica tus permisos.");
    } finally {
      setScanning(false);
    }
  };

  const acknowledge = async (id: string) => {
    try {
      await api.patch(`/immune/anomalies/${id}/acknowledge`);
      fetchData();
    } catch {
      // silent
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Cargando sistema inmunológico...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Sistema Inmunológico</h1>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Scan size={16} />
          {scanning ? "Escaneando..." : "Ejecutar escaneo"}
        </button>
      </div>

      {/* Status cards */}
      {status && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={18} className="text-red-500" />
              <span className="text-sm font-medium text-slate-600">Anomalías pendientes</span>
            </div>
            <p className="text-2xl font-semibold text-slate-800">{status.pendingAnomalies}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={18} className="text-green-500" />
              <span className="text-sm font-medium text-slate-600">Total registradas</span>
            </div>
            <p className="text-2xl font-semibold text-slate-800">{status.totalAnomalies}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Scan size={18} className="text-indigo-500" />
              <span className="text-sm font-medium text-slate-600">Detectores activos</span>
            </div>
            <p className="text-2xl font-semibold text-slate-800">{status.detectors.length}</p>
            <div className="mt-2 space-y-1">
              {status.detectors.map((d) => (
                <p key={d.type} className="text-xs text-slate-400">
                  {d.type}: {d.description}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista de anomalías */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-medium text-slate-700">Anomalías detectadas</h2>
        </div>
        {anomalies.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No se han detectado anomalías. Ejecuta un escaneo para analizar el inventario.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className={`px-4 py-3 flex items-start justify-between gap-4 ${
                  anomaly.acknowledged ? "opacity-60" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        severityConfig[anomaly.severity].class
                      }`}
                    >
                      {severityConfig[anomaly.severity].label}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {anomaly.detectorType}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{anomaly.description}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(anomaly.createdAt).toLocaleString("es-CO")}
                  </p>
                </div>
                {!anomaly.acknowledged && (
                  <button
                    onClick={() => acknowledge(anomaly.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <CheckCircle size={14} />
                    Atender
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
