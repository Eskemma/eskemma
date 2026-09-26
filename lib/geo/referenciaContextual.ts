// lib/geo/referenciaContextual.ts
// Paso 3 (26-09-25): referencias CONTEXTUALES ("este distrito", "mi municipio", "el distrito
// federal") — una capa SEPARADA del parser de nombres geográficos.
//
// Frases como "dame el indicador para este distrito" o "¿cómo va este distrito federal?" NO
// nombran un lugar nuevo: apuntan al territorio que YA está activo en la sesión/proyecto y, a
// veces, precisan el NIVEL (federal vs local). Buscarlas en el catálogo nacional encontraría
// cientos de candidatos o, peor, leería "Distrito Federal" como la Ciudad de México. Por eso
// esta capa corre ANTES: primero se clasifica el texto; solo si es un nombre (nombre propio,
// número, clave) entra a `desambiguarReferencia`.
//
//   clasificarReferencia(texto, {nivelActivo}) → { tipo: "nombre" }
//                                              | { tipo: "contexto", via, nivel }
//   decidirContexto(nivelPedido, nivelActivo)  → qué hacer con una referencia contextual:
//        usar_activo       el territorio activo tal cual (mismo nivel, o solo "este …")
//        nivel_contenedor  un nivel que CONTIENE al activo (estatal/nacional desde un distrito):
//                          se deriva sin preguntar, no hay ambigüedad
//        hermano           el otro tipo de distrito (federal ↔ local): requiere una equivalencia
//                          geográfica que hoy NO existe (ronda aparte) → rechazo honesto
//        sin_referente     no hay nada en el contexto a lo que apuntar, o el nivel pedido es más
//                          fino que el del proyecto
//
// Módulo PURO. "Distrito Federal" a secas es la Ciudad de México (nombre antiguo) SALVO que el
// proyecto ya trabaje a nivel distrito: ahí se lee como el nivel federal (y la respuesta lo dice).

import type { NivelTerritorial } from "@/types/shared.types";
import { formaPlana } from "./referenciaDistrito";

export type NivelReferido = "nacional" | "estatal" | "municipal" | "distrito" | "distrito_federal" | "distrito_local";

export type ClasificacionReferencia =
  | { tipo: "nombre" }
  | {
      tipo: "contexto";
      via: "deictica" | "calificador";
      /** Nivel que el usuario precisó; null = solo apunta ("aquí", "este territorio"). */
      nivel: NivelReferido | null;
    };

const SUSTANTIVOS: { patron: string; nivel: NivelReferido | null }[] = [
  { patron: "DISTRITO(?: ELECTORAL)? FEDERAL", nivel: "distrito_federal" },
  { patron: "DISTRITO(?: ELECTORAL)? LOCAL", nivel: "distrito_local" },
  { patron: "DISTRITO(?: ELECTORAL)?", nivel: "distrito" },
  { patron: "ESTADO", nivel: "estatal" },
  { patron: "MUNICIPIO", nivel: "municipal" },
  { patron: "PAIS", nivel: "nacional" },
  { patron: "TERRITORIO|LUGAR|ZONA|AREA|REGION|CIUDAD|LOCALIDAD|PROYECTO", nivel: null },
];

const RE_DEICTICO = new RegExp(`^(?:ESTE|ESTA|ESE|ESA|MI|NUESTRO|NUESTRA|EL|LA)\\s+(${SUSTANTIVOS.map((s) => `(${s.patron})`).join("|")})$`);
const RE_DEL_PROYECTO = /^(?:EL|LA)\s+(?:(?:DEL|DE LA|DE ESTE|DE ESTA)\s+(?:PROYECTO|SESION|ANALISIS)|ACTUAL|MISMO|MISMA)$/;
const RE_LOCATIVO = /^(?:AQUI|ACA|AHI|ALLI)$/;
const RE_CALIF_DISTRITO = /^(?:(?:EL|LA|A NIVEL|NIVEL)\s+)?(?:DISTRITO(?: ELECTORAL)?\s+)?(FEDERAL|LOCAL)$/;
const RE_CALIF_NIVEL = /^(?:(?:EL|LA|A NIVEL|NIVEL)\s+)?(ESTATAL|MUNICIPAL|NACIONAL)$/;
const RE_DF_A_SECAS = /^(?:EL\s+)?DISTRITO FEDERAL$/;

const esDistrital = (n: NivelTerritorial | undefined): boolean =>
  n === "distrito_federal" || n === "distrito_local" || n === "distrito";

/**
 * ¿`texto` es una referencia contextual ("este distrito") o un nombre? Solo lo primero se
 * resuelve contra el territorio activo; lo segundo sigue al parser de desambiguación.
 */
export function clasificarReferencia(
  texto: string | null | undefined,
  ctx: { nivelActivo?: NivelTerritorial } = {}
): ClasificacionReferencia {
  if (!texto || !texto.trim()) return { tipo: "nombre" };
  const p = formaPlana(texto);

  if (RE_LOCATIVO.test(p) || RE_DEL_PROYECTO.test(p)) return { tipo: "contexto", via: "deictica", nivel: null };

  // "Distrito Federal" a secas: la Ciudad de México, salvo que el proyecto ya sea distrital.
  if (RE_DF_A_SECAS.test(p)) {
    return esDistrital(ctx.nivelActivo)
      ? { tipo: "contexto", via: "calificador", nivel: "distrito_federal" }
      : { tipo: "nombre" };
  }

  const d = p.match(RE_DEICTICO);
  if (d) {
    // The capture groups follow SUSTANTIVOS order (group 1 is the whole noun phrase).
    const idx = SUSTANTIVOS.findIndex((_, i) => d[i + 2] !== undefined);
    return { tipo: "contexto", via: "deictica", nivel: idx >= 0 ? SUSTANTIVOS[idx].nivel : null };
  }

  const cd = p.match(RE_CALIF_DISTRITO);
  if (cd) {
    return { tipo: "contexto", via: "calificador", nivel: cd[1] === "FEDERAL" ? "distrito_federal" : "distrito_local" };
  }

  const cn = p.match(RE_CALIF_NIVEL);
  if (cn) {
    const nivel = cn[1] === "ESTATAL" ? "estatal" : cn[1] === "MUNICIPAL" ? "municipal" : "nacional";
    return { tipo: "contexto", via: "calificador", nivel };
  }

  return { tipo: "nombre" };
}

export type DecisionContextual =
  | { accion: "usar_activo" }
  | { accion: "nivel_contenedor"; nivel: "estatal" | "nacional" }
  | { accion: "hermano"; pedido: "distrito_federal" | "distrito_local"; activo: "distrito_federal" | "distrito_local" }
  | { accion: "sin_referente"; motivo: "activo_no_distrital" | "activo_nacional" | "nivel_mas_fino" | "desglose_de_distrito"; mensaje: string };

const NOMBRE_NIVEL: Record<NivelTerritorial, string> = {
  nacional: "nacional",
  estatal: "estatal",
  municipal: "municipal",
  distrito: "de distrito electoral federal",
  distrito_federal: "de distrito electoral federal",
  distrito_local: "de distrito electoral local",
};

/** "distrito" (legado) es el federal. */
const tipoDistritoActivo = (n: NivelTerritorial): "distrito_federal" | "distrito_local" =>
  n === "distrito_local" ? "distrito_local" : "distrito_federal";

/** Qué hacer con una referencia contextual dado el nivel del territorio activo. */
export function decidirContexto(nivelPedido: NivelReferido | null, nivelActivo: NivelTerritorial): DecisionContextual {
  if (nivelPedido === null) return { accion: "usar_activo" };

  if (nivelPedido === "nacional") {
    return nivelActivo === "nacional" ? { accion: "usar_activo" } : { accion: "nivel_contenedor", nivel: "nacional" };
  }

  if (nivelPedido === "estatal") {
    if (nivelActivo === "estatal") return { accion: "usar_activo" };
    if (nivelActivo === "nacional") {
      return {
        accion: "sin_referente",
        motivo: "activo_nacional",
        mensaje: "Tu proyecto es de nivel nacional: no hay un estado al que apuntar. Dime de qué estado quieres el dato.",
      };
    }
    return { accion: "nivel_contenedor", nivel: "estatal" };
  }

  if (nivelPedido === "municipal") {
    if (nivelActivo === "municipal") return { accion: "usar_activo" };
    if (esDistrital(nivelActivo)) {
      return {
        accion: "sin_referente",
        motivo: "desglose_de_distrito",
        mensaje:
          "Tu proyecto es de nivel distrito electoral: un distrito puede abarcar varios municipios. Dime cuál municipio quieres, o usa «Ver valores por unidad» en la tabla para el desglose.",
      };
    }
    return {
      accion: "sin_referente",
      motivo: "nivel_mas_fino",
      mensaje: `Tu proyecto es de nivel ${NOMBRE_NIVEL[nivelActivo]}: no apunta a un municipio en particular. Dime cuál municipio quieres.`,
    };
  }

  // Distrito (genérico, federal o local)
  if (!esDistrital(nivelActivo)) {
    return {
      accion: "sin_referente",
      motivo: "activo_no_distrital",
      mensaje: `Tu proyecto es de nivel ${NOMBRE_NIVEL[nivelActivo]}, no de distrito electoral: no hay un distrito al que apuntar. Dime cuál distrito (por ejemplo «D.F. 1405 PUERTO VALLARTA»).`,
    };
  }
  if (nivelPedido === "distrito") return { accion: "usar_activo" };
  const activo = tipoDistritoActivo(nivelActivo);
  if (nivelPedido === activo) return { accion: "usar_activo" };
  return { accion: "hermano", pedido: nivelPedido, activo };
}
