// lib/centinela/pestel/textosOrigen.ts
// T7 C2 — PURO (cliente y servidor). El texto que ve la persona para cada razón de `decidirImportabilidad`, con
// el control que EXISTE en pantalla para resolverla (verificado leyendo el código: «Finalizar interpretación»
// y «Marcar como revisado» están en Interpretación; «Regresar a Moddulo F2 con resultados» es el botón de
// Centinela con el proyecto vinculado). Las frases fijas viven en `lib/moddulo/textosVinculo.ts`. Ninguno manda a pedir ayuda externa. Las fechas son las reales de los
// datos; si no hay fecha legible la frase se dice sin ella (nunca un hueco como «del .»).

import { UMBRAL_CONFIANZA } from "./aprobacion";
import { CAMINO_ORIGEN_VIGENTE, MENSAJE_ORIGEN_NO_APROBADO, MENSAJE_ORIGEN_UN_SESGO, mensajeOrigenSesgos } from "@/lib/moddulo/textosVinculo";
import { razonesSinDuplicar, type RazonImportabilidad } from "./importabilidad";
import type { EstadoOrigen } from "./estadoOrigen";

export const TITULO_CONFIRMAR_ORIGEN = "¿Importar este análisis de Centinela de todos modos?";
export const CONFIRMAR_ORIGEN = "Importar de todos modos";
export const INTRO_CONFIRMAR_ORIGEN = "Antes de importarlo, ten en cuenta lo siguiente:";

/** «1 de octubre de 2026» a partir de un ISO; null si no es una fecha legible. */
export function fechaLarga(iso: string | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function textoRazon(r: RazonImportabilidad): string {
  switch (r.tipo) {
    case "no_aprobado":
      return MENSAJE_ORIGEN_NO_APROBADO;
    case "sesgos_sin_revisar":
      return r.cantidad === 1 ? MENSAJE_ORIGEN_UN_SESGO : mensajeOrigenSesgos(r.cantidad);
    case "no_vigente": {
      const propia = fechaLarga(r.fechaAnalisis);
      const vigente = fechaLarga(r.fechaVigente);
      const sujeto = propia ? `Este análisis (del ${propia})` : "Este análisis";
      const resto = vigente ? `ya no es el vigente: hay uno más reciente (del ${vigente}).` : "ya no es el vigente del proyecto.";
      return `${sujeto} ${resto} ${CAMINO_ORIGEN_VIGENTE}`;
    }
    case "confianza_baja":
      return `La confianza global del análisis es de ${Math.round(r.confianza)} %, por debajo del ${UMBRAL_CONFIANZA} % recomendado.`;
  }
}

export function textosDeRazones(razones: readonly RazonImportabilidad[]): string[] {
  return razones.map(textoRazon);
}

/**
 * Lo que dice el modal de F2: las razones SIN repetir lo que ya dice el aviso de origen de T4. Si al quitar
 * `no_vigente` (cubierto por «versión más nueva») no queda nada que decir, el único mensaje es el del propio
 * aviso de origen (`textoAvisoOrigen`), que es el texto que esa situación ya tiene.
 */
export function avisosDeOrigenParaModal(
  razones: readonly RazonImportabilidad[],
  estadoOrigen: EstadoOrigen | null | undefined,
  textoAvisoOrigen: string | null | undefined
): string[] {
  const { razones: visibles, omitidas } = razonesSinDuplicar(razones, estadoOrigen);
  const lineas = textosDeRazones(visibles);
  if (lineas.length === 0 && omitidas.includes("no_vigente") && textoAvisoOrigen) return [textoAvisoOrigen];
  return lineas;
}

/**
 * Lo que se dice cuando el estado del análisis cambió ENTRE lo que la persona vio y su confirmación (`origen_huella_vencida`):
 * el servidor no escribió nada y el modal muestra lo nuevo. Nombra el botón que existe en ese mismo modal/panel.
 */
export const AVISO_ORIGEN_VENCIDO_IMPORT = `El estado del análisis de Centinela cambió. No se importó nada: revisa lo que se muestra y confirma de nuevo con «${CONFIRMAR_ORIGEN}».`;
/** Lo mismo en el selector de Centinela (allí se vincula, no se importa en el momento). */
export const AVISO_ORIGEN_VENCIDO_VINCULO = `El estado del análisis de Centinela cambió. No se vinculó nada: revisa lo que se muestra y confirma de nuevo con «${CONFIRMAR_ORIGEN}».`;
/** Si no se pudieron leer las razones nuevas no hay botón «Importar de todos modos» que nombrar: se dice sin control. */
export const AVISO_ORIGEN_VENCIDO_SIN_RAZONES = "El estado del análisis de Centinela cambió. No se importó nada: confirma de nuevo.";

const TIPOS: ReadonlySet<string> = new Set(["no_aprobado", "sesgos_sin_revisar", "no_vigente", "confianza_baja"]);

/** Lee `razones` de un cuerpo de respuesta sin confiar en su forma; undefined si algo no cuadra. */
export function leerRazonesOrigen(x: unknown): RazonImportabilidad[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const salida: RazonImportabilidad[] = [];
  for (const r of x) {
    if (!r || typeof r !== "object" || typeof (r as { tipo?: unknown }).tipo !== "string" || !TIPOS.has((r as { tipo: string }).tipo)) return undefined;
    const o = r as Record<string, unknown>;
    if (o.tipo === "sesgos_sin_revisar" && typeof o.cantidad !== "number") return undefined;
    if (o.tipo === "confianza_baja" && typeof o.confianza !== "number") return undefined;
    salida.push(r as RazonImportabilidad);
  }
  return salida;
}

/**
 * La nota junto al botón de Centinela (ModduloButton): la misma razón que verá F2. `aviso` = habrá que
 * confirmar; `info` = solo informa (confianza baja sola no pide confirmación). Sin razones: null.
 */
export function notaDeImportacion(razones: readonly RazonImportabilidad[]): { tono: "aviso" | "info"; lineas: string[] } | null {
  if (razones.length === 0) return null;
  const pideConfirmar = razones.some((r) => r.tipo !== "confianza_baja");
  return { tono: pideConfirmar ? "aviso" : "info", lineas: textosDeRazones(razones) };
}
