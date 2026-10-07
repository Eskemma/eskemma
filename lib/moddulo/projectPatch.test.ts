// lib/moddulo/projectPatch.test.ts
// H-M5 (26-10-07): validación de lo que acepta PATCH /api/moddulo/projects/[projectId] y de las
// escrituras con ruta de campo que salen del chat. Se prueba con las formas REALES (los 32
// territorios congelados del fixture y los XPCTO de los proyectos guardados, incluido el
// `duracionMeses: null` de un proyecto real) y con cada campo que el agujero original permitía.

import { describe, expect, it } from "vitest";
import {
  CAMPOS_PROYECTO_PERMITIDOS,
  CLAVES_DATA_EXPLORACION,
  LIMITES,
  PatchInvalidoError,
  RUTAS_XPCTO,
  esRutaXpctoValida,
  filtrarExtraccionChat,
  filtrarRecuperacionXpcto,
  rutasValidasExploracion,
  validarPatchProyecto,
  validarPhaseData,
  validarReportDraft,
} from "./projectPatch";
import fixture from "./__tests__/fixtures/territorios32.json";

function falla(fn: () => unknown): PatchInvalidoError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(PatchInvalidoError);
    return e as PatchInvalidoError;
  }
  throw new Error("se esperaba PatchInvalidoError y no se lanzó nada");
}

const XPCTO_COMPLETO = {
  hito: "Ganar la gubernatura",
  sujeto: "Candidata del partido",
  capacidades: { financiero: "$5M", humano: "40 personas", logistico: "3 oficinas" },
  tiempo: { fechaLimite: "2027-06-06", duracionMeses: 15 },
  justificacion: "Transformar la política pública",
};

describe("validarPatchProyecto — lo legítimo pasa", () => {
  it("los 32 territorios reales del fixture", () => {
    const territorios = (fixture as { territorios: { id: string; territorio: unknown }[] }).territorios;
    expect(territorios).toHaveLength(32);
    for (const t of territorios) {
      const { update } = validarPatchProyecto({ territorio: t.territorio });
      expect(update.territorio).toBe(t.territorio);
    }
  });

  it("metadatos del hub (name, description, color, status)", () => {
    const { update } = validarPatchProyecto({ name: "Campaña 2027", description: "", color: "#E49F0C" });
    expect(update).toEqual({ name: "Campaña 2027", description: "", color: "#E49F0C" });
    expect(validarPatchProyecto({ status: "archived" }).update).toEqual({ status: "archived" });
  });

  it("colores reales guardados, en mayúsculas y minúsculas", () => {
    for (const c of ["#c6fb65", "#E49F0C", "#248cc1", "#CE4AF2", "#5a0713"]) {
      expect(validarPatchProyecto({ color: c }).update.color).toBe(c);
    }
  });

  it("xpcto completo se escribe por HOJA (rutas con punto), nunca como mapa completo", () => {
    const { update } = validarPatchProyecto({ xpcto: XPCTO_COMPLETO });
    expect(Object.keys(update).sort()).toEqual([...RUTAS_XPCTO].sort());
    expect(update["xpcto.tiempo.duracionMeses"]).toBe(15);
    expect("xpcto" in update).toBe(false);
  });

  it("duracionMeses null (caso real: proyecto ZMG; NaN viaja como null en JSON)", () => {
    const body = JSON.parse(JSON.stringify({ xpcto: { ...XPCTO_COMPLETO, tiempo: { fechaLimite: "", duracionMeses: NaN } } }));
    expect(body.xpcto.tiempo.duracionMeses).toBeNull();
    expect(validarPatchProyecto(body).update["xpcto.tiempo.duracionMeses"]).toBeNull();
  });

  it("duracionMeses negativo (fecha límite en el pasado) es legítimo", () => {
    expect(
      validarPatchProyecto({ xpcto: { tiempo: { duracionMeses: -3 } } }).update["xpcto.tiempo.duracionMeses"]
    ).toBe(-3);
  });

  it("un xpcto parcial solo escribe las hojas enviadas (no borra las demás)", () => {
    expect(validarPatchProyecto({ xpcto: { hito: "Nuevo" } }).update).toEqual({ "xpcto.hito": "Nuevo" });
  });

  it("topes con holgura sobre el máximo real (name 63, hoja 870, territorio 1,065)", () => {
    expect(() => validarPatchProyecto({ name: "x".repeat(LIMITES.name) })).not.toThrow();
    expect(() => validarPatchProyecto({ xpcto: { sujeto: "x".repeat(5_000) } })).not.toThrow();
    expect(LIMITES.name).toBeGreaterThan(63 * 2);
    expect(LIMITES.description).toBeGreaterThan(107 * 2);
    expect(LIMITES.textoXpcto).toBeGreaterThan(870 * 10);
    expect(LIMITES.territorioChars).toBeGreaterThan(1_065 * 10);
  });
});

describe("validarPatchProyecto — lo que el agujero original permitía ahora falla cerrado", () => {
  const prohibidos: [string, unknown][] = [
    ["collaborators", [{ uid: "atacante", role: "owner" }]],
    ["userId", "atacante"],
    ["deletedAt", "ahora"],
    ["deletedBy", "atacante"],
    ["phases", { exploracion: { dvs: {} } }],
    ["phases.exploracion.dvs", { pip: [] }],
    ["phases.exploracion.motorAprobaciones.M2", true],
    ["phases.investigacion.f3Resultados", []],
    ["currentPhase", "evaluacion"],
    ["fasesCompletadas", [1, 2, 3]],
    ["faseActual", 9],
    ["rda", {}],
    ["createdAt", "2020-01-01"],
    ["updatedAt", "2020-01-01"],
    ["lastAccessedAt", "2020-01-01"],
    ["type", "electoral"],
    ["id", "otro"],
    ["settings", { aiLevel: "x" }],
    ["xpcto.hito", "ruta con punto en la raíz"],
    ["territorio.nivel", "nacional"],
  ];

  it.each(prohibidos)("rechaza `%s`", (campo, valor) => {
    const e = falla(() => validarPatchProyecto({ [campo]: valor }));
    expect(e.motivo).toBe("campo_no_permitido");
    expect(e.campo).toBe(campo);
  });

  it("un campo prohibido mezclado con uno legítimo rechaza TODO el cuerpo", () => {
    const e = falla(() => validarPatchProyecto({ name: "Legítimo", collaborators: [] }));
    expect(e.campo).toBe("collaborators");
  });

  it("claves peligrosas creadas por JSON.parse (propiedad propia __proto__)", () => {
    const body = JSON.parse('{"__proto__": {"x": 1}}');
    expect(falla(() => validarPatchProyecto(body)).motivo).toBe("campo_no_permitido");
    expect(falla(() => validarPatchProyecto({ xpcto: JSON.parse('{"__proto__": "x"}') })).motivo).toBe("campo_no_permitido");
    expect(falla(() => validarPatchProyecto({ territorio: JSON.parse('{"nivel":"estatal","nombre":"X","__proto__":{}}') })).motivo).toBe("campo_no_permitido");
  });

  it("hojas de xpcto fuera de las 8 rutas", () => {
    expect(falla(() => validarPatchProyecto({ xpcto: { borrador: "x" } })).campo).toBe("xpcto.borrador");
    expect(falla(() => validarPatchProyecto({ xpcto: { tiempo: { fechaInicio: "x" } } })).campo).toBe("xpcto.tiempo.fechaInicio");
    expect(falla(() => validarPatchProyecto({ xpcto: { capacidades: { organizacional: "x" } } })).campo).toBe("xpcto.capacidades.organizacional");
    expect(falla(() => validarPatchProyecto({ xpcto: { "capacidades.financiero": "x" } })).motivo).toBe("campo_no_permitido");
  });

  it("cuerpos que no son objeto, vacíos o con xpcto vacío", () => {
    for (const c of [null, undefined, "x", 5, [], [{ name: "x" }]]) {
      expect(falla(() => validarPatchProyecto(c)).motivo).toBe("cuerpo_invalido");
    }
    expect(falla(() => validarPatchProyecto({})).motivo).toBe("cuerpo_invalido");
    expect(falla(() => validarPatchProyecto({ xpcto: {} })).motivo).toBe("valor_invalido");
  });

  it("tipos y valores inválidos", () => {
    expect(falla(() => validarPatchProyecto({ name: 5 })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPatchProyecto({ name: "   " })).motivo).toBe("valor_invalido");
    expect(falla(() => validarPatchProyecto({ name: "x".repeat(LIMITES.name + 1) })).motivo).toBe("demasiado_largo");
    expect(falla(() => validarPatchProyecto({ description: "x".repeat(LIMITES.description + 1) })).motivo).toBe("demasiado_largo");
    expect(falla(() => validarPatchProyecto({ color: "rojo" })).motivo).toBe("valor_invalido");
    expect(falla(() => validarPatchProyecto({ color: "#12345" })).motivo).toBe("valor_invalido");
    expect(falla(() => validarPatchProyecto({ color: 123456 })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPatchProyecto({ status: "deleted" })).motivo).toBe("valor_invalido");
    expect(falla(() => validarPatchProyecto({ xpcto: { hito: 5 } })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPatchProyecto({ xpcto: { hito: "x".repeat(LIMITES.textoXpcto + 1) } })).motivo).toBe("demasiado_largo");
    expect(falla(() => validarPatchProyecto({ xpcto: { tiempo: { duracionMeses: "15" } } })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPatchProyecto({ xpcto: { tiempo: { duracionMeses: 1e9 } } })).motivo).toBe("valor_invalido");
  });

  it("territorio: nivel inválido, sin nombre, no objeto o sobredimensionado", () => {
    expect(falla(() => validarPatchProyecto({ territorio: { nivel: "galaxia", nombre: "X" } })).campo).toBe("territorio.nivel");
    expect(falla(() => validarPatchProyecto({ territorio: { nivel: "estatal" } })).campo).toBe("territorio.nombre");
    expect(falla(() => validarPatchProyecto({ territorio: "Jalisco" })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPatchProyecto({ territorio: { nivel: "estatal", nombre: "X", extra: "x".repeat(LIMITES.territorioChars) } })).motivo).toBe("demasiado_largo");
  });

  it("los errores NUNCA devuelven el contenido enviado: solo el nombre del campo y el motivo", () => {
    const SECRETO = "SECRETO-NO-DEBE-SALIR-123";
    const casos: unknown[] = [
      { collaborators: SECRETO },
      { name: 5, description: SECRETO },
      { color: SECRETO },
      { status: SECRETO },
      { xpcto: { hito: SECRETO.repeat(2_000) } },
      { xpcto: { tiempo: { duracionMeses: SECRETO } } },
      { territorio: { nivel: SECRETO, nombre: "X" } },
    ];
    for (const c of casos) {
      const e = falla(() => validarPatchProyecto(c));
      const serializado = JSON.stringify({ message: e.message, campo: e.campo, motivo: e.motivo });
      expect(serializado).not.toContain("SECRETO");
    }
  });

  it("el nombre del campo echado se trunca a 80 caracteres", () => {
    const e = falla(() => validarPatchProyecto({ ["k".repeat(5_000)]: 1 }));
    expect(e.campo.length).toBe(80);
  });

  it("la lista blanca es exactamente la acordada (settings fuera)", () => {
    expect([...CAMPOS_PROYECTO_PERMITIDOS].sort()).toEqual(["color", "description", "name", "status", "territorio", "xpcto"]);
  });
});

describe("validarPhaseData", () => {
  it("started sin data → soloIniciar", () => {
    expect(validarPhaseData({ phaseId: "exploracion", started: true })).toEqual({ phaseId: "exploracion", soloIniciar: true });
  });

  it("el cierre de F2 ({aprobadoEn}) y el formulario completo son válidos", () => {
    expect(validarPhaseData({ phaseId: "exploracion", data: { aprobadoEn: "2026-10-07T00:00:00.000Z" } }).data).toEqual({
      aprobadoEn: "2026-10-07T00:00:00.000Z",
    });
    const form = { pestl: { politico: { contexto: "x" } }, semaforo: { actores: [], resumen: "" }, hipotesis: { enunciado: "" } };
    expect(validarPhaseData({ phaseId: "exploracion", data: form }).data).toEqual(form);
  });

  it("phaseId inyectado o inexistente", () => {
    for (const id of ["exploracion.dvs", "x", "__proto__", "", "Exploracion", 5, null, undefined, "proposito.data"]) {
      expect(falla(() => validarPhaseData({ phaseId: id, started: true })).motivo).toBe("fase_invalida");
    }
  });

  it("claves desconocidas dentro de phaseData", () => {
    expect(falla(() => validarPhaseData({ phaseId: "exploracion", started: true, status: "completed" })).campo).toBe("phaseData.status");
  });

  it("started no booleano; sin data ni started; phaseData no objeto", () => {
    expect(falla(() => validarPhaseData({ phaseId: "exploracion", started: "true" })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPhaseData({ phaseId: "exploracion" })).motivo).toBe("cuerpo_invalido");
    expect(falla(() => validarPhaseData({ phaseId: "exploracion", started: false })).motivo).toBe("cuerpo_invalido");
    expect(falla(() => validarPhaseData("exploracion")).motivo).toBe("tipo_invalido");
  });

  it("exploracion.data solo admite las claves que escriben los clientes reales", () => {
    expect([...CLAVES_DATA_EXPLORACION].sort()).toEqual(["aprobadoEn", "hipotesis", "pestl", "semaforo"]);
    // dictamenViabilidad/matrizBrechas/documentoRector solo existen en el tipo: sin escritor real
    for (const k of ["dictamenViabilidad", "matrizBrechas", "documentoRector", "dvs", "motorAprobaciones"]) {
      expect(falla(() => validarPhaseData({ phaseId: "exploracion", data: { [k]: {} } })).motivo).toBe("campo_no_permitido");
    }
    expect(falla(() => validarPhaseData({ phaseId: "exploracion", data: { pestl: "texto" } })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPhaseData({ phaseId: "exploracion", data: { aprobadoEn: 5 } })).motivo).toBe("tipo_invalido");
  });

  it("claves de data con punto, $ o prototipo se rechazan en cualquier fase", () => {
    for (const k of ["pestl.politico", "$set", "a b", "1abc", "_x"]) {
      expect(falla(() => validarPhaseData({ phaseId: "investigacion", data: { [k]: 1 } })).motivo).toBe("campo_no_permitido");
    }
    expect(falla(() => validarPhaseData({ phaseId: "investigacion", data: JSON.parse('{"__proto__": 1}') })).motivo).toBe("campo_no_permitido");
  });

  it("otras fases: claves seguras de primer nivel pasan (nada real las escribe hoy)", () => {
    expect(validarPhaseData({ phaseId: "investigacion", data: { notas: "x", config_1: { a: 1 } } }).data).toEqual({ notas: "x", config_1: { a: 1 } });
  });

  it("data no objeto, arreglo o sobredimensionada", () => {
    expect(falla(() => validarPhaseData({ phaseId: "exploracion", data: [] })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPhaseData({ phaseId: "exploracion", data: "x" })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarPhaseData({ phaseId: "investigacion", data: { notas: "x".repeat(LIMITES.dataChars) } })).motivo).toBe("demasiado_largo");
  });
});

describe("validarReportDraft", () => {
  it("válido", () => {
    expect(validarReportDraft({ phaseId: "proposito", reportText: "# Reporte" })).toEqual({ phaseId: "proposito", reportText: "# Reporte" });
    expect(() => validarReportDraft({ phaseId: "proposito", reportText: "x".repeat(60_000) })).not.toThrow();
  });
  it("phaseId inyectado, texto no string o excesivo", () => {
    expect(falla(() => validarReportDraft({ phaseId: "proposito.reportText", reportText: "x" })).motivo).toBe("fase_invalida");
    expect(falla(() => validarReportDraft({ phaseId: "proposito", reportText: { a: 1 } })).motivo).toBe("tipo_invalido");
    expect(falla(() => validarReportDraft({ phaseId: "proposito", reportText: "x".repeat(LIMITES.reportTextChars + 1) })).motivo).toBe("demasiado_largo");
    expect(falla(() => validarReportDraft(null)).motivo).toBe("tipo_invalido");
  });
});

describe("rutas válidas", () => {
  it("XPCTO tiene exactamente 8 rutas", () => {
    expect(RUTAS_XPCTO).toHaveLength(8);
    expect(esRutaXpctoValida("xpcto.hito")).toBe(true);
    for (const r of ["xpcto.borrador", "xpcto", "xpcto.", "xpcto.a.b", "xpcto.tiempo", "xpcto.tiempo.fechaInicio", "xpcto.capacidades", "hito"]) {
      expect(esRutaXpctoValida(r)).toBe(false);
    }
  });

  it("las rutas de F2 salen del formulario real y coinciden con las del prompt", () => {
    const r = rutasValidasExploracion();
    const esperadas = [
      "pestl.politico.contexto", "pestl.politico.senalesCriticas", "pestl.politico.actoresClave", "pestl.politico.actoresVeto",
      ...["economico", "social", "tecnologico", "ecologico", "legal"].flatMap((d) => [`pestl.${d}.contexto`, `pestl.${d}.senalesCriticas`]),
      "semaforo.actores", "semaforo.resumen", "hipotesis.enunciado", "hipotesis.premisas", "hipotesis.implicaciones",
    ];
    expect([...r].sort()).toEqual([...esperadas].sort());
  });
});

describe("filtrarExtraccionChat — el sufijo de la clave lo controla el modelo", () => {
  it("F1: pasan las 8 rutas con valores string/número/null", () => {
    const e = {
      "xpcto.hito": "H",
      "xpcto.tiempo.duracionMeses": 15,
      "xpcto.tiempo.fechaLimite": "2027-06-06",
      "xpcto.capacidades.humano": "equipo",
      "xpcto.justificacion": null,
    };
    const r = filtrarExtraccionChat(e, "proposito");
    expect(r.xpctoUpdates).toEqual(e);
    expect(r.descartadas).toEqual([]);
  });

  it("descarta rutas ajenas, profundas, objetos y textos desmedidos (y reporta solo NOMBRES)", () => {
    const r = filtrarExtraccionChat(
      {
        "xpcto.hito": "ok",
        "xpcto.borrador": { a: 1 },
        "xpcto.a.b.c.d": "x",
        "xpcto.hito.extra": "x",
        "xpcto.sujeto": { objeto: true },
        "xpcto.justificacion": "x".repeat(LIMITES.valorChatChars + 1),
        "xpcto.tiempo.fechaInicio": "2026-01-01",
        "xpcto.__proto__.x": "x",
      },
      "proposito"
    );
    expect(r.xpctoUpdates).toEqual({ "xpcto.hito": "ok" });
    expect(r.descartadas).toHaveLength(7);
    expect(JSON.stringify(r.descartadas)).not.toContain("objeto");
  });

  it("F2: solo las hojas del formulario, escritas como phases.exploracion.data.<ruta>", () => {
    const r = filtrarExtraccionChat(
      {
        "pestl.politico.contexto": "texto",
        "pestl.economico.senalesCriticas": "texto",
        "semaforo.actores": [{ nombre: "A", nivel: "alto", descripcion: "x" }],
        "hipotesis.enunciado": "H",
      },
      "exploracion"
    );
    expect(Object.keys(r.phaseDataUpdates).sort()).toEqual([
      "phases.exploracion.data.hipotesis.enunciado",
      "phases.exploracion.data.pestl.economico.senalesCriticas",
      "phases.exploracion.data.pestl.politico.contexto",
      "phases.exploracion.data.semaforo.actores",
    ]);
    expect(r.descartadas).toEqual([]);
  });

  it("F2: descarta padres, rutas inexistentes, profundas y valores gigantes", () => {
    const r = filtrarExtraccionChat(
      {
        "pestl.politico": { contexto: "x" },
        "pestl.fantasia.contexto": "x",
        "pestl.politico.contexto.profundo": "x",
        "semaforo.__proto__": "x",
        "hipotesis.enunciado": "x".repeat(LIMITES.valorChatExploracionChars + 1),
        "pestl.legal.contexto": "ok",
      },
      "exploracion"
    );
    expect(Object.keys(r.phaseDataUpdates)).toEqual(["phases.exploracion.data.pestl.legal.contexto"]);
    expect(r.descartadas).toHaveLength(5);
  });

  it("fuera de F2 no se persiste pestl/semaforo/hipotesis (ningún dato real lo hace)", () => {
    const r = filtrarExtraccionChat({ "pestl.politico.contexto": "x", "hipotesis.enunciado": "x" }, "proposito");
    expect(r.phaseDataUpdates).toEqual({});
    expect(r.descartadas).toHaveLength(2);
  });

  it("claves sin prefijo conocido se ignoran como siempre (sin ruido en descartadas)", () => {
    const r = filtrarExtraccionChat({ "__reasoning": "x", "__action": "start_express", otro: 1 }, "exploracion");
    expect(r).toEqual({ xpctoUpdates: {}, phaseDataUpdates: {}, descartadas: [] });
  });

  it("filtrarRecuperacionXpcto (GET) aplica la misma regla", () => {
    const r = filtrarRecuperacionXpcto({ "xpcto.hito": "H", "xpcto.zzz": "x", "xpcto.tiempo.duracionMeses": 4 });
    expect(r.validas).toEqual({ "xpcto.hito": "H", "xpcto.tiempo.duracionMeses": 4 });
    expect(r.descartadas).toEqual(["xpcto.zzz"]);
  });
});
