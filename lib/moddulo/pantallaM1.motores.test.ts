// Matriz del discriminador «¿los motores en pantalla son los del M1 actual?» (motoresGenerados) con los tres
// casos pedidos, calculando también lo que la pantalla decide con ello.
import { describe, expect, it } from "vitest";
import { motoresGeneradosParaPantalla, mostrarAvisoSinGenerar, pieM1, TEXTO_SIN_GENERAR } from "./pantallaM1";

const decidir = (i: { estado: Parameters<typeof motoresGeneradosParaPantalla>[0]["estado"]; sinGenerar: boolean; borrador: boolean; dvs: boolean; generando?: boolean }) => {
  const generados = motoresGeneradosParaPantalla({ estado: i.estado, motoresSinGenerarServidor: i.sinGenerar, hayBorrador: i.borrador, hayDvs: i.dvs });
  const aviso = mostrarAvisoSinGenerar({ estado: i.estado, motoresSinGenerarServidor: i.sinGenerar, motoresGenerados: generados, generando: !!i.generando, hayErrorGeneracion: false });
  const pie = pieM1({
    estado: i.estado, f2Cerrada: false, kind: "express", aprobadoEn: null, motoresSinGenerarServidor: i.sinGenerar, motoresGenerados: generados,
    dimensionesConCambios: [], aprobando: false, generando: !!i.generando,
  });
  return { generados, aviso, pie };
};

describe("motoresGeneradosParaPantalla — los tres casos", () => {
  it("(1) proyecto normal terminado: M1 aprobado, borrador promovido a dvs, generacion igual a la aprobación → sin avisos de «sin generar»", () => {
    const r = decidir({ estado: "aprobado", sinGenerar: false, borrador: false, dvs: true });
    expect(r.generados).toBe(true);
    expect(r.aviso).toBe(false);
    expect(r.pie.lineaGeneracion).toBeNull();
    expect(r.pie.reintentarGeneracion.visible).toBe(false);
  });
  it("(2) M1 nuevo aprobado sobre el dvs de un análisis anterior (el proyecto de los pescadores): «motores sin generar» y botón de reintentar", () => {
    const r = decidir({ estado: "aprobado", sinGenerar: true, borrador: false, dvs: true });
    expect(r.generados).toBe(false);
    expect(r.aviso).toBe(true);
    expect(r.pie.lineaGeneracion).toBe(TEXTO_SIN_GENERAR);
    expect(r.pie.reintentarGeneracion.visible).toBe(true);
  });
  it("(2b) mientras genera no se muestra el aviso; con el borrador ya en pantalla deja de estar «sin generar»", () => {
    expect(decidir({ estado: "aprobado", sinGenerar: true, borrador: false, dvs: true, generando: true }).aviso).toBe(false);
    expect(decidir({ estado: "aprobado", sinGenerar: true, borrador: true, dvs: true }).generados).toBe(true);
  });
  it("(3) proyecto anterior sin m1: la regla local de siempre (cualquier borrador o dvs cuenta)", () => {
    for (const estado of ["anterior", "sin_m1", "sin_m1_con_restos", null] as const) {
      expect(motoresGeneradosParaPantalla({ estado, motoresSinGenerarServidor: false, hayBorrador: false, hayDvs: true })).toBe(true);
      expect(motoresGeneradosParaPantalla({ estado, motoresSinGenerarServidor: false, hayBorrador: true, hayDvs: false })).toBe(true);
      expect(motoresGeneradosParaPantalla({ estado, motoresSinGenerarServidor: false, hayBorrador: false, hayDvs: false })).toBe(false);
    }
  });
  it("un M1 aprobado sin dvs ni borrador y sin generacion: sin generar (primer análisis)", () => {
    expect(decidir({ estado: "aprobado", sinGenerar: true, borrador: false, dvs: false }).aviso).toBe(true);
  });
});

import { debeGenerarTrasAprobar } from "./pantallaM1";
describe("debeGenerarTrasAprobar — al aprobar se dispara la generación", () => {
  it("(2) M1 nuevo sobre el dvs de un análisis anterior (sin borrador local): SÍ genera", () => {
    expect(debeGenerarTrasAprobar({ motoresSinGenerarServidor: true, hayBorradorLocal: false, motoresDescartados: false })).toBe(true);
  });
  it("con un borrador local vigente NO genera; si el servidor lo descartó, SÍ", () => {
    expect(debeGenerarTrasAprobar({ motoresSinGenerarServidor: true, hayBorradorLocal: true, motoresDescartados: false })).toBe(false);
    expect(debeGenerarTrasAprobar({ motoresSinGenerarServidor: true, hayBorradorLocal: true, motoresDescartados: true })).toBe(true);
  });
  it("(1) los motores ya son de este M1 (generacion = aprobación): NO genera", () => {
    expect(debeGenerarTrasAprobar({ motoresSinGenerarServidor: false, hayBorradorLocal: false, motoresDescartados: false })).toBe(false);
  });
  it("negativo: la regla anterior (el dvs previo contaba como «hay motores») no habría generado en el caso (2)", () => {
    const reglaAnterior = (sinGenerar: boolean, borrador: boolean, dvs: boolean) => sinGenerar && !(borrador || dvs);
    expect(reglaAnterior(true, false, true)).toBe(false); // el defecto
    expect(debeGenerarTrasAprobar({ motoresSinGenerarServidor: true, hayBorradorLocal: false, motoresDescartados: false })).toBe(true);
  });
});

import { zonaCentroMotores } from "./pantallaM1";
const base = {
  faseCompletada: false, hayDvs: false, hayBorrador: false, generando: false, hayErrorGeneracion: false, showReporte: false,
  reporteAnterior: false, motoresGeneradosDelM1: false, hayMensajeArea: false, avisoSinGenerar: false,
};
describe("zonaCentroMotores — el centro tras recargar", () => {
  it("ESTADO REAL del proyecto de pruebas tras generar y finalizar: M1 aprobado, sin borrador, dvs de este M1, fase abierta → «completo», NUNCA «sin generar»", () => {
    expect(zonaCentroMotores({ ...base, hayDvs: true, motoresGeneradosDelM1: true })).toBe("completo");
  });
  it("(2) dvs de un análisis anterior sobre un M1 nuevo aprobado: aviso «sin generar»", () => {
    expect(zonaCentroMotores({ ...base, hayDvs: true, motoresGeneradosDelM1: false, avisoSinGenerar: true })).toBe("sin_generar");
  });
  it("con borrador en pantalla (motores por aprobar): los motores, no la tarjeta de «completo»", () => {
    expect(zonaCentroMotores({ ...base, hayDvs: true, hayBorrador: true, motoresGeneradosDelM1: true })).toBe("motores");
  });
  it("generando o con error de generación: los motores (esqueleto o error con reintento), no «completo»", () => {
    expect(zonaCentroMotores({ ...base, hayDvs: true, generando: true, motoresGeneradosDelM1: true })).toBe("motores");
    expect(zonaCentroMotores({ ...base, hayDvs: true, hayErrorGeneracion: true, motoresGeneradosDelM1: true })).toBe("motores");
  });
  it("fase completada con dvs: «completo» como siempre (aunque haya borrador); con el reporte abierto o el reporte anterior no", () => {
    expect(zonaCentroMotores({ ...base, faseCompletada: true, hayDvs: true, hayBorrador: true })).toBe("completo");
    expect(zonaCentroMotores({ ...base, faseCompletada: true, hayDvs: true, showReporte: true })).toBe("motores");
    expect(zonaCentroMotores({ ...base, hayDvs: true, motoresGeneradosDelM1: true, reporteAnterior: true, hayMensajeArea: true })).toBe("mensaje");
  });
  it("(3) proyecto anterior sin m1 con dvs en fase abierta: «completo» (regla local: el dvs cuenta)", () => {
    expect(zonaCentroMotores({ ...base, hayDvs: true, motoresGeneradosDelM1: true })).toBe("completo");
  });
  it("sin dvs ni borrador, M1 aprobado sin generar: «sin generar»; sin aviso: motores (que dice «sin generar» con su botón)", () => {
    expect(zonaCentroMotores({ ...base, avisoSinGenerar: true })).toBe("sin_generar");
    expect(zonaCentroMotores(base)).toBe("motores");
  });
});
