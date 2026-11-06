// T7 C2 — el gate de origen en el cliente (todo puro): cómo se lee el 409, cómo se redacta el modal y cómo se
// comporta la importación automática por URL (?pest_analysis_id=) cuando ahora puede abrir ese modal.

import { describe, expect, it } from "vitest";
import { crearControlImportAuto } from "./controlImportAuto";
import { avisoOrigenVencido, decidirConfirmacionImport, esCodigoOrigen, leerConfirmacionImport, urlAlCancelarImport, urlSinParametro } from "./sondeoCandado";
import { estadoImpactoDesdePantalla, textoModalM1, type DatosPantallaM1 } from "./textosModalM1";
import { AVISO_ORIGEN_VENCIDO_IMPORT, AVISO_ORIGEN_VENCIDO_SIN_RAZONES, avisosDeOrigenParaModal, CONFIRMAR_ORIGEN, INTRO_CONFIRMAR_ORIGEN, TITULO_CONFIRMAR_ORIGEN } from "@/lib/centinela/pestel/textosOrigen";
import type { RazonImportabilidad } from "@/lib/centinela/pestel/importabilidad";
import type { RespuestaGuardado } from "./guardadoHonesto";

const RAZONES: RazonImportabilidad[] = [{ tipo: "no_aprobado", status: "PENDING_REVIEW" }, { tipo: "sesgos_sin_revisar", cantidad: 2 }];
const resp409 = (codigo: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status: 409, codigo });

describe("leerConfirmacionImport", () => {
  it("el gate de origen solo: las razones y la huella son del GATE; no hay líneas de pérdida ni huella H15", () => {
    const c = leerConfirmacionImport({ error: "origen_requiere_confirmacion", razones: RAZONES, huella: "h-origen", lineas: [] });
    expect(c).toEqual({ lineas: [], huella: null, origen: { razones: RAZONES, huella: "h-origen" } });
  });

  it("el candado H15 enriquecido: la huella H15 y la de origen viajan separadas (nunca se mezclan)", () => {
    const c = leerConfirmacionImport({ error: "reemplazo_requiere_confirmacion", lineas: ["Se perderá la aprobación del análisis."], huella: "h-15", razonesOrigen: RAZONES, huellaOrigen: "h-origen" });
    expect(c).toEqual({ lineas: ["Se perderá la aprobación del análisis."], huella: "h-15", origen: { razones: RAZONES, huella: "h-origen" } });
  });

  it("un 409 H15 sin razones de origen no inventa `origen`", () => {
    const c = leerConfirmacionImport({ error: "conflict", lineas: ["x"], huella: "h" });
    expect("origen" in c).toBe(false);
  });

  it("razones con forma inválida se descartan (no se muestra nada que no se pueda leer)", () => {
    expect("origen" in leerConfirmacionImport({ error: "origen_requiere_confirmacion", razones: [{ tipo: "otra" }], huella: "h" })).toBe(false);
    expect("origen" in leerConfirmacionImport({ error: "reemplazo_requiere_confirmacion", razonesOrigen: "x", huellaOrigen: "h" })).toBe(false);
  });

  it("esCodigoOrigen reconoce exactamente los dos códigos del gate", () => {
    expect(esCodigoOrigen("origen_requiere_confirmacion")).toBe(true);
    expect(esCodigoOrigen("origen_huella_vencida")).toBe(true);
    for (const c of ["conflict", "reemplazo_requiere_confirmacion", "fase_cerrada", undefined, null, 3]) expect(esCodigoOrigen(c)).toBe(false);
  });
});

describe("decidirConfirmacionImport con el gate de origen", () => {
  it("origen_requiere_confirmacion / origen_huella_vencida dentro del modal: se reconfirma con lo nuevo, nunca se cierra en silencio", () => {
    for (const codigo of ["origen_requiere_confirmacion", "origen_huella_vencida"]) {
      const d = decidirConfirmacionImport(resp409(codigo), { error: codigo, razones: RAZONES, huella: "h2", lineas: [] });
      expect(d.tipo).toBe("reconfirmar");
      if (d.tipo !== "reconfirmar") throw new Error("x");
      expect(d.origen).toEqual({ razones: RAZONES, huella: "h2" });
      expect(d.aviso).toContain("No se importó nada");
    }
  });

  it("origen_huella_vencida: el aviso exacto dice que no se importó nada y nombra el botón «Importar de todos modos»", () => {
    const d = decidirConfirmacionImport(resp409("origen_huella_vencida"), { error: "origen_huella_vencida", razones: RAZONES, huella: "h2", lineas: [] });
    if (d.tipo !== "reconfirmar") throw new Error("x");
    expect(d.aviso).toBe("El estado del análisis de Centinela cambió. No se importó nada: revisa lo que se muestra y confirma de nuevo con «Importar de todos modos».");
    expect(d.aviso).toBe(AVISO_ORIGEN_VENCIDO_IMPORT);
    expect(d.aviso).toContain(`«${CONFIRMAR_ORIGEN}»`);
  });

  it("si las razones nuevas no se pueden leer, el aviso no nombra un botón que no estará en pantalla (pero dice que no se importó nada)", () => {
    const d = decidirConfirmacionImport(resp409("origen_huella_vencida"), { error: "origen_huella_vencida", razones: [{ tipo: "otra" }], huella: "h2" });
    if (d.tipo !== "reconfirmar") throw new Error("x");
    expect(d.origen).toBeUndefined();
    expect(d.aviso).toBe(AVISO_ORIGEN_VENCIDO_SIN_RAZONES);
  });

  it("avisoOrigenVencido: con origen nombra el botón; sin origen no", () => {
    expect(avisoOrigenVencido({ razones: RAZONES, huella: "h" })).toBe(AVISO_ORIGEN_VENCIDO_IMPORT);
    expect(avisoOrigenVencido(undefined)).toBe(AVISO_ORIGEN_VENCIDO_SIN_RAZONES);
  });

  it("el 409 H15 con razones de origen conserva las líneas y trae el origen", () => {
    const d = decidirConfirmacionImport(resp409("reemplazo_huella_vencida"), { error: "reemplazo_huella_vencida", lineas: ["a"], huella: "h15", razonesOrigen: RAZONES, huellaOrigen: "ho" });
    if (d.tipo !== "reconfirmar") throw new Error("x");
    expect(d.lineas).toEqual(["a"]);
    expect(d.huella).toBe("h15");
    expect(d.origen?.huella).toBe("ho");
  });

  it("los demás rechazos no cambian (fase cerrada sigue siendo error, no reconfirmación)", () => {
    expect(decidirConfirmacionImport(resp409("fase_cerrada")).tipo).toBe("error");
  });
});

describe("textoModalM1(\"vincular\") con avisos de origen", () => {
  const datos = (o: Partial<DatosPantallaM1> = {}): DatosPantallaM1 => ({ estado: "borrador", aprobacionValida: false, dimensionesEditadas: [], totalDimensiones: 6, motoresAprobados: [], hayBorrador: false, hayDvs: false, ...o });
  const limpio = estadoImpactoDesdePantalla(datos({ estado: "sin_m1" }));
  const completo = estadoImpactoDesdePantalla(datos({ estado: "aprobado", aprobacionValida: true, motoresAprobados: ["M2"], hayBorrador: true }));
  const avisos = avisosDeOrigenParaModal(RAZONES, undefined, null);

  it("sin avisos el texto es EXACTAMENTE el de siempre (no cambia nada para quien no pasa por el gate)", () => {
    expect(textoModalM1("vincular", completo, { lineasServidor: ["l"] })).toEqual(textoModalM1("vincular", completo, { lineasServidor: ["l"], avisosOrigen: [] }));
    expect(textoModalM1("vincular", completo, {}).avisos).toBeUndefined();
  });

  it("solo el gate (nada que perder): pregunta por el origen, no por un reemplazo", () => {
    const t = textoModalM1("vincular", limpio, { lineasServidor: [], avisosOrigen: avisos });
    expect(t.titulo).toBe(TITULO_CONFIRMAR_ORIGEN);
    expect(t.confirmar).toBe(CONFIRMAR_ORIGEN);
    expect(t.lineas).toEqual([]);
    expect(t.cierre).toBeNull();
    expect(t.intro).toEqual(["Se importará el análisis de Centinela en este proyecto."]);
    expect(t.avisos).toEqual({ intro: INTRO_CONFIRMAR_ORIGEN, items: avisos });
  });

  it("con el nombre del análisis lo cita", () => {
    expect(textoModalM1("vincular", limpio, { lineasServidor: [], avisosOrigen: avisos, nombre: "Mi análisis" }).intro[0]).toBe("Se importará «Mi análisis» en este proyecto.");
  });

  it("con pérdida por H15 + gate: una sola confirmación que lista las dos cosas", () => {
    const t = textoModalM1("vincular", completo, { lineasServidor: ["Se perderá la aprobación del análisis."], avisosOrigen: avisos });
    expect(t.titulo).toBe("¿Reemplazar el análisis actual por el de Centinela?");
    expect(t.lineas).toEqual(["Se perderá la aprobación del análisis."]);
    expect(t.avisos?.items).toEqual(avisos);
    expect(t.confirmar).toBe(CONFIRMAR_ORIGEN);
  });

  it("el mismo análisis que cambió + gate conserva su título propio", () => {
    const t = textoModalM1("vincular", limpio, { lineasServidor: [], origenCambio: true, avisosOrigen: avisos });
    expect(t.titulo).toBe("¿Actualizar el análisis con los cambios de Centinela?");
    expect(t.avisos?.items).toEqual(avisos);
  });

  it("otras acciones ignoran los avisos de origen", () => {
    expect(textoModalM1("desvincular", completo, { avisosOrigen: avisos }).avisos).toBeUndefined();
  });
});

describe("importación por URL (?pest_analysis_id=) con el gate: cancelar no repite y «Cerrar» quita el parámetro", () => {
  const HREF = "http://local/moddulo/proyecto/p1/exploracion?pest_analysis_id=a1&fontana_sesion_id=s9#top";

  it("el gate abre el modal (conflicto): el efecto NO vuelve a disparar el mismo id mientras el modal decide", () => {
    const c = crearControlImportAuto();
    expect(c.puedeDispararAuto("a1")).toBe(true);
    expect(c.comenzar()).toBe(true);
    expect(c.puedeDispararAuto("a1")).toBe(false); // en vuelo
    c.terminar("a1", false); // el 409 del gate abre el modal: se marca como no exitoso
    expect(c.puedeDispararAuto("a1")).toBe(false); // el efecto, aunque se re-ejecute, no repite
    expect(c.puedeDispararAuto("a2")).toBe(true); // otro análisis sí
  });

  it("cancelar el modal quita el parámetro (el automático) y conserva los demás; F5 no volvería a preguntar", () => {
    const limpia = urlAlCancelarImport("sync", HREF);
    expect(limpia).toBe("/moddulo/proyecto/p1/exploracion?fontana_sesion_id=s9#top");
    expect(urlSinParametro(`http://local${limpia}`)).toBeNull(); // ya no lo trae
  });

  it("«Vincular de nuevo» (relink) no tiene parámetro que quitar", () => {
    expect(urlAlCancelarImport("relink", HREF)).toBeNull();
  });

  it("«Cerrar» la franja de error: el id queda ignorado por el efecto y el parámetro sale de la URL", () => {
    const c = crearControlImportAuto();
    c.comenzar();
    c.terminar("a1", false);
    c.cerrar("a1");
    expect(c.puedeDispararAuto("a1")).toBe(false);
    expect(urlAlCancelarImport("sync", HREF)).toBe("/moddulo/proyecto/p1/exploracion?fontana_sesion_id=s9#top");
  });

  it("confirmar con éxito libera el id (la importación quitó el parámetro por su cuenta)", () => {
    const c = crearControlImportAuto();
    c.comenzar();
    c.terminar("a1", false);
    c.comenzar();
    c.terminar("a1", true);
    expect(c.puedeDispararAuto("a1")).toBe(true);
  });

  it("un doble disparo (efecto + botón) abre un solo vuelo", () => {
    const c = crearControlImportAuto();
    expect(c.comenzar()).toBe(true);
    expect(c.comenzar()).toBe(false);
  });
});
