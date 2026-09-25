// lib/geo/unidadesTerritoriales.ts
// Paso 2b de la desambiguación geográfica (26-09-24): un Territorio como CONJUNTO de unidades
// con clave estable, para comparar territorios plurales por conjuntos y no por su primer
// elemento. Módulo puro (sin firebase/red): importable desde cliente, servidor y scripts.
// Reutilizable por los Pasos 3 y 4 (Fontana y Moddulo sobre el núcleo de desambiguación).
//
// Claves por unidad (por NOMBRE, nunca por el `cve` de INE — ver
// docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md):
//   · nacional  → "NAC" (el país se compara aparte)
//   · estatal   → CVE de estado de 2 dígitos ("14")
//   · municipal → `MunicipioSeleccionado.clave` ("14:GUADALAJARA"); si la entrada no la trae,
//                 clave DERIVADA del nombre con la misma canonicalización y `estructural=false`
//   · distrito  → código de 4 dígitos (estado + distrito, "0927")
//
// `estructural` dice si TODAS las unidades vienen de un dato estructurado (no de interpretar
// texto). Solo entonces una igualdad puede ser "exact" (regla vigente: nunca se concede
// "exact" por interpretar texto).

import type { NivelTerritorial, Territorio } from "@/types/shared.types";
import { resolverEstadoCve } from "@/lib/geo/estados";
import { claveComparacionMunicipio, normalizeGeoName, plegarDiacriticosGeo } from "@/lib/geo/municipioCanonico";
import { municipiosDeTerritorio } from "@/lib/geo/municipioSeleccionado";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";

export interface UnidadesTerritorio {
  nivel: NivelTerritorial;
  /** País plegado (sin acentos, mayúsculas), o null si el territorio no lo declara. */
  pais: string | null;
  /** Claves estables de las unidades, en el formato de su nivel (ver cabecera). */
  claves: ReadonlySet<string>;
  /** CVE de estado de cada unidad (o "EXT:<texto>" para estados fuera de México). */
  estados: ReadonlySet<string>;
  /** true = todas las unidades vienen de datos estructurados; false = alguna se derivó de texto. */
  estructural: boolean;
}

/** Texto comparable: sin acentos, mayúsculas, espacios colapsados. */
export const claveTextoGeo = (s: string): string => plegarDiacriticosGeo(normalizeGeoName(s)).replace(/\s+/g, " ").trim();

/** CVE de un estado mexicano; para un estado no mexicano (p. ej. un departamento de Colombia), "EXT:<texto>". */
export function claveEstadoComparable(estado: string | null | undefined): string {
  if (!estado) return "";
  return resolverEstadoCve(estado) ?? `EXT:${claveTextoGeo(estado)}`;
}

const esNivelDistrito = (nivel: NivelTerritorial): boolean =>
  nivel === "distrito_federal" || nivel === "distrito_local" || nivel === "distrito";

/** Código de 4 dígitos (estado + distrito de 2) desde un `cve` de distrito de 3 dígitos ("027" → "0927"). */
function codigoDistrito(estadoClave: string, numero: string): string {
  return `${estadoClave}${String(Number(numero)).padStart(2, "0")}`;
}

export function unidadesDeTerritorio(t: Territorio): UnidadesTerritorio {
  const claves = new Set<string>();
  const estados = new Set<string>();
  let estructural = true;
  const pais = t.pais ? claveTextoGeo(t.pais) : null;

  if (t.nivel === "nacional") {
    claves.add("NAC");
  } else if (t.nivel === "estatal") {
    const lista = t.estadosSeleccionados?.length ? t.estadosSeleccionados : t.estado ? [t.estado] : [];
    for (const e of lista) {
      const c = claveEstadoComparable(e);
      if (c) {
        claves.add(c);
        estados.add(c);
      }
    }
  } else if (t.nivel === "municipal") {
    let lista = municipiosDeTerritorio(t);
    if (!lista.length && t.municipio) lista = [{ nombre: t.municipio, estado: t.estado ?? "" }];
    for (const m of lista) {
      const ec = claveEstadoComparable(m.estado || t.estado);
      estados.add(ec);
      if (m.clave) {
        claves.add(plegarDiacriticosGeo(m.clave));
      } else {
        estructural = false;
        claves.add(`${ec}:${claveComparacionMunicipio(ec, m.nombre)}`);
      }
    }
  } else if (esNivelDistrito(t.nivel)) {
    if (t.distritosSeleccionados?.length) {
      for (const d of t.distritosSeleccionados) {
        const ec = claveEstadoComparable(d.estado ?? t.estado);
        estados.add(ec);
        claves.add(codigoDistrito(ec, d.cve));
      }
    } else {
      const ec = claveEstadoComparable(t.estado);
      if (ec) estados.add(ec);
      const numero = extraerNumeroDistrito(t.municipio ?? t.nombre, t.cve_distrito);
      if (numero) {
        claves.add(codigoDistrito(ec, numero));
        // Sin `cve_distrito` el número salió de texto libre: nunca "exact".
        if (!t.cve_distrito) estructural = false;
      }
      // Sin número resoluble no se inventa una clave: el conjunto queda vacío (ver compararTerritorios).
    }
  }
  return { nivel: t.nivel, pais, claves, estados, estructural };
}

export type RelacionTerritorial =
  /** Mismo conjunto de unidades. */
  | "igual"
  /** El primero contiene TODAS las unidades del segundo (y más). */
  | "cubre"
  /** El segundo contiene todas las unidades del primero (y más). */
  | "cubierto"
  /** Comparten algunas unidades, ninguno contiene al otro. */
  | "traslape"
  /** Ninguna unidad en común. */
  | "disjunto"
  /** No hay forma honesta de decidir (niveles distintos, o sin unidades resolubles). */
  | "no_comparable";

/** Relación entre dos conjuntos de claves del MISMO nivel. Conjuntos vacíos → "no_comparable". */
export function relacionDeConjuntos(a: ReadonlySet<string>, b: ReadonlySet<string>): RelacionTerritorial {
  if (a.size === 0 || b.size === 0) return "no_comparable";
  let comunes = 0;
  for (const k of a) if (b.has(k)) comunes++;
  if (comunes === 0) return "disjunto";
  if (comunes === a.size && comunes === b.size) return "igual";
  if (comunes === b.size) return "cubre";
  if (comunes === a.size) return "cubierto";
  return "traslape";
}
