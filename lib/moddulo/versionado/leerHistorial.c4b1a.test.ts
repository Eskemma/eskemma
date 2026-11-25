// C4b-1a — lector: `Recuperable` gana `desconocido` (H-V62: registro incompleto ≠ «ya no se conserva») y la respuesta
// gana el booleano aditivo `puedeVolver` (owner y co-consultant). Todo lo demás del lector queda como estaba.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { recuperabilidad, recuperabilidadDeEvento } from "@/lib/versionado/lectura";
import { leerHistorialFase } from "./leerHistorial";
import { puedeVolverAVersion } from "./visibilidadHistorial";
import { marcasDeFila, TEXTO_MARCA } from "./estadoPanelHistorial";

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
const ART = "f3Resultado:r1";
const evento = (n: number, over: Doc = {}): Doc => ({
  tipo: "ajuste_manual", fase: "investigacion", ambito: "moddulo", artefactos: [ART], revisionN: n,
  versionIds: { [ART]: `${ART}__${pad(n)}` }, por: "u1", en: instante(n), fuente: "usuario", motivo: "aprobacion", ...over,
});
function sembrar(n: number, retenidas: number[], eventos: Doc[]) {
  const docs: Record<string, unknown> = {
    [P]: { name: "P", collaborators: COLABORADORES, phases: { investigacion: { revision: { n, huella: "h", por: "u1", en: instante(n) } } } },
    [`${P}/revisiones/investigacion_${pad(n)}`]: {
      fase: "investigacion", ambito: "moddulo", n,
      artefactos: { [ART]: { versionId: `${ART}__${pad(n)}`, n, tupla: "t", dependeDe: [], retenidas: retenidas.map((r) => ({ id: `${ART}__${pad(r)}`, n: r, aprobada: false, protegida: false })) } },
    },
  };
  eventos.forEach((e, i) => { docs[`${P}/eventos/e${i + 1}`] = e; });
  db.reset(docs);
  db.rechazarUndefined(true);
  db.atomico(true);
}
const ok = async (uid = "u1") => {
  const r = await leerHistorialFase(firestore, { proyectoId: "p1", uid, fase: "investigacion", limite: 20 });
  if (r.tipo !== "ok") throw new Error(`se esperaba ok y fue ${r.tipo}`);
  return r.respuesta;
};
beforeEach(() => db.reset({}));

describe("recuperabilidadDeEvento (H-V62)", () => {
  const existen = new Set(["a__1", "b__1"]);
  it("caracterización: `recuperabilidad` NO cambia (lista vacía o id nulo siguen siendo «no»)", () => {
    expect(recuperabilidad([], existen)).toBe("no");
    expect(recuperabilidad([null], existen)).toBe("no");
    expect(recuperabilidad(["a__1", "b__9"], existen)).toBe("parcial");
  });
  it("sin artefactos o con algún versionId ausente → desconocido", () => {
    expect(recuperabilidadDeEvento([], existen)).toBe("desconocido");
    expect(recuperabilidadDeEvento([null], existen)).toBe("desconocido");
    expect(recuperabilidadDeEvento(["a__1", null], existen)).toBe("desconocido");
  });
  it("con todos los ids presentes rige la poda: completo / parcial / no", () => {
    expect(recuperabilidadDeEvento(["a__1", "b__1"], existen)).toBe("completo");
    expect(recuperabilidadDeEvento(["a__1", "b__9"], existen)).toBe("parcial");
    expect(recuperabilidadDeEvento(["a__9", "b__9"], existen)).toBe("no");
  });
});

describe("lector: desconocido vs no conservada", () => {
  it("evento con el artefacto SIN versionId: la fila y el artefacto son «desconocido», no «no»", async () => {
    sembrar(2, [1, 2], [evento(2), evento(1, { versionIds: {} })]);
    const r = await ok();
    const f1 = r.filas.find((f) => f.revisionN === 1)!;
    expect(f1.recuperable).toBe("desconocido");
    expect(f1.artefactos[0]).toMatchObject({ versionId: null, recuperable: "desconocido" });
  });
  it("evento SIN artefactos: la fila es «desconocido»", async () => {
    sembrar(2, [1, 2], [evento(2), evento(1, { artefactos: [], versionIds: {} })]);
    expect((await ok()).filas.find((f) => f.revisionN === 1)!.recuperable).toBe("desconocido");
  });
  it("versión podada de verdad (no está entre las retenidas): sigue «no» (retención), no «desconocido»", async () => {
    sembrar(3, [3, 2], [evento(3), evento(2), evento(1)]);
    const r = await ok();
    expect(r.filas.map((f) => f.recuperable)).toEqual(["completo", "completo", "no"]);
  });
  it("el aviso `eventos_incompletos` se mantiene para el evento incompleto (y no hay `retencion_parcial`)", async () => {
    sembrar(2, [1, 2], [evento(2), evento(1, { versionIds: {} })]);
    const codigos = (await ok()).avisos.map((a) => a.codigo);
    expect(codigos).toContain("eventos_incompletos");
    expect(codigos).not.toContain("retencion_parcial");
  });
  it("costo sin cambio: 1 proyecto + 1 manifiesto + K eventos", async () => {
    sembrar(2, [1, 2], [evento(2), evento(1)]);
    await ok();
    expect(db.contadores().lecturas).toBe(1 + 1 + 2);
  });
});

describe("panel: marca nueva para «desconocido» (sin botón)", () => {
  const fila = (recuperable: "completo" | "parcial" | "no" | "desconocido") => ({
    revisionN: 1, eventoId: "e", en: null, quien: "x", tipo: "ajuste_manual", titulo: "t", detalleTexto: null, artefactos: [],
    esVigente: false, derivaAntes: false, posteriorALaLectura: false, recuperable,
  });
  it("«No se pudo comprobar si esta versión se conserva.» y NO «ya no se conserva»", () => {
    const m = marcasDeFila(fila("desconocido"));
    expect(m.map((x) => x.clave)).toEqual(["no_comprobada"]);
    expect(m[0].texto).toBe("No se pudo comprobar si esta versión se conserva.");
    expect(TEXTO_MARCA.no_comprobada).not.toContain("ya no se conserva");
  });
  it("las marcas existentes no cambian", () => {
    expect(marcasDeFila(fila("no")).map((x) => x.clave)).toEqual(["no_conservada"]);
    expect(marcasDeFila(fila("parcial")).map((x) => x.clave)).toEqual(["parcial"]);
    expect(marcasDeFila(fila("completo"))).toEqual([]);
  });
});

describe("puedeVolver (aditivo)", () => {
  it.each([["u1", true], ["u2", true], ["u3", false], ["u4", false]])("%s → %s", async (uid, esperado) => {
    sembrar(1, [1], [evento(1)]);
    expect((await ok(uid)).puedeVolver).toBe(esperado);
  });
  it("la regla vive en UNA función y coincide", () => {
    expect(puedeVolverAVersion("owner")).toBe(true);
    expect(puedeVolverAVersion("co-consultant")).toBe(true);
    expect(puedeVolverAVersion("analyst")).toBe(false);
    expect(puedeVolverAVersion("client")).toBe(false);
  });
  it("no cambia nada más de la respuesta: las demás claves y su contenido son los de siempre", async () => {
    sembrar(1, [1], [evento(1)]);
    const r = await ok();
    expect(Object.keys(r).sort()).toEqual(["avisos", "faltantes", "faltantesTotal", "fase", "filas", "puedeVolver", "siguienteCursor", "totalCambios", "vigente"]);
    expect(r).toMatchObject({ fase: "investigacion", totalCambios: 1, siguienteCursor: null, avisos: [], faltantesTotal: 0 });
  });
  it("sin permiso de ver (no colaborador) no hay respuesta, así que tampoco `puedeVolver`", async () => {
    sembrar(1, [1], [evento(1)]);
    const r = await leerHistorialFase(firestore, { proyectoId: "p1", uid: "ajeno", fase: "investigacion", limite: 20 });
    expect(r.tipo).toBe("no_encontrado");
  });
});
