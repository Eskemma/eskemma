// C4b-1b — siembra para las pruebas de `resultados/volver` (no es una prueba). Deja un proyecto con historial REAL de F3
// registrado por el mismo núcleo de producción (`prepararVersion`/`aplicarVersion`) y el documento del resultado tal como
// lo dejarían las rutas: v1 = entrega, v2 = reentrega con otro texto, v3 = aprobación (si `aprobado`). El destino habitual
// de «volver» es la v1 (`f3Resultado:r1__000001`).
import { Timestamp } from "firebase-admin/firestore";
import type { AsignacionCanal } from "@/types/moddulo.types";
import { estadoResultado, nombreResultado, selloDeAprobacion, vivoResultado } from "@/lib/moddulo/versionado/artefactosF3";
import { consolidarSemilla, registrarEnSemilla } from "./siembraHistorialF3";
import type { createMockAdminDb } from "./adminMocks";

type Db = ReturnType<typeof createMockAdminDb>;
type Doc = Record<string, unknown>;

export const PID = "p1";
export const RID = "r1";
export const PROYECTO = `moddulo_projects/${PID}`;
export const RESULTADO = `${PROYECTO}/f3Resultados/${RID}`;
export const V1 = `${nombreResultado(RID)}__000001`;
export const V2 = `${nombreResultado(RID)}__000002`;
export const V3 = `${nombreResultado(RID)}__000003`;
export const ARCHIVO_V1 = `moddulo/uA/${PID}/f3/${RID}/v1.json`;
export const ARCHIVO_V2 = `moddulo/uA/${PID}/f3/${RID}/v2.json`;
export const CREADO = Timestamp.fromDate(new Date(Date.UTC(2026, 0, 1)));
export const PREGUNTA = "¿Cuál es la percepción de inseguridad en el municipio?";

export const COLABORADORES = [
  { uid: "u1", role: "owner", displayName: "Raúl" },
  { uid: "u2", role: "co-consultant", displayName: "Ana" },
  { uid: "u3", role: "analyst", displayName: "Luis" },
  { uid: "u4", role: "client", displayName: "Candidata" },
];

const base = (extracto: string, archivo: string): Doc => ({
  moduloPIP: PREGUNTA,
  origen: { sourceKind: "T10", componente: "centinela", analisisId: RID, fechaEntrega: "2026-01-01T00:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: archivo, extractoTexto: extracto },
});
export const DOC_V1 = base("texto v1", ARCHIVO_V1);
export const DOC_V2 = base("texto v2", ARCHIVO_V2);

// id DERIVADO (empieza con el pipItemId de su tarea) y id LEGADO (`${numero}-0`): la lógica no debe depender de la forma.
export const ID_DERIVADO = "t1_canal1_primaria_T10";
export const ID_LEGADO = "2-0";
export const asig = (id: string, extra: Partial<AsignacionCanal> = {}): AsignacionCanal =>
  ({ asignacionId: id, tipo: "primaria", canal: "canal1", tecnicaId: "T10", justificacion: "j", estado: "recibido", activada: true, resultadoId: RID, ...extra }) as AsignacionCanal;

export interface OpcionesSiembra {
  /** El resultado vivo está aprobado (con notas) y hay una v3 con el sello. Por defecto true. */
  aprobado?: boolean;
  /** Asignaciones del tablero: las de id `ID_LEGADO` van a la tarea t2, las demás a la t1. */
  asignaciones?: AsignacionCanal[];
  /** Campos extra de `phases.investigacion` (síntesis, veredicto, f3DIE…). */
  inv?: Doc;
  /** Campos extra del documento del resultado vivo (p. ej. `compatibilidad`, que la versión no tiene). */
  extraVivo?: Doc;
  /** Solo historial de la entrega (v1) y el resultado vivo igual a la v1 → la v1 ES la vigente. */
  soloEntrega?: boolean;
  /** Sin `createdAt` en el documento vivo. */
  sinCreatedAt?: boolean;
  colaboradores?: Doc[];
}

export async function sembrarVolver(db: Db, o: OpcionesSiembra = {}): Promise<{ docVivo: Doc }> {
  const aprobado = o.soloEntrega ? false : o.aprobado ?? true;
  const asignaciones = o.asignaciones ?? [asig(ID_DERIVADO)];
  const tablero = [
    { pipItemId: "t1", asignaciones: asignaciones.filter((a) => a.asignacionId !== ID_LEGADO) },
    { pipItemId: "t2", asignaciones: asignaciones.filter((a) => a.asignacionId === ID_LEGADO) },
  ];
  db.reset({
    [PROYECTO]: {
      userId: "u1", name: "Proyecto", collaborators: o.colaboradores ?? COLABORADORES,
      phases: {
        exploracion: { dvs: { pip: [{ pipItemId: "t1", numero: 1, pregunta: PREGUNTA }, { pipItemId: "t2", numero: 2, pregunta: "otra" }], semaforo: [] } },
        investigacion: { f3TareasPIP: tablero, ...(o.inv ?? {}) },
      },
    },
  });
  db.rechazarUndefined(true);
  db.atomico(true);
  const conCreado = (d: Doc): Doc => (o.sinCreatedAt ? d : { ...d, createdAt: CREADO });
  const art = nombreResultado(RID);

  // v1 — entrega
  await registrarEnSemilla(db, PROYECTO, [{ artefacto: art, ...estadoResultado(DOC_V1), vivo: vivoResultado(DOC_V1) }], { tipoCambio: "entrega", por: "uA" });
  consolidarSemilla(db, PROYECTO);
  let docVivo: Doc = DOC_V1;
  if (!o.soloEntrega) {
    // v2 — reentrega con otro texto
    await registrarEnSemilla(db, PROYECTO, [
      { artefacto: art, ...estadoResultado(DOC_V2), vivo: vivoResultado(DOC_V2), estadoPrevio: estadoResultado(DOC_V1), vivoPrevio: vivoResultado(DOC_V1) },
    ], { tipoCambio: "reentrega", por: "uA" });
    consolidarSemilla(db, PROYECTO);
    docVivo = DOC_V2;
    if (aprobado) {
      const aprobadoDoc = { ...DOC_V2, aprobado: true, notasUsuario: "notas viejas" };
      await registrarEnSemilla(db, PROYECTO, [
        {
          artefacto: art, ...estadoResultado(aprobadoDoc, selloDeAprobacion(aprobadoDoc, "uA", "2026-11-01T10:00:00.000Z")), vivo: vivoResultado(aprobadoDoc),
          estadoPrevio: estadoResultado(DOC_V2), vivoPrevio: vivoResultado(DOC_V2),
        },
      ], { motivo: "aprobacion", por: "uA" });
      consolidarSemilla(db, PROYECTO);
      docVivo = aprobadoDoc;
    }
  }
  const vivoFinal = conCreado({ ...docVivo, ...(o.extraVivo ?? {}) });
  db.seed(RESULTADO, vivoFinal);
  // Las asignaciones solo se versionan cuando la ruta las cambia: aquí no hace falta historial previo de ellas.
  consolidarSemilla(db, PROYECTO);
  return { docVivo: vivoFinal };
}
