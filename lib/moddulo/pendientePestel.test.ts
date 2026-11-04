// T5: lo puro de la pantalla del vínculo pendiente: opciones del menú, texto del modal y textos de fallo de «Cancelar».
import { describe, expect, it } from "vitest";
import { opcionesKebabM1 } from "./pantallaM1";
import { textoModalPendiente } from "./textosModalM1";
import { decidirResultadoGuardado } from "./guardadoHonesto";
import { MENSAJE_PENDIENTE_CAMBIO, MENSAJE_PENDIENTE_NO_ENCONTRADO } from "./textosVinculo";

describe("opcionesKebabM1 con vínculo pendiente", () => {
  const abierta = { kind: null, estado: null, f2Cerrada: false } as const;
  it("sin PESTEL o sin dato: lo de siempre (incluye «Analizar con PESTEL» y «Vincular con análisis independiente»)", () => {
    for (const vinculo of [undefined, "sin_pestel"] as const) {
      expect(opcionesKebabM1({ ...abierta, vinculo })).toMatchObject({ nuevoAnalisis: true, analizarConPestel: true, vincularIndependiente: true, vincularDeNuevo: true, hayOpciones: true });
    }
  });
  it("pendiente: NO se ofrece analizar con PESTEL, vincular otro ni «Vincular de nuevo»; «Nuevo análisis» sí", () => {
    expect(opcionesKebabM1({ ...abierta, vinculo: "pendiente" })).toMatchObject({ nuevoAnalisis: true, analizarConPestel: false, vincularIndependiente: false, vincularDeNuevo: false, hayOpciones: true });
  });
  it("pendiente sobre un express aprobado conserva «Editar narrativas»; con la fase cerrada no hay nada", () => {
    expect(opcionesKebabM1({ kind: "express", estado: "aprobado", f2Cerrada: false, vinculo: "pendiente" }).editarNarrativas).toBe(true);
    expect(opcionesKebabM1({ ...abierta, f2Cerrada: true, vinculo: "pendiente" }).hayOpciones).toBe(false);
  });
});

describe("textoModalPendiente", () => {
  it("dice qué se conserva y no promete lo que no pasa; el huérfano tiene su texto", () => {
    const t = textoModalPendiente();
    expect(t.titulo).toBe("¿Cancelar el vínculo pendiente con Centinela?");
    expect(t.intro.join(" ")).toContain("se conservan");
    expect(t.confirmar).toBe("Cancelar vínculo");
    expect(t.lineas).toEqual([]);
    expect(textoModalPendiente({ huerfano: true }).intro.join(" ")).toContain("ya no existe");
    for (const x of [t.titulo, ...t.intro, t.confirmar, t.cancelar]) expect(x).not.toMatch(/soporte/i);
  });
});

describe("fallos de «Cancelar vínculo pendiente» (acción desvincular_pestel)", () => {
  const r = (status: number, codigo: string) => decidirResultadoGuardado("desvincular_pestel", { tipo: "respuesta", ok: false, status, codigo } as never);
  it("pendiente_no_encontrado y estado_cambio llevan el texto del servidor; ninguno afirma qué sigue en pantalla", () => {
    const a = r(400, "pendiente_no_encontrado");
    const b = r(409, "estado_cambio");
    expect(a.exito).toBe(false);
    expect(a.exito === false && a.mensajeError).toContain(MENSAJE_PENDIENTE_NO_ENCONTRADO);
    expect(b.exito === false && b.mensajeError).toContain(MENSAJE_PENDIENTE_CAMBIO);
  });
  it("lo que ya decía (not_linked) no cambia", () => {
    const x = r(400, "not_linked");
    expect(x.exito === false && x.mensajeError).toContain("ya no está vinculado");
  });
});
