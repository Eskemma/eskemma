// lib/moddulo/serializacionEstable.ts
// JSON serialization that does NOT depend on key order: object keys are sorted
// recursively, arrays keep their order. Used to compare two DVS snapshots and to
// build the impact fingerprint (the same content must always give the same
// string, whatever order Firestore or the client returned the keys in).

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor !== null && typeof valor === "object") {
    const origen = valor as Record<string, unknown>;
    const salida: Record<string, unknown> = {};
    for (const clave of Object.keys(origen).sort()) {
      if (origen[clave] !== undefined) salida[clave] = ordenar(origen[clave]);
    }
    return salida;
  }
  return valor;
}

export function serializacionEstable(valor: unknown): string {
  return JSON.stringify(ordenar(valor));
}

export function sonIgualesEstable(a: unknown, b: unknown): boolean {
  return serializacionEstable(a) === serializacionEstable(b);
}
