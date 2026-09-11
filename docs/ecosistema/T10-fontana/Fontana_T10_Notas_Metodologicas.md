# Notas metodológicas de Fontana

*Eskemma · Ecosistema digital · Septiembre 2026*

Este es un documento de consulta. Puedes ir directo a la sección que necesites. Si es tu primera vez, te recomendamos leer "Alcance y objetivo" y "Definiciones y conceptos clave" antes que el resto. Explica cómo Fontana obtiene sus datos, qué tan confiables son, y qué hace cuando algo no está disponible. Está pensado para ti y tu equipo que usa Fontana para investigar un territorio. Los términos técnicos se explican la primera vez que aparecen.

---

## 1. Alcance y objetivo

Fontana existe para que no tengas que salir de la plataforma a buscar manualmente datos de INEGI, CONEVAL, CONAPO, Banxico y otras fuentes oficiales abiertas. Organiza esa información en 5 familias de indicadores y la presenta en tablas comparativas por nivel geográfico (nacional, estatal, municipal o distrital, según el tipo de tu proyecto).

Lo que hace distinto a Fontana no es solo reunir los datos, sino nunca presentarlos como una cifra sin procedencia: cada dato que ves queda documentado con su fuente y con su "naturaleza" (si es un dato directo, un cálculo, una estimación o un valor de referencia — ver la sección de Definiciones). Cuando un dato no existe o no se pudo obtener, Fontana te lo dice explícitamente, con el motivo real, en vez de dejar un espacio en blanco sin explicación.

Fontana hoy cubre México; una fase posterior ampliará la cobertura a otros países de Iberoamérica.

---

## 2. Definiciones y conceptos clave

### 2.1 Las 5 familias de indicadores

| Familia | Qué agrupa |
|---|---|
| F1 — Sociodemográficos | Indicadores derivados del Censo de Población y Vivienda 2020 (INEGI). |
| F2 — Socioeconómicos | Pobreza, marginación, bienestar y acceso a servicios — CONAPO, Bienestar, INEGI. |
| F3 — Geopolíticos | Seguridad pública, gasto federalizado y organizaciones sociales — SESNSP, INEGI, SHCP, DOF, RFOSC. |
| F4 — Comparación internacional | México frente a un set fijo de países de referencia — Banco Mundial, CEPALSTAT, PNUD, RSF, Transparencia Internacional. |
| F5 — Características territoriales | Clima, tradiciones, actividad económica, zonas urbanas y riesgos ambientales — CONAGUA, INEGI/DENUE, SEDATU/CONAPO, INECC. |

### 2.2 Prontuario de naturaleza del dato

Todo dato en Fontana lleva una etiqueta de naturaleza, es decir, qué tan directo es su origen. Esto se marca por nivel geográfico, no una sola vez por indicador: un mismo indicador puede ser un dato directo a nivel estatal y una estimación a nivel municipal, según lo que la fuente publique en cada nivel.

Las 5 categorías, con un ejemplo real de cada una:

- **Dato directo** — el número exacto tal como lo publica la fuente, sin ningún cálculo de Fontana de por medio.
  Ejemplo: Población Total (F1-1) — la cifra que publica el Censo de INEGI, sin tocar.

- **Cálculo directo** — Fontana hace una operación simple y transparente (una suma, una división) sobre cifras que la fuente ya publica, dentro de la misma unidad territorial — sin combinar municipios ni modelar nada.
  Ejemplo: % de Población Indígena (F1-3) — se calcula dividiendo el conteo de población indígena entre la población total, ambos publicados por el Censo de INEGI (vía ECEG) para el mismo municipio.

- **Estimación modelada** — un índice o valor que la propia fuente calcula combinando distintas variables con su propia metodología (no es Fontana quien modela, solo lo lee).
  Ejemplo: el Índice de Desarrollo Humano municipal (F2-5), calculado por PNUD combinando ingreso, salud y educación.

- **Estimación agregada** — cuando la fuente no publica un total por estado (o nacional), Fontana lo construye sumando los municipios que sí tienen dato, siempre etiquetado como propio de Fontana, no de la fuente original.
  Ejemplo real: PIB municipal (F5-15) — INECC solo publica el dato por municipio; el valor estatal que ves en Fontana es la suma de los municipios de ese estado con dato disponible.

- **Valor de referencia (proxy)** — una cifra que se usa como aproximación de un concepto que la fuente ideal no mide directamente.
  Ejemplo: el salario real medio (F2-10) viene del Seguro Social (IMSS) — mide el salario de los trabajadores formalmente asegurados, no de toda la población ocupada (que incluye informalidad); se usa como la mejor referencia disponible, con esa limitación declarada.

### 2.3 Glosario

- **Nivel geográfico**: el "zoom" al que se muestra un dato — nacional, estatal, municipal o distrital (federal/local). No todos los indicadores existen en todos los niveles; cuando falta uno, Fontana lo declara con su motivo.

- **Indicador heredado (o "candado")**: cuando trabajas dentro de un proyecto que ya tiene una pregunta de investigación asignada, algunos indicadores llegan precargados porque esa pregunta los exige explícitamente. No los elegiste tú, vienen del proyecto. Fontana los distingue siempre de los que exploraste libremente.

- **Serie temporal**: la evolución de un indicador a lo largo de varios años (no solo el corte más reciente). No todos los indicadores la tienen (ver la sección 5).

- **Comparación internacional**: un grupo específico de indicadores (Familia 4) que comparan México contra un conjunto fijo de países de referencia (Colombia, Chile, Brasil y Argentina, por defecto; ampliable si lo pides explícitamente).

- **Territorio del proyecto vs. territorio externo**: por defecto, Fontana muestra datos del territorio de tu proyecto. Si preguntas por otro estado o municipio, Fontana lo aclara explícitamente como "territorio externo" para que no lo confundas con el tuyo.

- **Agregación plural / desglose**: cuando tu proyecto abarca varios municipios o distritos a la vez, no todos los indicadores se pueden "sumar" o "combinar" de forma válida entre ellos. Fontana distingue 4 casos: los que se pueden sumar directo (conteos), los que hay que recalcular desde sus componentes (tasas y porcentajes — nunca promediando el valor ya calculado), los que simplemente no admiten combinarse (índices, rankings), y el contenido cualitativo (texto curado, sin operación numérica posible). Cuando no se puede combinar, Fontana te muestra el desglose por unidad en vez de inventar un promedio.

### 2.4 Siglas

Listado alfabético de todas las siglas que aparecen en Fontana y en este documento, con su expansión completa.

- **ANVCC** — Atlas Nacional de Vulnerabilidad al Cambio Climático. Herramienta del INECC de la que Fontana toma incendios forestales, declaratorias de desastre, áreas naturales protegidas, y (como insumo compilado, no como estadística propia) PIB municipal, PIB turístico municipal y rezago de vivienda.
- **CENAPRED** — Centro Nacional de Prevención de Desastres. Órgano de la Secretaría de Gobernación (creado tras el sismo de 1985) que, junto con SEGOB, es fuente primaria de las declaratorias de desastre que el Atlas del INECC solo publica como una sola medición.
- **CEPAL / CEPALSTAT** — Comisión Económica para América Latina y el Caribe; CEPALSTAT es su plataforma de estadísticas, de donde Fontana toma la desigualdad de ingreso y la confianza en instituciones para la comparación internacional.
- **CLUNI** — Clave Única de Inscripción (al Registro Federal de las Organizaciones de la Sociedad Civil).
- **CONAFOR** — Comisión Nacional Forestal. Órgano del gobierno federal (bajo SEMARNAT) responsable de la conservación y manejo forestal — es la fuente primaria con serie histórica de los incendios forestales que el Atlas del INECC solo publica como una sola medición.
- **CONAGUA** — Comisión Nacional del Agua. Fuente de los factores climáticos de Fontana.
- **CONAPO** — Consejo Nacional de Población. Fuente de la marginación, la dependencia demográfica y el Sistema Urbano Nacional.
- **CONAVI** — Comisión Nacional de Vivienda. Fuente primaria (junto con SHF) del rezago de vivienda que el Atlas del INECC compila como insumo.
- **CONEVAL** — Consejo Nacional de Evaluación de la Política de Desarrollo Social. Fuente de la pobreza, el rezago social y la accesibilidad a carreteras.
- **DENUE** — Directorio Estadístico Nacional de Unidades Económicas. Producto de INEGI que registra empresas y establecimientos; de ahí Fontana toma las zonas de actividad económica.
- **DOF** — Diario Oficial de la Federación. Fuente de las Zonas de Atención Prioritaria.
- **ECEG** — Estadísticas Censales a Escalas Geoelectorales: herramienta conjunta de INEGI e INE que traduce los datos del Censo a la cartografía electoral (sección y distrito electoral), lo que permite a Fontana mostrar indicadores censales por distrito.
- **EIU** — The Economist Intelligence Unit. Fuente del Índice de Democracia (comparación internacional).
- **ENIGH** — Encuesta Nacional de Ingresos y Gastos de los Hogares. Encuesta de INEGI de la que Fontana toma el Gini de ingreso, la distribución del ingreso por decil y el gasto de los hogares en educación y salud.
- **ENOE** — Encuesta Nacional de Ocupación y Empleo. Fuente de la tasa de informalidad laboral.
- **ENSU** — Encuesta Nacional de Seguridad Pública Urbana. Fuente de la percepción de inseguridad.
- **ENVIPE** — Encuesta Nacional de Victimización y Percepción sobre Seguridad Pública. Fuente de la victimización.
- **GACP** — Grado de Accesibilidad a Carretera Pavimentada. Indicador de CONEVAL sobre zonas menos comunicadas.
- **ICMM** — Ingreso Corriente para los Municipios de México. Programa de INEGI del que Fontana toma el ingreso corriente municipal.
- **IDH** — Índice de Desarrollo Humano. Se usa tanto a nivel municipal (PNUD México) como en la comparación internacional (PNUD, edición global).
- **IEP** — Institute for Economics and Peace. Fuente del Índice de Paz México.
- **IMCO** — Instituto Mexicano para la Competitividad. Organización de la que Fontana toma la Competitividad Estatal.
- **IMSS** — Instituto Mexicano del Seguro Social. El salario real medio de Fontana se calcula sobre trabajadores asegurados ante esta institución.
- **INE** — Instituto Nacional Electoral. Organismo autónomo encargado de organizar las elecciones federales y locales en México; coautor, junto con INEGI, de la herramienta ECEG que permite a Fontana mostrar datos censales por distrito electoral.
- **INECC** — Instituto Nacional de Ecología y Cambio Climático. Publica el Atlas Nacional de Vulnerabilidad al Cambio Climático (ANVCC).
- **INEGI** — Instituto Nacional de Estadística y Geografía. La fuente más usada en Fontana — Censo, encuestas y programas especializados.
- **ITER** (Principales Resultados por Localidad) — producto oficial de INEGI que desglosa los datos del Censo hasta el nivel de localidad — el nivel más detallado disponible.
- **PIB** — Producto Interno Bruto. Se usa tanto a nivel municipal (compilado por el INECC) como en la comparación internacional (Banco Mundial).
- **PIP** — Programa de Investigación Profunda. La pregunta de investigación de un proyecto de Moddulo que, cuando existe, determina qué indicadores llegan "heredados" a tu sesión de Fontana.
- **PNUD** — Programa de las Naciones Unidas para el Desarrollo. Fuente del Índice de Desarrollo Humano, tanto municipal como internacional.
- **PPA** — Paridad de Poder Adquisitivo. Ajuste que usa el Banco Mundial para que el PIB per cápita sea comparable entre países con distinto costo de vida.
- **RFOSC** — Registro Federal de las Organizaciones de la Sociedad Civil.
- **RSF** — Reporteros Sin Fronteras. Fuente del índice de libertad de prensa.
- **SEDATU** — Secretaría de Desarrollo Agrario, Territorial y Urbano. Coautora, junto con CONAPO, del Sistema Urbano Nacional.
- **SEFIX-AI** — Aplicación del ecosistema digital de Eskemma que procesa los datos electorales del INE para obtener los indicadores electorales de Familia 3.
- **SEGOB** — Secretaría de Gobernación.
- **SESNSP** — Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública. Fuente de homicidios e incidencia delictiva.
- **SHCP** — Secretaría de Hacienda y Crédito Público. Fuente del gasto federalizado per cápita.
- **SHF** — Sociedad Hipotecaria Federal. Fuente primaria (junto con CONAVI) del rezago de vivienda.
- **SIC** — Sistema de Información Cultural (Secretaría de Cultura). Fuente de las tradiciones y fiestas.
- **SIE** — Sistema de Información Económica (Banxico). Plataforma del Banco de México de la que Fontana toma las remesas per cápita.
- **SIEL** — Sistema de Información Estadística Laboral, de la STPS, del que Fontana toma el salario real medio.
- **STPS** — Secretaría del Trabajo y Previsión Social. Fuente de las huelgas y paros laborales, y del salario real medio (vía su sistema SIEL).

---

## 3. Fuentes de datos

Fontana solo usa fuentes públicas y oficiales. Esta es la lista de instituciones que integra hoy:

| Institución | Qué aporta a Fontana |
|---|---|
| INEGI (Censo 2020, ITER, ECEG, ENIGH, ENOE, ENVIPE, ENSU, ICMM, DENUE, Compendio Geográfico) | Datos sociodemográficos, ingreso y desigualdad, informalidad laboral, victimización y percepción de inseguridad, ingreso municipal, actividad económica, superficie territorial. |
| CONAPO | Marginación, dependencia demográfica, Sistema Urbano Nacional. |
| CONEVAL | Pobreza, pobreza extrema, carencias sociales, rezago social, accesibilidad a carreteras. |
| Secretaría de Bienestar | Beneficiarios de programas sociales (Producción para el Bienestar, Beca Benito Juárez). |
| PNUD (México e internacional) | Índice de Desarrollo Humano municipal y sus componentes; IDH global e igualdad de género para comparación internacional. |
| Banxico | Remesas recibidas per cápita. |
| SESNSP | Homicidios e incidencia delictiva. |
| SHCP | Gasto federalizado per cápita. |
| DOF (Diario Oficial de la Federación) | Zonas de Atención Prioritaria. |
| STPS | Huelgas y paros laborales; salario real medio (vía IMSS). |
| IEP (Institute for Economics and Peace) | Índice de Paz México. |
| Banco Mundial | PIB per cápita, pobreza en línea internacional, inflación (comparación internacional). |
| CEPALSTAT (CEPAL) | Desigualdad de ingreso, confianza en instituciones (comparación internacional). |
| Transparencia Internacional | Percepción de corrupción. |
| Reporteros Sin Fronteras | Libertad de prensa. |
| The Economist Intelligence Unit (vía informe del Congreso de EE.UU.) | Índice de Democracia. |
| CONAGUA | Factores climáticos. |
| SIC (Secretaría de Cultura) | Tradiciones y fiestas. |
| SEDATU/CONAPO | Zonas habitacionales y comerciales (ciudades y zonas metropolitanas). |
| INECC (Atlas Nacional de Vulnerabilidad al Cambio Climático) | Incendios forestales, declaratorias de desastre, áreas naturales protegidas — y, como se explica abajo, también PIB municipal, PIB turístico municipal y rezago de vivienda. |
| RFOSC/CLUNI (Bienestar) | Presencia de organizaciones sociales (fuente actualmente sin conector — ver Transparencia sobre ausencias). |
| Eskemma (contenido curado) | Historia del territorio, personajes célebres, tradiciones, atractivos turísticos — investigación editorial propia, no un dato estadístico de una institución. |

**Un caso que vale la pena explicar con precisión — PIB municipal, PIB turístico municipal y rezago de vivienda (Familia 5):**

Estos 3 indicadores citan como fuente al INECC, pero no porque el INECC produzca estadísticas de economía o vivienda — el INECC es la autoridad de cambio climático. Lo que ocurre es que su Atlas Nacional de Vulnerabilidad al Cambio Climático necesita, para calcular qué tan vulnerable es un territorio, no solo datos de riesgo climático (incendios, desastres) sino también su capacidad económica y sus condiciones de vivienda — porque ambas influyen en la capacidad de un lugar para adaptarse. Por eso el mismo archivo que da el número de incendios también trae PIB municipal y vivienda con carencias.

En otras palabras: estos 3 datos están compilados por el INECC para su propio Atlas, usando como insumo cifras que originalmente produce el INEGI (cuentas económicas por municipio) y CONAVI/SHF (rezago de vivienda) — no son la estadística oficial más reciente de esas instituciones, sino la versión que el INECC integró a su modelo, sin que la fuente declare siquiera el año exacto al que corresponde el dato. Fontana lo muestra tal como lo consulta (verificado en vivo, es un dato real, no un error), pero es justo el tipo de matiz que este documento existe para explicarte: no toda cifra citada como "fuente X" es producida originalmente por X.

---

## 4. Alcance geográfico y sus límites

No todos los indicadores bajan al mismo nivel de detalle geográfico, y no siempre por la misma razón. Algunos ejemplos reales:

- **El Índice de Desarrollo Humano en Oaxaca**: el PNUD no publica este dato por municipio individual en Oaxaca — en su edición más reciente agrupa a los 570 municipios del estado en 30 regiones, sin desagregar ninguno (ni siquiera la capital). Fontana te lo dice explícitamente en vez de mostrarte el dato de "la región" haciéndolo pasar por el municipio.

- **Remesas por municipio**: Banxico no publica un mecanismo confiable de remesas a nivel municipio en ningún caso — siempre verás "no disponible a este nivel" para este indicador, de forma permanente, no por un error puntual.

- **Gasto federalizado por municipio**: la SHCP solo publica esta cifra a nivel estatal; el detalle municipal existe como reporte, no como dato consultable.

- **Proyectos que abarcan varios municipios o estados ("proyecto plural")**: cuando seleccionas varios territorios a la vez, Fontana solo combina los valores donde matemáticamente tiene sentido hacerlo (ver "agregación plural" en el glosario) — nunca promedia un índice o combina un dato que no admite esa operación; en esos casos te muestra el desglose por unidad para que veas cada valor por separado.

- **Territorio externo**: si le pides a Fontana un dato de un municipio o estado distinto al de tu proyecto, te lo aclara explícitamente — para que nunca confundas el dato de "otro lugar" con el de tu propio territorio.

---

## 5. Series temporales

De los 86 indicadores de Fontana, 22 tienen serie histórica (evolución en el tiempo, no solo el corte más reciente): 13 a nivel geográfico (nacional/estatal/municipal, según el caso) y 9 en la comparación internacional (Familia 4).

### Serie geográfica (13)

| Indicador | Niveles con serie | Cobertura temporal |
|---|---|---|
| F2-1 Pobreza multidimensional | Nacional, Estatal, Municipal | Nacional/Estatal: 2016-2024 (5 puntos, INEGI-PM). Municipal: 2010, 2015, 2020 (CONEVAL) — serie cerrada, no habrá cortes municipales posteriores |
| F2-2 Pobreza extrema | Nacional, Estatal, Municipal | Igual que F2-1 |
| F2-14 % con al menos una carencia social | Nacional, Estatal, Municipal | Igual que F2-1 |
| F2-3 Índice de rezago social | Estatal, Municipal | 2000, 2005, 2010, 2015, 2020 (5 puntos, quinquenal — CONEVAL) |
| F2-5 IDH Municipal | Municipal | 2010, 2015, 2020 (PNUD). En Oaxaca no se desagrega por municipio (ver sección 4) |
| F2-20 Sub-Índice IDH-Educación | Municipal | Igual que F2-5 |
| F2-21 Sub-Índice IDH-Ingreso | Municipal | Igual que F2-5 |
| F2-22 Sub-Índice IDH-Salud | Municipal | Igual que F2-5 |
| F2-6 Gini de ingreso | Nacional, Estatal | Bienal, según los años que publica la ENIGH |
| F2-12 Distribución del ingreso por decil | Nacional, Estatal | Bienal, según los años que publica la ENIGH |
| F2-17 Competitividad Estatal (IMCO) | Estatal | 2016-2025 (10 puntos) |
| F3-16 Huelgas y paros laborales | Nacional, Estatal | Serie anual densa (incluye años sin huelgas registradas como 0); el año en curso se excluye por estar incompleto |
| F3-17 Índice de Paz México | Nacional, Estatal | Serie anual, según las ediciones publicadas del índice |

### Comparación internacional – Familia 4 (9)

| Indicador | Cobertura temporal |
|---|---|
| F4-1 PIB per cápita (PPA) | 1990-2025 (36 puntos, Banco Mundial) |
| F4-4 Pobreza línea internacional | Desde 1990 (Banco Mundial); años de encuesta irregulares según el país |
| F4-5 Inflación | Desde 2000 (Banco Mundial); Argentina solo desde 2018 |
| F4-2 Gini internacional | 2016-2024 (5 puntos, CEPALSTAT); el tramo anterior a 2016 se omite por el quiebre metodológico |
| F4-3 IDH Global | 1990-2023 (34 puntos, PNUD HDR) |
| F4-7 Índice de Percepción de Corrupción | 2012-2024 (13 puntos, Transparencia Internacional), sin quiebres |
| F4-9 Desconfianza en partidos/congreso | 1996-2024 (23 puntos, CEPALSTAT/Latinobarómetro) |
| F4-10 Confianza en la policía | Igual que F4-9 |
| F4-11 Confianza en el poder judicial | Igual que F4-9 |

Los otros 64 muestran solo el dato más reciente disponible — y esto no siempre significa lo mismo:

- En algunos casos, la fuente sí tiene historial, pero Fontana todavía no lo ha incorporado (es una limitación temporal de Fontana, no de la fuente).
- En otros, no existe una serie comparable en el tiempo, porque la fuente cambió de metodología o solo publica una medición (es un límite real de la fuente).

**Series "cerradas"**: algunos indicadores tienen una serie que ya no va a crecer. El caso más claro es la pobreza municipal de CONEVAL (2010, 2015, 2020) — la medición pasó a hacerla el INEGI, que solo la publica a nivel nacional y estatal, así que no habrá un corte municipal más reciente que 2020.

**Quiebres metodológicos declarados**: cuando comparar dos años no es directo por un cambio de metodología de la propia fuente, Fontana lo declara en vez de empalmar cifras que no son comparables. Dos ejemplos: la desigualdad de ingreso internacional (CEPALSTAT) solo se muestra desde 2016, porque la fuente rehízo su medición ese año; y la inflación internacional excluye a Brasil antes del año 2000 (por su hiperinflación de esa época) y a Argentina antes de 2018 (el Banco Mundial no publica ese dato para años anteriores).

---

## 6. El Reporte de Sesión

Fontana puede generar, a petición tuya, un Reporte de Sesión: un documento que organiza todo lo que investigaste sobre un territorio en una sesión de trabajo — combina lo que fijaste explícitamente en tu lienzo de trabajo (gráficas, tablas, comparaciones) con los indicadores que seleccionaste en la tabla comparativa, sin repetir nada dos veces.

Si tu sesión viene de un proyecto con una pregunta de investigación asignada, el reporte separa dos secciones: los indicadores heredados de esa pregunta (los que el proyecto ya exigía) y tu exploración adicional (lo que investigaste libremente). Si tu sesión es independiente, todo aparece en una sola sección.

La redacción del reporte combina dos partes: las tablas y cifras se arman de forma completamente automática a partir de los datos ya verificados (nunca las toca la inteligencia artificial); solo la lectura y el contexto — el texto que explica qué implican esos números — lo redacta la IA, y tiene prohibido inventar cualquier cifra que no esté ya en los datos verificados. Esto te da la garantía de que ningún número del reporte puede haber sido alterado en la redacción.

---

## 7. Transparencia sobre ausencias

El principio de Fontana es simple: nunca inventar un dato, siempre declarar por qué falta. Cuando un valor no aparece, siempre viene acompañado de un motivo real, no de una casilla vacía. Algunos ejemplos de los motivos que puedes encontrar, traducidos a lenguaje simple:

- **"Nivel no cubierto en este incremento de Fontana"** — Fontana todavía no tiene ese nivel geográfico para ese indicador (es una limitación de Fontana, temporal).
- **"No se pudo resolver a tiempo"** — la fuente tardó demasiado en responder al generar tu reporte; es un problema de tiempo, no de que el dato no exista — puedes volver a intentarlo.
- **"En validación"** — Fontana detectó un problema en ese dato y lo está corrigiendo antes de mostrarlo.
- **"Pendiente"** — la fuente todavía no está conectada a Fontana (por ejemplo, datos de otro módulo del ecosistema de Eskemma).
- **"Fuente no disponible"** — la infraestructura de la institución está caída (por ejemplo, el registro de organizaciones sociales); se reintentará en cuanto vuelva a estar disponible.
- Casos de cobertura territorial específica (como el de Oaxaca/PNUD ya explicado en la sección 4).

Este principio también aplica al Reporte de Sesión y a cualquier respuesta que te dé el asistente conversacional de Fontana: si un dato no está disponible, se te dice explícitamente por qué. Nunca se completa con una suposición.

---

## Apéndice — Catálogo completo de los 86 indicadores

Tabla de referencia autosuficiente. Cada fila incluye su nota relevante aunque ya se haya explicado en el cuerpo principal, para que sirva de consulta directa sin necesidad de leer el resto del documento.

### Familia 1 — Sociodemográficos (19)

| Indicador | Qué mide | Fuente | Nota relevante |
|---|---|---|---|
| F1-1 Población total | Población total del municipio/estado | INEGI (Censo 2020, vía ECEG) | Dato directo, sin cálculo de Fontana. |
| F1-2 Pirámide de edades | Distribución de la población por grupo de edad y sexo | INEGI (ITER, Censo 2020) | Construida sumando los grupos quinquenales que INEGI ya publica. |
| F1-3 % Población indígena | Porcentaje de población hablante de lengua indígena | INEGI (Censo 2020, vía ECEG) | — |
| F1-4 % Jefatura femenina | Porcentaje de hogares con jefatura femenina | INEGI (Censo 2020, vía ECEG) | — |
| F1-5 Escolaridad promedio | Años promedio de escolaridad | INEGI (Censo 2020, vía ECEG) | — |
| F1-6 % Población inmigrante | Porcentaje de población nacida en otra entidad | INEGI (Censo 2020, vía ECEG) | Antes se buscaba medir "migración neta", pero CONAPO no calcula ese dato a nivel municipal — se sustituyó por este indicador, que sí tiene fuente confiable. |
| F1-7 % Población mayor de 65 años | Porcentaje de adultos mayores | INEGI (Censo 2020, vía ECEG) | — |
| F1-8 % Vivienda con piso de tierra | Porcentaje de viviendas con piso de tierra | INEGI (Censo 2020, vía ECEG) | — |
| F1-9 Ocupantes por cuarto | Promedio de personas por cuarto (hacinamiento) | INEGI (Censo 2020, vía ECEG) | Se presenta siempre como promedio, nunca como porcentaje. |
| F1-10 % Vivienda con servicios básicos | Porcentaje de viviendas con agua, drenaje y electricidad | INEGI (Censo 2020, vía ECEG) | — |
| F1-11 % Población urbana/rural | Porcentaje de población en localidades urbanas vs. rurales | INEGI (ITER, Censo 2020) | Usa el criterio oficial de INEGI (localidades de 2,500 habitantes o más se consideran urbanas). |
| F1-12 Estado civil | Distribución por estado civil (soltero, casado, separado) | INEGI (Censo 2020, vía ECEG) | — |
| F1-13 % Población sin escolaridad | Porcentaje de población de 15 años o más sin ningún grado escolar | INEGI (Censo 2020, vía ECEG) | — |
| F1-14 Educación pos-básica | Porcentaje con educación más allá de la secundaria | INEGI (Censo 2020, vía ECEG) | Incluye bachillerato, no solo educación superior — el nombre se ajustó para reflejar esto con precisión. |
| F1-15 % Población con discapacidad | Porcentaje de población con alguna discapacidad | INEGI (Censo 2020, vía ECEG) | El criterio para medir discapacidad cambió entre 2010/2015 y 2020 — no es comparable en el tiempo. |
| F1-16 Densidad de población | Habitantes por kilómetro cuadrado | INEGI (Compendio Geográfico Municipal 2010 + ITER 2020) | La superficie municipal usada viene de una fuente de 2010 (la más reciente disponible con ese detalle) — no se actualiza automáticamente. |
| F1-17 Remesas per cápita | Remesas recibidas por habitante | Banxico (SIE) + INEGI (ITER 2020) | Disponible a nivel estatal; a nivel municipal, Banxico no publica un mecanismo confiable — siempre aparecerá "no disponible" ahí, de forma permanente. |
| F1-18 Razón de dependencia demográfica | Relación entre población dependiente (niños y adultos mayores) y población en edad de trabajar | CONAPO | — |
| F1-19 % Población indígena monolingüe | Porcentaje que solo habla lengua indígena, sin español | INEGI (Censo 2020, vía ECEG) | Mismo cambio de criterio 2010/2015 vs. 2020 que F1-15 — no comparable en el tiempo. |

### Familia 2 — Socioeconómicos (22)

| Indicador | Qué mide | Fuente | Nota relevante |
|---|---|---|---|
| F2-1 Pobreza multidimensional | Porcentaje de población en situación de pobreza multidimensional | INEGI (2024, nacional/estatal); CONEVAL (2020, municipal/distrital) | La fuente cambió en 2026: antes CONEVAL medía esto en todos los niveles, ahora el INEGI lo hace a nivel nacional/estatal (el corte municipal sigue siendo de CONEVAL 2020, la única fuente que baja a ese nivel). |
| F2-2 Pobreza extrema | Porcentaje en pobreza extrema | INEGI (2024, nac/est); CONEVAL (2020, mun/dist) | Mismo cambio de fuente que F2-1. |
| F2-3 Índice de Rezago Social | Índice compuesto de carencias sociales (educación, salud, vivienda, servicios) | CONEVAL | Serie histórica cerrada 2010-2020 — no habrá cortes municipales más recientes (ver sección 5). No es el mismo archivo que F2-1/F2-2/F2-14, aunque comparten institución. |
| F2-4 Índice de Marginación | Índice compuesto de marginación socioeconómica | CONAPO | — |
| F2-5 IDH Municipal | Índice de Desarrollo Humano por municipio | PNUD México | En Oaxaca, este dato no baja a nivel municipal — el PNUD agrupa los 570 municipios en 30 regiones, sin desagregar ninguno (ver sección 4). |
| F2-6 Gini de ingreso | Coeficiente de desigualdad del ingreso | INEGI (ENIGH 2024) | Es uno de 3 "Gini de México" distintos que existen en Fontana (junto al de comparación internacional, F4-2) — no son intercambiables, se calculan con metodologías distintas. |
| F2-7 Beneficiarios Producción para el Bienestar | Número de beneficiarios del programa | Secretaría de Bienestar | — |
| F2-8 Beneficiarios Beca Benito Juárez | Número de beneficiarios de la beca | Secretaría de Bienestar | Se usa el trimestre 3 de 2025, no el más reciente disponible (trimestre 4): el archivo del trimestre 4 sobrecontaba beneficiarios en un ~40% (confirmado contra la cifra oficial), así que se usa deliberadamente el corte anterior, más confiable. |
| F2-9 Tasa de informalidad | Porcentaje de población ocupada en el sector informal | INEGI (ENOE) | — |
| F2-10 Salario real medio | Salario promedio de trabajadores asegurados | STPS/SIEL (vía IMSS) | Es un valor de referencia: mide solo a trabajadores formalmente asegurados ante el IMSS, no a toda la población ocupada (que incluye informalidad). |
| F2-11 Acceso a internet en hogares | Porcentaje de hogares con acceso a internet | INEGI (Censo 2020, vía ECEG) | — |
| F2-12 Distribución del ingreso por decil | Ingreso promedio por decil de la población (10 grupos, del más al menos ingreso) | INEGI (ENIGH 2024) | — |
| F2-13 % sin seguridad social | Porcentaje de población sin acceso a servicios de salud | INEGI (Censo 2020, vía ECEG) | Mismo cambio de criterio 2010/2015 vs. 2020 que F1-15 — no comparable en el tiempo. |
| F2-14 % con al menos una carencia social | Porcentaje con al menos una carencia (rezago educativo, acceso a salud, vivienda, etc.) | INEGI (2024, nac/est); CONEVAL (2020, mun/dist) | Mismo cambio de fuente que F2-1/F2-2. |
| F2-15 Gasto de los hogares en educación | Gasto promedio de los hogares en educación | INEGI (ENIGH 2024) | — |
| F2-16 Gasto de los hogares en salud | Gasto promedio de los hogares en salud | INEGI (ENIGH 2024) | — |
| F2-17 Competitividad Estatal (IMCO) | Índice de competitividad por estado | IMCO | — |
| F2-18 Ingreso corriente municipal (ICMM) | Ingresos totales del gobierno municipal (impuestos, participaciones, etc.) | INEGI (ICMM) | Distinto conceptualmente del PIB municipal (F5-15) — este mide ingresos del gobierno municipal, no el tamaño de la economía local. |
| F2-19 Índice de Desigualdad de Género municipal | Índice compuesto de desigualdad de género | PNUD México | Mismo caso de Oaxaca que F2-5 (agrupación en 30 regiones, sin desagregar ningún municipio). |
| F2-20 Sub-índice IDH — Educación | Componente educativo del IDH municipal | PNUD México | Mismo caso de Oaxaca que F2-5. |
| F2-21 Sub-índice IDH — Ingreso | Componente de ingreso del IDH municipal | PNUD México | Mismo caso de Oaxaca que F2-5. |
| F2-22 Sub-índice IDH — Salud | Componente de salud del IDH municipal | PNUD México | Mismo caso de Oaxaca que F2-5. |

### Familia 3 — Geopolíticos (17)

| Indicador | Qué mide | Fuente | Nota relevante |
|---|---|---|---|
| F3-1 Tasa de homicidios dolosos | Homicidios dolosos por cada 100,000 habitantes | SESNSP | La población usada en el cálculo es siempre del mismo año que los homicidios (nunca la del Censo 2020), para no mezclar años distintos. |
| F3-2 Incidencia delictiva | Número de carpetas de investigación abiertas | SESNSP | Es un conteo, no una tasa — se puede sumar directamente entre municipios. |
| F3-3 Victimización (ENVIPE) | Porcentaje de población que fue víctima de un delito | INEGI (ENVIPE) | Se obtiene del reporte anual de la encuesta, no de un archivo de datos abiertos — la fuente no publica esta cifra de otra forma. |
| F3-4 Percepción de inseguridad (ENSU) | Porcentaje que percibe inseguridad en su ciudad | INEGI (ENSU) | Solo cubre 90 áreas urbanas específicas del país — si tu proyecto abarca varios municipios en áreas distintas, Fontana lo declara en vez de mezclarlos. |
| F3-5 Resultados electorales | Resultados de elecciones | Sefix-AI con datos del INE | — |
| F3-6 Participación electoral histórica | Historial de participación en elecciones | Sefix-AI con datos del INE | — |
| F3-7 Gasto federalizado per cápita | Transferencias federales por habitante | SHCP | Solo a nivel estatal — el detalle municipal existe como reporte, no como dato consultable. |
| F3-8 Zonas de Atención Prioritaria | Municipios/localidades declaradas de atención prioritaria | DOF | Se actualiza con el decreto anual — puede no reflejar cambios muy recientes. |
| F3-9 Tasa de abstención histórica | Historial de abstención electoral | Sefix-AI con datos del INE | — |
| F3-10 Índice de volatilidad electoral | Qué tanto cambia el voto entre elecciones | Sefix-AI con datos del INE | — |
| F3-11 Voto nulo y no registrados | Porcentaje de votos nulos y candidaturas no registradas | Sefix-AI con datos del INE | — |
| F3-12 Margen de victoria | Diferencia de votos entre el primer y segundo lugar | Sefix-AI con datos del INE | — |
| F3-13 Continuidad de partido ganador | Si el mismo partido ha ganado en elecciones consecutivas | Sefix-AI con datos del INE | — |
| F3-14 Índice de competitividad electoral | Qué tan cerrada es la contienda electoral | Sefix-AI con datos del INE | — |
| F3-15 Presencia de organizaciones sociales | Número de organizaciones de la sociedad civil registradas | RFOSC/CLUNI (Bienestar) | La infraestructura de esta fuente está caída actualmente — se reintentará cuando vuelva a estar disponible. |
| F3-16 Huelgas y paros laborales | Número de huelgas y paros registrados | STPS | — |
| F3-17 Índice de Paz México | Índice compuesto de paz (homicidios, delitos, gasto en seguridad, etc.) | Institute for Economics and Peace | Solo existe a nivel nacional y estatal — esta fuente no publica por municipio ni distrito. |

### Familia 4 — Comparación internacional (11)

| Indicador | Qué mide | Fuente | Nota relevante |
|---|---|---|---|
| F4-1 PIB per cápita (PPA) | PIB por habitante, ajustado por poder de compra | Banco Mundial | — |
| F4-2 Gini internacional | Coeficiente de desigualdad de ingreso, comparado entre países | CEPALSTAT (CEPAL) | Solo se muestra desde 2016: la fuente rehízo su medición ese año y los datos anteriores no son comparables. Es uno de los 3 "Gini de México" en Fontana — no intercambiable con F2-6. |
| F4-3 IDH global | Índice de Desarrollo Humano, comparado entre países | PNUD (HDR) | Distinto del IDH municipal (F2-5) — usan metodologías distintas, no se deben comparar directamente entre sí. |
| F4-4 Pobreza línea internacional | Porcentaje de población bajo la línea internacional de pobreza | Banco Mundial | La línea de referencia cambió recientemente de $2.15 a $3.00 USD/día (2021, poder de compra) — no comparable con reportes anteriores del Banco Mundial que usaban la línea vieja. |
| F4-5 Inflación | Inflación anual, comparada entre países | Banco Mundial | Solo se muestra desde el año 2000, para excluir la hiperinflación de Brasil de inicios de los 90; Argentina no tiene dato antes de 2018 (el Banco Mundial no lo publica para años anteriores). |
| F4-6 Índice de Democracia (EIU) | Índice compuesto de calidad democrática | The Economist Intelligence Unit (vía informe del Congreso de EE.UU.) | Solo el rango y la categoría del país son confiables en esta fuente; el puntaje exacto viene de una fuente secundaria de menor confiabilidad — Fontana distingue ambos explícitamente. |
| F4-7 Índice de Percepción de Corrupción | Percepción de corrupción en el sector público | Transparencia Internacional | Serie completa 2012-2024, sin quiebres — la fuente empezó a medir en 2012, no es que falten datos anteriores. |
| F4-8 Libertad de Prensa (RSF) | Índice de libertad de prensa | Reporteros Sin Fronteras | — |
| F4-9 Desconfianza en partidos/congreso | Porcentaje que desconfía de partidos políticos y el Congreso | CEPALSTAT (Latinobarómetro) | — |
| F4-10 Confianza en la policía | Porcentaje que confía en la policía | CEPALSTAT (Latinobarómetro) | — |
| F4-11 Confianza en el poder judicial | Porcentaje que confía en el poder judicial | CEPALSTAT (Latinobarómetro) | — |

### Familia 5 — Características territoriales (17)

| Indicador | Qué mide | Fuente | Nota relevante |
|---|---|---|---|
| F5-1 Factores geográficos | Descripción del territorio (relieve, ubicación, etc.) | Eskemma (contenido curado) | Investigación editorial propia. |
| F5-2 Factores climáticos | Clima predominante de la región | CONAGUA (o Eskemma si no hay dato de CONAGUA) | El dato oficial de CONAGUA siempre tiene prioridad; el contenido editorial nunca sobrescribe un dato real. |
| F5-3 Historia del territorio | Reseña histórica del municipio/estado | Eskemma (contenido curado) | Investigación editorial propia. |
| F5-4 Personajes célebres | Personas destacadas originarias del territorio | Eskemma (contenido curado) | Investigación editorial propia. |
| F5-5 Tradiciones y fiestas | Tradiciones y festividades locales | Eskemma (contenido curado) | Investigación editorial propia. |
| F5-6 Zonas de actividad económica | Número de unidades económicas por giro | INEGI (DENUE) | — |
| F5-7 Zonas habitacionales y comerciales | Población de la zona metropolitana o ciudad a la que pertenece el municipio | SEDATU/CONAPO (Sistema Urbano Nacional) | Si tu municipio forma parte de una zona metropolitana, el valor mostrado es el de TODA la zona, no solo tu municipio — se aclara siempre. |
| F5-8 Zonas menos comunicadas | Grado de accesibilidad por carretera pavimentada | CONEVAL (GACP) | — |
| F5-9 Atractivos turísticos | Lista de atractivos turísticos del territorio | Eskemma (contenido curado) | Investigación editorial propia. |
| F5-10 Problemáticas ecológicas | Problemas ambientales relevantes del territorio | Eskemma (contenido curado) | Investigación editorial propia. |
| F5-11 Incendios forestales | Número de incendios forestales registrados | INECC (Atlas de Vulnerabilidad al Cambio Climático) | Es una sola medición (sin año de referencia declarado por la fuente) — no tiene serie en el tiempo, aunque la institución especializada (CONAFOR) sí publica un historial que Fontana no consulta todavía. |
| F5-12 Superficie incendiada | Hectáreas afectadas por incendios | INECC (Atlas de Vulnerabilidad al Cambio Climático) | Mismo caso que F5-11. |
| F5-13 Declaratorias de desastre | Número de declaratorias de desastre natural | INECC (Atlas de Vulnerabilidad al Cambio Climático) | Mismo caso que F5-11 (la institución especializada, SEGOB/CENAPRED, sí publica un historial anual). |
| F5-14 % Área natural protegida | Porcentaje del territorio bajo alguna figura de protección ambiental | INECC (Atlas de Vulnerabilidad al Cambio Climático) | — |
| F5-15 PIB municipal | Producto Interno Bruto estimado del municipio | Compilado por el INECC para su Atlas de Vulnerabilidad al Cambio Climático, usando como insumo cifras que originalmente produce el INEGI | No es la cifra oficial más reciente del INEGI — es la versión que el INECC integró a su propio modelo de vulnerabilidad, sin año de referencia declarado. Cobertura del 96% de los municipios del país (Guadalajara y Zapopan, entre otros, no tienen dato — confirmado, no es un error). |
| F5-16 PIB turístico municipal | PIB del sector turístico estimado del municipio | Compilado por el INECC (mismo caso que F5-15) | Cobertura de solo 61% de los municipios del país. |
| F5-17 Rezago de vivienda | Número de viviendas con carencias de calidad y servicios básicos | Compilado por el INECC para su Atlas de Vulnerabilidad al Cambio Climático, usando como insumo cifras que originalmente produce CONAVI/SHF | Es un conteo de viviendas, no un índice — no duplica el Índice de Rezago Social (F2-3), que mide otra cosa. |

---

## Historial de cambios

| Fecha | Qué cambió |
|---|---|
| 2026-09-10 | Primera versión completa del documento, con Apéndice de los 86 indicadores. |
