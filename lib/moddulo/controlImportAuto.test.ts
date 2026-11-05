// T5b — la guarda del efecto C7 y del «Reintentar»: un vuelo, sin bucle, calla tras «Cerrar».
import { describe, expect, it } from "vitest";
import { crearControlImportAuto } from "./controlImportAuto";

describe("crearControlImportAuto", () => {
  it("sin id en la URL no dispara", () => {
    expect(crearControlImportAuto().puedeDispararAuto(null)).toBe(false);
    expect(crearControlImportAuto().puedeDispararAuto("")).toBe(false);
  });
  it("con un id y nada en vuelo, dispara; con un vuelo en curso, no (ni el efecto ni un segundo clic)", () => {
    const c = crearControlImportAuto();
    expect(c.puedeDispararAuto("a1")).toBe(true);
    expect(c.comenzar()).toBe(true);
    expect(c.enVuelo()).toBe(true);
    expect(c.puedeDispararAuto("a1")).toBe(false);
    expect(c.comenzar()).toBe(false); // doble clic en «Reintentar»: la segunda no arranca
  });
  it("tras un FALLO el efecto no repite el mismo id aunque se vuelva a ejecutar muchas veces (sin bucle)", () => {
    const c = crearControlImportAuto();
    let llamadas = 0;
    const efecto = (id: string | null) => { if (c.puedeDispararAuto(id) && c.comenzar()) { llamadas++; c.terminar(id as string, false); } };
    for (let i = 0; i < 20; i++) efecto("a1"); // el efecto se re-ejecuta por cambios de otras dependencias
    expect(llamadas).toBe(1);
  });
  it("«Reintentar» después de un fallo SÍ arranca (usa comenzar, no la regla del efecto) y solo una vez", () => {
    const c = crearControlImportAuto();
    expect(c.comenzar()).toBe(true); c.terminar("a1", false);
    expect(c.puedeDispararAuto("a1")).toBe(false);
    expect(c.comenzar()).toBe(true);   // clic
    expect(c.comenzar()).toBe(false);  // segundo clic mientras vuela
    c.terminar("a1", true);            // éxito: ya no queda marcado
    expect(c.puedeDispararAuto("a1")).toBe(true);
  });
  it("«Cerrar»: el efecto no vuelve a disparar ese id aunque el parámetro tarde en salir de la URL; otro id sí", () => {
    const c = crearControlImportAuto();
    expect(c.comenzar()).toBe(true); c.terminar("a1", false);
    c.cerrar("a1");
    for (let i = 0; i < 5; i++) expect(c.puedeDispararAuto("a1")).toBe(false);
    expect(c.puedeDispararAuto("a2")).toBe(true);
  });
  it("un conflicto (abre el modal) se marca como no-éxito: el efecto no lo vuelve a abrir", () => {
    const c = crearControlImportAuto();
    expect(c.comenzar()).toBe(true); c.terminar("a1", false);
    expect(c.puedeDispararAuto("a1")).toBe(false);
  });
});
