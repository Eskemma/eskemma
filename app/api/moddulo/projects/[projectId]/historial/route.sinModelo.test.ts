// C4a-1 — el lector y la ruta del historial NO llaman a ningún modelo (toda llamada a un modelo la autoriza el usuario).
// Prueba por DATOS (contadores de los SDK de IA = 0 tras leer; el proyecto, `chatHistory`, `dvs`, `draftDVS` y
// `m1.generacion` quedan byte-idénticos) y prueba ESTÁTICA (los archivos nuevos no importan ningún cliente de IA ni usan `fetch`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const modelo = vi.hoisted(() => ({ llamadas: 0 }));
vi.mock("@anthropic-ai/sdk", () => {
  const Anthropic = vi.fn(() => {
    modelo.llamadas++;
    throw new Error("el historial no debe crear un cliente de IA");
  });
  return { default: Anthropic, Anthropic };
});
vi.mock("@/lib/ai/claude", () => {
  const tocar = () => {
    modelo.llamadas++;
    throw new Error("el historial no debe llamar a un modelo");
  };
  return { anthropic: { messages: { create: tocar, stream: tocar } }, CLAUDE_MODEL: "x" };
});
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
const RAIZ = join(__dirname, "..", "..", "..", "..", "..", "..");

describe("sin modelo (por datos)", () => {
  it("leer cada fase no llama a un modelo y no toca el contenido del proyecto", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: "owner" }));
    const proyecto = {
      name: "Proyecto",
      collaborators: [{ uid: "owner", role: "owner", displayName: "Raúl" }],
      phases: {
        proposito: { chatHistory: [{ role: "user", content: "hola" }], reportText: "R", revision: { n: 1, huella: "h", por: "owner", en: Timestamp.fromDate(new Date("2026-11-10T10:00:00.000Z")) } },
        exploracion: { dvs: { final: 1 }, draftDVS: { borrador: 1 }, m1: { generacion: { huella: "g", en: "x" } } },
        investigacion: { f3Sintesis: { s: 1 } },
      },
    };
    db.reset({
      [P]: proyecto,
      [`${P}/revisiones/proposito_000001`]: { fase: "proposito", ambito: "moddulo", n: 1, artefactos: {} },
      [`${P}/eventos/e1`]: { tipo: "ajuste_manual", fase: "proposito", ambito: "moddulo", artefactos: [], revisionN: 1, versionIds: {}, por: "owner", motivo: "cierre_fase" },
    });
    const antes = JSON.stringify(db.snapshot()[P]);
    for (const fase of ["proposito", "exploracion", "investigacion"]) {
      const r = await GET(new Request(`http://local/x?fase=${fase}&deriva=1`) as never, { params: Promise.resolve({ projectId: "p1" }) });
      expect(r.status).toBe(200);
    }
    expect(modelo.llamadas).toBe(0);
    expect(JSON.stringify(db.snapshot()[P])).toBe(antes);
    expect(db.contadores().escrituras).toBe(0);
  });
});

describe("sin modelo (estática)", () => {
  const ARCHIVOS = [
    "lib/versionado/lectura.ts",
    "lib/moddulo/versionado/leerHistorial.ts",
    "lib/moddulo/versionado/derivaVivo.ts",
    "lib/moddulo/versionado/textosHistorial.ts",
    "lib/moddulo/versionado/visibilidadHistorial.ts",
    "app/api/moddulo/projects/[projectId]/historial/route.ts",
  ];
  it.each(ARCHIVOS)("%s no importa ningún cliente de IA ni usa `fetch`", (rel) => {
    const src = readFileSync(join(RAIZ, rel), "utf8").replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/@anthropic-ai|lib\/ai\/|from\s+["']openai|\bfetch\s*\(/);
  });
});
