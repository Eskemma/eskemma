import { runFontanaIterDiagnostics } from "@/lib/dev/fontanaIterSandbox";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sandbox ITER — Fontana",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FontanaIterSandboxPage() {
  const diag = runFontanaIterDiagnostics();
  const ranAt = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

  return (
    <div className="min-h-screen bg-white-eske dark:bg-[#0D2035] p-6">
      <h1 className="text-2xl font-bold text-black-eske dark:text-white mb-1">
        Sandbox ITER — Fontana (Familia 1)
      </h1>
      <p className="text-sm text-black-eske-60 dark:text-white/50 mb-1 max-w-2xl">
        Diagnóstico de descarga + parseo local del ITER (Censo de Población y Vivienda 2020).
        Segundo mecanismo de acceso de Familia 1 — no usa token ni endpoint HTTP por indicador.
      </p>
      <p className="text-xs font-mono text-black-eske-60 dark:text-white/40 mb-5">
        Fuente: archivo real Jalisco (MUN=14) · ejecutado: {ranAt}
      </p>

      {!diag.archivoEncontrado || diag.error ? (
        <div className="rounded border border-red-eske/30 bg-red-eske/5 p-4">
          <p className="font-semibold text-red-eske">❌ {diag.error}</p>
          <p className="mt-2 text-xs font-mono break-all text-black-eske-60 dark:text-white/40">
            {diag.rutaArchivo}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded border border-green-eske/30 bg-green-eske/5 p-4">
            <p className="font-semibold text-black-eske dark:text-white">
              ✅ Archivo parseado — {diag.totalFilas?.toLocaleString("es-MX")} filas totales
            </p>
            <p className="mt-1 text-xs font-mono break-all text-black-eske-60 dark:text-white/40">
              {diag.rutaArchivo}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold text-black-eske dark:text-white mb-2">
              Extracto mínimo + clasificación urbano/rural (umbral TAMLOC ≥ 05, 2,500 hab.)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Ejemplo urbano", row: diag.ejemploUrbano },
                { label: "Ejemplo rural", row: diag.ejemploRural },
              ].map(({ label, row }) => (
                <div
                  key={label}
                  className={
                    "rounded border p-4 " +
                    (row ? "bg-green-eske/5 border-green-eske/30" : "bg-red-eske/5 border-red-eske/30")
                  }
                >
                  <p className="font-semibold text-black-eske dark:text-white">
                    {row ? "✅" : "❌"} {label}
                  </p>
                  {row ? (
                    <p className="mt-1 text-sm font-mono text-black-eske dark:text-white/80">
                      {row.nomLoc} (LOC={row.loc}) — POBTOT={row.pobtot.toLocaleString("es-MX")} —
                      TAMLOC={row.tamloc} → <strong>{row.clasificacion}</strong>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-red-eske">No se encontró ejemplo en este municipio.</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-black-eske dark:text-white mb-2">
              Pirámide quinquenal (18 grupos, P_0A4…P_85YMAS) vs. POBTOT
            </h2>
            <div className="flex flex-col gap-3">
              {diag.piramide?.map((p) => (
                <div key={p.nivel} className="rounded border border-blue-eske/20 bg-blue-eske/5 p-4">
                  <p className="font-semibold text-black-eske dark:text-white">{p.nivel}</p>
                  <p className="mt-1 text-sm font-mono text-black-eske dark:text-white/80">
                    POBTOT={p.pobtot.toLocaleString("es-MX")} · suma 18 grupos=
                    {p.sumaQuinquenal.toLocaleString("es-MX")} · diferencia=
                    {p.diferencia.toLocaleString("es-MX")}
                    {p.diferencia !== 0 && " (POB_EDADNE — no está en ITER, esperado)"}
                  </p>
                  <details className="mt-2">
                    <summary className="text-xs text-black-eske-60 dark:text-white/50 cursor-pointer">
                      Ver los 18 grupos
                    </summary>
                    <pre className="mt-1 text-xs bg-gray-eske-10 dark:bg-white/5 p-2 rounded overflow-x-auto text-black-eske dark:text-white/80">
                      {JSON.stringify(p.porGrupo, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-black-eske-60 dark:text-black-eske-40">
        Página temporal de diagnóstico. Eliminar antes de producción.
      </p>
    </div>
  );
}
