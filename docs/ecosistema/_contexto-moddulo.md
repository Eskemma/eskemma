# Contexto de Moddulo para apps del ecosistema (F1 → F2 → F3 → F4)

**Propósito de este documento:** este NO es el detalle técnico de ninguna app del ecosistema (Fontana, Sefix-AI, o las que sigan) — es el contexto institucional compartido que cualquier desarrollo dentro del ecosistema Eskemma necesita para entender **por qué existe** y **cómo se activa**. Se referencia desde el prompt de arranque de cada app; no se repite su contenido en cada uno.

**Extraído y condensado de `FAT_2_v2_0.md`** (documento completo de las 9 fases de Moddulo, ~9,600 líneas). Este resumen cubre **F1 → F2 → F3 → F4**: la cadena que activa a las apps del ecosistema (F1-F3) y el destino concreto de lo que esas apps producen (F4) — porque el vínculo F3→F4 no es una formalidad de cierre de fase, es un flujo de datos específico (ver sección 1, subsección F4-Diagnóstico). F5-F9 quedan fuera deliberadamente: son diseño metodológico de fases posteriores, en su mayoría no implementado todavía en código, y no tienen un vínculo directo con lo que produce una app de investigación. Si una tarea concreta requiere entender F5 en adelante, se debe consultar `FAT_2_v2_0.md` completo en ese momento, no asumir nada de este resumen.

---

## 0. Nota de nomenclatura — léase antes que nada

En este ecosistema, "F1", "F2", "F3"... significan **dos cosas distintas según el contexto**, y son sistemas de numeración independientes que solo coinciden por casualidad en el símbolo:

- **Las 9 fases de Moddulo** (F1-Propósito, F2-Exploración, F3-Investigación … F9-Evaluación) — el ciclo completo por el que pasa cualquier proyecto político.
- **Las familias de un catálogo propio de una app** — por ejemplo, Fontana organiza sus 84 indicadores en 5 "familias" (Familia 1-Sociodemográficos … Familia 5-Características territoriales). Cada app del ecosistema puede tener su propio esquema de familias/categorías internas; ninguno de ellos es una fase de Moddulo.

**Regla de escritura:** cuando un documento diga "F1", "F2", "F3"... sin más calificación, se refiere siempre a una fase de Moddulo. Cualquier categoría interna de una app (familias, vectores, módulos propios) se nombra siempre completa ("Familia 1", "Vector Social", etc.), nunca abreviada al símbolo de la fase.

---

## 1. La cadena F1 → F2 → F3 → F4, en una frase

F1 define **qué** quiere lograr el proyecto y por qué (XPCTO). F2 hace un primer escaneo del entorno y traduce lo que no se sabe todavía en un **programa de investigación específico de ese proyecto** (el PIP). F3 no investiga por sí misma — **orquesta**: convierte cada pregunta del PIP en una tarea, decide qué la puede responder (una app del ecosistema, gestión humana, o ambas), recibe los resultados, y los sintetiza en un veredicto **y en los factores concretos del FODA Propio/de Adversarios**. F4 toma esos factores ya construidos y los procesa en un diagnóstico estratégico integral — es el destino real de lo que las apps del ecosistema producen, no un consumidor abstracto de "resultados en general".

### F1-Propósito

Establece las cinco variables XPCTO (Hito, Sujeto, Capacidades, Tiempo, Justificación) que son el ADN del proyecto. Output: el **Expediente de Propósito del Proyecto (EPP)**, que el sistema hereda íntegro hasta F9.

### F2-Exploración

Primer contacto sistemático con el entorno vía escaneo PESTEL (Político, Económico, Social, Tecnológico, Ecológico, Legal) — no es investigación profunda, es orientación. Produce la **Hipótesis Estratégica Inicial (HEI)** — la premisa que el proyecto va a poner a prueba — y, sobre todo para efectos de las apps del ecosistema, el **Programa de Investigación Profunda (PIP)**.

**El PIP es la pieza que hay que entender bien.** Para cada necesidad de información que el escaneo dejó abierta, el PIP define:
- **Qué se investiga** — la pregunta específica, propia de ese proyecto (no una pregunta genérica de catálogo).
- **Por qué es prioritaria** — su vínculo con el hito (X) y las incertidumbres críticas de ese proyecto en particular.
- **Con qué método** — cuantitativo, cualitativo, documental, digital, observacional.
- **Con qué profundidad** — nivel de detalle y representatividad requeridos.
- **En qué orden** — secuencia según dependencias y urgencia.

Todo esto sale del escaneo de **este** proyecto — no existe un PIP genérico por tipo de proyecto (electoral/gubernamental/legislativo/ciudadano). El tipo de proyecto influye en qué *dimensiones* del PESTEL reciben más peso durante el escaneo, pero el PIP resultante son preguntas concretas de ese caso, no un catálogo reutilizable.

Output completo de F2: el **Dictamen de Viabilidad Situacional (DVS)**, que incluye el PIP y la HEI, entre otros componentes.

### F3-Investigación

Recibe el DVS de F2. Su función es **traducir el PIP en tareas concretas, asignarlas a los canales disponibles, recibir sus resultados, sintetizarlos, y emitir un veredicto sobre la HEI.** F3 no genera ni un solo dato nuevo por sí misma — coordina a quien sí los genera.

El cierre de F3 tiene dos productos que viajan directamente a F4: el **veredicto sobre la HEI** (validada, ajustada o refutada por la evidencia) y el **Dictamen de Investigación Estratégica (DIE)** — documento que consolida la síntesis de hallazgos aprobados, ese veredicto, y dos instrumentos ya construidos que se explican en la sección siguiente porque son el vínculo operativo real con F4: el **FODA Propio** y el **FODA de Adversarios**.

### F4-Diagnóstico

F4 no investiga — convierte la evidencia acumulada en un diagnóstico estratégico integral mediante tres instrumentos que operan en secuencia, cada uno alimentando al siguiente: el **MVP** (Modelo de Viabilidad Política, seis vectores: Social, Territorial, Mediática, Organizacional, Financiera, Institucional), el sistema **FODA | CAME-IBEA**, y el **MEC** (Modelo de Estrategia Competitiva). Cierra con el **Juicio de Viabilidad del Cometido (JVC)**: Viable / Viable con ajustes / Viable con reformulación parcial / No viable, con trazabilidad completa a la evidencia del DIE. El output de F4 es el **DIVPP**, que habilita F5.

**El vínculo F3→F4 que importa a las apps del ecosistema — el sistema FODA | CAME-IBEA en detalle:**

El sistema FODA | CAME-IBEA de Eskemma opera en **dos momentos distintos del ciclo**, y esto es lo que hay que tener presente al construir cualquier app:

| Instrumento | Se produce en | Qué hace |
|---|---|---|
| **1 — FODA Propio** | **F3, motor M3** | Registro exhaustivo de fortalezas, oportunidades, debilidades y amenazas del proyecto, con **cada elemento respaldado por al menos un hallazgo del cuerpo de evidencia y trazabilidad a su canal de origen** |
| **2 — FODA de Adversarios** | **F3, motor M3** | Registro equivalente por cada adversario relevante identificado en el Semáforo de Veto; la profundidad depende de su nivel de riesgo |
| 3 — Matrices de Valoración | F4 | Valora cada factor de los Instrumentos 1 y 2 en dos dimensiones (importancia/amenaza para fortalezas propias; importancia/modificabilidad para debilidades propias, etc.) |
| 4 — CAME | F4 | Orientaciones sobre los factores propios ya valorados: Corregir, Afrontar, Mantener, Explotar |
| 5 — IBEA | F4 | Orientaciones sobre los factores del adversario: Igualar, Bloquear, Explotar, Alentar |

**Consecuencia directa para una app como Fontana:** cualquier indicador o dato que la app aporte a una `TareaPIP` de F3, una vez aprobado en M2, puede convertirse en un factor concreto del FODA Propio o del FODA de Adversarios que M3 construye — con trazabilidad hasta el canal, la fuente y el método de origen. Ese factor, ya en F4, se valora, se le asigna una orientación estratégica (CAME/IBEA), y termina informando el MEC. **Esto significa que la naturaleza del dato, la fuente y la trazabilidad no son un formalismo de interfaz de la app — son la cadena de evidencia que sostiene un diagnóstico estratégico real más adelante.** Un dato mal etiquetado o sin fuente clara en Fontana no se queda en Fontana: se propaga como una fortaleza o debilidad mal fundamentada en el diagnóstico de F4.

El MVP, por su parte, toma de la síntesis de hallazgos del DIE la evidencia sobre los seis vectores de legitimidad — también alimentado por lo que las apps del ecosistema entregaron a F3, aunque sin un instrumento intermedio tan explícito como el FODA.

---

## 2. M1 — el motor que activa a las apps del ecosistema

M1 ("Gestor de tareas de investigación") es el primer motor de F3, y es el punto exacto donde el trabajo de una app del ecosistema (Fontana, Sefix-AI, o cualquier otra) se conecta con Moddulo. Para cada necesidad de información del PIP heredado, M1:

1. **Identifica el canal más adecuado** según la naturaleza de la tarea y la disponibilidad de herramientas del ecosistema.
2. **Propone la asignación al usuario**, con justificación explícita de por qué ese canal es el más eficiente para *esa* tarea en particular.
3. **Detecta si existe un activo reutilizable** en el Inventario de Activos de Inteligencia (Canal 4, de proyectos previos).
4. **Alerta cuando una herramienta no está disponible** y deriva la tarea a Canal 2 (gestión humana).

**Consecuencia directa para cualquier app del ecosistema:** cuando M1 asigna Canal 1 + una técnica específica (`tecnicaId`) a una `TareaPIP`, esa asignación existe porque **esa pregunta concreta de ese proyecto** necesita lo que esa app puede responder — no porque el proyecto sea "de tipo electoral" en abstracto. Por eso cualquier noción de "indicadores mínimos" o "obligatorios" de una app **siempre es una función del PIP del proyecto activo, nunca del tipo de proyecto**. Una tabla de indicadores recomendados por tipo de proyecto resuelve un problema distinto (qué mostrar cuando *no* hay un proyecto/PIP de referencia, es decir, en uso independiente de la app) — nunca debe confundirse con los mínimos de un proyecto activo.

---

## 3. Los 4 canales de ingesta de F3

| Canal | Qué es | Cómo se activa |
|---|---|---|
| **1 — Ecosistema Eskemma** | Apps propias: Sefix, apps de Centinela, mini-apps de Recursos. Cada una activa un módulo específico de investigación según lo que el PIP necesite. | Automática, vía el contrato de datos de la app (`AppContractConfig`) — el catálogo de contratos (`APP_TO_F3_CONTRACTS`) se puebla app por app conforme cada una completa su desarrollo. |
| **2 — Campo externo (carga manual)** | El consultor sube resultados de investigación propia (encuestas, entrevistas, focus groups, documentos) realizada fuera del ecosistema. | El usuario carga el archivo con metadatos (fuente, fecha, método); no es obligatorio, complementa a los demás canales. |
| **3 — Legado de uso independiente** | El usuario ya usó una app del ecosistema *fuera* de un flujo de Moddulo (por su cuenta) y quiere vincular ese resultado a un proyecto real. | El sistema evalúa pertinencia (¿responde a alguna necesidad del PIP?), vigencia (¿la fecha es compatible con el horizonte del proyecto?) y compatibilidad metodológica antes de aceptar el vínculo. |
| **4 — IAI (Inventario de Activos de Inteligencia)** | Aprendizajes y datos reutilizables de proyectos anteriores propios. | Pertenece conceptualmente a F9-Evaluación; hoy fuera de alcance de cualquier desarrollo de app nueva. |

Todo resultado, sin importar el canal, se organiza por el módulo del PIP al que responde y requiere **aprobación humana explícita** antes de contar para la síntesis de F3 — ningún canal, ni siquiera el automático de Canal 1, se acepta a ciegas.

---

## 4. Estado real del ecosistema (para no asumir de más ni de menos)

- **T06 (Sefix-AI)** fue la primera app en iniciar desarrollo, pero su Paso 3/4 quedaron **pausados** — no es una app terminada ni un precedente arquitectónico a seguir para Canal 1.
- **Fontana (T10)** es la primera app que completa los 5 pasos de desarrollo del ecosistema, y la primera en ejercitar Canal 1 de F3 de punta a punta. Por eso `APP_TO_F3_CONTRACTS` está vacío hasta que Fontana lo puebla, y por eso el código de F3 (`F3TareasPIP.tsx`) no tiene todavía ninguna navegación real hacia una app del ecosistema — Fontana sienta ese precedente, no lo repite de otra app.
- **PESTEL** es una app ya funcional y en producción, pero vive en **F2-Exploración**, no en F3 — se usa únicamente como referencia del sistema de diseño de Centinela (colores, tipografía, patrones de layout, wizard de primer uso), **nunca** como precedente de arquitectura de Canal 1/2/3, que es un mecanismo exclusivo de F3.

---

## 5. Dónde profundizar si hace falta

- **Arquitectura de código real de F3** (tipos `TareaPIP`, `AsignacionCanal`, `ResultadoF3`, componentes React, endpoints): `F3_Investigacion_Documentacion.md`.
- **Detalle metodológico completo de las 9 fases** (incluyendo el detalle fino de F4 no cubierto aquí — Matrices de Valoración, JVC completo — y F5-F9, plantillas tácticas, KPIs, protocolos): `FAT_2_v2_0.md` — consultar solo si la tarea concreta lo requiere, no como lectura de contexto general.
- **Catálogo de las 35 técnicas de investigación del ecosistema** y su asignación por componente (Sefix/Centinela/Recursos): `MMEE_v2_0.md`.
