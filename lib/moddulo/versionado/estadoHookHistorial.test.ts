// C4a-2b — reducer puro del hook del panel y ruta → fase. Sin DOM.
import { describe, expect, it } from "vitest";
import type { FilaHistorial, RespuestaHistorial } from "@/lib/versionado/lectura";
import { ESTADO_INICIAL, entradaDePanel, faseDeRuta, reducirEstadoHistorial as r, type AccionHistorial, type EstadoHistorial } from "./estadoHookHistorial";
import { decidirEstadoPanel } from "./estadoPanelHistorial";

const fila = (n: number, over: Partial<FilaHistorial> = {}): FilaHistorial => ({
  revisionN: n, eventoId: `e${n}`, en: "2026-11-10T15:00:00.000Z", quien: "Raúl", tipo: "ajuste_manual", titulo: "t", detalleTexto: null,
  artefactos: [], esVigente: false, derivaAntes: false, posteriorALaLectura: false, recuperable: "completo", ...over,
});
const resp = (o: Partial<RespuestaHistorial> = {}): RespuestaHistorial => ({
  fase: "exploracion", puedeVolver: false, totalCambios: 0, vigente: null, filas: [], siguienteCursor: null, avisos: [], faltantes: [], faltantesTotal: 0, ...o,
});
const seq = (...a: AccionHistorial[]) => a.reduce(r, ESTADO_INICIAL);
const abierto = (fase: "proposito" | "exploracion" | "investigacion" = "exploracion") => seq({ tipo: "abrir", fase, proyectoId: "p1" });
const conPagina = (o: Partial<RespuestaHistorial> = {}, fase: "proposito" | "exploracion" | "investigacion" = "exploracion") => {
  const e = abierto(fase);
  return r(e, { tipo: "respuesta", id: e.pendiente!.id, fase, peticion: "primera", respuesta: resp({ fase, ...o }) });
};

describe("faseDeRuta: segmento EXACTO", () => {
  it("las tres fases con historial", () => {
    for (const f of ["proposito", "exploracion", "investigacion"]) expect(faseDeRuta(`/moddulo/proyecto/abc/${f}`)).toBe(f);
    expect(faseDeRuta("/moddulo/proyecto/abc/exploracion/")).toBe("exploracion");
  });
  it("las demás fases, rutas ajenas y subrutas → null (nunca includes)", () => {
    for (const p of ["/moddulo/proyecto/abc/diagnostico", "/moddulo/proyecto/abc/evaluacion", "/moddulo/proyecto/abc", "/moddulo", "/moddulo/proyecto/abc/exploracion/x",
      "/moddulo/proyecto/exploracion/evaluacion", "/blog/exploracion", "/otra/proyecto/abc/exploracion", "/moddulo/proyecto/abc/exploracionX", "/moddulo/proyecto/abc/proposito-extra",
      "", "/", "/moddulo/proyecto/investigacion/diagnostico"]) expect(faseDeRuta(p), p).toBeNull();
    for (const v of [null, undefined, 7]) expect(faseDeRuta(v as never)).toBeNull();
  });
});

describe("abrir / cerrar / cambio de fase", () => {
  it("cerrado: 0 peticiones", () => {
    expect(ESTADO_INICIAL.pendiente).toBeNull();
    const e = seq({ tipo: "cambio_fase", fase: "exploracion" }, { tipo: "cerrar" });
    expect(e.pendiente).toBeNull();
    expect(e.abierto).toBe(false);
  });
  it("abrir pide la 1.ª página (sin deriva) y numera la petición", () => {
    const e = abierto("investigacion");
    expect(e).toMatchObject({ abierto: true, cargando: true, vigenteId: 1, pendiente: { id: 1, tipo: "primera", fase: "investigacion", proyectoId: "p1", conDeriva: false } });
  });
  it("abrir dos veces lo mismo no repite la petición", () => {
    const e = abierto();
    expect(r(e, { tipo: "abrir", fase: "exploracion", proyectoId: "p1" })).toBe(e);
  });
  it("cerrar limpia todo e invalida la petición en vuelo; su respuesta se descarta", () => {
    const e = abierto();
    const c = r(e, { tipo: "cerrar" });
    expect(c).toMatchObject({ abierto: false, filas: [], pendiente: null, vigenteId: null, cargando: false });
    expect(r(c, { tipo: "respuesta", id: e.pendiente!.id, fase: "exploracion", peticion: "primera", respuesta: resp({ totalCambios: 1, filas: [fila(1)] }) })).toBe(c);
  });
  it("cambiar de fase con el panel abierto lo cierra y limpia", () => {
    const e = conPagina({ totalCambios: 2, filas: [fila(2), fila(1)] });
    const c = r(e, { tipo: "cambio_fase", fase: "investigacion" });
    expect(c).toMatchObject({ abierto: false, fase: "investigacion", filas: [], primera: null, pendiente: null });
  });
  it("la misma fase no hace nada", () => {
    const e = conPagina();
    expect(r(e, { tipo: "cambio_fase", fase: "exploracion" })).toBe(e);
  });
  it("una respuesta de OTRA fase se descarta aunque lleve el número vigente", () => {
    const e = abierto();
    expect(r(e, { tipo: "respuesta", id: e.pendiente!.id, fase: "investigacion", peticion: "primera", respuesta: resp({ fase: "investigacion" }) })).toBe(e);
  });
  it("una respuesta con número anterior se descarta (reabrir tras cerrar)", () => {
    const e1 = abierto();
    const e2 = seq({ tipo: "abrir", fase: "exploracion", proyectoId: "p1" }, { tipo: "cerrar" }, { tipo: "abrir", fase: "exploracion", proyectoId: "p1" });
    expect(e2.vigenteId).not.toBe(e1.vigenteId);
    expect(r(e2, { tipo: "respuesta", id: e1.pendiente!.id, fase: "exploracion", peticion: "primera", respuesta: resp({ totalCambios: 9, filas: [fila(9)] }) })).toBe(e2);
  });
});

describe("1.ª página y «Cargar más»", () => {
  it("la 1.ª página fija filas, vigente, total y cursor", () => {
    const e = conPagina({ totalCambios: 30, filas: [fila(30, { esVigente: true }), fila(29)], siguienteCursor: 29, avisos: [{ codigo: "retencion_parcial", texto: "x" }] });
    expect(e).toMatchObject({ cargando: false, totalCambios: 30, siguienteCursor: 29, pendiente: null, vigenteId: null });
    expect(e.filas.map((f) => f.revisionN)).toEqual([30, 29]);
    expect(e.avisos).toHaveLength(1);
  });
  it("«Cargar más» pide con el cursor y, al llegar, fusiona sin duplicados y NO toca vigente ni total", () => {
    const vigente = { revisionN: 30, artefactos: [] };
    const e0 = conPagina({ totalCambios: 30, vigente, filas: [fila(30, { esVigente: true }), fila(29)], siguienteCursor: 29 });
    const e1 = r(e0, { tipo: "cargar_mas" });
    expect(e1).toMatchObject({ cargandoMas: true, pendiente: { tipo: "mas", cursor: 29 } });
    const e2 = r(e1, { tipo: "respuesta", id: e1.pendiente!.id, fase: "exploracion", peticion: "mas",
      respuesta: resp({ totalCambios: 99, vigente: null, filas: [fila(29), fila(28, { esVigente: true })], siguienteCursor: null, avisos: [{ codigo: "retencion_parcial", texto: "x" }] }) });
    expect(e2.filas.map((f) => f.revisionN)).toEqual([30, 29, 28]);
    expect(e2.primera?.vigente).toBe(vigente);
    expect(e2.totalCambios).toBe(30);
    expect(e2.siguienteCursor).toBeNull();
    expect(e2.avisos).toHaveLength(1);
    expect(e2.cargandoMas).toBe(false);
  });
  it("sin cursor, o con una petición en vuelo, «Cargar más» no hace nada", () => {
    const sin = conPagina({ totalCambios: 1, filas: [fila(1)] });
    expect(r(sin, { tipo: "cargar_mas" })).toBe(sin);
    const e = r(conPagina({ totalCambios: 30, filas: [fila(30)], siguienteCursor: 29 }), { tipo: "cargar_mas" });
    expect(r(e, { tipo: "cargar_mas" })).toBe(e);
    expect(r(e, { tipo: "actualizar" })).toBe(e);
  });
  it("una respuesta de «Cargar más» tardía (tras actualizar) se descarta", () => {
    const e0 = conPagina({ totalCambios: 30, filas: [fila(30)], siguienteCursor: 29 });
    const mas = r(e0, { tipo: "cargar_mas" });
    const cerrado = r(mas, { tipo: "cerrar" });
    expect(r(cerrado, { tipo: "respuesta", id: mas.pendiente!.id, fase: "exploracion", peticion: "mas", respuesta: resp({ filas: [fila(29)] }) })).toBe(cerrado);
  });
});

describe("errores con filas ya cargadas (no se borran)", () => {
  it("falla «Cargar más»: errorAlCargarMas, filas intactas, «Reintentar» vuelve a pedir el mismo cursor", () => {
    const e0 = conPagina({ totalCambios: 30, filas: [fila(30), fila(29)], siguienteCursor: 29 });
    const e1 = r(e0, { tipo: "cargar_mas" });
    const e2 = r(e1, { tipo: "error", id: e1.pendiente!.id, fase: "exploracion", peticion: "mas", mensaje: "No se pudo cargar el historial." });
    expect(e2).toMatchObject({ errorAlCargarMas: "No se pudo cargar el historial.", cargandoMas: false, siguienteCursor: 29 });
    expect(e2.filas).toHaveLength(2);
    const e3 = r(e2, { tipo: "cargar_mas" });
    expect(e3).toMatchObject({ cargandoMas: true, errorAlCargarMas: null, pendiente: { cursor: 29 } });
    const panel = decidirEstadoPanel(entradaDePanel(e2));
    expect(panel).toMatchObject({ tipo: "filas", errorAlCargarMas: "No se pudo cargar el historial.", puedeCargarMas: true });
  });
  it("falla «Actualizar» con filas: errorAlActualizar y las filas anteriores se conservan", () => {
    const e0 = conPagina({ totalCambios: 2, filas: [fila(2), fila(1)] });
    const e1 = r(e0, { tipo: "actualizar" });
    expect(e1).toMatchObject({ actualizando: true, cargando: false });
    const e2 = r(e1, { tipo: "error", id: e1.pendiente!.id, fase: "exploracion", peticion: "primera", mensaje: "No se pudo cargar el historial." });
    expect(e2).toMatchObject({ errorAlActualizar: "No se pudo cargar el historial.", actualizando: false });
    expect(e2.filas).toHaveLength(2);
  });
  it("falla la 1.ª página sin filas: mensajeError (el panel muestra el error con «Reintentar»)", () => {
    const e0 = abierto();
    const e1 = r(e0, { tipo: "error", id: e0.pendiente!.id, fase: "exploracion", peticion: "primera", mensaje: "No se pudo cargar el historial." });
    expect(decidirEstadoPanel(entradaDePanel(e1))).toMatchObject({ tipo: "error", reintentable: true });
    const e2 = r(e1, { tipo: "actualizar" });
    expect(e2).toMatchObject({ cargando: true, mensajeError: null, actualizando: false });
  });
  it("un error de una petición anterior se descarta", () => {
    const e0 = abierto();
    const c = r(e0, { tipo: "cerrar" });
    expect(r(c, { tipo: "error", id: e0.pendiente!.id, fase: "exploracion", peticion: "primera", mensaje: "x" })).toBe(c);
  });
});

describe("«Actualizar» y deriva de F3", () => {
  it("actualizar reemplaza la lista y la vigente (no fusiona)", () => {
    const e0 = conPagina({ totalCambios: 2, filas: [fila(2, { esVigente: true }), fila(1)] });
    const e1 = r(e0, { tipo: "actualizar" });
    const e2 = r(e1, { tipo: "respuesta", id: e1.pendiente!.id, fase: "exploracion", peticion: "primera", respuesta: resp({ totalCambios: 3, filas: [fila(3, { esVigente: true }), fila(2)] }) });
    expect(e2.filas.map((f) => f.revisionN)).toEqual([3, 2]);
    expect(e2.totalCambios).toBe(3);
  });
  it("comprobar deriva solo existe en F3 y desde entonces cada recarga la pide", () => {
    const f2 = conPagina({ totalCambios: 1, filas: [fila(1)] });
    expect(r(f2, { tipo: "comprobar_deriva" })).toBe(f2);
    const f3 = conPagina({ totalCambios: 1, filas: [fila(1)] }, "investigacion");
    expect(f3.derivaF3Pedida).toBe(false);
    const c = r(f3, { tipo: "comprobar_deriva" });
    expect(c).toMatchObject({ derivaF3Pedida: true, actualizando: true, pendiente: { conDeriva: true } });
    const listo = r(c, { tipo: "respuesta", id: c.pendiente!.id, fase: "investigacion", peticion: "primera", respuesta: resp({ fase: "investigacion", totalCambios: 1, filas: [fila(1)] }) });
    expect(r(listo, { tipo: "actualizar" }).pendiente).toMatchObject({ conDeriva: true });
  });
  it("F1 y F2 nunca piden deriva", () => {
    const e = conPagina({ totalCambios: 1, filas: [fila(1)] });
    expect(r(e, { tipo: "actualizar" }).pendiente?.conDeriva).toBe(false);
  });
  it("cerrar y reabrir F3 olvida la comprobación de deriva", () => {
    const c = r(conPagina({ totalCambios: 1, filas: [fila(1)] }, "investigacion"), { tipo: "comprobar_deriva" });
    const reab = seq({ tipo: "abrir", fase: "investigacion", proyectoId: "p1" });
    expect(c.derivaF3Pedida).toBe(true);
    expect(r(r(c, { tipo: "cerrar" }), { tipo: "abrir", fase: "investigacion", proyectoId: "p1" }).derivaF3Pedida).toBe(false);
    expect(reab.pendiente?.conDeriva).toBe(false);
  });
});

describe("abrir sobre otro proyecto con el panel abierto", () => {
  it("empieza de cero: no hereda filas ni la comprobación de deriva de F3", () => {
    const c = r(conPagina({ totalCambios: 1, filas: [fila(1)] }, "investigacion"), { tipo: "comprobar_deriva" });
    const o = r(c, { tipo: "abrir", fase: "investigacion", proyectoId: "otro" });
    expect(o).toMatchObject({ proyectoId: "otro", derivaF3Pedida: false, filas: [], cargando: true, pendiente: { conDeriva: false, proyectoId: "otro" } });
  });
});

describe("numeración de peticiones", () => {
  it("cada acción que pide datos suma 1 y solo la última es vigente", () => {
    const e0 = abierto();
    const e1 = r(r(e0, { tipo: "respuesta", id: 1, fase: "exploracion", peticion: "primera", respuesta: resp({ totalCambios: 30, filas: [fila(30)], siguienteCursor: 29 }) }), { tipo: "cargar_mas" });
    expect(e1.vigenteId).toBe(2);
    expect(e1.contador).toBe(2);
  });
});
