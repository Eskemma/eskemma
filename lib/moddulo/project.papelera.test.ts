// lib/moddulo/project.papelera.test.ts
// Fase (a) de la papelera de proyectos (26-09-28): un proyecto con `deletedAt`
// seteado debe ser invisible en getProject / getProjectParaPrellenado /
// listUserProjects — SIN excepción, ni para su propio dueño — y visible SOLO a
// través de getProjectPapelera / listProyectosPapelera, siempre acotado al
// colaborador que pide (nunca a un tercero).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { adminDb } from "@/lib/firebase-admin";
import {
  getProject,
  getProjectParaPrellenado,
  getProjectPapelera,
  listUserProjects,
  listProyectosPapelera,
  deleteProject,
  restoreProjectFromPapelera,
} from "./project";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;

const OWNER = "uidOwner";
const COLLAB = "uidColaborador";
const OTHER = "uidAjeno";

function proyectoBase(overrides: Record<string, unknown> = {}) {
  return {
    userId: OWNER,
    name: "Proyecto de prueba",
    type: "electoral",
    collaborators: [
      { uid: OWNER, role: "owner" },
      { uid: COLLAB, role: "analyst" },
    ],
    ...overrides,
  };
}

describe("papelera — getProject nunca ve un proyecto en papelera", () => {
  beforeEach(() => mockAdminDb.reset());

  it("un proyecto con deletedAt es invisible para el dueño y para un colaborador", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": proyectoBase({ deletedAt: "TS", deletedBy: OWNER }),
    });
    expect(await getProject("p1", OWNER)).toBeNull();
    expect(await getProject("p1", COLLAB)).toBeNull();
  });

  it("sin deletedAt, getProject sigue funcionando normal (regresión)", async () => {
    mockAdminDb.reset({ "moddulo_projects/p1": proyectoBase() });
    const p = await getProject("p1", OWNER);
    expect(p?.name).toBe("Proyecto de prueba");
  });

  it("getProject en papelera no escribe lastAccessedAt (nunca se 'toca' un proyecto borrado)", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": proyectoBase({ deletedAt: "TS" }),
    });
    await getProject("p1", OWNER);
    expect(
      (mockAdminDb.snapshot()["moddulo_projects/p1"] as Record<string, unknown>).lastAccessedAt
    ).toBeUndefined();
  });
});

describe("papelera — getProjectParaPrellenado nunca ve un proyecto en papelera", () => {
  beforeEach(() => mockAdminDb.reset());

  it("con deletedAt devuelve null aunque el usuario sea colaborador", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": proyectoBase({ deletedAt: "TS" }),
    });
    expect(await getProjectParaPrellenado("p1", OWNER)).toBeNull();
  });
});

describe("papelera — listUserProjects excluye los proyectos en papelera", () => {
  beforeEach(() => mockAdminDb.reset());

  it("un proyecto con deletedAt no aparece en el listado general del dueño", async () => {
    mockAdminDb.reset({
      "moddulo_projects/activo": { userId: OWNER, name: "Activo", updatedAt: "2" },
      "moddulo_projects/borrado": { userId: OWNER, name: "En papelera", deletedAt: "TS", updatedAt: "1" },
    });
    const lista = await listUserProjects(OWNER);
    expect(lista.map((p) => p.id)).toEqual(["activo"]);
  });

  it("el límite se aplica DESPUÉS del filtro de deletedAt — un proyecto en papelera entre los N más recientes no le quita el lugar a uno activo (hallazgo real, 26-09-28)", async () => {
    mockAdminDb.reset({
      "moddulo_projects/masReciente": { userId: OWNER, name: "En papelera, el más reciente", deletedAt: "TS", updatedAt: "3" },
      "moddulo_projects/activo1": { userId: OWNER, name: "Activo 1", updatedAt: "2" },
      "moddulo_projects/activo2": { userId: OWNER, name: "Activo 2", updatedAt: "1" },
    });
    // limit:1 con la query de Firestore aplicada ANTES del filtro habría devuelto
    // SOLO "masReciente" (el más reciente por updatedAt) → tras filtrar deletedAt,
    // 0 resultados, aunque hay 2 proyectos activos reales.
    const lista = await listUserProjects(OWNER, { limit: 1 });
    expect(lista.map((p) => p.id)).toEqual(["activo1"]);
  });
});

describe("papelera — getProjectPapelera / listProyectosPapelera: SOLO ven lo que está en papelera, SOLO para el dueño/colaborador", () => {
  beforeEach(() => mockAdminDb.reset());

  it("getProjectPapelera devuelve el proyecto si tiene deletedAt y el uid es colaborador", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": proyectoBase({ deletedAt: "TS", deletedBy: OWNER }),
    });
    const p = await getProjectPapelera("p1", OWNER);
    expect(p?.name).toBe("Proyecto de prueba");
    const p2 = await getProjectPapelera("p1", COLLAB);
    expect(p2?.name).toBe("Proyecto de prueba");
  });

  it("getProjectPapelera devuelve null si el proyecto NO está en papelera (evita reusarla donde iría getProject)", async () => {
    mockAdminDb.reset({ "moddulo_projects/p1": proyectoBase() });
    expect(await getProjectPapelera("p1", OWNER)).toBeNull();
  });

  it("getProjectPapelera devuelve null para un usuario ajeno (no colaborador), aunque el proyecto esté en papelera", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": proyectoBase({ deletedAt: "TS" }),
    });
    expect(await getProjectPapelera("p1", OTHER)).toBeNull();
  });

  it("listProyectosPapelera solo lista los del dueño con deletedAt seteado", async () => {
    mockAdminDb.reset({
      "moddulo_projects/activo": { userId: OWNER, name: "Activo" },
      "moddulo_projects/borrado": { userId: OWNER, name: "En papelera", deletedAt: "TS" },
      "moddulo_projects/otroUsuario": { userId: OTHER, name: "Ajeno en papelera", deletedAt: "TS" },
    });
    const lista = await listProyectosPapelera(OWNER);
    expect(lista.map((p) => p.id)).toEqual(["borrado"]);
  });
});

describe("papelera — deleteProject: soft-delete, owner-only, no toca vínculos", () => {
  beforeEach(() => mockAdminDb.reset());

  it("marca deletedAt/deletedBy sin borrar el documento", async () => {
    mockAdminDb.reset({ "moddulo_projects/p1": proyectoBase() });
    await deleteProject("p1", OWNER);
    const doc = mockAdminDb.snapshot()["moddulo_projects/p1"] as Record<string, unknown>;
    expect(doc.deletedAt).toBe("SERVER_TIMESTAMP");
    expect(doc.deletedBy).toBe(OWNER);
    expect(doc.name).toBe("Proyecto de prueba"); // el resto del doc queda intacto
  });

  it("un colaborador no-owner NO puede eliminar (regresión)", async () => {
    mockAdminDb.reset({ "moddulo_projects/p1": proyectoBase() });
    await expect(deleteProject("p1", COLLAB)).rejects.toThrow("Solo el dueño");
    expect((mockAdminDb.snapshot()["moddulo_projects/p1"] as Record<string, unknown>).deletedAt).toBeUndefined();
  });

  it("NO limpia el back-link de PESTEL (eso es responsabilidad exclusiva de la purga, fase c)", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": proyectoBase({
        phases: { exploracion: { linkedSource: { kind: "T22", sourceId: "pest1" } } },
      }),
      "pestel_projects/pest1": { userId: OWNER, modduloProjectId: "p1" },
    });
    await deleteProject("p1", OWNER);
    expect(mockAdminDb.snapshot()["pestel_projects/pest1"]).toMatchObject({ modduloProjectId: "p1" });
  });
});

describe("papelera — restoreProjectFromPapelera: owner explícito, 404 idéntico para ajeno/inexistente/no-en-papelera", () => {
  beforeEach(() => mockAdminDb.reset());

  it("el dueño restaura un proyecto en papelera (limpia deletedAt/deletedBy)", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": proyectoBase({ deletedAt: "TS", deletedBy: OWNER }),
    });
    await restoreProjectFromPapelera("p1", OWNER);
    const doc = mockAdminDb.snapshot()["moddulo_projects/p1"] as Record<string, unknown>;
    expect(doc.deletedAt).toBe("FIELD_DELETE");
    expect(doc.deletedBy).toBe("FIELD_DELETE");
  });

  it("un colaborador no-owner (real, no ajeno) NO puede restaurar — chequeo explícito y separado de getProjectPapelera", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": proyectoBase({ deletedAt: "TS" }),
    });
    // getProjectPapelera SÍ deja ver el proyecto a COLLAB (es colaborador) —
    // pero restoreProjectFromPapelera exige además collaborator.role === "owner".
    expect(await getProjectPapelera("p1", COLLAB)).not.toBeNull();
    await expect(restoreProjectFromPapelera("p1", COLLAB)).rejects.toThrow("Solo el dueño");
  });

  it("proyecto ajeno (no colaborador) → mismo mensaje que 'no está en papelera'", async () => {
    mockAdminDb.reset({ "moddulo_projects/p1": proyectoBase({ deletedAt: "TS" }) });
    await expect(restoreProjectFromPapelera("p1", OTHER)).rejects.toThrow("no está en la papelera");
  });

  it("proyecto inexistente → mismo mensaje", async () => {
    await expect(restoreProjectFromPapelera("noExiste", OWNER)).rejects.toThrow("no está en la papelera");
  });

  it("proyecto activo (no en papelera) → mismo mensaje, aunque el usuario sea dueño", async () => {
    mockAdminDb.reset({ "moddulo_projects/p1": proyectoBase() });
    await expect(restoreProjectFromPapelera("p1", OWNER)).rejects.toThrow("no está en la papelera");
  });
});
