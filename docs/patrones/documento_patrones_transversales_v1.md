**Documento de patrones transversales del ecosistema Eskemma — v1 (borrador de trabajo)**  
**Versión:** v1 (borrador; incorpora las observaciones de Raúl del 2026-11-15 sobre la v0)  
   
 **Fecha:** 2026-11-15  
   
 **Quién lo usa:** Raúl, Claude y Code (documento interno; no es para terceros).  
   
 **Fuentes:** bitácora de hallazgos candidatos v16 (`docs/patrones/`), escaneo de solo lectura Fontana ↔ F3 y del shell de Fontana (Code, 2026-11-14), plan de apps del ecosistema (`Apps_ecosistema_Eskemma.xlsx`, 35 apps) y las decisiones de producto de Raúl.  
**0. Cómo usar este documento**  
- **Antes de todo:** leer el documento de principios rectores (sección 1.1 dice dónde debe estar); este documento no lo sustituye.  
- **Para construir una app o un componente nuevo:** leer la sección 1 (principios), la 6 (contrato de integración con las fases de Moddulo), la 7 (checklist) y los patrones de la sección 3 que apliquen a su arquetipo (Anexo A).  
- **Para cambiar algo que ya existe:** buscar el patrón en la sección 3 y la regla de propagación en la sección 4.  
- **Cada sección declara su madurez:** *sólido* (sale de código construido, probado y verificado), *propuesto* (diseño razonado, sin construir) o *por validar* (hipótesis que falta contrastar con el código o con la persona).  
- **Qué no es:** no sustituye la bitácora (que guarda la evidencia y la historia de cada hallazgo, H01 a H82). Este documento extrae la regla y dice qué hacer; la bitácora dice por qué.  
- **Cómo se mantiene:** cuando una ronda cierre un hallazgo, la regla se añade o se corrige aquí y se cita el hallazgo.  
  
---  
   
**1. Principios y reglas de producto**  
*Madurez: sólido (principios) y propuesto (reglas 1.2, que Raúl declaró el 2026-11-14 y todavía no están construidas en todos los componentes).*  
**1.1 Los nueve principios rectores**  
**Fuente oficial:** el documento de principios rectores de Eskemma.está colocado en `docs/patrones/` para que Code y Claude lo lean. La bitácora solo conserva los nombres.  
La columna «Formulación operativa» es un **resumen de trabajo** reconstruido del prompt de auditoría del 2026-10-02 y de las palabras de Raúl; **no sustituye la redacción oficial** y se corrige contra el documento colocado en docs/patrones/.  
  
|  |  |  |  
| - | - | - |  
| **#** |  **Principio** |  **Formulación operativa (resumen de trabajo)** |  
| 1 |  Transparencia |  Toda información que se presenta indica su origen, su metodología y sus limitaciones. |  
| 2 |  Trazabilidad |  La persona puede ver cómo llegó la IA a un resultado (el «Ver razonamiento»). |  
| 3 |  Colaborador estratégico |  El sistema propone y prepara; la persona decide. El lenguaje y el comportamiento lo reflejan. |  
| 4 |  Editabilidad y aprobación |  Todo entregable es editable y exige aprobación explícita de la persona, con autoría y fecha, antes de considerarse definitivo. |  
| 5 |  Resolución geográfica inteligente |  El sistema advierte cuando agrega un dato a un nivel geográfico superior al nativo (por ejemplo, cobertura incompleta). |  
| 6 |  No determinismo |  Los resultados de la IA se presentan como propuesta, no como verdad única. |  
| 7 |  Persistencia |  Lo generado, editado y aprobado se guarda con estado, autoría, historial de versiones y fecha; nada recuperable se pierde. |  
| 8 |  Oportunidad |  Se muestra la fecha de corte de los datos y se alerta cuando superan un umbral de antigüedad. |  
| 9 |  Veracidad |  El sistema no inventa datos ni afirma lo que no sabe (evita las «alucinaciones»). |  
  
   
**1.2 Reglas de producto que gobiernan todo el ecosistema**  
1. **La persona es la dueña y quien decide el proyecto; el sistema es un colaborador estratégico.** El sistema propone, prepara y actualiza lo que puede; no decide por la persona (Principios 3 y 4).  
2. **La trazabilidad no es un bloqueo.** Debe quedar constancia de lo que produjo la IA, de lo que recomendó y de lo que decidió la persona; pero esa constancia nunca impide actualizar el proyecto.  
3. **Las fases de Moddulo son iterativas, no lineales.** Una persona puede volver a una fase cerrada, actualizar su información y seguir; el proyecto avanzado no es un motivo para negarle el cambio.  
4. **Una fase cerrada puede reabrirse siempre.** Al reabrir, el sistema actualiza automáticamente lo que pueda hacerse en automático y **siempre avisa**; cuando no pueda (o no deba) hacerlo solo, **pide la decisión de la persona**. Detalle en la sección 4.  
5. **La pantalla no afirma lo que el servidor no confirmó** (familia H17, H25, H67, H75): ni un guardado, ni un informe «completo», ni un vínculo. Cuando no se sabe, se dice «no se pudo confirmar».  
6. **Todo ajuste o regeneración crea una versión, y la persona puede volver a la anterior** (Raúl, 2026-11-15). El sistema asegura la **consistencia e integridad de los contenidos y de las decisiones por versión**: al volver a una versión, vuelve con ella lo que se aprobó y decidió en ese momento (Principio 7).  
7. **Modelo general de app** (Raúl, 2026-11-15): toda app tiene, como mínimo, **pestañas** (al menos una con la vista por defecto), un **lienzo** (canvas) y un **chat** con el asistente de IA. Según la naturaleza de cada app se evalúa si se mantiene o si el diseño requiere ajuste. Detalle en la sección 5.  
  
---  
   
   
**2. Mapa del ecosistema**  
*Madurez: sólido para lo construido; propuesto para los arquetipos.*  
- **Moddulo** organiza el proyecto en 9 fases iterativas (F1 Propósito, F2 Exploración, F3 Investigación, …). Está pulido el funcionamiento de F1, de F2 y de su conexión con la app Pestel (Centinela). F3-Investigación solo tiene hoy **una app vinculada: Fontana**.  
- **Las apps** (35 en el plan, Anexo A) se alojan en **Sefix** (1), **Centinela** (14) o **Recursos** (20), y 9 se vinculan con **Academy** (cursos y talleres). Están construidas, al menos, Fontana y Pestel; el resto está por desarrollar.  
- **Arquetipos** (lectura de Claude a partir de la descripción breve y la familia metodológica del plan; Raúl la corrige cuando haga falta): permiten saber qué patrones pesan en cada app.  
  
|  |  |  |  
| - | - | - |  
| **Arquetipo** |  **Apps** |  **Patrones que más pesan** |  
| Datos y documentos con chat y lienzo |  5 |  núcleo de agente, lienzo, `stop_reason`, tope de tamaño de documento |  
| Monitoreo continuo con alertas |  5 |  tarea programada, histórico, alertas, vigencia de datos |  
| Análisis de texto y medios |  5 |  corpus de entrada, límites del modelo, citas y fuentes |  
| Instrumentos de campo y captura de respuestas |  11 |  diseño del instrumento, captura, atribución, vínculo con Academy |  
| Diagnóstico interno con formularios |  4 |  guardado honesto, aprobación, versionado |  
| Segmentación y mapeo |  5 |  entradas de otras apps, huella de origen |  
  
   
   
- **Decisión de Raúl (2026-11-14):** las apps se tratan **individualmente**; la posible fusión de varias en una se revisará más adelante (nota del plan de apps).  
- **Dato de prioridad:** las dos apps «muy alta» (**Radar** y **Vigía**) son de **monitoreo**. *(Corrección de Raúl, 2026-11-15: la v0 decía que debían apoyarse en Pestel y no en el diseño de Fontana. Es incorrecto.)* También ellas siguen el **modelo general de app** (pestañas, lienzo y chat; sección 5): las pestañas muestran la información de monitoreo por defecto; el chat permite afinar la especificidad o los objetivos de cada consulta; y el lienzo presenta, de forma profesional, los resultados que el sistema procesa. De Pestel (E8) se toma la **lógica de monitoreo** (tarea programada, histórico, alertas, vigencia del dato), no el diseño de pantalla.  
  
---  
**3. Patrones por categoría**  
*Madurez: sólido. Extraídos de la tabla de síntesis de la bitácora v16 (59 filas). Cada patrón se agrupa bajo su categoría principal; el detalle y la evidencia están en las entradas citadas (H-números).*  
**Seguridad (5)**  
  
|  |  |  |  |  
| - | - | - | - |  
| **Patrón** |  **Qué hacer al construir algo nuevo** |  **Entradas** |  **Otras categorías** |  
| Clasificar por estructura, no por texto |  401, 403, red y causa del fallo del modelo se distinguen por estado o tipo; cada clase tiene su texto y su salida; nunca se muestra ni se registra el texto del proveedor |  H40, H45 |  Integridad de datos e IA |  
| Operación como parte del patrón |  Alarma sobre la causa operativa (saldo), costo por unidad medido y margen de tiempo medido en el entorno real |  H45, H46 |  Documentación viva |  
| Verificación segura en base real |  Script que crea datos marcados, simula, respalda, limpia comprobando la marca y cuenta antes y después |  H62 |  Proceso de desarrollo |  
| Reglas de update cerradas, sin denylist |  Una regla de update es una lista cerrada o está cerrada; los campos que solo un servidor fija no se abren al cliente; una guarda estática vigila el texto; sin emulador se compara lo publicado, se valida con `--dry-run` y se hace un humo posterior |  H68 |  — |  
| Scripts de datos de prueba idempotentes |  Idempotencia por lote, simulación con el total real, adopción de lo que crea la app con reglas explícitas y autoprueba de protegidos; conteo antes y después |  H62 y H69 |  Proceso de desarrollo |  
  
   
**Integridad de datos e IA (26)**  
  
|  |  |  |  |  
| - | - | - | - |  
| **Patrón** |  **Qué hacer al construir algo nuevo** |  **Entradas** |  **Otras categorías** |  
| Nodo de aprobación con copia congelada y huella |  Si un resultado alimenta procesos posteriores: registrar `{por, en, huella}`, congelar una copia que es lo único que se consume y poner la compuerta en el servidor dentro de la transacción |  H38, H50 |  Arquitectura de datos |  
| La serialización del prompt no entra al hash |  El hash se calcula sobre el objeto guardado; se fija con una prueba de valor literal |  H46 |  — |  
| Lo aprobado es lo consumido |  Los topes de entrada se declaran, se miden y fallan de forma visible; nunca recortan en silencio |  H46 |  — |  
| Idempotencia en operaciones encadenadas |  Un reintento completa lo faltante sin reescribir lo hecho; dos escrituras de un mismo hecho van en una sola actualización |  H41 |  — |  
| No fabricar datos por defecto |  Se omite lo no certificable; los literales de ejemplo de un prompt no se guardan como datos |  H47 (y H05) |  — |  
| Reglas de precedencia en prompts verdaderas para cada origen |  Variantes por origen del dato, pruebas por anclas, resultados «sin daño visible, efecto no demostrado» se registran tal cual |  H48 |  — |  
| Procedencia declarada solo cuando es verdadera |  Todo entregable derivado de un resultado aprobado dice de cuál (fecha, ajustes humanos) con una función pura única; para datos anteriores se dice que no hay registro; la condición sale de la fuente real de cada entregable |  H51 |  Diseño visual |  
| Evaluar el cierre sobre la copia aprobada |  Los criterios de cierre y sus recomendaciones se calculan sobre el mismo dato congelado que consumen los procesos posteriores, y las recomendaciones se redactan por origen del dato; cliente no calcula huellas |  H52 |  Arquitectura de datos |  
| Cambio aguas arriba retira la aprobación con constancia |  Modificar un resultado aprobado retira la aprobación en la misma escritura y deja constancia derivada de lo guardado; el reintento no pisa la constancia |  H58 (y H03, H38) |  — |  
| Umbral de calidad con justificación humana |  El servidor exige justificación (con autor y fecha) por debajo del umbral; la señal visible se deriva del dato, no de un estado que una acción posterior limpia |  H59 |  — |  
| Los ajustes humanos viajan con lo aprobado y se atribuyen |  Lo que una persona ajusta aguas arriba llega al proceso siguiente atribuido al analista y con su justificación; el motor sabe que es un juicio humano; lo desconocido se omite, no se inventa |  H63 (y H58, H47) |  — |  
| Un vínculo guarda la huella de su origen |  El estado (igual, cambiado, versión nueva, no verificable) se deriva en el servidor al comparar; el aviso describe un estado y no se descarta; reimportar algo distinto pasa por el candado |  H64 (y H50) |  Arquitectura de datos |  
| Cada rechazo con su texto y su siguiente paso |  Cada código de rechazo tiene un texto que dice qué pasó, que nada cambió y qué control usar; un fallo de red se distingue de un rechazo y solo él ofrece reintentar; un proceso disparado por la URL no se repite tras cerrarlo |  H67 (y H17, H40) |  Diseño visual |  
| La justificación viaja con lo aprobado |  Un umbral que exige justificación deja una nota en el vínculo (solo cuando aplica; la omisión borra la anterior) y es visible donde se consume; no se emite al motor si es para la persona |  H71 (y H59) |  — |  
| Medir en solo lectura antes de construir guardas |  Se mide el dato real, se fijan denominadores y se decide qué guardar; un literal que significa «ausente» se trata como ausente; el ejemplo de un prompt contamina los datos |  H73 (y H47, H63) |  Proceso de desarrollo |  
| El formato de entrada de un prompt induce el de salida |  Si el modelo copia algo que no debe, se mueve el dato fuera de lo que debe citar antes de añadir una prohibición |  H74 |  — |  
| Lo ausente se dice como ausente |  Si el prompt exige citar, un marcador fijo («fuente no registrada») en lugar de omitir; el modelo no inventa y la persona ve la laguna |  H74 (y H73) |  — |  
| Una regla de ausencia con vigilante |  Un predicado único para mostrar y serializar y una prueba de recorrido con excepciones explícitas y probada en negativo; un nivel desconocido no se pinta como una calificación |  H73 (y H63) |  Diseño visual |  
| Un criterio informativo dice por qué |  Mide solo lo verificable, explica con conteos y su efecto sobre los datos reales se mide antes; no reescribe lo ya guardado |  H73 |  Diseño visual |  
| Un tope que corta no corta en silencio |  Se lee la razón de parada, se marca como incompleto y se avisa; un guardado no declara «completo» lo no confirmado (pendiente) |  H75 (y H17, H67) |  Diseño visual |  
| Una prueba de nombres para los textos de la interfaz |  Lo que lee el modelo y la persona cita botones que existen: lista confirmada contra el código y un negativo con un nombre inventado |  H78 (y H67) |  Diseño visual |  
| Lo que el sistema no hace no se promete como automático |  Un prompt y una bienvenida describen el flujo real (qué se carga, cuándo y dónde se ajusta); una recomendación del producto no se enseña como bloqueo |  H78 |  Diseño visual |  
| Un stream termina con una marca de fin positiva |  El servidor envía SIEMPRE una marca de fin (precedida por las marcas de corte o de no guardado) y la pantalla trata su ausencia como interrupción; no se adopta el id ni se dice «listo» sin ella |  H75 (y H17, H67) |  Diseño visual |  
| Un formato que no cabe se condensa con presupuesto por sección |  Se fija un presupuesto por sección, las secciones obligatorias (las que dan transparencia) van completas y se recorta la elástica; lo que se pierde se declara y vive en otra pantalla; no se sube el tope hasta que quepa |  H75 |  Diseño visual |  
| Toda llamada a un modelo lee la razón de parada |  O declara por qué no hace falta; el inventario de las demás llamadas se hace con la primera corrección |  H81 (y H75) |  — |  
| Un ajuste humano llega a todos los consumidores del análisis |  Incluidos los cálculos derivados (puntajes, tablas); si no, el producto se contradice |  H82 (y H63) |  — |  
  
   
**Arquitectura de datos (7)**  
  
|  |  |  |  |  
| - | - | - | - |  
| **Patrón** |  **Qué hacer al construir algo nuevo** |  **Entradas** |  **Otras categorías** |  
| Dependencia aguas arriba por huella |  Todo derivado guarda la huella de su origen; todo cierre o consumo la compara con la vigente |  H50, H46, H42 |  Ciclo de vida de recursos |  
| Estado derivado con una sola fuente |  Una función pura de derivación que se ejecuta en cada relectura; no se limpia un aviso de forma optimista |  H43, H49 |  Proceso de desarrollo |  
| Versionar la huella |  Al cambiar lo que entra a la huella, sube su versión y cada vínculo se compara con la regla con la que se guardó; no hay relleno retroactivo; un cambio de nota es un estado propio |  H71 (y H64) |  Integridad de datos e IA |  
| Un desempate determinista |  Si puede haber varios candidatos a «el vigente», regla explícita (fecha) y no el orden de la base; el invariante supuesto se mide |  H76 (y H70) |  Integridad de datos e IA |  
| Retirar una ruta con 410 y un contador mínimo |  El 410 nombra lo que sí existe (leído en el código), no lee el cuerpo y no cambia por un fallo del contador; el contador no guarda datos personales y se escribe fuera del camino de la respuesta |  H77 (y N5) |  Proceso de desarrollo |  
| Limitador por instancia con cota inferior declarada |  Un tope por instancia protege la escritura; lo que se pierde se declara (total y sinSesion son cotas, `ultimaLlamada` puede ir atrasada) y se dice qué sí está garantizado |  H77 |  Integridad de datos e IA |  
| Un parámetro de URL que elige qué se muestra es entrada no confiable |  Se valida contra lo que existe y nunca dispara una acción con costo; la regla en línea se extrae a una función pura y se fija con un oráculo fechado |  H80 |  Proceso de desarrollo |  
  
   
   
   
**Arquitectura entre apps**  
*Sin patrones propios todavía en la bitácora; la sección 6 (contrato de integración) es su contenido principal.*  
**Ciclo de vida de recursos (6)**  
  
|  |  |  |  |  
| - | - | - | - |  
| **Patrón** |  **Qué hacer al construir algo nuevo** |  **Entradas** |  **Otras categorías** |  
| Confirmación de impacto derivada del servidor |  El texto del modal se arma con lo que el servidor reporta (líneas y huella); el candado va en el servidor |  H39 (y H15) |  — |  
| Contención provisional con lo no bloqueado declarado |  Se anota qué quedó a propósito sin bloquear y con qué decisión se resolverá |  H42 (y H30) |  — |  
| Un recurso, un dueño |  Las relaciones uno a uno se escriben por ambos lados en una sola transacción y se rechazan con un código estable cuando ya están tomadas; la papelera cuenta como tomado |  H56 |  Arquitectura de datos |  
| Un estado transitorio, un solo documento |  El pendiente vive en un solo lugar y la pantalla lo deriva con una función pura; las acciones que lo cambian se rechazan con un código estable mientras exista |  H65 (y H56) |  Arquitectura de datos |  
| Aviso antes de salir, protección en el servidor |  Una consulta barata, acotada y declarada en peso avisa lo que se perdería; nunca bloquea; la protección real es el candado del servidor |  H66 (y H15) |  Diseño visual |  
| Confirmar, no bloquear, sobre lo que la persona vio |  Si lo que se importa tiene algo que decir (no aprobado, sesgos sin revisar, no vigente, confianza baja), el servidor pide confirmación con una huella opaca de lo que se vio; si lo vigente cambió mientras tanto, repite la pregunta; la misma función corre fuera y dentro de la transacción y el nivel se calcula antes de deduplicar |  H70 (y H15, H39) |  Integridad de datos e IA |  
  
   
**Proceso de desarrollo (10)**  
  
|  |  |  |  |  
| - | - | - | - |  
| **Patrón** |  **Qué hacer al construir algo nuevo** |  **Entradas** |  **Otras categorías** |  
| El nombre del parámetro dice su fuente real |  No alimentar «fase cerrada» con un modo de pantalla; tabla de pruebas que reproduce el defecto |  H49 |  — |  
| Pruebas con la forma real del dato |  Las pruebas de caracterización usan la forma tomada de documentos reales; las afirmaciones del diagnóstico son hipótesis hasta verificarlas |  H55 |  — |  
| Pruebas independientes del calendario |  Todo resultado que depende de la fecha fija el reloj |  H61 |  — |  
| Unir texto de servidor y frase fija con una función |  La puntuación se cuida en un solo lugar y una prueba que fijaba el defecto se invierte a propósito; se busca el patrón en el resto del código |  H72 |  Diseño visual |  
| Una anomalía no reproducida se registra, se caracteriza y no se «corrige» |  Se explica con la evidencia, se fija con una prueba que pasa contra el código vigente y se comprueba que no es vacua; no se construye una corrección especulativa |  Lecciones de proceso (v13) |  — |  
| Medir un cambio de prompt con el modelo real, acotado |  Tope de costo autorizado, definición estricta de defecto, detector con revisión manual, muestra declarada indicativa y ronda de ajuste cerrada |  H74 |  Integridad de datos e IA |  
| Medir un prompt antes y después con un criterio único |  Mismos escenarios, mismo criterio de defecto en ambas columnas, tope de costo, n declarada indicativa y lectura manual de lo que no estaba en la lista |  H78 (y H74) |  Integridad de datos e IA |  
| Medir en solo lectura antes de retirar un camino |  Se cuenta a quién afectaría con el denominador declarado; el retiro es un paso aparte |  H79 (y H77) |  Arquitectura de datos |  
| Un límite de la plataforma se contrasta con el tiempo medido |  Se mide la velocidad y la duración real de la generación y se compara con `maxDuration` del plan antes de fijar el tope de tokens o el diseño del formato; una prueba estática fija el valor declarado |  H75, H31 |  Arquitectura de datos |  
| Ciclo de trabajo |  Diagnóstico → plan → revisión crítica → construcción → verificación en navegador → commit; caracterización primero, prueba en negativo, límites declarados, un commit por tema |  Lecciones de proceso |  — |  
  
   
**Diseño visual (4)**  
  
|  |  |  |  |  
| - | - | - | - |  
| **Patrón** |  **Qué hacer al construir algo nuevo** |  **Entradas** |  **Otras categorías** |  
| Mostrar la diferencia, no el inicio |  Ventana alrededor de la primera discrepancia, con elipsis solo donde se cortó y el valor completo accesible; la normalización va en la comparación |  H44 |  — |  
| Indicador de proceso en cada zona posible |  Toda acción larga se ve desde cualquier zona de la pantalla; convención de color y `role` |  H49, H23 |  — |  
| Contraste medido contra el fondo real |  Ratios declarados sobre el fondo compuesto con los hex reales; convención por modo (marrón en claro, amarillo en oscuro) y token de texto aparte |  H60 (y H23) |  — |  
| Un aviso por cada forma del estado y junto a su control |  El texto tiene una variante por lo que ocurrió (agregada, cambiada, retirada), no afirma lo que no pasó, y se muestra donde está la acción que lo resuelve; lo no alcanzable desde la pantalla se declara como solo probado en unidad |  H72 (y H17, H67) |  Integridad de datos e IA |  
  
   
   
   
**Documentación viva (1)**  
  
|  |  |  |  |  
| - | - | - | - |  
| **Patrón** |  **Qué hacer al construir algo nuevo** |  **Entradas** |  **Otras categorías** |  
| Documentación con cobertura real |  Contrato estable verificado contra el código (archivo y función), separado de lo provisional; el detector de frescura se amplía a lo que la documentación describe y se prueba en negativo |  H53 |  — |  
  
   
  
---  
**4. Regla de propagación en procesos iterativos (patrón central)**  
*Madurez:* ***propuesto*** *— la regla de producto la fijó Raúl; el modelo de abajo es una propuesta por validar con el diagnóstico de Code de lo que ocurre hoy; la mitad de los mecanismos (huella, confirmación de impacto) ya existen y son sólidos.*  
**4.1 El problema**  
Las fases son iterativas. Si la persona cambia algo en una fase temprana (reentrega desde una app, un análisis nuevo, una edición) cuando el proyecto ya avanzó, lo que se derivó después (resultados aprobados, síntesis, veredicto, reportes) queda desfasado. Hoy el sistema contiene el problema de forma **provisional**: bloquea (409 `fase_cerrada`, bloqueos por Reporte F3). Esa contención **contradice** la regla 1.2.4 y está declarada como transitoria (H30, H42).  
**Una regeneración también es un ajuste** (Raúl, 2026-11-15): produce las mismas consecuencias que una edición y debe tratarse igual. Por eso rige la regla 1.2.6: toda regeneración o ajuste crea una **versión**, la persona puede **volver a la versión anterior**, y el sistema asegura la **consistencia e integridad de contenidos y decisiones por versión**.  
*Consecuencia que conviene diseñar (observación de Claude):* volver a una versión anterior es **también un cambio** y propaga como cualquier otro: lo que se derivó de la versión que se abandona hay que revisarlo (R1 o R2). Y exige que cada versión guarde **junto** su contenido, sus aprobaciones y la huella de sus insumos; sin eso no hay forma de devolver un estado coherente. Es el prerrequisito de versionado (H06, H08) y de autoría (H03).  
**4.2 Modelo propuesto**  
**Estados de una fase:** *abierta*, *cerrada* y *reabierta*. «Cerrar» crea un **punto de control** (el Reporte, con la huella de sus insumos); no es un candado. Reabrir siempre es posible y crea una **revisión nueva** sin borrar la anterior (trazabilidad sin bloqueo).  
**Tres respuestas ante un cambio aguas arriba:**  
  
|  |  |  |  |  
| - | - | - | - |  
| **Respuesta** |  **Cuándo** |  **Qué hace el sistema** |  **Ejemplo** |  
| **R1. Automática, con aviso** |  El cambio solo afecta la vigencia o la consistencia de un derivado y **no toca una decisión de la persona ni una recomendación de la IA ya entregada** |  Compara la huella del origen, marca lo derivado como «desactualizado», recalcula lo que es una función pura (tablas, puntajes) y muestra qué cambió. **Si hace falta regenerar con IA**, lo propone tras su revisión y **la persona lo autoriza** (ver 4.5.1) |  el análisis de origen cambió: el vínculo muestra «hay una versión más nueva» (H64) |  
| **R2. Propuesta y decisión de la persona** |  El cambio afecta algo que la persona aprobó, ajustó o decidió, o una recomendación de la IA |  Calcula el impacto (qué se invalida y qué se podría regenerar), lo muestra con la huella de lo que la persona vio y **espera su decisión**: mantener, regenerar, reaprobar |  reemplazar un análisis aprobado: candado H15 que confirma y no bloquea (H39, H70) |  
| **R3. Nunca** |  — |  Sobrescribir en silencio, bloquear la actualización o decidir por la persona |  la reentrega que pisa un resultado aprobado sin avisar (hallazgo de Fontana ↔ F3) |  
  
   
**Regla común a las tres:** toda llamada al modelo requiere **autorización de la persona**, con el costo visible. R1 y R2 se distinguen por si se toca algo que la persona decidió, no por si hay IA.  
**Registro:** cada propagación deja constancia: qué cambió, qué la disparó, qué decidió la persona y **en qué versión**.  
**4.3 Lo que ya existe (sólido)**  
- Dependencia aguas arriba por huella (H50) y huella de origen versionada con `verificarOrigen` (H64, H71).  
- Candado de confirmación de impacto con huella, que confirma y no bloquea (H15, H39, H70).  
- Copia congelada de lo aprobado y compuerta de motores (H38).  
- Avisos de cambio (PIP, territorio, origen) en algunos puntos (H64; `detectPipStaleness`).  
**4.4 Divergencias declaradas respecto de la regla**  
- La contención de fase cerrada (`faseCerrada.ts`, 409) y los bloqueos por Reporte F3 son **provisionales** y se retiran cuando exista el mecanismo.  
- En Fontana ↔ F3 la reentrega **sobrescribe en silencio** y **no invalida** síntesis, veredicto ni DIE; no hay huella de origen ni atribución de aprobación.  
- Se desconoce qué hace el resto de las fases (F4 a F9) ante un cambio aguas arriba: **falta el diagnóstico de propagación** (solicitado a Code, solo lectura).  
**4.5 Decisiones de Raúl (2026-11-15) y lo que sigue abierto**  
  
|  |  |  |  |  
| - | - | - | - |  
| **#** |  **Tema** |  **Decisión de Raúl** |  **Consecuencia de diseño** |  
| 1 |  Regeneración con modelo |  Una regeneración con IA es R2 por defecto (cuesta crédito y cambia contenido; el auto-regenerado que sobrescribía ediciones ya fue un hallazgo cerrado, N9). **R1 también puede requerir IA**: es una regeneración automática con aviso, pero **siempre la autoriza la persona** y **nace de la revisión que el sistema hace tras la actualización**, para confirmar que la regeneración hace falta. |  El orden es: cambio → **revisión de impacto del sistema** (sin modelo) → si procede, **propuesta de regenerar** → **autorización** de la persona → regeneración → aviso de lo que cambió. Nunca se regenera sin autorización. |  
| 2 |  Granularidad de la «revisión» |  **Completa.** Cada fase se compone de artefactos; cualquier ajuste exige revisar el impacto en **todos los artefactos de la fase**. |  Una versión por fase, con el estado de cada artefacto dentro de ella. La revisión de impacto es una función pura (barata) y se ejecuta siempre sobre la fase completa. |  
| 3 |  Edición manual de lo generado |  **Prevalece lo editado por la persona**, y el versionado queda registrado. |  Si cambia el origen, lo editado no se toca; se avisa (R2) y la versión anterior sigue disponible. |  
| 4 |  Reaprobación |  El **impacto lo valora y calcula el sistema**. Lo aprobado cambia según la **naturaleza y el tipo** del ajuste o de la regeneración; el sistema debe poder **determinar y comunicar** el impacto del ajuste propuesto o realizado. |  No hay una regla fija de «cuánto se reaprueba». Hace falta una **clasificación de tipos de cambio** y qué efecto tiene cada tipo sobre lo aprobado; se diseña con el diagnóstico de propagación de Code. |  
| 5 |  Dependencias entre apps |  Si el sistema determina el **impacto total**, basta **un aviso por dependencia**; si conviene más control y aseguramiento de la lógica de cada app, **una cadena de avisos**. |  *Propuesta de criterio (Claude, por validar):* **aviso consolidado por defecto**; **cadena solo cuando una app intermedia tenga decisiones propias de la persona** (R2) que deban resolverse antes de seguir propagando. |  
  
   
**Abierto (por decidir):**  
- **4.5.a Autorización de regeneración.** ¿Se autoriza cada vez, o se puede dar una autorización permanente por proyecto para ciertos tipos de regeneración (R1)? La decisión 1 dice «siempre autorizada»; falta confirmar que no admite una autorización permanente.  
- **4.5.b Clasificación de tipos de cambio** (decisión 4): qué tipos existen y qué efecto tiene cada uno sobre lo aprobado. Depende del diagnóstico de Code.  
- **4.5.c Cuánto historial se conserva** al volver atrás varias veces (tope de versiones por fase, con la restricción de tamaño de documento de H13).  
  
---  
**5. Estructura de una app (app shell)**  
*Madurez: sólido para lo construido en Fontana; el* ***modelo general*** *(pestañas, lienzo, chat) es* ***decisión de Raúl*** *del 2026-11-15;* ***por validar*** *la reutilización técnica (no se ha probado en una segunda app). Fuente: escaneo de Code del 2026-11-14.*  
**5.1 Lo que tiene Fontana**  
Máquina de estados de la página (cargando, hub, wizard, sesión, errores) → encabezado y botones de destino → espacio de trabajo con **pestañas** (Lienzo, Indicadores, Reporte) → panel responsivo → **chat conversacional** (panel, burbuja, markdown) con asistente dedicado → **lienzo (canvas)** donde se muestran resultados, gráficas, documentos y respuestas del chat. Hooks: flujo de streaming del chat y dictado por voz. 29 rutas bajo `app/api/fontana/`; las herramientas del agente consumen esas mismas rutas.  
**5.2 Genérico y particular**  
  
|  |  |  
| - | - |  
| **Pieza** |  **Veredicto** |  
| Pestañas, panel responsivo, exportar a imagen, vista de metodología, markdown, dictado por voz, errores de carga, sesión pendiente |  genérico tal cual |  
| Panel y burbuja de chat |  casi genérico (acoplados al tipo de mensaje y a textos fijos) |  
| Flujo de streaming en el cliente |  mixto (endpoint y callbacks fijos) |  
| Bucle de agente con herramientas, streaming SSE, guardado del turno y estado «interrumpido» |  genérico, hoy entrelazado con 7 guards de dominio |  
| Herramientas, prompt del sistema, constructor de tarjetas, guards con expresiones regulares, niveles comparados, modales territoriales, notas del catálogo |  particular de Fontana (no extraer) |  
  
   
**5.3 Parámetros que una app nueva tendría que poder definir**  
- **Interfaz:** nombre, título, subtítulo, gradiente y textos; lista de pestañas (**al menos una con la vista por defecto**, y se evalúa app por app si necesita otra) y mapa pestaña → vista; registro de eventos SSE → manejadores.  
- **Servidor:** modelo, `max_tokens`, razonamiento, máximo de iteraciones, prompt del sistema (en función del contexto), herramientas y su ejecutor, carga de sesión y guards (detecta + aviso).  
- **Lienzo:** unión de tipos de elemento, constructores, deduplicación y alta de elementos.  
- **Adjuntos:** límites y extractor.  
**5.4 Duplicación detectada (candidata a unificar)**  
Hay **3 lectores de SSE**, **3 renderizadores de markdown** y **3 dialectos de eventos** (Fontana, chat de Moddulo y panel de asesor). El chat de Moddulo carece de buffer de línea y de manejo de fallo a mitad de respuesta (hipótesis de lectura por contrastar). Candidatos: `leerSSE(res, onEvento)` con buffer; eventos comunes `text`, `done` y `error` con mapa de manejadores; un mensaje de chat genérico (con razonamiento opcional, ids de lienzo e indicador de interrumpido); un núcleo de servidor `ejecutarTurnoAgente`; y alinear la persistencia de Moddulo con H12. No unificar los guards de dominio ni la verificación del formulario con datos extraídos.  
**5.5 Modelo general y ajuste por app**  
**Modelo general (decisión de Raúl, 2026-11-15).** Todas las apps, como mínimo, tienen:  
1. **Pestañas:** al menos una que muestra la **vista por defecto**; en su momento se evalúa si la app requiere otra por defecto.  
2. **Lienzo (canvas):** muestra documentos o resultados derivados de las consultas de la persona, presentados de forma profesional.  
3. **Chat conversacional:** donde la persona interactúa con el asistente de IA y afina lo que quiere consultar.  
Dependiendo de la naturaleza de cada app se evalúa si el diseño se mantiene o requiere ajuste. Esto **sustituye** la lectura de la v0, que daba a monitoreo y captura un asistente solo lateral.  
**Qué cambia entre arquetipos** *(propuesta de Claude, por evaluar app por app; no es decisión)*: lo que cambia no es el modelo sino **qué muestra la pestaña por defecto** y **qué produce el lienzo**.  
  
|  |  |  |  |  
| - | - | - | - |  
| **Arquetipo** |  **Pestaña(s) por defecto     (qué muestran)** |  **Lienzo** |  **Qué hay que evaluar** |  
| Datos y documentos con chat y lienzo |  los datos o documentos de la sesión, indicadores, reporte (como Fontana) |  resultados, gráficas, documentos |  nada: es el diseño de origen |  
| Monitoreo continuo con alertas |  la información de monitoreo por defecto (tablero, alertas, histórico) |  resultados procesados por el sistema |  cómo el chat afina objetivos y frecuencia de cada consulta; lógica de E8 detrás |  
| Análisis de texto y medios |  el corpus y sus indicadores |  análisis y citas |  tope y tamaño del corpus |  
| Instrumentos de campo y captura |  el instrumento y las respuestas capturadas |  resultados procesados de la captura |  dónde vive la captura (¿una pestaña?) y qué hace el chat con ella |  
| Diagnóstico interno con formularios |  los formularios y su avance |  diagnóstico y reporte |  cómo conviven el formulario y el chat |  
| Segmentación y mapeo |  las entradas de otras apps y los segmentos |  mapas y segmentos |  huella de origen de lo que recibe |  
  
   
   
La duplicación de la sección 5.4 se resuelve **antes** de la segunda app, porque ahora la segunda app y todas las demás usan este modelo.  
**5.6 Condición para reutilizar**  
Separar lo genérico de lo particular **dirigido por este documento** y justo antes de la primera app nueva que lo use; no de forma especulativa. Antes, actualizar `agente-conversacional.md`, que está desfasado (no recoge H12, los 7 guards, el reporte asíncrono ni la deduplicación y el borrado suave del lienzo).  
  
---  
**6. Contrato de integración app ↔ fase de Moddulo**  
*Madurez:* ***propuesto*** *(borrador de Code a partir de PESTEL ↔ F2 y Fontana ↔ F3, ordenado y ajustado por Claude). El caso PESTEL ↔ F2 es sólido; el de Fontana ↔ F3 es el adoptante piloto que lo pondrá a prueba.*  
Qué debe cumplir **cualquier app** que entregue resultados a una fase:  
**C1. Identidad y vínculo**  
1. El contrato se declara en **un solo lugar** (técnica, fase, módulos, mecanismo y esquema del payload; hoy `APP_TO_F3_CONTRACTS`, con solo T10 poblado).  
2. **Ids estables de origen y de destino** guardados en el resultado (por ejemplo `sesionId` y `pipItemId`), no solo un marcador unidireccional.  
3. **Vínculo único y transaccional**; entrega, marcador y tablero en una sola transacción.  
**C2. Integridad y versión**  
   
 4. **Huella versionada** del contenido que la fase consume, con regla explícita de «qué cuenta» y número de versión.  
   
 5. `verificarOrigen` con estados que distinguen «cambió» de «no verificable»; nunca «cambió» sin base.  
   
 6. **Copia congelada** de lo aprobado. Una reentrega crea una **versión nueva** (la anterior se conserva y la persona puede **volver a ella**, regla 1.2.6) y **nunca sobrescribe en silencio**; cada versión guarda junto su contenido, sus aprobaciones y la huella de sus insumos.  
**C3. Decisión humana**  
   
 7. **Atribución** (quién y cuándo) al entregar y al aprobar.  
   
 8. **Nota de aprobación** cuando el origen no cumple el umbral; va como hermana del payload y fuera de los prompts.  
   
 9. Los **ajustes humanos viajan** con el payload y se detecta «ajustes que la fase aún no refleja».  
   
 10. Declarar **qué entra a los prompts de los motores** y qué es solo para revisión humana.  
**C4. Propagación (regla de la sección 4)**  
   
 11. **Gate de origen que confirma y no bloquea:** razones más una huella opaca, validada dentro de la transacción.  
   
 12. **Candado de confirmación de impacto (H15)** para reemplazos y reentregas, atado a la huella del impacto (tareas, resultados, síntesis, veredicto, DIE), antes y dentro de la transacción.  
   
 13. **Compuerta de motores:** solo lo aprobado y vigente; releer dentro de la transacción y comparar huella.  
   
 14. **Staleness por dependencia** (PIP, territorio, origen) con banner y revisión manual, sin falsos positivos.  
   
 15. El impacto de **reemplazar el análisis padre** incluye los resultados de la app (aprobados o no) y las sesiones colgadas.  
   
 16. **Fase cerrada: no bloquea; reabre.** *(Ajuste de Claude: el borrador de Code proponía «mismo 409 en entrega, aprobación y vinculación», que contradice la regla 1.2.4. La contención de 409 queda como provisional, sección 4.4.)*  
**C5. Operación**  
   
 17. **Códigos de respuesta homogéneos** (400, 401, 403, 404, 409, 422) con `error` estable; el 409 de confirmación lleva la huella.  
   
 18. **Pruebas de atomicidad** por cada escritura múltiple.  
   
 19. Política de **artefactos huérfanos** en Storage y de los enlaces ligados a una versión (por ejemplo `reporteInterpretativoUrl`).  
**6.1 Dónde está cada caso hoy**  
  
|  |  |  |  
| - | - | - |  
| **Capacidad** |  **PESTEL ↔ F2** |  **Fontana ↔ F3** |  
| Vínculo único transaccional |  sí |  parcial (`vincular-moddulo` sí; `entregar` y `canal3/vincular` no) |  
| Huella de origen versionada y `verificarOrigen` |  sí |  no |  
| Gate de origen que confirma con huella |  sí |  no (422 con booleanos en Canal 3) |  
| Nota de aprobación |  sí |  no |  
| Ajustes del analista que viajan |  sí |  parcial (implícito en el `.md` y el `.json`) |  
| Candado H15 con huella |  sí |  no en `entregar`; `tareas/generar` con `confirmar` booleano |  
| Copia congelada de lo aprobado |  sí |  parcial (la reentrega sobrescribe) |  
| Compuerta de motores |  sí |  parcial (filtra aprobado; no compara huella) |  
| Atribución (uid y fecha) |  sí |  no |  
| Fase cerrada |  bloquea (provisional) |  bloquea solo los generadores |  
| Staleness de territorio y PIP |  sí |  territorio parcial (solo Canal 3); PIP sí |  
  
   
  
---  
**7. Checklist para una app nueva**  
*Madurez: propuesto (sale de los patrones de la sección 3 y del contrato). Responder sí o no a cada punto antes de dar la app por terminada.*  
**Datos y guardado**  
- ¿Toda escritura confirma el resultado antes de afirmarlo en pantalla («No se pudo CONFIRMAR» si falla)? (H17, H25)  
- ¿Las escrituras múltiples son transacciones y validan antes de escribir? (H35, H65)  
- ¿Cada recurso tiene un dueño y un vínculo único? (H56)  
- ¿Hay tope de tamaño para el estado que crece dentro de un documento? (H13; N10 de Fontana)  
- ¿Los campos que solo un servidor debe fijar están cerrados al cliente (reglas con lista cerrada) y hay guarda estática? (H68)  
**IA**  
- ¿Se lee la razón de parada (`stop_reason`) y se marca como incompleto lo cortado? ¿El stream termina con marca de fin positiva? (H75, H81)  
- ¿`maxDuration` y el tope de tokens se contrastaron con el tiempo medido? (H31, H75)  
- ¿Lo ausente se dice como ausente y nada se fabrica? ¿Las citas conservan la fuente tal cual? (H47, H73, H74)  
- ¿El error del proveedor nunca llega al navegador y el 500 trae un `codigo`? (H45)  
- ¿Se mide un cambio de prompt con el modelo real, con tope de costo y criterio de defecto único? (H74, H78)  
**Decisión humana y propagación**  
- ¿Un resultado que alimenta procesos posteriores tiene aprobación con copia congelada, huella y atribución? (H38, H03)  
- ¿Los ajustes humanos viajan a todos los consumidores, incluidos los cálculos derivados? (H63, H82)  
- ¿Un cambio aguas arriba se trata con R1, R2 o R3 de la sección 4, sin bloquear ni sobrescribir en silencio?  
- ¿Una confirmación de impacto muestra lo que realmente se perdería y valida la huella en el servidor? (H15, H39)  
**Pantalla**  
- ¿La pantalla no afirma nada que el servidor no haya confirmado, y el estado que importa (por ejemplo el formato abierto) sobrevive a F5 por la URL, validado contra lo que existe? (H80)  
- ¿Los textos citan botones que existen (prueba de nombres)? (H78)  
- ¿Contraste AA en claro y oscuro? (H23, H60)  
**Proceso y documentación**  
- ¿Caracterización primero, con tres conteos reconciliados (fallan ejecutándose, fallan por módulo nuevo, pasan en ambos)?  
- ¿Documentación viva actualizada (`CLAUDE.md`, spec) en el mismo corte?  
- ¿Límites declarados en el mensaje de commit y en el documento?  
**Por arquetipo (además de lo anterior)**  
- *Datos y documentos con chat y lienzo:* núcleo de agente con persistencia de turno (H12), «ver razonamiento» decidido (H01), tope de lienzo.  
- *Monitoreo continuo:* tarea programada con frecuencia declarada, histórico, alertas con umbral y vigencia del dato (H04); contador o registro de ejecuciones.  
- *Análisis de texto y medios:* límites del corpus y de truncado visibles para la persona, citas con fuente y fecha.  
- *Instrumentos de campo:* diseño del instrumento versionado, captura con atribución, vínculo con Academy declarado.  
- *Diagnóstico con formularios:* guardado explícito, aprobación y versionado.  
- *Segmentación y mapeo:* entradas con huella de origen y aviso si cambian.  
  
---  
   
**8. Brechas conocidas y pendientes**  
*Madurez: sólido (viene del escaneo de Code y de la bitácora). Las hipótesis se marcan como tales.*  
**8.1 Fontana frente a los patrones**  
  
|  |  |  |  
| - | - | - |  
| **Patrón** |  **Estado en Fontana** |  **Qué falta** |  
| Guardado honesto (H25) |  parcial |  vincular sesión, PATCH de indicadores (muestra `err.message` crudo), crear sesión, botón de entrega a F3, generar reporte |  
| `stop_reason` (H75, H81) |  no |  el reporte no la lee y cae a un esqueleto sin marca; el chat la usa solo para control |  
| Marca de fin positiva |  parcial |  el cliente no trata un stream sin `done` como interrumpido |  
| Huella / dependencia aguas arriba (H50, H64, H71) |  no |  ninguna huella |  
| Confirmación de impacto (H15, H39, H70) |  no |  `window.confirm` solo en el cliente; la reentrega no avisa |  
| Transacciones (H35) |  parcial |  `entregar`, `canal3/vincular`, `tareas/aprobar`, PATCH del reporte, borrado de tarjeta |  
| Tope de tamaño de documento (H13) |  no |  `canvasItems` embebidos sin tope; adjuntos truncados en silencio |  
| Autoría y fecha (H03) |  no |  `aprobadoPor` y `aprobadoEn` |  
| Formato abierto sobrevive a F5 (H80) |  no |  la pestaña y la familia no están en la URL |  
| No fabricar, lenguaje determinista, grounding de cifras |  sí / parcial |  cotejo de cifras en prosa y en el chat |  
  
   
**8.2 Hallazgos nuevos del escaneo (se registran en la bitácora v17)**  
17 hallazgos (N1 a N17). Los de mayor peso: **N2** (la reentrega de `entregar` pasaría `undefined` a un `update` y fallaría con 500 *después* de pisar el resultado; hipótesis por verificar), **N1, N5 y N14** (variantes de H75: respuesta cortada guardada como completa, reporte que puede ser solo el esqueleto, stream cortado sin `done`), **N4** (bienvenida si falla la carga del historial, variante de H21), **N10** (sin tope de tamaño del lienzo) y **N16** (una tarjeta borrada responde «ya la tenías»; hipótesis).  
**8.3 Pendientes de diseño y de producto**  
- **Reapertura y propagación** (Bloques 3 y 4): la regla está fijada (secciones 1.2 y 4); falta el diagnóstico de lo que ocurre hoy (Code, solo lectura) y cerrar lo abierto de 4.5 (4.5.a a 4.5.c). No se construyen antes de adoptar el contrato en Fontana ↔ F3.  
- **Revisión contra los nueve principios** (Grupo 2): determinar qué rondas son prerrequisito. Lectura inicial: versionado (H06, H08) y autoría de aprobación (H03), porque la reapertura y el **volver a una versión anterior** las necesitan.  
- **Documento de principios rectores:** colocarlo en `docs/patrones/` o indicar su ruta, y corregir la columna «Formulación operativa» de la sección 1.1 contra su redacción oficial.  
- **Modelo general de app:** evaluar app por app qué muestra la pestaña por defecto y si el diseño requiere ajuste (sección 5.5).  
- **Fusión de apps:** postergada por decisión de Raúl.  
- **Documento de diseño y layout:** nota de Raúl cortada; falta definir su alcance.  
  
---  
**Anexo A. Las 35 apps por arquetipo**  
*Fuente: `Apps_ecosistema_Eskemma.xlsx`. La columna «Arquetipo» es lectura de Claude.*  
  
|  |  |  |  |  |  |  |  |  
| - | - | - | - | - | - | - | - |  
| **Clave** |  **Nombre** |  **App (técnica)** |  **Ubicación** |  **Prioridad** |  **Familia** |  **Arquetipo** |  **Nota** |  
| T06 |  Sefix-AI |  Investigación del electorado |  Sefix |  Alta |  Documental |  Datos y documentos con chat y lienzo |    |  
| T10 |  Fontana |  Análisis de datos abiertos |  Centinela |  Alta |  Documental |  Datos y documentos con chat y lienzo |    |  
| T29 |  Acervo |  Inventario de recursos internos |  Recursos |  Alta |  Mixta |  Diagnóstico interno con formularios |    |  
| T21 |  Persona |  Análisis interno del sujeto P |  Recursos |  Alta |  Mixta |  Diagnóstico interno con formularios |    |  
| T18 |  Nexus |  Mapeo de actores y grupos de interés  (poder real) |  Centinela |  Alta |  Mixta |  Segmentación y mapeo |    |  
| T34 |  Radar |  Monitoreo de medios |  Centinela |  Muy alta |  Cuantitativa |  Monitoreo continuo con alertas |    |  
| T35 |  Vigía |  Seguimiento de autoridades |  Centinela |  Muy alta |  Mixta |  Monitoreo continuo con alertas |    |  
| T03 |  Netvox |  Encuesta en línea / CAWI |  Recursos |  Alta |  Cuantitativa |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
| T26 |  Lexis |  Análisis documental por tipo de proyecto |  Recursos |  Alta |  Documental |  Datos y documentos con chat y lienzo |    |  
| T12 |  Verba |  Entrevista en profundidad |  Recursos |  Alta |  Cualitativa |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
| T11 |  Focus |  Grupo focal |  Recursos |  Alta |  Cualitativa |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
| T22 |  Pestel |  Análisis PESTEL profundo |  Centinela |  Alta |  Documental |  Monitoreo continuo con alertas |    |  
| T27 |  Fiscus |  Evaluación de viabilidad financiera |  Recursos |  Alta |  Mixta |  Diagnóstico interno con formularios |    |  
| T07 |  Pulso |  Monitoreo de métricas digitales |  Centinela |  Alta |  Cuantitativa |  Monitoreo continuo con alertas |    |  
| T17 |  Sentio |  Análisis de sentimiento en redes |  Centinela |  Alta |  Cualitativa |  Monitoreo continuo con alertas |    |  
| T30 |  Panorama |  Investigación de medios |  Recursos |  Media |  Mixta |  Datos y documentos con chat y lienzo |    |  
| T32 |  Prisma |  Análisis de necesidades por segmentos |  Centinela |  Media |  Mixta |  Segmentación y mapeo |    |  
| T31 |  Mosaico |  Psicografía y segmentación estratégica |  Recursos |  Media |  Mixta |  Segmentación y mapeo |  Recuperar nota de segmentación sociodemográfica y arquetipos de material 05 de Sefix-Ai |  
| T33 |  Diana |  Microsegmentación |  Recursos |  Media |  Mixta |  Segmentación y mapeo |    |  
| T24 |  Red |  Mapeo de alianzas y multiplicadores |  Centinela |  Media |  Mixta |  Segmentación y mapeo |    |  
| T19 |  Cuadrante |  FODA participativo |  Recursos |  Media |  Mixta |  Diagnóstico interno con formularios |    |  
| T23 |  Prensa |  Revisión hemerográfica |  Centinela |  Media |  Documental |  Análisis de texto y medios |    |  
| T08 |  Marco |  Encuadre mediático |  Centinela |  Media |  Mixta |  Análisis de texto y medios |    |  
| T16 |  Trama |  Análisis de narrativas mediáticas |  Centinela |  Media |  Mixta |  Análisis de texto y medios |    |  
| T01 |  Contacto |  Encuesta cara a cara |  Recursos |  Media |  Cuantitativa |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
| T02 |  Fonos |  Encuesta telefónica / CATI |  Recursos |  Media |  Cuantitativa |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
| T15 |  Glosa |  Análisis de discurso político |  Centinela |  Media |  Mixta |  Análisis de texto y medios |    |  
| T20 |  Termómetro |  Análisis de agenda setting |  Centinela |  Media |  Mixta |  Análisis de texto y medios |    |  
| T13 |  Convergencia |  Delphi simplificado |  Recursos |  Media |  Cualitativa |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
| T25 |  Referencias |  Benchmarking |  Recursos |  Media |  Mixta |  Datos y documentos con chat y lienzo |    |  
| T05 |  Bitácora |  Panel de seguimiento transversal |  Recursos |  Media |  Cuantitativa |  Instrumentos de campo y captura de respuestas |    |  
| T09 |  Memoria |  Registro y conteo de eventos |  Recursos |  Baja |  Cuantitativa |  Instrumentos de campo y captura de respuestas |    |  
| T04 |  Votum |  Sondeo rápido de salida (Exit Poll) |  Recursos |  Baja |  Cuantitativa |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
| T14 |  Specto |  Observación participante |  Recursos |  Baja |  Cualitativa |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
| T28 |  Impulso |  Investigación acción participativa (IAP) |  Recursos |  Baja |  Mixta |  Instrumentos de campo y captura de respuestas |  Vinculado con Academy |  
  
   
Resumen: 35 apps; Sefix 1, Centinela 14, Recursos 20; prioridad «muy alta» 2, «alta» 13, «media» 16, «baja» 4; 9 con la nota «Vinculado con Academy».  
  
---  
**Anexo B. Cómo trabajamos (ciclo de desarrollo)**  
*Madurez: sólido (es el método que cerró H75, H80 y la serie de T1 a T8).*  
1. **Diagnóstico de solo lectura** (Code) → **plan** → **revisión crítica** (Claude lee el plan o el parche completo) → **construcción** (Code, sin commitear) → **verificación en navegador** (Raúl, con guía paso a paso y comandos completos) → **commit** (Raúl) → siguiente corte, con el árbol limpio.  
2. **Un commit por tema.** El corte siguiente se construye cuando el anterior ya está commiteado.  
3. **Caracterización primero** y tres conteos reconciliados con aritmética: fallan ejecutándose, fallan por módulo nuevo, pasan en ambos.  
4. **Las afirmaciones de cada parte se contrastan con el código**, también las de Claude; las hipótesis de lectura se marcan como tales hasta ejecutarlas.  
5. **Mediciones con el modelo real:** autorizadas, con tope de costo, definición única de defecto en ambas columnas, muestra declarada indicativa y lectura manual de la salida.  
6. **Límites declarados** en el mensaje de commit y en la documentación viva.  
7. **Planes gratuitos:** Vercel Hobby con Fluid compute (300 s por función); ningún servicio nuevo de pago en desarrollo.  
8. **Solo Raúl escribe en el repositorio y en `docs/patrones/`; Code nunca commitea.**  
  
---  
**Anexo C. Historial de este documento**  
- **v1 (2026-11-15):** incorpora las observaciones de Raúl: definición operativa de los nueve principios (1.1, con la redacción oficial pendiente); reglas 1.2.6 (versiones y volver atrás) y 1.2.7 (modelo general de app); corrección sobre Radar y Vigía (sección 2); sección 5.5 reescrita como modelo general; regeneración como ajuste (4.1); decisiones de Raúl a las cinco preguntas (4.5) y nuevas abiertas; cláusula 6 del contrato con versión y vuelta atrás.  
- **v0 (2026-11-14):** primer borrador a partir de la bitácora v16, del escaneo de Fontana ↔ F3 y del plan de 35 apps; la regla de propagación (sección 4) y el contrato (sección 6) quedan como propuestas por validar.  
