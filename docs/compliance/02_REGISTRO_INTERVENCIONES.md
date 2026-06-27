# 02_REGISTRO_INTERVENCIONES.md | Eskemma
## Registro de Intervención Humana para INDAUTOR

**Fecha de creación:** 2026-04-10  
**Autor:** Raúl Sánchez Salgado  
**Versión:** 1.0

---

> **Nota metodológica:** Este documento registra la intervención humana de Raúl
> Sánchez Salgado en el diseño, supervisión y corrección del sistema Eskemma.
> La IA (Claude Code) fue utilizada como herramienta de codificación asistida.
> Todas las decisiones de arquitectura, metodología y producto son de autoría humana.

---

## Decisiones Generales del Proyecto

### DG-01: Elección de Monorepo con Next.js App Router

**Quién:** Raúl Sánchez Salgado  
**Fecha:** Inicio del proyecto (~2024)  
**Prompt/instrucción:** Raúl especificó la estructura del proyecto como un único
monorepo Next.js con módulos separados como rutas, en lugar de múltiples proyectos.  
**Intervención humana:** Raúl revisó la estructura de carpetas generada y ajustó
la organización para mantener coherencia entre `app/`, `lib/`, `types/` y `components/`.  
**Resultado:** Estructura unificada en `/eskemma/` con un único `package.json`.

---

### DG-02: Diseño del Sistema de Autenticación

**Quién:** Raúl Sánchez Salgado  
**Fecha:** Sprint inicial de autenticación  
**Prompt/instrucción:** Raúl diseñó el flujo de autenticación con cookies HTTP-only
y especificó que no se almacenara ningún token en localStorage.  
**Intervención humana:** Raúl identificó una vulnerabilidad inicial donde el token
JWT se almacenaba en memoria del cliente y lo corrigió migrando a session cookies.
Raúl también definió la regla de no modificar el flujo sin revisar todas las dependencias.  
**Corrección documentada:** Migración de JWT cliente → session cookie HTTP-only.  
**Archivos resultantes:** `lib/session.ts`, `lib/session-config.ts`,
`lib/server/auth-helpers.ts`, `context/AuthContext.tsx`.

---

### DG-03: Diseño del Sistema de Colores y Tipografía

**Quién:** Raúl Sánchez Salgado  
**Fecha:** Sprint de diseño de sistema visual  
**Prompt/instrucción:** Raúl definió la paleta completa de colores (9 tokens con escala
-10 a -90) y la tipografía (Arimo, PT Sans, Philosopher) como parte del brand de Eskemma.  
**Intervención humana:** Raúl revisó las implementaciones de Tailwind CSS y corrigió
usos de colores genéricos (`blue-500`, `gray-300`) reemplazándolos con tokens del
design system. Estableció la regla: "nunca usar colores genéricos de Tailwind en
componentes nuevos".  
**Archivos resultantes:** `app/globals.css` (directiva `@theme`).

---

### DG-04: Integración de Claude Sonnet 4.6

**Quién:** Raúl Sánchez Salgado  
**Fecha:** Sprint de integración IA (~2024-2025)  
**Prompt/instrucción:** Raúl seleccionó Claude Sonnet 4.6 (Anthropic) sobre otros
modelos después de evaluar desempeño en análisis político en español.  
**Intervención humana:** Raúl diseñó los prompts base para PESTEL (PEST-L) y para
el chat de Moddulo. Raúl supervisó los outputs y ajustó los prompts para mejorar la
precisión metodológica. Raúl decidió separar la detección de sesgos como proceso
determinístico (sin IA) para garantizar reproducibilidad.  
**Archivos resultantes:** `lib/ai/claude.ts`, `functions/src/pestel/classifier/claudePESTL.ts`.

---

### DG-05: Arquitectura de Seguridad en API Routes

**Quién:** Raúl Sánchez Salgado  
**Fecha:** Auditoría de seguridad post-lanzamiento beta  
**Prompt/instrucción:** Raúl estableció las 5 reglas de oro de seguridad como
no negociables para todos los API routes.  
**Intervención humana:** Raúl realizó una revisión de seguridad y encontró que varios
API routes no verificaban la sesión del usuario antes de retornar datos. Raúl corrigió
cada route afectado y estableció la regla de usar `getSessionFromRequest()` en todos
los API routes sin excepción.  
**Corrección documentada:** Adición de verificación de sesión en ~39 API routes.

---

### DG-06: Política de Accesibilidad WCAG AA

**Quién:** Raúl Sánchez Salgado  
**Fecha:** Sprint de accesibilidad  
**Prompt/instrucción:** Raúl estableció WCAG AA como requisito no negociable,
especificando exactamente los criterios a cumplir.  
**Intervención humana:** Raúl auditó los componentes existentes e identificó falta
de `aria-label` en botones de ícono, ausencia de `htmlFor` en varios inputs, y
focus rings incorrectos (`focus:` en lugar de `focus-visible:`). Raúl corrigió
los componentes afectados y creó los hooks `useFocusTrap` y `useEscapeKey`.  
**Archivos resultantes:** `app/hooks/useFocusTrap.ts`, `app/hooks/useEscapeKey.ts`.

---

### DG-07: Separación de Cloud Functions para PESTEL

**Quién:** Raúl Sánchez Salgado  
**Fecha:** Sprint de arquitectura PESTEL (~2025)  
**Prompt/instrucción:** Raúl identificó que el análisis PEST-L requería más tiempo
del permitido por Vercel y diseñó la arquitectura fire-and-forget con polling.  
**Intervención humana:** Raúl decidió mover el procesamiento pesado de IA a Cloud
Functions Gen2, separando el build de funciones del proyecto principal Next.js.
Estableció la regla de ESLint Google style guide obligatorio para las funciones.  
**Corrección documentada:** Migración de procesamiento síncroono en API route →
Cloud Function asíncrona con polling desde el cliente.  
**Archivos resultantes:** `functions/` (build separado con su propio `package.json`).

---

### DG-08: Pre-Generación Offline de Datos SEFIX

**Quién:** Raúl Sánchez Salgado  
**Fecha:** 2026-04-10  
**Prompt/instrucción:** Raúl identificó que las consultas históricas por entidad
tardaban 5-15 minutos porque el sistema leía ~100 archivos CSV de Firebase Storage
en tiempo de consulta. Raúl diseñó la arquitectura de pre-generación offline.  
**Intervención humana:** Raúl diagnosticó la causa raíz (lectura lazy de CSVs en
Vercel serverless), diseñó la solución (script local + JSON columnar pre-generado
por entidad), especificó el formato de datos y supervisó la implementación.  
**Corrección documentada:** Eliminación del sistema lazy-building (que tardaba 15+ min)
→ script offline `scripts/pregenerate-sefix.ts` que genera JSONs por entidad/año
en ~500-800ms de consulta.  
**Archivos resultantes:** `scripts/pregenerate-sefix.ts`, refactorización de
`lib/sefix/storage.ts`, simplificación de `app/api/sefix/historico-geo/route.ts`.

---

## Registro por Módulo

### Módulo: Moddulo

#### MOD-01: Diseño de las 9 Fases Secuenciales

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl diseñó la metodología de las 9 fases basada en su experiencia
como consultor político. Las fases son: propósito, exploración, investigación,
diagnóstico, estrategia, táctica, gerencia, seguimiento y evaluación.  
**Intervención:** Raúl especificó el objetivo de cada fase y el tipo de asistencia
que debía ofrecer la IA en cada una. Supervisó que los prompts de Claude respetaran
la metodología sin desviarse hacia respuestas genéricas.  
**Resultado:** Sistema de chat por fase con contexto acumulado en Firestore.

#### MOD-02: Integración de Streaming SSE

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl requirió que el chat mostrara los tokens de Claude en tiempo real
(streaming) en lugar de esperar la respuesta completa.  
**Intervención:** Raúl identificó que la implementación inicial del streaming no
manejaba correctamente el cierre del stream en errores de red. Raúl corrigió
el manejo de errores y el cierre del ReadableStream.  
**Archivos:** `app/api/moddulo/chat/[phaseId]/route.ts`.

#### MOD-03: Integración PESTEL → Moddulo (F2)

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl diseñó que la fase de Exploración (F2) de Moddulo consuma
datos de PESTEL para generar el análisis PEST-L del territorio del proyecto.  
**Estado:** ⏳ Pendiente de implementación.

---

### Módulo: PESTEL

#### CEN-01: Metodología PEST-L Adaptada a Política Mexicana

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl adaptó la metodología PEST-L estándar al contexto político mexicano,
añadiendo la dimensión Legal con énfasis en LGIPE, INE y legislación electoral.  
**Intervención:** Raúl revisó las 9 especificaciones funcionales en `_docs/specs/pestel/`
y las actualizó para reflejar las particularidades del sistema político mexicano
(procesos electorales, instituciones, calendario político).  
**Archivos:** `_docs/specs/pestel/` (9 archivos de spec).

#### CEN-02: Human-in-the-Loop Obligatorio

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl estableció que ningún output de IA en PESTEL es definitivo
sin validación explícita del usuario. Esta regla es metodológicamente no negociable.  
**Intervención:** Raúl rechazó una propuesta inicial donde los factores PEST-L podían
reclasificarse automáticamente. Raúl especificó que la reclasificación debe requerir
acción explícita del analista en la interfaz.  
**Impacto:** Diseño de E6 (pendiente) debe incluir matriz drag-drop con confirmación
explícita antes de guardar cambios.

#### CEN-03: Detección de Sesgos Determinística

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl decidió que la detección de sesgos (sesgo urbano, etario digital,
sobrerepresentación de fuentes digitales, contradicciones datos oficiales/percepción)
sea un proceso determinístico — no IA.  
**Intervención:** Raúl rechazó la propuesta de usar Claude para detectar sesgos
por falta de reproducibilidad. Raúl especificó los 4 tipos de sesgo a detectar
y las condiciones exactas que los activan.  
**Archivos:** `functions/src/pestel/risk/vectorCalculator.ts`.

#### CEN-04: Semáforo de Cobertura de Datos

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl diseñó el semáforo verde/amarillo/rojo por dimensión PEST-L
como indicador visible y bloqueador de avance cuando hay dimensión en rojo.  
**Intervención:** Raúl identificó que el semáforo mostraba texto blanco sobre fondo
amarillo (baja accesibilidad). Raúl corrigió el componente para usar texto negro
en el estado amarillo.  
**Archivos:** Componente de semáforo en `app/centinela/pestel/`.

#### CEN-05: Arquitectura de Análisis Paralelo

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl diseñó las 6 llamadas paralelas a Claude (5 dimensiones PEST-L
+ 1 cadenas de impacto) como `Promise.allSettled` para tolerancia a fallos parciales.  
**Intervención:** Raúl especificó que si una dimensión falla, las demás deben
seguir procesándose y el resultado debe marcarse como parcial (no cancelarse).  
**Archivos:** `functions/src/pestel/generateFeed.ts`.

---

### Módulo: SEFIX

#### SEF-01: Diseño del Dashboard Electoral

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl diseñó el dashboard como una herramienta de análisis del padrón
electoral y lista nominal con filtros geográficos (nacional → estatal → distrital
→ municipal → sección electoral).  
**Intervención:** Raúl especificó las 3 gráficas principales (G1: proyección anual,
G2: evolución histórica, G3: desglose por sexo) y los tipos de visualización
(LineChart para G1 y G2, con datos No Binario como card flotante en G3).

#### SEF-02: Rediseño de Arquitectura de Carga de Datos

**Quién:** Raúl Sánchez Salgado  
**Fecha:** 2026-04-10  
**Problema identificado:** Raúl detectó que las consultas históricas por entidad
tardaban 5-15 minutos (Estado de México: nunca terminaba) porque el sistema
leía 195 archivos CSV de Firebase Storage en tiempo de consulta.  
**Solución diseñada:** Raúl diseñó la arquitectura de pre-generación offline:
un script local lee todos los CSVs, los agrega a nivel sección electoral,
y genera archivos JSON columnar (uno por entidad+año) en Firebase Storage.  
**Intervención:** Raúl especificó el formato columnar exacto para minimizar tamaño
de archivo y maximizar velocidad de consulta. Supervisó la refactorización completa
de `storage.ts`, la eliminación del sistema de polling 202, y la creación del
script `scripts/pregenerate-sefix.ts`.  
**Resultado:** Consultas pasaron de 5-15 min → 500-800ms.

#### SEF-03: Manejo de Evolución de Columnas CSV

**Quién:** Raúl Sánchez Salgado  
**Problema identificado:** Los CSVs del INE cambiaron de esquema 3 veces entre
2017 y 2025 (13 → 21 → 23 columnas), rompiendo el procesamiento de datos históricos.  
**Solución:** Raúl especificó que el script de pre-generación debe manejar los 3
esquemas por nombre de columna (no por posición), llenando con 0 los campos
ausentes en esquemas anteriores.  
**Archivos:** `scripts/pregenerate-sefix.ts`.

---

### Módulo: Cursos

#### CUR-01: Estructura de Talleres Interactivos

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl diseñó la estructura de cursos como talleres modulares con
seguimiento de progreso por usuario almacenado en Firestore (`users` colección).  
**Estado:** Activo. Documentación de módulo pendiente de expansión.

---

### Módulo: Blog (El Baúl de Fouché)

#### BLO-01: Sistema de Contenido Editorial

**Quién:** Raúl Sánchez Salgado  
**Decisión:** Raúl nombró el blog "El Baúl de Fouché" como referencia a Joseph Fouché,
ministro de policía y estratega político del período napoleónico — en línea con el
enfoque de inteligencia política de la plataforma.  
**Intervención:** Raúl eligió Philosopher como tipografía del blog para diferenciarlo
visualmente del resto de la plataforma y darle personalidad editorial propia.

---

## Registro de Curaduría (Bugs Corregidos)

| ID | Módulo | Problema | Solución | Responsable | Fecha |
|----|--------|----------|----------|-------------|-------|
| CUR-01 | Auth | JWT en memoria cliente → riesgo XSS | Migración a session cookie HTTP-only | Raúl | 2024-2025 |
| CUR-02 | PESTEL | Semáforo amarillo con texto blanco (baja accesibilidad) | Texto negro en estado amarillo | Raúl | 26-03-28 |
| CUR-03 | API routes | Falta de verificación de sesión en ~39 routes | Adición de `getSessionFromRequest()` | Raúl | 2025 |
| CUR-04 | SEFIX | Carga histórica geo: 5-15 minutos (timeout) | Pre-generación offline + JSON columnar | Raúl | 2026-04-10 |
| CUR-05 | SEFIX | Punto puente duplicado en G1 (proyección) | Eliminación del bridge point del dataset | Raúl | 2026-04 |
| CUR-06 | SEFIX | NB card mostraba datos nacionales ignorando filtro geo | Endpoint `semanal-nb` con filtro geo | Raúl | 2026-04 |
| CUR-07 | Cloud Functions | Deploy fallaba por estilo de código (ESLint Google) | Configuración de ESLint Google style guide | Raúl | 2025 |

---

*Documento generado bajo supervisión de Raúl Sánchez Salgado — 2026-04-10*
