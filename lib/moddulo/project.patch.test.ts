// lib/moddulo/project.patch.test.ts
// H-M5 (26-10-07): updateProject / updatePhaseData / marcarFaseIniciada / savePhaseReportDraft.
// Garantía PROBADA: con un cuerpo rechazado, Firestore NUNCA recibe una escritura del usuario
// (solo la de `lastAccessedAt` que hace getProject al leer). La semántica de las rutas con punto
// de update() se toma de la documentación de Firestore y del uso existente del chat
// (chat/[phaseId]/route.ts); NO se verificó contra el emulador (Java 17 < 21 requerido).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { adminDb } from "@/lib/firebase-admin";
import { marcarFaseIniciada, savePhaseReportDraft, updatePhaseData, updateProject } from "./project";
import { ProyectoNoEncontradoError, SinPermisosError } from "./projectErrors";
import { PatchInvalidoError } from "./projectPatch";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { UpdateProjectInput } from "@/types/moddulo.types";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;

const OWNER = "uidOwner";
const ANALISTA = "uidAnalista";
const CLIENTE = "uidCliente";
const AJENO = "uidAjeno";

function proyecto(over: Record<string, unknown> = {}) {
  return {
    userId: OWNER,
    name: "Proyecto",
    type: "electoral",
    status: "active",
    collaborators: [
      { uid: OWNER, role: "owner" },
      { uid: ANALISTA, role: "analyst" },
      { uid: CLIENTE, role: "client" },
    ],
    phases: {},
    ...over,
  };
}

/** Escrituras "del usuario": todo update() salvo el `lastAccessedAt` que hace getProject al leer. */
function escrituras() {
  return db
    .updates()
    .filter((u) => !(Object.keys(u.data).length === 1 && "lastAccessedAt" in u.data));
}

beforeEach(() => db.reset({ "moddulo_projects/p1": proyecto() }));

const XPCTO: UpdateProjectInput["xpcto"] = {
  hito: "H",
  sujeto: "S",
  capacidades: { financiero: "F", humano: "Hu", logistico: "L" },
  tiempo: { fechaLimite: "2027-06-06", duracionMeses: 15 },
  justificacion: "J",
};

describe("updateProject", () => {
  it("metadatos válidos: una sola escritura con exactamente esos campos + updatedAt", async () => {
    await updateProject("p1", OWNER, { name: "Nuevo", description: "d", color: "#248CC1" });
    expect(escrituras()).toEqual([
      { path: "moddulo_projects/p1", data: { name: "Nuevo", description: "d", color: "#248CC1", updatedAt: "SERVER_TIMESTAMP" } },
    ]);
  });

  it("xpcto se escribe por hoja (rutas con punto), nunca el mapa completo", async () => {
    await updateProject("p1", OWNER, { xpcto: XPCTO as never });
    const [w] = escrituras();
    expect(Object.keys(w.data).sort()).toEqual(
      [
        "updatedAt",
        "xpcto.capacidades.financiero",
        "xpcto.capacidades.humano",
        "xpcto.capacidades.logistico",
        "xpcto.hito",
        "xpcto.justificacion",
        "xpcto.sujeto",
        "xpcto.tiempo.duracionMeses",
        "xpcto.tiempo.fechaLimite",
      ].sort()
    );
    expect("xpcto" in w.data).toBe(false);
  });

  it("territorio se reemplaza como mapa validado", async () => {
    const t = { nivel: "estatal", nombre: "Jalisco", pais: "México", estado: "Jalisco" };
    await updateProject("p1", OWNER, { territorio: t as never });
    expect(escrituras()[0].data.territorio).toEqual(t);
  });

  const ataques: Record<string, unknown>[] = [
    { collaborators: [{ uid: AJENO, role: "owner" }] },
    { userId: AJENO },
    { deletedAt: "x" },
    { phases: {} },
    { "phases.exploracion.dvs": { pip: [] } },
    { "phases.exploracion.motorAprobaciones.M2": true },
    { currentPhase: "evaluacion" },
    { rda: {} },
    { settings: { aiLevel: "x" } },
    { name: "Legítimo", collaborators: [] },
  ];
  it.each(ataques.map((a) => [Object.keys(a).join(","), a] as const))(
    "ataque `%s`: falla cerrado y Firestore NO recibe escritura alguna",
    async (_n, cuerpo) => {
      await expect(updateProject("p1", OWNER, cuerpo as never)).rejects.toBeInstanceOf(PatchInvalidoError);
      expect(escrituras()).toEqual([]);
    }
  );

  it("analyst y client no editan (403) y no se escribe nada, aun con un cuerpo válido", async () => {
    for (const uid of [ANALISTA, CLIENTE]) {
      await expect(updateProject("p1", uid, { name: "x" })).rejects.toBeInstanceOf(SinPermisosError);
    }
    expect(escrituras()).toEqual([]);
  });

  it("ajeno o inexistente: 404 indistinguible", async () => {
    await expect(updateProject("p1", AJENO, { name: "x" })).rejects.toBeInstanceOf(ProyectoNoEncontradoError);
    await expect(updateProject("nope", OWNER, { name: "x" })).rejects.toBeInstanceOf(ProyectoNoEncontradoError);
    expect(escrituras()).toEqual([]);
  });
});

describe("updatePhaseData — fusión por clave (el cierre de F2 ya no pisa el formulario)", () => {
  beforeEach(() => {
    db.reset({
      "moddulo_projects/p1": proyecto({
        phases: {
          exploracion: {
            status: "in-progress",
            data: { pestl: { politico: { contexto: "IMPORTANTE" } }, semaforo: { actores: [], resumen: "r" }, hipotesis: { enunciado: "h" } },
          },
        },
      }),
    });
  });

  it("enviar {aprobadoEn} escribe SOLO esa clave: nunca el mapa data completo", async () => {
    await updatePhaseData("p1", OWNER, "exploracion", { aprobadoEn: "2026-10-07T00:00:00.000Z" });
    const [w] = escrituras();
    expect(w.data["phases.exploracion.data.aprobadoEn"]).toBe("2026-10-07T00:00:00.000Z");
    expect("phases.exploracion.data" in w.data).toBe(false);
    // ninguna ruta toca pestl/semaforo/hipotesis → Firestore las conserva
    expect(Object.keys(w.data).filter((k) => /data\.(pestl|semaforo|hipotesis)/.test(k))).toEqual([]);
  });

  it("el autoguardado del formulario completo escribe cada clave de primer nivel", async () => {
    const form = { pestl: { politico: { contexto: "nuevo" } }, semaforo: { actores: [], resumen: "" }, hipotesis: { enunciado: "" } };
    await updatePhaseData("p1", OWNER, "exploracion", form);
    const claves = Object.keys(escrituras()[0].data).filter((k) => k.startsWith("phases.exploracion.data."));
    expect(claves.sort()).toEqual(["phases.exploracion.data.hipotesis", "phases.exploracion.data.pestl", "phases.exploracion.data.semaforo"]);
  });

  it("data vacío no borra nada", async () => {
    await updatePhaseData("p1", OWNER, "exploracion", {});
    expect(Object.keys(escrituras()[0].data).filter((k) => k.includes(".data"))).toEqual([]);
  });

  it("no degrada una fase completed (protección del bug 26-07-19 intacta)", async () => {
    db.reset({ "moddulo_projects/p1": proyecto({ phases: { exploracion: { status: "completed", data: {} } } }) });
    await updatePhaseData("p1", OWNER, "exploracion", { aprobadoEn: "x" });
    expect(escrituras()[0].data["phases.exploracion.status"]).toBe("completed");
  });

  it("phaseId inyectado → falla cerrado, sin escritura", async () => {
    for (const id of ["exploracion.dvs", "x", "__proto__", "proposito.data"]) {
      await expect(updatePhaseData("p1", OWNER, id as never, { notas: "x" })).rejects.toBeInstanceOf(PatchInvalidoError);
    }
    expect(escrituras()).toEqual([]);
  });

  it("claves de exploracion fuera de la lista y claves con punto → falla cerrado", async () => {
    await expect(updatePhaseData("p1", OWNER, "exploracion", { dvs: {} })).rejects.toBeInstanceOf(PatchInvalidoError);
    await expect(updatePhaseData("p1", OWNER, "exploracion", { "pestl.politico": {} })).rejects.toBeInstanceOf(PatchInvalidoError);
    expect(escrituras()).toEqual([]);
  });

  it("analyst/client → 403 sin escritura", async () => {
    await expect(updatePhaseData("p1", CLIENTE, "exploracion", { aprobadoEn: "x" })).rejects.toBeInstanceOf(SinPermisosError);
    expect(escrituras()).toEqual([]);
  });
});

describe("marcarFaseIniciada", () => {
  it("not-started → started + in-progress, y draft → active", async () => {
    db.reset({ "moddulo_projects/p1": proyecto({ status: "draft", phases: { proposito: { status: "not-started" } } }) });
    await marcarFaseIniciada("p1", OWNER, "proposito");
    const d = escrituras()[0].data;
    expect(d["phases.proposito.started"]).toBe(true);
    expect(d["phases.proposito.status"]).toBe("in-progress");
    expect(d.status).toBe("active");
  });

  it("fase sin registro previo → se inicia", async () => {
    await marcarFaseIniciada("p1", OWNER, "investigacion");
    expect(escrituras()[0].data["phases.investigacion.status"]).toBe("in-progress");
  });

  it("NUNCA revierte una fase completed ni in-progress (antes la rama started lo hacía)", async () => {
    for (const status of ["completed", "in-progress"]) {
      db.reset({ "moddulo_projects/p1": proyecto({ phases: { exploracion: { status } } }) });
      await marcarFaseIniciada("p1", OWNER, "exploracion");
      const d = escrituras()[0].data;
      expect("phases.exploracion.status" in d).toBe(false);
      // la marca `started` sí se escribe (idempotente): la pantalla de bienvenida se oculta
      expect(d["phases.exploracion.started"]).toBe(true);
    }
  });

  it("analyst y client no pueden marcar una fase como iniciada", async () => {
    for (const uid of [ANALISTA, CLIENTE]) {
      await expect(marcarFaseIniciada("p1", uid, "proposito")).rejects.toBeInstanceOf(SinPermisosError);
    }
    expect(escrituras()).toEqual([]);
  });

  it("phaseId inválido → falla cerrado", async () => {
    await expect(marcarFaseIniciada("p1", OWNER, "proposito.started" as never)).rejects.toBeInstanceOf(PatchInvalidoError);
    expect(escrituras()).toEqual([]);
  });
});

describe("savePhaseReportDraft", () => {
  it("válido", async () => {
    await savePhaseReportDraft("p1", OWNER, "proposito", "# Borrador");
    expect(escrituras()[0].data["phases.proposito.reportText"]).toBe("# Borrador");
  });
  it("phaseId inyectado y texto no string → falla cerrado", async () => {
    await expect(savePhaseReportDraft("p1", OWNER, "proposito.reportText" as never, "x")).rejects.toBeInstanceOf(PatchInvalidoError);
    await expect(savePhaseReportDraft("p1", OWNER, "proposito", { a: 1 } as never)).rejects.toBeInstanceOf(PatchInvalidoError);
    expect(escrituras()).toEqual([]);
  });
  it("client → 403", async () => {
    await expect(savePhaseReportDraft("p1", CLIENTE, "proposito", "x")).rejects.toBeInstanceOf(SinPermisosError);
  });
});
