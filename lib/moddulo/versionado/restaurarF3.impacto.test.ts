// C4b-1b — decisiones y textos propios de F3 de «volver»: confirmación (familia (i)), `sin_cambios`, nombre recortado y
// líneas condicionales (sin fecha ni siglas). Módulo puro: documentos de muestra.
import { describe, expect, it } from "vitest";
import type { AsignacionCanal } from "@/types/moddulo.types";
import { decidirConfirmacionVolver, esSinCambios, lineasDeVolver, nombreDeResultado } from "./restaurarF3";

const a = (id: string): AsignacionCanal => ({ asignacionId: id, tipo: "primaria", canal: "canal1", justificacion: "j", estado: "recibido", activada: true, resultadoId: "r1" }) as AsignacionCanal;

describe("decidirConfirmacionVolver (misma regla que el candado de F2)", () => {
  it("sin confirmar, o sin huella, o con huella malformada → requiere_confirmacion (nunca error)", () => {
    expect(decidirConfirmacionVolver({ confirmar: undefined, huellaRecibida: "h", huellaActual: "h" })).toBe("requiere_confirmacion");
    expect(decidirConfirmacionVolver({ confirmar: false, huellaRecibida: "h", huellaActual: "h" })).toBe("requiere_confirmacion");
    expect(decidirConfirmacionVolver({ confirmar: "true", huellaRecibida: "h", huellaActual: "h" })).toBe("requiere_confirmacion");
    for (const huella of [undefined, null, "", 3, {}]) {
      expect(decidirConfirmacionVolver({ confirmar: true, huellaRecibida: huella, huellaActual: "h" })).toBe("requiere_confirmacion");
    }
  });
  it("confirmar:true con OTRA huella → huella_vencida; con la misma → continuar", () => {
    expect(decidirConfirmacionVolver({ confirmar: true, huellaRecibida: "vieja", huellaActual: "h" })).toBe("huella_vencida");
    expect(decidirConfirmacionVolver({ confirmar: true, huellaRecibida: "h", huellaActual: "h" })).toBe("continuar");
  });
});

describe("esSinCambios", () => {
  const base = { objetivo: "v1", vigente: "v1", deriva: false as boolean | null, vivo: { aprobado: false }, afectadas: [] as AsignacionCanal[] };
  it("la objetivo ES la vigente, sin deriva, sin aprobación, sin notas y sin tareas → sin cambios", () => {
    expect(esSinCambios(base)).toBe(true);
    expect(esSinCambios({ ...base, vivo: {} })).toBe(true); // resultado que nunca tuvo la clave `aprobado`
  });
  it("un resultado APROBADO nunca es «sin cambios» (hay una aprobación que retirar)", () => {
    expect(esSinCambios({ ...base, vivo: { aprobado: true } })).toBe(false);
  });
  it("tampoco con notas pendientes, con tareas que reiniciar, con deriva (o deriva desconocida) o con otra versión vigente", () => {
    expect(esSinCambios({ ...base, vivo: { aprobado: false, notasUsuario: "n" } })).toBe(false);
    expect(esSinCambios({ ...base, afectadas: [a("x")] })).toBe(false);
    expect(esSinCambios({ ...base, deriva: true })).toBe(false);
    expect(esSinCambios({ ...base, deriva: null })).toBe(false);
    expect(esSinCambios({ ...base, vigente: "v2" })).toBe(false);
    expect(esSinCambios({ ...base, vigente: null })).toBe(false);
  });
});

describe("nombreDeResultado", () => {
  it("devuelve la pregunta tal cual si cabe, normalizando espacios", () => {
    expect(nombreDeResultado("  ¿Cuál   es?  ")).toBe("¿Cuál es?");
  });
  it("recorta a 120 caracteres (por caracteres, no por unidades UTF-16) con «…»", () => {
    const largo = "á".repeat(300);
    const n = nombreDeResultado(largo)!;
    expect(Array.from(n)).toHaveLength(121);
    expect(n.endsWith("…")).toBe(true);
    const emojis = "😀".repeat(200);
    expect(Array.from(nombreDeResultado(emojis)!)).toHaveLength(121);
  });
  it("nada que mostrar → undefined (no un texto vacío ni «undefined»)", () => {
    for (const v of [undefined, null, 3, "", "   "]) expect(nombreDeResultado(v)).toBeUndefined();
  });
});

describe("lineasDeVolver", () => {
  const sin = { estabaAprobado: false, teniaNotas: false, tareasReiniciadas: 0, haySintesis: false, hayVeredicto: false, archivoFaltaba: false };
  it("solo las líneas que son verdad: sin nada → ninguna", () => {
    expect(lineasDeVolver(sin)).toEqual([]);
  });
  it("cada condición agrega SU línea, con los rótulos de la pantalla", () => {
    expect(lineasDeVolver({ ...sin, estabaAprobado: true })).toEqual([
      "Este resultado está aprobado. Al volver quedará sin aprobar y tendrás que aprobarlo otra vez en «M2 · Resultados recibidos».",
    ]);
    expect(lineasDeVolver({ ...sin, teniaNotas: true })).toEqual(["Las notas que escribiste al aprobarlo dejarán de verse."]);
    expect(lineasDeVolver({ ...sin, archivoFaltaba: true })).toEqual([
      "El archivo de esa versión ya no está guardado; el texto sí se conserva, pero no podrás consultar el archivo original.",
    ]);
  });
  it("singular y plural de las tareas", () => {
    expect(lineasDeVolver({ ...sin, tareasReiniciadas: 1 })).toEqual(["1 tarea de investigación que usaba este resultado volverá a «En curso» y se desvinculará de él."]);
    expect(lineasDeVolver({ ...sin, tareasReiniciadas: 3 })).toEqual(["3 tareas de investigación que usaban este resultado volverán a «En curso» y se desvincularán de él."]);
  });
  it("síntesis y/o veredicto: concordancia (la síntesis, el veredicto, o ambos)", () => {
    expect(lineasDeVolver({ ...sin, haySintesis: true })).toEqual(["La síntesis que ya generaste no se vuelve a calcular: seguirá reflejando lo que tenías antes de volver."]);
    expect(lineasDeVolver({ ...sin, hayVeredicto: true })).toEqual(["El veredicto que ya generaste no se vuelve a calcular: seguirá reflejando lo que tenías antes de volver."]);
    expect(lineasDeVolver({ ...sin, haySintesis: true, hayVeredicto: true })).toEqual([
      "La síntesis y el veredicto que ya generaste no se vuelven a calcular: seguirán reflejando lo que tenías antes de volver.",
    ]);
  });
  it("ninguna línea lleva fecha, el nombre del resultado ni siglas internas", () => {
    const todo = lineasDeVolver({ estabaAprobado: true, teniaNotas: true, tareasReiniciadas: 2, haySintesis: true, hayVeredicto: true, archivoFaltaba: true }).join(" ");
    expect(todo).not.toMatch(/\b(HEI|DIE)\b/);
    expect(todo).not.toMatch(/\d{4}/);
  });
});
