// T4 — contrato de escritores, CAPA B: se EJECUTA cada ruta que edita un análisis existente y se comprueba que
// (1) solo escribe los campos que su entrada de ESCRITORES_DE_ANALISIS declara en `toca` y (2) `dimensions`,
// `globalConfidence` y `version` quedan idénticos. Ver escritoresDeAnalisis.ts.
//
// Límites: cubre solo las rutas con fixture aquí (adjust, approve, acknowledge-bias, impact-chain POST/DELETE,
// informes POST/PATCH). `generate-report` (llama al modelo) y `generateFeed` (Cloud Function, crea documentos
// nuevos) quedan en la capa A; el DELETE del proyecto borra el documento entero.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "TS", delete: () => "__DELETE__", arrayUnion: (...x: unknown[]) => ({ __union: x }) },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { ESCRITORES_DE_ANALISIS, CAMPOS_PROTEGIDOS_DE_ANALISIS } from "./escritoresDeAnalisis";
import { POST as ajustar } from "@/app/api/centinela/pestel/analysis/[analysisId]/adjust/route";
import { POST as aprobar } from "@/app/api/centinela/pestel/analysis/[analysisId]/approve/route";
import { POST as reconocer } from "@/app/api/centinela/pestel/analysis/[analysisId]/acknowledge-bias/route";
import { POST as agregarCadena, DELETE as borrarCadena } from "@/app/api/centinela/pestel/analysis/[analysisId]/impact-chain/route";
import { POST as migrarInformes } from "@/app/api/centinela/pestel/analysis/[analysisId]/informes/route";
import { PATCH as editarInforme } from "@/app/api/centinela/pestel/analysis/[analysisId]/informes/[informeId]/route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ analysisId: "a1" }) };
const ctxInforme = { params: Promise.resolve({ analysisId: "a1", informeId: "i1" }) };
const req = (metodo: string, cuerpo?: unknown) =>
  new Request("http://local/x", { method: metodo, ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}) }) as never;

const A = "app/api/centinela/pestel/analysis/[analysisId]";
const DIMS = [{ code: "P", classification: "AMENAZA", intensity: "ALTA", trend: "ASCENDENTE", narrative: "n", confidence: 70 }];
const analisis = () => ({
  projectId: "p1", userId: "u1", status: "REVIEWED", vigente: true, version: 3, globalConfidence: 72,
  dimensions: structuredClone(DIMS), adjustments: [], biasAlerts: [{ type: "urbano", acknowledgedAt: "x", acknowledgedBy: "u1" }],
  impactChains: [{ dimensions: ["P"], description: "m", riskLevel: "ALTO", recommendation: "r", source: "analyst", addedByUserId: "u1", id: "c1" }],
  informes: [{ id: "i1", formato: "ejecutivo", contenidoTexto: "gen", datosEstructurados: { scorecard: [], mapaPESTEL: {} }, generadoEn: "2026-10-01T10:00:00.000Z" }],
});
const sembrar = () => {
  db.reset({
    "pestel_analyses/a1": analisis(),
    "pestel_projects/p1": { userId: "u1", currentStage: 6, nombre: "P" },
  });
  db.atomico(true);
};

/** Lista de problemas de un escritor: campos escritos que su entrada no declara y campos protegidos que cambiaron. */
function violaciones(
  archivo: string,
  toca: string[],
  escrituras: Array<Record<string, unknown>>,
  antes: Record<string, unknown>,
  despues: Record<string, unknown>
): string[] {
  const out: string[] = [];
  for (const e of escrituras) {
    for (const clave of Object.keys(e)) {
      const campo = clave.split(".")[0];
      if (!toca.includes(campo)) out.push(`${archivo} escribió «${campo}» y su entrada no lo declara`);
    }
  }
  for (const p of CAMPOS_PROTEGIDOS_DE_ANALISIS) {
    if (JSON.stringify(despues[p]) !== JSON.stringify(antes[p])) out.push(`${archivo} cambió ${p}`);
  }
  return out;
}

const casos: Array<{ nombre: string; archivo: string; ejecutar: () => Promise<Response> }> = [
  { nombre: "adjust", archivo: `${A}/adjust/route.ts`, ejecutar: () => ajustar(req("POST", { dimensionCode: "P", newPosition: { x: 40, y: 20 }, newClassification: "NEUTRAL", justification: "Una razón de más de veinte caracteres." }), ctx) },
  { nombre: "approve", archivo: `${A}/approve/route.ts`, ejecutar: () => aprobar(req("POST", {}), ctx) },
  { nombre: "acknowledge-bias", archivo: `${A}/acknowledge-bias/route.ts`, ejecutar: () => reconocer(req("POST", { biasType: "urbano" }), ctx) },
  { nombre: "impact-chain POST", archivo: `${A}/impact-chain/route.ts`, ejecutar: () => agregarCadena(req("POST", { dimensions: ["P"], description: "nueva", riskLevel: "ALTO" }), ctx) },
  { nombre: "impact-chain DELETE", archivo: `${A}/impact-chain/route.ts`, ejecutar: () => borrarCadena(req("DELETE", { chainId: "c1" }), ctx) },
  { nombre: "informes POST", archivo: `${A}/informes/route.ts`, ejecutar: () => migrarInformes(req("POST", { formato: "executive", contenido: "texto migrado" }), ctx) },
  { nombre: "informes PATCH", archivo: `${A}/informes/[informeId]/route.ts`, ejecutar: () => editarInforme(req("PATCH", { contenido: "editado" }), ctxInforme) },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("contrato de escritores de pestel_analyses — capa B (se ejecuta cada ruta)", () => {
  it.each(casos)("$nombre: escribe solo lo que declara y no toca dimensions, globalConfidence ni version", async ({ archivo, ejecutar }) => {
    sembrar();
    const antes = structuredClone(db.snapshot()["pestel_analyses/a1"] as Record<string, unknown>);
    const r = await ejecutar();
    expect(r.status, `la ruta ${archivo} debería responder 2xx`).toBeLessThan(300);
    expect(r.status).toBeGreaterThanOrEqual(200);
    const entrada = ESCRITORES_DE_ANALISIS.find((e) => e.archivo === archivo);
    expect(entrada, `${archivo} no está en ESCRITORES_DE_ANALISIS`).toBeDefined();
    const escrituras = db.updates().filter((u) => u.path === "pestel_analyses/a1");
    expect(escrituras.length).toBeGreaterThan(0);
    expect(violaciones(archivo, entrada!.toca, escrituras.map((e) => e.data), antes, db.snapshot()["pestel_analyses/a1"] as Record<string, unknown>)).toEqual([]);
  });

  it("el verificador SÍ detecta un escritor que toca dimensions o un campo no declarado (negativo del propio contrato)", () => {
    const antes = { dimensions: [{ code: "P" }], version: 3, globalConfidence: 72 };
    expect(violaciones("x.ts", ["status"], [{ status: "APPROVED" }], antes, { ...antes, status: "APPROVED" })).toEqual([]);
    expect(violaciones("x.ts", ["status"], [{ dimensions: [] }], antes, { ...antes, dimensions: [] }).join(" ")).toMatch(/dimensions/);
    expect(violaciones("x.ts", ["status"], [{ "dimensions.0.code": "E" }], antes, antes).join(" ")).toMatch(/no lo declara/);
    expect(violaciones("x.ts", ["status"], [{ status: "A" }], antes, { ...antes, version: 4 }).join(" ")).toMatch(/cambió version/);
  });
});
