# Fuentes de claves geográficas conocidas como no confiables

**Consulta obligatoria antes de investigar o construir cualquier adaptador de
Fontana (o de cualquier otro módulo) que cruce datos por clave municipal
(`CVE_MUN`) o estatal.** Este documento existe porque el mismo tipo de bug ya
apareció 3 veces en el proyecto (`iter.ts` 26-07-31, `icmm.ts` 26-08-09,
incidente completo abajo 26-08-23) antes de que hubiera un lugar central
donde consultarlo — no dependas de recordar un comentario suelto en otro
archivo.

## La regla

**Nunca cruces (JOIN) dos fuentes de datos geográficos mexicanos por
`CVE_MUN` numérico si no has verificado, con evidencia real, que ambas
fuentes usan la MISMA numeración.** Dos catálogos que en apariencia son "el
estándar INEGI" pueden tener numeraciones distintas para el mismo municipio
sin ningún aviso — el cruce por CVE produce silenciosamente el valor de
OTRO municipio, no un error visible ni un "sin dato".

**Alternativa segura por defecto: cruza por NOMBRE de municipio normalizado
(`normalizeGeoName()`, `lib/geo/municipios.ts`), usando el nombre TAL COMO
lo publica la fuente en su propio archivo** — nunca el nombre/cve de un
catálogo externo. Precedente en producción: `icmm.ts`, `coneval.ts`,
`conapoMarginacion.ts`, `bienestar.ts` (todos con comentario de cabecera
citando este documento).

## Por qué el join por nombre es más seguro que por CVE aquí

Un nombre de municipio que no calza exacto entre dos catálogos (acentos,
prefijos honoríficos, abreviaturas) produce un "no reconocido" — un fallo
visible y explícito. Un CVE_MUN que no calza entre dos catálogos con
numeraciones distintas produce un MATCH VÁLIDO con el municipio equivocado —
un fallo silencioso e indistinguible de un dato correcto. Cuando ambos
mecanismos pueden fallar, preferir el que falla de forma visible.

## Catálogos de numeración municipal en el proyecto — cuáles son compatibles entre sí

| Catálogo | Fuente real | Numeración | Usado por |
|---|---|---|---|
| `resolveMunicipioCve()`/`getMunicipiosOptions()` (`lib/geo/municipios.ts`) | Topojson de cartografía electoral INE (`sefix/geo/ine/nacional/municipios.topojson`, construido desde `info_geo_eske/mgs_2025_INE/`) | Numeración propia de INE — **NO garantizada igual al CVE_MUN oficial INEGI** | Selector de municipio en toda la UI (`TerritorySelector.tsx`), y como catálogo de NOMBRES (nunca de CVE) en los adaptadores de Fontana ya corregidos |
| Bodega de ECEG (`sefix/eceg_2020/municipios/{estado}.json`) | Shapefile propio de ECEG (censo 2020, `info_geo_eske/eceg_2020/`), campo `MUNICIPIO` | Misma familia INE — **verificado compatible con `mgs_2025_INE` en los 32 estados completos, 0 divergencias** (incidente 2026-08-23, Paso 2) | `eceg.ts` (Familia 1 de Fontana) — el único adaptador de Fontana donde el join por CVE_MUN de `resolveMunicipioCve` es seguro hoy, por diseño de origen compartido, no por casualidad |
| CONEVAL (`Concentrado_indicadores_de_pobreza_2020.xlsx`, `IRS_ent_mun_2000_2020.xlsx`) | Catálogo propio de CONEVAL | **Numeración oficial INEGI — NO compatible con la numeración INE** | `coneval.ts` — ver incidente abajo |
| CONAPO (`IMM_2020.xls`) | Catálogo propio de CONAPO | **Numeración oficial INEGI — NO compatible con la numeración INE** | `conapoMarginacion.ts` — ver incidente abajo |
| Bienestar (datasets CKAN de datos.gob.mx, Producción/Beca Benito Juárez) | Catálogo propio de Bienestar | Sin verificar contra INEGI ni INE — no confiar por defecto | `bienestar.ts` — ver incidente abajo |
| ICMM (`conjunto_de_datos_icmm_2022_csv.zip`, `catalogos/mun.csv`) | Catálogo propio de INEGI (edición ICMM) | **Numeración propia de ICMM — NO compatible ni con INE ni con el CVE_MUN "estándar" de otros productos INEGI** (32/2,477 municipios con nombre distinto, ver cabecera de `icmm.ts`) | `icmm.ts` — primer caso documentado de este tipo de bug en el proyecto (26-08-09) |
| ANVCC/INECC (WFS `atlasvulnerabilidad.inecc.gob.mx`) | Catálogo propio de INECC, campo `cve_geo` | Numeración oficial INEGI (usado como referencia independiente para auditar el incidente de abajo, y como catálogo nombre→CVE oficial para `sun.ts`/`gacp.ts` vía `resolverCveOficialMunicipio()`) | Familia 5 (F5-7, F5-10 a F5-17, F5-8) |

**Regla práctica derivada de la tabla**: si vas a integrar una fuente nueva,
NO asumas que su CVE_MUN es compatible con ningún otro catálogo ya en el
proyecto, ni siquiera si ambos dicen ser "INEGI" — cada producto de INEGI
puede tener su propia numeración interna. Verifica con una muestra real
(mínimo 15-20 municipios de 5+ estados, comparando por nombre) antes de
decidir si el cruce por CVE es seguro.

## Incidente 1 — desalineación INE vs. INEGI oficial (2026-08-23)

**Hallazgo**: `resolveMunicipioCve()`/`getMunicipiosOptions()` (numeración
INE) diverge del `CVE_MUN` oficial INEGI en **1,573 de 2,848 municipios
comparados (55.2%)** — reconfirmado independientemente por una segunda
medición (1,550/2,469, documentado 2026-07-31 en `iter.ts`, ~63%). Ejemplo
estructural: en el topojson de Sefix, `{CVE_ENT:'14', CVE_MUN:'041'}` =
GUADALAJARA, mientras que `14039` (el CVE_MUN oficial real de Guadalajara)
corresponde a EL GRULLO en ese mismo archivo — confirmado cruzado con 3
fuentes independientes (ANVCC, GACP/CONEVAL, numeración INEGI conocida).

**Cómo se descubrió**: durante la verificación en vivo de `gacp.ts` (F5-8,
Familia 5), Guadalajara mostró 6.300676% en vez del 0.000577% ya confirmado
en la investigación original — rastreado hasta `resolveMunicipioCve("14",
"Guadalajara")` devolviendo `"041"` en vez de `"039"`.

**Adaptadores de producción confirmados vulnerables** (usaban
`resolveMunicipioCve`/`getMunicipiosOptions` como JOIN EXTERNO contra datos
keyed por el CVE_MUN oficial de su propia fuente — no solo para mostrar
nombres):
- `coneval.ts` — F2-1 (Pobreza), F2-2 (Pobreza extrema), F2-3 (Rezago
  Social, encontrado en la misma ronda de mitigación, no en la lista
  original), F2-14 (Carencia social), y el path de agregación distrital
  ponderada (`resolverNumeradorDenominadorMunicipios`, encontrado en el
  Paso 4 — vulnerable por la misma causa aunque llega desde
  `calcularValorDistritoPonderado` en `index.ts`, no desde el resolver
  directo).
- `conapoMarginacion.ts` — F2-4 (Índice de Marginación).
- `bienestar.ts` — F2-7 (Producción para el Bienestar), F2-8 (Beca Benito
  Juárez).

**Adaptador verificado NO vulnerable**: `eceg.ts` (Familia 1 completa) —
confirmado con evidencia real, los 32 estados completos, 0 divergencias de
CVE_MUN entre la bodega propia de ECEG y `mgs_2025_INE` (ver tabla arriba).
El join por CVE de `eceg.ts` es seguro porque ambos lados son,
estructuralmente, la misma familia de numeración — no porque el mecanismo
de "join por CVE" sea seguro en general.

**Remediación aplicada** (Pasos 1-4 del incidente):
1. Mitigación de emergencia: nivel Municipal deshabilitado con aviso
   explícito ("En validación...") en los 3 adaptadores, en vez de mostrar
   el valor potencialmente incorrecto.
2. Verificación de `eceg.ts` (arriba).
3. Auditoría de producción: 1 entrega real encontrada
   (`moddulo_projects/fvpuanYx7EYhdV3WLqBr/f3Resultados`), confirmada como
   cuenta de pruebas interna — sin cliente real afectado.
4. Fix de fondo: los 3 adaptadores migrados a join por NOMBRE (mismo patrón
   de `icmm.ts`), verificado con 18 municipios reales de 8 estados
   distintos (Jalisco, Nuevo León, Oaxaca, Chiapas, CDMX, Puebla, Veracruz,
   Guanajuato, Yucatán, Sonora, Coahuila) — valores correctos por
   municipio, sin ningún caso de "municipio equivocado". Rutas de bodega
   de `bienestar.ts` renombradas (`_v2`) para no arrastrar caché keyed por
   CVE_MUN de antes del fix.

## Incidente 3 — `gacp.ts` nunca migrado al fix (2026-08-24)

Numeración: Incidente 1 = desalineación INE vs. INEGI oficial (arriba).
Incidente 2 = fragilidad del join por nombre / `ALIAS_MUNICIPIO` /
`claveCanonicaMunicipio()` (dimensionado y resuelto el 2026-08-23, ver
plan de implementación de Fontana — no repetido aquí). Este es el
Incidente 3, un caso concreto de `gacp.ts` no siguiendo el fix del
Incidente 1.

**Hallazgo**: `gacp.ts` (F5-8, Zonas menos comunicadas / GACP) resuelve su
propio CVE_MUN oficial (la fuente CONEVAL/GACP está keyed por CVE_MUN
oficial INEGI, igual que `coneval.ts`) — pero seguía usando
`resolveMunicipioCve()` (numeración INE, ver Incidente 1) para ese join,
en vez de un mecanismo por nombre. **A diferencia del Incidente 1, este
adaptador nunca estuvo correcto en ningún momento**: se escribió durante
la implementación de Familia 5 (26-08-23), DESPUÉS de que el documento
`claves-geograficas-no-confiables.md` ya existía y ya exigía la consulta
obligatoria — no es código preexistente que quedó atrás, es un caso nuevo
que no siguió el protocolo ya vigente al momento de escribirlo.

**Valor incorrecto expuesto**: Guadalajara mostraba **6.300676%** de
población con GACP bajo/muy bajo, en vez del **0.000577%** real (mismo
tipo de error que el Incidente 1 — `resolveMunicipioCve("14",
"Guadalajara")` devuelve `"041"`, el CVE_MUN oficial real de Guadalajara
es `"039"`; `"041"` corresponde a otro municipio en la numeración oficial).

**Desde cuándo**: desde la implementación original de `gacp.ts`
(26-08-23, Familia 5, Paso 8 del plan de implementación) — nunca hubo una
versión correcta en producción antes de este fix.

**Cómo se detectó**: incidentalmente, durante la implementación de Modo B
(26-08-24) — al construir `resolverDetalleLocalidades()` (hoja
"Localidades" del mismo archivo GACP ya usado), se releyó el mecanismo de
resolución de CVE_MUN de `gacp.ts` para reutilizarlo y se notó que usaba
`resolveMunicipioCve` en vez de `resolverCveOficialMunicipio` (el patrón
ya establecido para este tipo de fuente desde el fix de `sun.ts`,
Incidente 1 / Familia 5 Paso 3). No se encontró por auditoría proactiva.

**Fix aplicado**: `gacp.ts` migrado a `resolverCveOficialMunicipio()`
(`lib/fontana/ingesta/anvcc.ts`) — resuelve nombre→CVE_MUN oficial vía el
catálogo propio de ANVCC (`cve_geo`, ya verificado como numeración INEGI
oficial), mismo patrón ya usado por `sun.ts`. Verificado con datos reales
tras el fix: Guadalajara 0.000577%, Zapopan 0.334035%, Tlaquepaque
0.496851% — coincide exacto con los valores de la investigación original
(Ronda 9).

**Auditoría de producción** (mismo estándar que el Incidente 1, Paso 3):
consulta real contra el collectionGroup `f3Resultados` (entregas reales de
Canal 1 en Moddulo) — **2 documentos totales existen en toda la base**,
ambos del 26-08-20 (antes de que Familia 5 existiera). Ninguno de los 2
contiene ningún indicador de Familia 5, ni F5-8 en particular — Familia 5
no existía como código todavía en esa fecha. **Conclusión: 0 entregas
reales afectadas** — mejor resultado que el Incidente 1 (que sí encontró 1
entrega de cuenta de pruebas afectada), porque el bug nunca coexistió en
el tiempo con ninguna entrega real de Canal 1.

## Auditoría de cobertura — todos los adaptadores de `lib/fontana/ingesta/` (2026-08-24)

Ejecutada a raíz del Incidente 3, para confirmar que `gacp.ts` no fue el
único caso suelto. Resultado, adaptador por adaptador:

**Migrados y verificados seguros (join por nombre con
`claveCanonicaMunicipio()`, Incidente 2 / alias table incluida)**:
`coneval.ts`, `conapoMarginacion.ts`, `bienestar.ts`, `icmm.ts`.

**Seguros por diseño — join interno consistente, nunca cruzan a un
catálogo externo con numeración distinta**:
- `eceg.ts` — bodega propia construida desde la misma familia de
  numeración INE que `resolveMunicipioCve` (verificado 32/32 estados,
  Incidente 1 Paso 2).
- `iter.ts` — catálogo propio (`iter_2020/catalogo_municipios/`), ya
  usaba join por nombre antes del Incidente 1.
- `conapo.ts` (F1-18) y `compendio.ts` (F1-16) — reusan el catálogo propio
  de `iter.ts` (`readFromBodega("iter_2020/catalogo_municipios/...")`) vía
  `normalizeGeoName()`, mismo mecanismo ya establecido como seguro.
- `index.ts` (`agruparUnidadesPorEstado`, resolución de territorio
  plural) — usa `resolveMunicipioCve` pero el CVE resultante solo filtra
  el propio catálogo de Sefix (`getMunicipiosOptions`), nunca cruza a un
  mapa keyed externamente — join Sefix-contra-Sefix, no vulnerable a la
  clase del Incidente 1.
- `sun.ts`, `anvcc.ts` (F5-7, F5-10 a F5-17) — usan
  `resolverCveOficialMunicipio()` (nombre→CVE oficial vía el catálogo
  propio de ANVCC, `cve_geo`), patrón ya establecido antes de este
  incidente.
- `gacp.ts` (F5-8) — migrado en este incidente al mismo patrón que
  `sun.ts`/`anvcc.ts`.
- `contenidoCurado.ts` (F5-3/F5-4) — lectura directa de contenido curado
  indexado por `cve_mun`, sin join externo alguno.

**Sin join municipal por CVE — usan join por NOMBRE directo contra su
propio mapa interno (sin cruzar catálogos), pero con una fragilidad de
menor severidad (clase Incidente 2: no usan `claveCanonicaMunicipio()`
con tabla de alias, solo `normalizeGeoName()` plano — un nombre con
prefijo/sufijo/abreviatura distinto entre la fuente y
`territorio.municipio` produce "sin dato" en vez de resolver, nunca un
valor de OTRO municipio)**:
- `pnud.ts` (F2-5, F2-19 a F2-22 — IDH/Salud/Educación/Ingreso/IDG
  municipal).
- `sic.ts` (F5-5), `conagua.ts` (F5-2), `denue.ts` (F5-6) — mismo patrón,
  `normalizeGeoName(territorio.municipio)` contra su propio mapa interno.

Ninguno de estos 4 tiene el bug crítico del Incidente 1 (no hay CVE_MUN
cruzado entre catálogos) — quedan documentados como mejora futura
pendiente (migrar a `claveCanonicaMunicipio()` cuando se toque cada
archivo), no como incidente activo.

**Sin ningún join municipal — nivel estatal/nacional únicamente, sin
riesgo de esta clase de bug**: `banxico.ts` (F1-17, solo resuelve estado),
`enigh.ts`, `enoeInformalidad.ts`, `imco.ts`, `inegiPm.ts`,
`stpsSalario.ts`, `superficieEstatal.ts`, `nacionalAgregado.ts`, y todos
los adaptadores de Familia 4 (`bancoMundial.ts`, `cepalstat.ts`,
`eiuDemocracyIndex.ts`, `pnudHdr.ts`, `rsf.ts`,
`transparencyInternational.ts`, `familia4.ts`) — comparación
internacional, sin territorio municipal mexicano en absoluto.

## Protocolo — qué hacer al investigar una fuente nueva con territorio municipal

Antes de escribir el adaptador, agregar explícitamente a la investigación:

1. ¿La fuente publica su propio nombre de municipio en el mismo archivo de
   datos? Si sí, ese es el mecanismo de join por defecto — nunca el CVE.
2. Si el join por CVE parece inevitable (la fuente no publica nombre), NO
   asumas compatibilidad con ningún catálogo de la tabla de arriba —
   verifica con una muestra real (15-20 municipios, 5+ estados) comparando
   por nombre antes de confiar en el cruce por CVE.
3. Si la verificación encuentra divergencias, documenta el hallazgo en este
   archivo (agrega una fila a la tabla) antes de decidir el mecanismo del
   adaptador — no lo dejes solo como comentario aislado en el archivo del
   adaptador.
