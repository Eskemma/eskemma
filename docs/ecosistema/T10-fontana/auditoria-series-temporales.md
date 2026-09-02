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
| F2-1 Pobreza multidimensional | CONEVAL / INEGI-PM | a | nac/estatal: serie bienal 2008-2024 (INEGI-PM BISE). municipal: 2010/2015/2020, congelado 2020 (LGDS). distrital: reconstruido de municipal | nac/est **bajo** (array `Serie` completo en respuesta BISE); municipal **alto** (archivos CONEVAL 2010/2015 en carpetas `/2010/`, `/2015/`, no en el repo) | `inegiPm.ts:95` toma `Serie[0]`; `coneval.ts:37` URL `Concentrado_...2020.zip` (archivo de un solo año, ver punto abierto #7) |
| F2-2 Pobreza extrema | CONEVAL / INEGI-PM | a | ídem F2-1 | ídem F2-1 | `inegiPm.ts:95` `Serie[0]`; `coneval.ts:149` |
| F2-3 Índice de Rezago Social | CONEVAL IRS | a (b en nacional) | estatal + municipal: **5 cortes 2000/2005/2010/2015/2020 en el mismo ZIP**. nacional: la fuente lo deja en blanco todos los años → b | **bajo** (el ZIP ya trae los 5 años; hoy se filtra 1) | `coneval.ts:69` URL `IRS_ent_mun_2000_2020.zip`; `:60-66` comentario "el ZIP trae 5 archivos"; `:237` filtro `/2020\.xlsx$/i` descarta 4; `:36-44` nacional en blanco |
| F2-4 Índice de Marginación | CONAPO | a | estatal + municipal: serie 1990-2020 (IME/IMM normalizados). nacional no lo publica la fuente | medio (archivos `IM*_1990.xls`…`2015.xls` aparte) | `conapoMarginacion.ts:39-40` URLs `IME_2020.xls`/`IMM_2020.xls` fijas; cache sin dimensión de año (`:63-73`) |
| F2-5 IDH Municipal | PNUD | a | solo municipal; serie 2010/2015/2020 **en el archivo combinado** | **bajo** (el adaptador usa el standalone 2020; el combinado ya trae 3 años) | `pnud.ts:9-11` archivo combinado con 2010/2015/2020; `:132` lee solo `fila[27]` (IDH 2020) |
| F2-6 Gini de ingreso | ENIGH tabulados | a | nac + estatal: serie 2016-2024 (columnas C-G del mismo XLSX). municipal/distrital: sin representatividad | **bajo** (columnas 2016/2018/2020/2022 en el mismo archivo) | `enigh.ts:18-19` cols C-G = años; `:67` `COL_ANO_2024="G"`; `:156,166` solo col G |
| F2-7 Beneficiarios Producción para el Bienestar | Bienestar (CKAN) | a | municipal (programa anual desde 2019; padrones por año, disponibilidad CKAN no confirmada) | medio | `bienestar.ts:18-19,71-88` resources etiquetados "(2024)"; bodega `bienestar_produccion_v2/{cve}.json` sin año. Punto abierto #10 |
| F2-8 Beca Benito Juárez | Bienestar (CKAN) | a | trimestral: **Q1-Q4 2025 en el mismo paquete CKAN** (128 recursos = 32×4) | **bajo** (los otros 3 trimestres ya están en el paquete) | `bienestar.ts:27-33,90-107` usa solo "4to. trim. 2025" |
| F2-9 Tasa de informalidad (TIL1) | ENOE-Infolaboral | a | fuente: nac + estatal trimestral desde 2005. Fontana: solo estatal, 1 corte (1T 2026) | alto (re-exportación manual por trimestre) | `enoeInformalidad.ts:19-23,48` header "un solo valor… sin serie histórica"; `scripts/upload-fontana-enoe-til1.ts:66-68` un `periodo` |
| F2-10 Salario real medio | STPS/SIEL (IMSS) | a | nac + estatal, **bloques mensuales en la MISMA respuesta Cognos** (se descartan; cobertura mes/año NO caracterizada — punto abierto #5) | **bajo-medio** (parsear los bloques que ya vienen, si están etiquetados con fecha) | `stpsSalario.ts:78-88` `if (valores.length === 33) break;` + comentario "resto son desgloses mensuales"; no hay parser para esos bloques |
| F2-11 Acceso a internet en hogares | ECEG | a | nac/est/mun 2015/2020 (+secc 2020) | alto | bloque ECEG (`VPH_INTER`) |
| F2-12 Distribución del ingreso por decil | ENIGH tabulados | a | nac + estatal serie 2016-2024 (mismo Cuadro 2.1) | **bajo** | `enigh.ts:18-24`; `:160` lee `COL_ANO_2024` por decil |
| F2-13 % Sin seguridad social (proxy PSINDER) | ECEG | **b** (decisión 2026-08-31, reabrible) | nac/est/mun 2010/2015/2020, comparabilidad no confirmada | — (bloqueado hasta diccionario de datos) | bloque ECEG (`PSINDER`); addendum decisión (a); punto abierto #9 |
| F2-14 % Pob con ≥1 carencia | CONEVAL / INEGI-PM | a | ídem F2-1 | ídem F2-1 | `inegiPm.ts:95` `Serie[0]` |
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

| id | fuente | cat | historia MX vs referencia | esfuerzo | evidencia |
|---|---|---|---|---|---|
| F4-1 PIB per cápita PPA | Banco Mundial (`NY.GDP.PCAP.PP.CD`) | a | serie anual desde 1960, igual para MX y COL/CHL/BRA/ARG (una sola llamada `country=all`) | medio (quitar `mrnev=1`, pedir `?date=1990:2025`) | `bancoMundial.ts:103` endpoint con `mrnev=1` (recorta server-side); año solo en `fuenteEtiqueta` (`:141`) |
| F4-2 Gini internacional | CEPALSTAT (id 3289) | a | serie completa (quiebre 2014/2016 documentado); igual MX + 4 referencia LATAM | **bajo** (serie completa YA descargada y cacheada, se descarta) | `cepalstat.ts:149` endpoint sin año → todos los años; `:136` cache entera; `:200-204` `masRecienteTotal` reduce a 1 |
| F4-3 IDH global | PNUD HDR (CSV) | a | el CSV **es** la serie completa 1990-2023 (`hdi_1990..hdi_2023`); igual MX + referencia | **bajo** (el multi-año está en la fila parseada, se tira) | `pnudHdr.ts:21` CSV "complete time series"; `:47-50` detecta todas las cols `hdi_YYYY`, toma `[length-1]` |
| F4-4 Pobreza línea internacional | Banco Mundial (`SI.POV.DDAY`) | a | serie por años de encuesta (irregular); huecos por disponibilidad, no asimetría MX-referencia | medio (ídem F4-1) | `bancoMundial.ts:103` `mrnev=1` |
| F4-5 Inflación | Banco Mundial (`FP.CPI.TOTL.ZG`) | a | serie anual; igual | medio (ídem F4-1) | `bancoMundial.ts:103` `mrnev=1` |
| F4-6 Índice de Democracia (EIU) | EIU vía CRS R46016 | **b** | tabla hardcodeada 2024, sin fetch; serie = transcripción manual de PDF de baja frecuencia | — | `eiuDemocracyIndex.ts:58-89` `TABLA_EIU_CRS_2024` + `AÑO_EDICION = 2024`; `score` diferido (`:8-9`) |
| F4-7 Índice de Percepción de Corrupción | Transparencia Internacional (XLSX) | a | CPI anual desde 2012; el propio archivo trae la tendencia 2012-2024 en otras columnas | bajo-medio (leer las columnas de tendencia del mismo workbook) | `transparencyInternational.ts:24-25` URL fija `CPI2024-Results-and-trends.xlsx`, hoja "CPI 2024"; `:44-48` solo lee score+rank 2024 |
| F4-8 Libertad de Prensa (RSF) | RSF (CSV) | a | anual (CSVs por año `/import_classement/YYYY.csv`; quiebre 2022) | medio (fetch de CSVs por año) | `rsf.ts:24` URL fija `.../2026.csv`; `:50-52` toma `Score 2026`+`Rank` |
| F4-9 Desconfianza en partidos/congreso | CEPALSTAT (id 995, Latinobarómetro) | a | "Anual, con años sin oleada"; igual MX + 4 referencia LATAM | **bajo** (serie completa ya descargada + cacheada) | `cepalstat.ts:149` `/indicator/995/data` sin año; `:200-204` `masRecienteTotal` |
| F4-10 Confianza en la policía | CEPALSTAT (id 3257) | a | ídem F4-9 | **bajo** | `cepalstat.ts:149` `/indicator/3257/data` |
| F4-11 Confianza en el poder judicial | CEPALSTAT (id 5528) | a | ídem F4-9 | **bajo** | `cepalstat.ts:149,100` `/indicator/5528/data` (dim_144); `:200-204` |

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
7. **CONEVAL Pobreza (F2-1/2/14) — RESUELTO 2026-08-31: el "Concentrado" es de
   un solo año.** El archivo `Concentrado_indicadores_de_pobreza_2020.zip` que
   usa `coneval.ts` tiene su URL scoped a `/Pobreza_municipal/2020/` y el ZIP
   "trae un solo .xlsx" (a diferencia del ZIP de IRS, que trae 5). Los offsets
   `_2020` en el código son convención de nombres, **no** evidencia de columnas
   2015/2010 en el mismo archivo. La serie histórica de F2-1/2/14 en
   nac/estatal viene de INEGI-PM BISE (`inegiPm.ts`, array `Serie`, esfuerzo
   bajo); en municipal requiere los archivos CONEVAL por año de las carpetas
   `/2010/` y `/2015/` (no en el repo, esfuerzo alto).
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
  F4-2/3/9/10/11. ~21 indicadores, ~5 fuentes distintas.
- **Requiere ingesta nueva (descargas por año/edición):** bloque ECEG/ITER
  (14 tras la decisión (a): F1-1…F1-14, F1-19 y F2-13 salen), F2-4, F2-9,
  F2-18, F3-1/2/3/4/7, F5-6/7/8, F4-1/4/5/7/8, F1-17, F2-10 (STPS).
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