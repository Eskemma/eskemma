import { runFontanaInegiDiagnostics } from "@/lib/dev/fontanaInegiSandbox";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sandbox INEGI BIE — Fontana",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ERROR_LABELS: Record<string, string> = {
  token_missing: "Token no configurado (INEGI_TOKEN ausente)",
  token_invalid: "Token inválido o sin permiso (401/403)",
  indicator_not_found: "Indicador no encontrado en el catálogo (ErrorCode INEGI)",
  network_error: "Error de red / HTTP inesperado",
  timeout: "Tiempo de espera agotado (10s)",
  empty_response: "Respuesta sin observaciones",
  malformed_response: "Formato de respuesta inesperado",
};

export default async function FontanaInegiSandboxPage() {
  const results = await runFontanaInegiDiagnostics();
  const ranAt = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

  return (
    <div className="min-h-screen bg-white-eske dark:bg-[#0D2035] p-6">
      <h1 className="text-2xl font-bold text-black-eske dark:text-white mb-1">
        Sandbox INEGI BIE v2.0 — Fontana (Familia 1)
      </h1>
      <p className="text-sm text-black-eske-60 dark:text-white/50 mb-1 max-w-2xl">
        Diagnóstico de conexión real a la API del Banco de Indicadores de INEGI.
        No es una página de producto — solo prueba de viabilidad técnica.
      </p>
      <p className="text-xs font-mono text-black-eske-60 dark:text-white/40 mb-5">
        API: BIE/BISE v2.0 · formato de clave: numérico (ej. 1002000001) · ejecutado: {ranAt}
      </p>

      <div className="flex flex-col gap-3">
        {results.map((r, i) => (
          <div
            key={i}
            className={
              "rounded border p-4 " +
              (r.ok
                ? "bg-green-eske/5 border-green-eske/30"
                : "bg-red-eske/5 border-red-eske/30")
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-black-eske dark:text-white">
                {r.ok ? "✅" : "❌"} {r.case.label}
              </span>
              <span className="text-xs font-mono text-black-eske-60 dark:text-white/50">
                {r.case.source} · area={r.case.area} · id={r.case.id} · {Math.round(r.responseTimeMs)}ms
              </span>
            </div>

            {r.ok ? (
              <p className="mt-1 text-sm text-black-eske dark:text-white/80">
                Valor: <strong>{r.value?.toLocaleString("es-MX")}</strong>
                {r.unit ? ` (unidad código: ${r.unit})` : ""} — periodo {r.date}
              </p>
            ) : (
              <p className="mt-1 text-sm text-red-eske">
                {r.errorKind ? ERROR_LABELS[r.errorKind] : "Error desconocido"}
                {r.errorDetail ? ` — ${r.errorDetail}` : ""}
              </p>
            )}

            <details className="mt-2">
              <summary className="text-xs text-black-eske-60 dark:text-white/50 cursor-pointer">
                Ver JSON crudo y URL de solicitud
              </summary>
              <p className="mt-2 text-xs font-mono break-all text-black-eske-60 dark:text-white/40">
                {r.requestUrl || "(sin solicitud — token ausente)"}
              </p>
              <pre className="mt-1 text-xs bg-gray-eske-10 dark:bg-white/5 p-2 rounded overflow-x-auto text-black-eske dark:text-white/80">
                {JSON.stringify(r.rawResponse, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-black-eske-60 dark:text-black-eske-40">
        Página temporal de diagnóstico. Eliminar antes de producción.
      </p>
    </div>
  );
}
