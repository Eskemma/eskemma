// T7 C1 — precedencia entre el gate («no vigente») y el aviso de origen de T4 («versión nueva»): un solo mensaje.
import { describe, expect, it } from "vitest";
import { decidirImportabilidad, razonesSinDuplicar, type RazonImportabilidad, type TipoRazon } from "./importabilidad";
import type { EstadoOrigen } from "./estadoOrigen";

const NO_VIGENTE: RazonImportabilidad = { tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" };
const NO_APROBADO: RazonImportabilidad = { tipo: "no_aprobado", status: "REVIEWED" };
const SESGOS: RazonImportabilidad = { tipo: "sesgos_sin_revisar", cantidad: 2 };
const CONF: RazonImportabilidad = { tipo: "confianza_baja", confianza: 39 };
const tipos = (rs: RazonImportabilidad[]) => rs.map((r) => r.tipo);

describe("razonesSinDuplicar — precedencia con el aviso de origen", () => {
  // INVERTIDA A PROPÓSITO en T7 C2 (antes afirmaba `r.nivel === "ok"` tras suprimir): el nivel ya no lo calcula
  // esta función; lo calcula el gate ANTES de suprimir, y con no_vigente sigue en «aviso».
  it("vínculo existente con version_nueva: el aviso de origen gana, no_vigente se omite y el gate SIGUE en aviso", () => {
    const r = razonesSinDuplicar([NO_VIGENTE], "version_nueva");
    expect(r.razones).toEqual([]);
    expect(r.omitidas).toEqual(["no_vigente"]);
    expect("nivel" in r).toBe(false);
    const gate = decidirImportabilidad({ id: "a1", status: "APPROVED", vigente: false, analyzedAt: "2026-10-01T10:00:00Z", globalConfidence: 80, biasAlerts: [] });
    expect(gate.nivel).toBe("aviso"); // calculado con todas las razones, antes de suprimir
  });

  it("PRIMERA importación (sin vínculo: estadoOrigen ausente o null): no_vigente SIGUE apareciendo (se quitó la aserción de nivel: ya no es de esta función)", () => {
    for (const origen of [undefined, null]) {
      const r = razonesSinDuplicar([NO_VIGENTE], origen);
      expect(r.razones).toEqual([NO_VIGENTE]);
      expect(r.omitidas).toEqual([]);
    }
  });

  it("con cualquier otro estado de origen (igual, cambio_contenido, no_verificable) no_vigente se conserva", () => {
    for (const e of ["igual", "cambio_contenido", "no_verificable"] as EstadoOrigen[]) {
      expect(razonesSinDuplicar([NO_VIGENTE], e).razones).toEqual([NO_VIGENTE]);
    }
  });

  it("version_nueva solo omite no_vigente: las demás razones se conservan (se quitó la aserción de nivel)", () => {
    const r = razonesSinDuplicar([NO_APROBADO, SESGOS, NO_VIGENTE, CONF], "version_nueva");
    expect(tipos(r.razones)).toEqual(["no_aprobado", "sesgos_sin_revisar", "confianza_baja"]);
    expect(r.omitidas).toEqual(["no_vigente"]);
  });

  // INVERTIDA A PROPÓSITO en T7 C2 (antes: «si solo queda la confianza baja tras omitir, el nivel es ok»): el
  // nivel se calcula ANTES de suprimir, así que no_vigente + confianza baja sigue pidiendo confirmación.
  it("si tras omitir solo queda la confianza baja, el gate SIGUE en aviso (el nivel no se recalcula)", () => {
    const base = { id: "a1", status: "APPROVED", vigente: false, analyzedAt: "2026-10-01T10:00:00Z", globalConfidence: 39, biasAlerts: [] };
    const gate = decidirImportabilidad(base);
    expect(gate.nivel).toBe("aviso");
    const r = razonesSinDuplicar(gate.razones, "version_nueva");
    expect(tipos(r.razones)).toEqual(["confianza_baja"]);
    expect(gate.nivel).toBe("aviso");
  });
});

describe("razonesSinDuplicar — nunca el mismo hecho dos veces", () => {
  const TODOS: RazonImportabilidad[] = [NO_APROBADO, SESGOS, NO_VIGENTE, CONF];
  const estados: (EstadoOrigen | null | undefined)[] = [undefined, null, "igual", "cambio_contenido", "version_nueva", "no_verificable"];

  it("una razón repetida en la entrada sale una sola vez (gana la primera)", () => {
    const r = razonesSinDuplicar([NO_VIGENTE, { tipo: "no_vigente" }, SESGOS, SESGOS], undefined);
    expect(tipos(r.razones)).toEqual(["no_vigente", "sesgos_sin_revisar"]);
    expect(r.razones[0]).toBe(NO_VIGENTE);
    expect(r.omitidas).toEqual(["no_vigente", "sesgos_sin_revisar"]);
  });

  it("para cualquier combinación de entrada y estado de origen: sin tipos repetidos y sin perder razones no cubiertas", () => {
    const todosTipos: TipoRazon[] = ["no_aprobado", "sesgos_sin_revisar", "no_vigente", "confianza_baja"];
    for (let mascara = 0; mascara < 16; mascara++) {
      const entrada = TODOS.filter((_, i) => mascara & (1 << i));
      for (const estado of estados) {
        const r = razonesSinDuplicar([...entrada, ...entrada], estado);
        const salida = tipos(r.razones);
        expect(new Set(salida).size).toBe(salida.length);
        for (const t of todosTipos) {
          const estaba = entrada.some((x) => x.tipo === t);
          const cubierta = t === "no_vigente" && estado === "version_nueva";
          expect(salida.includes(t)).toBe(estaba && !cubierta);
        }
      }
    }
  });

  it("no modifica la entrada", () => {
    const entrada = [NO_VIGENTE, NO_APROBADO];
    const copia = structuredClone(entrada);
    razonesSinDuplicar(entrada, "version_nueva");
    expect(entrada).toEqual(copia);
  });
});
