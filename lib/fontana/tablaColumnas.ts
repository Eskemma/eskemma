// lib/fontana/tablaColumnas.ts
// Set de columnas de la tabla comparativa por tipo de proyecto —
// Documentación Técnica §5.2: el tipo de proyecto decide el patrón de
// columnas OFRECIDO; el indicador decide cuáles de esas columnas
// muestran dato real (nunca una columna vacía sin motivo explícito).

import type { ProjectType } from "@/types/moddulo.types";
import type { NivelTerritorial, TipoAgregacionTerritorial } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

// "distrital_federal"/"distrital_local" — columnas inversas (Encargo
// "columnas inversas", cierre 2026-08-05): solo aparecen para proyectos
// de nivel "municipal" (columnasParaTipoProyecto recibe el nivel de
// territorio). Distinto de "distrital" (el distrito PROPIO de un
// proyecto distrito_federal/distrito_local, un solo valor) — aquí un
// proyecto Municipal necesita ver Federal Y Local simultáneamente.
export type NivelTablaFontana =
  | "nacional" | "estatal" | "distrital" | "municipal" | "ageb"
  | "distrital_federal" | "distrital_local";

const COLUMNAS_ELECTORAL: NivelTablaFontana[] = ["nacional", "estatal", "distrital", "municipal"];
// AGEB removida (cierre 2026-08-06): Fontana no tiene, ni tuvo nunca en
// ningún incremento, mecanismo de resolución a nivel AGEB — la celda
// mostraba MOTIVO_NIVEL_NO_CUBIERTO sin excepción, sin aportar
// información real. Ver decisión abajo.
const COLUMNAS_NO_ELECTORAL: NivelTablaFontana[] = ["nacional", "estatal", "municipal"];

// territorioNivel opcional (no todos los llamadores lo tienen a mano
// todavía) — cuando es "municipal", agrega Distrital Federal/Local al
// set ya calculado por tipo de proyecto, sin importar el tipo (el
// ejemplo de referencia, Ahome/Topolobampo, es un proyecto ciudadano,
// no electoral — columnas inversas no está restringido a electoral).
//
// "distrital" (genérica) se EXCLUYE del set cuando territorioNivel ===
// "municipal" O "nacional" (cierre 2026-08-06, Nacional se agrega al
// mismo criterio ya usado para Municipal) — confirmado sin caso
// legítimo de coexistencia: resolverDistrital (lib/fontana/ingesta/eceg.ts)
// solo produce un valor real cuando territorio.nivel es EXACTAMENTE
// distrito_federal/distrito_local; para un proyecto "municipal" o
// "nacional" esa celda siempre regresa el motivo "El proyecto no está
// definido a nivel distrital" — nunca un valor. Las columnas
// específicas (distrital_federal/distrital_local) la reemplazan por
// completo.
export function columnasParaTipoProyecto(tipo: ProjectType, territorioNivel?: NivelTerritorial): NivelTablaFontana[] {
  const base = tipo === "electoral" ? COLUMNAS_ELECTORAL : COLUMNAS_NO_ELECTORAL;
  if (territorioNivel !== "municipal" && territorioNivel !== "nacional") return base;
  return [...base.filter((nivel) => nivel !== "distrital"), "distrital_federal", "distrital_local"];
}

export const NOMBRE_NIVEL_TABLA: Record<NivelTablaFontana, string> = {
  nacional: "Nacional",
  estatal: "Estatal",
  distrital: "Distrital",
  municipal: "Municipal",
  ageb: "AGEB",
  distrital_federal: "Distrito Federal",
  distrital_local: "Distrito Local",
};

// Fontana no tiene, en este incremento, agregación nacional ni
// resolución distrital/AGEB — solo estatal y municipal (ver
// lib/fontana/ingesta/eceg.ts). Declarado explícitamente, nunca como
// columna vacía sin motivo.
export const MOTIVO_NIVEL_NO_CUBIERTO = "Nivel no cubierto en este incremento de Fontana";

// Umbral de precarga completa vs. modo buscador — 119 es el máximo real
// medido en producción para Distrito→Municipios (Oaxaca); se reutiliza
// como umbral único en todo el sistema, sin introducir un segundo número
// sin justificación (mismo criterio ya aplicado a UMBRAL_COBERTURA).
// Confirmado con medición de servidor + confirmación visual en navegador
// (Raúl, 2026-08-04) — cerrado y definitivo.
export const UMBRAL_PRECARGA_COMPLETA = 119;

// Desglose disponible para proyectos a nivel Estatal — botón "Ver
// municipios"/"Ver distritos federales"/"Ver distritos locales" bajo la
// celda municipal/distrital correspondiente (Encargo 2, modo
// buscador+selección múltiple, cierre 2026-08-04). Distinto de
// `municipiosEnDistrito` (que aplica solo a proyectos distrito_federal/
// distrito_local) — un proyecto Estatal no tiene fragmentación que
// advertir, cada municipio/distrito pertenece íntegro al estado.
// "estados" (cierre 2026-08-06) — botón "Ver estados" en la celda
// Estatal de proyectos Nacional, mismo campo/componente reutilizado
// por 3ª vez (Estatal, Municipal inverso, y ahora Nacional).
export interface DesgloseEstatal {
  tipo: "estados" | "municipios" | "distritos_fed" | "distritos_loc";
  total: number;
  modo: "precarga-completa" | "buscador";
}

// Forma de celda de la tabla comparativa — más amplia que CeldaFontana de
// lib/fontana/ingesta/eceg.ts (que solo resuelve estatal/municipal): esta
// cubre las 5 columnas posibles, con "valor" y "motivo" mutuamente
// excluyentes en la práctica (nunca ambos, nunca ninguno).
export interface CeldaTablaFontana {
  nivel: NivelTablaFontana;
  valor?: number;
  unidad?: string;
  naturaleza?: "dato_directo" | "calculo_directo" | "estimacion_modelada" | "estimacion_agregada" | "proxy_conceptual";
  fuenteEtiqueta?: string;
  motivo?: string;
  // Solo la celda "municipal" en proyectos distrito_federal, cuando el
  // indicador tiene mecanismo distrital de ECEG — cuántos municipios
  // componen el distrito del proyecto. > 1 habilita el botón "Ver datos
  // municipales" (Fontana T10, modal de desglose municipal).
  municipiosEnDistrito?: number;
  // Solo nivel "distrital" de ECEG — ver ValorIndicadorFontana.coberturaPct
  // (lib/fontana/ingesta/types.ts). < 99 dispara la advertencia de
  // cobertura incompleta en la UI.
  coberturaPct?: number;
  // Solo celda "distrital" (el distrito PROPIO del proyecto, distrito_federal/
  // distrito_local) — para que CoberturaAdvertencia identifique "federal"/
  // "local" en su texto (cierre 2026-08-06, un proyecto Municipal puede
  // tener Distrito Federal Y Local visibles a la vez, sin ambigüedad).
  tipoDistritoPropio?: "federal" | "local";
  // Solo F5-7 (SUN) — ver ValorIndicadorFontana.zonaMetropolitana
  // (lib/fontana/ingesta/types.ts). Dispara el chip "zona_metropolitana"
  // de CoberturaAdvertencia.
  zonaMetropolitana?: {
    nombre: string;
    numMunicipios: number;
    prorrateo?: { pctEstado: number; numEstados: number };
  };
  // Solo F3-4 (ENSU) — ver ValorIndicadorFontana.areaEnsu
  // (lib/fontana/ingesta/types.ts). Dispara el chip "area_ensu" de
  // CoberturaAdvertencia — NUNCA el mismo campo/chip que zonaMetropolitana
  // (decisión explícita 2026-08-27, ver comentario ahí).
  areaEnsu?: {
    nombre: string;
    numMunicipios: number;
    prorrateo?: { pctEstado: number; numEstados: number };
  };
  // Solo celdas "municipal" (tipo "municipios") y "distrital" (tipos
  // "distritos_fed"/"distritos_loc") de proyectos a nivel Estatal — ver
  // DesgloseEstatal arriba. También reutilizado por "distrital_federal"/
  // "distrital_local" en proyectos Municipal (columnas inversas,
  // municipio sin distrito dominante) — mismo campo, mismo botón, con
  // un solo elemento en el array (un municipio solo puede abrir el
  // desglose de SU tipo de distrito, no ambos desde una celda).
  desglosesEstado?: DesgloseEstatal[];
  // Solo celdas "distrital_federal"/"distrital_local" de proyectos
  // Municipal (columnas inversas) cuando el municipio SÍ tiene un
  // distrito dominante (≥50% de su POBTOT, o es el único que toca) —
  // nota discreta del % ya usada en el modal de fragmentación.
  municipioEnDistritoPct?: number;
  // Solo celdas "distrital_federal"/"distrital_local" de proyectos
  // Municipal cuando `coberturaMunicipioPct` del municipio del proyecto
  // es < 99% — dispara CoberturaAdvertencia en vez de fingir dominante/
  // sin-dominante (ninguno de los 2 es confiable con cobertura
  // incompleta). Evaluado ANTES que dominante/sin-dominante, misma
  // prioridad ya usada en el modal de fragmentación.
  municipioCoberturaPct?: number;
  // Fase 3 del rediseño de territorio (26-08-17) — solo poblado cuando
  // esTerritorioParcial(territorio) es true (2+ unidades seleccionadas
  // peer-a-peer) y este `nivel` corresponde al nivel real del territorio
  // del proyecto (estatal/municipal/distrital). Aditivo — nunca presente
  // para la mayoría de proyectos hoy (territorio singular), cero cambio
  // de shape ni de comportamiento para ese caso. `valorAgregado` es
  // `null` para indicadores `no_agregable` (desglose sin combinar, ver
  // CLAUDE.md/plan de Fase 3) — nunca se omite el desglose por eso.
  agregacionPlural?: {
    valorAgregado: CeldaFontana | null;
    desglosePorUnidad: { cve: string; nombre: string; estado: string; celda: CeldaFontana }[];
    // Ronda 6 (26-08-17) — unidades que el usuario declaró pero que no se
    // pudieron resolver contra el catálogo (nombre no reconocido o
    // ambiguo) — nunca se omiten en silencio, se listan con su motivo.
    noResueltas: { nombre: string; estado: string; motivo: string; candidatos?: string[] }[];
    // Ronda 6 (26-08-17) — tipo de cálculo real del valor combinado, para
    // la etiqueta "Combinado · suma/ponderado" en la UI. Ausente cuando el
    // indicador no está clasificado (el motivo ya lo deja explícito).
    tipoCalculo?: TipoAgregacionTerritorial;
  };
}
