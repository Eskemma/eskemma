// pantallaM1: decisiones puras de la pantalla de revisión del M1 (API nueva). Sin DOM: lo que la
// página dibuja sale de estas funciones.

import { describe, expect, it } from "vitest";
import type { MapaPESTEL } from "@/types/moddulo.types";
import {
  avisarAlSalir,
  debeRefrescarTras409,
  dimensionesConCambios,
  errorDeBorrador,
  fechaCorta,
  mensajeAreaMotores,
  mensajeCambiosSinGuardar,
  mostrarAvisoSinGenerar,
  opcionesKebabM1,
  permisoEdicionM1,
  pieM1,
  puedeEditarMotores,
  tooltipEditado,
  type EntradaPie,
} from "./pantallaM1";
import type { EstadoM1 } from "./m1Aprobacion";

const mapa = (): MapaPESTEL =>
  ({
    P: { code: "P", narrativa: "IA P", clasificacion: "NEUTRAL" },
    E: { code: "E", narrativa: "IA E", clasificacion: "AMENAZA" },
    S: { code: "S", narrativa: "IA S", clasificacion: "NEUTRAL" },
  }) as unknown as MapaPESTEL;

describe("permisoEdicionM1 — quién puede editar", () => {
  const p = (estado: EstadoM1 | null, over: Partial<{ kind: string | null; f2Cerrada: boolean }> = {}) =>
    permisoEdicionM1({ kind: "express", f2Cerrada: false, estado, ...over });

  it("Express, F2 abierta y M1 sin aprobar (borrador o reabierto): sí", () => {
    expect(p("borrador")).toEqual({ puede: true, motivo: "ok" });
    expect(p("reabierto")).toEqual({ puede: true, motivo: "ok" });
  });
  it("aprobado: no (bloqueado)", () => expect(p("aprobado")).toEqual({ puede: false, motivo: "aprobado" }));
  it("Centinela (T22): nunca hay lápiz, ni en borrador", () => {
    expect(p("borrador", { kind: "T22" })).toEqual({ puede: false, motivo: "centinela" });
    expect(p("reabierto", { kind: "T22" }).puede).toBe(false);
  });
  it("F2 cerrada: solo lectura aunque sea borrador de Express", () => {
    expect(p("borrador", { f2Cerrada: true })).toEqual({ puede: false, motivo: "cerrada" });
  });
  it("proyecto anterior: sin lápiz (nada cambia en ellos)", () => expect(p("anterior").motivo).toBe("anterior"));
  it("sin M1 (o sin resumen todavía): no", () => {
    for (const e of [null, "sin_m1", "sin_m1_con_restos"] as const) expect(p(e)).toEqual({ puede: false, motivo: "sin_m1" });
  });
});

describe("dimensionesConCambios y el bloqueo de Aprobar", () => {
  it("lista, en el orden de la pantalla, solo las dimensiones en edición cuyo borrador difiere de lo guardado", () => {
    const b = {
      S: { narrativa: "IA S editada", clasificacion: "NEUTRAL" },
      P: { narrativa: "IA P", clasificacion: "AMENAZA" }, // solo clasificación
      E: { narrativa: "IA E", clasificacion: "AMENAZA" }, // igual que lo guardado: sin cambios
    };
    expect(dimensionesConCambios(b, mapa())).toEqual(["P", "S"]);
  });
  it("una dimensión sin borrador (no está en edición) no cuenta; sin mapa, nada", () => {
    expect(dimensionesConCambios({}, mapa())).toEqual([]);
    expect(dimensionesConCambios({ P: { narrativa: "x", clasificacion: "NEUTRAL" } }, null)).toEqual([]);
  });
  it("volver a escribir lo guardado deja de contar", () => {
    expect(dimensionesConCambios({ P: { narrativa: "IA P", clasificacion: "NEUTRAL" } }, mapa())).toEqual([]);
  });
  it("el mensaje usa los nombres que ve el usuario", () => {
    expect(mensajeCambiosSinGuardar(["P", "S"])).toBe("Guarda o cancela tus cambios en: Político, Social");
    expect(mensajeCambiosSinGuardar(["Ec"])).toBe("Guarda o cancela tus cambios en: Ecológico");
  });
  it("avisarAlSalir solo con cambios", () => {
    expect(avisarAlSalir([])).toBe(false);
    expect(avisarAlSalir(["P"])).toBe(true);
  });
});

describe("errorDeBorrador", () => {
  it("vacío o solo espacios y más de 10 000: error; el resto, enviable", () => {
    expect(errorDeBorrador({ narrativa: "  ", clasificacion: "NEUTRAL" })).toBe("La narrativa no puede estar vacía.");
    expect(errorDeBorrador({ narrativa: "a".repeat(10_001), clasificacion: "NEUTRAL" })).toContain("10 000");
    expect(errorDeBorrador({ narrativa: "a".repeat(10_000), clasificacion: "NEUTRAL" })).toBeNull();
  });
  it("cualquier 409 pide refrescar; los demás estados no", () => {
    expect(debeRefrescarTras409({ tipo: "respuesta", ok: false, status: 409, codigo: "m1_cambio" })).toBe(true);
    expect(debeRefrescarTras409({ tipo: "respuesta", ok: false, status: 500 })).toBe(false);
    expect(debeRefrescarTras409({ tipo: "error_red" })).toBe(false);
  });
});

describe("pieM1 — estado del pie fijo", () => {
  const base = (o: Partial<EntradaPie> = {}): EntradaPie => ({
    estado: "borrador", f2Cerrada: false, kind: "express", aprobadoEn: "2026-10-15T18:00:00Z",
    motoresSinGenerarServidor: false, motoresGenerados: false, dimensionesConCambios: [],
    aprobando: false, generando: false, ...o,
  });

  it("borrador: «Aprobar análisis» habilitado y sin texto de estado", () => {
    const p = pieM1(base());
    expect(p).toMatchObject({ tipo: "borrador", texto: null });
    expect(p.aprobar).toEqual({ visible: true, deshabilitado: false, motivo: null, etiqueta: "Aprobar análisis" });
  });
  it("borrador con cambios sin guardar: deshabilitado con el mensaje exacto", () => {
    const p = pieM1(base({ dimensionesConCambios: ["P", "S"] }));
    expect(p.aprobar.deshabilitado).toBe(true);
    expect(p.aprobar.motivo).toBe("Guarda o cancela tus cambios en: Político, Social");
  });
  it("aprobando: evita el doble clic (deshabilitado, «Aprobando…»); generando también", () => {
    expect(pieM1(base({ aprobando: true })).aprobar).toMatchObject({ deshabilitado: true, etiqueta: "Aprobando…" });
    expect(pieM1(base({ generando: true })).aprobar.deshabilitado).toBe(true);
  });
  it("reabierto: texto exacto y se puede aprobar de nuevo", () => {
    const p = pieM1(base({ estado: "reabierto" }));
    expect(p.texto).toBe("Abierto para edición — aprueba de nuevo para reactivar M2–M5");
    expect(p.aprobar.visible).toBe(true);
  });
  it("aprobado con motores generados: «✓ Aprobado el {fecha}», sin reintentar", () => {
    const p = pieM1(base({ estado: "aprobado", motoresGenerados: true, motoresSinGenerarServidor: true }));
    expect(p.texto).toMatch(/^✓ Aprobado el 15 oct 2026$/);
    expect(p.lineaGeneracion).toBeNull();
    expect(p.reintentarGeneracion.visible).toBe(false);
    expect(p.aprobar.visible).toBe(false);
  });
  it("aprobado sin motores: «M1 aprobado, motores sin generar» + «Reintentar generación»", () => {
    const p = pieM1(base({ estado: "aprobado", motoresSinGenerarServidor: true }));
    expect(p.lineaGeneracion).toBe("M1 aprobado, motores sin generar");
    expect(p.reintentarGeneracion).toEqual({ visible: true, deshabilitado: false });
  });
  it("aprobado generando: muestra progreso y deshabilita el reintento; nunca afirma que se generaron", () => {
    const p = pieM1(base({ estado: "aprobado", motoresSinGenerarServidor: true, generando: true }));
    expect(p.lineaGeneracion).toBe("Generando los motores M2–M5…");
    expect(p.reintentarGeneracion.deshabilitado).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/se generaron|ya se generaron/);
  });
  it("aprobado cuyo servidor dice que los motores corresponden: sin aviso de generación", () => {
    expect(pieM1(base({ estado: "aprobado", motoresSinGenerarServidor: false })).lineaGeneracion).toBeNull();
  });
  it("aprobado sin fecha legible: «✓ Aprobado»", () => {
    expect(pieM1(base({ estado: "aprobado", aprobadoEn: null })).texto).toBe("✓ Aprobado");
  });
  it("anterior: solo la etiqueta, sin Aprobar, sin reintentar, sin reabrir", () => {
    const p = pieM1(base({ estado: "anterior", f2Cerrada: true }));
    expect(p).toMatchObject({ tipo: "anterior", texto: "Aprobación no registrada (proyecto anterior)", reabrirCentinela: false });
    expect(p.aprobar.visible).toBe(false);
    expect(p.reintentarGeneracion.visible).toBe(false);
  });
  it("sin M1, con restos o sin resumen: el pie no existe", () => {
    for (const estado of [null, "sin_m1", "sin_m1_con_restos"] as const) {
      const p = pieM1(base({ estado }));
      expect(p.tipo).toBe("oculto");
      expect(p.aprobar.visible).toBe(false);
    }
  });
  it("Centinela (T22) aprobado: enlace «Reabrir análisis»; Express aprobado: no (reabre desde el kebab)", () => {
    expect(pieM1(base({ estado: "aprobado", kind: "T22", motoresGenerados: true })).reabrirCentinela).toBe(true);
    expect(pieM1(base({ estado: "aprobado", kind: "express", motoresGenerados: true })).reabrirCentinela).toBe(false);
  });
  it("Centinela en borrador: se aprueba igual (mismo botón)", () => {
    expect(pieM1(base({ kind: "T22" })).aprobar.visible).toBe(true);
  });
  it("F2 cerrada: nada de acciones (ni aprobar, ni reintentar, ni reabrir)", () => {
    const p = pieM1(base({ estado: "aprobado", kind: "T22", f2Cerrada: true, motoresSinGenerarServidor: true }));
    expect(p.aprobar.visible).toBe(false);
    expect(p.reintentarGeneracion.visible).toBe(false);
    expect(p.reabrirCentinela).toBe(false);
    expect(pieM1(base({ estado: "borrador", f2Cerrada: true })).tipo).toBe("oculto");
  });
});

describe("área de motores y chip «Editar análisis»", () => {
  it("mientras M1 es borrador o está reabierto, mensaje en lugar de motores", () => {
    expect(mensajeAreaMotores("borrador")).toBe("Los motores M2–M5 se generarán cuando apruebes el análisis.");
    expect(mensajeAreaMotores("reabierto")).toBe("Los motores M2–M5 están en pausa hasta que apruebes de nuevo el análisis.");
    for (const e of ["aprobado", "anterior", "sin_m1", "sin_m1_con_restos", null] as const) expect(mensajeAreaMotores(e)).toBeNull();
  });
  it("«Editar análisis» deshabilitado con M1 sin aprobar o reabierto, o aprobado sin motores; habilitado en el resto", () => {
    expect(puedeEditarMotores("borrador", true)).toBe(false);
    expect(puedeEditarMotores("reabierto", true)).toBe(false);
    expect(puedeEditarMotores("aprobado", false)).toBe(false);
    expect(puedeEditarMotores("aprobado", true)).toBe(true);
    expect(puedeEditarMotores("anterior", true)).toBe(true); // proyectos anteriores: sin cambios
    expect(puedeEditarMotores(null, true)).toBe(true);
  });
  it("el aviso «sin generar» solo con M1 aprobado, sin motores, sin generación en curso ni error propio", () => {
    const i = { estado: "aprobado" as EstadoM1, motoresSinGenerarServidor: true, motoresGenerados: false, generando: false, hayErrorGeneracion: false };
    expect(mostrarAvisoSinGenerar(i)).toBe(true);
    expect(mostrarAvisoSinGenerar({ ...i, generando: true })).toBe(false);
    expect(mostrarAvisoSinGenerar({ ...i, hayErrorGeneracion: true })).toBe(false);
    expect(mostrarAvisoSinGenerar({ ...i, motoresGenerados: true })).toBe(false);
    expect(mostrarAvisoSinGenerar({ ...i, estado: "borrador" })).toBe(false);
  });
});

describe("kebab y fechas", () => {
  it("«Editar narrativas» solo en Express aprobado con F2 abierta", () => {
    expect(opcionesKebabM1({ kind: "express", estado: "aprobado", f2Cerrada: false }).editarNarrativas).toBe(true);
    expect(opcionesKebabM1({ kind: "express", estado: "borrador", f2Cerrada: false }).editarNarrativas).toBe(false);
    expect(opcionesKebabM1({ kind: "express", estado: "reabierto", f2Cerrada: false }).editarNarrativas).toBe(false);
    expect(opcionesKebabM1({ kind: "T22", estado: "aprobado", f2Cerrada: false }).editarNarrativas).toBe(false);
    expect(opcionesKebabM1({ kind: "express", estado: "aprobado", f2Cerrada: true }).editarNarrativas).toBe(false);
    expect(opcionesKebabM1({ kind: "express", estado: "anterior", f2Cerrada: false }).editarNarrativas).toBe(false);
  });
  it("fechaCorta acepta las formas de Firestore y devuelve null si no es fecha", () => {
    expect(fechaCorta({ _seconds: Date.parse("2026-10-15T18:00:00Z") / 1000 })).toBe("15 oct 2026");
    expect(fechaCorta("nada")).toBeNull();
    expect(tooltipEditado("2026-10-15T18:00:00Z")).toBe("Editado el 15 oct 2026");
    expect(tooltipEditado(null)).toBe("Editado por ti");
  });
});
