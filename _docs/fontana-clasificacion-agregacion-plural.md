# Clasificación de agregación territorial plural — Catálogo completo de indicadores Fontana (84)

**Criterio aplicado** (mismo ya validado en `lib/fontana/ingesta/index.ts:478-497`): la pregunta no es "¿es un índice?" sino "¿la magnitud admite una operación de recombinación válida entre varias unidades territoriales del mismo nivel (ej. 3 municipios seleccionados directamente)?"

- **`aditivo`** — conteos y magnitudes absolutas: sumar es matemáticamente válido.
- **`tasa_ponderada`** — porcentajes, promedios y tasas: nunca promediar el valor ya calculado; reconstruir numerador y denominador de cada unidad, sumarlos, y recalcular la tasa sobre el total.
- **`no_agregable`** — índices compuestos sin fórmula de recombinación validada, rankings relativos, datos geoespaciales/categóricos, o indicadores de alcance nacional que no varían con el territorio del proyecto.
- **`narrativo_sintetizado`** — contenido cualitativo curado (no numérico): no es una operación aritmética, es síntesis narrativa entre unidades (mismo tratamiento que PESTEL).

Esta tabla es la clasificación propuesta por Raúl (evaluación humana). **Estado de implementación
(26-08-17): F1 y F2 (41 indicadores) ya están poblados en `data/fontana/INDICATOR_REGISTRY.json` a
partir de esta tabla. F3/F4/F5 (43 indicadores) quedan documentados aquí como referencia — no se
escriben al registry todavía porque esas familias no tienen pipeline de ingesta implementado en
Fontana (`app/api/fontana/familia/[familiaId]/route.ts` responde 400 explícito para F3/F4/F5). Cuando
esas familias se construyan, esta tabla es la fuente lista para poblar `agregacionPlural` sin
re-derivar el criterio — ver CLAUDE.md, Deuda Técnica Conocida.**

---

## Familia 1 — Sociodemográficos

| Clave | Nombre del indicador | Clasificación | Justificación |
|---|---|---|---|
| F1-1 | Población total | `aditivo` | Conteo de personas — la suma de varios municipios/distritos es la población total real del territorio combinado. |
| F1-2 | Pirámide de edades | `aditivo` | Conteos por grupo quinquenal de edad — cada grupo se suma independientemente entre unidades. |
| F1-3 | % Población indígena | `tasa_ponderada` | Porcentaje — reconstruir población indígena y población total de cada unidad, sumar ambos numeradores/denominadores por separado, recalcular el %. |
| F1-4 | % Jefatura femenina | `tasa_ponderada` | Mismo criterio que F1-3 (hogares con jefatura femenina / total de hogares). |
| F1-5 | Escolaridad promedio | `tasa_ponderada` | Promedio — requiere ponderar por población de 15+ años de cada unidad, no promediar los promedios directamente. |
| F1-6 | % Población inmigrante | `tasa_ponderada` | Mismo criterio que F1-3. |
| F1-7 | % Población >65 años | `tasa_ponderada` | Mismo criterio que F1-3. |
| F1-8 | % Vivienda con piso de tierra | `tasa_ponderada` | Mismo criterio que F1-3 (viviendas con piso de tierra / total de viviendas). |
| F1-9 | Promedio de ocupantes por cuarto | `tasa_ponderada` | Promedio — ponderar por número de cuartos o viviendas de cada unidad, nunca promediar el promedio ya calculado. |
| F1-10 | % Vivienda con servicios básicos | `tasa_ponderada` | Mismo criterio que F1-3. |
| F1-11 | % Población urbana/rural | `tasa_ponderada` | Mismo criterio que F1-3. |
| F1-12 | Estado civil (soltero/casado/separado) | `tasa_ponderada` | 3 porcentajes independientes — mismo criterio que F1-3 aplicado a cada categoría. |
| F1-13 | % Población sin escolaridad | `tasa_ponderada` | Mismo criterio que F1-3. |
| F1-14 | Educación pos-básica | `tasa_ponderada` | Mismo criterio que F1-3. |
| F1-15 | % Población con discapacidad | `tasa_ponderada` | Mismo criterio que F1-3. |
| F1-16 | Densidad de población | `tasa_ponderada` | Es un cociente (POBTOT ÷ superficie) — la densidad combinada correcta es sumar población y sumar superficie de cada unidad por separado, y recalcular, no promediar las densidades. |
| F1-17 | Remesas recibidas per cápita | `tasa_ponderada` | Es una tasa (monto per cápita) — reconstruir remesas totales y población de cada unidad por separado antes de recalcular el per cápita combinado. |
| F1-18 | Razón de dependencia demográfica | `tasa_ponderada` | Cociente entre dos poblaciones (dependientes / en edad productiva) — mismo criterio de reconstrucción de numerador/denominador. |
| F1-19 | % Población indígena monolingüe | `tasa_ponderada` | Mismo criterio que F1-3. |

## Familia 2 — Socioeconómicos

| Clave | Nombre del indicador | Clasificación | Justificación |
|---|---|---|---|
| F2-1 | Pobreza multidimensional | `tasa_ponderada` | Porcentaje de población en pobreza — mismo criterio que F1-3 (reconstruir numerador/denominador). |
| F2-2 | Pobreza extrema | `tasa_ponderada` | Mismo criterio que F2-1. |
| F2-3 | Índice de Rezago Social | `no_agregable` | Índice compuesto (CONEVAL) sin fórmula de recombinación entre unidades territoriales validada — mismo ejemplo ya citado en el diseño original de la taxonomía. |
| F2-4 | Índice de Marginación | `no_agregable` | Índice compuesto (CONAPO) — mismo criterio que F2-3. |
| F2-5 | IDH Municipal | `no_agregable` | Índice compuesto (PNUD) construido a partir de sub-índices no lineales — combinar varias unidades requeriría recalcular desde los componentes, no está definido. |
| F2-6 | Gini de ingreso | `no_agregable` | Índice de desigualdad — el Gini de la población combinada NO es el promedio ponderado de los Gini individuales; requiere microdatos para recalcularse correctamente. |
| F2-7 | Beneficiarios Producción para el Bienestar | `aditivo` | Conteo de personas beneficiarias — suma válida entre unidades. |
| F2-8 | Beneficiarios Beca Benito Juárez | `aditivo` | Mismo criterio que F2-7. |
| F2-9 | Tasa de informalidad | `tasa_ponderada` | Porcentaje — mismo criterio que F1-3 (reconstruir ocupados informales / población ocupada). |
| F2-10 | Salario real medio | `tasa_ponderada` | Promedio — ponderar por número de trabajadores de cada unidad, no promediar los promedios. |
| F2-11 | Acceso a internet en hogares | `tasa_ponderada` | Porcentaje de hogares — mismo criterio que F1-3. |
| F2-12 | Distribución del ingreso por decil | `no_agregable` | Los deciles se construyen ordenando la población completa por ingreso — combinar deciles de unidades distintas sin microdatos originales no reproduce la distribución real combinada. |
| F2-13 | % Población sin seguridad social | `tasa_ponderada` | Mismo criterio que F1-3. |
| F2-14 | % Población con ≥1 carencia social | `tasa_ponderada` | Mismo criterio que F1-3. |
| F2-15 | Gasto de hogares en educación | `tasa_ponderada` | Promedio por hogar — ponderar por número de hogares de cada unidad. |
| F2-16 | Gasto de hogares en salud | `tasa_ponderada` | Mismo criterio que F2-15. |
| F2-17 | Competitividad Estatal (IMCO) | `no_agregable` | Ranking relativo entre entidades — un "promedio de rankings" es un dato inventado sin significado real (ejemplo original citado en el diseño de la taxonomía). |
| F2-18 | Ingreso corriente promedio municipal (ICMM) | `tasa_ponderada` | Es un promedio (aunque estimado vía modelo SEBLUP) — magnitud monetaria promedio, ponderar por población/hogares de cada unidad; el origen modelado no impide la recombinación (mismo criterio ya fijado para F2-18 en el diseño original). |
| F2-19 | Índice de Desigualdad de Género (IDG) municipal | `no_agregable` | Índice compuesto (PNUD) — mismo criterio que F2-5. |
| F2-20 | Sub-índice IDH — Educación | `no_agregable` | Sub-índice compuesto — mismo criterio que F2-5. |
| F2-21 | Sub-índice IDH — Ingreso | `no_agregable` | Mismo criterio que F2-20. |
| F2-22 | Sub-índice IDH — Salud | `no_agregable` | Mismo criterio que F2-20. |

## Familia 3 — Geopolíticos

| Clave | Nombre del indicador | Clasificación | Justificación |
|---|---|---|---|
| F3-1 | Tasa de homicidios dolosos | `tasa_ponderada` | Tasa por cada 100 mil habitantes — reconstruir homicidios totales y población de cada unidad, sumar, y recalcular la tasa combinada. |
| F3-2 | Incidencia delictiva | `tasa_ponderada` | Mismo criterio que F3-1. |
| F3-3 | Victimización (ENVIPE) | `tasa_ponderada` | Porcentaje de población victimizada — mismo criterio que F1-3. |
| F3-4 | Percepción de inseguridad (ENSU) | `tasa_ponderada` | Porcentaje de percepción — mismo criterio que F1-3. |
| F3-5 | Resultados electorales | `aditivo` | Votos — suma válida entre secciones/unidades, mismo criterio ya confirmado en el código real de Sefix (`storage.ts:3211,3297`). |
| F3-6 | Participación electoral histórica | `tasa_ponderada` | Porcentaje — reconstruir votos emitidos y lista nominal de cada unidad, sumar, y recalcular — nunca promediar el % ya calculado (mismo criterio que ya usa Sefix). |
| F3-7 | Gasto federalizado per cápita | `tasa_ponderada` | Tasa per cápita — mismo criterio que F1-17. |
| F3-8 | Zonas de Atención Prioritaria | `no_agregable` | Designación categórica/geográfica (una zona está o no declarada ZAP) — no es una magnitud numérica summable; combinar unidades no produce un valor agregado con significado. |
| F3-9 | Tasa de abstención histórica | `tasa_ponderada` | Mismo criterio que F3-6. |
| F3-10 | Índice de volatilidad electoral | `no_agregable` | Índice derivado de comparar dos elecciones — no tiene una fórmula de recombinación entre unidades territoriales validada. |
| F3-11 | Voto nulo y no registrados | `aditivo` | Conteo de votos — mismo criterio que F3-5. |
| F3-12 | Margen de victoria | `no_agregable` | Depende de qué candidato/partido queda primero y segundo en el TOTAL combinado — no es el promedio de los márgenes individuales, que pueden tener ganadores distintos por unidad. |
| F3-13 | Continuidad de partido ganador | `no_agregable` | Dato categórico (sí/no, o nombre del partido) — no es una magnitud numérica agregable. |
| F3-14 | Índice de competitividad electoral | `no_agregable` | Índice derivado — mismo criterio que F3-10. |
| F3-15 | Presencia de organizaciones sociales | `aditivo` | Conteo de organizaciones registradas — suma válida entre unidades. |
| F3-16 | Huelgas y paros laborales | `aditivo` | Conteo de eventos — suma válida entre unidades. |
| F3-17 | Índice de Paz México | `no_agregable` | Índice compuesto (IEP) — mismo criterio que F2-3. |

## Familia 4 — Comparación internacional

| Clave | Nombre del indicador | Clasificación | Justificación |
|---|---|---|---|
| F4-1 | PIB per cápita PPA | `no_agregable` | Valor único a nivel país — no varía según qué distrito/municipio/estado se seleccione dentro del proyecto; la pluralidad territorial no le aplica. |
| F4-2 | Gini internacional | `no_agregable` | Mismo criterio que F4-1. |
| F4-3 | IDH global | `no_agregable` | Mismo criterio que F4-1. |
| F4-4 | Pobreza línea internacional | `no_agregable` | Mismo criterio que F4-1. |
| F4-5 | Inflación | `no_agregable` | Mismo criterio que F4-1. |
| F4-6 | Índice de Democracia (EIU) | `no_agregable` | Mismo criterio que F4-1. |
| F4-7 | Índice de Percepción de Corrupción | `no_agregable` | Mismo criterio que F4-1. |
| F4-8 | Libertad de Prensa (RSF) | `no_agregable` | Mismo criterio que F4-1. |
| F4-9 | Confianza en instituciones | `no_agregable` | Mismo criterio que F4-1. |

## Familia 5 — Características territoriales

| Clave | Nombre del indicador | Clasificación | Justificación |
|---|---|---|---|
| F5-1 | Factores geográficos | `no_agregable` | Datos geoespaciales/geométricos (Marco Geoestadístico) — no son una magnitud numérica summable ni promediable con significado. |
| F5-2 | Factores climáticos | `no_agregable` | Normales climatológicas por estación — combinarlas entre municipios requeriría una metodología de ponderación espacial no definida; no es una simple suma o promedio. |
| F5-3 | Historia del territorio | `narrativo_sintetizado` | Contenido curado manualmente (INAH/monografías/cronistas) — no es una operación aritmética, es síntesis narrativa entre unidades, mismo tratamiento que PESTEL. |
| F5-4 | Personajes célebres | `narrativo_sintetizado` | Mismo criterio que F5-3 — contenido curado, no numérico. |
| F5-5 | Tradiciones y fiestas | `narrativo_sintetizado` | Mismo criterio que F5-3. |
| F5-6 | Zonas de actividad económica | `aditivo` | Conteo de establecimientos (DENUE) por zona — suma válida entre unidades. |
| F5-7 | Zonas habitacionales y comerciales | `no_agregable` | Designación geográfica categórica (Sistema Urbano Nacional) — no es una magnitud numérica summable. |
| F5-8 | Zonas menos comunicadas | `no_agregable` | Mismo criterio que F5-7 — designación geográfica, no magnitud numérica. |
| F5-9 | Atractivos turísticos | `aditivo` | Conteo de atractivos — suma válida entre unidades. |
| F5-10 | Problemáticas ecológicas | `no_agregable` | Dato categórico/estructurado (tipo de problemática por unidad, INECC) — no es una cifra única summable; requiere desglose, no agregación numérica. |
| F5-11 | Incendios forestales (número) | `aditivo` | Conteo de eventos — suma válida entre unidades. |
| F5-12 | Superficie incendiada (ha) | `aditivo` | Hectáreas — magnitud absoluta, suma válida entre unidades. |
| F5-13 | Declaratorias de desastre | `aditivo` | Conteo de declaratorias — suma válida entre unidades. |
| F5-14 | % Área natural protegida | `tasa_ponderada` | Porcentaje del territorio — reconstruir superficie de ANP y superficie total de cada unidad, sumar, y recalcular el % combinado. |
| F5-15 | PIB municipal | `aditivo` | Magnitud monetaria — suma válida entre municipios (el PIB combinado de 2 municipios es la suma de ambos). |
| F5-16 | PIB turístico municipal | `aditivo` | Mismo criterio que F5-15. |
| F5-17 | Rezago de vivienda (con/sin rezago) | `tasa_ponderada` | Porcentaje de viviendas con rezago — mismo criterio que F1-3. |

---

## Resumen por tipo de agregación

| Tipo | Cantidad | Familias donde aparece |
|---|---|---|
| `aditivo` | 20 | F1 (1), F2 (2), F3 (5), F5 (7) |
| `tasa_ponderada` | 36 | F1 (17), F2 (11), F3 (4), F5 (2) — mayoría absoluta |
| `no_agregable` | 25 | F2 (8), F3 (7), F4 (9), F5 (4) |
| `narrativo_sintetizado` | 3 | F5 (3) |
| **Total** | **84** | |

*Nota: los conteos de F1 no incluyen F1-2 (Pirámide de edades), clasificado como `aditivo` pero compuesto por múltiples sub-valores (grupos quinquenales) — cada uno se suma independientemente.*
