# Bitácora de hallazgos candidatos — Documento de Patrones Reutilizables

**Versión:** 2
**Última actualización:** 2026-10-03
**Propósito:** Registrar, a medida que avanzamos en la nivelación del sistema contra los 9 Principios Rectores de Eskemma (Grupos 1, 2 y 3), los hallazgos que podrían convertirse en patrones reutilizables, principios reforzados, o advertencias de diseño para el documento final. Esta bitácora se actualiza al cierre de cada ronda y se versiona (v1, v2, v3...) hasta que se retome la redacción del documento de patrones reutilizables, momento en el que su contenido se integra y esta bitácora se da por cerrada.

**Cómo leer cada entrada:**
- **Hallazgo:** qué se encontró, en una frase.
- **Principio(s) o categoría relacionada:** a cuál de los 9 principios rectores, o a cuál categoría técnica del borrador de patrones (Seguridad, Integridad de datos e IA, Arquitectura de datos, Arquitectura entre apps, Ciclo de vida de recursos, Proceso de desarrollo, Diseño visual, Documentación viva), se conecta.
- **Estado:** Corregido en esta ronda / Pendiente (Grupo 2) / Pendiente (Grupo 3) / Pendiente (decisión de producto) / Documentado solamente.
- **¿Patrón o caso aislado?:** si ya se ha visto más de una vez en el sistema (patrón candidato a documentar como regla general) o si es un caso único hasta ahora.
- **Nota para el documento final:** qué regla o principio de diseño se desprende de este hallazgo, en caso de que aplique.

---

## Decisión de criterio registrada — Aprobación implícita vs. explícita (2026-10-03)

Antes de retomar el Grupo 3, Raúl precisó un criterio que reencuadra varios hallazgos de esta bitácora (en particular H02 y H03) y que debe quedar registrado como regla de fondo para el documento final, no solo como nota de una entrada:

**El principio de "Colaborador estratégico" y el de "No determinismo" no exigen que todo resultado generado por el sistema requiera una acción explícita de aprobación del usuario.** Exigen que el sistema nunca trate como definitivo un resultado que el usuario no ha hecho propio — pero "hacerlo propio" puede ocurrir de dos formas distintas, y el sistema debe distinguir cuál aplica en cada caso:

1. **Aprobación implícita** — para resultados de bajo riesgo ("hoja" del árbol de decisiones del sistema, sin efecto vinculante sobre procesos posteriores). El sistema genera una primera versión, el usuario puede editarla o dejarla igual, y si continúa el flujo sin objetarla, eso YA cuenta como su aprobación. No requiere un botón de confirmación explícito ni un lenguaje de interfaz artificialmente tentativo ("Proponer" en vez de "Generar"). Ejemplo dado por Raúl: un primer borrador de análisis FODA.

2. **Aprobación explícita** — para resultados "nodo", que condicionan decisiones o procesos vinculados más adelante en la cadena lógica del sistema (ej. la aprobación M2 de F3 en Moddulo, que ya condiciona la síntesis posterior). Ahí sí se necesita una acción de confirmación clara, registrada con autoría y fecha (conecta directo con H03).

**El criterio para decidir cuál aplica en cada caso no se inventa ad hoc** — debe salir, en primera instancia, de los documentos rectores ya existentes del sistema (FAT 2 v2.0, FODA, MEC, MVP, RAE, y los demás documentos de especificación por fase), que ya definen cuáles son los puntos de control estratégico dentro de cada flujo.

**Matiz importante, planteado explícitamente por Raúl:** este criterio es iterativo y no se limita a lo que los documentos guía ya contemplan. Si la investigación revela un nodo de decisión real (un punto donde el resultado condiciona procesos posteriores) que los documentos guía no identificaron como tal, ese hallazgo debe señalarse igualmente — no se descarta solo porque el documento de referencia no lo mencionó. El mecanismo de aprobación (explícita o implícita) debe poder ajustarse conforme el desarrollo del sistema avanza, no quedar fijado de una sola vez.

**Consecuencia práctica para el Grupo 3:** la revisión de lenguaje determinista ya no es solo una pasada de redacción de botones y prompts. Es, en primer lugar, un ejercicio de **clasificación**: identificar los verdaderos nodos de decisión de cada fase de Moddulo (y de PESTEL/Fontana donde aplique) contra los documentos guía, y solo después decidir, caso por caso, si cada resultado necesita botón de aprobación explícita + campo de autoría, lenguaje de interfaz más cauto, ambos, o ninguno de los dos por ser de aprobación implícita.

---

## Origen: Auditoría de los 9 Principios Rectores (2026-10-02)

### H01 — "Ver razonamiento" no se propagó fuera de 3 chats de Moddulo

- **Hallazgo:** La funcionalidad de trazabilidad ("Ver razonamiento") existe y funciona en los chats de F1, F2 y F3 de Moddulo, pero no existe en ningún otro punto del sistema: ni en el resto de fases de Moddulo (AdvisorPanel, motores de F2, tablero de F3, F4-F9), ni en Fontana (que ya guarda la traza completa de `toolCalls` pero la descarta sin mostrarla), ni en PESTEL, ni en Sefix.
- **Principio(s):** Principio 2 (Trazabilidad).
- **Estado:** Pendiente (Grupo 2 — ronda de diseño propia).
- **¿Patrón o caso aislado?:** Patrón — es el caso fundador que motivó esta bitácora: una capacidad construida en un solo lugar nunca se propagó a sus "caminos hermanos".
- **Nota para el documento final:** Cuando se construya una funcionalidad de transparencia/trazabilidad para un componente, verificar explícitamente si aplica a los componentes equivalentes del resto del ecosistema antes de darla por completa. Fontana es un caso especial: ya tiene el dato (`toolCalls`) solo falta exponerlo — bajo costo de activación.

### H02 — Lenguaje determinista contradice el principio de "Colaborador estratégico"

- **Hallazgo:** Botones y prompts en las 3 apps con IA (Moddulo, Fontana, PESTEL) usan verbos deterministas ("Generar Reporte", "Ejecutar análisis IA", "Generar veredicto") en vez de lenguaje de propuesta. El propio prompt base de Moddulo se contradice a sí mismo (pide "no ser un ejecutor" y, líneas después, pide un tono de "diagnóstico frío y objetivo").
- **Principio(s):** Principio 3 (Colaborador estratégico) y Principio 6 (No determinismo).
- **Estado:** Pendiente (Grupo 3 — EN CURSO). **Reencuadrado** por la decisión de criterio del 2026-10-03 (ver sección arriba): no todo caso de esta lista requiere cambio de lenguaje — solo aquellos que, tras la clasificación contra los documentos guía, resulten ser nodos de decisión real.
- **¿Patrón o caso aislado?:** Patrón — se repite en las 3 apps con IA, con distinta intensidad (Moddulo ~17 casos, PESTEL ~10, Fontana ~3).
- **Nota para el documento final:** Checklist de redacción para cualquier texto de interfaz o instrucción de prompt nuevo: ¿el resultado que produce este botón es un nodo de decisión (requiere lenguaje cauto + aprobación explícita) o un resultado de bajo riesgo (aprobación implícita, lenguaje normal es aceptable)? La respuesta sale de los documentos guía (FAT 2, FODA, MEC, MVP) en primera instancia, y se ajusta cuando la investigación revela un nodo real no contemplado en ellos.

### H03 — No existe un campo real de "aprobado por el usuario, con autoría y fecha"

- **Hallazgo:** El campo `aprobado_por_usuario` que describe el principio de Editabilidad no existe en ningún tipo de dato del sistema. Lo que existe son variantes sueltas (`VeredictoHEI.aprobadoPorUsuario`, `ResultadoF3.aprobado`, `approvedBy`/`approvedAt` de PESTEL solo en una ruta) sin un patrón común, y ninguna descarga de documento exige que algo esté realmente aprobado antes de entregarse.
- **Principio(s):** Principio 4 (Editabilidad universal).
- **Estado:** Pendiente (Grupo 2 — ronda de diseño propia, "define el tipo común, qué se exige y dónde se firma"). **Nota:** este campo solo debe exigirse en los casos clasificados como "aprobación explícita" bajo el criterio del 2026-10-03 — no en todo resultado generado por el sistema.
- **¿Patrón o caso aislado?:** Patrón — se repite en Moddulo, PESTEL y Fontana, cada uno con su propia variante parcial.
- **Nota para el documento final:** Un tipo de dato compartido para "aprobación" (quién, cuándo, con qué firma) debería vivir en un lugar común (posible candidato: `lib/` compartido), no reinventarse por app. Cualquier mecanismo de exportación/descarga debería consultarlo antes de entregar un documento clasificado como "nodo de decisión".

### H04 — Sin alerta de antigüedad de datos en ninguna app

- **Hallazgo:** Ninguna app del ecosistema alerta cuando un dato supera un umbral de antigüedad razonable para su familia (ej. datos censales con más de 10 años). `lib/moddulo/staleness.ts` no existe; el archivo real (`lib/territorio/staleness.ts`) mide cambio de territorio, no antigüedad de dato. Fontana no tiene fecha de corte estructurada (se infiere con regex del texto de la fuente). Sefix es la app más visible en este sentido ("Corte: {fecha}" en títulos de gráficas), pero sin alerta activa de vencimiento.
- **Principio(s):** Principio 8 (Oportunidad).
- **Estado:** Pendiente (Grupo 2 — ronda de diseño propia, "umbrales por familia, campo estructurado en Fontana").
- **¿Patrón o caso aislado?:** Patrón — ausencia total, no parcial, en las 4 apps.
- **Nota para el documento final:** Definir umbrales de antigüedad por familia de indicador (censal, seguridad, electoral, etc.) como una tabla de configuración central, reutilizable por cualquier app que muestre ese tipo de dato — evita que cada app invente su propio criterio de "qué tan viejo es demasiado viejo".

### H05 — Sin distinción visible entre fuente institucional y fuente generada por IA

- **Hallazgo:** Ningún tipo de dato (`Senal`, `F2Senal`, `CeldaTablaFontana`) tiene un campo que distinga si una afirmación viene de una fuente institucional verificable o fue inferida/generada por la IA. El `nivelConfianza` lo estima la propia IA y se muestra como si fuera un dato objetivo. Los guards de honestidad ya existentes previenen que el sistema invente datos, pero no resuelven la distinción visual de origen que pide el principio.
- **Principio(s):** Principio 9 (Veracidad).
- **Estado:** Pendiente (Grupo 2 — ronda de diseño propia, "afecta los tipos de datos y todos los renders de fuente").
- **¿Patrón o caso aislado?:** Patrón — ausencia total en las apps con IA.
- **Nota para el documento final:** Diferenciar "el sistema previene la invención de datos" (ya resuelto con los guards de honestidad) de "el sistema declara visiblemente el origen de cada dato" (no resuelto) — son dos capas de Veracidad distintas, y la primera no sustituye a la segunda.

### H06 — Sobrescritura sin versión en Moddulo, Fontana y PESTEL

- **Hallazgo:** Varias rutas de mutación sobrescriben contenido existente sin conservar versión anterior ni historial (`finalize-dvs`, reportes de fase en Moddulo; `reporte/actual` en Fontana se sobrescribe al regenerar, incluidas ediciones del usuario — antes de la corrección de esta misma ronda, lo mismo pasaba con los informes de PESTEL).
- **Principio(s):** Principio 7 (Persistencia).
- **Estado:** Parcialmente corregido (el caso de PESTEL ya se resolvió, con la aclaración explícita de que `contenidoEditado` es una solución parcial, no el versionado completo); el resto pendiente (Grupo 2).
- **¿Patrón o caso aislado?:** Patrón — se repite en las 3 apps.
- **Nota para el documento final:** `changelog.ts` (ver H08) es la pieza natural para resolver esto de raíz — diseñado con toda intención para este propósito exacto, nunca conectado. El Grupo 2 debería evaluar si conviene generalizarlo como el mecanismo de versionado único del ecosistema, en vez de resolver cada app por separado.

### H07 — Resolución geográfica inteligente incompleta fuera de Fontana

- **Hallazgo:** Fontana tiene la disciplina completa de declarar el nivel geográfico nativo y advertir cuando se agrega a un nivel superior (cobertura graduada, `MOTIVO_NIVEL_NO_CUBIERTO`). PESTEL y Moddulo F2 no: datos nacionales/estatales (Banxico, BISE) se inyectan sin declarar su nivel, y un proyecto municipal puede recibir población estatal sin ningún aviso.
- **Principio(s):** Principio 5 (Resolución geográfica inteligente).
- **Estado:** Pendiente (Grupo 2 — "reutiliza el patrón de Fontana, más campo de nivel en `Senal` e `InsumoSintesis`").
- **¿Patrón o caso aislado?:** Patrón — mismo tipo de vacío ya resuelto en una app (Fontana) pero no propagado a las otras dos.
- **Nota para el documento final:** Mismo patrón que H01 — una disciplina ya construida y probada en Fontana (cobertura graduada) debe generalizarse como mecanismo central, no reconstruirse app por app.

### H08 — `changelog.ts`: pieza construida con intención, nunca conectada

- **Hallazgo:** Módulo completo (`logChange`, `logUserChange`, `logAISuggestion`, `logPropagation`, `getChangelog`) con un tipo de dato bien diseñado (`ChangelogEntry`: quién, fase, acción, valor previo/nuevo, motivo, origen usuario/IA/propagación), construido desde la reconstrucción de arquitectura (26-03-14). Ningún commit lo ha llamado jamás.
- **Principio(s):** Principio 7 (Persistencia) — es la pieza que resolvería H06.
- **Estado:** Conservado, pendiente de activación en el Grupo 2.
- **¿Patrón o caso aislado?:** Caso aislado en sí mismo, pero ejemplo de un patrón más amplio: piezas bien diseñadas que se construyen "por si acaso" y nunca se conectan a su punto de uso real.
- **Nota para el documento final:** Antes de descartar código que parece "muerto", verificar si fue diseñado con intención real (como este caso) antes de asumir que es deuda a eliminar — puede ser la solución correcta esperando su momento.

### H09 — `versionSesion`: residuo real de un diseño abandonado (eliminado)

- **Hallazgo:** Campo pensado para un mecanismo de diff de exportación en Fontana (documentado en `Fontana_T10_Cierre_Paso4.md`) que nunca se terminó de construir (`familiasModificadasDesdeUltimaExportacion` nunca existió en código). El campo solo se escribía con el valor fijo `1`, sin ningún lector.
- **Principio(s):** N/A — es deuda técnica pura, no un vacío de principio.
- **Estado:** Corregido (eliminado por completo).
- **¿Patrón o caso aislado?:** Caso aislado, pero contraste útil con H08 — mismo síntoma superficial ("código sin llamadores"), pero origen distinto (uno es diseño abandonado a eliminar, el otro es diseño pendiente de activar).
- **Nota para el documento final:** Al encontrar código sin llamadores, siempre investigar el historial de commits y la documentación asociada antes de decidir "eliminar" vs. "conservar y conectar" — el síntoma es idéntico, el tratamiento correcto no lo es.

### H10 — El Redactor: funcionalidad nunca conectada desde su origen (eliminado)

- **Hallazgo:** La pantalla del Redactor (generación de posts) llamaba, desde su primer commit (enero 2026), a una ruta de API que nunca existió — la variable local se llamaba literalmente `mockOutput`. No estaba enlazado desde ninguna navegación real, solo alcanzable por URL directa. Se eliminó por completo (pantalla, tipos, componentes, menciones en modal informativo y plan freemium, el documento de proyecto real sin uso, y la función `canAccessModduloApp` sin otros llamadores) por decisión de producto: no está en la hoja de ruta actual.
- **Principio(s):** N/A — es deuda técnica / alcance de producto, no un vacío de principio en sí.
- **Estado:** Corregido (eliminado por completo, incluido el dato real en producción tras confirmación de Raúl).
- **¿Patrón o caso aislado?:** Caso aislado hasta ahora, pero advertencia general: una pantalla puede existir, verse terminada visualmente, y nunca haber tenido su backend real conectado desde el principio.
- **Nota para el documento final:** Al auditar cualquier funcionalidad "existente", confirmar que su conexión real al backend existe y fue probada — la sola presencia de una pantalla no es evidencia de que la funcionalidad completa fue construida.

### H11 — Informes de PESTEL: guardado en servidor nunca conectado a la pantalla

- **Hallazgo:** El guardado en Firestore (`persistInforme`) se construyó correctamente (commit `cb008f9`), pero un commit posterior agregó una mejora de experiencia con `localStorage` sin conectar ambas piezas. Las ediciones del usuario nunca viajaban al servidor; un cambio de dispositivo o limpieza de caché perdía el trabajo. Adicionalmente, se encontró que el propio guardado en servidor podía fallar silenciosamente ante un error o desconexión, por el orden del código (`controller.close()` antes de `persistInforme`).
- **Principio(s):** Principio 7 (Persistencia).
- **Estado:** Corregido. Verificado en navegador por Raúl.
- **¿Patrón o caso aislado?:** Patrón — mismo tipo de "mejora de UX que nunca se conectó a la fuente de verdad real" visto en otras piezas de esta sesión (recordar el picker de municipios que descartaba la clave elegida, en la ronda de geografía).
- **Nota para el documento final:** Cuando se agrega una mejora de experiencia de usuario (caché local, autoguardado) sobre una funcionalidad que ya persiste en servidor, verificar explícitamente que ambas piezas quedan conectadas antes de dar la funcionalidad por completa — una mejora de UX no debe convertirse, por accidente, en la única fuente de verdad.
- **Límite honesto conocido:** si la migración de una edición desde `localStorage` al servidor falla, se reintenta automáticamente en la siguiente carga de la página, pero sin ningún aviso al usuario de que ese reintento está ocurriendo. No hay pérdida de datos (la copia local se conserva), pero el usuario no tiene visibilidad del proceso. Candidato a mejora menor, no urgente.

### H12 — Mensajes de Fontana: pérdida de turno completo ante desconexión o error

- **Hallazgo:** La pregunta del usuario y la respuesta del asistente se guardaban juntas solo al final del turno. Una desconexión o un error de la API de Claude a mitad del proceso perdía ambos mensajes — hasta 60 segundos de trabajo — mientras que ciertos elementos del Canvas (tarjetas generadas por herramientas) sí persistían de forma independiente, dejando tarjetas huérfanas sin mensaje que las explicara.
- **Principio(s):** Principio 7 (Persistencia).
- **Estado:** Corregido (guardado del mensaje de usuario al inicio del turno; guardado continuo tras desconexión del cliente; mensaje de asistente marcado como "interrumpido" ante error de API, enlazado a las tarjetas del Canvas ya generadas).
- **¿Patrón o caso aislado?:** Patrón relacionado con H11 — ambos son casos de "persistencia diferida hasta el final del proceso", vulnerable a interrupciones.
- **Nota para el documento final:** Regla general candidata: cualquier proceso largo (generación de informe, turno de chat con herramientas) debería persistir sus piezas atómicas (mensaje de usuario, resultados parciales) tan pronto estén disponibles, no esperar al final del proceso completo para guardar todo junto.

### H13 — Crecimiento sin control de `pestel_analyses.informes[]`

- **Hallazgo:** Cada informe generado o editado se agrega al mismo array dentro del documento del análisis, sin tope. Con los 5 formatos ya construidos, una práctica real de regeneración y edición podría acercar el documento al límite de 1 MB de Firestore en un número de ciclos moderado.
- **Principio(s):** Principio 7 (Persistencia) — tensión directa con la solución de H11 (conservar `contenidoEditado` sin perder nada aumenta el tamaño).
- **Estado:** **CERRADO.** Mitigado con alerta en 2 umbrales (60% aviso temprano en consola, 80% prioridad alta) evaluados antes de escribir, aviso visible al usuario cuando el guardado falla (marca de "no guardado" en el propio texto, distinción del error 413 "documento lleno" de cualquier otro error de Firestore), y la solución de fondo (subcolección, mismo patrón que `f3Resultados`) documentada en CLAUDE.md con su disparador concreto: cruzar el 80%, o que el versionado del Grupo 2 guarde una entrada por edición (en cuyo caso la subcolección pasa de opcional a obligatoria y debe diseñarse junto con ese versionado, no aparte).
- **¿Patrón o caso aislado?:** Patrón candidato — cualquier array que crece con cada edición/regeneración dentro de un documento único corre el mismo riesgo; vale la pena revisar si existe un caso similar en otras apps al llegar al Grupo 2.
- **Nota para el documento final:** Regla candidata: cuando un documento acumula contenido generado repetidamente (informes, versiones, ediciones), decidir desde el diseño inicial si ese contenido vive en una subcolección (recomendado desde el principio) en vez de un array dentro del documento padre — migrar después es más costoso que diseñarlo bien desde el principio. `f3Resultados` en Moddulo es el precedente correcto a replicar. Nota adicional: cuando un guardado puede fallar de forma irrecuperable para el usuario (límite de tamaño alcanzado), el fallo debe ser visible en la interfaz, nunca solo un registro de consola que nadie revisa en el momento.

---

## Grupo 1 — CERRADO (2026-10-03)

Los 4 puntos de corrección inmediata derivados de la auditoría de los 9 principios (informes de PESTEL, mensajes de Fontana, eliminación del Redactor, código huérfano) quedaron corregidos, verificados (tsc, suite completa, next build, code-review-and-quality, check-docs-freshness) y confirmados en navegador por Raúl. Commit ejecutado.

---

## Pendientes de investigación (no verificados aún, mencionados en la auditoría original)

Estos quedaron señalados por Code como "no verificado" durante la auditoría de los 9 principios — se listan aquí para no perderlos de vista cuando se retomen las rondas de los Grupos 2 y 3:

- Código sin leer: `FontanaReportePanel`, `F4Panel`, la matriz E6 de PESTEL, las gráficas electorales de Sefix.
- Moddulo F4 a F9: no tienen código propio todavía (son stubs).
- Ningún hallazgo de lenguaje determinista (H02) fue verificado línea por línea — los conteos salieron de expresiones regulares.
- Rutas de agregación de Sefix: no se abrieron durante la auditoría.
- Registry de Fontana: no se confirmó el total real de 86 indicadores documentado.

---

## Historial de versiones de esta bitácora

- **v1 (2026-10-02):** Creación inicial, con los hallazgos H01-H13 surgidos del cierre del Grupo 1 y la lista de pendientes de verificación.
- **v2 (2026-10-03):** Cierre formal del Grupo 1 (H09, H10, H11, H12, H13 confirmados como corregidos/mitigados, con el límite honesto de H11 documentado). Se incorpora la decisión de criterio sobre aprobación implícita vs. explícita, que reencuadra el alcance del Grupo 3 (H02) y precisa el alcance de H03 — el campo de aprobación con autoría solo aplica a los casos clasificados como "nodo de decisión", no a todo resultado generado por el sistema.
