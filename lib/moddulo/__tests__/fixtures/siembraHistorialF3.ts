// C3a — siembra de HISTORIAL para pruebas de rutas de F3 (no es una prueba). Registra versiones con el MISMO
// código de producción (prepararVersion/aplicarVersion) y deja el documento del proyecto como lo dejaría
// Firestore real: el puntero embebido ya EXPANDIDO (el mock guarda las claves con puntos literales).
import { aplicarVersion, prepararVersion, type CambioArtefacto, type CambioFase } from "@/lib/versionado/registrar";
import { AMBITO_F3, FASE_F3, PUNTERO_F3 } from "@/lib/moddulo/versionado/artefactosF3";
import type { createMockAdminDb } from "./adminMocks";

type Db = ReturnType<typeof createMockAdminDb>;

/** Expande la clave literal `phases.investigacion.revision` del documento del proyecto al objeto anidado. */
export function expandirPuntero(doc: Record<string, unknown>): Record<string, unknown> {
  const copia = structuredClone(doc);
  const valor = copia[PUNTERO_F3];
  if (valor === undefined) return copia;
  delete copia[PUNTERO_F3];
  const phases = (copia.phases ??= {}) as Record<string, Record<string, unknown>>;
  (phases.investigacion ??= {}).revision = valor;
  return copia;
}

/** Registra UNA acción de historial como lo haría una ruta (lee el proyecto, prepara, aplica y deja el puntero). */
export async function registrarEnSemilla(
  db: Db,
  rutaProyecto: string,
  artefactos: CambioArtefacto[],
  extra: Partial<CambioFase> = {}
): Promise<void> {
  const [col, id] = rutaProyecto.split("/");
  await db.runTransaction(async (tx) => {
    const raiz = db.collection(col).doc(id);
    const snap = await tx.get(raiz);
    const plan = await prepararVersion(tx as never, {
      raiz: raiz as never,
      datosRaiz: expandirPuntero((snap.data() ?? {}) as Record<string, unknown>),
      punteroCampo: PUNTERO_F3,
      ambito: AMBITO_F3,
      fase: FASE_F3,
      tipoCambio: "ajuste_manual",
      por: "uidA",
      artefactos,
      ...extra,
    });
    const res = aplicarVersion(tx as never, plan);
    if (res.cambio) await tx.update(raiz, res.updatesRaiz);
  });
}

/** Congela lo sembrado: expande el puntero, reinicia contadores/bitácoras y reactiva los modos del mock. */
export function consolidarSemilla(db: Db, rutaProyecto: string): void {
  const estado = { ...db.snapshot() } as Record<string, unknown>;
  estado[rutaProyecto] = expandirPuntero(estado[rutaProyecto] as Record<string, unknown>);
  db.reset(estado);
  db.rechazarUndefined(true);
  db.atomico(true);
}
