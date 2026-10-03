// lib/pestel/informesSync.test.ts
// Lógica pura de persistencia de informes E7: migración de la caché local
// legada, ediciones pendientes y selección del informe vigente.

import { describe, expect, it } from "vitest";
import {
  MARCA_INFORME_NO_GUARDADO,
  extraerEstadoGuardado,
  construirInforme,
  informeVigentePorFormato,
  parsearCacheLocalLegada,
  parsearPendientes,
  planMigracionLocal,
  reconciliarPendientes,
  textoVigente,
  FORMATO_POR_REPORT_FORMAT,
  REPORT_FORMAT_POR_FORMATO,
} from "./informesSync";
import type { InformeGenerado } from "@/types/pestel.types";

function informe(over: Partial<InformeGenerado> = {}): InformeGenerado {
  return {
    id: "inf1",
    formato: "ejecutivo",
    contenidoTexto: "generado",
    datosEstructurados: { scorecard: [], mapaPESTEL: {} },
    generadoEn: "2026-10-01T10:00:00.000Z",
    ...over,
  };
}

describe("mapeo de formatos", () => {
  it("es biyectivo", () => {
    for (const [rf, f] of Object.entries(FORMATO_POR_REPORT_FORMAT)) {
      expect(REPORT_FORMAT_POR_FORMATO[f as InformeGenerado["formato"]]).toBe(rf);
    }
  });
});

describe("textoVigente / informeVigentePorFormato", () => {
  it("prefiere la edición sobre la generación (incluida una edición vacía)", () => {
    expect(textoVigente(informe())).toBe("generado");
    expect(textoVigente(informe({ contenidoEditado: "editado" }))).toBe("editado");
    expect(textoVigente(informe({ contenidoEditado: "" }))).toBe("");
  });

  it("toma el más reciente por formato", () => {
    const v = informeVigentePorFormato([
      informe({ id: "a", generadoEn: "2026-10-01T10:00:00.000Z" }),
      informe({ id: "b", generadoEn: "2026-10-02T10:00:00.000Z" }),
      informe({ id: "c", formato: "tecnico" }),
    ]);
    expect(v.executive?.id).toBe("b");
    expect(v.technical?.id).toBe("c");
    expect(v.foda).toBeUndefined();
  });

  it("tolera undefined", () => {
    expect(informeVigentePorFormato(undefined)).toEqual({});
  });
});

describe("parsearCacheLocalLegada", () => {
  it("lee formatos válidos y descarta basura", () => {
    expect(
      parsearCacheLocalLegada(
        JSON.stringify({ executive: "a", technical: "  ", foda: 3, otro: "x" })
      )
    ).toEqual({ executive: "a" });
  });
  it("null, corrupto o no objeto → vacío", () => {
    expect(parsearCacheLocalLegada(null)).toEqual({});
    expect(parsearCacheLocalLegada("{no json")).toEqual({});
    expect(parsearCacheLocalLegada("5")).toEqual({});
  });
});

describe("planMigracionLocal", () => {
  it("formato sin informe en servidor → crear", () => {
    expect(planMigracionLocal({ executive: "local" }, {})).toEqual([
      { tipo: "crear", formato: "executive", contenido: "local" },
    ]);
  });

  it("local igual a la generación → nada", () => {
    expect(
      planMigracionLocal({ executive: "generado" }, { executive: informe() })
    ).toEqual([]);
  });

  it("local igual a la edición del servidor → nada", () => {
    expect(
      planMigracionLocal(
        { executive: "editado" },
        { executive: informe({ contenidoEditado: "editado" }) }
      )
    ).toEqual([]);
  });

  it("servidor solo con generación y local distinto → editar el mismo informe", () => {
    expect(
      planMigracionLocal({ executive: "mi edición" }, { executive: informe() })
    ).toEqual([
      { tipo: "editar", formato: "executive", informeId: "inf1", contenido: "mi edición" },
    ]);
  });

  it("servidor con edición distinta → el servidor gana y el local se conserva", () => {
    const acciones = planMigracionLocal(
      { executive: "viejo local" },
      { executive: informe({ contenidoEditado: "edición posterior" }) }
    );
    expect(acciones).toHaveLength(1);
    expect(acciones[0].tipo).toBe("conservar_local");
  });

  it("resuelve cada formato de forma independiente", () => {
    const acciones = planMigracionLocal(
      { executive: "x", technical: "y" },
      { executive: informe() }
    );
    expect(acciones.map((a) => `${a.tipo}:${a.formato}`)).toEqual([
      "editar:executive",
      "crear:technical",
    ]);
  });
});

describe("reconciliarPendientes", () => {
  const vigentes = {
    executive: informe({ editadoEn: "2026-10-02T10:00:00.000Z", contenidoEditado: "e1" }),
  };
  const ts = (iso: string) => Date.parse(iso);

  it("pendiente más reciente que el servidor → reenviar", () => {
    expect(
      reconciliarPendientes(
        { executive: { informeId: "inf1", contenido: "e2", ts: ts("2026-10-03T00:00:00Z") } },
        vigentes
      )
    ).toEqual([
      { tipo: "reenviar", formato: "executive", informeId: "inf1", contenido: "e2" },
    ]);
  });

  it("servidor igual o posterior → descartar", () => {
    expect(
      reconciliarPendientes(
        { executive: { informeId: "inf1", contenido: "e0", ts: ts("2026-10-01T00:00:00Z") } },
        vigentes
      )
    ).toEqual([{ tipo: "descartar", formato: "executive" }]);
  });

  it("mismo contenido que el servidor → descartar aunque sea más reciente", () => {
    expect(
      reconciliarPendientes(
        { executive: { informeId: "inf1", contenido: "e1", ts: ts("2026-10-03T00:00:00Z") } },
        vigentes
      )
    ).toEqual([{ tipo: "descartar", formato: "executive" }]);
  });

  it("informe sustituido por una regeneración → descartar (no pisa lo nuevo)", () => {
    expect(
      reconciliarPendientes(
        { executive: { informeId: "viejo", contenido: "x", ts: ts("2026-10-03T00:00:00Z") } },
        vigentes
      )
    ).toEqual([{ tipo: "descartar", formato: "executive" }]);
  });

  it("parsearPendientes valida la forma", () => {
    expect(
      parsearPendientes(
        JSON.stringify({
          executive: { informeId: "a", contenido: "b", ts: 1 },
          technical: { informeId: "a" },
        })
      )
    ).toEqual({ executive: { informeId: "a", contenido: "b", ts: 1 } });
    expect(parsearPendientes("{")).toEqual({});
  });
});

describe("construirInforme", () => {
  it("arma el informe con id, formato guardado y origen opcional", () => {
    const inf = construirInforme({
      id: "x1",
      format: "foda",
      texto: "hola",
      analysis: { dimensions: [] },
      variableConfigs: [],
      origen: "migrado_localstorage",
      generadoEn: "2026-10-03T00:00:00.000Z",
    });
    expect(inf).toMatchObject({
      id: "x1",
      formato: "foda_lista",
      contenidoTexto: "hola",
      generadoEn: "2026-10-03T00:00:00.000Z",
      origen: "migrado_localstorage",
    });
    expect(inf.contenidoEditado).toBeUndefined();
  });

  it("sin origen no agrega el campo (Firestore rechaza undefined)", () => {
    const inf = construirInforme({
      id: "x2",
      format: "executive",
      texto: "t",
      analysis: { dimensions: [] },
      variableConfigs: [],
    });
    expect("origen" in inf).toBe(false);
  });
});

describe("extraerEstadoGuardado", () => {
  it("sin marca: el texto queda intacto y se considera guardado", () => {
    expect(extraerEstadoGuardado("Informe completo")).toEqual({
      texto: "Informe completo",
      guardado: true,
    });
  });
  it("con marca al final: la separa y avisa que NO se guardó", () => {
    expect(extraerEstadoGuardado("Informe completo" + MARCA_INFORME_NO_GUARDADO)).toEqual({
      texto: "Informe completo",
      guardado: false,
    });
  });
  it("una marca a medio llegar (chunk partido) aún no cuenta", () => {
    const parcial = MARCA_INFORME_NO_GUARDADO.slice(0, 6);
    expect(extraerEstadoGuardado("texto" + parcial).guardado).toBe(true);
  });
  it("texto vacío", () => {
    expect(extraerEstadoGuardado("")).toEqual({ texto: "", guardado: true });
  });
});
