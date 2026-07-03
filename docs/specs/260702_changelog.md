# Changelog — Sesión 2026-07-02

## Sesión 2026-07-02

### Cambios implementados

#### System prompt — `lib/ai/phases/prompts.ts`
- [prompts] Cambiado "9 FASES LINEALES" → "9 FASES CON FLUJO ITERATIVO Y MULTIDIRECCIONAL"
- [prompts] Añadido bloque ARQUITECTURA ITERATIVA explicando que el consultor puede regresar a cualquier fase
- [prompts] Añadido bloque ECOSISTEMA ESKEMMA con nomenclatura correcta (Centinela = módulo, App PESTEL = herramienta), las dos vías de análisis en F2, integración bidireccional F2↔PESTEL y comportamiento del asistente según la vía elegida
- [prompts] Añadida dimensión [Ec] ECOLÓGICO entre [T] y [L] en la estructura del formulario F2
- [prompts] Eliminado bloque obsoleto "PRIMERA INTERACCIÓN — PREGUNTA DE ARRANQUE OBLIGATORIA"

#### Territorio en Moddulo — tipos y creación de proyectos
- [types] `types/moddulo.types.ts`: importa y re-exporta `Territorio` y `NivelTerritorial` desde `pestel.types`; agrega campo `territorio?: Territorio` a `CreateProjectInput` y `ModduloProject`
- [project] `lib/moddulo/project.ts`: persiste `territorio` al crear un proyecto si viene en el input
- [api] `app/api/moddulo/projects/route.ts`: lee y valida `territorio` del body del POST

#### Wizard de creación Moddulo — 3 pasos con territorio
- [wizard] `app/moddulo/proyecto/nuevo/page.tsx`: reescrito para incluir paso 2 de territorio; usa `TerritorySelector` con label de Moddulo; paso 3 muestra confirmación con `territorio.nombre` y `territorio.nivel`

#### Componente compartido `TerritorySelector`
- [shared] `app/components/shared/TerritorySelector.tsx`: componente nuevo para captura de territorio; soporta selector de país (México con catálogo de estados, resto de Iberoamérica con texto libre); emite objeto `Territorio` completo; acepta prop `label` para diferenciar el contexto (Moddulo vs PESTEL)
- [pestel] `app/components/centinela/pestel/wizard/WizardStep2Territorio.tsx`: convertido en wrapper delgado sobre `TerritorySelector` con label "¿Cuál es el territorio de este análisis?"

#### F2 Exploración — territorio y pre-llenado PESTEL
- [f2] `app/moddulo/proyecto/[projectId]/exploracion/page.tsx`: reemplazados estados `projectNivel`/`projectPais` por `projectTerritory: Territorio | null`; `handleAbrirPESTEL` pasa nivel, estado, municipio y pais directamente desde el objeto territorio del proyecto
- [pestel] `app/centinela/pestel/nuevo/page.tsx`: lee parámetro `pais` de la URL; construye `territorioInicial` completo con separador ` › `; pre-llena wizard con datos del proyecto Moddulo

#### F2 Exploración — landing page
- [f2] `app/moddulo/proyecto/[projectId]/exploracion/page.tsx`: añadida `F2LandingView` con nombre/tipo/territorio del proyecto, descripción de los 5 motores (M1-M5), nota de editabilidad y CTA "Comenzar Fase 2"; se muestra solo en primera visita mediante flag `phases.exploracion.started`

#### F1 Propósito — landing page (recuperación)
- [f1] `app/moddulo/proyecto/[projectId]/proposito/page.tsx`: añadida `F1LandingView` con nombre/tipo/territorio del proyecto, descripción de la fase y las 5 variables XPCTO (X, P, C, T, O) con sus definiciones, nota sobre el formulario y CTA "Comenzar Fase 1"; se muestra solo en primera visita mediante flag `phases.proposito.started`; header, tabs y contenido ocultos durante la landing
- [api] `app/api/moddulo/projects/[projectId]/route.ts`: PATCH ahora maneja `phaseData.started: true` para guardar `phases.{phaseId}.started = true` en Firestore con verificación de acceso; evita sobreescribir datos existentes de la fase

#### F2 → PESTEL: transferencia automática de adjuntos
- [lib] `lib/moddulo/attachments.ts`: función `extractTextPerFile` compartida para extraer texto de adjuntos (PDF con pdf-parse + fallback Claude Vision, DOCX con mammoth, texto plano, imágenes con Claude Vision)
- [api] `app/api/moddulo/chat/[phaseId]/route.ts`: refactorizado para extraer texto por archivo una sola vez; guarda `textoExtraido` (hasta 4000 chars) junto con `nombre`, `url`, `tipo`, `cargadoEn` en `phases.exploracion.archivosAdjuntos`; usa `extractTextPerFile` desde la lib compartida
- [api] `app/api/centinela/pestel/project/[projectId]/import-moddulo-attachments/route.ts`: endpoint nuevo POST que lee `archivosAdjuntos` del proyecto Moddulo vinculado, usa `textoExtraido` si existe o re-extrae desde Storage, clasifica todos los documentos en una sola llamada a Claude (P/E/S/T/Ec/L), crea un `pestel_data_sources` por adjunto con fuente `"F2 Moddulo — {nombre}"` y marca `modduloAttachmentsImported: true`
- [pestel] `app/centinela/pestel/[projectId]/datos/page.tsx`: auto-dispara importación al cargar si `modduloProjectId` presente y `modduloAttachmentsImported !== true`; muestra spinner "Importando…" y confirmación "✓ N documentos importados" con recarga del semáforo de cobertura

---

### Decisiones tomadas

- **Territorio se captura al crear el proyecto Moddulo, no en F1.** El nombre, color, tipo y territorio son metadatos del proyecto, no variables de fase. Garantiza coherencia con PESTEL que usa la misma estructura `Territorio`.
- **`TerritorySelector` como componente compartido, no wizard completo compartido.** Moddulo y PESTEL tienen flujos de creación distintos; solo el selector de territorio es reutilizable. Evita acoplamiento excesivo.
- **México con catálogo de estados (dropdown), resto de Iberoamérica con texto libre.** El catálogo de estados solo tiene valor operativo para México (datos Sefix, scrapers de noticias por estado). Para otros países, texto libre es más flexible y mantenible.
- **Extracción de texto una sola vez por mensaje de chat.** Antes se extraía solo para el chat. Ahora se extrae una vez y se usa tanto para el mensaje como para persistencia en Firestore, evitando doble llamada a Claude Vision para PDFs de imagen.
- **Clasificación PESTEL con una sola llamada a Claude.** En lugar de N llamadas (una por documento), se clasifican todos los documentos en una sola llamada con JSON estructurado. Más eficiente y económico.
- **`modduloAttachmentsImported` como flag en el proyecto PESTEL.** Evita re-importar en cada visita a la página de datos. La importación es idempotente y se ejecuta una sola vez.
- **Landing pages solo en primera visita; retorno directo al último estado.** El flag `started` en Firestore determina si es la primera visita. Fases completadas van directo al reporte. Consistente entre F1 y F2.

---

### Pendientes

- **PESTEL C1 — StepIndicator en el Wizard.** `nuevo/page.tsx` no muestra `PESTELStageNav`. Se planificó añadirlo con indicador de sub-paso (1/3, 2/3, 3/3) pero quedó fuera del alcance de la sesión.
- **PESTEL C4 — Bug Scorecard global = 0.** `buildScorecard()` en `lib/pestel/matrizUtils.ts` calcula score 0. Requiere revisar la fórmula `score_dim = (confianza_dim / 100) × suma_pesos_variables_dim`.
- **PESTEL C5.2 — Estimación de costo en tokens (E8 Monitoreo).** Mostrar `~N tokens/mes al intervalo de X horas` antes de activar monitoreo automático. No iniciado.
- **PESTEL C7 — Persistencia estructurada de informes en Firestore.** Al generar informe, hacer `arrayUnion` en `pestel_analyses.{id}.informes` con el objeto estructurado. No iniciado.
- **PESTEL C9 — Auditoría de emojis en botones PESTEL.** Sustituir emojis por íconos `lucide-react` o eliminar si son decorativos. Identificado pero no ejecutado.
- **F2 A4 — Sefix dual-level en dimensión P.** Mostrar datos primarios (municipal/estatal según tipo de proyecto) y nivel de contraste. No iniciado.
- **Integración F2 → Moddulo F3.** Los resultados de F2 (DVS, MapaPESTEL) deben alimentar automáticamente el Programa de Investigación Profunda de F3. No planificado aún para esta sesión.
- **Adjuntos anteriores al cambio.** Proyectos creados antes de esta sesión tienen `archivosAdjuntos` sin `textoExtraido`. El endpoint de importación los maneja re-extrayendo desde Storage, pero si la URL expiró o el archivo fue eliminado, se usará solo el nombre como contenido.
