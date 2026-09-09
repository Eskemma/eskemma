# Auditoría — viabilidad de series temporales en Fontana T10 (86 indicadores)

**Fecha del mapeo original:** 2026-08-30
**Addendum de decisiones de producto:** 2026-08-31 (ver §Addendum al final)

Este documento es un **mapeo de evidencia para decidir alcance** de la función
"evolución temporal" del agente conversacional de Fontana. **No es un
compromiso de implementación.** La fuente de verdad fue el código de los
adaptadores (`lib/fontana/ingesta/*.ts`) y sus pipelines (`scripts/*`), no el
registry.

Problema que motiva la auditoría: el agente no puede responder "¿cómo ha
cambiado el indicador X en los años?" porque el modelo de datos guarda solo el
corte más reciente de cada indicador — no hay campo de fecha/periodo versionado.

---

## Hallazgo transversal — el modelo de datos no tiene eje temporal

Ningún tipo del contrato de datos guarda fecha/periodo/año consultable:

| Tipo | Archivo | Qué hay de temporal |
|---|---|---|
| `CeldaTablaFontana` / `IndicadorFilaFontana` | `lib/fontana/tablaColumnas.ts:94-186` | Nada. `valor?` escalar único. |
| `ValorIndicadorFontana` / `CeldaNoDisponible` | `lib/fontana/ingesta/types.ts:15-71` | `valor: number` único. Año solo como texto dentro de `fuenteEtiqueta`. |
| `NivelIndicador` / `IndicadorRegistro` | `lib/fontana/indicatorRegistry.ts:22-127` | `frecuenciaActualizacion` (prosa: "Anual", "Bienal"), `ultimaVerificacion` (fecha de verificación humana, no vintage del dato). Ninguno consultable. |
| `FontanaCanvasItem*` / `FontanaSesion` | `types/fontana.types.ts:132-201` | `creadoEn` / `fechaUltimoGuardado` = ciclo de vida del snapshot, no del dato. |
| `CeldaComparativaPais` / `FilaComparativaInternacional` | `lib/fontana/tablaComparativaInternacional.ts:24-58` | `valor?` escalar por país, sin eje de tiempo. |

- Los años solo viven como substring en `fuenteEtiqueta` (texto libre, formato
  inconsistente entre adaptadores: `"Banco Mundial (2025)"`, `"CEPALSTAT (2024)"`,
  `"PNUD HDR 2025 (rank global 81)"`, `"RSF 2026 (...)"`). No hay parser que los
  extraiga; confirma que no hay eje estructurado.
- Los JSON de "bodega" en Storage están keyed **solo por geografía**, nunca por
  año — con UNA excepción (F2-17, ver categoría c).
- **Ningún adaptador persiste más de un corte.** Varios sí construyen una
  estructura multi-año en memoria de proceso y la colapsan antes de retornar:
  `stpsHuelgas.ts:116-127` (Map por año), `imco.ts:61`, `cepalstat.ts:136-204`
  (serie completa cacheada), `pnudHdr.ts:47-50` (parsea todas las columnas
  `hdi_YYYY`, se queda con la última).

---

## Conteo por categoría (tras el addendum 2026-08-31)

| Categoría | N | IDs |
|---|---|---|
| **a — serie viable, no capturada** (la fuente tiene historia; el adaptador solo trae el último corte; extensible) | 57 | F1-1…F1-14, F1-17, F1-18 · F2-1…F2-12, F2-14…F2-16, F2-18…F2-22 · F3-1, F3-2, F3-3, F3-4, F3-7, F3-8, F3-16, F3-17 · F4-1…F4-5, F4-7…F4-11 · F5-6, F5-7, F5-8 |
| **b — corte único estructural / no comparable** | 19 | F1-15\*, F1-16, F1-19\*, F2-13\*, F4-6 · F5-1, F5-2, F5-3, F5-4, F5-5, F5-9, F5-10 · F5-11…F5-17\*\* |
| **c — ya versionado en Storage, no expuesto** (hallazgo) | 1 | **F2-17** |
| **d — sin conector auditable** (no es a/b/c: no hay adaptador que auditar) | 9 | F3-5, F3-6, F3-9…F3-14 (sefix_ai) · F3-15 (RFOSC caído) |

\* **F1-15, F1-19, F2-13** — reclasificados a→b por decisión de producto
(addendum 2026-08-31): estado **temporal, reabrible** cuando exista el
diccionario de datos que confirme comparabilidad Censo 2010/2015 ↔ 2020.
\*\* **F5-11…F5-17** — **b respecto al conector actual** (capa única del atlas
ANVCC); sus fuentes primarias sí tienen serie, pero sustituir el conector queda
**fuera de alcance permanente** (addendum 2026-08-31).

**Sub-grupo dentro de "a" — la serie YA se descarga y se descarta** (extensión
casi gratis, no requiere nuevas descargas): F2-3, F2-5, F2-6, F2-8, F2-10,
F2-12, F2-15, F2-16, F2-19, F2-20, F2-21, F2-22 · F2-1/F2-2/F2-14 (nac/estatal) ·
F1-18 · F3-16, F3-17 · F4-2, F4-3, F4-9, F4-10, F4-11.

---

## Tabla completa (86 indicadores)

Columnas: `id | fuente | cat | niveles con historia en la FUENTE | esfuerzo de captura | evidencia`

### Familia 1 — Sociodemográficos

| id | fuente | cat | niveles con historia | esfuerzo | evidencia |
|---|---|---|---|---|---|
| F1-1 Población total | ECEG (Censo 2020) | a | nac/est/mun (Censo 2000/2010/2020 + Intercensal 2015); secc/dist solo ECEG 2010/2020 | alto (ingerir ECEG 2010 + Intercensal 2015, descargas aparte) | `scripts/eceg-data-pipeline.ts:41-48` lee solo `eceg_2020/`; JSON keyed por CVE sin año (`:15-17`); `eceg.ts:228,437` |
| F1-2 Pirámide de edades | ITER (Censo 2020) | a | nac/est/mun (ITER 2010/2020) | alto | `scripts/fontana-iter-pipeline.ts:59-61` (`iter_2020`); `iter.ts:113,179` leen `iter_2020/piramide/*` sin año |
| F1-3 % Pob indígena | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG (ídem F1-1) |
| F1-4 % Jefatura femenina | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-5 Escolaridad promedio | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-6 % Pob inmigrante | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-7 % Pob >65 años | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-8 % Vivienda piso tierra | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-9 Ocupantes por cuarto | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-10 % Vivienda servicios básicos | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-11 % Pob urbana/rural | ITER | a | nac/est/mun (ITER 2010/2020) | alto | `fontana-iter-pipeline.ts:71,94`; `iter.ts:127,205,233` leen `iter_2020/urbano_rural/*` sin año |
| F1-12 Estado civil | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-13 % Sin escolaridad | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-14 Educación pos-básica | ECEG | a | nac/est/mun + secc 2010/2020 | alto | bloque ECEG |
| F1-15 % Discapacidad | ECEG | **b** (decisión 2026-08-31, reabrible) | nac/est/mun 2010/2015/2020 **no comparables 1:1** (cambio de metodología `PCON_DISC` → `PCON_DISC` + `PCON_LIMI`) | — (bloqueado hasta diccionario de datos) | bloque ECEG; addendum decisión (a); punto abierto #9 |
| F1-16 Densidad de población | INEGI Compendio 2010 | **b** | n/a — Compendio municipal es publicación única 2010, sin edición posterior; superficie casi invariante | — | `compendio.ts:56` URL PDF 2010 por municipio; `:88` bodega `compendio_2010/{cve}.json` sin año |
| F1-17 Remesas per cápita | Banxico SIE | a | serie trimestral nac + 32 estatal desde 2003 (SE29670-SE29702); municipal no existe en la fuente | medio (cambiar `/datos/oportuno` → `/series/{id}/datos` o `/datos/{ini}/{fin}` — endpoints confirmados, ver punto abierto #5) | `banxico.ts:95` `/datos/oportuno`; `:101` `datos[datos.length-1]` |
| F1-18 Razón de dependencia | CONAPO (CKAN) | a | serie uniforme nac/estatal (1950-2070) y municipal (1990-2040) | **bajo** (campo `ANO`/`ANIO` en el mismo recurso CKAN) | `conapo.ts:20-32` recurso cubre 1950-2070; `:59` `ANO_VIGENTE="2026"`; filtros `{ANIO:2026}` (`:127`), `{ANO:"2026"}` (`:144`) |
| F1-19 % Indígena monolingüe | ECEG | **b** (decisión 2026-08-31, reabrible) | nac/est/mun + secc 2010/2020, comparabilidad no confirmada | — (bloqueado hasta diccionario de datos) | bloque ECEG; addendum decisión (a); punto abierto #9 |

### Familia 2 — Socioeconómicos

| id | fuente | cat | niveles con historia | esfuerzo | evidencia |
|---|---|---|---|---|---|
| F2-1 Pobreza multidimensional | CONEVAL / INEGI-PM | a | **IMPLEMENTADO (2026-09-06)**. nac/estatal: serie bienal 2016-2024 (INEGI-PM BISE, `resolverSerieInegiPm`). municipal: serie CERRADA de 3 puntos 2010/2015/2020 (`resolverSerieConevalPobrezaMunicipal`, lee los CSV de Datos Abiertos `pobreza_municipal_2010-2020/` por nombre de columna `pobreza`; comparabilidad documentada por CONEVAL, re-estimó 2010). distrital: reconstruido de municipal | nac/est **bajo**; municipal **bajo-medio** (revisado desde "alto": los 3 CSV descargan directo, encabezados estables) | `serieTemporal.ts` hace el split por nivel dentro de `case "inegi_pm_bise"`; `coneval.ts` `resolverSerieConevalPobrezaMunicipal` + `cargarSeriePobrezaMunicipal`. Cross-check 2026-09-06: punto 2020 de la serie == celda (xlsx) dentro de ±0.04 pp en 12 combos (Guadalajara F2-1 24.8) |
| F2-2 Pobreza extrema | CONEVAL / INEGI-PM | a | ídem F2-1 (columna `pobreza_e`) | ídem F2-1 | ídem F2-1 |
| F2-3 Índice de Rezago Social | CONEVAL IRS | a (b en nacional) | estatal + municipal: **5 cortes 2000/2005/2010/2015/2020 en el mismo ZIP**. nacional: la fuente lo deja en blanco todos los años → b | **bajo** (el ZIP ya trae los 5 años; hoy se filtra 1) | `coneval.ts:69` URL `IRS_ent_mun_2000_2020.zip`; `:60-66` comentario "el ZIP trae 5 archivos"; `:237` filtro `/2020\.xlsx$/i` descarta 4; `:36-44` nacional en blanco |
| F2-4 Índice de Marginación | CONAPO | a | estatal + municipal: serie 1990-2020 (IME/IMM normalizados). nacional no lo publica la fuente | medio (archivos `IM*_1990.xls`…`2015.xls` aparte) | `conapoMarginacion.ts:39-40` URLs `IME_2020.xls`/`IMM_2020.xls` fijas; cache sin dimensión de año (`:63-73`) |
| F2-5 IDH Municipal | PNUD | a | solo municipal; serie 2010/2015/2020 **en el archivo combinado** | **bajo** (el adaptador usa el standalone 2020; el combinado ya trae 3 años) | `pnud.ts:9-11` archivo combinado con 2010/2015/2020; `:132` lee solo `fila[27]` (IDH 2020) |
| F2-6 Gini de ingreso | ENIGH tabulados | a | nac + estatal: serie 2016-2024 (columnas C-G del mismo XLSX). municipal/distrital: sin representatividad | **bajo** (columnas 2016/2018/2020/2022 en el mismo archivo) | `enigh.ts:18-19` cols C-G = años; `:67` `COL_ANO_2024="G"`; `:156,166` solo col G |
| F2-7 Beneficiarios Producción para el Bienestar | Bienestar (CKAN) | a | municipal (programa anual desde 2019; padrones por año, disponibilidad CKAN no confirmada) | medio | `bienestar.ts:18-19,71-88` resources etiquetados "(2024)"; bodega `bienestar_produccion_v2/{cve}.json` sin año. Punto abierto #10 |
| F2-8 Beca Benito Juárez | Bienestar (CKAN) | a | trimestral: **Q1-Q4 2025 en el mismo paquete CKAN** (128 recursos = 32×4). **Serie PAUSADA** (2026-09-06): los 4 archivos son heterogéneos de esquema (`bimestre`/`trimestre`/`TRIMESTRE`, tipos y fechas mezclados) y **Q4 sobre-cuenta ~41%** (ver abajo) → cualquier serie debe construirse sobre snapshots tipo Q1-Q3 y homologar el esquema primero | **medio-alto** (revisado desde "bajo": no basta con que los trimestres estén en el paquete) | `bienestar.ts` (cabecera F2-8) usa **"3er. trim. 2025"** desde la corrección 2026-09-06; el "4to. trim." se descartó por sobre-conteo (salto uniforme +40.7% en los 32 estados, choca con la cifra oficial de 4,224,381, `BECA` = escalones acumulados) |
| F2-9 Tasa de informalidad (TIL1) | ENOE-Infolaboral | a | fuente: nac + estatal trimestral desde 2005. Fontana: solo estatal, 1 corte (1T 2026) | alto (re-exportación manual por trimestre) | `enoeInformalidad.ts:19-23,48` header "un solo valor… sin serie histórica"; `scripts/upload-fontana-enoe-til1.ts:66-68` un `periodo` |
| F2-10 Salario real medio | STPS/SIEL (IMSS) | a | nac + estatal, **bloques mensuales en la MISMA respuesta Cognos** (se descartan; cobertura mes/año NO caracterizada — punto abierto #5) | **bajo-medio** (parsear los bloques que ya vienen, si están etiquetados con fecha) | `stpsSalario.ts:78-88` `if (valores.length === 33) break;` + comentario "resto son desgloses mensuales"; no hay parser para esos bloques |
| F2-11 Acceso a internet en hogares | ECEG | a | nac/est/mun 2015/2020 (+secc 2020) | alto | bloque ECEG (`VPH_INTER`) |
| F2-12 Distribución del ingreso por decil | ENIGH tabulados | a | nac + estatal serie 2016-2024 (mismo Cuadro 2.1) | **bajo** | `enigh.ts:18-24`; `:160` lee `COL_ANO_2024` por decil |
| F2-13 % Sin seguridad social (proxy PSINDER) | ECEG | **b** (decisión 2026-08-31, reabrible) | nac/est/mun 2010/2015/2020, comparabilidad no confirmada | — (bloqueado hasta diccionario de datos) | bloque ECEG (`PSINDER`); addendum decisión (a); punto abierto #9 |
| F2-14 % Pob con ≥1 carencia | CONEVAL / INEGI-PM | a | ídem F2-1 (columna `carencias`) | ídem F2-1 | ídem F2-1 |
| F2-15 Gasto hogares en educación | ENIGH tabulados | a | nac + estatal serie bienal | bajo-medio (archivo de tabulados históricos; hoy solo el 2024) | `enigh.ts:79,187` `CUADRO42_OFFSET_EDUCACION` + `COL_PROMEDIO_HOGAR="F"` del 2024 |
| F2-16 Gasto hogares en salud | ENIGH tabulados | a | ídem F2-15 | ídem F2-15 | `enigh.ts:78,179` `CUADRO42_OFFSET_SALUD`, archivo 2024 |
| F2-17 Competitividad Estatal (IMCO ICE) | IMCO | **c** | solo estatal; **serie 2016-2025 YA en Storage** (`imco_ice/2025.json` shape `{porEstado:{cve:{[YYYY]:FilaIce}}}`), el adaptador lee solo `ANO_VIGENTE` | (ya está — solo falta exponer) | `scripts/upload-fontana-imco-ice.ts:51,63,77` valida "10 años 2016-2025"; `imco.ts:51` `ANO_VIGENTE="2025"`; `:111,127` `datos.porEstado[cve]?.[ANO_VIGENTE]` |
| F2-18 Ingreso corriente municipal (ICMM) | INEGI ICMM | a | nac/estatal/municipal: serie bienal 2020, 2022 | medio (`conjunto_de_datos_icmm_2020_csv.zip` aparte) | `icmm.ts:20-23` comentario "el mismo patrón para 2020"; `:159` `URL_ICMM_2022` única; cache sin año (`:167-174`) |
| F2-19 IDG municipal | PNUD | **a** (revisado 2026-08-31 — ver punto abierto #6) | solo municipal; el "Informe de Desarrollo Humano Municipal 2010-2020" del PNUD (feb 2023) presenta IDG municipal para 2010/2015/2020 | bajo-medio (confirmar si el archivo combinado 2010-2020 trae columnas IDG por año, como sí para IDH/sub-IDH) | `pnud.ts:73,181-192` lee archivo IDG 2020 standalone, sin columnas de otro año |
| F2-20 Sub-IDH Educación | PNUD | a | solo municipal; serie 2010/2015/2020 en el archivo combinado | **bajo** (el adaptador usa el standalone 2020) | `pnud.ts:71,152` lee `fila[6]` (SE 2020) del standalone en vez de las columnas históricas del combinado |
| F2-21 Sub-IDH Ingreso | PNUD | a | ídem F2-20 | **bajo** | `pnud.ts:72,171` lee `fila[5]` del standalone 2020 |
| F2-22 Sub-IDH Salud | PNUD | a | ídem F2-20 | **bajo** | `pnud.ts:131` lee `fila[18]` (SS 2020); columnas 2010/2015 del mismo archivo no se leen |

### Familia 3 — Geopolíticos

| id | fuente | cat | niveles con historia | esfuerzo | evidencia |
|---|---|---|---|---|---|
| F3-1 Tasa homicidios dolosos | SESNSP (CKAN, resource municipal) | a | estatal + municipal: serie mensual continua desde ~2015 (12 cols mes + campo `Ano`). nac/distrital no servidos | medio (parametrizar `anioReferencia` por rango) | `sesnsp.ts:115-117` `anioReferencia = año-1`; `:179,186` filtro `Ano: anio`; `:308` |
| F3-2 Incidencia delictiva | SESNSP (mismo resource) | a | ídem F3-1 | medio | `sesnsp.ts:280-282` → `resolverSesnspGenerico` → `anioReferencia` |
| F3-3 Victimización (ENVIPE) | INEGI ENVIPE | a | nac + estatal: anual desde 2011 (el Cuadro 2 publica año actual + anterior) | alto (re-parsear N PDFs) | `envipe.ts:29,36,49` importa JSON estático de un solo año (`DATA._anioReferencia`) |
| F3-4 Percepción de inseguridad (ENSU) | INEGI ENSU | a | municipal + distrital: trimestral desde 3T2016 (~40 trimestres de microdatos). nac/estatal no servidos | alto (procesar N ZIPs de microdatos) | `ensu.ts:45,52` importa `ensu_percepcion_2026t2.json` (un trimestre) |
| F3-5 Resultados electorales | Sefix-AI | **d** | n/a — sin conector | — | `index.ts:451-455` devuelve `MOTIVO_PENDIENTE_SEFIX_AI` |
| F3-6 Participación electoral histórica | Sefix-AI | **d** | n/a | — | ídem |
| F3-7 Gasto federalizado per cápita | SHCP (CKAN, "2011-Actual") | a | nac + estatal: detalle mensual desde 2011 | medio | `shcpGasto.ts:107-109` `anioReferencia = año-1`; `:66,119` `filters {ciclo: anio}` |
| F3-8 Zonas de Atención Prioritaria | DOF (decreto anual) | a — **fuera de alcance permanente** (addendum 2026-08-31) | nac/estatal/municipal: decreto DOF cada año (2020-2026); lista designada, no valor continuo | medio (archivar decretos previos; parseo manual pesado) | `zap.ts:20-22,39,48` importa JSON del decreto 2026; addendum decisión (c); punto abierto #4 |
| F3-9 Tasa de abstención histórica | Sefix-AI | **d** | n/a | — | `index.ts:451-455` |
| F3-10 Índice de volatilidad electoral | Sefix-AI | **d** | n/a | — | ídem |
| F3-11 Voto nulo y no registrados | Sefix-AI | **d** | n/a | — | ídem |
| F3-12 Margen de victoria | Sefix-AI | **d** | n/a | — | ídem |
| F3-13 Continuidad de partido ganador | Sefix-AI | **d** | n/a | — | ídem |
| F3-14 Índice de competitividad electoral | Sefix-AI | **d** | n/a | — | ídem |
| F3-15 Presencia de organizaciones sociales | RFOSC/CLUNI | **d** | desconocido — fuente caída (connection refused / HTTP 500) | — | `rfoscCluni.ts:27-33` devuelve `MOTIVO_RFOSC_CAIDO` en 4 niveles |
| F3-16 Huelgas y paros laborales | STPS (CKAN, "1989-mar 2026") | a | nac + estatal: conteos anuales 1989-2026 en el mismo dataset | **bajo** (el `Map porAnioEstado` year-keyed YA se construye; solo falta exponerlo) | `stpsHuelgas.ts:77` descarga todo sin filtro; `:116-125` `porAnioEstado` (Map por año); `:160` `.get(anioReferencia())` expone 1 año |
| F3-17 Índice de Paz México | IEP (XLSX) | a | nac + estatal: el archivo descargado contiene **2015-2025** | **bajo** (quitar el filtro `year !== 2025`) | `iep.ts:11,38` `ANIO_REFERENCIA = 2025` hardcodeado; `:74` `if (year !== ANIO_REFERENCIA) continue` descarta 2015-2024 |

### Familia 4 — Comparación internacional (Q3 = ¿historia para México y países de referencia por igual?)

**Fase 1 IMPLEMENTADA (2026-09-06): F4-2, F4-3, F4-9, F4-10, F4-11.** Camino
PARALELO al geográfico (sin `Territorio`/`SERIES_DISPONIBLES`/`serieTemporal.ts`):
config `lib/fontana/series/seriesInternacionalesDisponibles.ts` +
`tieneSerieInternacional`; dispatcher `lib/fontana/ingesta/serieInternacional.ts`
(`resolverSerieInternacionalF4`, modelado en `familia4.ts:resolverIndicadorComparativoF4`);
resolvers `resolverSerieCepalstat` (F4-2/9/10/11) y `resolverSerieHdr` (F4-3) —
NO colapsan la serie, reutilizan el mismo fetch cacheado que el resolver de
celda. Ruta `GET /api/fontana/serie-internacional`. Tipo de Canvas nuevo
`FontanaCanvasSerieInternacional` (`tipo:"serie_internacional"`, clave `iso3`,
`estadoConsulta` de 4 estados por país, `nota` de tarjeta, `polaridad`) +
render `SerieInternacionalGrafica` (N líneas, eje X por año, México
enfatizado). `generar_visualizacion tipo:"serie_temporal"` con `familiaId F4`
→ bifurca a `generarSerieInternacional` (el rechazo `[C4]` del resto de tipos
NO cambia). Guard `verify-fontana-series-disponibilidad-sync.ts` extendido a
`SERIES_INTERNACIONALES_DISPONIBLES`; registry: `disponibilidadTemporal` de los
5 ids puesta en `null` y subida a Storage (mismo fix que los 13 geográficos
del 26-09-05). Cross-check en vivo: el último punto de cada serie == el valor
de la celda actual (`resolverIndicadorComparativoF4`), exacto, para MX + 4
referencia. **F4-2 muestra solo el tramo comparable 2016-2024 (5 puntos MX,
sin ningún punto pre-2016)** — CEPAL marca el quiebre con sus footnotes
(12429/12428); nota de tarjeta lo explica. **F4-7 IMPLEMENTADO (Fase 2,
26-09-07)**: CPI 2012-2024 (13 pts) completo para MX + 4 referencia, hoja
`CPI Historical` del mismo workbook; sin quiebre metodológico interno (la
serie arranca en 2012 por la propia revisión de TI de ese año), así que sin
`anioMinimo` ni nota de tramo — a diferencia de F4-2. **F4-1/F4-4/F4-5
IMPLEMENTADOS (Fase 3, 26-09-08)**: Banco Mundial, un solo resolver genérico
`resolverSerieBancoMundial`, endpoint acotado a los 5 países (1 página — el
"paginar ~9k filas" era para `country=all`). F4-1 (PIB PPA) serie continua
1990-2025 y F4-4 (Pobreza, años de encuesta irregulares) sin quiebre interno.
**F4-5 (Inflación): la auditoría lo daba por "limpio como los otros"; la
verificación en vivo reveló que NO** — el BM no publica CPI de Argentina antes
de 2018 (7 pts 2018-2024, 34%-220%) y Brasil tuvo hiperinflación 1990-1994;
`anioMinimo: 2000` + nota de tarjeta (Argentina domina la escala del gráfico de
líneas con eje compartido — es información política, la tabla año×país da los
valores exactos). **Fuera**: F4-8 (RSF, "quiebre 2022" sin confirmar), F4-6
(EIU, tabla hardcodeada, no era serie viable). **Familia 4: series completas.**

| id | fuente | cat | historia MX vs referencia | esfuerzo | evidencia |
|---|---|---|---|---|---|
| F4-1 PIB per cápita PPA | Banco Mundial (`NY.GDP.PCAP.PP.CD`) | a | **IMPLEMENTADO (Fase 3)** — serie continua **1990-2025 (36 pts) sin huecos** para MX + 4 referencia; sin quiebre interno (el BM back-castea la serie a la base ICP vigente) | **bajo-medio** | `bancoMundial.ts` `resolverSerieBancoMundial` — endpoint `country/mex;col;chl;bra;arg` + `date=1990:<año>`, sin `mrnev`, 1 página; cross-check último punto (2025) == celda exacto |
| F4-2 Gini internacional | CEPALSTAT (id 3289) | a | **IMPLEMENTADO (Fase 1)** — solo tramo comparable 2016-2024 (5 pts MX; footnotes 12429/12428 marcan el quiebre); COL/BRA anuales, CHL 3 pts, ARG sin dato en el tramo | **bajo** | `cepalstat.ts` `resolverSerieCepalstat(id, isos3, anioMinimo:2016)` — reusa `fetchDatosIndicador` (serie completa cacheada), NO colapsa |
| F4-3 IDH global | PNUD HDR (CSV) | a | **IMPLEMENTADO (Fase 1)** — serie 1990-2023 (34 pts) igual para MX + 4 referencia | **bajo** | `pnudHdr.ts` `resolverSerieHdr(isos3)` — `FilaHdr.serie` mapea todas las cols `hdi_YYYY` |
| F4-4 Pobreza línea internacional | Banco Mundial (`SI.POV.DDAY`) | a | **IMPLEMENTADO (Fase 3)** — años de encuesta IRREGULARES (MX 18 pts, CHL 16, BRA 31), ARG con hueco en 2015 (INDEC); el aviso "no comparable con ediciones anteriores" es sobre reportes viejos, NO un quiebre dentro de un pull fresco ($3.00/2021 PPP); `value:0` es real | **bajo-medio** | `bancoMundial.ts` `resolverSerieBancoMundial`; solo puntos con dato (igual que la celda y CEPALSTAT); cross-check último (2024) == celda (1.6/8.5/0.4/3/1) |
| F4-5 Inflación | Banco Mundial (`FP.CPI.TOTL.ZG`) | a | **IMPLEMENTADO (Fase 3), NO era "limpio"** — el BM no publica CPI de Argentina antes de 2018 (7 pts 2018-2024, 34%-220%) + hiperinflación de Brasil 1990-1994; con eje Y compartido ARG aplasta al resto → `anioMinimo: 2000` (excluye la hiperinflación de BRA) + `notaTarjeta` explicativa | **medio** | `bancoMundial.ts` `resolverSerieBancoMundial`; MX/COL/CHL/BRA 26 pts 2000-2025, ARG 7 pts; cross-check último == celda (3.807/5.142/4.213/5.017; ARG 219.884) |
| F4-6 Índice de Democracia (EIU) | EIU vía CRS R46016 | **b** | tabla hardcodeada 2024, sin fetch; serie = transcripción manual de PDF de baja frecuencia | — | `eiuDemocracyIndex.ts:58-89` `TABLA_EIU_CRS_2024` + `AÑO_EDICION = 2024`; `score` diferido (`:8-9`) |
| F4-7 Índice de Percepción de Corrupción | Transparencia Internacional (XLSX) | a | **IMPLEMENTADO (Fase 2)** — CPI 2012-2024 (13 pts) completo para MX + 4 referencia; hoja `CPI Historical` (formato largo/tidy, cols `ISO3`/`Year`/`CPI score`/`Rank`) del mismo workbook — NO la ancha `CPI Timeseries` (inconsistencia real de mayúsculas `CPI score`/`CPI Score` 2012-2013); sin quiebre interno (serie comparable desde 2012 por diseño de TI) | **bajo-medio** | `transparencyInternational.ts` `resolverSerieTransparency(isos3)` junto al de celda; cross-check último punto (2024) == celda, exacto (MEX 26, COL 39, CHL 63, BRA 34, ARG 37) |
| F4-8 Libertad de Prensa (RSF) | RSF (CSV) | a | anual (CSVs por año `/import_classement/YYYY.csv`; quiebre 2022) | medio (fetch de CSVs por año) | `rsf.ts:24` URL fija `.../2026.csv`; `:50-52` toma `Score 2026`+`Rank` |
| F4-9 Desconfianza en partidos/congreso | CEPALSTAT (id 995, Latinobarómetro) | a | **IMPLEMENTADO (Fase 1)** — 1996-2024 (23 pts), igual MX + 4 referencia LATAM; años sin oleada = hueco | **bajo** | `cepalstat.ts` `resolverSerieCepalstat` (dim_4821); cross-check último punto == celda |
| F4-10 Confianza en la policía | CEPALSTAT (id 3257) | a | **IMPLEMENTADO (Fase 1)** — ídem F4-9 | **bajo** | `cepalstat.ts` `resolverSerieCepalstat` (dim_4821) |
| F4-11 Confianza en el poder judicial | CEPALSTAT (id 5528) | a | **IMPLEMENTADO (Fase 1)** — ídem F4-9 | **bajo** | `cepalstat.ts` `resolverSerieCepalstat` (dim_144) |

### Familia 5 — Características territoriales

| id | fuente | cat | niveles con historia | esfuerzo | evidencia |
|---|---|---|---|---|---|
| F5-1 Factores geográficos | Contenido curado | **b** | n/a — texto narrativo, descripción "vigente" única por diseño | — | `contenidoCurado.ts:123` documento sin eje temporal; `:291-304` |
| F5-2 Factores climáticos | CONAGUA (Normales 91-20) / curado | **b** | n/a — la normal climatológica es agregado fijo de 30 años (91-20); SMN emite normal nueva ~cada década | — | `conagua.ts:47` `NORMALES_BASE = ".../Normales9120"` fijo; `:8-9` menciona 4 ediciones históricas de normal. Punto abierto #3 |
| F5-3 Historia del territorio | Contenido curado | **b** | n/a — narrativa editorial | — | `contenidoCurado.ts:214-231` |
| F5-4 Personajes célebres | Contenido curado | **b** | n/a | — | `contenidoCurado.ts:233-249` |
| F5-5 Tradiciones y fiestas | Contenido curado | **b** | n/a | — | `contenidoCurado.ts:312-325` |
| F5-6 Zonas de actividad económica | DENUE (INEGI) | a | estatal + municipal: DENUE ~2×/año desde 2010; ediciones previas archivadas (`denue_AAAAMM`) | medio (descargar ediciones previas) | `denue.ts:86` `fetch(".../denue_${cve}_csv.zip")` siempre la última, sin parámetro de edición |
| F5-7 Zonas habitacionales y comerciales | SUN (CONAPO) | a (serie escasa) | estatal + municipal: ediciones discretas 2012/2018/2020 | medio | `sun.ts:36-37` `SUN_2020_URL` / `SUN_CONFORMACION_URL` con edición 2020 en la ruta |
| F5-8 Zonas menos comunicadas | GACP (CONEVAL) | a (serie escasa) | estatal + municipal: 2010 y 2020 (cadencia ligada a Medición de Pobreza) | medio | `gacp.ts:31` `GACP_ZIP_URL = ".../2020/Anexo_estadistico.zip"` |
| F5-9 Atractivos turísticos | Contenido curado | **b** | n/a — narrativa editorial | — | `contenidoCurado.ts:257-270` |
| F5-10 Problemáticas ecológicas | Contenido curado | **b** | n/a | — | `contenidoCurado.ts:272-285` |
| F5-11 Incendios forestales (número) | ANVCC (capa única) | **b** vs. conector — **fuera de alcance permanente** (addendum 2026-08-31) | ANVCC: vintage único. Primaria (CONAFOR, reportes anuales) sí tiene serie | alto (sustituir conector) | `anvcc.ts:64` URL WFS sin parámetro de fecha; `:186` `campo: "noIncendios"`. Punto abierto #1 |
| F5-12 Superficie incendiada (ha) | ANVCC | **b** vs. conector — fuera de alcance permanente | ídem F5-11 (CONAFOR primaria) | alto | `anvcc.ts:187` `campo: "supIncHa"` |
| F5-13 Declaratorias de desastre | ANVCC | **b** vs. conector — fuera de alcance permanente | ANVCC vintage único. Primaria (SEGOB/CENAPRED, declaratorias DOF) tiene serie anual | alto | `anvcc.ts:188` `campo: "totDeclaratorias"` |
| F5-14 % Área natural protegida | ANVCC | **b** vs. conector — fuera de alcance permanente | ANVCC vintage único. CONANP tiene histórico de decretos ANP | alto | `anvcc.ts:114-115,252-296` `cargarAnvcc()` sin periodo |
| F5-15 PIB municipal | ANVCC (columna `pib_mun` del mismo CSV) | **b** vs. conector — fuera de alcance permanente | ANVCC vintage único (cobertura 96%). INEGI PIBE / cuentas por entidad tiene serie, pero es otra fuente | alto | `anvcc.ts:117,189` `campo: "pibMun"`; NO sale de BIE/cuentas nacionales. Punto abierto #2 |
| F5-16 PIB turístico municipal | ANVCC (columna `pib_turistico_mun`) | **b** vs. conector — fuera de alcance permanente | ídem F5-15 | alto | `anvcc.ts:118,190` `campo: "pibTuristicoMun"` |
| F5-17 Rezago de vivienda | ANVCC (columna `con_rezago`) | **b** vs. conector — fuera de alcance permanente | ANVCC vintage único. CONAVI/SHF publican rezago habitacional con serie anual | alto | `anvcc.ts:119,191` `campo: "conRezago"` |

---

## Puntos abiertos

Numeración estable. Estado actualizado 2026-08-31 tras investigación factual.

1. **F5-11…F5-17 — series en las fuentes primarias.** El repo solo prueba que
   la capa ANVCC es vintage único. No hay evidencia en código de si CONAFOR /
   SEGOB-CENAPRED / INEGI-PIBE / CONAVI-SHF exponen APIs de serie usables.
   **CERRADO por decisión de producto (addendum 2026-08-31):** sustituir el
   conector queda fuera de alcance permanente; no se investiga más.
2. **F5-15/16 PIB — vintage real del dato ANVCC.** `anvcc.ts` no registra a qué
   año corresponde `pib_mun` (el CSV no trae campo de año). **CERRADO por
   decisión de producto (addendum 2026-08-31):** fuera de alcance permanente.
3. **F5-2 CONAGUA — ¿a o b?** Existen 4 ediciones de normal (51-80…91-20), pero
   comparar normales de periodos distintos no es "serie temporal" en el sentido
   de "¿cómo cambió año con año?". Queda **b** salvo que producto quiera
   exponer comparación entre normales. *(Sin cambio — no era decisión de esta
   ronda.)*
4. **F3-8 ZAP** — los decretos DOF anuales existen, pero el parseo es manual
   sobre una página de ~24 MB; no hay evidencia de que las URLs de decretos
   2020-2025 estén archivadas de forma estable. **CERRADO por decisión de
   producto (addendum 2026-08-31):** clasificado "a" (la fuente tiene historia),
   pero fuera de alcance permanente para procesamiento.
5. **F1-17 Banxico / F2-10 STPS-SIEL.**
   - **Banxico (F1-17): RESUELTO.** La documentación oficial del SIE API
     confirma `GET /series/{idSerie}/datos` (histórico completo) y
     `GET /series/{idSerie}/datos/{fechaInicio}/{fechaFin}` (rango), además de
     `/datos/oportuno`. El adaptador usa `/datos/oportuno`. Pendiente menor: un
     smoke-test de que las 33 series de remesas (SE29670-SE29702) devuelven
     histórico trimestral completo desde 2003 por ese endpoint — probable, son
     series SIE estándar. (Fuente: developers.banxico.org.mx / SieAPIRest.)
   - **STPS-SIEL (F2-10): NO concluyente.** El código corta en 33 valores con
     `REGEX_VALOR = /"u":"([\d.]+)","m":2,"h":3,"d":4,"r":85/g` — firma
     específica del bloque "Promedio". El comentario dice que siguen "bloques de
     33/12 mensuales" pero **no hay parser** para ellos y las coordenadas de
     celda Cognos (`m`/`h`/`d`/`r`) de esos bloques nunca se inspeccionan.
     Caracterizar cobertura mes/año y si están etiquetados con fecha requiere
     capturar el HTML completo del visor Cognos en vivo — no verificable desde
     el repo.
6. **F2-19 PNUD IDG — REVISADO 2026-08-31: sí hay ediciones históricas.** El
   PNUD presentó el IDG a nivel **municipal** por primera vez en febrero de
   2023, en el "Informe de Desarrollo Humano Municipal 2010-2020" — un informe
   de serie decenal que reporta los cortes estándar del PNUD municipal
   (2010/2015/2020). El documento de 2014 "Indicadores de Desarrollo Humano y
   Género en México: nueva metodología" tenía IDG para 2012 pero a nivel
   nacional/estatal, no municipal. → **Reclasificado de "b provisional" a "a".**
   Pendiente: confirmar si el archivo/dataset combinado 2010-2020 del PNUD trae
   columnas de IDG por año (como sí las trae para IDH y sub-índices), o si los
   cortes 2010/2015 están en un archivo aparte del standalone 2020 que hoy usa
   `pnud.ts:181-192`. (Fuentes: undp.org/es/mexico y mexico.un.org, comunicados
   del Informe Municipal 2010-2020.)
7. **CONEVAL Pobreza (F2-1/2/14) — CERRADO 2026-09-06: serie municipal
   IMPLEMENTADA.** El `Concentrado_..._2020.zip` que usa la celda es de un solo
   año (los offsets `_2020` son convención de nombres, no columnas históricas).
   La serie municipal viene de otra fuente: los CSV de Datos Abiertos de CONEVAL
   `.../pobreza_municipal_2010-2020/indicadores%20de%20pobreza%20municipal_{2010,2015,2020}.csv`
   — verificado en vivo 2026-09-06 que descargan (HTTP 200, latin-1) y que las
   columnas `pobreza`/`pobreza_e`/`carencias` tienen nombre idéntico en los 3
   años. El PDF metodológico oficial ("5. Comparabilidad") declara "serie
   quinquenal comparable 2010-2020" (CONEVAL re-estimó 2010 al ajustar el método
   en 2015). Implementación: `resolverSerieConevalPobrezaMunicipal` (`coneval.ts`)
   lee los 3 CSV por nombre de columna (splitter quote-aware — los campos con
   coma van entre comillas); `serieTemporal.ts` enruta municipal aquí y nac/est
   a `resolverSerieInegiPm`. Serie CERRADA de 3 puntos (2020 es la última
   edición; Encuesta Intercensal 2025 cancelada) → `ResultadoSerieOk.nota`
   (nueva, serie-level) lo declara en la tarjeta de Canvas. Cross-check: punto
   2020 == celda (xlsx) dentro de ±0.04 pp en 12 combos municipio×indicador.
8. **ECEG 2010 a escala sección/distrito — CONFIRMADO 2026-08-31: no está en el
   repo.** Grep de `eceg_2010`, `eceg_2015`, `intercensal`, `encuesta
   intercensal` en `lib/`, `scripts/`, `docs/`, `_docs/` → **cero resultados**.
   La afirmación "ECEG también tiene edición 2010" es conocimiento externo, sin
   ninguna huella en el código ni en la documentación interna. Cualquier serie
   ECEG histórica requiere ingerir esos datos desde cero.
9. **Comparabilidad Censo 2020 ↔ Intercensal 2015 para F1-15, F1-19, F2-13.**
   Cambió el nombre de columna y/o la metodología entre ediciones. Hace falta
   el diccionario de datos de ambas para saber qué series son empalmables.
   **Este es el punto que la decisión (a) del addendum 2026-08-31 resuelve
   provisionalmente** (categoría b, reabrible cuando exista ese diccionario).
10. **F2-7 Producción para el Bienestar — NO concluyente 2026-08-31.** El
    programa opera anualmente desde 2019 y las búsquedas indican que
    datos.gob.mx aloja "datasets de distintos años"; sin embargo, el API de
    datos.gob.mx respondió 403 a `package_show`, así que no se pudo confirmar
    que los padrones 2019-2023 estén publicados como recursos CKAN separados
    accesibles por la misma vía `datastore_search` que usa `bienestar.ts`.
    Requiere una consulta directa a `package_show?id=beneficiarios_programa_produccion_bienestar`
    cuando el API responda.

---

## Lectura rápida para decidir alcance

- **"Fruta madura" (serie ya en el archivo/respuesta descargada, solo falta
  parsear/exponer + un campo de periodo en el modelo):** F2-17 (ya en Storage),
  F3-16, F3-17, F2-3, F2-5/6/8/12/19/20/21/22, F2-1/2/14 (nac/est), F1-18,
  F4-2/3/9/10/11, F4-7 (hoja `CPI Historical` del mismo workbook de la celda),
  F4-1/4/5 (Banco Mundial, endpoint acotado a 5 países — 1 página).
  ~25 indicadores, ~6 fuentes distintas.
- **Requiere ingesta nueva (descargas por año/edición):** bloque ECEG/ITER
  (14 tras la decisión (a): F1-1…F1-14, F1-19 y F2-13 salen), F2-4, F2-9,
  F2-18, F3-1/2/3/4/7, F5-6/7/8, F4-8, F1-17, F2-10 (STPS).
- **Nunca habrá serie (categoría b):** 19 — narrativa curada (6), CONAGUA (1),
  Compendio 2010 (1), EIU (1), F1-15/F1-19/F2-13 (comparabilidad no confirmada,
  reabrible), + los 7 de ANVCC (fuera de alcance permanente).
- **Fuera de auditoría (d):** 9 — 8 de Sefix-AI (sin conector) + RFOSC (caído).
- **Ningún indicador tiene hoy serie consultable.** El único versionado en
  Storage (F2-17) igual no es accesible: el adaptador lee un solo año.
- Un modelo de series necesitaría **(a)** un campo de periodo en
  `ValorIndicadorFontana` / `CeldaTablaFontana`, **(b)** una capa de
  persistencia por periodo (los adaptadores F4 ni usan Storage), y **(c)**
  normalizar el vintage — hoy solo vive como texto en `fuenteEtiqueta`.

---

## Addendum — decisiones de producto (2026-08-31, Raúl)

Cierre de la Tarea 1 (homologación metodológica). 3 de los 10 puntos abiertos
se cierran por decisión de producto; el resto queda para investigación
factual (registrada arriba en §Puntos abiertos).

### (a) F1-15, F1-19, F2-13 — no se muestra serie hasta confirmar comparabilidad

**Indicadores:** F1-15 (% población con discapacidad), F1-19 (% población
indígena monolingüe), F2-13 (% población sin seguridad social, proxy PSINDER).
**Punto abierto asociado:** #9 (cambio de metodología/columna entre Censo
2010/2015 y 2020).
**Decisión:** NO se muestra serie temporal para estos 3 indicadores hasta
contar con el diccionario de datos de ambas ediciones del Censo que confirme
la equivalencia de las variables. Categoría en esta auditoría cambiada de
**a → b**, con esta nota:

> *"Existen datos de ediciones anteriores del Censo, pero un cambio de
> metodología entre 2010/2015 y 2020 impide garantizar que sean comparables
> sin revisión adicional; no se muestra serie hasta confirmarlo."*

**Estado temporal, reabrible:** cuando exista el diccionario de datos que
confirme comparabilidad, estos 3 vuelven a evaluarse para categoría "a".
**Registry:** el `INDICATOR_REGISTRY.json` no tiene hoy un campo de
disponibilidad temporal (la clasificación a/b/c vive solo en esta auditoría).
Si más adelante se introduce un campo estructurado
(`disponibilidadTemporal.categoria`) en el registry, debe arrastrar esta
decisión y su condición de reapertura.

### (b) F5-11 … F5-17 — sustitución del conector ANVCC fuera de alcance permanente

**Indicadores:** F5-11 (incendios forestales, número), F5-12 (superficie
incendiada), F5-13 (declaratorias de desastre), F5-14 (% área natural
protegida), F5-15 (PIB municipal), F5-16 (PIB turístico municipal), F5-17
(rezago de vivienda).
**Puntos abiertos asociados:** #1 y #2.
**Decisión:** FUERA DE ALCANCE PERMANENTE para esta fase. No se sustituye el
conector ANVCC por las fuentes primarias (CONAFOR, SEGOB-CENAPRED, INEGI-PIBE,
CONAVI-SHF), no se procesan series para estos 7 indicadores. Su categoría se
queda como **"b vs. conector"**. Sin cambio de código. **Quedan excluidos de la
cola de la Tarea 2.**

### (c) F3-8 (Zonas de Atención Prioritaria) — fuera de alcance permanente

**Punto abierto asociado:** #4.
**Decisión:** FUERA DE ALCANCE PERMANENTE. El esfuerzo (parseo manual de
decretos DOF de años anteriores, ~24 MB por decreto, sin URLs archivadas de
forma estable) no se justifica para un indicador de designación (lista), no de
valor continuo. Se mantiene clasificado **"a"** en esta auditoría (la fuente sí
tiene historia), pero **no se prioriza para procesamiento en ninguna ronda
futura** salvo que Raúl lo reabra explícitamente.

### Secuenciación acordada para la Tarea 2

Piloto **F2-17** primero (serie ya en Storage), luego los de esfuerzo **bajo**,
después **medio/alto** — excluyendo ya los casos (a), (b) y (c) de este
addendum, los 9 de categoría **d**, y F2-17 solo como piloto.