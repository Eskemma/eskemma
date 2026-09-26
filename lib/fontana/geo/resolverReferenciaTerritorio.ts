// lib/fontana/geo/resolverReferenciaTerritorio.ts
// Paso 3 de la desambiguación geográfica (26-09-25): las herramientas de Fontana resuelven lo
// que el usuario DICE ("Pachuca", "México", "distrito federal 5 de Jalisco", "este distrito")
// con el núcleo compartido, en este orden:
//
//   1. Referencia CONTEXTUAL (lib/geo/referenciaContextual.ts): "este distrito", "mi municipio",
//      "nivel estatal" apuntan al territorio YA activo de la sesión — no se buscan en el catálogo.
//   2. Elección por CLAVE: si el modelo trae `claveTerritorio` (lo que el usuario eligió de una
//      lista), el servidor VUELVE a resolver el texto y solo la acepta si está entre los
//      candidatos reales: el modelo no puede fabricar una clave ni cambiar de territorio.
//   3. Nombre / número / clave de distrito → `desambiguarReferencia` (lib/geo/desambiguar.ts).
//
// Los TIPOS que se consideran salen del indicador (`registro.niveles`): estado y municipio según
// los niveles que el indicador admite (si admite ambos, "Colima" pregunta); "país" solo si admite
// nivel nacional; los DISTRITOS solo bajo demanda (el texto habla de distrito) y solo si el
// indicador tiene nivel distrital confirmado — de lo contrario cada cabecera de distrito
// convertiría en pregunta el 19 % de los nombres de municipio (medido, 26-09-25).
//
// Devuelve un `Territorio` listo para los resolvers de ingesta, o una respuesta que la herramienta
// traduce a una pregunta al usuario / un rechazo honesto. Nunca elige por el usuario.

import {
  desambiguarReferencia,
  type CandidatoReferencia,
  type MunicipioCatalogoRef,
  type TipoReferencia,
} from "@/lib/geo/desambiguar";
import { cabeceraDeDistrito } from "@/lib/geo/candidatosGeo";
import { etiquetaDistritoSeleccionado, formatDistritoLabel } from "@/lib/geo/formatDistrito";
import { claveCanonicaMunicipio } from "@/lib/geo/municipioCanonico";
import { getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import { nombreEstadoDisplay, resolverEstadoCve } from "@/lib/geo/estados";
import { esDistritoFederalAntiguo, mencionaDistrito } from "@/lib/geo/referenciaDistrito";
import { clasificarReferencia, decidirContexto } from "@/lib/geo/referenciaContextual";
import type { Territorio } from "@/types/shared.types";
import type { IndicadorRegistro } from "@/lib/fontana/indicatorRegistry";

/** Un candidato tal como se le presenta al modelo/usuario: la clave es lo que se vuelve a enviar. */
export interface CandidatoTerritorio {
  clave: string;
  tipo: TipoReferencia;
  etiqueta: string;
  coincidencia: CandidatoReferencia["coincidencia"];
}

export type ResolucionTerritorio =
  | {
      ok: true;
      territorio: Territorio;
      label: string;
      /** Cómo se llegó: por el nombre, por una clave elegida, o desde el territorio activo. */
      via: "nombre" | "clave" | "contexto" | "contenedor";
      /** Aviso para el usuario cuando el texto se interpretó ("«Pachuca» se interpretó como …"). */
      aviso?: string;
      /** true si apunta al propio territorio del proyecto ("este distrito"). */
      esTerritorioDelProyecto?: boolean;
    }
  | { ok: false; referencia: "ambiguo"; ambiguo: true; candidatos: CandidatoTerritorio[]; mensaje: string }
  | {
      ok: false;
      referencia: "demasiados";
      ambiguo: true;
      total: number;
      estados: string[];
      exactas: CandidatoTerritorio[];
      mensaje: string;
    }
  | { ok: false; referencia: "noResuelto"; noResuelto: true }
  | { ok: false; referencia: "clave_invalida" | "hermano" | "sin_referente" | "nivel_no_disponible"; mensaje: string };

export interface EntradaReferencia {
  texto: string;
  /** Estado que el usuario precisó ("Reforma, Chiapas"). */
  estadoHint?: string | null;
  /** Legado: "estatal" | "municipal" (el nivel pedido de forma explícita). */
  nivelHint?: string | null;
  /** Clave elegida de una lista de candidatos ofrecida antes. */
  claveTerritorio?: string | null;
  /** "estado" | "municipio" | "pais" | "distrito_federal" | "distrito_local": el usuario lo dijo explícitamente. */
  tipoTerritorio?: string | null;
  registro?: Pick<IndicadorRegistro, "niveles"> | null;
  /** Territorio activo de la sesión (para "este distrito", "nivel estatal"). */
  territorioActivo?: Territorio | null;
}

const TIPOS_DISTRITO: TipoReferencia[] = ["distrito_federal", "distrito_local"];
const TIPOS_EXPLICITOS: Record<string, TipoReferencia[]> = {
  estado: ["estado"],
  estatal: ["estado"],
  municipio: ["municipio"],
  municipal: ["municipio"],
  pais: ["pais"],
  nacional: ["pais"],
  distrito_federal: ["distrito_federal"],
  distrito_local: ["distrito_local"],
};

function tipoLegible(t: TipoReferencia): string {
  return { pais: "país", estado: "estado", municipio: "municipio", distrito_federal: "distrito federal", distrito_local: "distrito local" }[t];
}

const aCandidato = (c: CandidatoReferencia): CandidatoTerritorio => ({
  clave: c.clave,
  tipo: c.tipo,
  etiqueta: c.etiqueta,
  coincidencia: c.coincidencia,
});

function nivelDeEstado(registro: EntradaReferencia["registro"], nivel: string): string | undefined {
  return registro?.niveles.find((n) => n.nivel === nivel)?.estado;
}

/** Tipos a considerar según lo que el indicador admite. Ver la cabecera del archivo. */
function tiposParaIndicador(
  registro: EntradaReferencia["registro"],
  entrada: EntradaReferencia,
  pideDistrito: boolean
): TipoReferencia[] | { rechazo: string } {
  const explicito = entrada.tipoTerritorio ? TIPOS_EXPLICITOS[entrada.tipoTerritorio] : undefined;
  const nivelHint = entrada.nivelHint ? TIPOS_EXPLICITOS[entrada.nivelHint] : undefined;
  if (explicito ?? nivelHint) {
    const tipos = explicito ?? nivelHint ?? [];
    if (registro && tipos.some((t) => TIPOS_DISTRITO.includes(t)) && nivelDeEstado(registro, "distrital") !== "confirmado") {
      return { rechazo: "Este indicador no se calcula por distrito electoral." };
    }
    return tipos;
  }

  const tipos: TipoReferencia[] = [];
  const admiteEstatal = nivelDeEstado(registro, "estatal") !== "no_viable";
  const admiteMunicipal = nivelDeEstado(registro, "municipal") !== "no_viable";
  if (admiteEstatal) tipos.push("estado");
  if (admiteMunicipal) tipos.push("municipio");
  if (!tipos.length) tipos.push("estado", "municipio"); // el registro no permite acotar
  if (nivelDeEstado(registro, "nacional") !== "no_viable") tipos.unshift("pais");

  if (pideDistrito) {
    if (registro && nivelDeEstado(registro, "distrital") !== "confirmado") {
      return { rechazo: "Este indicador no se calcula por distrito electoral." };
    }
    tipos.push(...TIPOS_DISTRITO);
  }
  return tipos;
}

interface OpcionCatalogoMunicipio {
  estadoCve: string;
  nombre: string;
  estadoNombre: string;
  cve?: string;
}

function territorioDeCandidato(c: CandidatoReferencia, catalogo: OpcionCatalogoMunicipio[]): Territorio {
  if (c.tipo === "pais") return { nivel: "nacional", pais: "México", nombre: "México" };

  const estadoNombre = c.estadoCve ? nombreEstadoDisplay(c.estadoCve) ?? c.nombre : c.nombre;

  if (c.tipo === "estado") return { nivel: "estatal", estado: estadoNombre, nombre: estadoNombre };

  if (c.tipo === "municipio") {
    const [base, cve] = c.clave.split("#");
    const m = catalogo.find(
      (o) => `${o.estadoCve}:${claveCanonicaMunicipio(o.estadoCve, o.nombre)}` === base && (!cve || o.cve === cve)
    );
    const nombre = m?.nombre ?? c.nombre;
    const estado = m?.estadoNombre ?? estadoNombre;
    return { nivel: "municipal", estado, municipio: nombre, nombre: `${nombre}, ${estado}` };
  }

  // Distrito: código de 4 dígitos (estado + distrito). `cve_distrito` de 3 dígitos como en los
  // proyectos reales; `distritosSeleccionados` lleva la cabecera para los resolvers que la usan.
  const cabecera = cabeceraDeDistrito(c.tipo, c.clave) ?? c.nombre.replace(/^\d{4}\s+/, "");
  const cve3 = c.clave.slice(2).padStart(3, "0");
  const label = formatDistritoLabel(c.tipo, c.estadoCve ?? null, cve3, cabecera, c.nombre);
  return {
    nivel: c.tipo,
    estado: estadoNombre,
    nombre: label,
    cve_distrito: cve3,
    distritosSeleccionados: [{ cve: cve3, nombre: cabecera, estado: estadoNombre }],
  };
}

function labelDeTerritorio(t: Territorio): string {
  if (t.nivel === "municipal") return `${t.municipio}, ${t.estado}`;
  // Distrito con UN distrito seleccionado: forma canónica con clave, nunca solo la cabecera.
  if ((t.nivel === "distrito_federal" || t.nivel === "distrito_local") && t.distritosSeleccionados?.length === 1) {
    return etiquetaDistritoSeleccionado(t.nivel, t.distritosSeleccionados[0], t.estado);
  }
  return t.nombre;
}

function avisoDeInterpretacion(texto: string, c: CandidatoReferencia): string | undefined {
  if (c.coincidencia === "exacta") return undefined;
  return `«${texto.trim()}» se interpretó como ${c.etiqueta}.`;
}

function mensajeAmbiguo(texto: string, candidatos: CandidatoTerritorio[]): string {
  const tipos = [...new Set(candidatos.map((c) => tipoLegible(c.tipo)))];
  return `«${texto}» puede ser ${candidatos.length} territorios (${tipos.join(" / ")}): pregúntale al usuario cuál, listando las etiquetas exactas.`;
}

export async function resolverReferenciaTerritorio(entrada: EntradaReferencia): Promise<ResolucionTerritorio> {
  const texto = entrada.texto.trim();
  const activo = entrada.territorioActivo ?? null;

  // 1) Referencia contextual: "este distrito", "mi municipio", "nivel estatal".
  const clasificacion = clasificarReferencia(texto, { nivelActivo: activo?.nivel });
  if (clasificacion.tipo === "contexto") {
    if (!activo) {
      return { ok: false, referencia: "sin_referente", mensaje: "No hay un territorio activo al que apuntar. Pídele al usuario que nombre el lugar." };
    }
    const decision = decidirContexto(clasificacion.nivel, activo.nivel);
    if (decision.accion === "usar_activo") {
      return { ok: true, territorio: activo, label: labelDeTerritorio(activo), via: "contexto", esTerritorioDelProyecto: true };
    }
    if (decision.accion === "nivel_contenedor") {
      if (decision.nivel === "nacional") {
        const t: Territorio = { nivel: "nacional", pais: activo.pais ?? "México", nombre: activo.pais ?? "México" };
        return {
          ok: true,
          territorio: t,
          label: t.nombre,
          via: "contenedor",
          aviso: `Nivel nacional: contiene a ${labelDeTerritorio(activo)}, no es un promedio de tu territorio.`,
        };
      }
      const estado = activo.estado;
      if (!estado) {
        return { ok: false, referencia: "sin_referente", mensaje: "El territorio del proyecto no declara un estado. Pídele al usuario que nombre el estado." };
      }
      const t: Territorio = { nivel: "estatal", estado, nombre: estado };
      return {
        ok: true,
        territorio: t,
        label: estado,
        via: "contenedor",
        aviso: `Nivel estatal: el dato aplica a todo ${estado}, que contiene a ${labelDeTerritorio(activo)}; no es el valor de tu territorio.`,
      };
    }
    if (decision.accion === "hermano") {
      const pedido = decision.pedido === "distrito_federal" ? "federal" : "local";
      const actual = decision.activo === "distrito_federal" ? "federal" : "local";
      return {
        ok: false,
        referencia: "hermano",
        mensaje:
          `Tu proyecto trabaja en un distrito ${actual} (${labelDeTerritorio(activo)}) y pides el nivel ${pedido}. ` +
          `Fontana todavía no tiene la equivalencia geográfica entre distritos federales y locales, así que no puedo decir cuál distrito ${pedido} corresponde a esa zona. ` +
          `Pídele al usuario que nombre el distrito ${pedido} (por ejemplo «D.${pedido === "federal" ? "F" : "L"}. 1405 PUERTO VALLARTA» o «distrito ${pedido} 5 de Jalisco»).`,
      };
    }
    return { ok: false, referencia: "sin_referente", mensaje: decision.mensaje };
  }

  // 2/3) Nombre, número o clave.
  const pideDistrito =
    !esDistritoFederalAntiguo(texto) &&
    (mencionaDistrito(texto) || (entrada.tipoTerritorio?.startsWith("distrito") ?? false));
  const tipos = tiposParaIndicador(entrada.registro, entrada, pideDistrito);
  if (!Array.isArray(tipos)) return { ok: false, referencia: "nivel_no_disponible", mensaje: tipos.rechazo };

  const opcionesCatalogo = await getMunicipiosOptionsNacional();
  const catalogo: MunicipioCatalogoRef[] = opcionesCatalogo.map((m) => ({ estadoCve: m.estadoCve, nombre: m.nombre, cve: m.cve }));
  const estadoCve = entrada.estadoHint ? resolverEstadoCve(entrada.estadoHint) ?? undefined : undefined;
  const base = { estadoCve, municipios: catalogo };

  // Elección por clave: se vuelve a resolver el texto SIN tope de lista y solo se acepta una clave real.
  if (entrada.claveTerritorio) {
    const completo = desambiguarReferencia(texto, { ...base, tipos, maxCandidatos: Number.POSITIVE_INFINITY });
    const candidatos =
      completo.estado === "unico" ? [completo.candidato] : completo.estado === "ambiguo" ? completo.candidatos : [];
    const elegido = candidatos.find((c) => c.clave === entrada.claveTerritorio);
    if (!elegido) {
      return {
        ok: false,
        referencia: "clave_invalida",
        mensaje: `La clave «${entrada.claveTerritorio}» no corresponde a ninguna opción de «${texto}». Vuelve a preguntarle al usuario cuál quiere, con las etiquetas de la lista.`,
      };
    }
    const territorio = territorioDeCandidato(elegido, opcionesCatalogo);
    return { ok: true, territorio, label: labelDeTerritorio(territorio), via: "clave" };
  }

  let resultado = desambiguarReferencia(texto, { ...base, tipos });

  // Compatibilidad con el comportamiento anterior: si se pidió municipal y el nombre es solo un
  // estado (sin municipio homónimo), se devuelve el estado en vez de "no resuelto".
  if (resultado.estado === "ninguno" && tipos.length === 1 && tipos[0] === "municipio") {
    resultado = desambiguarReferencia(texto, { ...base, tipos: ["estado"] });
  }

  // Un ESTADO que coincide exacto gana a los municipios que solo lo CONTIENEN como palabra: «Jalisco»
  // es el estado, no «Ojuelos de Jalisco» (medido con el catálogo real: sin esto, el nombre de un
  // estado preguntaría cada vez «¿estado o el municipio que lo lleva en su nombre?»). Un municipio
  // homónimo EXACTO (Colima, Querétaro, Puebla…) sí sigue preguntando: aquí solo se descarta lo parcial.
  if ((resultado.estado === "ambiguo" || resultado.estado === "demasiados") && tipos.includes("estado")) {
    const completo = desambiguarReferencia(texto, { ...base, tipos, maxCandidatos: Number.POSITIVE_INFINITY });
    if (completo.estado === "ambiguo") {
      const sinParcialesDeMunicipio = completo.candidatos.filter((c) => !(c.tipo === "municipio" && c.coincidencia === "parcial"));
      const hayEstadoExacto = sinParcialesDeMunicipio.some((c) => c.tipo === "estado" && c.coincidencia !== "parcial");
      if (hayEstadoExacto && sinParcialesDeMunicipio.length < completo.candidatos.length) {
        resultado =
          sinParcialesDeMunicipio.length === 1
            ? { estado: "unico", candidato: sinParcialesDeMunicipio[0] }
            : { estado: "ambiguo", candidatos: sinParcialesDeMunicipio };
      }
    }
  }

  if (resultado.estado === "unico") {
    const c = resultado.candidato;
    const territorio = territorioDeCandidato(c, opcionesCatalogo);
    return { ok: true, territorio, label: labelDeTerritorio(territorio), via: "nombre", aviso: avisoDeInterpretacion(texto, c) };
  }
  if (resultado.estado === "ambiguo") {
    const candidatos = resultado.candidatos.map(aCandidato);
    return { ok: false, referencia: "ambiguo", ambiguo: true, candidatos, mensaje: mensajeAmbiguo(texto, candidatos) };
  }
  if (resultado.estado === "demasiados") {
    const estados = resultado.estadosCve.map((cve) => nombreEstadoDisplay(cve) ?? cve);
    return {
      ok: false,
      referencia: "demasiados",
      ambiguo: true,
      total: resultado.total,
      estados,
      exactas: resultado.exactas.map(aCandidato),
      mensaje: `«${texto}» coincide con ${resultado.total} territorios: pídele al usuario el estado o un nombre más específico. No listes todos.`,
    };
  }
  return { ok: false, referencia: "noResuelto", noResuelto: true };
}
