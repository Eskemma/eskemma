// C4a-1 — LECTOR del historial: vigente por manifiesto, paginación por `revisionN` con costo fijo (2 + K lecturas),
// continuidad entre `totalCambios` (puntero.n) y los eventos (hueco = aviso, nunca «sin historial»), evento posterior al
// puntero que no se muestra como vigente, retención parcial, deriva, acceso por rol y SOLO LECTURA (cero escrituras).
// Mock fiel (Timestamp reales, transacciones atómicas, rechazo de `undefined`). Sin emulador de Firestore (Java 17):
// los conteos son del mock; el índice compuesto NO se ejercita aquí (se verifica en la base real).
import { beforeEach, describe, expect, it, vi } from "vitest";

const reloj = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const orig = await importOriginal<typeof import("firebase-admin/firestore")>();
  return {
    ...orig,
    FieldValue: {
      delete: () => "__DELETE__",
      // Un instante distinto por llamada, como Firestore real (un evento por acción).
      serverTimestamp: () => orig.Timestamp.fromDate(new Date(Date.UTC(2026, 10, 1, 9, 0, 0) + ++reloj.n * 60_000)),
    },
  };
});

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { huellaContenido } from "@/lib/versionado/huella";
import { normalizeTareaPIP } from "@/lib/moddulo/project";
import { vivoF2M1, estadoF2M1, AMBITO_F2, FASE_F2, PUNTERO_F2 } from "./artefactosF2";
import { vivoCierre } from "./artefactosCierre";
import { vivoAsignacion, vivoResultado } from "./artefactosF3";
import { HistorialIlegibleError, IndiceNoListoError, leerHistorialFase, type OpcionesLectura } from "./leerHistorial";
import { clonar, consolidarF2 } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";
import { registrarEnSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const firestore = adminDb as unknown as Firestore;
type Doc = Record<string, unknown>;

const P = "moddulo_projects/p1";
const pad = (n: number) => String(n).padStart(6, "0");
const instante = (n: number) => Timestamp.fromDate(new Date(Date.UTC(2026, 10, 1, 10, n)));

const COLABORADORES = [
  { uid: "u1", role: "owner", displayName: "Raúl" },
  { uid: "u2", role: "co-consultant", displayName: "Ana" },
  { uid: "u3", role: "analyst", displayName: "Luis" },
  { uid: "u4", role: "client", displayName: "Candidata" },
];

function evento(fase: string, n: number, over: Doc = {}): Doc {
  return {
    tipo: "ajuste_manual", fase, ambito: "moddulo", artefactos: ["f2M1"], revisionN: n,
    versionIds: { f2M1: `f2M1__${pad(n)}` }, por: "u1", en: instante(n), fuente: "usuario", motivo: "aprobacion", ...over,
  };
}
const entrada = (nombre: string, n: number, retenidas: number[], over: Doc = {}) => ({
  versionId: `${nombre}__${pad(n)}`, n, tupla: "t", dependeDe: [],
  retenidas: retenidas.map((r) => ({ id: `${nombre}__${pad(r)}`, n: r, aprobada: false, protegida: false })),
  ...over,
});

interface Siembra {
  fase?: string;
  /** puntero.n; null = proyecto sin puntero. */
  n: number | null;
  /** revisionN de los eventos a sembrar (por defecto 1..n). */
  eventos?: number[];
  artefactos?: Record<string, unknown>;
  proyecto?: Doc;
  extraFase?: Doc;
  extraDocs?: Record<string, unknown>;
}
function sembrar(s: Siembra) {
  const fase = s.fase ?? "exploracion";
  const docs: Record<string, unknown> = {
    [P]: {
      name: "Proyecto", status: "active", collaborators: COLABORADORES,
      lastAccessedAt: Timestamp.fromDate(new Date("2026-11-09T10:30:00.000Z")),
      phases: { [fase]: { ...(s.extraFase ?? {}), ...(s.n !== null ? { revision: { n: s.n, huella: "h", por: "u1", en: instante(s.n) } } : {}) } },
      ...(s.proyecto ?? {}),
    },
    ...(s.extraDocs ?? {}),
  };
  if (s.n !== null) {
    const todas = Array.from({ length: s.n }, (_, i) => i + 1);
    docs[`${P}/revisiones/${fase}_${pad(s.n)}`] = {
      fase, ambito: "moddulo", n: s.n, artefactos: s.artefactos ?? { f2M1: entrada("f2M1", s.n, todas) },
    };
  }
  const revs = s.eventos ?? (s.n !== null ? Array.from({ length: s.n }, (_, i) => i + 1) : []);
  for (const r of revs) docs[`${P}/eventos/e${r}`] = evento(fase, r);
  db.reset(docs);
  db.rechazarUndefined(true);
  db.atomico(true);
}

const leer = (o: Partial<OpcionesLectura> = {}) =>
  leerHistorialFase(firestore, { proyectoId: "p1", uid: "u1", fase: "exploracion", limite: 20, ...o });
async function ok(o: Partial<OpcionesLectura> = {}) {
  const r = await leer(o);
  if (r.tipo !== "ok") throw new Error(`se esperaba ok y fue ${r.tipo}`);
  return r.respuesta;
}

beforeEach(() => {
  reloj.n = 0;
  db.reset({});
});

describe("proyecto sin historial", () => {
  it("fase sin puntero y sin eventos: estado vacío honesto, sin avisos, 1 lectura y 0 escrituras", async () => {
    sembrar({ n: null });
    const r = await ok();
    expect(r.totalCambios).toBe(0);
    expect(r.filas).toEqual([]);
    expect(r.vigente).toBeNull();
    expect(r.avisos).toEqual([]);
    expect(r.siguienteCursor).toBeNull();
    expect(db.contadores()).toEqual({ lecturas: 1, escrituras: 0, borrados: 0 });
  });
});

describe("vigente por MANIFIESTO (nunca por el estado de la versión)", () => {
  it("la fila vigente es la del puntero y la versión vigente sale del manifiesto, aunque las versiones digan otra cosa", async () => {
    sembrar({
      n: 3,
      extraDocs: {
        // Versiones con el campo `estado` engañoso: el lector ni siquiera las lee.
        [`${P}/versiones/f2M1__000001`]: { estado: "vigente" },
        [`${P}/versiones/f2M1__000003`]: { estado: "reemplazada" },
      },
    });
    const r = await ok();
    expect(r.vigente?.revisionN).toBe(3);
    expect(r.vigente?.artefactos).toEqual([
      { nombre: "f2M1", etiqueta: "Análisis de la Fase 2", versionVigenteId: "f2M1__000003", n: 3, derivaDetectada: null },
    ]);
    expect(r.filas.map((f) => [f.revisionN, f.esVigente])).toEqual([[3, true], [2, false], [1, false]]);
    // Una versión es «vigente» solo si es la que nombra el manifiesto.
    expect(r.filas.map((f) => f.artefactos[0].vigente)).toEqual([true, false, false]);
    // 1 proyecto + 1 manifiesto + 3 eventos: las versiones no se leen.
    expect(db.contadores().lecturas).toBe(5);
  });

  it("orden por número de revisión descendente, nunca por fecha (una fecha ausente no lo cambia)", async () => {
    sembrar({ n: 3, eventos: [] });
    db.seed(`${P}/eventos/e1`, evento("exploracion", 1, { en: null }));
    db.seed(`${P}/eventos/e2`, evento("exploracion", 2, { en: instante(1) }));
    db.seed(`${P}/eventos/e3`, evento("exploracion", 3, { en: null }));
    const r = await ok();
    expect(r.filas.map((f) => f.revisionN)).toEqual([3, 2, 1]);
    expect(r.filas.map((f) => f.en)).toEqual([null, instante(1).toDate().toISOString(), null]);
  });
});

describe("«Sin autoría registrada», nombres y roles", () => {
  it("por null/ausente → «Sin autoría registrada»; colaborador → su nombre; quien ya no colabora → «Alguien del equipo»", async () => {
    sembrar({ n: 4, eventos: [] });
    db.seed(`${P}/eventos/e1`, evento("exploracion", 1, { por: null }));
    db.seed(`${P}/eventos/e2`, evento("exploracion", 2, { por: "u2" }));
    db.seed(`${P}/eventos/e3`, evento("exploracion", 3, { por: "ya-no-colabora" }));
    db.seed(`${P}/eventos/e4`, (() => { const e = evento("exploracion", 4); delete e.por; return e; })());
    const r = await ok();
    expect(r.filas.map((f) => f.quien)).toEqual(["Sin autoría registrada", "Alguien del equipo", "Ana", "Sin autoría registrada"]);
  });

  it.each(["owner", "co-consultant", "analyst", "client"] as const)("el rol %s ve el historial (con nombres y detalle)", async (rol) => {
    sembrar({ n: 1 });
    const uid = { owner: "u1", "co-consultant": "u2", analyst: "u3", client: "u4" }[rol];
    db.seed(`${P}/eventos/e1`, evento("exploracion", 1, { detalle: { borradorDescartado: true, motoresAprobadosDescartados: ["M2"] } }));
    const r = await ok({ uid });
    expect(r.filas[0].quien).toBe("Raúl");
    expect(r.filas[0].detalleTexto).toBe("Se descartaron el borrador de los motores y 1 motor aprobado.");
  });

  it("proyecto inexistente, en la papelera y de otro (no colaborador): el MISMO resultado", async () => {
    sembrar({ n: 1 });
    expect(await leer({ uid: "extraño" })).toEqual({ tipo: "no_encontrado" });
    expect(await leer({ proyectoId: "no-existe" })).toEqual({ tipo: "no_encontrado" });
    sembrar({ n: 1, proyecto: { deletedAt: instante(1) } });
    expect(await leer()).toEqual({ tipo: "no_encontrado" });
  });
});

describe("paginación por `revisionN` con costo fijo", () => {
  it("45 acciones en páginas de 20: 45..26, 25..6, 5..1, sin repetir ni saltar", async () => {
    sembrar({ n: 45 });
    const p1 = await ok();
    expect(p1.totalCambios).toBe(45);
    expect(p1.filas.map((f) => f.revisionN)).toEqual(Array.from({ length: 20 }, (_, i) => 45 - i));
    expect(p1.siguienteCursor).toBe(26);
    const p2 = await ok({ cursor: p1.siguienteCursor! });
    expect(p2.filas.map((f) => f.revisionN)).toEqual(Array.from({ length: 20 }, (_, i) => 25 - i));
    expect(p2.siguienteCursor).toBe(6);
    const p3 = await ok({ cursor: p2.siguienteCursor! });
    expect(p3.filas.map((f) => f.revisionN)).toEqual([5, 4, 3, 2, 1]);
    expect(p3.siguienteCursor).toBeNull();
    for (const p of [p1, p2, p3]) {
      expect(p.avisos).toEqual([]);
      expect(p.faltantesTotal).toBe(0);
    }
  });

  it("una página exacta que termina en 1 no pide otra", async () => {
    sembrar({ n: 20 });
    const r = await ok();
    expect(r.filas).toHaveLength(20);
    expect(r.siguienteCursor).toBeNull();
  });
});

describe("costo medido con los contadores del mock (observación 1)", () => {
  it.each([20, 100, 500])("%i acciones por fase: la 1.ª página cuesta 22 lecturas y 0 escrituras", async (acciones) => {
    sembrar({ n: acciones });
    const antes = JSON.stringify(db.snapshot());
    const r = await ok();
    expect(r.filas).toHaveLength(20);
    expect(db.contadores()).toEqual({ lecturas: 22, escrituras: 0, borrados: 0 });
    expect(JSON.stringify(db.snapshot())).toBe(antes); // ni `lastAccessedAt` ni nada cambió
  });

  it.each([20, 100, 500])("%i acciones: cada «Ver más» cuesta 22 y recorrer todo cuesta 2 por página + las filas", async (acciones) => {
    sembrar({ n: acciones });
    let cursor: number | undefined;
    let lecturas = 0;
    let paginas = 0;
    let filas = 0;
    do {
      db.reset(db.snapshot());
      const r = await ok({ cursor });
      lecturas += db.contadores().lecturas;
      filas += r.filas.length;
      paginas++;
      cursor = r.siguienteCursor ?? undefined;
    } while (cursor !== undefined);
    expect(filas).toBe(acciones);
    expect(lecturas).toBe(paginas * 2 + acciones);
    expect({ 20: 22, 100: 110, 500: 550 }[acciones as 20 | 100 | 500]).toBe(lecturas);
  });

  it("la lectura del manifiesto cuesta 1 sin importar cuántas acciones hay (no crece con ellas)", async () => {
    sembrar({ n: 500 });
    await ok({ limite: 1 });
    expect(db.contadores().lecturas).toBe(3); // proyecto + manifiesto + 1 evento
  });
});

describe("continuidad: contador del puntero vs eventos (nunca «sin historial»)", () => {
  it("falta un evento en medio → aviso y revisión faltante", async () => {
    sembrar({ n: 6, eventos: [6, 5, 3, 2, 1] });
    const r = await ok();
    expect(r.faltantes).toEqual([4]);
    expect(r.avisos.map((a) => a.codigo)).toContain("eventos_incompletos");
    expect(r.avisos.find((a) => a.codigo === "eventos_incompletos")?.texto).toBe("Algunos cambios antiguos no se pueden mostrar.");
    expect(r.filas.map((f) => f.revisionN)).toEqual([6, 5, 3, 2, 1]);
  });
  it("faltan los eventos más antiguos → aviso (no se toma por el final del historial)", async () => {
    sembrar({ n: 5, eventos: [5, 4, 3] });
    const r = await ok();
    expect(r.faltantes).toEqual([2, 1]);
    expect(r.siguienteCursor).toBeNull();
    expect(r.avisos.map((a) => a.codigo)).toContain("eventos_incompletos");
  });
  it("hay puntero pero NINGÚN evento → aviso, no «sin historial»", async () => {
    sembrar({ n: 3, eventos: [] });
    const r = await ok();
    expect(r.totalCambios).toBe(3);
    expect(r.filas).toEqual([]);
    expect(r.faltantesTotal).toBe(3);
    expect(r.avisos.map((a) => a.codigo)).toContain("eventos_incompletos");
  });
  it("eventos con `revisionN` que no es un entero o de otra fase no se muestran, pero avisan", async () => {
    sembrar({ n: 3, eventos: [3, 1] });
    db.seed(`${P}/eventos/malo1`, evento("exploracion", 2, { revisionN: "2" }));
    db.seed(`${P}/eventos/malo2`, (() => { const e = evento("exploracion", 2); delete e.revisionN; return e; })());
    const r = await ok();
    expect(r.filas.map((f) => f.revisionN)).toEqual([3, 1]);
    expect(r.faltantes).toEqual([2]);
    expect(r.avisos.map((a) => a.codigo)).toContain("eventos_incompletos");
  });
  it("hay eventos pero el proyecto no tiene puntero → aviso y se muestran sin vigente", async () => {
    sembrar({ n: null, eventos: [] });
    db.seed(`${P}/eventos/e1`, evento("exploracion", 1));
    db.seed(`${P}/eventos/e2`, evento("exploracion", 2));
    const r = await ok();
    expect(r.totalCambios).toBe(0);
    expect(r.vigente).toBeNull();
    expect(r.filas.map((f) => [f.revisionN, f.esVigente])).toEqual([[2, false], [1, false]]);
    expect(r.avisos.map((a) => a.codigo)).toContain("historial_sin_puntero");
  });
});

describe("consistencia de lectura: un evento posterior al puntero leído", () => {
  it("no se muestra como vigente, no rompe el orden ni se toma por un hueco, y avisa", async () => {
    sembrar({ n: 5, eventos: [6, 5, 4, 3, 2, 1] });
    const r = await ok();
    expect(r.filas.map((f) => f.revisionN)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(r.filas.find((f) => f.revisionN === 6)).toMatchObject({ esVigente: false, posteriorALaLectura: true });
    expect(r.filas.find((f) => f.revisionN === 5)).toMatchObject({ esVigente: true, posteriorALaLectura: false });
    expect(r.vigente?.revisionN).toBe(5);
    expect(r.totalCambios).toBe(5);
    expect(r.faltantesTotal).toBe(0);
    expect(r.avisos.map((a) => a.codigo)).toEqual(["cambio_durante_lectura"]);
  });
});

describe("retención parcial (versiones podadas)", () => {
  it("un evento cuya versión ya no está en `retenidas` se marca no/parcial y el panel avisa", async () => {
    sembrar({ n: 3, artefactos: { f2M1: entrada("f2M1", 3, [2, 3]) } }); // la versión 1 se podó
    const r = await ok();
    expect(r.filas.map((f) => f.recuperable)).toEqual(["completo", "completo", "no"]);
    expect(r.filas[2].artefactos[0].recuperable).toBe("no");
    expect(r.avisos.map((a) => a.codigo)).toContain("retencion_parcial");
    // Sin lecturas extra: la lista `retenidas` del manifiesto vigente basta.
    expect(db.contadores().lecturas).toBe(1 + 1 + 3);
  });
  it("evento con dos artefactos de los que solo uno se conserva → parcial", async () => {
    sembrar({
      n: 2,
      eventos: [],
      artefactos: {
        "f3Resultado:r1": entrada("f3Resultado:r1", 2, [2]),
        "f3Asignacion:1-0": entrada("f3Asignacion:1-0", 2, [1, 2]),
      },
      fase: "investigacion",
    });
    db.seed(`${P}/eventos/e1`, evento("investigacion", 1, { artefactos: ["f3Resultado:r1", "f3Asignacion:1-0"], versionIds: { "f3Resultado:r1": "f3Resultado:r1__000001", "f3Asignacion:1-0": "f3Asignacion:1-0__000001" } }));
    const r = await ok({ fase: "investigacion" });
    expect(r.filas[0].recuperable).toBe("parcial");
    expect(r.filas[0].artefactos.map((a) => a.recuperable)).toEqual(["no", "completo"]);
  });
});

describe("deriva al leer", () => {
  const exp = () => ({ linkedSource: { kind: "T22", payload: { P: { x: 1 } } }, m1: { ediciones: {} } });

  it("F2: coincide → false; el vivo cambió sin registro → true; sin huella viva en el manifiesto → null", async () => {
    sembrar({ n: 1, extraFase: exp(), artefactos: { f2M1: entrada("f2M1", 1, [1], { vivo: huellaContenido(vivoF2M1(exp())) }) } });
    expect((await ok()).vigente?.artefactos[0].derivaDetectada).toBe(false);

    sembrar({ n: 1, extraFase: { ...exp(), linkedSource: { kind: "T22", payload: { P: { x: 2 } } } }, artefactos: { f2M1: entrada("f2M1", 1, [1], { vivo: huellaContenido(vivoF2M1(exp())) }) } });
    expect((await ok()).vigente?.artefactos[0].derivaDetectada).toBe(true);

    sembrar({ n: 1, extraFase: exp() });
    expect((await ok()).vigente?.artefactos[0].derivaDetectada).toBeNull();
  });

  it("cierre de fase: una fase «cerrada» en el historial que hoy está «en curso» (H-V36) se marca como deriva", async () => {
    const cerrada = { status: "completed", completedAt: "2026-11-18T10:00:00.000Z", reportText: "R" };
    const artefactos = { "cierre:proposito": entrada("cierre:proposito", 1, [1], { vivo: huellaContenido(vivoCierre("proposito", cerrada)) }) };
    sembrar({ fase: "proposito", n: 1, extraFase: cerrada, artefactos });
    expect((await ok({ fase: "proposito" })).vigente?.artefactos[0].derivaDetectada).toBe(false);
    sembrar({ fase: "proposito", n: 1, extraFase: { ...cerrada, status: "in-progress" }, artefactos });
    expect((await ok({ fase: "proposito" })).vigente?.artefactos[0].derivaDetectada).toBe(true);
  });

  describe("F3: solo con `deriva` (cuesta N lecturas de f3Resultados)", () => {
    const resultado = { moduloPIP: "m1", origen: { componente: "centinela" }, cobertura: {}, payload: { v: 1 }, aprobado: false, createdAt: instante(1) };
    const asig = { asignacionId: "1-0", tipo: "primaria", canal: "canal2", justificacion: "j", estado: "pendiente", activada: true };
    const tablero = [{ pipItemId: "pip-1", asignaciones: [asig] }];
    const asigViva = normalizeTareaPIP(tablero[0] as never).asignaciones[0];
    const artefactos = () => ({
      "f3Resultado:r1": entrada("f3Resultado:r1", 1, [1], { vivo: huellaContenido(vivoResultado(clonar(resultado))) }),
      "f3Asignacion:1-0": entrada("f3Asignacion:1-0", 1, [1], { vivo: huellaContenido(vivoAsignacion(asigViva)) }),
    });
    const base = (res: Doc | null) => ({
      fase: "investigacion", n: 1, artefactos: artefactos(), extraFase: { f3TareasPIP: clonar(tablero) },
      extraDocs: res ? { [`${P}/f3Resultados/r1`]: res } : {},
    });

    it("sin `deriva`: no se comprueba (null) y no se lee f3Resultados", async () => {
      sembrar(base(clonar(resultado)));
      const r = await ok({ fase: "investigacion" });
      expect(r.vigente?.artefactos.map((a) => a.derivaDetectada)).toEqual([null, null]);
      expect(db.contadores().lecturas).toBe(1 + 1 + 1); // proyecto + manifiesto + 1 evento
    });
    it("con `deriva`: coincide → false, y cuesta N lecturas más (N = resultados)", async () => {
      sembrar(base(clonar(resultado)));
      const r = await ok({ fase: "investigacion", conDeriva: true });
      expect(r.vigente?.artefactos.map((a) => a.derivaDetectada)).toEqual([false, false]);
      expect(db.contadores().lecturas).toBe(1 + 1 + 1 + 1);
    });
    it("con `deriva`: el resultado cambió sin registro, o ya no existe → true", async () => {
      const deriva = async (nombre: string) =>
        (await ok({ fase: "investigacion", conDeriva: true })).vigente?.artefactos.find((a) => a.nombre === nombre)?.derivaDetectada;
      sembrar(base({ ...clonar(resultado), payload: { v: 2 } }));
      expect(await deriva("f3Resultado:r1")).toBe(true);
      expect(await deriva("f3Asignacion:1-0")).toBe(false); // la asignación sigue igual
      sembrar(base(null));
      expect(await deriva("f3Resultado:r1")).toBe(true);
    });
    it("con `deriva`: una asignación que ya no está en el tablero → true", async () => {
      sembrar({ ...base(clonar(resultado)), extraFase: { f3TareasPIP: [] } });
      const r = await ok({ fase: "investigacion", conDeriva: true });
      expect(r.vigente?.artefactos.find((a) => a.nombre === "f3Asignacion:1-0")?.derivaDetectada).toBe(true);
    });
  });

  it("el evento que registró una deriva lo dice (`derivaAntes`)", async () => {
    sembrar({ n: 2, eventos: [] });
    db.seed(`${P}/eventos/e1`, evento("exploracion", 1));
    db.seed(`${P}/eventos/e2`, evento("exploracion", 2, { artefactosConDeriva: ["f2M1"] }));
    expect((await ok()).filas.map((f) => f.derivaAntes)).toEqual([true, false]);
  });
});

describe("errores del lector", () => {
  const dbConConsulta = (consulta: () => Promise<unknown>) =>
    ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ collaborators: COLABORADORES, phases: { exploracion: {} } }) }),
          collection: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ get: consulta }) }) }) }),
        }),
      }),
    }) as unknown as Firestore;

  it("índice compuesto aún no listo (código 9 / FAILED_PRECONDITION) → IndiceNoListoError, nunca «sin historial»", async () => {
    for (const err of [{ code: 9, message: "x" }, new Error("9 FAILED_PRECONDITION: The query requires an index.")]) {
      await expect(
        leerHistorialFase(dbConConsulta(async () => { throw err; }), { proyectoId: "p1", uid: "u1", fase: "exploracion", limite: 20 })
      ).rejects.toBeInstanceOf(IndiceNoListoError);
    }
  });
  it("otro error de Firestore se propaga tal cual", async () => {
    await expect(
      leerHistorialFase(dbConConsulta(async () => { throw new Error("boom"); }), { proyectoId: "p1", uid: "u1", fase: "exploracion", limite: 20 })
    ).rejects.toThrow("boom");
  });
  it("puntero inválido, revisión inexistente o manifiesto que no coincide → HistorialIlegibleError", async () => {
    sembrar({ n: 2, extraFase: { revision: { n: "dos" } } });
    // `extraFase` va ANTES del puntero: se reemplaza el puntero a mano.
    db.seed(P, { ...(db.snapshot()[P] as Doc), phases: { exploracion: { revision: { n: "dos" } } } });
    await expect(leer()).rejects.toBeInstanceOf(HistorialIlegibleError);

    sembrar({ n: 2 });
    db.seed(P, { ...(db.snapshot()[P] as Doc), phases: { exploracion: { revision: { n: 9, huella: "h", por: "u1", en: instante(1) } } } });
    await expect(leer()).rejects.toBeInstanceOf(HistorialIlegibleError);

    sembrar({ n: 2 });
    db.seed(`${P}/revisiones/exploracion_000002`, { fase: "exploracion", n: 7, artefactos: {} });
    await expect(leer()).rejects.toBeInstanceOf(HistorialIlegibleError);
  });
});

describe("solo lectura: nunca escribe", () => {
  it("ni el proyecto (`lastAccessedAt`), ni el historial, ni nada: 0 escrituras y el almacén queda idéntico", async () => {
    sembrar({ n: 6, extraFase: { reportText: "R" } });
    const antes = JSON.stringify(db.snapshot());
    await ok();
    await ok({ cursor: 3, limite: 2 });
    expect(db.contadores().escrituras).toBe(0);
    expect(db.contadores().borrados).toBe(0);
    expect(db.updates()).toEqual([]);
    expect(JSON.stringify(db.snapshot())).toBe(antes);
  });
});

describe("integración con el registrador REAL (la forma de lo que escribe producción)", () => {
  it("dos acciones de F2 registradas con prepararVersion/aplicarVersion se leen bien", async () => {
    const exp = { linkedSource: { kind: "T22", payload: { P: { x: 1 } } }, m1: { ediciones: {} } };
    db.reset({ [P]: { name: "Proyecto", status: "active", collaborators: COLABORADORES, phases: { exploracion: clonar(exp) } } });
    db.rechazarUndefined(true);
    db.atomico(true);
    const base = { punteroCampo: PUNTERO_F2, ambito: AMBITO_F2, fase: FASE_F2 };
    await registrarEnSemilla(
      db, P,
      [{ artefacto: "f2M1", ...estadoF2M1(exp, { aprobado: true, por: "u1", en: "2026-11-01T10:00:00.000Z", huella: "h", categoriasEditadas: 0, total: 6 }), vivo: vivoF2M1(exp) }],
      { ...base, por: "u1", motivo: "aprobacion" }
    );
    consolidarF2(db, P);
    await registrarEnSemilla(
      db, P,
      [{ artefacto: "f2M1", ...estadoF2M1(exp, { aprobado: false, por: "u2", en: "2026-11-02T10:00:00.000Z" }), vivo: vivoF2M1(exp), estadoPrevio: estadoF2M1(exp, { aprobado: true, por: "u1", en: "2026-11-01T10:00:00.000Z", huella: "h", categoriasEditadas: 0, total: 6 }), vivoPrevio: vivoF2M1(exp) }],
      { ...base, tipoCambio: "reapertura", por: "u2", motivo: "reapertura" }
    );
    consolidarF2(db, P);

    const r = await ok();
    expect(r.totalCambios).toBe(2);
    expect(r.filas.map((f) => f.titulo)).toEqual(["Volvió a abrir el análisis de la Fase 2 para revisarlo", "Aprobó el análisis de la Fase 2"]);
    expect(r.filas.map((f) => f.quien)).toEqual(["Ana", "Raúl"]);
    expect(r.filas[0]).toMatchObject({ esVigente: true, recuperable: "completo" });
    expect(r.filas.every((f) => f.en !== null)).toBe(true);
    expect(r.vigente?.artefactos[0]).toMatchObject({ nombre: "f2M1", derivaDetectada: false });
    expect(r.avisos).toEqual([]);
    expect(r.faltantesTotal).toBe(0);
  });
});
