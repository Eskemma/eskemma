// C1b-1 — siembra de HISTORIAL para pruebas de rutas de F2 (no es una prueba). Registra versiones del artefacto
// `f2M1` con el MISMO código de producción (prepararVersion/aplicarVersion) y deja el documento del proyecto como lo
// dejaría Firestore real: las claves con puntos de un `update()` expandidas y los `FieldValue.delete()` aplicados.
// (El mock guarda las claves de un update literales; las pruebas encadenan rutas —aprobar → reabrir → aprobar—, así que
// entre una y otra hay que «consolidar».)
import type { createMockAdminDb } from "./adminMocks";
import { registrarEnSemilla } from "./siembraHistorialF3";
import {
  AMBITO_F2, FASE_F2, NOMBRE_F2_M1, PUNTERO_F2, estadoF2M1, vivoF2M1, type ExploracionCruda, type SelloF2,
} from "@/lib/moddulo/versionado/artefactosF2";

/** El stub de `FieldValue.delete()` que usan las pruebas de rutas de M1 (`vi.mock("firebase-admin/firestore")`). */
export const FIELD_DELETE_STUB = "__DELETE__";

type Db = ReturnType<typeof createMockAdminDb>;
type Doc = Record<string, unknown>;

/** Copia profunda que conserva los objetos NO planos (Timestamp…): `structuredClone` les quitaría el prototipo. */
export function clonar<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clonar) as unknown as T;
  if (v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v as Doc).map(([k, x]) => [k, clonar(x)])) as T;
  }
  return v;
}

/** Aplica las claves con puntos como Firestore: `FieldValue.delete()` (el stub) borra la ruta; lo demás la fija. */
export function expandirFirestore(doc: Doc): Doc {
  const copia = clonar(doc);
  for (const [clave, valor] of Object.entries(copia)) {
    if (!clave.includes(".")) continue;
    delete copia[clave];
    const partes = clave.split(".");
    let cur = copia;
    for (const p of partes.slice(0, -1)) {
      if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
      cur = cur[p] as Doc;
    }
    const hoja = partes.at(-1) as string;
    if (valor === FIELD_DELETE_STUB) delete cur[hoja];
    else cur[hoja] = valor;
  }
  return copia;
}

/** Congela el estado (como lo dejaría Firestore), reinicia bitácoras y contadores y reactiva los modos del mock. */
export function consolidarF2(db: Db, ruta: string): void {
  const estado = { ...db.snapshot() } as Doc;
  estado[ruta] = expandirFirestore(estado[ruta] as Doc);
  db.reset(estado);
  db.rechazarUndefined(true);
  db.atomico(true);
}

/** `phases.exploracion` del proyecto tal como está ahora (expandido). */
export function exploracionDe(db: Db, ruta: string): ExploracionCruda & Doc {
  const doc = expandirFirestore(db.snapshot()[ruta] as Doc) as { phases?: { exploracion?: ExploracionCruda & Doc } };
  return (doc.phases?.exploracion ?? {}) as ExploracionCruda & Doc;
}

/** Registra en el historial el estado ACTUAL del M1 (como lo dejaría una acción previa) y consolida. */
export async function registrarVigenteF2(db: Db, ruta: string, sello?: SelloF2): Promise<void> {
  const exp = exploracionDe(db, ruta);
  await registrarEnSemilla(
    db, ruta,
    [{ artefacto: NOMBRE_F2_M1, ...estadoF2M1(exp, sello), vivo: vivoF2M1(exp) }],
    { punteroCampo: PUNTERO_F2, ambito: AMBITO_F2, fase: FASE_F2 }
  );
  consolidarF2(db, ruta);
}

export interface VersionGuardada extends Doc {
  id: string; n: number; tipoCambio: string; por: unknown; en: unknown; estado: string;
  contenido?: { kind: unknown; mapa: unknown; ediciones: unknown };
  aprobacion?: Doc; deriva?: boolean; huella: string; motivo?: string;
}
const bajo = (db: Db, ruta: string, sub: string) => Object.entries(db.snapshot()).filter(([k]) => k.startsWith(`${ruta}/${sub}/`));
export const versionesDe = (db: Db, ruta: string): VersionGuardada[] =>
  bajo(db, ruta, "versiones").map(([k, v]) => ({ id: k.split("/").pop() as string, ...(v as Doc) }) as VersionGuardada).sort((a, b) => a.id.localeCompare(b.id));
export const revisionesDe = (db: Db, ruta: string) => bajo(db, ruta, "revisiones").map(([k, v]) => ({ id: k.split("/").pop() as string, ...(v as Doc) }));
export const eventosDe = (db: Db, ruta: string) => bajo(db, ruta, "eventos").map(([, v]) => v as Doc);
