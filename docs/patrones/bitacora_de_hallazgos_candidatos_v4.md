# Bitácora de hallazgos candidatos — Documento de Patrones Reutilizables

**Versión:** 4
**Última actualización:** 2026-10-08
**Propósito:** Registrar, a medida que avanzamos en la nivelación del sistema contra los 9 Principios Rectores de Eskemma (Grupos 1, 2 y 3) y en las series de correcciones que de ahí se derivan, los hallazgos que podrían convertirse en patrones reutilizables, principios reforzados, o advertencias de diseño para el documento final. Esta bitácora se actualiza al cierre de cada ronda y se versiona (v1, v2, v3, v4...) hasta que se retome la redacción del documento de patrones reutilizables, momento en el que su contenido se integra y esta bitácora se da por cerrada.

**Cómo leer cada entrada:**
- **Hallazgo:** qué se encontró, en una frase.
- **Principio(s) o categoría relacionada:** a cuál de los 9 principios rectores, o a cuál categoría técnica del borrador de patrones (Seguridad, Integridad de datos e IA, Arquitectura de datos, Arquitectura entre apps, Ciclo de vida de recursos, Proceso de desarrollo, Diseño visual, Documentación viva), se conecta.
- **Estado:** Corregido / Pendiente (Grupo 2) / Pendiente (Grupo 3) / Pendiente (decisión de producto) / Documentado solamente.
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
- **Estado:** CLASIFICADO Y CERRADO EN LO TEXTUAL (Grupo 3, 2026-10-07). De ~50 casos revisados, solo 5 necesitaron ajuste de texto (M28 prompt base, M25, M8, M9, P4), ya aplicados. El resto se queda como está por ser de aprobación implícita. Lo que de verdad faltaba no era lenguaje sino autoría y fecha en los nodos (ver H03) y confirmación de impacto (ver H15).
- **¿Patrón o caso aislado?:** Patrón — se repite en las 3 apps con IA, con distinta intensidad (Moddulo ~17 casos, PESTEL ~10, Fontana ~3).
- **Nota para el documento final:** Checklist de redacción para cualquier texto de interfaz o instrucción de prompt nuevo: ¿el resultado que produce este botón es un nodo de decisión (requiere lenguaje cauto + aprobación explícita) o un resultado de bajo riesgo (aprobación implícita, lenguaje normal es aceptable)? La respuesta sale de los documentos guía (FAT 2, FODA, MEC, MVP) en primera instancia, y se ajusta cuando la investigación revela un nodo real no contemplado en ellos.

### H03 — No existe un campo real de "aprobado por el usuario, con autoría y fecha"

- **Hallazgo:** El campo `aprobado_por_usuario` que describe el principio de Editabilidad no existe en ningún tipo de dato del sistema. Lo que existe son variantes sueltas (`VeredictoHEI.aprobadoPorUsuario`, `ResultadoF3.aprobado`, `approvedBy`/`approvedAt` de PESTEL solo en una ruta) sin un patrón común, y ninguna descarga de documento exige que algo esté realmente aprobado antes de entregarse.
- **Principio(s):** Principio 4 (Editabilidad universal).
- **Estado:** Pendiente (Grupo 2 — ronda de diseño propia, "define el tipo común, qué se exige y dónde se firma"). El Grupo 3 identificó los casos concretos que lo necesitan (clase "a"): cerrar F1, F2 y F3 (M2, M10, M24), aprobar motores de F2 (M11), finalizar análisis (M12), aceptar condición RDA (M15), aprobar resultado de F3 (M19), aprobar veredicto (M22), activar/desactivar vía de F3 (M17), más H-P1, H-P3 y H-M7. Solo debe exigirse en esos nodos, no en todo resultado generado. Nota (H20): la serie de guardado honesto hizo que el cierre de fase solo avance si el servidor lo confirmó, pero el registro de autoría y fecha del cierre sigue siendo de esta ronda.
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

## Origen: Grupo 3 y H-M5 (2026-10-07)

### H14 — H-M5: el PATCH de proyectos aceptaba casi cualquier campo y pisaba datos de fase

- **Hallazgo:** `PATCH /api/moddulo/projects/[projectId]` hacía `update({...body})` sin lista blanca. Firestore interpreta las claves con punto como rutas, así que un colaborador con rol de edición podía escribir `collaborators`, `userId`, `deletedAt`, `currentPhase`, o rutas como `phases.exploracion.motorAprobaciones.M2`, saltándose los gates. Además, `phaseData` reemplazaba `phases.X.data` completo: cerrar F2 envía `{aprobadoEn}` y borraba el formulario. Medido en datos reales: ocurrió en 10 de 10 proyectos con F2 cerrada (sin pérdida demostrable, porque el chat no había extraído nada en ellos). La rama `started` ponía `in-progress` sin condición, podía revertir una fase completada y no comprobaba rol.
- **Principio(s):** Seguridad (Regla de Oro #3, ahora también sobre QUÉ se puede escribir, no solo quién) y Principio 7 (Persistencia).
- **Estado:** Corregido (lista blanca con 400, fusión por clave, `phaseId` validado, `started` con rol y sin revertir, filtrado de rutas de XPCTO en el GET y en el chat). Los 10 proyectos ya afectados no se tocaron.
- **¿Patrón o caso aislado?:** Patrón — misma clase que `createProject` (identificador del cliente usado sin validar), ahora en forma de "campos del cliente usados sin validar".
- **Nota para el documento final:** Toda ruta de actualización debe tener lista blanca explícita de campos, validación de valores con topes medidos contra datos reales, y fusión por clave en lugar de reemplazo de objetos. Los errores de validación devuelven el nombre del campo, nunca el contenido enviado.
- **Lecciones de proceso:** (1) Los topes y tipos se midieron contra los datos reales antes de fijarlos: así apareció que `tiempo.duracionMeses` es `null` en un proyecto real y que el validador debía aceptarlo; de lo contrario el autoguardado de ese proyecto habría recibido 400. (2) Las claves permitidas de una fase se derivan de lo que los clientes escriben hoy, no de memoria. (3) Prueba en negativo contra el código anterior: fallaron 50 de 59 pruebas de comportamiento, y las 9 que pasaron eran los guardados legítimos que no debían cambiar.
- **Regla vigente para escritores futuros:** cualquier nueva clave de primer nivel en `exploracion.data` debe agregarse a la lista blanca o recibirá 400. `dictamenViabilidad`, `matrizBrechas` y `documentoRector` están fuera porque hoy nadie las escribe.
- **Límite de verificación declarado:** el emulador de Firestore no arranca (Java 17, se requiere 21 o superior). La semántica de claves con punto se tomó de la documentación y del uso existente del chat. Lo que sí está probado es que la escritura nunca se ejecuta con un cuerpo rechazado.

### H15 — Categoría nueva: "confirmación de impacto" (acciones que descartan o invalidan trabajo aprobado)

- **Hallazgo:** Varias acciones descartan o invalidan algo ya aprobado sin avisar, y no encajan en "aprobar un resultado" ni en "cambiar un texto". Casos: M3 (editar territorio), M4 (editar variables XPCTO), M7 (regenerar análisis descarta aprobaciones de motores), M8 (el botón que antes decía "Regenerar reporte F2" reemplaza el análisis finalizado y rompe `pipItemId` y `actorId` que F3 consume), M17 (activar o desactivar una vía de F3), P2 y H-P4 (un análisis nuevo de PESTEL anula una aprobación sin aviso), H-M3 (regenerar M3, M4 o el tablero no invalida veredicto ni DIE), F3 y H-F1 (la confirmación de entrega a F3 está documentada como obligatoria y no se construyó).
- **Caso añadido en v4 (camino hermano #8 de H25):** `generate-dvs` en `exploracion/page.tsx:1239`. Es la misma ruta de M8: si la respuesta no es OK, la página sigue a la retropropagación y marca la fase como "completed". Se absorbe en la investigación de M8 en lugar de arreglarse aparte.
- **Principio(s):** Principios 1 (Transparencia) y 3 (Colaborador estratégico), desde el ángulo de honestidad sobre el impacto real de una acción.
- **Estado:** Pendiente (ronda propia, "confirmación de impacto"). M8 es el caso más grave y va primero (investigación y plan, sin implementar). Mientras tanto, el rótulo de M8 ya no engaña: "Reemplazar análisis finalizado".
- **¿Patrón o caso aislado?:** Patrón — diez casos repartidos en Moddulo, PESTEL y Fontana.
- **Nota para el documento final:** Toda acción que descarte o invalide trabajo ya aprobado debe (a) nombrarse por lo que hace, (b) pedir confirmación que diga qué se pierde, y (c) tener un candado en el servidor, no solo en la interfaz. El modal de "Regenerar" con ediciones de PESTEL es el modelo a seguir.

### H16 — PESTEL llega a Moddulo sin exigir aprobación y sin los ajustes humanos

- **Hallazgo:** H-P1: importar un análisis PESTEL a F2 no exige que esté aprobado (aunque esté en PENDING_REVIEW o con sesgos sin reconocer), y de ahí cuelgan los motores M2 a M5 y el PIP. H-P2: los ajustes humanos de la matriz no viajan, porque `transformToMapaPESTEL` usa la clasificación original de la IA. H-P3: la spec dice que una confianza global menor a 50 bloquea el avance a la etapa 6, pero el código solo pone la etiqueta PENDING_REVIEW. Además, la spec de PESTEL se contradice a sí misma sobre si `AnalysisStatus` incluye `APPROVED` (H-X).
- **Principio(s):** Principio 4 (Editabilidad y aprobación), con contradicción explícita contra la spec.
- **Estado:** Pendiente (ronda propia con diseño, PESTEL a Moddulo). Son los hallazgos de mayor riesgo del Grupo 3.
- **¿Patrón o caso aislado?:** Patrón dentro de la integración entre apps: el dato viaja, pero su estado de aprobación y sus correcciones humanas no.
- **Nota para el documento final:** Cuando un resultado cruza de una app a otra, debe viajar con su estado de aprobación y con sus ediciones humanas, y la app receptora debe poder negarse a consumirlo si no cumple el estado exigido por la spec.

### H17 — Guardados optimistas que afirman un éxito que no verificaron

- **Hallazgo:** El autoguardado de F1 y F2 mostraba "guardado" sin revisar `res.ok`; `approve-motor` mostraba la aprobación como hecha aunque el servidor no la registrara; `save-draft` podía perder ediciones del borrador sin aviso. Los dos últimos usaban `.catch(() => {})`.
- **Principio(s):** Principio 7 (Persistencia) y Principio 1 (Transparencia).
- **Estado:** **Corregido (2026-10-07).** El autoguardado de F1 y F2, `approve-motor` (M2–M4), `finalize-dvs` (M5) y `save-draft` revisan la respuesta del servidor, revierten lo optimista y muestran un error visible. La decisión vive en `lib/moddulo/guardadoHonesto.ts`, con pruebas, y se reutiliza en H20 a H22.
- **¿Patrón o caso aislado?:** Patrón recurrente — encabeza la familia "la pantalla no afirma lo que el servidor no confirmó" (ver sección siguiente).
- **Nota para el documento final:** Regla: una acción que el usuario ve como hecha debe estar confirmada por el servidor. Si no lo está, la pantalla revierte y lo dice. Un fallo de red es ambiguo: el servidor puede haber recibido la petición, así que el mensaje dice "no se pudo confirmar", no "no se registró". Se prueba la función pura de decisión, incluidas las respuestas fuera de orden: una respuesta vieja nunca pisa a una más nueva. Verificado: `finalize-dvs` promueve el borrador que envía el cliente, así que un guardado fallido no congela una versión más antigua. Banear `.catch(() => {})` en revisión de código, porque el repo no tiene pruebas de DOM y la decisión debe poder probarse sin él.

### H18 — Los documentos guía no tienen una lista de "puntos de control estratégico"

- **Hallazgo:** Ningún documento de especificación define esa categoría. Los gates están repartidos en tres formas: cláusulas por fase (FAT:806-807, 1174-1177, 1934-1936), criterios de suficiencia "Aprobación del usuario" que son blandos por diseño (el RDA registra la deficiencia sin bloquear), y gates duros puntuales (M2, M4, cerrar F3 solo con veredicto aprobado). Por eso el servidor no bloquea "Cerrar Fase 1, 2 o 3", y eso es coherente con FAT: lo que falta es registro con autoría y fecha, no bloqueo.
- **Principio(s):** Principio 4 (Editabilidad), Documentación viva.
- **Estado:** Documentado. Decisión: el criterio de nodo se aplica caso por caso y es iterativo; si la investigación revela un nodo que los documentos no declaran, se señala igual.
- **¿Patrón o caso aislado?:** Hallazgo de documentación.
- **Nota para el documento final:** Si el sistema depende de saber qué es un nodo de decisión, esa lista debería existir como parte de la spec de cada fase, en lugar de inferirse del código.

### H19 — Un rótulo debe nombrar lo que la acción hace en realidad

- **Hallazgo:** Tres rótulos describían mal su acción: M8 ("Regenerar reporte F2" reemplazaba el análisis finalizado), P4 ("Ejecutar análisis manual" solo navegaba a otra pantalla) y el modal de M9 (decía que descartaba "los motores generados", cosa que el código no hace). Cada corrección se verificó leyendo el código, no por intuición.
- **Principio(s):** Principio 1 (Transparencia).
- **Estado:** Corregido.
- **¿Patrón o caso aislado?:** Patrón pequeño.
- **Nota para el documento final:** Al escribir o revisar el texto de un botón o un modal, leer el código que ejecuta y describir su efecto real. El rótulo debe usar la misma palabra que el usuario ve en la interfaz para ese objeto (por ejemplo "Finalizar análisis" y "Reemplazar análisis finalizado", no "aprobado").

### Nota metodológica sobre la verificación de M28 (prompt base)

La reescritura de la línea 30 se verificó con 18 llamadas reales a Claude en F1, F2 y F3, antes y después. El conteo de "te propongo" dio 0 y 0, los guards de honestidad se comportaron igual (0 porcentajes inventados en las 18 respuestas) y las longitudes fueron comparables. Eso demuestra que el cambio no empeora lo medido, no que el modelo enmarque ahora como propuesta lo que debe aprobarse. Esa parte la valida el uso real.

---

## Origen: serie de guardado honesto (2026-10-07 a 2026-10-08)

### Regla común de la serie (agrupa H17, H20, H21, H22 y H24)

**La pantalla no afirma lo que el servidor no confirmó, y una falla de red es ambigua.** Las entradas H17 y H20 a H24 son variantes de una sola familia, y el documento de patrones debe nombrar la regla una vez y listar las variantes:

| Variante | Entrada | Qué no debe afirmar la pantalla |
|---|---|---|
| Escritura | H17 | "Guardado" o "aprobado" sin respuesta OK |
| Cierre | H20 | "Fase cerrada" (navegar) sin confirmación |
| Lectura | H21 | "No tienes nada" cuando la carga falló |
| Borrado | H22 | "Eliminado" (cerrar modal, quitar de la lista) sin confirmación |
| Sesión | H24 | "No hay usuario" cuando solo se cayó la red |

Elementos compartidos de la familia:
- Decisión en función pura probada sin DOM (`guardadoHonesto.ts`, `decidirSesionTrasError.ts`); el cableado de las pantallas solo ejecuta efectos.
- Error de red = ambiguo: "no se pudo CONFIRMAR…", con instrucción de verificar. Excepción: para el borrador de F1/F2 el texto dice "vuelve a intentar guardar antes de recargar", porque recargar descarta lo que solo está en pantalla.
- Pruebas en negativo: una réplica del comportamiento anterior que debe divergir en todas las combinaciones de fallo.
- Todo estado de lista distingue cargando / vacío / fallido; "vacío" nunca es el valor por defecto de un fallo.
- Límite declarado de la serie: el cableado de las pantallas no tiene pruebas de DOM; esa parte se valida con guías de navegador en modo Offline.

### H20 — «Cerrar Fase» navegaba o respondía sin verificar que la fase se cerró

- **Hallazgo:** En F1 y F2, «Cerrar Fase» hacía `await fetch(complete-phase)` sin revisar `ok` y navegaba a la fase siguiente aunque el cierre hubiera fallado. En F3 solo apagaba el spinner sin informar. En F2, el PATCH de `aprobadoEn` corría aunque el cierre hubiera fallado. El `catch` de F1 y F2 era silencioso.
- **Principio(s):** Principio 7 (Persistencia) y Principio 1 (Transparencia). El cierre con autoría es H03 (Grupo 2).
- **Estado:** **Corregido (2026-10-07, commit 2).** Si `complete-phase` falla: no se navega, el modal sigue abierto con el error y el segundo paso no se ejecuta. Si el cierre funciona pero el registro de `aprobadoEn` falla: se navega y se muestra un aviso no bloqueante en F3 (`?aviso=aprobacion_no_registrada`). Límite: el caso del segundo paso queda cubierto solo por pruebas unitarias; no se pudo provocar en navegador, porque el bloqueo de peticiones de Chrome coincide por subcadena y atrapa también `complete-phase`.
- **¿Patrón o caso aislado?:** Patrón: misma familia que H17, en las tres fases.
- **Nota para el documento final:** Una acción de cierre que cambia el estado del proyecto no navega ni da por concluido el cierre sin confirmación. Si hay pasos encadenados, el posterior no corre si falla el anterior; si el que falla es uno posterior a un cierre ya efectivo, el fallo se avisa pero no bloquea. Avisos entre pantallas: lista cerrada de códigos con texto fijo, nunca el valor de la URL, y se quitan de la URL tras leerse (`router.replace`).

### H21 — Un hub que mostraba «sin proyectos» cuando la carga falló

- **Hallazgo:** El hub de Moddulo cargaba proyectos y papelera con `.then(r => r.json()).catch(() => {})`. Si fallaba, la pantalla quedaba vacía y se leía como «no tienes proyectos» o «papelera vacía», es decir, como pérdida de datos. El mismo defecto estaba en el hub de PESTEL (fallo = «No tienes proyectos todavía») y en el de Fontana (si fallaba `sesion/mias`, caía al formulario de creación sin avisar).
- **Principio(s):** Principio 1 (Transparencia); Arquitectura de datos.
- **Estado:** **Corregido en los 3 hubs** (Moddulo en commit 2; PESTEL y Fontana en commit 3, 2026-10-08). Mensaje y «Reintentar» por lista mediante `decidirEstadoLista` y el componente compartido `ErrorCarga`; en Fontana el formulario «Crear una sesión nueva» queda visible como opción secundaria. Concordancia corregida: «No se pudieron cargar tus proyectos». Pendiente del mismo defecto: ~28 lecturas de Sefix (ver H26).
- **¿Patrón o caso aislado?:** Patrón de lectura (el de H17 y H20 es de escritura), presente en al menos 4 sitios.
- **Nota para el documento final:** Toda lista distingue tres estados: cargando, vacía y fallida. «Vacía» nunca es el valor por defecto de un fallo. Un fallo debe dejar una salida (reintentar, o una opción alternativa visible) para que nadie quede atrapado. Sugerencia: un helper común de lectura (la ronda de Sefix lo necesita) con una función pura de clasificación como `decidirEstadoLista`.

### H22 — Escrituras del hub de PESTEL que afirmaban un cambio sin verificarlo (estado, edición, eliminación)

- **Hallazgo:** `handleStatusChange` y `handleSaveEdit` llamaban a `onStatusChanged`/`onUpdated` y cerraban el editor aunque el PATCH fallara. `handleDelete` cerraba el modal siempre, ignoraba un DELETE fallido (`if (r.ok)` sin `else`) y, ante un fallo de red, dejaba un rechazo sin capturar. La importación automática de Moddulo F2 en `datos/page.tsx` tragaba su fallo con `.catch(() => {})`.
- **Principio(s):** Principio 7 (Persistencia) y Principio 1 (Transparencia).
- **Estado:** **Corregido (commits 3 y 4a, 2026-10-08).** Acciones `actualizar_proyecto`, `eliminar_proyecto` e `importar_adjuntos_moddulo` (no bloqueante, con aviso amarillo). En fallo el editor o el modal quedan abiertos con el mensaje y no se llama a los callbacks.
- **¿Patrón o caso aislado?:** Patrón: misma familia que H17, en el hub de PESTEL.
- **Nota para el documento final:** Un 404 en DELETE tras una red ambigua no puede afirmar que el objeto sigue existiendo: el primer intento pudo haberlo borrado y el reintento devuelve 404 aunque el objetivo ya se cumplió. El texto correcto es «No se encontró el proyecto; puede que ya se haya eliminado. Recarga la lista para verificar.»

### H23 — Contraste: `red-eske-20` en oscuro no alcanza AA sobre tintes

- **Hallazgo:** El error de guardado de F2 usaba `text-red-eske` sin variante oscura (2.42:1 en oscuro). Además, 9 líneas usaban `text-red-eske-60 dark:text-red-eske-20`, que mide 4.25:1 sobre `#18324A` y hasta 3.38:1 sobre tintes (mínimo AA para texto: 4.5:1).
- **Principio(s):** Diseño visual.
- **Estado:** **Corregido (commits 3 y 4a).** El error de F2 pasa a `red-eske-60 / dark:red-eske-10` (2.42:1 → 5.39:1 en oscuro). Seis usos de texto pasan a `dark:text-red-eske-10` (de 3.90–4.25 a 4.95–5.39). Se excluyeron el V1 legacy (se retira) y el ícono de exploración (4.13:1; un ícono necesita 3:1). El badge «alto» de `PESTLPanel` no llegaba a 4.5:1 con ningún token rojo (máximo 4.40 sobre la tarjeta `#21425E`); se resolvió cambiando el fondo del badge a `#112230` con texto `red-eske-10` y borde `red-eske/40` (4.30:1 → 6.63:1), que conserva el rojo como identidad.
- **¿Patrón o caso aislado?:** Patrón de diseño: un token puede pasar AA sobre un fondo liso y fallar sobre un tinte.
- **Nota para el documento final:** El contraste se mide sobre el fondo real (liso o tinte compuesto), en claro y en oscuro, no solo contra el fondo base. Cuando ningún token alcanza el mínimo, se cambia el fondo o el portador del color, no se acepta el valor bajo. Todo token de color con variante oscura debe declararla explícitamente.

### H24 — AuthContext: una caída de red se trataba como sesión inválida

- **Hallazgo:** Ante `auth/network-request-failed`, el `catch` de `AuthContext` solo hacía `console.error` (de ahí el overlay de Next en desarrollo), dejaba `user=null` y `loading=false`, y la app trataba al usuario como invitado aunque Firebase conservara su sesión (p. ej. `/moddulo` redirigía a «/»). No había recuperación al volver Online (ni listener ni reintento). El SDK ya conserva la sesión solo ante `network-request-failed` y cierra sesión ante `user-disabled` y `user-token-expired`; el `catch` nunca cerraba. Hallazgos de la auditoría de idempotencia: el riesgo real era la concurrencia (dos cargas que leen «no existe el perfil» y pisan `createdAt` y los flags de onboarding con un `setDoc` a ciegas) y la reapertura de modales; offline, las escrituras de Firestore no rechazan, quedan en cola y cuelgan el `await`.
- **Principio(s):** Principio 7 (Persistencia) y Principio 1 (Transparencia).
- **Estado:** **Corregido (2026-10-08, commit 4b).** `decidirSesionTrasError` (cerrar: `user-token-expired`, `user-disabled`, `invalid-user-token`, `user-not-found`; mantener y reintentar: `network-request-failed`, Firestore `unavailable`/`deadline-exceeded`, `too-many-requests`; resto: mantener sin reintento). Reintenta solo la lectura, con backoff de 2/5/10/20/30 s (tope 8; 30/60 s para `too-many-requests`), un solo temporizador, id de carga que invalida cargas viejas, `cancelar()` al cerrar sesión o desmontar y listener `online` con limpieza, sin depender de ese evento. Perfil nuevo con transacción «crear si no existe». Todas las esperas de escritura acotadas (10 s; 15 s la transacción). Expone `sesionSinVerificar` y `reintentarSesion`. Con transitorios: spinner con «Sin conexión. Reintentando…» a los ~10 s y `console.warn`; con errores desconocidos: `loading=false` y `console.error`, como antes. Agotados los reintentos, `/moddulo` y `blog/admin` muestran «Sin conexión» con «Reintentar» en lugar de redirigir. Cambio de orden: `user` se arma antes de las escrituras posteriores, con el rol calculado de datos verificados; la autorización real sigue en la cookie y los claims del servidor.
- **¿Patrón o caso aislado?:** Patrón (variante «sesión» de la familia).
- **Nota para el documento final:** Una caída de red no es una sesión inválida: solo los códigos que indican token vencido o usuario deshabilitado cierran sesión. Un estado «pendiente» necesita su propia interfaz; con `loading=true` el proveedor no renderiza nada (`{!loading && children}`), por lo que el spinner pendiente vive en el proveedor. Cualquier espera sobre una escritura de Firestore debe estar acotada. Un reintento repite solo lo idempotente (la lectura); las escrituras corren una vez. Patrón técnico: decisión pura más orquestador con efectos inyectados, probables sin DOM.
- **Límites declarados:** el cableado de `AuthContext` y de los componentes no tiene pruebas de DOM; el cuelgue real de Firestore sin red y la coincidencia de las reglas desplegadas con `firestore.rules` no se pudieron probar con emulador (Java 17, se requiere 21). Las reglas del bloque `users` permiten la transacción de cliente sobre el propio documento (comprobado por lectura del repo y comparado manualmente por Raúl con la consola de Firebase). Hueco previo que no se empeoró: si `updateDoc` del rol funciona y `callSetUserRole` falla (error tragado), el claim queda desfasado y nadie lo reintenta.

### H25 — Caminos hermanos de escritura con `if (r.ok)` sin `else` o sin `catch`

- **Hallazgo:** Ocho ubicaciones con el mismo defecto que H17 y H22, listadas por la auditoría de caminos hermanos del commit 4:

| # | Ubicación | Método | Tamaño aprox. |
|---|---|---|---|
| 1 | `fontana/FontanaSesionesHub.tsx:215-220` `handleEliminar` (sin `try`; `deleting` queda en `true` si lanza) | DELETE | ~12 líneas |
| 2 | `fontana/FontanaSesionesHub.tsx:328-337` `handleDesvincular` | PATCH | ~12 |
| 3 | `fontana/FontanaCanvasItemCard.tsx:108-121` eliminar tarjeta (el `finally` cierra el modal) | PATCH | ~12 |
| 4 | `moddulo/components/RDAHistoryModal.tsx:48-62` aceptar condición RDA | POST | ~12 |
| 5 | `pestel/[projectId]/monitoreo/page.tsx:144-157` toggle auto-Centinela | PATCH | ~10 |
| 6 | `moddulo/.../investigacion/page.tsx` :262 generar tareas, :279 sincronizar tablero, :303 revisar territorio, :336 generar síntesis, :349 generar veredicto, :362 **aprobar veredicto (la más seria)** | POST ×6 | 8-10 c/u (~60 con helper) |
| 7 | `moddulo/.../exploracion/page.tsx:903` unlink-pestel (mudo si `!ok`) | POST | ~10 |
| 8 | `moddulo/.../exploracion/page.tsx:1239` `generate-dvs`: si `!ok` sigue a la retropropagación y marca «completed» | POST | ~12 |

  Catch vacío por diseño o telemetría (sin acción): `investigacion/page.tsx:237` (chat-visita) y `:247`, `exploracion/page.tsx:1063`, `proposito/page.tsx:289` (todos «Comenzar»/started), `TerritorySelector.tsx:177` (sugerencia de nivel). A retirar: `pestel/analisis/[id]/page.tsx` (V1 legacy, `.catch(() => {})` en la recarga del feed, línea ~138). Cargas opcionales no críticas, solo documentadas: `exploracion/page.tsx:415,427,536,591` (contexto web/Sefix opcional).
- **Principio(s):** Principio 7 (Persistencia) y Principio 1 (Transparencia).
- **Estado:** Pendiente. Propuesta de commit 5: #6 (aprobar veredicto de F3, la más seria porque es un nodo de decisión), #1, #3 y #4, que afirman un éxito falso o son destructivos. El #8 se absorbe en la investigación de M8 (H15). Los demás (#2, #5, #7 y el resto de POST de F3) se registran sin construir.
- **¿Patrón o caso aislado?:** Patrón (mismas variantes que H17 y H22).
- **Nota para el documento final:** Después de corregir una familia en un sitio, la auditoría de caminos hermanos (búsqueda de `fetch` con DELETE/PATCH/POST cuyo resultado se ignora o se maneja sin `else`/`catch`) es parte de cerrar la ronda, no un extra.

### H26 — Sefix: ~28 lecturas con `.then(r => r.json())` sin revisar `ok`

- **Hallazgo:** En 16 archivos, `hooks/useEleccionesFilters.ts` (×5), `useEleccionesLocalesFilters.ts` (×7), `useLneHistorico.ts` (×3), `useResultados.ts` (×2), `useResultadosLocales.ts` (×2), `useLneSemanal.ts`, y las tablas `EleccionesDataTable`, `EleccionesLocalesDataTable`, `HistoricoDataTable`, `HistoricoPartidos`, `HistoricoPartidosLoc`. Es el hallazgo de mayor volumen de la serie.
- **Principio(s):** Principio 1 (Transparencia); Arquitectura de datos.
- **Estado:** Pendiente — fuera de la serie por decisión de Raúl; candidato a ronda propia.
- **¿Patrón o caso aislado?:** Patrón de lectura (variante «lectura» de la familia).
- **Nota para el documento final:** Se resuelve con un helper común de lectura y una función pura de clasificación (`decidirEstadoLista` o equivalente), no con 28 parches.

### H27 — `profile` y `suscripciones` redirigen cuando `!user` sin mirar `loading`

- **Hallazgo:** `app/profile/page.tsx:38` y `app/suscripciones/page.tsx:28` redirigen a «/» siempre que `!user`, sin consultar `loading` ni `sesionSinVerificar`. El diagnóstico inicial sospechaba que expulsaban a usuarios con sesión válida en una carga normal.
- **Principio(s):** Principio 7 (Persistencia); Arquitectura entre apps.
- **Estado:** Sin defecto demostrado. Tras 4b, por lectura, esas páginas no se montan mientras `loading=true` (el proveedor no renderiza hijos), así que solo redirigirían si `user` queda `null` con `loading=false` (por ejemplo, con los reintentos agotados). La comprobación con sesión real en red normal fue solicitada a Raúl en el prompt de 4b; no se registró ninguna expulsión. No se modificaron.
- **¿Patrón o caso aislado?:** Nota de consumidores: solo 2 de 33 archivos que usan `useAuth` leen `loading`; el resto ve `user=null` durante la verificación y muestra la UI de invitado.
- **Nota para el documento final:** Un diagnóstico por lectura puede estar equivocado: el de esta entrada se corrigió al descubrir el comportamiento del proveedor. `sesionSinVerificar` queda disponible para que en una ronda posterior los demás consumidores muestren «Sin conexión» en lugar de la UI de invitado.

### Menores de la serie (sin entrada propia)

- El efecto de importación de `pestel/[projectId]/datos/page.tsx` se consideró un riesgo de redisparo si cambiaba la identidad de `loadCoverage`; la lectura demostró que es solo teórico (`loadCoverage` y `loadProject` dependen de `[projectId]`, estable). Solo se repetiría al remontar la página si el servidor no marcó `modduloAttachmentsImported`. Corregida la frase del Historial de CLAUDE.md.
- El reintento de vinculación a Fontana (`investigacion/page.tsx:162`) es silencioso por diseño (red de seguridad previa al banner `fontanaPendiente`); ahora deja `console.warn` y revisa `ok`.
- Pendiente de contraste fuera de la serie: badge «Archivado» de PESTEL en oscuro (4.26:1) y kebab gris de Fontana.

---

## Grupo 3 — CERRADO en lo textual (2026-10-07)

Clasificación de ~50 casos entregada y aprobada. Con el criterio de aprobación implícita vs. explícita, el trabajo de lenguaje resultó mínimo (5 ajustes). El peso real quedó en tres rondas futuras: Grupo 2 (autoría y fecha en los nodos, ver H03), confirmación de impacto (H15) y PESTEL a Moddulo (H16). H-M5 se atendió antes que todo lo demás por ser un defecto de integridad.

Pendientes menores sin ronda propia (correcciones chicas): H-M2 (activar/desactivar vía de F3 sin confirmación), H-M4 (criterio `aprobacion-usuario` siempre falso y modal de cierre con `risks` vacío), H-M6 (`f3Seed` y `phases.investigacion.pip` sin escritor), P7 (etiqueta de 100 caracteres con `maxLength` de 300 y recorte silencioso en el servidor). Las dos claves de XPCTO que el chat descarta (`tiempo.fechaInicio`, `tiempo.hitos`) no se tocan hasta que exista un campo real para ellas. (`approve-motor` y `save-draft` salieron de esta lista en v4: corregidos, ver H17.)

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

## Agenda de rondas (orden acordado a 2026-10-08)

1. Commit 5 (propuesto): H25 #6, #1, #3 y #4.
2. Ronda de confirmación de impacto (H15), empezando por M8 (investigación y plan, sin implementar), con `generate-dvs` absorbido.
3. PESTEL a Moddulo (H16).
4. Grupo 2: trazabilidad (H01), aprobación con autoría y fecha (H03), antigüedad (H04), distinción IA/institucional (H05), versionado con `changelog.ts` (H06, H08), resolución geográfica (H07). Una ronda por principio.
5. Sefix (H26), ronda propia con helper común de lectura.
6. Documento de patrones reutilizables, con esta bitácora como insumo.

---

## Historial de versiones de esta bitácora

- **v1 (2026-10-02):** Creación inicial, con los hallazgos H01-H13 surgidos del cierre del Grupo 1 y la lista de pendientes de verificación.
- **v2 (2026-10-03):** Cierre formal del Grupo 1 (H09, H10, H11, H12, H13 confirmados como corregidos/mitigados, con el límite honesto de H11 documentado). Se incorpora la decisión de criterio sobre aprobación implícita vs. explícita, que reencuadra el alcance del Grupo 3 (H02) y precisa el alcance de H03 — el campo de aprobación con autoría solo aplica a los casos clasificados como "nodo de decisión", no a todo resultado generado por el sistema.
- **v3 (2026-10-07):** Cierre del Grupo 3 en lo textual y de H-M5. Nuevas entradas H14 a H19 (integridad del PATCH, categoría de confirmación de impacto, PESTEL a Moddulo sin aprobación, guardados optimistas, ausencia de lista de nodos en los documentos guía, rótulos que describen mal su acción) y nota metodológica sobre M28. H02 y H03 actualizados con el resultado de la clasificación.
- **v4 (2026-10-08):** Cierre de la serie de guardado honesto (commits 2, 3, 4a y 4b). H17 pasa a Corregido; H15 gana el caso `generate-dvs`; H03 anota que el cierre con autoría sigue en Grupo 2. Nuevas entradas H20 a H27 (cierre de fase, listas fallidas en los 3 hubs, escrituras del hub de PESTEL, contraste en oscuro, AuthContext, caminos hermanos, Sefix, `profile`/`suscripciones`) y sección de la regla común «la pantalla no afirma lo que el servidor no confirmó». Se limpia la lista de pendientes menores del Grupo 3 y se añade la agenda de rondas.
