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
import { resolverCorrespondenciaLocalFederal } from "@/lib/fontana/ingesta/eceg";
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
      via: "nombre" | "clave" | "contexto" | "contenedor" | "sugerencia" | "correspondencia";
      /** Solo `via: "sugerencia"` (Pieza 1b) o `via: "correspondencia"` (Frente A, "distrito hermano"): la
       *  sugerencia que se aceptó por su clave. El llamador DEBE verificar que el usuario la confirmó antes
       *  de usar el dato (ver `verificarConfirmacionSugerencia` en tools.ts). */
      sugerida?: { clave: string; nombre: string; etiqueta: string };
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
  // Pieza 1b: no se reconoce, pero hay sugerencias por error de tecleo. NO es una resolución: hay que preguntar.
  | { ok: false; referencia: "sugerencia"; sugerencias: CandidatoTerritorio[]; mensaje: string }
  // Frente A ("distrito hermano", 26-09-27): Local→Federal con un distrito federal que domina claramente
  // (≥ umbral) la población del local activo — es una SUGERENCIA, nunca una equivalencia exacta: hay que
  // confirmarla igual que una sugerencia de la Pieza 1b (misma clave + `sugerenciaConfirmada`).
  | { ok: false; referencia: "correspondencia"; sugerida: CandidatoTerritorio; pctDominante: number; mensaje: string }
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
  /**
   * Pieza 1b: el llamador (tools.ts, que ve la conversación) verificó que el usuario CONFIRMÓ el territorio de
   * `claveTerritorio`. Sin esto una clave que solo corresponde a una SUGERENCIA por tecleo se rechaza: una
   * sugerencia nunca se acepta sin confirmación humana.
   */
  sugerenciaConfirmada?: boolean;
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

/** Construye el `Territorio` de un distrito a partir de su cve de 3 dígitos y el estado (Frente A: el
 *  distrito federal dominante de una correspondencia Local→Federal). Mismo patrón que la rama de distrito
 *  de `territorioDeCandidato`, pero partiendo de una cve ya conocida en vez de un `CandidatoReferencia`. */
function territorioDistritoPorCve(
  nivel: "distrito_federal" | "distrito_local",
  estadoCve: string,
  distritoCve3: string,
  estadoNombre: string
): { territorio: Territorio; label: string; clave: string } {
  const codigo4 = `${estadoCve}${distritoCve3.slice(-2)}`;
  const cabecera = cabeceraDeDistrito(nivel, codigo4) ?? "";
  const label = formatDistritoLabel(nivel, estadoCve, distritoCve3, cabecera, codigo4);
  const territorio: Territorio = {
    nivel,
    estado: estadoNombre,
    nombre: label,
    cve_distrito: distritoCve3,
    distritosSeleccionados: [{ cve: distritoCve3, nombre: cabecera, estado: estadoNombre }],
  };
  return { territorio, label, clave: codigo4 };
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
      const ejemploNombrar =
        `Pídele al usuario que nombre el distrito ${pedido} (por ejemplo «D.${pedido === "federal" ? "F" : "L"}. 1405 PUERTO VALLARTA» ` +
        `o «distrito ${pedido} 5 de Jalisco»).`;

      // Frente A ("distrito hermano", 26-09-27): Local→Federal SÍ tiene una correspondencia calculada por
      // dominancia poblacional (con umbral, `resolverCorrespondenciaLocalFederal`) — nunca se resuelve
      // sola, se ofrece como SUGERENCIA que el usuario debe confirmar (mismo patrón que la Pieza 1b).
      if (decision.activo === "distrito_local" && decision.pedido === "distrito_federal") {
        const estadoCve = activo.estado ? resolverEstadoCve(activo.estado) : undefined;
        const distritoLocalCve = activo.cve_distrito;
        if (estadoCve && distritoLocalCve) {
          const corresp = await resolverCorrespondenciaLocalFederal(estadoCve, distritoLocalCve);
          if (corresp.ok) {
            const { territorio, label, clave } = territorioDistritoPorCve("distrito_federal", estadoCve, corresp.distritoFederalCve, activo.estado ?? "");
            if (entrada.claveTerritorio === clave && entrada.sugerenciaConfirmada) {
              return {
                ok: true,
                territorio,
                label,
                via: "correspondencia",
                aviso:
                  `Se usó ${label}, el distrito federal que domina el ${corresp.pctDominante}% de la población de ` +
                  `${labelDeTerritorio(activo)} (cartografía ${corresp.anioCartografia}), confirmado por el usuario.`,
              };
            }
            const sugerida: CandidatoTerritorio = { clave, tipo: "distrito_federal", etiqueta: label, coincidencia: "parcial" };
            return {
              ok: false,
              referencia: "correspondencia",
              sugerida,
              pctDominante: corresp.pctDominante,
              mensaje:
                `Tu proyecto trabaja en un distrito local (${labelDeTerritorio(activo)}) y pides el nivel federal. El distrito federal que ` +
                `más se le parece es ${label}, que cubre el ${corresp.pctDominante}% de su población (cartografía ${corresp.anioCartografia}) — ` +
                `no es una equivalencia exacta. Pregúntale al usuario si quiere usarlo para esta consulta (nunca lo asumas); si confirma, ` +
                `vuelve a llamar con \`claveTerritorio\`="${clave}" y deja que el servidor lo verifique.`,
            };
          }
          return {
            ok: false,
            referencia: "hermano",
            mensaje:
              `Tu proyecto trabaja en un distrito local (${labelDeTerritorio(activo)}) y pides el nivel federal, pero ningún distrito ` +
              `federal domina con claridad su población (${corresp.motivo}) — no hay una correspondencia confiable que sugerir, no por falta ` +
              `de cálculo sino porque la población del distrito realmente se reparte entre varios. ${ejemploNombrar}`,
          };
        }
      }

      return {
        ok: false,
        referencia: "hermano",
        mensaje:
          `Tu proyecto trabaja en un distrito ${actual} (${labelDeTerritorio(activo)}) y pides el nivel ${pedido}. ` +
          (pedido === "local"
            ? `Un distrito federal casi siempre reparte su población entre varios distritos locales a la vez, así que no hay uno solo que le ` +
              `corresponda con claridad: es una limitación estructural de cómo se trazan los dos mapas, no un dato que falte calcular. `
            : `Fontana no tiene la equivalencia geográfica entre distritos federales y locales para este caso. `) +
          ejemploNombrar,
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
      // Pieza 1b: ¿es la clave de una SUGERENCIA por tecleo de este texto? Solo se acepta si está entre las
      // sugerencias que el servidor recalcula ahora (el modelo no puede fabricar una clave).
      const sugerida = sugerenciasDeTexto(texto, base, tipos).find((c) => c.clave === entrada.claveTerritorio);
      if (sugerida && !entrada.sugerenciaConfirmada) {
        return {
          ok: false,
          referencia: "clave_invalida",
          mensaje:
            `«${texto}» solo coincide con ${sugerida.etiqueta} como sugerencia por error de tecleo y el usuario todavía no lo confirmó. ` +
            "Pregúntale si quiso decir eso (con la etiqueta, nunca la clave) y espera su respuesta antes de volver a llamar.",
        };
      }
      if (sugerida) {
        const territorio = territorioDeCandidato(sugerida, opcionesCatalogo);
        return {
          ok: true,
          territorio,
          label: labelDeTerritorio(territorio),
          via: "sugerencia",
          sugerida: { clave: sugerida.clave, nombre: sugerida.nombre, etiqueta: sugerida.etiqueta },
          aviso: `«${texto}» se interpretó como ${sugerida.etiqueta} (sugerencia por error de tecleo, confirmada por el usuario).`,
        };
      }
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
  // Pieza 1b: nada se reconoce, pero puede ser un error de tecleo — se SUGIERE (nunca se resuelve).
  const sugerencias = sugerenciasDeTexto(texto, base, tipos);
  if (sugerencias.length > 0) {
    const cands = sugerencias.map(aCandidato);
    return { ok: false, referencia: "sugerencia", sugerencias: cands, mensaje: mensajeSugerencia(texto, cands) };
  }
  return { ok: false, referencia: "noResuelto", noResuelto: true };
}

/** Sugerencias por tecleo de un texto no reconocido, acotadas a los `tipos` de la consulta (si solo se admite
 *  municipio también se considera el estado, igual que el respaldo «pediste municipal y es un estado»). */
function sugerenciasDeTexto(
  texto: string,
  base: { estadoCve?: string; municipios: MunicipioCatalogoRef[] },
  tipos: TipoReferencia[]
): CandidatoReferencia[] {
  const soloMunicipio = tipos.length === 1 && tipos[0] === "municipio";
  const r = desambiguarReferencia(texto, { ...base, tipos: soloMunicipio ? ["estado", "municipio"] : tipos, sugerir: true });
  return r.estado === "ninguno" ? r.sugerencias ?? [] : [];
}

function mensajeSugerencia(texto: string, cands: CandidatoTerritorio[]): string {
  return (
    `«${texto}» no se reconoce. Puede ser un error de tecleo: ¿quisiste decir ${cands.map((c) => c.etiqueta).join(" o ")}? ` +
    "Pregúntaselo al usuario con esas ETIQUETAS (nunca las claves) y NO asumas ni corrijas el nombre por tu cuenta. " +
    `Solo cuando el usuario confirme una, vuelve a llamar con el MISMO territorioNombre («${texto}») y \`claveTerritorio\` = la clave de la opción confirmada (el servidor la verifica).`
  );
}
