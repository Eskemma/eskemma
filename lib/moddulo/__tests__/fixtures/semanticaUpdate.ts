// Applies the object of a Firestore `update()` to a plain document with the REAL semantics of dotted paths:
// every key is a field path ("a.b.c" sets c inside b inside a, creating the intermediate maps and keeping
// their other fields), a value that is an object REPLACES the leaf at that path, and the delete sentinel
// removes it. The shared mock (adminMocks) records the keys but does not interpret them; this does.
export const BORRAR = "FIELD_DELETE";

export function aplicarUpdateFirestore(doc: Record<string, unknown>, cambios: Record<string, unknown>): Record<string, unknown> {
  const salida = structuredClone(doc);
  for (const [ruta, valor] of Object.entries(cambios)) {
    const partes = ruta.split(".");
    let actual = salida as Record<string, unknown>;
    for (const p of partes.slice(0, -1)) {
      if (typeof actual[p] !== "object" || actual[p] === null) actual[p] = {};
      actual = actual[p] as Record<string, unknown>;
    }
    const hoja = partes[partes.length - 1];
    if (valor === BORRAR) delete actual[hoja];
    else actual[hoja] = structuredClone(valor);
  }
  return salida;
}
