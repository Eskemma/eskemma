// C4a-1 — GET del historial: sesión, validación de parámetros, 404 idéntico (inexistente / papelera / ajeno), lectura por
// los cuatro roles (los casos client y analyst no se pueden probar en el navegador con una sola cuenta: se cubren aquí),
// forma de la respuesta, `Cache-Control: no-store` y SOLO LECTURA (cero escrituras). Sin emulador (Java 17).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});

import { Timestamp } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { GET } from "./route";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const pad = (n: number) => String(n).padStart(6, "0");
type Doc = Record<string, unknown>;

const COLABORADORES = [
  { uid: "owner", role: "owner", displayName: "Raúl" },
  { uid: "coco", role: "co-consultant", displayName: "Ana" },
  { uid: "anal", role: "analyst", displayName: "Luis" },
  { uid: "cli", role: "client", displayName: "Candidata" },
];

function sembrar(n = 3, extra: Doc = {}) {
  const docs: Record<string, unknown> = {
    [P]: {
      name: "Proyecto", collaborators: COLABORADORES, lastAccessedAt: Timestamp.fromDate(new Date("2026-11-09T10:30:00.000Z")),
      phases: { exploracion: { revision: { n, huella: "h", por: "owner", en: Timestamp.fromDate(new Date("2026-11-10T10:00:00.000Z")) } } },
      ...extra,
    },
    [`${P}/revisiones/exploracion_${pad(n)}`]: {
      fase: "exploracion", ambito: "moddulo", n,
      artefactos: { f2M1: { versionId: `f2M1__${pad(n)}`, n, tupla: "t", dependeDe: [], retenidas: Array.from({ length: n }, (_, i) => ({ id: `f2M1__${pad(i + 1)}`, n: i + 1, aprobada: false, protegida: false })) } },
    },
  };
  for (let i = 1; i <= n; i++) {
    docs[`${P}/eventos/e${i}`] = {
      tipo: "ajuste_manual", fase: "exploracion", ambito: "moddulo", artefactos: ["f2M1"], revisionN: i,
      versionIds: { f2M1: `f2M1__${pad(i)}` }, por: "owner", en: Timestamp.fromDate(new Date(Date.UTC(2026, 10, 1, 10, i))), fuente: "usuario", motivo: "aprobacion",
    };
  }
  db.reset(docs);
  db.rechazarUndefined(true);
}

const pedir = (qs: string, projectId = "p1") =>
  GET(new Request(`http://local/api/moddulo/projects/${projectId}/historial${qs}`) as never, { params: Promise.resolve({ projectId }) });
const sesion = (uid: string | null) =>
  vi.mocked(getSessionFromRequest).mockResolvedValue(uid ? mockSessionPayload({ uid }) : (null as never));

beforeEach(() => {
  sesion("owner");
  sembrar();
});

describe("acceso", () => {
  it("sin sesión → 401", async () => {
    sesion(null);
    expect((await pedir("?fase=exploracion")).status).toBe(401);
  });
  it("proyecto inexistente, en la papelera y de otro usuario → el MISMO 404", async () => {
    const cuerpos: unknown[] = [];
    sesion("extraño");
    let r = await pedir("?fase=exploracion");
    cuerpos.push(await r.json());
    expect(r.status).toBe(404);
    sesion("owner");
    r = await pedir("?fase=exploracion", "no-existe");
    cuerpos.push(await r.json());
    expect(r.status).toBe(404);
    sembrar(3, { deletedAt: Timestamp.fromDate(new Date("2026-11-11T10:00:00.000Z")) });
    r = await pedir("?fase=exploracion");
    cuerpos.push(await r.json());
    expect(r.status).toBe(404);
    expect(new Set(cuerpos.map((c) => JSON.stringify(c))).size).toBe(1);
  });
  it.each([["owner"], ["coco"], ["anal"], ["cli"]])("el colaborador %s (dueño, co-consultor, analista, cliente) lee el historial", async (uid) => {
    sesion(uid);
    const r = await pedir("?fase=exploracion");
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as { filas: unknown[]; totalCambios: number };
    expect(cuerpo.totalCambios).toBe(3);
    expect(cuerpo.filas).toHaveLength(3);
  });
});

describe("validación de parámetros", () => {
  it.each([
    ["?fase=diagnostico", "fase_sin_historial"],
    ["?fase=estrategia", "fase_sin_historial"],
    ["", "fase_sin_historial"],
    ["?fase=%00", "fase_sin_historial"],
    ["?fase=exploracion&limite=0", "parametro_invalido"],
    ["?fase=exploracion&limite=51", "parametro_invalido"],
    ["?fase=exploracion&limite=abc", "parametro_invalido"],
    ["?fase=exploracion&limite=-3", "parametro_invalido"],
    ["?fase=exploracion&limite=2.5", "parametro_invalido"],
    ["?fase=exploracion&cursor=0", "parametro_invalido"],
    ["?fase=exploracion&cursor=x", "parametro_invalido"],
    ["?fase=exploracion&cursor=1e3", "parametro_invalido"],
  ])("%s → 400 %s", async (qs, codigo) => {
    const r = await pedir(qs);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe(codigo);
  });
  it("las tres fases con historial y el límite máximo se aceptan", async () => {
    for (const f of ["proposito", "exploracion", "investigacion"]) expect((await pedir(`?fase=${f}&limite=50`)).status).toBe(200);
  });
  it("un parámetro inválido no llega a leer Firestore", async () => {
    db.reset(db.snapshot());
    await pedir("?fase=exploracion&limite=0");
    expect(db.contadores().lecturas).toBe(0);
  });
});

describe("respuesta", () => {
  it("200 con el contrato, sin caché y con la fase pedida", async () => {
    const r = await pedir("?fase=exploracion&limite=2");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const c = await r.json();
    expect(Object.keys(c).sort()).toEqual(["avisos", "faltantes", "faltantesTotal", "fase", "filas", "puedeVolver", "siguienteCursor", "totalCambios", "vigente"]);
    expect(c.fase).toBe("exploracion");
    expect(c.filas.map((f: { revisionN: number }) => f.revisionN)).toEqual([3, 2]);
    expect(c.siguienteCursor).toBe(2);
    expect(c.filas[0]).toMatchObject({ titulo: "Aprobó el análisis de la Fase 2", quien: "Raúl", esVigente: true });
  });
  it("el cursor trae las revisiones menores", async () => {
    const c = await (await pedir("?fase=exploracion&limite=2&cursor=2")).json();
    expect(c.filas.map((f: { revisionN: number }) => f.revisionN)).toEqual([1]);
    expect(c.siguienteCursor).toBeNull();
  });
  it("fase sin historial: 200 con 0 cambios y sin avisos (no es un error)", async () => {
    const c = await (await pedir("?fase=proposito")).json();
    expect(c).toMatchObject({ fase: "proposito", totalCambios: 0, filas: [], vigente: null, avisos: [] });
  });
  it("no filtra identificadores internos de los colaboradores (solo nombres de pantalla)", async () => {
    const texto = JSON.stringify(await (await pedir("?fase=exploracion")).json());
    expect(texto).not.toContain("\"por\"");
    expect(texto).not.toContain("\"uid\"");
    expect(texto).not.toContain("\"versionIds\"");
  });
});

describe("solo lectura", () => {
  it("la ruta no escribe nada (ni `lastAccessedAt`): 0 escrituras y el almacén queda idéntico", async () => {
    db.reset(db.snapshot());
    const antes = JSON.stringify(db.snapshot());
    for (const qs of ["?fase=exploracion", "?fase=exploracion&cursor=2&limite=1", "?fase=investigacion&deriva=1", "?fase=proposito"]) {
      expect((await pedir(qs)).status).toBe(200);
    }
    expect(db.contadores().escrituras).toBe(0);
    expect(db.contadores().borrados).toBe(0);
    expect(db.updates()).toEqual([]);
    expect(JSON.stringify(db.snapshot())).toBe(antes);
  });
});
