// C4a-1 — textos del historial: EXHAUSTIVOS contra el código (todo `tipoCambio` y todo `motivo` que alguna ruta o
// módulo escribe tiene su texto en español cotidiano), con respaldo para un valor desconocido (nunca un código interno
// en pantalla), sin siglas y con el criterio Hub/app («Centinela» es el Hub; PESTEL es una app).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TEXTO_ALGUIEN_DEL_EQUIPO,
  TEXTO_SIN_AUTORIA,
  TEXTO_SIN_FECHA,
  formatearFechaFila,
  textoQuien,
  TEXTO_AVISO,
  TEXTO_FASE_SIN_HISTORIAL,
  TEXTO_POR_MOTIVO,
  TEXTO_POR_TIPO,
  TEXTO_RESPALDO,
  detalleEnTexto,
  etiquetaArtefacto,
  tituloAccion,
} from "./textosHistorial";

const RAIZ = join(__dirname, "..", "..", "..");

function archivosDeProduccion(dir: string): string[] {
  const salida: string[] = [];
  for (const rel of readdirSync(join(RAIZ, dir), { recursive: true }) as string[]) {
    const ruta = join(RAIZ, dir, rel);
    if (!/\.tsx?$/.test(rel) || /\.test\.|__tests__|__fixtures__/.test(rel)) continue;
    if (statSync(ruta).isFile()) salida.push(ruta);
  }
  return salida;
}

/** Todos los valores de `tipoCambio` (la unión de tipos) y de `motivo` que el código escribe en el historial. */
function valoresEnElCodigo() {
  const tipos = readFileSync(join(RAIZ, "lib/versionado/tipos.ts"), "utf8");
  const bloque = tipos.slice(tipos.indexOf("export type TipoCambio"), tipos.indexOf("export type EstadoVersion"));
  const tipoCambio = [...bloque.matchAll(/\|\s*"([a-z_]+)"/g)].map((m) => m[1]);

  const motivos = new Set<string>();
  const archivos = [...archivosDeProduccion("app/api/moddulo"), ...archivosDeProduccion("lib/moddulo/versionado")];
  for (const f of archivos) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bMOTIVO_[A-Z_]+\s*=\s*"([a-z_]+)"/g)) motivos.add(m[1]);
    if (!src.includes("prepararVersion(")) continue; // solo los archivos que registran historial
    for (const linea of src.split("\n")) {
      if (!/\bmotivo\s*:/.test(linea) || /^\s*\/\//.test(linea)) continue;
      // Solo lo que va DESPUÉS de `motivo:` en la línea (un literal anterior puede ser de otro campo, p. ej. `t: "x"`).
      const resto = linea.slice(linea.search(/\bmotivo\s*:/));
      for (const m of resto.matchAll(/"([a-z_]+)"/g)) motivos.add(m[1]);
    }
  }
  return { tipoCambio, motivos: [...motivos].sort() };
}

describe("exhaustividad contra el código", () => {
  const { tipoCambio, motivos } = valoresEnElCodigo();

  it("el escaneo encuentra los valores que se conocen hoy (no pasa en vacío)", () => {
    expect(tipoCambio).toEqual(
      expect.arrayContaining(["ajuste_manual", "regeneracion_ia", "reentrega", "entrega", "reapertura", "restauracion", "previo_sin_historial"])
    );
    expect(motivos).toEqual(
      expect.arrayContaining(["aprobacion", "aprobacion_retirada", "resultado_rechazado", "desvinculacion", "reapertura", "cierre_fase"])
    );
  });

  it("todo `tipoCambio` tiene texto", () => {
    for (const t of tipoCambio) {
      expect(TEXTO_POR_TIPO, t).toHaveProperty(t);
      expect(tituloAccion({ tipo: t }), t).toBe((TEXTO_POR_TIPO as Record<string, string>)[t]);
    }
  });

  it("todo `motivo` que escribe el código tiene texto propio", () => {
    for (const m of motivos) {
      expect(TEXTO_POR_MOTIVO, m).toHaveProperty(m);
      expect(tituloAccion({ tipo: "ajuste_manual", motivo: m }), m).toBe(TEXTO_POR_MOTIVO[m]);
    }
  });

  it("los motivos reservados (reapertura de fase, restauración) también tienen texto", () => {
    expect(TEXTO_POR_MOTIVO.reapertura_fase).toBeTruthy();
    expect(TEXTO_POR_MOTIVO.restauracion).toBeTruthy();
  });

  it("el escáner es sensible: un motivo nuevo sin texto se detectaría (prueba del propio escáner)", () => {
    const simulado = new Set([...motivos, "motivo_nuevo_sin_texto"]);
    expect([...simulado].filter((m) => !(m in TEXTO_POR_MOTIVO))).toEqual(["motivo_nuevo_sin_texto"]);
  });
});

describe("valor desconocido: texto de respaldo, nunca un código interno", () => {
  it.each([
    [{ tipo: "algo_nuevo", motivo: "motivo_inventado" }],
    [{ tipo: undefined, motivo: undefined }],
    [{ tipo: 5, motivo: {} }],
    [{ tipo: "__proto__", motivo: "constructor" }],
    [{ tipo: "toString", motivo: "hasOwnProperty" }],
  ])("%j → «Hizo un cambio»", (e) => {
    expect(tituloAccion(e as never)).toBe(TEXTO_RESPALDO);
  });
  it("el respaldo es lenguaje cotidiano", () => {
    expect(TEXTO_RESPALDO).toBe("Hizo un cambio");
  });
});

describe("la aprobación se afina con el artefacto que cambió", () => {
  it("análisis de la Fase 2 / resultado de investigación / genérico", () => {
    expect(tituloAccion({ tipo: "ajuste_manual", motivo: "aprobacion", artefactos: ["f2M1"] })).toBe("Aprobó el análisis de la Fase 2");
    expect(tituloAccion({ tipo: "ajuste_manual", motivo: "aprobacion", artefactos: ["f3Resultado:r1", "f3Asignacion:1-0"] })).toBe(
      "Aprobó un resultado de investigación"
    );
    expect(tituloAccion({ tipo: "ajuste_manual", motivo: "aprobacion", artefactos: [] })).toBe(TEXTO_POR_MOTIVO.aprobacion);
  });
});

describe("etiquetas de artefacto", () => {
  it("nombres de pantalla, sin códigos", () => {
    expect(etiquetaArtefacto("f2M1")).toBe("Análisis de la Fase 2");
    expect(etiquetaArtefacto("cierre:exploracion")).toBe("Cierre de la fase");
    expect(etiquetaArtefacto("f3Resultado:abc")).toBe("Resultado de investigación");
    expect(etiquetaArtefacto("f3Asignacion:3-0")).toBe("Tarea de investigación");
    expect(etiquetaArtefacto("cosa_rara")).toBe("Elemento del proyecto");
  });
});

describe("detalle de auditoría en texto", () => {
  it("motores descartados y borrador", () => {
    expect(detalleEnTexto({ motoresAprobadosDescartados: ["M2", "M3"], borradorDescartado: true })).toBe(
      "Se descartaron el borrador de los motores y 2 motores aprobados."
    );
    expect(detalleEnTexto({ motoresAprobadosDescartados: ["M2"], borradorDescartado: false })).toBe("Se descartaron 1 motor aprobado.");
    expect(detalleEnTexto({ motoresAprobadosDescartados: [], borradorDescartado: true })).toBe("Se descartó el borrador de los motores.");
  });
  it("desvinculación y cierre", () => {
    expect(detalleEnTexto({ teniaAprobacion: true, reporteF2Conservado: true })).toBe(
      "El análisis estaba aprobado. El reporte de la Fase 2 se conservó."
    );
    expect(detalleEnTexto({ reporteSustituido: true, proyectoCompletado: true })).toBe(
      "El reporte guardado de la fase se reemplazó. Con esto el proyecto quedó completo."
    );
  });
  it("claves desconocidas, vacío o formas raras: null, y nunca muestra el nombre de la clave", () => {
    expect(detalleEnTexto({ rdaNuevos: 2, rdaResueltos: 1, otraCosa: "x" })).toBeNull();
    expect(detalleEnTexto({})).toBeNull();
    expect(detalleEnTexto(null)).toBeNull();
    expect(detalleEnTexto([1, 2])).toBeNull();
    expect(detalleEnTexto("texto")).toBeNull();
  });
});

describe("criterios de redacción", () => {
  const todos = [
    ...Object.values(TEXTO_POR_TIPO),
    ...Object.values(TEXTO_POR_MOTIVO),
    ...Object.values(TEXTO_AVISO),
    TEXTO_FASE_SIN_HISTORIAL,
    TEXTO_RESPALDO,
    detalleEnTexto({ motoresAprobadosDescartados: ["M2"], borradorDescartado: true, teniaAprobacion: true, reporteF2Conservado: true, reporteSustituido: true, proyectoCompletado: true }) ?? "",
    etiquetaArtefacto("f2M1"), etiquetaArtefacto("cierre:x"), etiquetaArtefacto("f3Resultado:x"), etiquetaArtefacto("f3Asignacion:x"),
  ];
  it("ningún texto contiene un código interno (palabra con guion bajo) ni siglas del método", () => {
    for (const t of todos) {
      expect(t, t).not.toMatch(/[a-z]+_[a-z]+/);
      expect(t, t).not.toMatch(/\b(HEI|DIE|RDA|IAI|M1|M2|M3|M4|M5|FAT|PIP|IA)\b/);
    }
  });
  it("«Centinela» solo aparece como el Hub, nunca como el nombre de una app", () => {
    for (const t of todos) {
      for (const m of t.matchAll(/Centinela/g)) {
        expect(t.slice(Math.max(0, (m.index ?? 0) - 4), m.index), t).toBe("Hub ");
      }
    }
    // Y cuando se nombra la app, es PESTEL «la app del Hub Centinela».
    expect(TEXTO_POR_MOTIVO.desvinculacion).toBe("Desvinculó el análisis de PESTEL, la app del Hub Centinela");
  });
  it("todos los textos son oraciones no vacías", () => {
    for (const t of todos) expect(t.trim().length).toBeGreaterThan(3);
  });
  it("el aviso de eventos incompletos es el pedido por producto", () => {
    expect(TEXTO_AVISO.eventos_incompletos).toBe("Algunos cambios antiguos no se pueden mostrar.");
  });
});

// ---- C4a-2a: quién hizo el cambio y fecha absoluta de la fila ----
describe("textoQuien: «Sin autoría registrada» frente a «Alguien del equipo»", () => {
  it("sin `por` (versión previa, H-V43) → «Sin autoría registrada», también si el rol no ve nombres", () => {
    expect(textoQuien({ por: null, verDetalle: true })).toBe(TEXTO_SIN_AUTORIA);
    expect(textoQuien({ por: null, nombreColaborador: "Raúl", verDetalle: false })).toBe(TEXTO_SIN_AUTORIA);
  });
  it("con `por` pero el rol no ve nombres → «Alguien del equipo»", () => {
    expect(textoQuien({ por: "u1", nombreColaborador: "Raúl", verDetalle: false })).toBe(TEXTO_ALGUIEN_DEL_EQUIPO);
  });
  it("con `por` pero ya no es colaborador o no tiene nombre (vacío, espacios, no texto) → «Alguien del equipo»", () => {
    for (const n of [undefined, null, "", "   ", 7, {}]) {
      expect(textoQuien({ por: "u9", nombreColaborador: n, verDetalle: true })).toBe(TEXTO_ALGUIEN_DEL_EQUIPO);
    }
  });
  it("con nombre → el nombre (recortado)", () => {
    expect(textoQuien({ por: "u1", nombreColaborador: "  Raúl  ", verDetalle: true })).toBe("Raúl");
  });
});

describe("formatearFechaFila: fecha absoluta es-MX en la zona horaria dada", () => {
  const iso = "2026-11-10T15:30:00.000Z";
  it("día, mes y año en español, con hora", () => {
    const t = formatearFechaFila(iso, { timeZone: "UTC" });
    expect(t).toContain("10 de noviembre de 2026");
    expect(t).toMatch(/3:30/);
  });
  it("respeta la zona horaria (Ciudad de México = UTC−6 en noviembre)", () => {
    expect(formatearFechaFila(iso, { timeZone: "America/Mexico_City" })).toMatch(/9:30/);
  });
  it("cambia de día según la zona", () => {
    const tarde = "2026-11-10T03:00:00.000Z";
    expect(formatearFechaFila(tarde, { timeZone: "UTC" })).toContain("10 de noviembre");
    expect(formatearFechaFila(tarde, { timeZone: "America/Mexico_City" })).toContain("9 de noviembre");
  });
  it("ausente, null, vacío o ilegible → «Fecha desconocida (anterior al historial)» (sin lanzar)", () => {
    for (const v of [undefined, null, "", "no es una fecha", "2026-13-45"]) {
      expect(formatearFechaFila(v as never)).toBe(TEXTO_SIN_FECHA);
    }
  });
  it("una zona horaria inválida no lanza", () => {
    expect(formatearFechaFila(iso, { timeZone: "Marte/Olympus" })).toBe(TEXTO_SIN_FECHA);
  });
  it("sin zona dada usa la del entorno (no lanza y trae el año)", () => {
    expect(formatearFechaFila(iso)).toContain("2026");
  });
});
