// T7 C3b — caracterización (Paso 0): A vinculado con nota → Desvincular (sondeo 409, luego 200) → importar B (aprobado con 39
// SIN justificación). Escrita contra el código de C3 y VERDE sin tocar producción: el escenario 4 de la verificación en
// navegador («la nota de A reaparece tras importar B») NO se reproduce en el servidor. Fija que B no hereda nada de A, que
// `lastUnlinkedLinkedSource` se borra y que la respuesta del import coincide con lo guardado.
//
// El mock de Firestore guarda las claves con punto planas; aquí se aplican como rutas de campo (con `FieldValue.delete()`)
// para que el estado entre pasos sea el de un Firestore real. Sin emulador (Java 17): la atomicidad real no se prueba.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", async (orig) => ({ ...(await orig<typeof import("@/lib/moddulo/project")>()), getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST as importar } from "./route";
import { POST as desvincular } from "../unlink-pestel/route";
import { huellaDeOrigen } from "@/lib/centinela/pestel/huellaOrigen";
import { DIMENSIONES_EJEMPLO } from "@/lib/centinela/pestel/__fixtures__/analisisEjemplo";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const MOD = "moddulo_projects/m1";
const clon = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const JUST_A = "Aprobado con confianza baja: la muestra es pequeña pero el territorio es conocido.";
const APROBADO_B = "2026-11-04T19:14:20.619Z";

let D: Record<string, any>;

/** Aplica una escritura por ruta de campo («a.b.c») sobre un objeto; `__DELETE__` borra la ruta. */
function aplicar(doc: Record<string, any>, data: Record<string, unknown>) {
  for (const [ruta, valor] of Object.entries(data)) {
    const partes = ruta.split(".");
    let o = doc;
    for (const p of partes.slice(0, -1)) o = o[p] = o[p] && typeof o[p] === "object" ? o[p] : {};
    const ultima = partes.at(-1)!;
    if (valor === "__DELETE__") delete o[ultima];
    else o[ultima] = clon(valor);
  }
}
/** Ejecuta un paso contra el estado `D` y aplica sus escrituras; devuelve respuesta y cuántas escrituras hubo. */
async function paso<T extends { status: number }>(fn: () => Promise<T & { json: () => Promise<any> }>) {
  db.reset(clon(D));
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (D[`moddulo_projects/${id}`] ? { id, ...clon(D[`moddulo_projects/${id}`]) } : null) as never);
  const r = await fn();
  const cuerpo = await r.json();
  const escrituras = db.updates();
  for (const u of escrituras) aplicar((D[u.path] ??= {}), u.data);
  return { status: r.status, cuerpo, escrituras: escrituras.length };
}
const req = (cuerpo: unknown) => new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never;
const importa = (pestAnalysisId: string, extra: object = {}) => paso(() => importar(req({ projectId: "m1", pestAnalysisId, ...extra })));
const desvincula = (extra: object = {}) => paso(() => desvincular(req({ projectId: "m1", ...extra })));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  const analisis = (extra: object) => ({ projectId: "pest1", status: "APPROVED", vigente: true, version: 1, analyzedAt: "2026-11-01T00:00:00.000Z", globalConfidence: 39, dimensions: clon(DIMENSIONES_EJEMPLO), adjustments: [], ...extra });
  D = {
    "pestel_analyses/aA": analisis({ approvedAt: "2026-11-05T19:14:20.619Z", aprobacionJustificacion: JUST_A, aprobacionConfianza: 39 }),
    "pestel_analyses/aB": analisis({ approvedAt: APROBADO_B }), // aprobado con 39 ANTES de T6-9a: sin justificación guardada
    "pestel_projects/pest1": { userId: "u1" },
    [MOD]: { name: "M", type: "electoral", xpcto: { hito: "h" }, collaborators: [{ uid: "u1", role: "owner" }], phases: { exploracion: {} } },
  };
});

const ls = () => D[MOD].phases.exploracion.linkedSource;
const exp = () => D[MOD].phases.exploracion;

describe("secuencia A → Desvincular → B (el servidor no arrastra la nota)", () => {
  it("el import de A guarda su nota con justificación y la huella v2 con ella", async () => {
    const r = await importa("aA");
    expect(r.status).toBe(200);
    expect(ls().sourceAnalysisId).toBe("aA");
    expect(ls().aprobacionOrigen).toMatchObject({ confianza: 39, justificacion: JUST_A });
    expect(ls().huellaFuente).toEqual(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, [] as never, { nota: { confianza: 39, justificacion: JUST_A } }));
  });

  it("Desvincular: el sondeo (409) no escribe nada; confirmado (200) borra el vínculo y el M1 y guarda la copia de A con su sourceId real", async () => {
    await importa("aA");
    const antes = clon(D);
    const sondeo = await desvincula();
    expect(sondeo.status).toBe(409);
    expect(sondeo.escrituras).toBe(0);
    expect(D).toEqual(antes); // cancelar el modal = nada cambia (vínculo, M1 y nota de A intactos)
    const ok = await desvincula({ confirmar: true, huella: sondeo.cuerpo.huella });
    expect(ok.status).toBe(200);
    expect(ls()).toBeUndefined();
    expect(exp().m1).toBeUndefined();
    expect(exp().lastUnlinkedLinkedSource.sourceId).toBe("pest1"); // nunca vacío
    expect(exp().lastUnlinkedLinkedSource.sourceAnalysisId).toBe("aA");
    expect(D["pestel_projects/pest1"].modduloProjectId).toBeUndefined();
  });

  it("importar B (39 SIN justificación) tras desvincular: 200 directo, sin la justificación de A, sin lastUnlinked, respuesta == lo guardado", async () => {
    await importa("aA");
    const s = await desvincula();
    await desvincula({ confirmar: true, huella: s.cuerpo.huella });
    const r = await importa("aB");
    expect(r.status).toBe(200); // directo: ni modal ni confirmación
    expect(ls().sourceAnalysisId).toBe("aB");
    expect(ls().aprobacionOrigen).toEqual({ confianza: 39, aprobadoEn: APROBADO_B });
    expect("justificacion" in ls().aprobacionOrigen).toBe(false);
    expect(JSON.stringify(ls())).not.toContain("muestra es pequeña");
    expect(ls().huellaFuente).toEqual(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, [] as never, { nota: { confianza: 39 } }));
    expect(exp().lastUnlinkedLinkedSource).toBeUndefined();
    expect(exp().m1.creadoEn).toBeDefined();
    expect(clon(r.cuerpo.linkedSource)).toEqual(clon(ls())); // la respuesta del import == la lectura posterior
  });

  it("«Vincular de nuevo» tras B no restaura A por sí solo: ya no hay copia que ofrecer; solo el POST explícito con el id de A (el botón) la reimporta, con confirmación", async () => {
    await importa("aA");
    const s = await desvincula();
    await desvincula({ confirmar: true, huella: s.cuerpo.huella });
    await importa("aB");
    expect(exp().lastUnlinkedLinkedSource).toBeUndefined(); // lo único que hace aparecer «Vincular de nuevo» al cargar
    expect(ls().sourceAnalysisId).toBe("aB");
    // La acción EXPLÍCITA (lo que haría el botón con un id viejo en memoria): pide confirmar el reemplazo y solo entonces escribe A.
    const sondeo = await importa("aA");
    expect(sondeo.status).toBe(409);
    expect(sondeo.escrituras).toBe(0);
    expect(ls().sourceAnalysisId).toBe("aB");
    const ok = await importa("aA", { confirmar: true, huella: sondeo.cuerpo.huella });
    expect(ok.status).toBe(200);
    expect(ls().sourceAnalysisId).toBe("aA");
    expect(ls().aprobacionOrigen.justificacion).toBe(JUST_A);
  });
});
