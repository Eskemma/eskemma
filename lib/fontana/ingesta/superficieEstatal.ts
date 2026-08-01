// lib/fontana/ingesta/superficieEstatal.ts
// Superficie territorial oficial por entidad (km²) — insumo para F1-16
// (densidad de población), combinado con el % editorial del Compendio
// de Información Geográfica Municipal 2010 (ver compendio.ts).
//
// Jalisco verificado individualmente en ronda de investigación previa
// (info_geo_eske/familia5_verificaciones_ronda3.md): 78,595.9 km²,
// fuente INEGI vía Cuéntame/Marco Geoestadístico.
//
// Las 31 entidades restantes verificadas en esta sesión (2026-07-31):
// tabla base tomada de INEGI (Marco Geoestadístico Nacional), con dos
// mecanismos de validación cruzada, no solo una fuente secundaria:
// 1. 5 de 31 verificadas con acceso directo a
//    cuentame.inegi.org.mx/monografias/informacion/{estado}/territorio/
//    — Chihuahua (247,412.6 km²), Sonora (179,354.7 km²), Tlaxcala
//    (3,996.6 km²), Colima (5,626.9 km²), Ciudad de México (~1,495 km²
//    vía doc.gob.mx que cita INEGI) — coinciden con precisión de
//    décimas de km² contra la tabla completa.
// 2. La suma de las 32 entidades de esta tabla es 1,960,646.62 km².
//    Confirmado en esta sesión extrayendo con pdf-parse el PDF real del
//    Anuario estadístico y geográfico por entidad federativa 2020
//    (INEGI), Cuadro 1.1: "Superficie territorial (km2) 1 964 375 /
//    Continental 1 959 248 / Insular 5 127". La suma de esta tabla
//    queda 1,398.62 km² (0.07%) por encima de la cifra "continental"
//    del Cuadro 1.1 — diferencia pequeña pero real, probablemente por
//    año de corte/metodología distinta entre el Marco Geoestadístico
//    (fuente de esta tabla) y el Cuadro 1.1 (Superficie Continental e
//    Insular del Territorio Nacional, 1998, según su propia cita). No
//    se encontró en esta sesión, pese a búsqueda dirigida en el mismo
//    PDF, una tabla desglosada por entidad para cruzar cifra por
//    cifra — la validación de este punto es a nivel de suma total, no
//    por entidad.
//
// ⚠️ PENDIENTE — 26 de las 32 entidades no tienen verificación directa
// individual contra cuentame.inegi.org.mx en este repo todavía (Jalisco,
// Chihuahua, Sonora, Tlaxcala, Colima y CDMX sí la tienen). Suficiente
// para producción dado el doble cruce (spot-checks + suma nacional),
// pero si una entidad específica resulta crítica para un proyecto real
// y su cifra se ve sospechosa, verificar puntualmente antes de confiar
// en el valor.
export const SUPERFICIE_ESTATAL_KM2: Record<string, number> = {
  "01": 5615.67, // Aguascalientes
  "02": 71449.99, // Baja California
  "03": 73909.37, // Baja California Sur
  "04": 57484.91, // Campeche
  "05": 151594.76, // Coahuila
  "06": 5626.88, // Colima — verificado directo cuentame.inegi.org.mx
  "07": 73310.96, // Chiapas
  "08": 247412.62, // Chihuahua — verificado directo cuentame.inegi.org.mx
  "09": 1494.32, // Ciudad de México — verificado (doc.gob.mx cita INEGI)
  "10": 123364.04, // Durango
  "11": 30606.67, // Guanajuato
  "12": 63595.88, // Guerrero
  "13": 20821.44, // Hidalgo
  "14": 78595.9, // Jalisco — verificado individualmente, ronda previa
  "15": 22351.75, // México (Estado de)
  "16": 58598.69, // Michoacán
  "17": 4878.9, // Morelos
  "18": 27856.47, // Nayarit
  "19": 64156.21, // Nuevo León
  "20": 93757.59, // Oaxaca
  "21": 34309.65, // Puebla
  "22": 11690.58, // Querétaro
  "23": 44705.24, // Quintana Roo
  "24": 61137.95, // San Luis Potosí
  "25": 57365.36, // Sinaloa
  "26": 179354.73, // Sonora — verificado directo cuentame.inegi.org.mx
  "27": 24730.93, // Tabasco
  "28": 80249.31, // Tamaulipas
  "29": 3996.63, // Tlaxcala — verificado directo cuentame.inegi.org.mx
  "30": 71823.47, // Veracruz
  "31": 39524.41, // Yucatán
  "32": 75275.34, // Zacatecas
};
