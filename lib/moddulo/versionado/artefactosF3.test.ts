// C3a — registro de artefactos F3 (módulo puro): nombres, estado, proyección viva, volátiles y esquema.
import { describe, expect, it } from "vitest";
import { huellaContenido, huellaTupla } from "@/lib/versionado/huella";
import type { AsignacionCanal } from "@/types/moddulo.types";
import {
  ESQUEMA_F3, PUNTERO_F3, estadoAsignacion, estadoResultado, nombreAsignacion, nombreResultado, vivoAsignacion, vivoResultado,
} from "./artefactosF3";

const DOC = {
  moduloPIP: "¿Test?",
  origen: { sourceKind: "T10", componente: "centinela", analisisId: "r1", fechaEntrega: "2026-11-16T10:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: "moddulo/u/p/f.json", extractoTexto: "texto" },
};
const ASIG: AsignacionCanal = {
  asignacionId: "asig1", tipo: "primaria", canal: "canal1", tecnicaId: "T10", justificacion: "j", estado: "en_curso", activada: true,
};

describe("nombres y puntero", () => {
  it("nombres estables por id y puntero hermano de f3TareasPIP (no es prefijo de ninguna ruta que escriben las rutas)", () => {
    expect(nombreResultado("r1")).toBe("f3Resultado:r1");
    expect(nombreAsignacion("asig1")).toBe("f3Asignacion:asig1");
    expect(PUNTERO_F3).toBe("phases.investigacion.revision");
  });
});

describe("resultado", () => {
  it("dos lecturas del MISMO documento dan la misma tupla y la misma proyección viva", () => {
    const l1 = { ...DOC, aprobado: true, notasUsuario: "ok", createdAt: { _seconds: 1 } };
    const l2 = JSON.parse(JSON.stringify(l1));
    expect(huellaTupla(estadoResultado(l1))).toBe(huellaTupla(estadoResultado(l2)));
    expect(huellaContenido(vivoResultado(l1))).toBe(huellaContenido(vivoResultado(l2)));
  });

  it("los campos VOLÁTILES (createdAt) no mueven ni la tupla ni la proyección viva", () => {
    const a = { ...DOC, aprobado: false, createdAt: { _seconds: 1 } };
    const b = { ...DOC, aprobado: false, createdAt: { _seconds: 999 } };
    const c = { ...DOC, aprobado: false };
    for (const x of [b, c]) {
      expect(huellaTupla(estadoResultado(x))).toBe(huellaTupla(estadoResultado(a)));
      expect(huellaContenido(vivoResultado(x))).toBe(huellaContenido(vivoResultado(a)));
    }
  });

  it("un cambio de contenido SÍ mueve tupla y proyección", () => {
    const a = estadoResultado(DOC);
    const b = estadoResultado({ ...DOC, payload: { ...DOC.payload, extractoTexto: "otro" } });
    expect(huellaTupla(a)).not.toBe(huellaTupla(b));
    expect(huellaContenido(vivoResultado(DOC))).not.toBe(huellaContenido(vivoResultado({ ...DOC, moduloPIP: "otra" })));
  });

  it("la aprobación se separa del contenido; desde el vivo queda SIN sello (por/en null) y con notas", () => {
    const e = estadoResultado({ ...DOC, aprobado: true, notasUsuario: "lo revisé" });
    expect(e.contenido).toEqual(DOC);
    expect(e.aprobacion).toEqual({ aprobado: true, por: null, en: null, notas: "lo revisé" });
  });

  it("con sello (lo que escribe una aprobación registrada) la aprobación lo trae; sin `aprobado` no hay aprobación", () => {
    const e = estadoResultado({ ...DOC, aprobado: false }, { por: "uidA", en: "2026-11-16", huella: "hh" });
    expect(e.aprobacion).toEqual({ aprobado: false, por: "uidA", en: "2026-11-16", huella: "hh" });
    expect(estadoResultado(DOC).aprobacion).toBeUndefined();
  });

  it("la proyección viva NO lleva sello: aprobar registrado y leer del vivo dan la MISMA proyección (sin falsa deriva)", () => {
    const vivo = { ...DOC, aprobado: true, notasUsuario: "n" };
    const conSello = estadoResultado(vivo, { por: "uidA", en: "2026-11-16", huella: "hh" });
    const sinSello = estadoResultado(vivo);
    expect(huellaTupla(conSello)).not.toBe(huellaTupla(sinSello)); // la tupla SÍ difiere (el sello)
    expect(huellaContenido(vivoResultado(vivo))).toBe(huellaContenido(vivoResultado({ ...vivo }))); // la proyección no
  });

  it("incluye `esquema` y no emite claves undefined", () => {
    const v = vivoResultado({ ...DOC, extra: undefined }) as Record<string, unknown>;
    expect(v.esquema).toBe(ESQUEMA_F3);
    expect("extra" in v).toBe(false);
    expect("extra" in (estadoResultado({ ...DOC, extra: undefined }).contenido as object)).toBe(false);
  });

  it("subir ESQUEMA_F3 mueve la proyección (una deriva única por artefacto: límite declarado)", () => {
    const v = vivoResultado(DOC) as { esquema: number };
    const simulado = { ...v, esquema: ESQUEMA_F3 + 1 };
    expect(huellaContenido(simulado)).not.toBe(huellaContenido(v));
  });
});

describe("asignación", () => {
  it("estado = la asignación completa; proyección = asignación + esquema; estable ante el orden de claves", () => {
    expect(estadoAsignacion(ASIG).contenido).toEqual(ASIG);
    const reordenada = { activada: true, estado: "en_curso", justificacion: "j", tecnicaId: "T10", canal: "canal1", tipo: "primaria", asignacionId: "asig1" } as AsignacionCanal;
    expect(huellaContenido(vivoAsignacion(reordenada))).toBe(huellaContenido(vivoAsignacion(ASIG)));
    expect(huellaContenido(vivoAsignacion({ ...ASIG, activada: false }))).not.toBe(huellaContenido(vivoAsignacion(ASIG)));
  });
});
