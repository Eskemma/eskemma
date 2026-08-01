# Fontana (T10) — Propuesta de palabras clave por indicador (84 indicadores)

**Propósito:** insumo de contenido para `derivarMinimosPIP()` (Anexo A, Paso 5). Por cada indicador del catálogo, qué palabras o frases de una pregunta del PIP deberían activarlo como mínimo. Una misma palabra clave puede aparecer en más de una fila — en la misma familia o en otra — de forma deliberada; se marca en "Vínculos cruzados" cuando eso ocurre, para que sea explícito y no un patrón oculto dentro del código.

**Nota metodológica importante — términos ambiguos a resolver antes de aprobar:**
- **"Seguridad"** a secas es ambiguo entre seguridad pública (Familia 3: homicidios, incidencia delictiva) y seguridad social (Familia 2: afiliación a salud/prestaciones). Propongo exigir frase completa ("seguridad pública", "inseguridad", "delincuencia", "crimen") para el primer grupo, y "seguridad social", "afiliación a salud", "prestaciones laborales" para el segundo — nunca la palabra suelta "seguridad".
- **"Rezago"** aparece en tres indicadores conceptualmente distintos (Índice de Rezago Social F2-3, Rezago de vivienda F5-17, y el rezago educativo dentro de F1-13). Debe acompañarse siempre del sustantivo ("rezago social", "rezago de vivienda", "rezago educativo"), nunca sola.
- **"PIB"** aparece en tres escalas distintas (nacional-internacional F4-1, municipal F5-15, turístico municipal F5-16) — igual que ya documentamos con los "3 Gini de México", conviene no tratarlos como intercambiables.

---

## Familia 1 — Sociodemográficos

| ID | Indicador | Palabras clave propuestas | Vínculos cruzados |
|---|---|---|---|
| F1-1 | Población total | población total, número de habitantes, cuántos habitantes, tamaño poblacional | — |
| F1-2 | Pirámide de edades | grupos etarios, pirámide de edad, por edad, estructura etaria, generacional, reemplazo generacional | — |
| F1-3 | % Población indígena | población indígena, comunidad indígena, pueblos originarios | **F2-3** (Índice de Rezago Social), **F2-4** (Índice de Marginación) — la población indígena es un factor estructural de ambos índices |
| F1-4 | % Jefatura femenina | jefatura femenina, hogares con jefa de familia, mujeres jefas de hogar | **F2-19** (Índice de Desigualdad de Género municipal) |
| F1-5 | Escolaridad promedio | escolaridad, nivel educativo, años de estudio, grado promedio | **F2-15** (Gasto de hogares en educación), **F2-20** (Sub-índice IDH — Educación) |
| F1-6 | % Población inmigrante | migración, población inmigrante, migrantes, población que llegó de otro lugar | **F1-17** (Remesas — fenómeno migratorio relacionado, indicador distinto) |
| F1-7 | % Población >65 años | adultos mayores, población de la tercera edad, envejecimiento poblacional | **F1-18** (Razón de dependencia demográfica) |
| F1-8 | % Vivienda con piso de tierra | piso de tierra, condiciones de vivienda precarias, vivienda precaria | **F2-1**/**F2-2** (Pobreza — la carencia de vivienda es un componente de la medición), **F5-17** (Rezago de vivienda) |
| F1-9 | Promedio de ocupantes por cuarto | hacinamiento, ocupantes por cuarto, densidad habitacional | — |
| F1-10 | % Vivienda con servicios básicos | servicios básicos, agua potable, drenaje, electricidad en vivienda | **F2-1**/**F2-2** (Pobreza), **F5-17** (Rezago de vivienda) |
| F1-11 | % Población urbana/rural | urbano rural, distribución territorial, ruralidad, dispersión poblacional | **F5-8** (Zonas menos comunicadas — la ruralidad suele correlacionar con conectividad deficiente) |
| F1-12 | Estado civil | estado civil, soltería, situación conyugal | — |
| F1-13 | % Población sin escolaridad | analfabetismo, sin escolaridad, rezago educativo | **F2-3** (Índice de Rezago Social — el rezago educativo es uno de sus componentes) |
| F1-14 | Educación pos-básica | educación superior, bachillerato, nivel de estudios avanzado | **F2-20** (Sub-índice IDH — Educación) |
| F1-15 | % Población con discapacidad | discapacidad, personas con discapacidad, población con alguna limitación | — |
| F1-16 | Densidad de población | densidad poblacional, concentración de población, dispersión territorial | — |
| F1-17 | Remesas recibidas per cápita | remesas, envíos de dinero del extranjero, ingresos por migración | **F1-6** (% Población inmigrante) |
| F1-18 | Razón de dependencia demográfica | dependencia demográfica, población económicamente activa vs. dependiente | **F1-7** (% Población >65 años) |
| F1-19 | % Población indígena monolingüe | monolingüe, lengua indígena exclusiva, no habla español | **F1-3** (% Población indígena) |

---

## Familia 2 — Socioeconómicos

| ID | Indicador | Palabras clave propuestas | Vínculos cruzados |
|---|---|---|---|
| F2-1 | Pobreza multidimensional | pobreza, población en pobreza, condiciones de pobreza | **F1-8**/**F1-10** (carencias de vivienda que componen la medición) |
| F2-2 | Pobreza extrema | pobreza extrema, pobreza alimentaria, carencia severa | **F1-8**/**F1-10** |
| F2-3 | Índice de Rezago Social | rezago social | **F1-3** (población indígena), **F1-13** (sin escolaridad) |
| F2-4 | Índice de Marginación | marginación, grado de marginación | **F1-3** (población indígena), **F1-8**/**F1-10** (vivienda) |
| F2-5 | IDH Municipal | desarrollo humano, IDH | **F2-19/20/21/22** (sub-índices del mismo IDH) |
| F2-6 | Gini de ingreso | desigualdad de ingreso, coeficiente de Gini, distribución del ingreso | **F2-12** (distribución del ingreso por decil), **F4-2** (Gini internacional — mismo concepto, escala distinta, no intercambiables) |
| F2-7 | Beneficiarios Producción para el Bienestar | Producción para el Bienestar, apoyo al campo, programa agrícola federal | — |
| F2-8 | Beneficiarios Beca Benito Juárez | Beca Benito Juárez, beca educativa federal | **F1-5**/**F1-13**/**F1-14** (indicadores educativos — programa vinculado a escolaridad) |
| F2-9 | Tasa de informalidad | informalidad laboral, empleo informal, sin prestaciones | **F2-13** (seguridad social — la informalidad implica ausencia de afiliación) |
| F2-10 | Salario real medio | salario, ingreso laboral, remuneración | **F2-6**/**F2-12** (ingreso general) |
| F2-11 | Acceso a internet en hogares | internet, conectividad digital, acceso a tecnología | **F5-8** (Zonas menos comunicadas) |
| F2-12 | Distribución del ingreso por decil | deciles de ingreso, concentración del ingreso | **F2-6** (Gini) |
| F2-13 | % Población sin seguridad social (proxy) | seguridad social, afiliación a salud, prestaciones laborales | **F2-9** (informalidad) — *ver nota de ambigüedad con Familia 3* |
| F2-14 | % Población con ≥1 carencia social | carencia social, carencias | **F2-1**/**F2-2** (Pobreza) |
| F2-15 | Gasto de hogares en educación | gasto en educación, inversión educativa del hogar | **F1-5** (escolaridad) |
| F2-16 | Gasto de hogares en salud | gasto en salud, inversión en salud del hogar | **F2-22** (Sub-índice IDH — Salud) |
| F2-17 | Competitividad Estatal (IMCO) | competitividad estatal, entorno de negocios, clima para invertir | **F5-6** (Zonas de actividad económica) |
| F2-18 | Ingreso corriente promedio municipal (ICMM) | ingreso municipal, ingreso corriente | **F5-15** (PIB municipal — concepto relacionado, no idéntico) |
| F2-19 | Índice de Desigualdad de Género (IDG) municipal | desigualdad de género, brecha de género | **F1-4** (jefatura femenina) |
| F2-20 | Sub-índice IDH — Educación | IDH educación | **F1-5**/**F1-14**, **F2-5** (IDH compuesto) |
| F2-21 | Sub-índice IDH — Ingreso | IDH ingreso | **F2-6**/**F2-12**, **F2-5** |
| F2-22 | Sub-índice IDH — Salud | IDH salud | **F2-16**, **F2-5** |

---

## Familia 3 — Geopolíticos

| ID | Indicador | Palabras clave propuestas | Vínculos cruzados |
|---|---|---|---|
| F3-1 | Tasa de homicidios dolosos | homicidios, violencia letal, tasa de homicidios | **F3-17** (Índice de Paz México) |
| F3-2 | Incidencia delictiva | delincuencia, incidencia delictiva, delitos | **F3-1** |
| F3-3 | Victimización (ENVIPE) | victimización, población víctima de delito | **F3-2** |
| F3-4 | Percepción de inseguridad (ENSU) | percepción de inseguridad, sensación de inseguridad, miedo al delito | *ver nota de ambigüedad — nunca "seguridad" sola* |
| F3-5 | Resultados electorales | resultados electorales, votación, quién ganó la elección | **F3-9 a F3-14** (todo el bloque electoral) |
| F3-6 | Participación electoral histórica | participación electoral, quién vota, abstención histórica | **F3-9** |
| F3-7 | Gasto federalizado per cápita | gasto federal, recursos federales, presupuesto federal transferido | — |
| F3-8 | Zonas de Atención Prioritaria | zonas de atención prioritaria, ZAP, pobreza territorial focalizada | **F2-1**/**F2-4** (pobreza y marginación) |
| F3-9 | Tasa de abstención histórica | abstención, no votó, ausentismo electoral | **F3-6** |
| F3-10 | Índice de volatilidad electoral | volatilidad electoral, cambio de voto entre elecciones | **F3-12**/**F3-13** |
| F3-11 | Voto nulo y no registrados | voto nulo, votos no registrados | **F3-5** |
| F3-12 | Margen de victoria | margen de victoria, ventaja electoral, qué tan cerrada la elección | **F3-14** (competitividad electoral) |
| F3-13 | Continuidad de partido ganador | continuidad, alternancia, mismo partido en el poder | **F3-10** (volatilidad) |
| F3-14 | Índice de competitividad electoral | competitividad electoral, elección competida | **F3-12** |
| F3-15 | Presencia de organizaciones sociales | organizaciones sociales, sociedad civil, colectivos | — |
| F3-16 | Huelgas y paros laborales | huelgas, paros laborales, conflicto laboral | **F2-9** (informalidad — contexto laboral) |
| F3-17 | Índice de Paz México | paz, nivel de violencia relativa, entorno de seguridad estatal | **F3-1** |

---

## Familia 4 — Comparación internacional

| ID | Indicador | Palabras clave propuestas | Vínculos cruzados |
|---|---|---|---|
| F4-1 | PIB per cápita PPA | PIB per cápita, producto interno bruto, comparación económica internacional | **F5-15** (PIB municipal — misma familia conceptual, escala distinta, *no intercambiables*) |
| F4-2 | Gini internacional | desigualdad internacional, Gini comparado | **F2-6** (Gini de ingreso — mismo concepto, metodología distinta, *no intercambiables*) |
| F4-3 | IDH global | desarrollo humano internacional, ranking IDH mundial | **F2-5** (IDH Municipal — mismo concepto, portal y metodología distintos) |
| F4-4 | Pobreza línea internacional | pobreza internacional, línea de pobreza global | **F2-1**/**F2-2** (pobreza nacional, metodología distinta) |
| F4-5 | Inflación | inflación, incremento de precios, poder adquisitivo | — |
| F4-6 | Índice de Democracia (EIU) | calidad democrática, régimen político, democracia comparada | — |
| F4-7 | Índice de Percepción de Corrupción | corrupción, percepción de corrupción, transparencia | — |
| F4-8 | Libertad de Prensa (RSF) | libertad de prensa, libertad de expresión, censura | — |
| F4-9 | Confianza en instituciones | confianza institucional, credibilidad de instituciones | **F3-15** (organizaciones sociales — tejido social relacionado) |

---

## Familia 5 — Características territoriales

| ID | Indicador | Palabras clave propuestas | Vínculos cruzados |
|---|---|---|---|
| F5-1 | Factores geográficos | geografía, cartografía, límites territoriales, relieve | — |
| F5-2 | Factores climáticos | clima, temperatura, precipitación, condiciones climáticas | — |
| F5-3 | Historia del territorio | historia local, antecedentes históricos, patrimonio histórico | **F5-4** |
| F5-4 | Personajes célebres | personajes célebres, figuras históricas locales | **F5-3** |
| F5-5 | Tradiciones y fiestas | tradiciones, fiestas patronales, festividades, calendario cultural | — |
| F5-6 | Zonas de actividad económica | actividad económica, zonas comerciales, unidades económicas | **F2-17** (competitividad estatal) |
| F5-7 | Zonas habitacionales y comerciales | zonas habitacionales, uso de suelo, zonas metropolitanas | **F1-8**/**F1-10** (condiciones de vivienda), **F5-17** (rezago de vivienda) |
| F5-8 | Zonas menos comunicadas | conectividad física, comunicación terrestre, aislamiento territorial | **F1-11** (ruralidad), **F2-11** (acceso a internet) |
| F5-9 | Atractivos turísticos | turismo, atractivos turísticos, destinos turísticos | **F5-16** (PIB turístico municipal) |
| F5-10 | Problemáticas ecológicas | medio ambiente, problemática ambiental, ecología | **F5-11 a F5-14** (todo el bloque ambiental) |
| F5-11 | Incendios forestales (número) | incendios forestales, incendios | **F5-12** |
| F5-12 | Superficie incendiada (ha) | superficie incendiada, hectáreas quemadas | **F5-11** |
| F5-13 | Declaratorias de desastre | desastre natural, declaratoria de desastre, emergencia ambiental | **F5-10** |
| F5-14 | % Área natural protegida | área natural protegida, ANP, conservación ambiental | **F5-10** |
| F5-15 | PIB municipal | PIB municipal, producto interno bruto local | **F4-1** (escala distinta, *no intercambiables*), **F2-18** (ingreso corriente municipal) |
| F5-16 | PIB turístico municipal | PIB turístico, economía turística local | **F5-9** (atractivos turísticos) |
| F5-17 | Rezago de vivienda (con/sin rezago) | rezago de vivienda, vivienda con rezago | **F1-8**/**F1-10** (misma familia conceptual, distinto del Índice de Rezago Social F2-3) |

---

## Resumen de decisiones que requieren tu confirmación explícita

1. **Los 3 términos ambiguos** (sección de nota metodológica arriba) — ¿confirmas exigir frase completa en vez de la palabra suelta?
2. **Los vínculos cruzados marcados "no intercambiables"** (Gini, IDH, PIB en sus versiones nacional/internacional vs. municipal) — ¿confirmas que, aunque comparten palabra clave, deben tratarse como indicadores distintos y no fusionarse en una sola activación?
3. **Cualquier fila donde tu criterio de consultor político difiera** del que propuse — este documento es el borrador de trabajo, no una versión final.
