// C4a-2a — lógica PURA del panel «Historial»: estado de la pantalla, fusión de páginas, cambios sin mostrar (H-V54),
// marcas de fila, deriva de F3 y trampa de foco propia (H-V53). Sin DOM: nada de esto necesita navegador.
import { describe, expect, it } from "vitest";
import type { FilaHistorial, RespuestaHistorial } from "@/lib/versionado/lectura";
import { TEXTO_AVISO, TEXTO_FASE_SIN_HISTORIAL } from "./textosHistorial";
import { TEXTO_HISTORIAL_INDICE_NO_LISTO } from "@/lib/moddulo/guardadoHonesto";
import {
  TEXTO_CARGANDO_HISTORIAL,
  TEXTO_MARCA,
  cambiosSinMostrar,
  debePedirDeriva,
  decidirEstadoPanel,
  fusionarPagina,
  lecturasDePeticion,
  marcasDeFila,
  siguienteEnCiclo,
  textoEstadoFinal,
  type EntradaEstadoPanel,
} from "./estadoPanelHistorial";

const fila = (n: number, over: Partial<FilaHistorial> = {}): FilaHistorial => ({
  revisionN: n, eventoId: `e${n}`, en: "2026-11-10T15:00:00.000Z", quien: "Raúl", tipo: "ajuste_manual",
  titulo: "Aprobó el análisis de la Fase 2", detalleTexto: null, artefactos: [], esVigente: false, derivaAntes: false,
  posteriorALaLectura: false, recuperable: "completo", ...over,
});
const resp = (over: Partial<RespuestaHistorial> = {}): RespuestaHistorial => ({
  fase: "exploracion", totalCambios: 0, vigente: null, filas: [], siguienteCursor: null, avisos: [], faltantes: [], faltantesTotal: 0, ...over,
});
const entrada = (over: Partial<EntradaEstadoPanel> = {}): EntradaEstadoPanel => ({
  cargando: false, mensajeError: null, filas: [], respuesta: null, siguienteCursor: null, totalCambios: 0, ...over,
});

describe("decidirEstadoPanel", () => {
  it("sin respuesta todavía → cargando (con el texto de proceso)", () => {
    expect(decidirEstadoPanel(entrada({ cargando: true }))).toEqual({ tipo: "cargando", texto: TEXTO_CARGANDO_HISTORIAL });
    expect(decidirEstadoPanel(entrada())).toMatchObject({ tipo: "cargando" });
  });
  it("fase sin historial (total 0, sin avisos, sin faltantes) → vacío con el texto existente", () => {
    expect(decidirEstadoPanel(entrada({ respuesta: resp() }))).toEqual({ tipo: "vacio", texto: TEXTO_FASE_SIN_HISTORIAL });
  });
  it("total 0 pero con aviso (eventos sin puntero) NO es «vacío»: se muestra el aviso", () => {
    const r = resp({ avisos: [{ codigo: "historial_sin_puntero", texto: TEXTO_AVISO.historial_sin_puntero }] });
    expect(decidirEstadoPanel(entrada({ respuesta: r }))).toMatchObject({ tipo: "filas", avisos: [TEXTO_AVISO.historial_sin_puntero] });
  });
  it("error de lectura sin filas → error reintentable con el texto recibido", () => {
    const s = decidirEstadoPanel(entrada({ mensajeError: "No se pudo cargar el historial. Vuelve a intentarlo en unos minutos." }));
    expect(s).toEqual({ tipo: "error", texto: "No se pudo cargar el historial. Vuelve a intentarlo en unos minutos.", reintentable: true });
  });
  it("índice en construcción se distingue del error genérico", () => {
    expect(decidirEstadoPanel(entrada({ mensajeError: TEXTO_HISTORIAL_INDICE_NO_LISTO }))).toEqual({
      tipo: "indice_no_listo", texto: TEXTO_HISTORIAL_INDICE_NO_LISTO, reintentable: true,
    });
  });
  it("un error con filas ya cargadas NO las borra", () => {
    const s = decidirEstadoPanel(entrada({ mensajeError: "No se pudo cargar el historial.", filas: [fila(2)], respuesta: resp({ totalCambios: 2 }), totalCambios: 2 }));
    expect(s.tipo).toBe("filas");
  });
  it("con filas: avisos sin repetir, 'Cargar más' según el cursor, sin estado final si aún hay páginas", () => {
    const r = resp({
      totalCambios: 30,
      avisos: [{ codigo: "retencion_parcial", texto: TEXTO_AVISO.retencion_parcial }, { codigo: "retencion_parcial", texto: TEXTO_AVISO.retencion_parcial }],
    });
    const s = decidirEstadoPanel(entrada({ filas: [fila(30), fila(29)], respuesta: r, siguienteCursor: 29, totalCambios: 30 }));
    expect(s).toMatchObject({ tipo: "filas", puedeCargarMas: true, estadoFinal: null, avisos: [TEXTO_AVISO.retencion_parcial] });
  });
  it("fila posterior a la lectura o aviso cambio_durante_lectura → hayCambioNuevo", () => {
    const a = decidirEstadoPanel(entrada({ filas: [fila(4, { posteriorALaLectura: true }), fila(3)], respuesta: resp({ totalCambios: 3 }), totalCambios: 3 }));
    expect(a).toMatchObject({ tipo: "filas", hayCambioNuevo: true });
    const b = decidirEstadoPanel(entrada({ filas: [fila(3)], respuesta: resp({ totalCambios: 3, avisos: [{ codigo: "cambio_durante_lectura", texto: TEXTO_AVISO.cambio_durante_lectura }] }), totalCambios: 3 }));
    expect(b).toMatchObject({ hayCambioNuevo: true });
    const c = decidirEstadoPanel(entrada({ filas: [fila(3)], respuesta: resp({ totalCambios: 3 }), totalCambios: 3 }));
    expect(c).toMatchObject({ hayCambioNuevo: false });
  });
  it("sin más páginas y con cambios que faltan → estado final EXPLÍCITO (H-V54), nunca un panel mudo", () => {
    const s = decidirEstadoPanel(entrada({ filas: [], respuesta: resp({ totalCambios: 20, avisos: [{ codigo: "eventos_incompletos", texto: TEXTO_AVISO.eventos_incompletos }] }), siguienteCursor: null, totalCambios: 20 }));
    expect(s).toMatchObject({
      tipo: "filas", puedeCargarMas: false,
      estadoFinal: "Algunos cambios antiguos no se pueden mostrar. Faltan 20 de 20.",
    });
  });
  it("con todo cargado y sin faltantes no hay estado final", () => {
    const s = decidirEstadoPanel(entrada({ filas: [fila(2), fila(1)], respuesta: resp({ totalCambios: 2 }), totalCambios: 2 }));
    expect(s).toMatchObject({ estadoFinal: null, puedeCargarMas: false });
  });
});

describe("fusionarPagina (sin duplicados)", () => {
  it("une y ordena descendente por revisionN", () => {
    expect(fusionarPagina([fila(5), fila(4)], [fila(3), fila(2)]).map((f) => f.revisionN)).toEqual([5, 4, 3, 2]);
  });
  it("una revisión repetida cuenta una vez y gana la más reciente", () => {
    const r = fusionarPagina([fila(5, { titulo: "viejo" })], [fila(5, { titulo: "nuevo" }), fila(4)]);
    expect(r.map((f) => f.revisionN)).toEqual([5, 4]);
    expect(r[0].titulo).toBe("nuevo");
  });
  it("no modifica sus argumentos y tolera listas vacías", () => {
    const a = [fila(2)];
    const b = [fila(1)];
    fusionarPagina(a, b);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(fusionarPagina([], [])).toEqual([]);
  });
});

describe("cambiosSinMostrar (N de «Faltan N de T»)", () => {
  it("T − revisiones únicas cargadas", () => {
    expect(cambiosSinMostrar(10, [fila(10), fila(9), fila(8)])).toBe(7);
  });
  it("una revisión repetida cuenta una sola vez", () => {
    expect(cambiosSinMostrar(10, [fila(10), fila(10), fila(9)])).toBe(8);
  });
  it("las filas posteriores a la lectura NO restan (no están dentro de T)", () => {
    expect(cambiosSinMostrar(3, [fila(4, { posteriorALaLectura: true }), fila(3), fila(2)])).toBe(1);
  });
  it("nunca es negativo y T inválido o 0 da 0", () => {
    expect(cambiosSinMostrar(2, [fila(3), fila(2), fila(1)])).toBe(0);
    for (const t of [0, -1, 1.5, NaN]) expect(cambiosSinMostrar(t, [])).toBe(0);
  });
  it("incluye huecos intermedios (no solo los más antiguos)", () => {
    expect(cambiosSinMostrar(6, [fila(6), fila(5), fila(3), fila(2), fila(1)])).toBe(1);
  });
  it("el texto reutiliza el aviso existente y suma el conteo", () => {
    expect(textoEstadoFinal(3, 10)).toBe(`${TEXTO_AVISO.eventos_incompletos} Faltan 3 de 10.`);
  });
});

describe("marcasDeFila", () => {
  it("vigente: «★ Versión actual»", () => {
    expect(marcasDeFila(fila(3, { esVigente: true })).map((m) => m.clave)).toEqual(["vigente"]);
    expect(TEXTO_MARCA.vigente).toBe("★ Versión actual");
  });
  it("una fila posterior a la lectura NUNCA es «actual» aunque venga con esVigente", () => {
    expect(marcasDeFila(fila(9, { esVigente: true, posteriorALaLectura: true })).map((m) => m.clave)).toEqual(["cambio_nuevo"]);
  });
  it("deriva y conservación (la versión previa al historial no es una fila: sin marca propia)", () => {
    expect(marcasDeFila(fila(1, { tipo: "previo_sin_historial" }))).toEqual([]);
    expect(marcasDeFila(fila(2, { derivaAntes: true })).map((m) => m.clave)).toEqual(["deriva_antes"]);
    expect(marcasDeFila(fila(2, { recuperable: "parcial" })).map((m) => m.clave)).toEqual(["parcial"]);
    expect(marcasDeFila(fila(2, { recuperable: "no" })).map((m) => m.clave)).toEqual(["no_conservada"]);
  });
  it("orden fijo cuando hay varias", () => {
    const m = marcasDeFila(fila(5, { esVigente: true, derivaAntes: true, recuperable: "parcial" }));
    expect(m.map((x) => x.clave)).toEqual(["vigente", "deriva_antes", "parcial"]);
  });
  it("ningún texto de marca usa siglas ni «Centinela» a secas", () => {
    for (const t of Object.values(TEXTO_MARCA)) {
      expect(t).not.toMatch(/\b(HEI|DIE|RDA|M[1-5]|PIP|XPCTO)\b/);
      expect(t).not.toMatch(/Centinela/);
    }
  });
});

describe("deriva de F3 y costo de lecturas", () => {
  it("F1 y F2 nunca piden deriva (el lector la calcula gratis); F3 solo si la persona lo pide", () => {
    for (const f of ["proposito", "exploracion"] as const) {
      expect(debePedirDeriva(f, true)).toBe(false);
      expect(debePedirDeriva(f, false)).toBe(false);
    }
    expect(debePedirDeriva("investigacion", false)).toBe(false);
    expect(debePedirDeriva("investigacion", true)).toBe(true);
  });
  it("lecturas: 1 sin puntero; 2 + K con puntero; + N resultados con deriva de F3", () => {
    expect(lecturasDePeticion({ eventosPedidos: 20, conPuntero: false })).toBe(1);
    expect(lecturasDePeticion({ eventosPedidos: 20, conPuntero: true })).toBe(22);
    expect(lecturasDePeticion({ eventosPedidos: 20, conPuntero: true, resultadosF3: 17 })).toBe(39);
  });
});

describe("siguienteEnCiclo: trampa de foco propia (recalcula los enfocables en cada Tab)", () => {
  const lista = ["cerrar", "actualizar", "f1", "cargar-mas"];
  it("Tab en el último vuelve al primero; Shift+Tab en el primero va al último", () => {
    expect(siguienteEnCiclo(lista, "cargar-mas", false)).toEqual({ prevenir: true, destino: "cerrar" });
    expect(siguienteEnCiclo(lista, "cerrar", true)).toEqual({ prevenir: true, destino: "cargar-mas" });
  });
  it("en el medio deja que el navegador siga su orden", () => {
    expect(siguienteEnCiclo(lista, "actualizar", false)).toEqual({ prevenir: false, destino: null });
    expect(siguienteEnCiclo(lista, "f1", true)).toEqual({ prevenir: false, destino: null });
  });
  it("foco fuera de la lista o en el contenedor: entra por el primero (Tab) o el último (Shift+Tab)", () => {
    expect(siguienteEnCiclo(lista, null, false)).toEqual({ prevenir: true, destino: "cerrar" });
    expect(siguienteEnCiclo(lista, null, true)).toEqual({ prevenir: true, destino: "cargar-mas" });
    expect(siguienteEnCiclo(lista, "afuera", false)).toEqual({ prevenir: true, destino: "cerrar" });
  });
  it("lista vacía: el foco se queda en el contenedor", () => {
    expect(siguienteEnCiclo([], null, false)).toEqual({ prevenir: true, destino: null });
    expect(siguienteEnCiclo([], "x", true)).toEqual({ prevenir: true, destino: null });
  });
  it("un solo enfocable: Tab y Shift+Tab se quedan en él", () => {
    expect(siguienteEnCiclo(["cerrar"], "cerrar", false)).toEqual({ prevenir: true, destino: "cerrar" });
    expect(siguienteEnCiclo(["cerrar"], "cerrar", true)).toEqual({ prevenir: true, destino: "cerrar" });
  });
  it("H-V53: el botón que aparece DESPUÉS entra en el ciclo porque la lista se recalcula en cada Tab", () => {
    // Al abrir, la lista no tiene «cargar-mas» (el último es «f1»); después de cargar aparece al final.
    expect(siguienteEnCiclo(["cerrar", "f1"], "f1", false)).toEqual({ prevenir: true, destino: "cerrar" });
    expect(siguienteEnCiclo(["cerrar", "f1", "cargar-mas"], "f1", false)).toEqual({ prevenir: false, destino: null });
    expect(siguienteEnCiclo(["cerrar", "f1", "cargar-mas"], "cargar-mas", false)).toEqual({ prevenir: true, destino: "cerrar" });
  });
});

// ---- C4a-2b: errores con filas, aviso del estado actual, foco ----
import { TEXTOS_PANEL, TEXTO_CAMBIO_SIN_REGISTRO, TEXTO_SIN_CAMBIO_SIN_REGISTRO, avisoDerivaVigente, dondeVaElFoco } from "./estadoPanelHistorial";

describe("decidirEstadoPanel: cargando más, actualizando y errores con filas", () => {
  const base = { filas: [fila(2), fila(1)], respuesta: resp({ totalCambios: 4 }), siguienteCursor: 1, totalCambios: 4 };
  it("sin los campos nuevos, valen false / null", () => {
    expect(decidirEstadoPanel(entrada(base))).toMatchObject({ cargandoMas: false, actualizando: false, errorAlCargarMas: null, errorAlActualizar: null });
  });
  it("cargandoMas y actualizando pasan tal cual, con las filas intactas", () => {
    const s = decidirEstadoPanel(entrada({ ...base, cargandoMas: true, actualizando: true }));
    expect(s).toMatchObject({ tipo: "filas", cargandoMas: true, actualizando: true });
    expect((s as { filas: unknown[] }).filas).toHaveLength(2);
  });
  it("el error de «Cargar más» viaja junto a las filas y deja «Cargar más» disponible", () => {
    expect(decidirEstadoPanel(entrada({ ...base, errorAlCargarMas: "No se pudo cargar el historial." }))).toMatchObject({
      tipo: "filas", errorAlCargarMas: "No se pudo cargar el historial.", puedeCargarMas: true,
    });
  });
  it("el error de «Actualizar» viaja aparte", () => {
    expect(decidirEstadoPanel(entrada({ ...base, errorAlActualizar: "No se pudo cargar el historial." }))).toMatchObject({ errorAlActualizar: "No se pudo cargar el historial.", errorAlCargarMas: null });
  });
});

describe("avisoDerivaVigente: el estado ACTUAL difiere de la última versión registrada", () => {
  const vig = (...d: (boolean | null)[]) => ({ vigente: { revisionN: 3, artefactos: d.map((x, i) => ({ nombre: `a${i}`, etiqueta: "x", versionVigenteId: "v", n: 1, derivaDetectada: x })) } });
  it("F1 y F2: avisa solo si hay cambio sin registro (sale sola)", () => {
    for (const f of ["proposito", "exploracion"] as const) {
      expect(avisoDerivaVigente(vig(true), f, false)).toEqual({ tipo: "cambio", texto: TEXTO_CAMBIO_SIN_REGISTRO });
      expect(avisoDerivaVigente(vig(false), f, false)).toBeNull();
    }
  });
  it("F3 sin pedirlo no dice nada, ni siquiera si el lector trajo true", () => {
    expect(avisoDerivaVigente(vig(true, false), "investigacion", false)).toBeNull();
    expect(avisoDerivaVigente(vig(null, null), "investigacion", false)).toBeNull();
  });
  it("F3 pedido: cambio → aviso; todo false → «se comprobó»; null (no comprobado) → nada", () => {
    expect(avisoDerivaVigente(vig(false, true), "investigacion", true)?.tipo).toBe("cambio");
    expect(avisoDerivaVigente(vig(false, false), "investigacion", true)).toEqual({ tipo: "sin_cambio", texto: TEXTO_SIN_CAMBIO_SIN_REGISTRO });
    expect(avisoDerivaVigente(vig(false, null), "investigacion", true)).toBeNull();
  });
  it("sin respuesta, sin vigente o sin artefactos → null", () => {
    expect(avisoDerivaVigente(null, "exploracion", false)).toBeNull();
    expect(avisoDerivaVigente({ vigente: null }, "exploracion", false)).toBeNull();
    expect(avisoDerivaVigente(vig(), "exploracion", false)).toBeNull();
  });
  it("el aviso es neutro: no atribuye el cambio a un tercero («alguien») y dice lo que pasó", () => {
    expect(TEXTO_CAMBIO_SIN_REGISTRO).toBe("Lo que ves hoy en esta fase es distinto de la última versión guardada en el historial: se hizo un cambio que no quedó registrado, y el historial no sabe quién lo hizo ni cuándo.");
    expect(TEXTO_CAMBIO_SIN_REGISTRO).not.toMatch(/alguien/i);
  });
  it("los textos no usan «deriva», siglas ni «Centinela» a secas", () => {
    for (const t of [TEXTO_CAMBIO_SIN_REGISTRO, TEXTO_SIN_CAMBIO_SIN_REGISTRO, TEXTOS_PANEL.ayudaComprobarDeriva, TEXTOS_PANEL.comprobarDeriva]) {
      expect(t).not.toMatch(/deriva|\b(HEI|DIE|RDA|M[1-5]|PIP)\b|Centinela|CONFIRMAR/i);
    }
  });
});

describe("dondeVaElFoco y textos del panel", () => {
  it("abrir y actualizar → título; cerrar → botón «Historial»", () => {
    expect(dondeVaElFoco("abrir")).toBe("titulo");
    expect(dondeVaElFoco("actualizado")).toBe("titulo");
    expect(dondeVaElFoco("cerrar")).toBe("boton_historial");
  });
  it("al empezar una carga el foco se queda en el diálogo; al terminar va al título (H-V65: nunca a body)", () => {
    expect(dondeVaElFoco("cargando_inicio")).toBe("dialogo");
    expect(dondeVaElFoco("cargado")).toBe("titulo");
  });
  it("tras «Cargar más» el foco vuelve al botón si hay más; si no, al título", () => {
    expect(dondeVaElFoco("cargado_mas", true)).toBe("cargar_mas");
    expect(dondeVaElFoco("cargado_mas", false)).toBe("titulo");
  });
  it("total en singular y plural", () => {
    expect(TEXTOS_PANEL.total(1)).toBe("1 cambio en esta fase");
    expect(TEXTOS_PANEL.total(45)).toBe("45 cambios en esta fase");
  });
  it("ningún texto fijo usa siglas internas ni «CONFIRMAR»", () => {
    for (const t of Object.values(TEXTOS_PANEL)) if (typeof t === "string") expect(t).not.toMatch(/\b(HEI|DIE|RDA|M[1-5]|PIP)\b|CONFIRMAR|Centinela/);
  });
});
