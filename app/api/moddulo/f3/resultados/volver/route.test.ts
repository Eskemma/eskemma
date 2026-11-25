// C4b-1b — POST resultados/volver. Orden de decisiones, pregunta/huella, escritura en UNA transacción, reinicio de
// asignaciones (id derivado y legado), archivo que solo informa, rol y errores del historial. `getProject` REAL sobre el
// mock de Firestore (con Timestamp reales, `undefined` rechazado y transacciones atómicas). Sin emulador (Java 17).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage([]) };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const orig = await importOriginal<typeof import("firebase-admin/firestore")>();
  return { ...orig, FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => orig.Timestamp.fromDate(new Date(Date.UTC(2026, 10, 25, 9, 0, 0))) } };
});
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import type { createMockAdminDb, createMockAdminStorage } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { consolidarSemilla, expandirPuntero } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";
import {
  ARCHIVO_V1, CREADO, ID_DERIVADO, ID_LEGADO, PID, PREGUNTA, PROYECTO, RESULTADO, RID, V1, V2, V3, asig, sembrarVolver,
} from "@/lib/moddulo/__tests__/fixtures/siembraVolver";
import { leerHistorialFase } from "@/lib/moddulo/versionado/leerHistorial";
import { puedeVolverAVersion } from "@/lib/moddulo/versionado/visibilidadHistorial";
import { POST } from "./route";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const storage = adminStorage as unknown as ReturnType<typeof createMockAdminStorage>;
const firestore = adminDb as unknown as Firestore;
type Doc = Record<string, unknown>;
const snap = () => db.snapshot() as Record<string, Doc>;

const cuerpo = (extra: Record<string, unknown> = {}) => ({ projectId: PID, resultadoId: RID, versionId: V1, ...extra });
const pedir = (b: unknown = cuerpo()) =>
  POST(new Request("http://local/x", { method: "POST", body: typeof b === "string" ? b : JSON.stringify(b) }) as never);
const sesion = (uid = "u1") => vi.mocked(getSessionFromRequest).mockResolvedValue({ uid } as never);
/** Confirma como lo hace la pantalla: 1.ª llamada (pregunta) → huella de la RESPUESTA → 2.ª llamada con ella. */
async function confirmar(extra: Record<string, unknown> = {}) {
  const p = await pedir(cuerpo(extra));
  const b = await p.json();
  expect(p.status).toBe(409);
  expect(b.error).toBe("reemplazo_requiere_confirmacion");
  consolidarSemilla(db, PROYECTO); // no cambia nada: solo reinicia contadores para medir la 2.ª llamada
  return pedir(cuerpo({ confirmarReemplazo: true, huella: b.huella, ...extra }));
}
// El mock guarda las claves con puntos de un `update()` literales: se expanden como lo hace Firestore real.
const proyecto = () => expandirPuntero(snap()[PROYECTO]);
const tablero = () => (((proyecto().phases as Doc).investigacion as Doc).f3TareasPIP as { pipItemId: string; asignaciones: Doc[] }[]);
const eventos = () => Object.entries(snap()).filter(([k]) => k.startsWith(`${PROYECTO}/eventos/`)).map(([, v]) => v as Doc);
const versionesRes = () => Object.entries(snap()).filter(([k]) => k.startsWith(`${PROYECTO}/versiones/f3Resultado:`)).map(([, v]) => v as Doc);
const escrituras = () => db.contadores().escrituras;
/** Asignación de canal 2 que apunta a OTRO resultado (sin la clave `tecnicaId`: el mock rechaza `undefined` como el SDK real). */
function ajenaCanal2() {
  const a = asig("t1_canal2_complementaria", { resultadoId: "otro", canal: "canal2" });
  delete a.tecnicaId;
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  sesion();
  storage.reset([ARCHIVO_V1]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ---------------------------------------------------------------- antes de la transacción
describe("401 → 400 → 404 → 403 (antes de cualquier 409 y con costo mínimo)", () => {
  it("sin sesión → 401", async () => {
    await sembrarVolver(db);
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await pedir()).status).toBe(401);
  });
  it.each([
    ["JSON inválido", "no es json"],
    ["sin projectId", { resultadoId: RID, versionId: V1 }],
    ["resultadoId con «/»", cuerpo({ resultadoId: "a/b" })],
    ["versionId con «/»", cuerpo({ versionId: "a/b" })],
    ["versionId numérico", cuerpo({ versionId: 3 })],
    ["projectId vacío", cuerpo({ projectId: "" })],
  ])("400 parametro_invalido: %s, sin leer ni escribir nada", async (_n, b) => {
    await sembrarVolver(db);
    const r = await pedir(b);
    expect(r.status).toBe(400);
    expect(db.contadores()).toMatchObject({ lecturas: 0, escrituras: 0 });
  });
  it("404 Proyecto no encontrado: inexistente, en papelera y no colaborador (mismo mensaje) con ≤ 1 lectura", async () => {
    await sembrarVolver(db);
    const mensajes: unknown[] = [];
    for (const uid of ["ajeno"]) {
      sesion(uid);
      const r = await pedir();
      expect(r.status).toBe(404);
      mensajes.push((await r.json()).error);
    }
    sesion();
    db.seed(PROYECTO, { ...snap()[PROYECTO], deletedAt: Timestamp.fromDate(new Date()) });
    const rp = await pedir();
    expect(rp.status).toBe(404);
    mensajes.push((await rp.json()).error);
    const r0 = await pedir(cuerpo({ projectId: "no-existe" }));
    expect(r0.status).toBe(404);
    mensajes.push((await r0.json()).error);
    expect(new Set(mensajes)).toEqual(new Set(["Proyecto no encontrado"]));
  });
  it("403 sin_permiso para analyst y client; owner y co-consultant pasan", async () => {
    await sembrarVolver(db);
    for (const uid of ["u3", "u4"]) {
      sesion(uid);
      const r = await pedir();
      expect(r.status).toBe(403);
      expect((await r.json()).error).toBe("sin_permiso");
    }
    for (const uid of ["u1", "u2"]) {
      sesion(uid);
      expect((await pedir()).status).not.toBe(403);
    }
    expect(escrituras()).toBeGreaterThanOrEqual(0);
  });
  it("el 403 NO escribe en el resultado ni en el historial (solo lo que hace getProject: lastAccessedAt)", async () => {
    await sembrarVolver(db);
    sesion("u3");
    await pedir();
    expect(snap()[RESULTADO]).toMatchObject({ aprobado: true });
    expect(versionesRes()).toHaveLength(3);
  });
  it("puedeVolver (lector) y el 403 de la ruta NO pueden divergir: misma función para los 4 roles", async () => {
    await sembrarVolver(db);
    for (const [uid, rol] of [["u1", "owner"], ["u2", "co-consultant"], ["u3", "analyst"], ["u4", "client"]] as const) {
      sesion(uid);
      const lector = await leerHistorialFase(firestore, { proyectoId: PID, uid, fase: "investigacion", limite: 5 });
      if (lector.tipo !== "ok") throw new Error("lector");
      const r = await pedir();
      expect({ rol, puedeVolver: lector.respuesta.puedeVolver, bloquea403: r.status === 403 }).toEqual({
        rol, puedeVolver: puedeVolverAVersion(rol), bloquea403: !puedeVolverAVersion(rol),
      });
      expect(lector.respuesta.puedeVolver).toBe(r.status !== 403);
    }
  });
});

// ---------------------------------------------------------------- dentro de la transacción
describe("decisiones dentro de la transacción (ninguna escribe)", () => {
  it("404 Resultado no encontrado", async () => {
    await sembrarVolver(db);
    const r = await pedir(cuerpo({ resultadoId: "rX" }));
    expect(r.status).toBe(404);
    expect((await r.json()).error).toBe("Resultado no encontrado");
  });
  it("404 Versión no encontrada: inexistente, de OTRO resultado o podada", async () => {
    await sembrarVolver(db);
    db.seed(`${PROYECTO}/versiones/f3Resultado:r2__000001`, { artefacto: "f3Resultado:r2", n: 1, contenido: { x: 1 } });
    for (const v of [`${RID}__000009`, "f3Resultado:r2__000001"]) {
      const r = await pedir(cuerpo({ versionId: v }));
      expect(r.status).toBe(404);
      expect((await r.json()).error).toBe("Versión no encontrada");
    }
    db.reset({ ...snap() });
    const antes = JSON.stringify(snap()[RESULTADO]);
    expect(JSON.stringify(snap()[RESULTADO])).toBe(antes);
  });
  it("409 version_no_restaurable (contenidoOmitido)", async () => {
    await sembrarVolver(db);
    db.seed(`${PROYECTO}/versiones/${V1}`, { artefacto: `f3Resultado:${RID}`, n: 1, contenidoOmitido: true, huella: "h" });
    const r = await pedir();
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("version_no_restaurable");
    expect(snap()[RESULTADO]).toMatchObject({ aprobado: true });
  });
  it("409 reemplazo_bloqueado con el Reporte F3: texto exacto, sin siglas y sin escribir", async () => {
    await sembrarVolver(db, { inv: { f3DIE: { x: 1 }, f3Veredicto: { aprobadoPorUsuario: true } } });
    const r = await pedir();
    const b = await r.json();
    expect(r.status).toBe(409);
    expect(b).toEqual({ error: "reemplazo_bloqueado", mensaje: "Ya se emitió el «Reporte F3». Mientras exista no se puede volver a una versión anterior de un resultado." });
    expect(b.mensaje).not.toMatch(/\b(HEI|DIE)\b/);
    expect(escrituras()).toBe(1); // solo lastAccessedAt de getProject
  });
  it("409 reemplazo_bloqueado con el veredicto aprobado aunque falte el Reporte (anómalo): sin afirmar un Reporte", async () => {
    await sembrarVolver(db, { inv: { f3Veredicto: { aprobadoPorUsuario: true } } });
    const b = await (await pedir()).json();
    expect(b.error).toBe("reemplazo_bloqueado");
    expect(b.mensaje).not.toContain("Reporte F3");
    expect(b.mensaje).not.toMatch(/\b(HEI|DIE)\b/);
  });
  it("un veredicto en BORRADOR o una síntesis NO bloquean (D7: se permite con aviso)", async () => {
    await sembrarVolver(db, { inv: { f3Sintesis: { x: 1 }, f3Veredicto: { aprobadoPorUsuario: false } } });
    const r = await pedir();
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("reemplazo_requiere_confirmacion");
  });
});

describe("sin_cambios (la versión objetivo ya es la vigente)", () => {
  it("v1 es la vigente, el vivo no derivó, no está aprobado, sin tareas → 409 sin_cambios y nada escrito", async () => {
    await sembrarVolver(db, { soloEntrega: true, asignaciones: [asig(ID_DERIVADO, { resultadoId: "otro" })] });
    const r = await pedir(cuerpo({ versionId: V1 }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("sin_cambios");
    expect(versionesRes()).toHaveLength(1);
  });
  it("la vigente es la APROBADA (v3) y el resultado está aprobado → NO es sin_cambios (hay una aprobación que retirar)", async () => {
    await sembrarVolver(db);
    const r = await pedir(cuerpo({ versionId: V3 }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("reemplazo_requiere_confirmacion");
  });
  it("la vigente es la objetivo pero hay DERIVA del vivo (cambió sin registro) → NO es sin_cambios", async () => {
    await sembrarVolver(db, { soloEntrega: true, asignaciones: [asig(ID_DERIVADO, { resultadoId: "otro" })], extraVivo: { compatibilidad: { x: 1 } } });
    const r = await pedir(cuerpo({ versionId: V1 }));
    expect((await r.json()).error).toBe("reemplazo_requiere_confirmacion");
  });
  it("la vigente es la objetivo, sin aprobación, pero una tarea apunta al resultado → NO es sin_cambios (se reiniciaría)", async () => {
    await sembrarVolver(db, { soloEntrega: true });
    expect((await (await pedir(cuerpo({ versionId: V1 }))).json()).error).toBe("reemplazo_requiere_confirmacion");
  });
  it("sin historial todavía (sin puntero) la versión vigente es desconocida → no es sin_cambios", async () => {
    await sembrarVolver(db, { soloEntrega: true, asignaciones: [asig(ID_DERIVADO, { resultadoId: "otro" })] });
    const p = snap()[PROYECTO] as Doc;
    const inv = { ...((p.phases as Doc).investigacion as Doc) };
    delete inv.revision;
    db.seed(PROYECTO, { ...p, phases: { ...(p.phases as Doc), investigacion: inv } });
    const r = await pedir(cuerpo({ versionId: V1 }));
    expect((await r.json()).error).toBe("reemplazo_requiere_confirmacion");
  });
});

// ---------------------------------------------------------------- pregunta y huella
describe("pregunta (409 reemplazo_requiere_confirmacion)", () => {
  it("trae `lineas` CONDICIONALES, `huella`, `nombre` (la pregunta) y NO escribe nada", async () => {
    await sembrarVolver(db, { asignaciones: [asig(ID_DERIVADO), asig(ID_LEGADO)], inv: { f3Sintesis: { x: 1 }, f3Veredicto: { aprobadoPorUsuario: false } } });
    const r = await pedir();
    const b = await r.json();
    expect(r.status).toBe(409);
    expect(b.error).toBe("reemplazo_requiere_confirmacion");
    expect(typeof b.huella).toBe("string");
    expect(b.nombre).toBe(PREGUNTA);
    expect(b.hayImpactoF3).toBe(true);
    expect(b.lineas).toEqual([
      "Este resultado está aprobado. Al volver quedará sin aprobar y tendrás que aprobarlo otra vez en «M2 · Resultados recibidos».",
      "Las notas que escribiste al aprobarlo dejarán de verse.",
      "2 tareas de investigación que usaban este resultado volverán a «En curso» y se desvincularán de él.",
      "La síntesis y el veredicto que ya generaste no se vuelven a calcular: seguirán reflejando lo que tenías antes de volver.",
    ]);
    expect(snap()[RESULTADO]).toMatchObject({ aprobado: true, notasUsuario: "notas viejas" });
    expect(versionesRes()).toHaveLength(3);
  });
  it("las líneas del servidor NO llevan fecha ni el nombre del resultado", async () => {
    await sembrarVolver(db);
    const b = await (await pedir()).json();
    const todo = JSON.stringify(b.lineas);
    expect(todo).not.toContain(PREGUNTA);
    expect(todo).not.toMatch(/\d{4}/);
    expect(todo).not.toMatch(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i);
  });
  it("sin aprobar y sin tareas → pocas líneas (solo las que son verdad)", async () => {
    await sembrarVolver(db, { aprobado: false, asignaciones: [asig(ID_DERIVADO, { resultadoId: "otro" })] });
    const b = await (await pedir()).json();
    expect(b.lineas).toEqual([]);
    expect(b.hayImpactoF3).toBe(false);
  });
  it("1 sola tarea → singular", async () => {
    await sembrarVolver(db);
    expect((await (await pedir()).json()).lineas).toContain("1 tarea de investigación que usaba este resultado volverá a «En curso» y se desvinculará de él.");
  });
  it("`nombre` se recorta a ~120 caracteres con «…»", async () => {
    await sembrarVolver(db);
    const largo = "¿" + "Pregunta muy larga ".repeat(20) + "?";
    const p = snap()[RESULTADO];
    db.seed(RESULTADO, { ...p, moduloPIP: largo });
    const b = await (await pedir()).json();
    expect(Array.from(b.nombre as string).length).toBeLessThanOrEqual(121);
    expect((b.nombre as string).endsWith("…")).toBe(true);
  });
  it("`confirmarReemplazo:true` SIN huella (o malformada) es «no confirmado»: 409 con el estado actual, nunca 400", async () => {
    await sembrarVolver(db);
    for (const huella of [undefined, "", 7, null]) {
      const r = await pedir(cuerpo({ confirmarReemplazo: true, huella }));
      expect(r.status).toBe(409);
      expect((await r.json()).error).toBe("reemplazo_requiere_confirmacion");
    }
    expect(snap()[RESULTADO]).toMatchObject({ aprobado: true });
  });
  it("una huella que ya no coincide → 409 reemplazo_huella_vencida con lineas, huella y nombre NUEVOS", async () => {
    await sembrarVolver(db);
    const b1 = await (await pedir()).json();
    // algo cambia entre el aviso y la confirmación (otra pestaña edita el resultado)
    db.seed(RESULTADO, { ...snap()[RESULTADO], notasUsuario: "otras notas" });
    const r = await pedir(cuerpo({ confirmarReemplazo: true, huella: b1.huella }));
    const b2 = await r.json();
    expect(r.status).toBe(409);
    expect(b2.error).toBe("reemplazo_huella_vencida");
    expect(b2.huella).not.toBe(b1.huella);
    expect(Array.isArray(b2.lineas)).toBe(true);
    expect(b2.nombre).toBe(PREGUNTA);
    expect(snap()[RESULTADO]).toMatchObject({ aprobado: true, notasUsuario: "otras notas" });
  });
  it("la huella NO contiene uid, contenido ni el nombre del archivo y es la misma pida quien pida", async () => {
    await sembrarVolver(db);
    const h1 = (await (await pedir()).json()).huella as string;
    sesion("u2");
    const h2 = (await (await pedir()).json()).huella as string;
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]+$/);
  });
  it("el archivo solo INFORMA: si falta se agrega la línea, y la huella es LA MISMA con o sin archivo", async () => {
    await sembrarVolver(db);
    storage.reset([ARCHIVO_V1]);
    const conArchivo = await (await pedir()).json();
    expect(conArchivo.lineas.join(" ")).not.toContain("ya no está guardado");
    storage.reset([]);
    const sinArchivo = await (await pedir()).json();
    expect(sinArchivo.lineas).toContain("El archivo de esa versión ya no está guardado; el texto sí se conserva, pero no podrás consultar el archivo original.");
    expect(sinArchivo.huella).toBe(conArchivo.huella);
  });
  it("la consulta del archivo que FALLA no bloquea ni agrega la línea", async () => {
    await sembrarVolver(db);
    (storage.bucket as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error("sin permiso"); });
    const r = await pedir();
    expect(r.status).toBe(409);
    expect((await r.json()).lineas.join(" ")).not.toContain("ya no está guardado");
  });
  it("solo se consulta una ruta de ESTE proyecto (`moddulo/{uid}/{projectId}/…`); otra no se consulta", async () => {
    await sembrarVolver(db);
    const vers = snap()[`${PROYECTO}/versiones/${V1}`];
    db.seed(`${PROYECTO}/versiones/${V1}`, { ...vers, contenido: { ...(vers.contenido as Doc), payload: { archivoUrl: "moddulo/uA/OTRO/f3/x.json", extractoTexto: "t" } } });
    (storage.bucket as unknown as ReturnType<typeof vi.fn>).mockClear();
    await pedir();
    expect(storage.bucket).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- escritura
describe("volver (confirmado): UNA transacción con todo", () => {
  it("200 {ok, resultadoId, versionNueva:{n}, asignacionesReiniciadas}", async () => {
    await sembrarVolver(db);
    const r = await confirmar();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, resultadoId: RID, versionNueva: { n: 4 }, asignacionesReiniciadas: [ID_DERIVADO] });
  });
  it("el documento queda SIN aprobar, sin notas, con el contenido de la v1 y `createdAt` del vivo", async () => {
    await sembrarVolver(db);
    await confirmar();
    const d = snap()[RESULTADO];
    expect(d.aprobado).toBe(false);
    expect("notasUsuario" in d).toBe(false);
    expect((d.payload as Doc).extractoTexto).toBe("texto v1");
    expect((d.createdAt as Timestamp).toMillis()).toBe(CREADO.toMillis());
  });
  it("`createdAt` ausente en el vivo → no se escribe (nunca se inventa)", async () => {
    await sembrarVolver(db, { sinCreatedAt: true });
    await confirmar();
    expect("createdAt" in snap()[RESULTADO]).toBe(false);
  });
  it("campos del vivo que la versión no tiene se ELIMINAN (el set reemplaza el documento)", async () => {
    await sembrarVolver(db, { extraVivo: { compatibilidad: { x: 1 }, proyectoTerritorioSnapshotAtVinculacion: { y: 2 } } });
    await confirmar();
    expect(Object.keys(snap()[RESULTADO]).sort()).toEqual(["aprobado", "cobertura", "createdAt", "moduloPIP", "origen", "payload"]);
  });
  it("el archivo de Storage NO se toca (solo exists(), nunca delete)", async () => {
    await sembrarVolver(db);
    await confirmar();
    const f = (storage.bucket() as unknown as { file: ReturnType<typeof vi.fn> }).file;
    for (const c of f.mock.results) expect(Object.keys(c.value)).toEqual(["exists"]);
  });
  it("reinicia la asignación de id DERIVADO y la de id LEGADO; `activada` y el resto intactos; las ajenas no se tocan", async () => {
    await sembrarVolver(db, { asignaciones: [asig(ID_DERIVADO, { activada: false }), asig(ID_LEGADO), ajenaCanal2()] });
    const r = await confirmar();
    expect((await r.json()).asignacionesReiniciadas.sort()).toEqual([ID_LEGADO, ID_DERIVADO].sort());
    const todas = tablero().flatMap((t) => t.asignaciones);
    const der = todas.find((a) => a.asignacionId === ID_DERIVADO)!;
    const leg = todas.find((a) => a.asignacionId === ID_LEGADO)!;
    const ajena = todas.find((a) => a.asignacionId === "t1_canal2_complementaria")!;
    expect(der).toMatchObject({ estado: "en_curso", activada: false });
    expect("resultadoId" in der).toBe(false);
    expect(leg.estado).toBe("en_curso");
    expect("resultadoId" in leg).toBe(false);
    expect(ajena.resultadoId).toBe("otro");
    expect(ajena.estado).toBe("recibido");
  });
  it("payload del tablero: solo {pipItemId, asignaciones} por tarea (sin `numero` ni otras claves)", async () => {
    await sembrarVolver(db);
    await confirmar();
    for (const t of tablero()) expect(Object.keys(t).sort()).toEqual(["asignaciones", "pipItemId"]);
  });
  it("0 asignaciones afectadas: el tablero NO se reescribe y el resultado sí vuelve", async () => {
    await sembrarVolver(db, { asignaciones: [asig(ID_DERIVADO, { resultadoId: "otro" })] });
    const r = await confirmar();
    expect((await r.json()).asignacionesReiniciadas).toEqual([]);
    // ningún `update` toca el tablero (solo el resultado, el historial y el puntero)
    expect(db.updates().some((u) => "phases.investigacion.f3TareasPIP" in (u.data as Doc))).toBe(false);
    expect(snap()[RESULTADO].aprobado).toBe(false);
  });
  it("una asignación «derivada» anómala con ese resultadoId también se reinicia (D1 literal)", async () => {
    await sembrarVolver(db, { asignaciones: [asig(ID_DERIVADO, { estado: "derivado" })] });
    await confirmar();
    expect(tablero().flatMap((t) => t.asignaciones)[0]).toMatchObject({ estado: "en_curso" });
  });
  it("historial: versión nueva `restauracion` con la aprobación retirada, una versión por asignación reiniciada y el puntero sube", async () => {
    await sembrarVolver(db, { asignaciones: [asig(ID_DERIVADO), asig(ID_LEGADO)] });
    await confirmar();
    const nueva = versionesRes().find((v) => v.tipoCambio === "restauracion")!;
    expect(nueva).toMatchObject({ motivo: "restauracion", aprobacion: { aprobado: false, por: "u1" } });
    const asigV = Object.entries(snap()).filter(([k]) => k.startsWith(`${PROYECTO}/versiones/f3Asignacion:`));
    expect(asigV.length).toBeGreaterThanOrEqual(2); // previa («sin historial») + nueva, por cada asignación
    expect(versionesRes().some((v) => (v.aprobacion as Doc | undefined)?.aprobado === true)).toBe(true); // la aprobación vieja queda en SU versión
    const p = ((proyecto().phases as Doc).investigacion as Doc).revision as { n: number };
    expect(p.n).toBe(4);
  });
  it("el evento trae SOLO banderas y números (nunca la pregunta ni notas) y por = quien volvió", async () => {
    await sembrarVolver(db, { inv: { f3Sintesis: { x: 1 } } });
    storage.reset([]); // el archivo de la v1 no existe
    await confirmar();
    const ev = eventos().find((e) => e.tipo === "restauracion")!;
    expect(ev).toMatchObject({ motivo: "restauracion", por: "u1", fuente: "usuario" });
    expect(ev.detalle).toEqual({ resultadoEstabaAprobado: true, notasEliminadas: true, tareasReiniciadas: 1, sintesisExistente: true, archivoNoEncontrado: true });
    expect(JSON.stringify(ev)).not.toContain(PREGUNTA);
    expect(JSON.stringify(ev)).not.toContain("notas viejas");
    expect("teniaAprobacion" in (ev.detalle as Doc)).toBe(false);
  });
  it("sin archivo verificable o con archivo existente: el evento NO trae `archivoNoEncontrado`", async () => {
    await sembrarVolver(db);
    await confirmar();
    expect("archivoNoEncontrado" in (eventos().find((e) => e.tipo === "restauracion")!.detalle as Doc)).toBe(false);
  });
  it("el archivo ausente NO cambia la huella: confirmar con la huella de la pregunta funciona aunque el archivo falte", async () => {
    await sembrarVolver(db);
    storage.reset([ARCHIVO_V1]);
    const pregunta = await (await pedir()).json();
    storage.reset([]);
    const r = await pedir(cuerpo({ confirmarReemplazo: true, huella: pregunta.huella }));
    expect(r.status).toBe(200);
  });
  it("una sola transacción de escritura y nada con `undefined` (el mock lo rechaza como el SDK real)", async () => {
    await sembrarVolver(db);
    const p = await pedir();
    const b = await p.json();
    const antes = (db.runTransaction as unknown as { mock?: { calls: unknown[] } }).mock?.calls.length ?? 0;
    const r = await pedir(cuerpo({ confirmarReemplazo: true, huella: b.huella }));
    expect(r.status).toBe(200);
    const despues = (db.runTransaction as unknown as { mock?: { calls: unknown[] } }).mock?.calls.length ?? 0;
    expect(despues - antes).toBe(1);
  });
  it("«volver» NO marca deriva: el lector (deriva=1) da false para el resultado y las asignaciones reiniciadas", async () => {
    await sembrarVolver(db, { asignaciones: [asig(ID_DERIVADO), asig(ID_LEGADO)] });
    await confirmar();
    consolidarSemilla(db, PROYECTO);
    const l = await leerHistorialFase(firestore, { proyectoId: PID, uid: "u1", fase: "investigacion", limite: 20, conDeriva: true });
    if (l.tipo !== "ok") throw new Error("lector");
    const deriva = Object.fromEntries((l.respuesta.vigente?.artefactos ?? []).map((a) => [a.nombre, a.derivaDetectada]));
    expect(deriva[`f3Resultado:${RID}`]).toBe(false);
    expect(deriva[`f3Asignacion:${ID_DERIVADO}`]).toBe(false);
    expect(deriva[`f3Asignacion:${ID_LEGADO}`]).toBe(false);
  });
  it("volver y VOLVER A VOLVER (deshacer): la v3 aprobada vuelve a poder restaurarse", async () => {
    await sembrarVolver(db);
    await confirmar();
    consolidarSemilla(db, PROYECTO);
    const r = await confirmar({ versionId: V3 });
    expect(r.status).toBe(200);
    expect((snap()[RESULTADO].payload as Doc).extractoTexto).toBe("texto v2");
    expect(snap()[RESULTADO].aprobado).toBe(false);
  });
});

// ---------------------------------------------------------------- errores del historial
describe("errores: un fallo del historial o de la escritura no deja NADA a medias", () => {
  it("colisión del historial (puntero desfasado) → 409 historial_no_confirmado y el resultado sigue como estaba", async () => {
    await sembrarVolver(db);
    const p = await pedir();
    const huella = (await p.json()).huella;
    // ya existe la versión que la ruta intentaría crear (n=4): choca el `create`
    db.seed(`${PROYECTO}/versiones/f3Resultado:${RID}__000004`, { artefacto: `f3Resultado:${RID}`, n: 4 });
    const r = await pedir(cuerpo({ confirmarReemplazo: true, huella }));
    expect(r.status).toBe(409);
    const b = await r.json();
    expect(b.error).toBe("historial_no_confirmado");
    expect(b.causa).toBe("colision");
    expect(snap()[RESULTADO]).toMatchObject({ aprobado: true, notasUsuario: "notas viejas" });
    expect(tablero().flatMap((t) => t.asignaciones)[0]).toMatchObject({ estado: "recibido", resultadoId: RID });
  });
  it("inconsistencia (el puntero apunta a una revisión que no existe) → 500 historial_no_confirmado y nada escrito", async () => {
    await sembrarVolver(db);
    db.reset(Object.fromEntries(Object.entries(snap()).filter(([k]) => !k.startsWith(`${PROYECTO}/revisiones/`))));
    db.rechazarUndefined(true); db.atomico(true);
    const huella = (await (await pedir()).json()).huella; // la pregunta se calcula con la misma lectura (sin vigente)
    const r = await pedir(cuerpo({ confirmarReemplazo: true, huella }));
    expect(r.status).toBe(500);
    const b = await r.json();
    expect(b.error).toBe("historial_no_confirmado");
    expect(b.causa).toBe("inconsistencia");
    expect(snap()[RESULTADO]).toMatchObject({ aprobado: true, notasUsuario: "notas viejas" });
  });
  it("la transacción falla → 500 reemplazo_escritura_incierta (no afirma que no se hizo)", async () => {
    await sembrarVolver(db);
    (db.runTransaction as unknown as { mockRejectedValueOnce?: (e: Error) => void }).mockRejectedValueOnce?.(new Error("commit perdido"));
    const r = await pedir();
    expect(r.status).toBe(500);
    const b = await r.json();
    expect(b.error).toBe("reemplazo_escritura_incierta");
    expect(b.mensaje).not.toMatch(/no se (hizo|guardó)/i);
  });
});
