// C3a-2 — M3 recibe la MISMA serialización. `sintesis/generar` serializa el documento vivo COMPLETO de cada
// resultado aprobado al prompt del modelo (hallazgo aparte: debería usar una lista explícita de campos). Por eso
// el sello de la aprobación (quién/cuándo/huella) vive SOLO en la versión. Esta prueba corre la ruta REAL de
// aprobar y luego la ruta REAL de sintesis/generar (con Claude simulado) y compara el prompt COMPLETO que recibe
// el modelo contra el que recibiría con el documento que escribía la ruta ANTERIOR ({...previo, aprobado, notas}).
// Límite: no llama al modelo real; compara lo que se le enviaría.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async () => ({
  ...(await vi.importActual<typeof import("@/lib/moddulo/project")>("@/lib/moddulo/project")),
  getProject: vi.fn(),
}));
vi.mock("@/lib/ai/claude", () => ({
  anthropic: { messages: { create: vi.fn() } },
  CLAUDE_MODEL: "modelo-de-prueba",
}));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, normalizeTareaPIP } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { adminDb } from "@/lib/firebase-admin";
import { POST as APROBAR } from "./route";
import { POST as SINTESIS } from "../../sintesis/generar/route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { SIEMBRA_SINTESIS } from "@/lib/moddulo/__tests__/fixtures/siembraF3";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const UID = "uidAprobadorM3";
const P = "moddulo_projects/p1";
const RES = `${P}/f3Resultados/r1`;

const DOC_RES = {
  moduloPIP: "¿Pregunta?",
  origen: { sourceKind: "T10", componente: "centinela", analisisId: "r1", fechaEntrega: "2026-01-01T00:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: "moddulo/otroDueno/p1/f3/r1/f.json", extractoTexto: "texto del resultado" },
  createdAt: "TS-ANTERIOR",
};
const TABLERO = [
  { pipItemId: "t1", asignaciones: [{ asignacionId: "a1", tipo: "primaria", canal: "canal1", tecnicaId: "T10", justificacion: "j", estado: "en_curso", activada: true }] },
];
const PROYECTO = {
  phases: {
    exploracion: { dvs: { pip: [{ pipItemId: "t1", numero: 1, pregunta: "¿Pregunta?" }], semaforo: [] } },
    investigacion: { f3TareasPIP: TABLERO },
  },
};
const body = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", {
    method: "POST",
    body: JSON.stringify({ projectId: "p1", resultadoId: "r1", pipItemId: "t1", asignacionId: "a1", aprobado: true, ...o }),
  }) as never;
const reqSintesis = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;

function sembrar(resultado: Record<string, unknown>) {
  db.reset({ [P]: structuredClone(PROYECTO), [RES]: resultado });
  db.rechazarUndefined(true);
  db.atomico(true);
  vi.mocked(getProject).mockResolvedValue({
    phases: {
      exploracion: PROYECTO.phases.exploracion,
      investigacion: { f3TareasPIP: TABLERO.map((t) => normalizeTareaPIP(t as never)) },
    },
  } as never);
}

/** Corre sintesis/generar y devuelve el prompt de USUARIO completo que recibió el modelo. */
async function promptQueRecibeM3(): Promise<string> {
  crear.mockClear();
  crear.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(SIEMBRA_SINTESIS) }] } as never);
  const res = await SINTESIS(reqSintesis());
  expect(res.status).toBe(200);
  expect(crear).toHaveBeenCalledTimes(1);
  return (crear.mock.calls[0][0] as { messages: Array<{ content: string }> }).messages[0].content;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: UID } as never);
});

describe("M3 recibe la misma serialización antes y después de C3a-2", () => {
  it("aprobar con la ruta REAL → el prompt completo de M3 es idéntico al que recibiría con el documento que escribía la ruta anterior", async () => {
    // DESPUÉS: la ruta nueva (con historial) escribe el resultado
    sembrar(DOC_RES);
    expect((await APROBAR(body({ notasUsuario: "buena" }))).status).toBe(200);
    const despues = await promptQueRecibeM3();

    // ANTES: la ruta anterior escribía exactamente `update(resultado, {aprobado, notasUsuario})` (caracterizado)
    sembrar({ ...DOC_RES, aprobado: true, notasUsuario: "buena" });
    const antes = await promptQueRecibeM3();

    expect(despues).toBe(antes);
    // y el documento aprobado SÍ viaja al modelo, sin sello ni uid ni huella
    expect(despues).toContain("texto del resultado");
    expect(despues).toContain('"aprobado": true');
    expect(despues).not.toContain(UID);
    expect(despues).not.toContain("huella");
    expect(despues).not.toContain("aprobacion");
  });

  it("retirar la aprobación y volver a aprobar tampoco cambia lo que ve M3", async () => {
    sembrar(DOC_RES);
    await APROBAR(body({ notasUsuario: "n" }));
    // el mock no expande claves con puntos: se re-siembra el puntero entre peticiones
    const { consolidarSemilla } = await import("@/lib/moddulo/__tests__/fixtures/siembraHistorialF3");
    consolidarSemilla(db, P);
    await APROBAR(body({ aprobado: false }));
    consolidarSemilla(db, P);
    await APROBAR(body({ notasUsuario: "n" }));
    const despues = await promptQueRecibeM3();

    sembrar({ ...DOC_RES, aprobado: true, notasUsuario: "n" });
    expect(despues).toBe(await promptQueRecibeM3());
  });
});
