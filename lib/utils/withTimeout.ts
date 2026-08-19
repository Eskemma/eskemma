// lib/utils/withTimeout.ts
// Extraído de app/api/geo/options/route.ts (P2 del rediseño de
// territorio, 26-08-15) — convierte un cuelgue silencioso en un error
// visible con el que el cliente ya sabe degradar (mismo criterio de todo
// el workstream: nunca bloquear indefinidamente). Reutilizado por
// /api/geo/resolver-municipio (Fase 5, Ronda 8, 26-08-18) para no
// duplicar la misma lógica.
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) esperando ${label}`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
