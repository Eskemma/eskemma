// lib/fontana/ingesta/familia4.ts
// Resolver de Familia 4 (comparación internacional) — PARALELO a
// resolverIndicadorFontana (lib/fontana/ingesta/index.ts), no una rama
// dentro de él: esa función asume territorio mexicano
// (nacional/estatal/distrital/municipal) de punta a punta
// (completarA4Celdas, CeldaFontana.nivel) — Familia 4 compara países,
// nunca niveles geográficos. Confirmado en la investigación de esta
// ronda que forzarlo ahí habría requerido reinterpretar cada pieza de
// ese archivo sin necesidad real.
//
// Cada adaptador resuelve su propio Map<iso3, CeldaComparativaPais> vía
// Promise.allSettled interno (ver bancoMundial.ts) — este resolver solo
// enruta por indicadorId y arma la fila país principal + países de
// referencia.
//
// Ronda 6 (2026-08-22) — país principal dinámico: antes hardcodeado a
// México (MEXICO_ISO3), ahora recibe `paisPrincipalIso3` (ver
// resolverPaisPrincipal en familia4Catalogo.ts, único punto que decide
// el país principal a partir de territorio.pais).

import { PAISES_REFERENCIA_F4 } from "@/lib/fontana/familia4Catalogo";
import type { CeldaComparativaPais, FilaComparativaInternacional, PaisComparativoCompleto } from "@/lib/fontana/tablaComparativaInternacional";
import { resolverBancoMundial, resolverBancoMundialTodos } from "@/lib/fontana/ingesta/bancoMundial";
import { resolverCepalstat, resolverCepalstatTodos } from "@/lib/fontana/ingesta/cepalstat";
import { resolverPnudHdr, resolverPnudHdrTodos } from "@/lib/fontana/ingesta/pnudHdr";
import { resolverEiuDemocracyIndex, resolverEiuDemocracyIndexTodos } from "@/lib/fontana/ingesta/eiuDemocracyIndex";
import { resolverTransparencyInternational, resolverTransparencyInternationalTodos } from "@/lib/fontana/ingesta/transparencyInternational";
import { resolverRsf, resolverRsfTodos } from "@/lib/fontana/ingesta/rsf";

const CELDA_SIN_MECANISMO = (iso3: string): CeldaComparativaPais => ({
  iso3,
  estadoConsulta: "fuente_no_disponible",
  motivo: "Conector pendiente para este indicador",
});

export async function resolverIndicadorComparativoF4(indicadorId: string, paisPrincipalIso3: string): Promise<FilaComparativaInternacional> {
  const isos3 = [paisPrincipalIso3, ...PAISES_REFERENCIA_F4.map((p) => p.iso3)];

  let porPais: Map<string, CeldaComparativaPais>;
  if (indicadorId === "F4-1" || indicadorId === "F4-4" || indicadorId === "F4-5") {
    porPais = await resolverBancoMundial(indicadorId, isos3);
  } else if (indicadorId === "F4-2" || indicadorId === "F4-9" || indicadorId === "F4-10" || indicadorId === "F4-11") {
    porPais = await resolverCepalstat(indicadorId, isos3);
  } else if (indicadorId === "F4-3") {
    porPais = await resolverPnudHdr(isos3);
  } else if (indicadorId === "F4-6") {
    porPais = await resolverEiuDemocracyIndex(isos3);
  } else if (indicadorId === "F4-7") {
    porPais = await resolverTransparencyInternational(isos3);
  } else if (indicadorId === "F4-8") {
    porPais = await resolverRsf(isos3);
  } else {
    porPais = new Map(isos3.map((iso3) => [iso3, CELDA_SIN_MECANISMO(iso3)]));
  }

  return {
    indicadorId,
    paisPrincipal: porPais.get(paisPrincipalIso3) ?? CELDA_SIN_MECANISMO(paisPrincipalIso3),
    referencia: PAISES_REFERENCIA_F4.map((p) => porPais.get(p.iso3) ?? CELDA_SIN_MECANISMO(p.iso3)),
  };
}

// Todos los países reales con dato para un indicador — para el modal
// "Ver resto de países" (Punto B, Ronda 6). Un solo dispatcher por
// indicador, mismo criterio que resolverIndicadorComparativoF4 — cada
// adaptador ya expone su propia variante "Todos" reusando el mismo fetch
// cacheado que la fila principal (sin duplicar llamadas de red).
export async function resolverTodosLosPaisesF4(indicadorId: string): Promise<PaisComparativoCompleto[]> {
  if (indicadorId === "F4-1" || indicadorId === "F4-4" || indicadorId === "F4-5") {
    return resolverBancoMundialTodos(indicadorId);
  }
  if (indicadorId === "F4-2" || indicadorId === "F4-9" || indicadorId === "F4-10" || indicadorId === "F4-11") {
    return resolverCepalstatTodos(indicadorId);
  }
  if (indicadorId === "F4-3") return resolverPnudHdrTodos();
  if (indicadorId === "F4-6") return resolverEiuDemocracyIndexTodos();
  if (indicadorId === "F4-7") return resolverTransparencyInternationalTodos();
  if (indicadorId === "F4-8") return resolverRsfTodos();
  return [];
}
