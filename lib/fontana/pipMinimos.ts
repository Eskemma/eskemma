// lib/fontana/pipMinimos.ts
// Deriva los indicadores "mínimos" de Fontana a partir del texto real de
// la pregunta del PIP asignada a T10 en el proyecto activo — nunca de una
// tabla por tipo de proyecto (ver docs/ecosistema/_contexto-moddulo.md,
// §§1-2: los mínimos son función del PIP de ESTE proyecto, no del tipo).
//
// Mapa completo de los 84 indicadores del catálogo (no solo Familia 1):
// una misma frase de una pregunta del PIP puede apuntar a indicadores de
// más de una familia (ver
// docs/ecosistema/T10-fontana/Fontana_T10_Palabras_Clave_Indicadores.md,
// columna "Vínculos cruzados"). Construir esto solo para Familia 1
// obligaría a reconstruirlo cuando se abran las familias 2-5. Este
// incremento solo entrega Familia 1 con datos reales — el resto de la
// tabla queda poblado pero inerte (ver derivarMinimosFamilia1 abajo).
//
// Tres reglas de desambiguación de la misma tabla, aplicadas como frases
// completas (nunca palabra suelta):
//   1. "seguridad" — "seguridad pública"/"inseguridad"/"delincuencia"/
//      "crimen" (Familia 3) vs. "seguridad social"/"afiliación a salud"/
//      "prestaciones laborales" (F2-13).
//   2. "rezago" — "rezago social" (F2-3), "rezago de vivienda" (F5-17),
//      "rezago educativo" (F1-13) son conceptos distintos.
//   3. "PIB" — F4-1 (nacional/internacional), F5-15 (municipal), F5-16
//      (turístico municipal) no son intercambiables, igual que los "3 Gini
//      de México" del catálogo (F2-6/F4-2, tampoco intercambiables).

export interface ConceptoIndicador {
  frases: string[]; // frases completas (no palabras sueltas cuando aplica desambiguación)
  indicadorIds: string[]; // incluye vínculos cruzados documentados; excluye pares "no intercambiables"
}

export const CONCEPTOS_INDICADOR: ConceptoIndicador[] = [
  // ── Familia 1 — Sociodemográficos (activa en este incremento) ──
  { frases: ["población total", "número de habitantes", "cuántos habitantes", "tamaño poblacional"], indicadorIds: ["F1-1"] },
  { frases: ["grupos etarios", "pirámide de edad", "por edad", "estructura etaria", "generacional", "reemplazo generacional"], indicadorIds: ["F1-2"] },
  { frases: ["población indígena", "comunidad indígena", "pueblos originarios"], indicadorIds: ["F1-3", "F2-3", "F2-4"] },
  { frases: ["jefatura femenina", "hogares con jefa de familia", "mujeres jefas de hogar"], indicadorIds: ["F1-4", "F2-19"] },
  { frases: ["escolaridad", "nivel educativo", "años de estudio", "grado promedio"], indicadorIds: ["F1-5", "F2-15", "F2-20"] },
  { frases: ["migración", "población inmigrante", "migrantes", "población que llegó de otro lugar"], indicadorIds: ["F1-6", "F1-17"] },
  { frases: ["adultos mayores", "población de la tercera edad", "envejecimiento poblacional"], indicadorIds: ["F1-7", "F1-18"] },
  { frases: ["piso de tierra", "condiciones de vivienda precarias", "vivienda precaria"], indicadorIds: ["F1-8", "F2-1", "F2-2", "F5-17"] },
  { frases: ["hacinamiento", "ocupantes por cuarto", "densidad habitacional"], indicadorIds: ["F1-9"] },
  { frases: ["servicios básicos", "agua potable", "drenaje", "electricidad en vivienda"], indicadorIds: ["F1-10", "F2-1", "F2-2", "F5-17"] },
  { frases: ["urbano rural", "distribución territorial", "ruralidad", "dispersión poblacional"], indicadorIds: ["F1-11", "F5-8"] },
  { frases: ["estado civil", "soltería", "situación conyugal"], indicadorIds: ["F1-12"] },
  { frases: ["analfabetismo", "sin escolaridad", "rezago educativo"], indicadorIds: ["F1-13", "F2-3"] },
  { frases: ["educación superior", "bachillerato", "nivel de estudios avanzado"], indicadorIds: ["F1-14", "F2-20"] },
  { frases: ["discapacidad", "personas con discapacidad", "población con alguna limitación"], indicadorIds: ["F1-15"] },
  { frases: ["densidad poblacional", "concentración de población", "dispersión territorial"], indicadorIds: ["F1-16"] },
  { frases: ["remesas", "envíos de dinero del extranjero", "ingresos por migración"], indicadorIds: ["F1-17", "F1-6"] },
  { frases: ["dependencia demográfica", "población económicamente activa vs. dependiente"], indicadorIds: ["F1-18", "F1-7"] },
  { frases: ["monolingüe", "lengua indígena exclusiva", "no habla español"], indicadorIds: ["F1-19", "F1-3"] },

  // ── Familia 2 — Socioeconómicos (pendiente — se activa cuando exista Familia 2 en Fontana) ──
  { frases: ["pobreza", "población en pobreza", "condiciones de pobreza"], indicadorIds: ["F2-1", "F1-8", "F1-10"] },
  { frases: ["pobreza extrema", "pobreza alimentaria", "carencia severa"], indicadorIds: ["F2-2", "F1-8", "F1-10"] },
  { frases: ["rezago social"], indicadorIds: ["F2-3", "F1-3", "F1-13"] }, // regla 2 — nunca "rezago" sola
  { frases: ["marginación", "grado de marginación"], indicadorIds: ["F2-4", "F1-3", "F1-8", "F1-10"] },
  { frases: ["desarrollo humano", "idh"], indicadorIds: ["F2-5", "F2-19", "F2-20", "F2-21", "F2-22"] },
  { frases: ["desigualdad de ingreso", "coeficiente de gini", "distribución del ingreso"], indicadorIds: ["F2-6", "F2-12"] }, // NO F4-2 — no intercambiables
  { frases: ["producción para el bienestar", "apoyo al campo", "programa agrícola federal"], indicadorIds: ["F2-7"] },
  { frases: ["beca benito juárez", "beca educativa federal"], indicadorIds: ["F2-8", "F1-5", "F1-13", "F1-14"] },
  { frases: ["informalidad laboral", "empleo informal", "sin prestaciones"], indicadorIds: ["F2-9", "F2-13"] },
  { frases: ["salario", "ingreso laboral", "remuneración"], indicadorIds: ["F2-10", "F2-6", "F2-12"] },
  { frases: ["internet", "conectividad digital", "acceso a tecnología"], indicadorIds: ["F2-11", "F5-8"] },
  { frases: ["deciles de ingreso", "concentración del ingreso"], indicadorIds: ["F2-12", "F2-6"] },
  { frases: ["seguridad social", "afiliación a salud", "prestaciones laborales"], indicadorIds: ["F2-13", "F2-9"] }, // regla 1
  { frases: ["carencia social", "carencias"], indicadorIds: ["F2-14", "F2-1", "F2-2"] },
  { frases: ["gasto en educación", "inversión educativa del hogar"], indicadorIds: ["F2-15", "F1-5"] },
  { frases: ["gasto en salud", "inversión en salud del hogar"], indicadorIds: ["F2-16", "F2-22"] },
  { frases: ["competitividad estatal", "entorno de negocios", "clima para invertir"], indicadorIds: ["F2-17", "F5-6"] },
  { frases: ["ingreso municipal", "ingreso corriente"], indicadorIds: ["F2-18", "F5-15"] },
  { frases: ["desigualdad de género", "brecha de género"], indicadorIds: ["F2-19", "F1-4"] },
  { frases: ["idh educación"], indicadorIds: ["F2-20", "F1-5", "F1-14", "F2-5"] },
  { frases: ["idh ingreso"], indicadorIds: ["F2-21", "F2-6", "F2-12", "F2-5"] },
  { frases: ["idh salud"], indicadorIds: ["F2-22", "F2-16", "F2-5"] },

  // ── Familia 3 — Geopolíticos (pendiente — se activa cuando exista Familia 3 en Fontana) ──
  { frases: ["homicidios", "violencia letal", "tasa de homicidios"], indicadorIds: ["F3-1", "F3-17"] },
  { frases: ["delincuencia", "incidencia delictiva", "delitos"], indicadorIds: ["F3-2", "F3-1"] },
  { frases: ["victimización", "población víctima de delito"], indicadorIds: ["F3-3", "F3-2"] },
  { frases: ["percepción de inseguridad", "sensación de inseguridad", "miedo al delito", "inseguridad"], indicadorIds: ["F3-4"] }, // regla 1
  { frases: ["resultados electorales", "votación", "quién ganó la elección"], indicadorIds: ["F3-5", "F3-9", "F3-10", "F3-11", "F3-12", "F3-13", "F3-14"] },
  { frases: ["participación electoral", "quién vota", "abstención histórica"], indicadorIds: ["F3-6", "F3-9"] },
  { frases: ["gasto federal", "recursos federales", "presupuesto federal transferido"], indicadorIds: ["F3-7"] },
  { frases: ["zonas de atención prioritaria", "zap", "pobreza territorial focalizada"], indicadorIds: ["F3-8", "F2-1", "F2-4"] },
  { frases: ["abstención", "no votó", "ausentismo electoral"], indicadorIds: ["F3-9", "F3-6"] },
  { frases: ["volatilidad electoral", "cambio de voto entre elecciones"], indicadorIds: ["F3-10", "F3-12", "F3-13"] },
  { frases: ["voto nulo", "votos no registrados"], indicadorIds: ["F3-11", "F3-5"] },
  { frases: ["margen de victoria", "ventaja electoral", "qué tan cerrada la elección"], indicadorIds: ["F3-12", "F3-14"] },
  { frases: ["continuidad", "alternancia", "mismo partido en el poder"], indicadorIds: ["F3-13", "F3-10"] },
  { frases: ["competitividad electoral", "elección competida"], indicadorIds: ["F3-14", "F3-12"] },
  { frases: ["organizaciones sociales", "sociedad civil", "colectivos"], indicadorIds: ["F3-15"] },
  { frases: ["huelgas", "paros laborales", "conflicto laboral"], indicadorIds: ["F3-16", "F2-9"] },
  { frases: ["paz", "nivel de violencia relativa", "entorno de seguridad estatal", "seguridad pública"], indicadorIds: ["F3-17", "F3-1"] }, // regla 1

  // ── Familia 4 — Comparación internacional (pendiente — se activa cuando exista Familia 4 en Fontana) ──
  { frases: ["pib per cápita", "producto interno bruto", "comparación económica internacional"], indicadorIds: ["F4-1"] }, // regla 3 — NO F5-15/F5-16
  { frases: ["desigualdad internacional", "gini comparado"], indicadorIds: ["F4-2"] }, // NO F2-6 — no intercambiables
  { frases: ["desarrollo humano internacional", "ranking idh mundial"], indicadorIds: ["F4-3"] }, // NO F2-5
  { frases: ["pobreza internacional", "línea de pobreza global"], indicadorIds: ["F4-4"] }, // NO F2-1/F2-2
  { frases: ["inflación", "incremento de precios", "poder adquisitivo"], indicadorIds: ["F4-5"] },
  { frases: ["calidad democrática", "régimen político", "democracia comparada"], indicadorIds: ["F4-6"] },
  { frases: ["corrupción", "percepción de corrupción", "transparencia"], indicadorIds: ["F4-7"] },
  { frases: ["libertad de prensa", "libertad de expresión", "censura"], indicadorIds: ["F4-8"] },
  { frases: ["confianza institucional", "credibilidad de instituciones"], indicadorIds: ["F4-9", "F3-15"] },

  // ── Familia 5 — Características territoriales (pendiente — se activa cuando exista Familia 5 en Fontana) ──
  { frases: ["geografía", "cartografía", "límites territoriales", "relieve"], indicadorIds: ["F5-1"] },
  { frases: ["clima", "temperatura", "precipitación", "condiciones climáticas"], indicadorIds: ["F5-2"] },
  { frases: ["historia local", "antecedentes históricos", "patrimonio histórico"], indicadorIds: ["F5-3", "F5-4"] },
  { frases: ["personajes célebres", "figuras históricas locales"], indicadorIds: ["F5-4", "F5-3"] },
  { frases: ["tradiciones", "fiestas patronales", "festividades", "calendario cultural"], indicadorIds: ["F5-5"] },
  { frases: ["actividad económica", "zonas comerciales", "unidades económicas"], indicadorIds: ["F5-6", "F2-17"] },
  { frases: ["zonas habitacionales", "uso de suelo", "zonas metropolitanas"], indicadorIds: ["F5-7", "F1-8", "F1-10", "F5-17"] },
  { frases: ["conectividad física", "comunicación terrestre", "aislamiento territorial"], indicadorIds: ["F5-8", "F1-11", "F2-11"] },
  { frases: ["turismo", "atractivos turísticos", "destinos turísticos"], indicadorIds: ["F5-9", "F5-16"] },
  { frases: ["medio ambiente", "problemática ambiental", "ecología"], indicadorIds: ["F5-10", "F5-11", "F5-12", "F5-13", "F5-14"] },
  { frases: ["incendios forestales", "incendios"], indicadorIds: ["F5-11", "F5-12"] },
  { frases: ["superficie incendiada", "hectáreas quemadas"], indicadorIds: ["F5-12", "F5-11"] },
  { frases: ["desastre natural", "declaratoria de desastre", "emergencia ambiental"], indicadorIds: ["F5-13", "F5-10"] },
  { frases: ["área natural protegida", "anp", "conservación ambiental"], indicadorIds: ["F5-14", "F5-10"] },
  { frases: ["pib municipal", "producto interno bruto local"], indicadorIds: ["F5-15", "F2-18"] }, // regla 3 — NO F4-1
  { frases: ["pib turístico", "economía turística local"], indicadorIds: ["F5-16", "F5-9"] }, // regla 3 — NO F4-1/F5-15
  { frases: ["rezago de vivienda", "vivienda con rezago"], indicadorIds: ["F5-17", "F1-8", "F1-10"] }, // regla 2
];

// Minúsculas + sin diacríticos, para matching robusto en español sin
// depender de que la pregunta capturada por M1 use acentos consistentes.
function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function derivarMinimosPIP(pregunta: string, justificacion?: string): string[] {
  const texto = normalizar(`${pregunta} ${justificacion ?? ""}`);
  const ids = CONCEPTOS_INDICADOR
    .filter((c) => c.frases.some((frase) => texto.includes(normalizar(frase))))
    .flatMap((c) => c.indicadorIds);
  return [...new Set(ids)];
}

// Este incremento solo construyó Familia 1 — filtra a lo único con
// candado real que dibujar. El resto de CONCEPTOS_INDICADOR ya queda
// poblado para cuando existan Familia 2-5 en Fontana, sin reconstruir la
// tabla ni el mecanismo de matching.
export function derivarMinimosFamilia1(pregunta: string, justificacion?: string): string[] {
  return derivarMinimosPIP(pregunta, justificacion).filter((id) => id.startsWith("F1-"));
}
