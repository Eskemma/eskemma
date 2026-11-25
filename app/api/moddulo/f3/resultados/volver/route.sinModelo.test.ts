// C4b-1b — «volver» NO llama a ningún modelo (toda llamada a un modelo la autoriza el usuario y gasta crédito).
// Por DATOS (contadores de los SDK de IA = 0 tras pedir, confirmar y fallar) y ESTÁTICA (los archivos nuevos no importan
// ningún cliente de IA ni usan `fetch`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const modelo = vi.hoisted(() => ({ llamadas: 0 }));
vi.mock("@anthropic-ai/sdk", () => {
  const Anthropic = vi.fn(() => {
    modelo.llamadas++;
    throw new Error("«volver» no debe crear un cliente de IA");
  });
  return { default: Anthropic, Anthropic };
});
vi.mock("@/lib/ai/claude", () => {
  const tocar = () => {
    modelo.llamadas++;
    throw new Error("«volver» no debe llamar a un modelo");
  };
  return { anthropic: { messages: { create: tocar, stream: tocar } }, CLAUDE_MODEL: "x" };
});
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage([]) };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const orig = await importOriginal<typeof import("firebase-admin/firestore")>();
  return { ...orig, FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => orig.Timestamp.fromDate(new Date(Date.UTC(2026, 10, 25, 9, 0, 0))) } };
});

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { PID, RESULTADO, RID, V1, sembrarVolver } from "@/lib/moddulo/__tests__/fixtures/siembraVolver";
import { POST } from "./route";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const RAIZ = join(__dirname, "..", "..", "..", "..", "..", "..");
const pedir = (b: unknown) => POST(new Request("http://local/x", { method: "POST", body: JSON.stringify(b) }) as never);

beforeEach(() => {
  modelo.llamadas = 0;
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sin modelo (por datos)", () => {
  it("pregunta, confirmación, errores y bloqueo: 0 llamadas a @anthropic-ai/sdk y a lib/ai/claude", async () => {
    await sembrarVolver(db);
    const base = { projectId: PID, resultadoId: RID, versionId: V1 };
    const p = await (await pedir(base)).json();
    expect((await pedir({ ...base, confirmarReemplazo: true, huella: p.huella })).status).toBe(200);
    expect((await pedir({ ...base, versionId: "nope" })).status).toBe(404);
    expect((await pedir("{{")).status).toBe(400);
    await sembrarVolver(db, { inv: { f3DIE: { x: 1 } } });
    expect((await pedir(base)).status).toBe(409);
    expect(modelo.llamadas).toBe(0);
  });
  it("no toca contenido que el modelo consumiría (síntesis, veredicto) ni crea nada fuera del historial y el resultado", async () => {
    await sembrarVolver(db, { inv: { f3Sintesis: { marca: "no tocar" }, f3Veredicto: { aprobadoPorUsuario: false, marca: "no tocar" } } });
    const antes = JSON.stringify(((db.snapshot()[`moddulo_projects/${PID}`] as Record<string, unknown>).phases as Record<string, unknown>));
    const base = { projectId: PID, resultadoId: RID, versionId: V1 };
    const p = await (await pedir(base)).json();
    await pedir({ ...base, confirmarReemplazo: true, huella: p.huella });
    const inv = (((db.snapshot()[`moddulo_projects/${PID}`] as Record<string, unknown>).phases as Record<string, unknown>).investigacion as Record<string, unknown>);
    expect(inv.f3Sintesis).toEqual({ marca: "no tocar" });
    expect(inv.f3Veredicto).toEqual({ aprobadoPorUsuario: false, marca: "no tocar" });
    expect(antes).toContain("no tocar");
    expect((db.snapshot()[RESULTADO] as Record<string, unknown>).aprobado).toBe(false);
  });
});

describe("sin modelo (estática)", () => {
  const archivos = [
    "app/api/moddulo/f3/resultados/volver/route.ts",
    "lib/moddulo/versionado/restaurar.ts",
    "lib/moddulo/versionado/restaurarF3.ts",
  ];
  it.each(archivos)("%s no importa ningún cliente de IA ni usa fetch", (rel) => {
    const src = readFileSync(join(RAIZ, rel), "utf8");
    expect(src).not.toMatch(/@anthropic-ai\/sdk|lib\/ai\/claude|from "openai"|\bfetch\(/);
  });
});
