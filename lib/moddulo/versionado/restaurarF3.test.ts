// C4b-1a — lógica propia de F3 de «volver»: bloqueo, reinicio por resultadoId (id legado y derivado), documento restaurado,
// archivo, detalle del evento y — sobre todo — que «volver» NO marca deriva (el `vivo` se arma con lo que se escribe).
// Mock fiel (Timestamp reales, transacciones atómicas, rechazo de `undefined`). Sin emulador (Java 17).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const orig = await importOriginal<typeof import("firebase-admin/firestore")>();
  return { ...orig, FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => orig.Timestamp.fromDate(new Date(Date.UTC(2026, 10, 25, 9, 0, 0))) } };
});

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { huellaContenido } from "@/lib/versionado/huella";
import { aplicarVersion, prepararVersion } from "@/lib/versionado/registrar";
import { normalizeTareaPIP } from "@/lib/moddulo/project";
import type { AsignacionCanal } from "@/types/moddulo.types";
import { AMBITO_F3, FASE_F3, PUNTERO_F3, estadoAsignacion, estadoResultado, nombreAsignacion, nombreResultado, vivoAsignacion, vivoResultado } from "./artefactosF3";
import { detectarDeriva } from "./derivaVivo";
import { leerHistorialFase } from "./leerHistorial";
import { armarCambioRestauracion, huellaRestauracion } from "./restaurar";
import {
  MOTIVO_RESTAURACION, artefactosDeVolver, asignacionesDelResultado, decidirVolverF3, detalleDeVolver, documentoRestaurado,
  extrasHuellaVolver, reiniciarAsignacionesDelResultado, rutaDeArchivoVerificable, type TareaTablero,
} from "./restaurarF3";
import { consolidarSemilla, expandirPuntero, registrarEnSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const firestore = adminDb as unknown as Firestore;
type Doc = Record<string, unknown>;

const P = "moddulo_projects/p1";
const asig = (id: string, extra: Partial<AsignacionCanal> = {}): AsignacionCanal =>
  ({ asignacionId: id, tipo: "primaria", canal: "canal1", tecnicaId: "T10", justificacion: "j", estado: "recibido", activada: true, resultadoId: "r1", ...extra }) as AsignacionCanal;
// id DERIVADO (empieza con el pipItemId de su tarea) y id LEGADO (`${numero}-0`): la lógica no debe depender de la forma.
const DERIVADO = "t1_canal1_primaria_T10";
const LEGADO = "2-0";
const tablero = (...as: AsignacionCanal[]): TareaTablero[] => [
  { pipItemId: "t1", asignaciones: as.filter((a) => a.asignacionId === DERIVADO || a.asignacionId === "otra") },
  { pipItemId: "t2", asignaciones: as.filter((a) => a.asignacionId === LEGADO) },
];

// ---------------------------------------------------------------- bloqueo (D4)
describe("decidirVolverF3", () => {
  it("nada emitido → continúa (aunque exista síntesis o un veredicto en borrador)", () => {
    expect(decidirVolverF3({})).toEqual({ accion: "continuar" });
    expect(decidirVolverF3({ sintesis: {}, veredicto: { aprobadoPorUsuario: false } })).toEqual({ accion: "continuar" });
  });
  it("Reporte F3 emitido → bloqueado con el texto exacto, sin siglas", () => {
    const d = decidirVolverF3({ die: { x: 1 }, veredicto: { aprobadoPorUsuario: true } });
    expect(d).toEqual({
      accion: "bloqueado",
      mensaje: "Ya se emitió el «Reporte F3». Mientras exista no se puede volver a una versión anterior de un resultado.",
    });
    expect((d as { mensaje: string }).mensaje).not.toMatch(/\b(HEI|DIE)\b/);
  });
  it("veredicto aprobado sin Reporte (anómalo) → bloqueado sin afirmar un Reporte ni usar siglas", () => {
    const d = decidirVolverF3({ veredicto: { aprobadoPorUsuario: true } }) as { accion: string; mensaje: string };
    expect(d.accion).toBe("bloqueado");
    expect(d.mensaje).not.toContain("Reporte F3");
    expect(d.mensaje).not.toMatch(/\b(HEI|DIE)\b/);
  });
});

// ---------------------------------------------------------------- reinicio (D1)
describe("asignacionesDelResultado / reiniciarAsignacionesDelResultado", () => {
  it("busca por `resultadoId`, con id derivado Y con id legado (la forma del id no cuenta)", () => {
    const t = tablero(asig(DERIVADO), asig(LEGADO), asig("otra", { resultadoId: "r9" }));
    expect(asignacionesDelResultado(t, "r1").map((a) => a.asignacionId).sort()).toEqual([LEGADO, DERIVADO].sort());
  });
  it("0 asignaciones: el tablero queda igual y no hay nada que reiniciar", () => {
    const t = tablero(asig(DERIVADO, { resultadoId: "r9" }));
    const r = reiniciarAsignacionesDelResultado(t, "r1");
    expect(r.reiniciadas).toEqual([]);
    expect(r.tablero).toEqual(t);
  });
  it("1 asignación (id derivado): en_curso y SIN la clave resultadoId (no undefined)", () => {
    const r = reiniciarAsignacionesDelResultado(tablero(asig(DERIVADO), asig(LEGADO, { resultadoId: "r9" })), "r1");
    expect(r.reiniciadas).toHaveLength(1);
    const nueva = r.reiniciadas[0].nueva;
    expect(nueva.estado).toBe("en_curso");
    expect("resultadoId" in nueva).toBe(false);
    expect(JSON.stringify(r.tablero)).not.toContain("undefined");
    expect(r.tablero[1].asignaciones[0].resultadoId).toBe("r9"); // otra tarea, otro resultado: intacta
  });
  it("1 asignación (id LEGADO) se reinicia igual", () => {
    const r = reiniciarAsignacionesDelResultado(tablero(asig(LEGADO)), "r1");
    expect(r.reiniciadas.map((x) => x.previa.asignacionId)).toEqual([LEGADO]);
  });
  it("varias: se reinician TODAS las que apuntan al resultado, nunca una sola", () => {
    const r = reiniciarAsignacionesDelResultado(tablero(asig(DERIVADO), asig(LEGADO)), "r1");
    expect(r.reiniciadas).toHaveLength(2);
    expect(r.tablero.flatMap((t) => t.asignaciones).every((a) => a.estado === "en_curso" && !("resultadoId" in a))).toBe(true);
  });
  it("`activada` no se toca (también si está apagada) y el resto de la asignación se conserva", () => {
    const r = reiniciarAsignacionesDelResultado(tablero(asig(DERIVADO, { activada: false })), "r1");
    expect(r.reiniciadas[0].nueva).toMatchObject({ activada: false, canal: "canal1", tecnicaId: "T10", justificacion: "j", tipo: "primaria" });
  });
  it("una «derivada» anómala con ese resultadoId también se reinicia (D1 literal)", () => {
    const r = reiniciarAsignacionesDelResultado(tablero(asig(DERIVADO, { estado: "derivado" })), "r1");
    expect(r.reiniciadas).toHaveLength(1);
    expect(r.reiniciadas[0].nueva.estado).toBe("en_curso");
  });
  it("payload explícito {pipItemId, asignaciones}: no arrastra otras claves de la tarea", () => {
    const t = [{ pipItemId: "t1", numero: 3, extra: "x", asignaciones: [asig(DERIVADO)] }] as unknown as TareaTablero[];
    expect(Object.keys(reiniciarAsignacionesDelResultado(t, "r1").tablero[0]).sort()).toEqual(["asignaciones", "pipItemId"]);
  });
  it("no muta el tablero de entrada", () => {
    const t = tablero(asig(DERIVADO));
    const copia = structuredClone(t);
    reiniciarAsignacionesDelResultado(t, "r1");
    expect(t).toEqual(copia);
  });
});

// ---------------------------------------------------------------- documento restaurado
describe("documentoRestaurado", () => {
  const ts = Timestamp.fromDate(new Date(Date.UTC(2026, 0, 1)));
  const contenido = { moduloPIP: "p", origen: { a: 1 }, cobertura: { completa: true }, payload: { archivoUrl: "moddulo/u/p1/f3/r1/f.json" } };
  it("aprobado:false, createdAt del vivo, sin notasUsuario", () => {
    const d = documentoRestaurado(contenido, { createdAt: ts, aprobado: true, notasUsuario: "n", moduloPIP: "nuevo" });
    expect(d.aprobado).toBe(false);
    expect(d.createdAt).toBe(ts);
    expect("notasUsuario" in d).toBe(false);
    expect(d.moduloPIP).toBe("p");
  });
  it("createdAt AUSENTE en el vivo → no se escribe (nunca se inventa)", () => {
    expect("createdAt" in documentoRestaurado(contenido, { aprobado: true })).toBe(false);
    expect("createdAt" in documentoRestaurado(contenido, undefined)).toBe(false);
    expect("createdAt" in documentoRestaurado(contenido, { createdAt: null })).toBe(false);
  });
  it("los campos del vivo que la versión no tiene se ELIMINAN (el set reemplaza el documento)", () => {
    const d = documentoRestaurado(contenido, { createdAt: ts, compatibilidad: { x: 1 }, proyectoTerritorioSnapshotAtVinculacion: { y: 2 } });
    expect(Object.keys(d).sort()).toEqual(["aprobado", "cobertura", "createdAt", "moduloPIP", "origen", "payload"]);
  });
  it("ruido en el contenido (aprobado/notas/createdAt/undefined) no se cuela", () => {
    const d = documentoRestaurado({ ...contenido, aprobado: true, notasUsuario: "viejo", createdAt: "viejo", x: undefined }, { createdAt: ts });
    expect(d.aprobado).toBe(false);
    expect("notasUsuario" in d).toBe(false);
    expect(d.createdAt).toBe(ts);
    expect("x" in d).toBe(false);
    expect(JSON.stringify(d)).not.toContain("undefined");
  });
});

// ---------------------------------------------------------------- archivo, huella, detalle
describe("rutaDeArchivoVerificable", () => {
  it("solo `moddulo/{uid}/{projectId}/…` de ESTE proyecto", () => {
    expect(rutaDeArchivoVerificable("moddulo/uA/p1/f3/r1/f.json", "p1")).toBe("moddulo/uA/p1/f3/r1/f.json");
    expect(rutaDeArchivoVerificable("moddulo/uA/p2/f3/r1/f.json", "p1")).toBeNull();
    expect(rutaDeArchivoVerificable("otra/uA/p1/f.json", "p1")).toBeNull();
    expect(rutaDeArchivoVerificable("moddulo//p1/f.json", "p1")).toBeNull();
    expect(rutaDeArchivoVerificable("moddulo/uA/p1", "p1")).toBeNull();
    expect(rutaDeArchivoVerificable("moddulo/uA/p1/../x/f", "p1")).toBeNull();
    expect(rutaDeArchivoVerificable(undefined, "p1")).toBeNull();
    expect(rutaDeArchivoVerificable(42, "p1")).toBeNull();
  });
});

describe("extrasHuellaVolver + huellaRestauracion", () => {
  const vivo = { moduloPIP: "p", aprobado: true, notasUsuario: "n", payload: { archivoUrl: "moddulo/uSECRETO/p1/f.json", extractoTexto: "TEXTO GRANDE" } };
  const af = [asig(LEGADO), asig(DERIVADO)];
  it("sin uid, sin contenido ni nombre de archivo: solo hashes, ids y estados", () => {
    const e = JSON.stringify(extrasHuellaVolver(vivo, af, false));
    expect(e).not.toContain("uSECRETO");
    expect(e).not.toContain("TEXTO GRANDE");
    expect(e).not.toContain("f.json");
    expect(e).not.toContain("¿");
  });
  it("las asignaciones salen en orden estable (no importa el orden del tablero)", () => {
    expect(extrasHuellaVolver(vivo, af, false)).toEqual(extrasHuellaVolver(vivo, [...af].reverse(), false));
  });
  it("cambia si cambia el vivo, una asignación afectada o el bloqueo", () => {
    const h = (e: unknown) => huellaRestauracion({ puntero: { n: 1 }, objetivo: "o", vigente: "v", extras: e });
    const base = h(extrasHuellaVolver(vivo, af, false));
    expect(h(extrasHuellaVolver({ ...vivo, aprobado: false }, af, false))).not.toBe(base);
    expect(h(extrasHuellaVolver(vivo, [asig(LEGADO, { estado: "en_curso" }), af[1]], false))).not.toBe(base);
    expect(h(extrasHuellaVolver(vivo, [af[0]], false))).not.toBe(base);
    expect(h(extrasHuellaVolver(vivo, af, true))).not.toBe(base);
  });
  it("NO depende de createdAt (volátil) ni del resultado de Storage (no es parte de las extras)", () => {
    const h = (v: Doc) => JSON.stringify(extrasHuellaVolver(v, af, false));
    expect(h({ ...vivo, createdAt: "otro" })).toBe(h({ ...vivo, createdAt: "uno" }));
    expect(Object.keys(extrasHuellaVolver(vivo, af, false)).sort()).toEqual(["asignaciones", "bloqueado", "vivo"]);
  });
});

describe("detalleDeVolver", () => {
  const todo = { estabaAprobado: true, teniaNotas: true, tareasReiniciadas: 2, haySintesis: true, hayVeredicto: true, archivoFaltaba: true as boolean | null };
  it("solo las banderas verdaderas y los números positivos", () => {
    expect(detalleDeVolver(todo)).toEqual({ resultadoEstabaAprobado: true, notasEliminadas: true, tareasReiniciadas: 2, sintesisExistente: true, veredictoExistente: true, archivoNoEncontrado: true });
    expect(detalleDeVolver({ estabaAprobado: false, teniaNotas: false, tareasReiniciadas: 0, haySintesis: false, hayVeredicto: false, archivoFaltaba: null })).toEqual({});
  });
  it("archivo: solo `archivoNoEncontrado` si se COMPROBÓ y faltaba (false/null no dicen nada)", () => {
    expect("archivoNoEncontrado" in detalleDeVolver({ ...todo, archivoFaltaba: false })).toBe(false);
    expect("archivoNoEncontrado" in detalleDeVolver({ ...todo, archivoFaltaba: null })).toBe(false);
  });
  it("no reutiliza `teniaAprobacion` (en F2 dice «análisis») y solo trae valores planos", () => {
    const d = detalleDeVolver(todo);
    expect("teniaAprobacion" in d).toBe(false);
    for (const v of Object.values(d)) expect(["boolean", "number"]).toContain(typeof v);
  });
});

// ---------------------------------------------------------------- «volver» no marca deriva
// Ejecuta lo que hará la ruta (C4b-1b) con el núcleo real: tx.set del documento restaurado + versiones + tablero + puntero.
const DOC_R1 = { moduloPIP: "p", origen: { a: 1 }, cobertura: { completa: true }, payload: { archivoUrl: "moddulo/uA/p1/f3/r1/f.json", extractoTexto: "v1" }, createdAt: Timestamp.fromDate(new Date(Date.UTC(2026, 0, 1))) };
const COLABORADORES = [{ uid: "uA", role: "owner", displayName: "Ana" }];

async function sembrarHistorial(asignaciones: AsignacionCanal[]) {
  // Estado vivo inicial: resultado aprobado con la v1 y el tablero con las asignaciones apuntando a él.
  const resultado1 = { ...DOC_R1, aprobado: true, notasUsuario: "notas viejas" };
  db.reset({
    [P]: { userId: "uA", collaborators: COLABORADORES, phases: { investigacion: { f3TareasPIP: [{ pipItemId: "t1", asignaciones: asignaciones.filter((a) => a.asignacionId === DERIVADO) }, { pipItemId: "t2", asignaciones: asignaciones.filter((a) => a.asignacionId === LEGADO) }] } } },
    [`${P}/f3Resultados/r1`]: resultado1,
  });
  db.rechazarUndefined(true);
  db.atomico(true);
  // v1 (entrega) y v2 (la aprobación) en el historial, como las dejarían `entregar` y `aprobar`.
  await registrarEnSemilla(db, P, [{ artefacto: nombreResultado("r1"), ...estadoResultado(DOC_R1 as Doc), vivo: vivoResultado(DOC_R1 as Doc) }], { tipoCambio: "entrega", por: "uA" });
  consolidarSemilla(db, P);
  await registrarEnSemilla(db, P, [
    { artefacto: nombreResultado("r1"), ...estadoResultado(resultado1 as Doc, { por: "uA", en: "2026-11-01T10:00:00.000Z" }), vivo: vivoResultado(resultado1 as Doc), estadoPrevio: estadoResultado(DOC_R1 as Doc), vivoPrevio: vivoResultado(DOC_R1 as Doc) },
  ], { motivo: "aprobacion" });
  consolidarSemilla(db, P);
}

async function volver(opciones: { mutar?: (d: Doc) => Doc } = {}) {
  const ref = db.collection("moddulo_projects").doc("p1");
  const resultadoRef = ref.collection("f3Resultados").doc("r1");
  await db.runTransaction(async (tx) => {
    const proyecto = await tx.get(ref);
    const vivoSnap = await tx.get(resultadoRef);
    const datos = proyecto.data() as Doc;
    const vivoPrevio = vivoSnap.data() as Doc;
    // Como `resultados/aprobar`: el tablero crudo se normaliza con la MISMA función que getProject (añade `estadoApp`).
    const crudo = (((datos.phases as Doc).investigacion as Doc).f3TareasPIP ?? []) as unknown[];
    const tab = crudo.map((t) => normalizeTareaPIP(t as never)) as TareaTablero[];
    const contenido = estadoResultado(DOC_R1 as Doc).contenido; // lo que traería la versión v1
    let docNuevo = documentoRestaurado(contenido, vivoPrevio);
    if (opciones.mutar) docNuevo = opciones.mutar(docNuevo);
    const reinicio = reiniciarAsignacionesDelResultado(tab, "r1");
    const plan = await prepararVersion(tx as never, {
      raiz: ref as never, datosRaiz: datos as never, punteroCampo: PUNTERO_F3, ambito: AMBITO_F3, fase: FASE_F3,
      tipoCambio: "restauracion", motivo: MOTIVO_RESTAURACION, por: "uA", fuente: "usuario",
      artefactos: artefactosDeVolver({ resultadoId: "r1", vivoPrevio, docNuevo, reiniciadas: reinicio.reiniciadas, por: "uA", en: "2026-11-25T12:00:00.000Z" }),
    });
    const res = aplicarVersion(tx as never, plan);
    tx.set(resultadoRef as never, docNuevo);
    tx.update(ref as never, { ...(reinicio.reiniciadas.length > 0 ? { "phases.investigacion.f3TareasPIP": reinicio.tablero } : {}), ...res.updatesRaiz });
  });
  // El mock guarda las claves con puntos literales: se expanden como lo hace Firestore real.
  const estado = { ...db.snapshot() } as Record<string, unknown>;
  estado[P] = expandirPuntero(estado[P] as Doc);
  db.reset(estado);
  db.rechazarUndefined(true);
  db.atomico(true);
}

async function derivaDeTodo() {
  const proyecto = db.snapshot()[P] as Doc;
  const resultados = new Map<string, Doc>([["r1", db.snapshot()[`${P}/f3Resultados/r1`] as Doc]]);
  const manifiesto = Object.entries(db.snapshot()).find(([k]) => k.startsWith(`${P}/revisiones/`) && k.endsWith(String(((proyecto.phases as Doc).investigacion as Doc).revision && (((proyecto.phases as Doc).investigacion as Doc).revision as Doc).n).padStart(6, "0")));
  const artefactos = ((manifiesto?.[1] as Doc).artefactos ?? {}) as Record<string, { vivo?: string }>;
  const directa = Object.fromEntries(Object.entries(artefactos).map(([nombre, e]) => [nombre, detectarDeriva(nombre, e, { phases: proyecto.phases as Doc, resultadosF3: resultados })]));
  const r = await leerHistorialFase(firestore, { proyectoId: "p1", uid: "uA", fase: "investigacion", limite: 20, conDeriva: true });
  if (r.tipo !== "ok") throw new Error("lectura no ok");
  const lector = Object.fromEntries((r.respuesta.vigente?.artefactos ?? []).map((a) => [a.nombre, a.derivaDetectada]));
  return { directa, lector, artefactos };
}

describe("«volver» NO marca deriva (el vivo de la entrada se arma con lo escrito)", () => {
  beforeEach(() => db.reset());

  it("con tarea reiniciada: resultado y asignación → huella viva igual y derivaDetectada:false (directa y por el lector)", async () => {
    await sembrarHistorial([asig(DERIVADO), asig(LEGADO)]);
    await volver();
    const { directa, lector, artefactos } = await derivaDeTodo();
    expect(Object.keys(artefactos).sort()).toEqual([nombreAsignacion(DERIVADO), nombreAsignacion(LEGADO), nombreResultado("r1")].sort());
    for (const nombre of Object.keys(artefactos)) {
      expect({ nombre, deriva: directa[nombre] }).toEqual({ nombre, deriva: false });
      expect(lector[nombre]).toBe(false);
    }
    // y la huella viva del manifiesto ES la del documento que quedó escrito
    const doc = db.snapshot()[`${P}/f3Resultados/r1`] as Doc;
    expect(artefactos[nombreResultado("r1")].vivo).toBe(huellaContenido(vivoResultado(doc)));
  });

  it("sin ninguna tarea que apunte al resultado: solo el resultado se versiona y no hay deriva", async () => {
    await sembrarHistorial([asig(DERIVADO, { resultadoId: "r9" })]);
    await volver();
    const { directa, lector, artefactos } = await derivaDeTodo();
    expect(Object.keys(artefactos)).toContain(nombreResultado("r1"));
    expect(directa[nombreResultado("r1")]).toBe(false);
    expect(lector[nombreResultado("r1")]).toBe(false);
  });

  it("el documento escrito quedó SIN aprobar, sin notas y con createdAt conservado; las tareas, en curso y sin resultadoId", async () => {
    await sembrarHistorial([asig(DERIVADO), asig(LEGADO)]);
    await volver();
    const doc = db.snapshot()[`${P}/f3Resultados/r1`] as Doc;
    expect(doc.aprobado).toBe(false);
    expect("notasUsuario" in doc).toBe(false);
    expect((doc.createdAt as Timestamp).toMillis()).toBe(DOC_R1.createdAt.toMillis());
    const tab = ((((db.snapshot()[P] as Doc).phases as Doc).investigacion as Doc).f3TareasPIP) as TareaTablero[];
    expect(tab.flatMap((t) => t.asignaciones).every((a) => a.estado === "en_curso" && !("resultadoId" in a))).toBe(true);
  });

  it("la versión nueva es `restauracion` con la aprobación RETIRADA (por/en concretos) y la previa conserva la aprobación vieja", async () => {
    await sembrarHistorial([asig(DERIVADO)]);
    await volver();
    const versiones = Object.entries(db.snapshot()).filter(([k]) => k.startsWith(`${P}/versiones/${nombreResultado("r1")}`)).map(([, v]) => v as Doc);
    const nueva = versiones.find((v) => v.tipoCambio === "restauracion");
    expect(nueva).toMatchObject({ motivo: "restauracion", aprobacion: { aprobado: false, por: "uA", en: "2026-11-25T12:00:00.000Z" } });
    expect(versiones.some((v) => (v.aprobacion as Doc | undefined)?.aprobado === true)).toBe(true); // la aprobación vieja sigue en SU versión
  });
});

// Negativos: lo que SÍ produce deriva si el `vivo` se arma mal (documentan por qué el diseño es el que es).
describe("negativos reales: armar mal el vivo o dejar el documento distinto SÍ marca deriva", () => {
  it("escribir aprobado:true en el documento (pero registrar el vivo de aprobado:false) → deriva", async () => {
    await sembrarHistorial([asig(DERIVADO)]);
    const ref = db.collection("moddulo_projects").doc("p1");
    await volver();
    // alguien deja el documento distinto de lo registrado
    db.seed(`${P}/f3Resultados/r1`, { ...(db.snapshot()[`${P}/f3Resultados/r1`] as Doc), aprobado: true });
    const { directa } = await derivaDeTodo();
    expect(directa[nombreResultado("r1")]).toBe(true);
    void ref;
  });
  it("no borrar notasUsuario del documento escrito → deriva", async () => {
    await sembrarHistorial([asig(DERIVADO)]);
    await volver();
    db.seed(`${P}/f3Resultados/r1`, { ...(db.snapshot()[`${P}/f3Resultados/r1`] as Doc), notasUsuario: "viejas" });
    expect((await derivaDeTodo()).directa[nombreResultado("r1")]).toBe(true);
  });
  it("armar el vivo con el documento ANTERIOR (no con el escrito) → deriva", async () => {
    await sembrarHistorial([asig(DERIVADO)]);
    // el registro usa el vivo previo en lugar del escrito
    const ref = db.collection("moddulo_projects").doc("p1");
    await db.runTransaction(async (tx) => {
      const proyecto = await tx.get(ref);
      const vivoPrevio = (await tx.get(ref.collection("f3Resultados").doc("r1"))).data() as Doc;
      const docNuevo = documentoRestaurado(estadoResultado(DOC_R1 as Doc).contenido, vivoPrevio);
      const cambio = armarCambioRestauracion({ artefacto: nombreResultado("r1"), contenido: estadoResultado(docNuevo).contenido, vivo: vivoResultado(vivoPrevio), aprobacion: { en: "2026-11-25T12:00:00.000Z" }, por: "uA" });
      const plan = await prepararVersion(tx as never, { raiz: ref as never, datosRaiz: proyecto.data() as never, punteroCampo: PUNTERO_F3, ambito: AMBITO_F3, fase: FASE_F3, tipoCambio: "restauracion", motivo: MOTIVO_RESTAURACION, por: "uA", artefactos: [cambio] });
      const res = aplicarVersion(tx as never, plan);
      tx.set(ref.collection("f3Resultados").doc("r1") as never, docNuevo);
      tx.update(ref as never, res.updatesRaiz);
    });
    const estado = { ...db.snapshot() } as Record<string, unknown>;
    estado[P] = expandirPuntero(estado[P] as Doc);
    db.reset(estado); db.rechazarUndefined(true); db.atomico(true);
    expect((await derivaDeTodo()).directa[nombreResultado("r1")]).toBe(true);
  });
  it("no reiniciar la asignación en el tablero (pero versionarla reiniciada) → deriva en la asignación", async () => {
    await sembrarHistorial([asig(DERIVADO)]);
    await volver();
    // el tablero vuelve a su estado viejo: la asignación apunta otra vez al resultado
    const est = { ...db.snapshot() } as Record<string, unknown>;
    const proy = structuredClone(est[P]) as Doc;
    (((proy.phases as Doc).investigacion as Doc).f3TareasPIP as TareaTablero[])[0].asignaciones = [asig(DERIVADO)];
    est[P] = proy;
    db.reset(est); db.rechazarUndefined(true); db.atomico(true);
    expect((await derivaDeTodo()).directa[nombreAsignacion(DERIVADO)]).toBe(true);
  });
});
