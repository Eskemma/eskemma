// compuertaM1: the pure decision of the M1 gate and the re-check at write time.
import { describe, expect, it } from "vitest";
import { coincideCompuertaM1, decidirCompuertaM1 } from "./compuertaM1";
import { exploracionGate, huellaGate, mapaGate, otroMapaGate } from "./__tests__/fixtures/m1Gate";
import type { ExploracionParaM1 } from "./m1Servidor";

const e = (...a: Parameters<typeof exploracionGate>) => exploracionGate(...a) as ExploracionParaM1;

describe("decidirCompuertaM1", () => {
  it("sin m1 (proyecto anterior): sin_m1 — el comportamiento de siempre", () => {
    expect(decidirCompuertaM1(e("sin_m1"))).toEqual({ accion: "sin_m1" });
    expect(decidirCompuertaM1(undefined)).toEqual({ accion: "sin_m1" });
    expect(decidirCompuertaM1({})).toEqual({ accion: "sin_m1" });
  });
  it("m1 sin payload (ruta legada o tras desvincular): sin_m1, aunque conserve una aprobación vieja", () => {
    expect(decidirCompuertaM1(e("sin_payload"))).toEqual({ accion: "sin_m1" });
  });
  it("borrador y reabierto: bloquea (no_aprobado)", () => {
    expect(decidirCompuertaM1(e("borrador"))).toEqual({ accion: "bloquea", motivo: "no_aprobado" });
    expect(decidirCompuertaM1(e("reabierto"))).toEqual({ accion: "bloquea", motivo: "no_aprobado" });
  });
  it("aprobación cuya huella ya no coincide con el payload (se editó después): bloquea", () => {
    const x = e("aprobado");
    (x.linkedSource as { payload: object }).payload = otroMapaGate;
    expect(decidirCompuertaM1(x)).toEqual({ accion: "bloquea", motivo: "no_aprobado" });
  });
  it("aprobado: pasa con la COPIA congelada y su huella", () => {
    const x = e("aprobado");
    const r = decidirCompuertaM1(x);
    expect(r).toEqual({ accion: "pasa", mapa: mapaGate, huella: huellaGate() });
    expect(r.accion === "pasa" && r.mapa).toBe(x.m1!.aprobacion!.mapa); // la copia, no el payload vivo
  });
  it("copia congelada que no es lo aprobado: cierra con un motivo propio (distinguible en el diagnóstico)", () => {
    expect(decidirCompuertaM1(e("copia_alterada"))).toEqual({ accion: "bloquea", motivo: "copia_inconsistente" });
  });
  it("aprobación sin copia (mapa ausente): cierra como copia_inconsistente", () => {
    const x = e("aprobado");
    delete (x.m1!.aprobacion as { mapa?: unknown }).mapa;
    expect(decidirCompuertaM1(x)).toEqual({ accion: "bloquea", motivo: "copia_inconsistente" });
  });
});

describe("coincideCompuertaM1 (re-lectura al escribir)", () => {
  it("capturó sin_m1 y sigue sin_m1: ok; si apareció un M1 (aprobado o no): no", () => {
    expect(coincideCompuertaM1(e("sin_m1"), null)).toEqual({ ok: true });
    expect(coincideCompuertaM1(e("sin_payload"), null)).toEqual({ ok: true });
    expect(coincideCompuertaM1(e("borrador"), null)).toEqual({ ok: false, motivo: "no_aprobado" });
    expect(coincideCompuertaM1(e("aprobado"), null)).toEqual({ ok: false, motivo: "no_aprobado" });
  });
  it("capturó una huella aprobada: ok solo si sigue aprobada con ESA huella", () => {
    expect(coincideCompuertaM1(e("aprobado"), huellaGate())).toEqual({ ok: true });
    expect(coincideCompuertaM1(e("reabierto"), huellaGate())).toEqual({ ok: false, motivo: "no_aprobado" });
    // editado y vuelto a aprobar con OTRO contenido: otra huella
    expect(coincideCompuertaM1(e("aprobado", {}, otroMapaGate), huellaGate())).toEqual({ ok: false, motivo: "no_aprobado" });
    expect(coincideCompuertaM1(e("sin_m1"), huellaGate())).toEqual({ ok: false, motivo: "no_aprobado" });
  });
  it("reabierto y aprobado de nuevo con el MISMO contenido: la huella es la misma y pasa", () => {
    expect(coincideCompuertaM1(e("aprobado", { otro: 1 }), huellaGate())).toEqual({ ok: true });
  });
  it("copia inconsistente al re-leer: bloquea con ese motivo", () => {
    expect(coincideCompuertaM1(e("copia_alterada"), huellaGate())).toEqual({ ok: false, motivo: "copia_inconsistente" });
  });
});
