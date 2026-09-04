// lib/geo/municipioCanonico.ts
// Normalización y clave canónica de nombre de municipio — LÓGICA PURA, sin
// dependencias de runtime (firebase, topojson, red). Extraída de
// lib/geo/municipios.ts (que la re-exporta, así que los importadores de
// `@/lib/geo/municipios` no cambian) para que también la puedan importar
// scripts de pipeline y cualquier código sin runtime de Next.
//
// PUNTO ÚNICO de resolución de nombre de municipio para todo el proyecto:
// tanto quien CONSTRUYE un mapa keyed por nombre (pipelines) como quien lo
// CONSULTA en tiempo de ejecución debe usar `claveCanonicaMunicipio` — nunca
// una normalización propia que pueda divergir (causa del fallo sistémico de
// resolución del catálogo del ITER, 2026-09-03).

// Quita acentos de nombres geográficos, preservando Ñ/Ü — igual criterio
// que app/api/geo/options/route.ts (GEO_ACCENT_MAP), aplica a NOMGEO del
// TopoJSON de municipios.
const GEO_ACCENT_MAP: Record<string, string> = {
  "Á":"A","À":"A","Â":"A","Ä":"A",
  "É":"E","È":"E","Ê":"E","Ë":"E",
  "Í":"I","Ì":"I","Î":"I","Ï":"I",
  "Ó":"O","Ò":"O","Ô":"O","Ö":"O",
  "Ú":"U","Ù":"U","Û":"U",
  "á":"A","à":"A","â":"A","ä":"A",
  "é":"E","è":"E","ê":"E","ë":"E",
  "í":"I","ì":"I","î":"I","ï":"I",
  "ó":"O","ò":"O","ô":"O","ö":"O",
  "ú":"U","ù":"U","û":"U",
  "ñ":"Ñ",
  "ü":"Ü",
};
export function normalizeGeoName(s: string): string {
  return s.split("").map((c) => GEO_ACCENT_MAP[c] ?? c).join("").toUpperCase();
}

// FIX DE FONDO — Incidente 2 (fragilidad del join por nombre, 2026-08-23,
// ver docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md).
// El join por nombre municipal (aprobado como reemplazo del join por
// CVE_MUN, Incidente 1) tiene su propia fragilidad: cada fuente externa
// (CONEVAL/CONAPO/ICMM/Bienestar) publica el nombre de municipio con su
// propia convención — prefijo honorífico/oficial ("San Pedro
// Tlaquepaque" vs. "Tlaquepaque"), sufijo histórico/gentilicio
// ("Cosamaloapan de Carpio" vs. "Cosamaloapan"), abreviatura ("Dr.
// Arroyo" vs. "Doctor Arroyo"), espaciado/diéresis ("Cuatro Ciénegas"
// vs. "Cuatrocienegas", "Güémez" vs. "Guemez") — que no siempre calza
// con el nombre oficial de Sefix/INE. Dimensionado en vivo, ~2,469
// municipios por fuente: CONAPO 26 (1.1%), CONEVAL 23 (0.9%), ICMM 24
// (1.0%), Bienestar 21 (32 estados completos, 0.9%).
//
// Nunca se resuelve con una regla genérica de "quitar prefijos
// comunes" — mismo tipo de riesgo que causó el Incidente 1 (una regla
// que parece segura pero colisiona sin aviso): "San Pedro Garza García"
// (Nuevo León) es un municipio real y distinto, no un caso de prefijo
// "San Pedro" a quitar. Cada alias de abajo es un caso verificado con
// evidencia real, nunca inferido por regla.
function collapseEspacios(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

// Envuelve normalizeGeoName() con la única transformación adicional
// mecánica y sin riesgo de colisión (espacios múltiples → uno) — nunca
// stripping de prefijos/sufijos con significado.
export function normalizarNombreMunicipio(s: string): string {
  return collapseEspacios(normalizeGeoName(s));
}

// Alias explícitos: `${estadoCve}` -> `{ nombreFuenteNormalizado ->
// nombreCanonicoSefixNormalizado }`. El valor SIEMPRE es el nombre tal
// como lo devuelve getMunicipiosOptions() para ese cve (ya pasado por
// normalizeGeoName), para que el resultado de claveCanonicaMunicipio()
// sea comparable directo contra las opciones de Sefix/INE sin paso
// adicional.
export const ALIAS_MUNICIPIO: Record<string, Record<string, string>> = {
  "05": { "CUATRO CIENEGAS": "CUATROCIENEGAS" },
  "07": {
    "VILLA COMALTITLAN": "VILLACOMALTITLAN",
    "CINTALAPA DE FIGUEROA": "CINTALAPA",
  },
  "08": { "BATOPILAS": "BATOPILAS DE MANUEL GOMEZ MORIN" },
  "10": { "GENERAL SIMON BOLIVAR": "SIMON BOLIVAR" },
  "11": { "SILAO": "SILAO DE LA VICTORIA" },
  "14": { "TLAQUEPAQUE": "SAN PEDRO TLAQUEPAQUE" },
  "15": {
    "ACAMBAY": "ACAMBAY DE RUIZ CASTAÑEDA",
    // Bienestar transcribe sin diacrítico en al menos este registro —
    // ver también el fix de encoding en bienestar.ts (chunk de red
    // partiendo un carácter multibyte), pero este caso NO es corrupción
    // de bytes (sale limpio "CASTANEDA", no mojibake) — es la forma en
    // que la fuente capturó el dato, se trata como alias, no como bug.
    "ACAMBAY DE RUIZ CASTANEDA": "ACAMBAY DE RUIZ CASTAÑEDA",
  },
  "16": { "TINGUINDIN": "TINGÜINDIN" }, // Bienestar, sin diéresis en la fuente
  "17": {
    "TLALTIZAPAN": "TLALTIZAPAN DE ZAPATA",
    "ZACUALPAN": "ZACUALPAN DE AMILPAS",
    "JONACATEPEC DE LEANDRO VALLE": "JONACATEPEC",
  },
  "19": {
    "EL CARMEN": "CARMEN",
    "DOCTOR ARROYO": "DR. ARROYO",
    "DOCTOR COSS": "DR. COSS",
    "DOCTOR GONZALEZ": "DR. GONZALEZ",
    "GENERAL BRAVO": "GRAL. BRAVO",
    "GENERAL ESCOBEDO": "GRAL. ESCOBEDO",
    "GENERAL TERAN": "GRAL. TERAN",
    "GENERAL TREVIÑO": "GRAL. TREVIÑO",
    "GENERAL ZARAGOZA": "GRAL. ZARAGOZA",
    "GENERAL ZUAZUA": "GRAL. ZUAZUA",
  },
  "20": {
    "SAN BLAS ATEMPA": "HEROICA VILLA DE SAN BLAS ATEMPA",
    "VILLA HIDALGO": "VILLA HIDALGO YALALAG",
    "VILLA DE TUTUTEPEC DE MELCHOR OCAMPO": "VILLA DE TUTUTEPEC",
    "TEZOATLAN DE SEGURA Y LUNA": "H VILLA TEZOATLAN SEGURA Y LUNA CUNA IND OAX",
    "HEROICA VILLA TEZOATLAN DE SEGURA Y LUNA, CUNA DE LA INDEPENDENCIA DE OAXACA": "H VILLA TEZOATLAN SEGURA Y LUNA CUNA IND OAX",
    // Bienestar: mismo municipio, campo truncado por la propia fuente
    // (límite de longitud del CKAN, no error de captura de Fontana).
    "HEROICA VILLA TEZOATLAN DE SEGURA Y LUNA, CUNA DE LA INDEPE": "H VILLA TEZOATLAN SEGURA Y LUNA CUNA IND OAX",
    "SAN MATEO YUCUTINDO": "SAN MATEO YUCUTINDOO",
    "JUCHITAN DE ZARAGOZA": "HEROICA CIUDAD DE JUCHITAN DE ZARAGOZA",
    "VILLA DE SANTIAGO CHAZUMBA": "SANTIAGO CHAZUMBA",
    // "SAN JUAN MIXTEPEC - DTO. 08/26" y "SAN PEDRO MIXTEPEC - DTO.
    // 22/26" NO se alias aquí — el catálogo de Sefix/INE tiene 2
    // municipios con el nombre IDÉNTICO "SAN JUAN MIXTEPEC" (cve
    // 208/209) y "SAN PEDRO MIXTEPEC" (cve 316/317), sin ningún campo
    // que los distinga. Mismo tipo de ambigüedad ya resuelto como "no
    // reconocido, nunca adivinar" en candidatosPorPalabraCompleta()
    // (caso Ixtlahuacán, más abajo en este archivo) — un alias aquí
    // forzaría a elegir uno de los 2 sin evidencia de cuál es. Se deja
    // sin resolver deliberadamente hasta que Sefix/INE distinga ambos
    // municipios en su propio catálogo.
  },
  "24": { "AHUALULCO DEL SONIDO 13": "AHUALULCO" },
  "28": { "GUEMEZ": "GÜEMEZ" }, // Bienestar, sin diéresis en la fuente
  "29": { "ZILTLALTEPEC DE TRINIDAD SANCHEZ SANTOS": "ZITLALTEPEC DE TRINIDAD SANCHEZ SANTOS" },
  "30": {
    "COSAMALOAPAN DE CARPIO": "COSAMALOAPAN",
    "MEDELLIN": "MEDELLIN DE BRAVO",
    "OZULUAMA DE MASCAREÑAS": "OZULUAMA",
    "ZONTECOMATLAN DE LOPEZ Y FUENTES": "ZONTECOMATLAN",
  },
};

// Punto único de entrada para CUALQUIER adaptador o pipeline de Fontana que
// construya o consulte un mapa de datos keyed por nombre de municipio
// (join por nombre) — nunca llamar normalizarNombreMunicipio() sola para
// ese propósito, para que los ~70 alias de arriba apliquen siempre desde
// un solo lugar, sin lógica repetida por archivo.
export function claveCanonicaMunicipio(estadoCve: string, nombre: string): string {
  const normalizado = normalizarNombreMunicipio(nombre);
  return ALIAS_MUNICIPIO[estadoCve]?.[normalizado] ?? normalizado;
}
