// scripts/check-docs-freshness.test.ts
// Regresión del detector de frescura CLAUDE.md ↔ código (gap B). Mockea
// el boundary de I/O real (scripts/lib/freshnessGit.ts) — mismo criterio
// que gap A (lib/moddulo/__tests__/fixtures/adminMocks.ts): probar la
// ORQUESTACIÓN (resolución de ancla, comparación de fechas, manejo de
// error) sin depender del estado real del repo ni correr git de verdad.

import { describe, expect, it } from "vitest";
import {
  checkEntry,
  validateManifest,
  ManifestValidationError,
  type GitDeps,
  type ManifestEntry,
} from "./check-docs-freshness";

const REF = "HEAD";
const DAY = 86400;

function fakeDeps(overrides: Partial<GitDeps> = {}): GitDeps {
  return {
    showFile: () => "línea 1\n| E6 | algo | ⏳ Pendiente |\nlínea 3",
    lineTimestamp: () => 1000,
    pathTimestamp: () => 1000,
    ...overrides,
  };
}

const baseEntry: ManifestEntry = {
  id: "pestel-e6",
  anchor: "| E6",
  description: "Estado de fases PESTEL — E6",
  paths: ["app/centinela/pestel/foo"],
};

describe("checkEntry", () => {
  it("caso feliz: código más viejo que la documentación → fresh, sin desfase reportado", () => {
    const deps = fakeDeps({ lineTimestamp: () => 2000, pathTimestamp: () => 1000 });
    const result = checkEntry(baseEntry, REF, deps);
    expect(result.status).toBe("fresh");
  });

  it("desfase real: código más nuevo que la documentación → stale, con los días de brecha correctos", () => {
    const docTs = 1_700_000_000;
    const codeTs = docTs + 10 * DAY;
    const deps = fakeDeps({ lineTimestamp: () => docTs, pathTimestamp: () => codeTs });
    const result = checkEntry(baseEntry, REF, deps);
    expect(result.status).toBe("stale");
    if (result.status === "stale") {
      expect(result.gapDays).toBe(10);
      expect(result.codePath).toBe("app/centinela/pestel/foo");
      expect(result.docDate).toBe(docTs);
      expect(result.codeDate).toBe(codeTs);
    }
  });

  it("ancla con 0 coincidencias → anchor-error, mensaje claro (no crash críptico)", () => {
    const deps = fakeDeps({ showFile: () => "contenido sin el ancla buscada" });
    const result = checkEntry(baseEntry, REF, deps);
    expect(result.status).toBe("anchor-error");
    if (result.status === "anchor-error") {
      expect(result.error).toMatch(/no encontrada/);
    }
  });

  it("ancla con más de 1 coincidencia → anchor-error, mensaje claro señalando ambigüedad", () => {
    const deps = fakeDeps({ showFile: () => "| E6 | uno |\notra línea\n| E6 | dos |" });
    const result = checkEntry(baseEntry, REF, deps);
    expect(result.status).toBe("anchor-error");
    if (result.status === "anchor-error") {
      expect(result.error).toMatch(/ambigua/);
    }
  });

  it("ninguna ruta tiene commits todavía → no-code, no se reporta como desfase", () => {
    const deps = fakeDeps({ pathTimestamp: () => null });
    const result = checkEntry(baseEntry, REF, deps);
    expect(result.status).toBe("no-code");
  });

  it("toma la ruta MÁS reciente cuando la entrada tiene varias rutas", () => {
    const docTs = 1_700_000_000;
    const entry: ManifestEntry = { ...baseEntry, paths: ["a", "b", "c"] };
    const timestamps: Record<string, number> = { a: docTs - DAY, b: docTs + 5 * DAY, c: docTs + 2 * DAY };
    const deps = fakeDeps({
      lineTimestamp: () => docTs,
      pathTimestamp: (_ref: string, p: string) => timestamps[p],
    });
    const result = checkEntry(entry, REF, deps);
    expect(result.status).toBe("stale");
    if (result.status === "stale") {
      expect(result.codePath).toBe("b");
      expect(result.gapDays).toBe(5);
    }
  });
});

describe("validateManifest", () => {
  const validEntry = {
    id: "x",
    anchor: "| X",
    description: "algo",
    paths: ["a/b"],
  };

  it("acepta un manifiesto bien formado", () => {
    expect(() => validateManifest({ entries: [validEntry] })).not.toThrow();
  });

  it("rechaza un manifiesto que no es un objeto", () => {
    expect(() => validateManifest("no soy un objeto")).toThrow(ManifestValidationError);
    expect(() => validateManifest(null)).toThrow(ManifestValidationError);
    expect(() => validateManifest([validEntry])).toThrow(ManifestValidationError);
  });

  it("rechaza un manifiesto sin \"entries\" o con \"entries\" que no es array", () => {
    expect(() => validateManifest({})).toThrow(ManifestValidationError);
    expect(() => validateManifest({ entries: "no soy array" })).toThrow(ManifestValidationError);
  });

  it("rechaza entries vacío", () => {
    expect(() => validateManifest({ entries: [] })).toThrow(ManifestValidationError);
  });

  it("rechaza una entrada sin anchor, señalando el id y el campo en el mensaje", () => {
    const bad = { id: "mi-entrada", anchor: "", description: "d", paths: ["a"] };
    try {
      validateManifest({ entries: [bad] });
      throw new Error("no debió pasar");
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestValidationError);
      expect((err as Error).message).toMatch(/mi-entrada/);
      expect((err as Error).message).toMatch(/anchor/);
    }
  });

  it("rechaza una entrada con paths vacío", () => {
    const bad = { id: "x", anchor: "| X", description: "d", paths: [] };
    expect(() => validateManifest({ entries: [bad] })).toThrow(ManifestValidationError);
  });

  it("rechaza una entrada con paths que no es array", () => {
    const bad = { id: "x", anchor: "| X", description: "d", paths: "no soy array" };
    expect(() => validateManifest({ entries: [bad] })).toThrow(ManifestValidationError);
  });

  it("rechaza una entrada con un elemento de paths vacío", () => {
    const bad = { id: "x", anchor: "| X", description: "d", paths: ["a", ""] };
    expect(() => validateManifest({ entries: [bad] })).toThrow(ManifestValidationError);
  });

  it("rechaza una entrada sin id", () => {
    const bad = { anchor: "| X", description: "d", paths: ["a"] };
    expect(() => validateManifest({ entries: [bad] })).toThrow(ManifestValidationError);
  });

  it("rechaza una entrada sin description", () => {
    const bad = { id: "x", anchor: "| X", paths: ["a"] };
    expect(() => validateManifest({ entries: [bad] })).toThrow(ManifestValidationError);
  });
});
