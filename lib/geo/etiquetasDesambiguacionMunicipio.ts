// lib/geo/etiquetasDesambiguacionMunicipio.ts
// Etiqueta de desambiguación PURAMENTE DE PRESENTACIÓN para el picker de
// municipios ambiguos (Incidente 2, Verificación 1, 2026-08-23). Módulo
// aparte, sin dependencias server-only (a diferencia de
// lib/geo/municipios.ts, que importa firebase-admin) — así
// TerritorySelector.tsx (componente cliente) lo importa directo, sin
// pasar por una API route.
//
// Casos donde 2 municipios reales del mismo estado tienen el nombre
// LITERALMENTE idéntico en el catálogo de Sefix/INE (no solo un nombre
// parecido, como Ixtlahuacán, cuyos 2 candidatos ya tienen nombres
// distintos y por tanto el picker ya los distingue sin ayuda). Confirmado
// con un grep del catálogo completo (32 estados, 2026-08-23): son
// EXACTAMENTE estos 2 pares — Oaxaca "SAN JUAN MIXTEPEC" (208/209) y
// "SAN PEDRO MIXTEPEC" (316/317), ningún otro caso en todo el país.
//
// La correspondencia cve→"Dto." se verificó con evidencia real —
// comparación de población (POBTOT de la bodega ECEG,
// sefix/eceg_2020/municipios/20.json) contra el POB_TOT de CONAPO
// (IMM_2020.xls, que sí distingue por nombre "-Dto. NN") — 2
// coincidencias EXACTAS (209↔607, 317↔972) y 2 del mismo orden de
// magnitud (208≈6941/7118, 316≈49780/48946, diferencia de vintage
// censal normal, mismo tipo de variación ya vista en Tuxtla Gutiérrez).
// Nunca se usó el cve_geo de ANVCC para esto — se intentó primero y
// arrojó nombres DISTINTOS ("San Pedro Mártir Quiechapa"/"Yucuxaco" para
// 316/317), lo que hubiera sido un alias incorrecto; la numeración de
// ANVCC para este clúster específico de Oaxaca no corresponde 1:1 con la
// de Sefix/INE — mismo tipo de cautela que ya motivó todo el Incidente
// 1, aplicada aquí antes de publicar el dato, no después.
//
// Nunca se usa para resolver el join de datos — el nombre canónico que
// usan coneval.ts/conapoMarginacion.ts/etc. sigue siendo el mismo "SAN
// JUAN MIXTEPEC"/"SAN PEDRO MIXTEPEC" literal; esos 4 municipios siguen
// sin alias en ALIAS_MUNICIPIO (lib/geo/municipios.ts), deliberadamente.
const ETIQUETA_DESAMBIGUACION_MUNICIPIO: Record<string, string> = {
  "20208": "Dto. 08",
  "20209": "Dto. 26",
  "20316": "Dto. 22",
  "20317": "Dto. 26",
};

export function etiquetaDesambiguacionMunicipio(estadoCve: string, cve: string): string | null {
  return ETIQUETA_DESAMBIGUACION_MUNICIPIO[`${estadoCve}${cve}`] ?? null;
}
