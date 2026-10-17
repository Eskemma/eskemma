// Invariante de pantalla: NUNCA se muestra un aviso, mensaje o texto que invite a «aprobar» (o a editar)
// cuando el panel está en solo lectura o no existe el botón «Aprobar análisis». Se prueba con TODAS las
// combinaciones de estado × fase cerrada × tipo de M1, contra el pie real (pieM1) y contra cada texto.

import { describe, expect, it } from "vitest";
import type { EstadoM1 } from "./m1Aprobacion";
import {
  avisoExitoNuevoAnalisisVisible, mensajeAreaMotores, motivoCerrarF2SinAprobar, motivoSinEditarMotores, pieM1,
  permisoEdicionM1, puedeAprobarM1, subtituloAreaMotores, textoExitoNuevoAnalisis, textoReporteAnterior,
  MOTIVO_CERRAR_F2_SIN_APROBAR, TEXTO_REPORTE_ANTERIOR,
} from "./pantallaM1";

const ESTADOS: (EstadoM1 | null)[] = ["sin_m1", "sin_m1_con_restos", "anterior", "borrador", "reabierto", "aprobado", null];
const KINDS = ["express", "T22", null];
const INVITA = /aprueb|aprobar|edita|editar|revisa y/i;

const pieDe = (estado: EstadoM1 | null, f2Cerrada: boolean, kind: string | null) =>
  pieM1({
    estado, f2Cerrada, kind, aprobadoEn: null, motoresSinGenerarServidor: false, motoresGenerados: false,
    dimensionesConCambios: [], aprobando: false, generando: false,
  });

describe("puedeAprobarM1 = existe el botón «Aprobar análisis»", () => {
  it("coincide con pieM1().aprobar.visible en todas las combinaciones", () => {
    for (const estado of ESTADOS) for (const cerrada of [false, true]) for (const kind of KINDS) {
      expect(puedeAprobarM1(estado, cerrada), `${estado}/${cerrada}/${kind}`).toBe(pieDe(estado, cerrada, kind).aprobar.visible);
    }
  });
  it("la fase cerrada nunca permite aprobar, y el solo-lectura de la fase cerrada tampoco ofrece lápiz", () => {
    for (const estado of ESTADOS) {
      expect(puedeAprobarM1(estado, true)).toBe(false);
      expect(permisoEdicionM1({ kind: "express", f2Cerrada: true, estado }).puede).toBe(false);
    }
  });
});

describe("textos que invitan a aprobar o editar", () => {
  it("sin botón Aprobar no hay aviso de éxito de «Nuevo análisis»", () => {
    for (const estado of ESTADOS) for (const cerrada of [false, true]) {
      const visible = avisoExitoNuevoAnalisisVisible({ aviso: "x", estado, f2Cerrada: cerrada });
      if (!puedeAprobarM1(estado, cerrada)) expect(visible, `${estado}/${cerrada}`).toBe(false);
    }
  });
  it("el aviso de éxito solo se muestra en borrador con el botón Aprobar, y no sin aviso", () => {
    expect(avisoExitoNuevoAnalisisVisible({ aviso: "x", estado: "borrador", f2Cerrada: false })).toBe(true);
    expect(avisoExitoNuevoAnalisisVisible({ aviso: "x", estado: "reabierto", f2Cerrada: false })).toBe(false);
    expect(avisoExitoNuevoAnalisisVisible({ aviso: "x", estado: "borrador", f2Cerrada: true })).toBe(false);
    expect(avisoExitoNuevoAnalisisVisible({ aviso: null, estado: "borrador", f2Cerrada: false })).toBe(false);
  });
  it("el centro no dice «Primero revisa y aprueba» ni «se generarán cuando apruebes» sin botón Aprobar", () => {
    for (const estado of ESTADOS) for (const cerrada of [false, true]) {
      if (puedeAprobarM1(estado, cerrada)) continue;
      const textos = [mensajeAreaMotores(estado, cerrada), (estado === "borrador" || estado === "reabierto") ? subtituloAreaMotores(estado, cerrada) : null];
      for (const t of textos) if (t) expect(t, `${estado}/${cerrada}`).not.toMatch(INVITA);
    }
  });
  it("con el botón Aprobar, el centro sí lo invita (borrador y reabierto)", () => {
    expect(subtituloAreaMotores("borrador", false)).toContain("Primero revisa y aprueba");
    expect(mensajeAreaMotores("borrador", false)).toContain("cuando apruebes");
    expect(mensajeAreaMotores("reabierto", false)).toContain("apruebes de nuevo");
  });
  it("en fase cerrada el centro lo dice sin invitar a nada", () => {
    expect(mensajeAreaMotores("borrador", true)).toContain("La Fase 2 está cerrada");
    expect(subtituloAreaMotores("borrador", true)).not.toMatch(INVITA);
  });
  it("rótulo del reporte anterior, motivo de «Cerrar Fase 2» y tooltip de «Editar análisis»", () => {
    expect(textoReporteAnterior(true)).toBe(TEXTO_REPORTE_ANTERIOR);
    expect(motivoCerrarF2SinAprobar(true)).toBe(MOTIVO_CERRAR_F2_SIN_APROBAR);
    expect(textoReporteAnterior(false)).toContain("corresponde al análisis anterior");
    expect(textoReporteAnterior(false)).not.toMatch(INVITA);
    expect(motivoCerrarF2SinAprobar(false)).not.toMatch(INVITA);
    for (const estado of ESTADOS) for (const cerrada of [false, true]) {
      const t = motivoSinEditarMotores(estado, cerrada);
      if (t && !puedeAprobarM1(estado, cerrada)) expect(t, `${estado}/${cerrada}`).not.toMatch(INVITA);
    }
    expect(motivoSinEditarMotores("borrador", false)).toContain("Aprueba el análisis");
  });
});

describe("punto doble tras «p. m.»", () => {
  it("el aviso de éxito nunca termina en «..» ni contiene «..» (la hora ya cierra con punto)", () => {
    for (const h of [0, 3, 9, 14, 21]) {
      const t = textoExitoNuevoAnalisis(new Date(Date.UTC(2026, 9, 16, h + 6, 51)), true);
      expect(t).not.toContain("..");
      expect(t).toMatch(/generado el 16 oct 2026, \d{1,2}:51 [ap]\. ?m\.\s+Revísalo/);
    }
  });
});
