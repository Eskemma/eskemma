import { describe, expect, it } from "vitest";
import { TEXTOS_VOLVER, type RespuestaGuardado } from "@/lib/moddulo/guardadoHonesto";
import type { ArtefactoDeFila, FilaHistorial } from "@/lib/versionado/lectura";
import {
  claveBotonVolver, conPunto, cuerpoPeticionVolver, debeEnfocarTituloVista, destinosVolverDeFila, fechaTextoDeFila, dondeVuelveFocoVolver, ESTADO_VOLVER_INICIAL, ofreceConfirmar, ofreceVerHistorial,
  reducirEstadoVolver, TEXTOS_VISTA_VOLVER, type AccionVolver, type EstadoVolver, type ObjetivoVolver,
} from "./estadoVolver";

const art = (o: Partial<ArtefactoDeFila> = {}): ArtefactoDeFila => ({
  nombre: "f3Resultado:r1", etiqueta: "Resultado de investigación", versionId: "f3Resultado:r1__000002", vigente: false, recuperable: "completo", ...o,
});
const fila = (artefactos: ArtefactoDeFila[], o: Partial<FilaHistorial> = {}): FilaHistorial => ({
  revisionN: 3, eventoId: "e", en: "2026-11-20T10:00:00.000Z", quien: "Raúl", tipo: "ajuste_manual", titulo: "t", detalleTexto: null, artefactos,
  esVigente: false, derivaAntes: false, posteriorALaLectura: false, recuperable: "completo", ...o,
});

describe("destinosVolverDeFila: el botón se decide POR ARTEFACTO", () => {
  it("una versión no vigente, completa, de f3Resultado y con permiso → botón", () => {
    const d = destinosVolverDeFila(fila([art()]), true);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ resultadoId: "r1", versionId: "f3Resultado:r1__000002" });
  });
  it("sin puedeVolver → ninguno", () => expect(destinosVolverDeFila(fila([art()]), false)).toEqual([]));
  it("la versión vigente no lleva botón", () => expect(destinosVolverDeFila(fila([art({ vigente: true })]), true)).toEqual([]));
  it("`no` y `desconocido` no llevan botón; `parcial` del propio artefacto tampoco", () => {
    for (const r of ["no", "desconocido", "parcial"] as const) expect(destinosVolverDeFila(fila([art({ recuperable: r })]), true)).toEqual([]);
  });
  it("una fila `parcial` cuyo f3Resultado es `completo` SÍ lleva el botón (se decide por artefacto)", () => {
    const f = fila([art(), art({ nombre: "f3Asignacion:a1", versionId: "f3Asignacion:a1__000001", recuperable: "no" })], { recuperable: "parcial" });
    expect(destinosVolverDeFila(f, true).map((x) => x.resultadoId)).toEqual(["r1"]);
  });
  it("solo f3Resultado: asignaciones, cierres y otros no llevan botón", () => {
    const otros = [art({ nombre: "f3Asignacion:a1" }), art({ nombre: "cierre:investigacion" }), art({ nombre: "f2M1" })];
    expect(destinosVolverDeFila(fila(otros), true)).toEqual([]);
  });
  it("sin versionId o con id de resultado vacío → ninguno", () => {
    expect(destinosVolverDeFila(fila([art({ versionId: null })]), true)).toEqual([]);
    expect(destinosVolverDeFila(fila([art({ nombre: "f3Resultado:" })]), true)).toEqual([]);
  });
  it("dos resultados en la misma fila → un botón por cada uno", () => {
    const d = destinosVolverDeFila(fila([art(), art({ nombre: "f3Resultado:r2", versionId: "f3Resultado:r2__000001" })]), true);
    expect(d.map((x) => x.resultadoId)).toEqual(["r1", "r2"]);
  });
});

const OBJ: ObjetivoVolver = { resultadoId: "r1", versionId: "f3Resultado:r1__000002", fechaTexto: "12 de noviembre de 2026, 10:00" };
const resp = (status: number, codigo?: string, extra: Record<string, unknown> = {}): RespuestaGuardado =>
  ({ tipo: "respuesta", ok: status >= 200 && status < 300, status, ...(codigo ? { codigo } : {}), ...extra }) as RespuestaGuardado;
const RED: RespuestaGuardado = { tipo: "error_red" };
const PREGUNTA = { lineas: ["Este resultado está aprobado."], huella: "h1", nombre: "¿Qué pasa con X?" };
const aplicar = (e: EstadoVolver, ...as: AccionVolver[]) => as.reduce(reducirEstadoVolver, e);
const responder = (e: EstadoVolver, r: RespuestaGuardado, datos: Record<string, unknown> | null = null) =>
  reducirEstadoVolver(e, { tipo: "respuesta", id: e.vigenteId ?? -1, resp: r, datos });
const preguntando = () => aplicar(ESTADO_VOLVER_INICIAL, { tipo: "abrir", objetivo: OBJ });
const confirmando = () => responder(preguntando(), resp(409, "reemplazo_requiere_confirmacion"), PREGUNTA);
const volviendo = () => reducirEstadoVolver(confirmando(), { tipo: "confirmar" });

describe("flujo feliz", () => {
  it("abrir → preguntando con UNA petición sin confirmar", () => {
    const e = preguntando();
    expect(e.fase).toBe("preguntando");
    expect(e.pendiente).toMatchObject({ resultadoId: "r1", versionId: OBJ.versionId, confirmar: false });
    expect(e.pendiente?.huella).toBeUndefined();
  });
  it("409 de pregunta → confirmando con líneas, huella y nombre del servidor", () => {
    const e = confirmando();
    expect(e).toMatchObject({ fase: "confirmando", lineas: PREGUNTA.lineas, huella: "h1", nombre: PREGUNTA.nombre, avisoHuella: false, pendiente: null });
    expect(ofreceConfirmar(e)).toBe(true);
  });
  it("confirmar → volviendo, y la petición lleva la huella", () => {
    const e = volviendo();
    expect(e.fase).toBe("volviendo");
    expect(e.pendiente).toMatchObject({ confirmar: true, huella: "h1" });
    expect(cuerpoPeticionVolver("p1", e.pendiente!)).toEqual({
      projectId: "p1", resultadoId: "r1", versionId: OBJ.versionId, confirmarReemplazo: true, huella: "h1",
    });
  });
  it("la pregunta NO manda huella ni confirmación", () => {
    expect(cuerpoPeticionVolver("p1", preguntando().pendiente!)).toEqual({ projectId: "p1", resultadoId: "r1", versionId: OBJ.versionId });
  });
  it("200 tras confirmar → éxito con el efecto de avisar y recargar, que se consume una vez", () => {
    const e = responder(volviendo(), resp(200));
    expect(e).toMatchObject({ fase: "exito", efecto: "avisar_y_recargar", pendiente: null });
    expect(reducirEstadoVolver(e, { tipo: "efecto_hecho" }).efecto).toBeNull();
  });
  it("confirmar fuera de «confirmando» no hace nada", () => {
    expect(reducirEstadoVolver(preguntando(), { tipo: "confirmar" })).toEqual(preguntando());
    expect(reducirEstadoVolver(ESTADO_VOLVER_INICIAL, { tipo: "confirmar" })).toBe(ESTADO_VOLVER_INICIAL);
  });
});

describe("huella vencida", () => {
  it("vuelve a «confirmando» con las líneas y la huella NUEVAS y el aviso; confirmar de nuevo usa la huella nueva", () => {
    const e = responder(volviendo(), resp(409, "reemplazo_huella_vencida"), { lineas: ["Línea nueva"], huella: "h2" });
    expect(e).toMatchObject({ fase: "confirmando", lineas: ["Línea nueva"], huella: "h2", avisoHuella: true, nombre: PREGUNTA.nombre });
    expect(reducirEstadoVolver(e, { tipo: "confirmar" }).pendiente?.huella).toBe("h2");
    expect(TEXTOS_VISTA_VOLVER.avisoHuella).toBe(TEXTOS_VOLVER.huellaVencida);
  });
  it("sin cuerpo utilizable cae a error, sin ofrecer confirmar", () => {
    const e = responder(volviendo(), resp(409, "reemplazo_huella_vencida"), null);
    expect(e.fase).toBe("error");
    expect(ofreceConfirmar(e)).toBe(false);
  });
});

describe("bloqueo y sin cambios", () => {
  it("bloqueado: muestra el mensaje del servidor y no ofrece nada que reintentar", () => {
    const e = responder(preguntando(), resp(409, "reemplazo_bloqueado", { mensaje: "Ya se emitió el «Reporte F3»." }));
    expect(e).toMatchObject({ fase: "error", errorTipo: "bloqueado", mensajeError: "Ya se emitió el «Reporte F3»." });
    expect(ofreceConfirmar(e)).toBe(false);
    expect(ofreceVerHistorial(e)).toBe(false);
  });
  it("bloqueado sin mensaje usa el texto fijo", () => {
    expect(responder(preguntando(), resp(409, "reemplazo_bloqueado")).mensajeError).toBe(TEXTOS_VOLVER.bloqueado);
  });
  it("puede aparecer el bloqueo al confirmar (el Reporte salió entre medias)", () => {
    expect(responder(volviendo(), resp(409, "reemplazo_bloqueado")).errorTipo).toBe("bloqueado");
  });
  it("sin_cambios explica con el texto fijo", () => {
    const e = responder(preguntando(), resp(409, "sin_cambios"));
    expect(e).toMatchObject({ fase: "error", errorTipo: "sin_cambios", mensajeError: TEXTOS_VOLVER.sinCambios });
  });
});

describe("fallos ambiguos: nunca se reintenta a ciegas", () => {
  const ambiguos: [string, RespuestaGuardado][] = [
    ["red", RED], ["500 sin código", resp(500)], ["502", resp(502)], ["504", resp(504)], ["escritura incierta", resp(500, "reemplazo_escritura_incierta")],
  ];
  for (const [nombre, r] of ambiguos) {
    it(`${nombre} al confirmar → error ambiguo, texto de «abre el historial y revisa», sin confirmar y con «Ver el historial»`, () => {
      const e = responder(volviendo(), r);
      expect(e).toMatchObject({ fase: "error", errorTipo: "ambiguo", mensajeError: TEXTOS_VOLVER.ambiguo, pendiente: null });
      expect(ofreceConfirmar(e)).toBe(false);
      expect(ofreceVerHistorial(e)).toBe(true);
    });
  }
  it("historial_no_confirmado NO es ambiguo: el servidor afirma que no escribió", () => {
    const e = responder(volviendo(), resp(500, "historial_no_confirmado"));
    expect(e.errorTipo).toBe("otro");
    expect(e.mensajeError).toContain("sigue como estaba");
  });
  it("401, 403, 404 y version_no_restaurable llevan su texto y no ofrecen reintentar", () => {
    expect(responder(volviendo(), resp(401)).mensajeError).toBe(TEXTOS_VOLVER.sesion);
    expect(responder(volviendo(), resp(403)).mensajeError).toBe(TEXTOS_VOLVER.permiso);
    expect(responder(volviendo(), resp(404)).mensajeError).toBe(TEXTOS_VOLVER.noEncontrado);
    const e = responder(volviendo(), resp(409, "version_no_restaurable"));
    expect(e.mensajeError).toBe(TEXTOS_VOLVER.versionNoRestaurable);
    expect(ofreceConfirmar(e)).toBe(false);
  });
  it("un 200 en la PREGUNTA (el servidor no escribe sin confirmar) no se toma como éxito", () => {
    const e = responder(preguntando(), resp(200));
    expect(e.fase).toBe("error");
    expect(e.efecto).toBeNull();
  });
  it("un 409 de pregunta sin cuerpo utilizable es error ambiguo, no una confirmación vacía", () => {
    expect(responder(preguntando(), resp(409, "reemplazo_requiere_confirmacion"), { lineas: "x" }).fase).toBe("error");
    expect(responder(preguntando(), resp(409, "reemplazo_requiere_confirmacion"), { lineas: [], huella: "" }).fase).toBe("error");
  });
});

describe("decide por el código, no por el status", () => {
  it("un 409 con otro código no se trata como pregunta ni bloqueo", () => {
    const e = responder(preguntando(), resp(409, "f3_estado_cambio"));
    expect(e.fase).toBe("error");
    expect(e.errorTipo).toBe("otro");
  });
  it("el código manda: el mismo 409 con `reemplazo_bloqueado` y con `sin_cambios` dan estados distintos", () => {
    expect(responder(preguntando(), resp(409, "reemplazo_bloqueado")).errorTipo).toBe("bloqueado");
    expect(responder(preguntando(), resp(409, "sin_cambios")).errorTipo).toBe("sin_cambios");
  });
});

describe("respuestas fuera de turno", () => {
  it("una respuesta de otra petición se descarta", () => {
    const e = preguntando();
    expect(reducirEstadoVolver(e, { tipo: "respuesta", id: e.vigenteId! + 5, resp: resp(200), datos: null })).toBe(e);
  });
  it("tras cancelar la pregunta, su respuesta tardía se descarta", () => {
    const e = preguntando();
    const idViejo = e.vigenteId!;
    const c = reducirEstadoVolver(e, { tipo: "cancelar" });
    expect(c.fase).toBe("reposo");
    expect(reducirEstadoVolver(c, { tipo: "respuesta", id: idViejo, resp: resp(409, "reemplazo_requiere_confirmacion"), datos: PREGUNTA })).toBe(c);
  });
  it("no se puede cancelar con la escritura en vuelo", () => {
    const e = volviendo();
    expect(reducirEstadoVolver(e, { tipo: "cancelar" })).toBe(e);
  });
  it("el contador no se reinicia al cancelar (un id viejo nunca vuelve a ser vigente)", () => {
    const c = reducirEstadoVolver(preguntando(), { tipo: "cancelar" });
    expect(reducirEstadoVolver(c, { tipo: "abrir", objetivo: OBJ }).vigenteId).toBeGreaterThan(1);
  });
  it("una respuesta en reposo o tras el éxito no cambia nada", () => {
    const ok = responder(volviendo(), resp(200));
    expect(reducirEstadoVolver(ok, { tipo: "respuesta", id: 1, resp: RED, datos: null })).toBe(ok);
  });
});

describe("fallo de red o 5xx en la PREGUNTA: nada se escribió", () => {
  for (const [nombre, r] of [["red", RED], ["500", resp(500)], ["504", resp(504)]] as [string, RespuestaGuardado][]) {
    it(`${nombre} al preguntar → texto que afirma que no se hizo ningún cambio, sin «Ver el historial» ni confirmar`, () => {
      const e = responder(preguntando(), r);
      expect(e).toMatchObject({ fase: "error", errorTipo: "otro", mensajeError: TEXTOS_VISTA_VOLVER.noSePudoRevisar });
      expect(e.mensajeError).not.toMatch(/Puede que sí|abre el historial/);
      expect(ofreceVerHistorial(e)).toBe(false);
      expect(ofreceConfirmar(e)).toBe(false);
    });
  }
  it("al CONFIRMAR, en cambio, la red sigue siendo ambigua y ofrece «Ver el historial»", () => {
    const e = responder(volviendo(), RED);
    expect(e).toMatchObject({ errorTipo: "ambiguo", mensajeError: TEXTOS_VOLVER.ambiguo });
    expect(ofreceVerHistorial(e)).toBe(true);
  });
});

describe("foco de la vista en cada cambio de etapa", () => {
  it("va al título al pasar de una etapa a otra (confirmando, volviendo, éxito, error) y desde reposo", () => {
    const etapas = ["preguntando", "confirmando", "volviendo", "exito", "error"] as const;
    expect(debeEnfocarTituloVista("reposo", "preguntando")).toBe(true);
    for (let i = 1; i < etapas.length; i++) expect(debeEnfocarTituloVista(etapas[i - 1], etapas[i])).toBe(true);
    expect(debeEnfocarTituloVista("confirmando", "volviendo")).toBe(true);
    expect(debeEnfocarTituloVista("volviendo", "error")).toBe(true);
  });
  it("no se mueve si la etapa no cambió ni al volver a reposo (eso lo decide el regreso a la lista)", () => {
    expect(debeEnfocarTituloVista("confirmando", "confirmando")).toBe(false);
    expect(debeEnfocarTituloVista("exito", "reposo")).toBe(false);
    expect(debeEnfocarTituloVista("reposo", "reposo")).toBe(false);
  });
});

describe("el efecto de éxito solo existe tras un 200 confirmado", () => {
  const SIN_EXITO: [string, RespuestaGuardado][] = [
    ["red", RED], ["500", resp(500)], ["401", resp(401)], ["403", resp(403)], ["404", resp(404)],
    ["bloqueado", resp(409, "reemplazo_bloqueado")], ["sin_cambios", resp(409, "sin_cambios")],
    ["version_no_restaurable", resp(409, "version_no_restaurable")], ["historial_no_confirmado", resp(409, "historial_no_confirmado")],
  ];
  for (const [n, r] of SIN_EXITO) {
    it(`${n}: sin efecto, en la pregunta y al confirmar`, () => {
      expect(responder(preguntando(), r).efecto).toBeNull();
      expect(responder(volviendo(), r).efecto).toBeNull();
    });
  }
  it("la pregunta (409 de confirmación) y la huella vencida tampoco lo dan", () => {
    expect(confirmando().efecto).toBeNull();
    expect(responder(volviendo(), resp(409, "reemplazo_huella_vencida"), { lineas: [], huella: "h2" }).efecto).toBeNull();
  });
  it("solo el 200 tras confirmar lo da, y `efecto_hecho` lo consume", () => {
    const e = responder(volviendo(), resp(200));
    expect(e.efecto).toBe("avisar_y_recargar");
    expect(reducirEstadoVolver(reducirEstadoVolver(e, { tipo: "efecto_hecho" }), { tipo: "efecto_hecho" }).efecto).toBeNull();
  });
  it("«cancelar» desde el éxito vuelve a reposo sin dejar efecto", () => {
    expect(reducirEstadoVolver(responder(volviendo(), resp(200)), { tipo: "cancelar" })).toMatchObject({ fase: "reposo", efecto: null });
  });
});

describe("textos", () => {
  const RESTO = "El resultado como está ahora no se borra: queda en el historial y puedes volver a él.";
  it("apertura con nombre y fecha", () => {
    expect(TEXTOS_VISTA_VOLVER.apertura("¿Qué pasa con X?", "12 de noviembre de 2026, 10:00")).toBe(
      `Vas a volver a la versión del 12 de noviembre de 2026, 10:00, del resultado «¿Qué pasa con X?». ${RESTO}`
    );
  });
  it("sin nombre: se omite «del resultado»", () => {
    expect(TEXTOS_VISTA_VOLVER.apertura(null, "12 de noviembre")).toBe(`Vas a volver a la versión del 12 de noviembre. ${RESTO}`);
  });
  it("sin fecha: «una versión anterior del resultado «…»»", () => {
    expect(TEXTOS_VISTA_VOLVER.apertura("¿X?", null)).toBe(`Vas a volver a una versión anterior del resultado «¿X?». ${RESTO}`);
  });
  it("sin ambos: «de este resultado»", () => {
    expect(TEXTOS_VISTA_VOLVER.apertura(null, null)).toBe(`Vas a volver a una versión anterior de este resultado. ${RESTO}`);
  });
  it("nunca «undefined», «null» ni comillas vacías", () => {
    for (const [n, f] of [[null, "fecha"], ["pregunta", null], [null, null], ["p", "f"]] as const) {
      expect(TEXTOS_VISTA_VOLVER.apertura(n, f)).not.toMatch(/undefined|null|«»/);
    }
  });
  it("una fecha que termina en «p.m.» no duplica el punto (apertura con y sin nombre, con y sin fecha, y éxito)", () => {
    const f = "26 de noviembre de 2026, 1:36 p.m.";
    const todas = [
      TEXTOS_VISTA_VOLVER.apertura("¿X?", f), TEXTOS_VISTA_VOLVER.apertura(null, f), TEXTOS_VISTA_VOLVER.apertura("¿X?", null),
      TEXTOS_VISTA_VOLVER.apertura(null, null), TEXTOS_VISTA_VOLVER.exito(f), TEXTOS_VISTA_VOLVER.exito(null),
    ];
    for (const t of todas) expect(t).not.toMatch(/\.\./);
    expect(TEXTOS_VISTA_VOLVER.apertura(null, f)).toBe(`Vas a volver a la versión del ${f} ${RESTO}`);
    expect(TEXTOS_VISTA_VOLVER.apertura("¿X?", f)).toBe(`Vas a volver a la versión del ${f}, del resultado «¿X?». ${RESTO}`);
    expect(TEXTOS_VISTA_VOLVER.exito(f)).toBe(`Listo: volviste a la versión del ${f} El resultado quedó sin aprobar.`);
  });
  it("con el formateador REAL del panel (cualquier hora, incluida p.m.) nunca sale «..»", () => {
    for (const h of ["01", "13", "19", "23"]) {
      const f = fechaTextoDeFila(`2026-11-26T${h}:36:00.000Z`);
      expect(TEXTOS_VISTA_VOLVER.apertura(null, f)).not.toMatch(/\.\./);
      expect(TEXTOS_VISTA_VOLVER.exito(f)).not.toMatch(/\.\./);
    }
  });
  it("conPunto: un solo punto final", () => {
    expect(conPunto("a")).toBe("a.");
    expect(conPunto("a.")).toBe("a.");
    expect(conPunto("1:36 p.m.")).toBe("1:36 p.m.");
  });
  it("fechaTextoDeFila: fecha legible o null (nunca «Fecha desconocida» en la frase)", () => {
    expect(fechaTextoDeFila("2026-11-20T10:00:00.000Z")).toMatch(/2026/);
    for (const v of [null, undefined, "", "no es fecha"]) expect(fechaTextoDeFila(v as never)).toBeNull();
  });
  it("clave del botón de la fila", () => expect(claveBotonVolver(3, "r1")).toBe("3:r1"));
  it("éxito con y sin fecha", () => {
    expect(TEXTOS_VISTA_VOLVER.exito("12 de noviembre")).toBe("Listo: volviste a la versión del 12 de noviembre. El resultado quedó sin aprobar.");
    expect(TEXTOS_VISTA_VOLVER.exito(null)).toBe("Listo: volviste a una versión anterior. El resultado quedó sin aprobar.");
  });
  it("títulos y botones exactos, sin siglas", () => {
    expect(TEXTOS_VISTA_VOLVER.titulo).toBe("¿Volver a una versión anterior de este resultado?");
    expect(TEXTOS_VISTA_VOLVER.volviendo).toBe("Volviendo a la versión anterior…");
    expect([TEXTOS_VISTA_VOLVER.cancelar, TEXTOS_VISTA_VOLVER.confirmar]).toEqual(["Cancelar", "Volver a esta versión"]);
    expect(JSON.stringify(TEXTOS_VISTA_VOLVER)).not.toMatch(/HEI|DIE/);
  });
  it("el foco vuelve al botón de la fila, o al título si ya no está", () => {
    expect(dondeVuelveFocoVolver(true)).toBe("boton_fila");
    expect(dondeVuelveFocoVolver(false)).toBe("titulo");
  });
});
