# CLAUDE.md — Eskemma

Contexto e instrucciones para el desarrollo del proyecto.
**Actualizar al cerrar cada sprint.**

---

## Protocolo de Fuentes Externas (IDs de Series/Indicadores)

**Aplica a toda integración con APIs externas: INEGI, Banxico, y cualquier
fuente que se agregue en desarrollos futuros (Fase 3 - Investigación, etc.)**

Antes del primer uso en producción de cualquier ID de serie o indicador externo:

1. **Verificar con llamada real** al endpoint de metadatos de la API.
2. **Documentar en el código** (comentario junto a la constante):
   - Fecha de verificación
   - Campo y valor exacto que confirma la identidad (texto literal de la respuesta)
   - Nunca solo el label inferido — siempre la evidencia de la API

Formato de comentario obligatorio:
```ts
// Verificado YYYY-MM-DD vía GET <endpoint-metadatos>
// ID_SERIE → campo:"valor literal de la API"  →  descripción legible
```

**Nunca asumir un ID por inferencia, plausibilidad o documentación de
terceros sin confirmar contra la API real.** Si el token no está disponible
en local, dejar el ID marcado con `⚠️ PENDIENTE DE VERIFICACIÓN` y la
fecha, en vez de asumir.

Referencia de implementación: `lib/centinela/pestel/scraper/banxico.ts`
(verificado 2026-07-08).

**Para cualquier fuente nueva que cruce datos por territorio municipal
(`CVE_MUN`)**: consultar obligatoriamente
`docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md` antes de
decidir el mecanismo de join — dos catálogos "oficiales INEGI" pueden tener
numeraciones de municipio distintas sin ningún aviso (incidente real
2026-08-23, Fontana F1/F2). Nunca asumir compatibilidad de CVE_MUN entre
catálogos sin verificarlo con una muestra real.

---

## Idioma y Commits

- Responder siempre en **español**
- Código y comentarios técnicos en **inglés**
- Formato de commits obligatorio: `YY-MM-DD. <descripción>`
  - Ejemplo: `26-03-27. feat(pestel): refactorizar trigger a fire-and-forget`

---

## Qué es Eskemma

Plataforma SaaS de consultoría política con IA, orientada a consultores,
equipos de campaña y funcionarios públicos en México.

| Ruta | Módulo | Estado |
|------|--------|--------|
| `/moddulo` | Moddulo — gestión de proyectos políticos con IA (9 fases) | Activo |
| `/centinela/pestel` | PESTEL — análisis PEST-L en tiempo real | En desarrollo |
| `/cursos` | Talleres y cursos interactivos | Activo |
| `/sefix` | Dashboard electoral (Shiny embebido) | Activo |
| `/blog` | El Baúl de Fouché | Activo |

---

## Stack Técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js App Router | 16.x |
| UI | React | 19.x |
| Lenguaje | TypeScript strict | 5.x |
| Estilos | Tailwind CSS con `@theme` | 4.1.5 |
| Auth | Firebase Auth + session cookies HTTP-only | — |
| Base de datos | Firestore | — |
| Storage | Firebase Cloud Storage | — |
| Cloud Functions | Node.js Gen2 | 22 |
| AI | Anthropic Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Email | Resend + Nodemailer | — |
| Despliegue frontend | Vercel | — |
| Despliegue functions | Google Cloud (Firebase) | — |

**No existe app móvil nativa.** La versión móvil es responsive web con
breakpoints Tailwind (`sm:`, `lg:`).

---

## Autenticación

Flujo de sesión — no modificar sin revisar todas las dependencias:

```
Firebase signIn (cliente)
  → getIdToken()
  → POST /api/auth/session { idToken }
  → Firebase Admin crea session cookie (HTTP-only, Secure, SameSite:lax, 5 días)
```

| Archivo | Propósito |
|---------|-----------|
| `lib/session.ts` | createSession, getSession, deleteSession |
| `lib/session-config.ts` | SESSION_CONFIG centralizado |
| `lib/server/auth-helpers.ts` | `getSessionFromRequest()` — para API routes |
| `lib/server/session.server.ts` | `getServerSession()` — para Server Components |
| `context/AuthContext.tsx` | hook `useAuth()` en el cliente |

- En **API routes**: siempre `getSessionFromRequest(request)`
- En **Server Components**: siempre `getServerSession()`

---

## Estilos y Design System

### Colores custom (`@theme` en `globals.css`)

| Token | Propósito |
|-------|-----------|
| `blue-eske` | Primario, links |
| `orange-eske` | Secundario, CTAs |
| `bluegreen-eske` | Headers de sección, navegación |
| `white-eske` | Fondos |
| `gray-eske` | Bordes, texto deshabilitado |
| `black-eske` | Texto principal |
| `yellow-eske` | Warnings |
| `green-eske` | Success |
| `red-eske` | Errores |

Cada color tiene escala: `-10` `-20` `-30` `-40` `-60` `-70` `-80` `-90`.

**Regla**: usar siempre colores del design system. No usar colores genéricos
de Tailwind (`blue-500`, `gray-300`) en componentes nuevos.

### Tipografía
- **Arimo** — body y títulos generales
- **PT Sans** — captions y texto pequeño
- **Philosopher** — títulos en el blog

### Flex + `truncate`: regla Safari

`truncate` requiere `min-w-0` en el elemento mismo (o en su flex/grid parent directo)
cuando está dentro de un flex o grid container. Sin él, Safari desborda el texto;
Chromium lo oculta casualmente.
- Alternativa válida: `max-w-*` en el elemento con `truncate`.
- Contexto bloque (elemento dentro de `block` o `block-link`): `min-w-0` no aplica;
  el ancho de bloque ya constrae el elemento. No se necesita `min-w-0`.

---

## Nomenclatura de Distritos Electorales (convención de UI compartida)

**Estándar obligatorio para TODA la UI del ecosistema** (Sefix, Fontana, Moddulo/TerritorySelector,
y cualquier app futura del catálogo MMEE que muestre distritos electorales):

`{prefijo D.F./D.L.} {cve_estado, 2 dígitos}{cve_distrito, 2 dígitos} {CABECERA en mayúsculas}`

Ejemplos: `D.F. 1405 PUERTO VALLARTA` (Jalisco, distrito federal 05), `D.L. 0927 IZTAPALAPA` (CDMX,
distrito local 27).

**Por qué**: el número de distrito solo (ej. "Distrito 05") es ambiguo — existe un distrito 05 en
cada estado, y un mismo municipio puede ser cabecera de varios distritos (ej. Guadalajara e
Iztapalapa aparecen 3 veces cada uno en su estado). La cve de 4 dígitos (estado+distrito) es
autosuficiente, no depende de contexto externo (encabezado de columna, estado ya seleccionado en otro
control) para ser inequívoca.

**Implementación de referencia**: `lib/geo/formatDistrito.ts` (`formatDistritoLabel()`) — función
compartida, sin dependencias server-only, importable tanto desde componentes cliente
(`TerritorySelector.tsx`) como desde adaptadores server-side (`lib/fontana/ingesta/eceg.ts`). Origen:
proyecto real `nZvpYu4nnZrsw5hoGcVP` (Iztapalapa) expuso la ambigüedad — 26-08-15/16.

**No confundir con** `GeoOptionDistrito.nombre` (`lib/geo/distritos.ts`, formato legado
`"D.F. 001 – JUAREZ"`, sin cve de estado) — ese campo NO cambia de forma porque Sefix lo parsea con
`split("–")`; el formato nuevo se construye al CONSUMIR ese campo vía `formatDistritoLabel()`, nunca
en la fuente compartida.

---

## SEO — Estándar de Construcción (Vertiente B)

**Aplica a toda `page.tsx` y componente nuevo o modificado.**
Spec completo: `docs/specs/seo-tecnico.md`

### Workflow obligatorio

Antes de escribir o modificar cualquier código para una página o componente:

1. Leer `docs/specs/seo-tecnico.md` (o la sección relevante si ya se leyó en la sesión).
2. Identificar qué secciones aplican a esa pieza concreta.
3. Aplicar la **Vertiente B** desde el primer borrador — no como ajuste posterior.
4. **Antes de entregar el código final**, declarar en lista breve qué secciones se aplicaron y cómo.

### Qué sección aplica a qué tipo de pieza

| Sección | Aplica a |
|---------|---------|
| 1.3 meta robots | Toda `page.tsx` — declarar política de indexación explícita |
| 1.7 canonical | Páginas filtrables, paginadas o con variantes de URL |
| 1.8 `notFound()` | Flujos donde el usuario puede llegar a contenido inexistente |
| 2.3 breadcrumbs | Páginas dentro de jerarquías (`/blog/`, `/moddulo/`, `/cursos/`) |
| 2.5 semántica HTML | Todo componente con contenido textual — etiquetas H1-H6 reales |
| 3.1 title | Toda `page.tsx` — único por página, keyword cerca del inicio |
| 3.2 description | Páginas de alto valor — manual; nunca genérica repetida |
| 3.4 H1 | Exactamente un `<h1>` por `page.tsx`; ningún componente reutilizable incluye su propio H1 |
| 3.6 alt text | Todo `<Image>` — descriptivo y específico |
| 4.1-4.2 rendimiento | Evaluar ISR / SSG vs SSR por tipo de contenido |
| 5.1 Server Components | Contenido de la página como Server Component por defecto |
| 5.3 `<Link>` | Navegación interna con `<Link>`, nunca `<button onClick={router.push}>` |
| 6.1 schema | Artículos (BlogPosting), listas (Blog), FAQ, Organization, Breadcrumb |
| 7.2 Open Graph | Toda `page.tsx` — `openGraph` con `images` (1200×630) y bloque `twitter` |

### Metadata mínima para toda `page.tsx`

```tsx
export const metadata: Metadata = {
  title: "Título único con keyword — Eskemma",
  description: "Descripción manual en páginas de alto valor",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/ruta` },
  openGraph: {
    title: "...", description: "...",
    url: `${SITE_URL}/ruta`, siteName: "Eskemma",
    locale: "es_MX", type: "website",
    images: [{ url: "...", width: 1200, height: 630, alt: "..." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "...", description: "...", images: ["..."],
  },
};
```

**Imagen OG placeholder:** `${SITE_URL}/images/blog-hero.jpg` (1200×630, existe en `public/images/`)
hasta que haya imagen OG corporativa diseñada.

---

## Accesibilidad (WCAG AA — no negociable)

- `aria-hidden="true"` en íconos decorativos
- `aria-label` en botones de solo ícono
- `htmlFor` asociado a todos los inputs
- Focus rings con `focus-visible:` (no `focus:`)
- Modales: hook `useFocusTrap` (`app/hooks/useFocusTrap.ts`)
- Escape en modales/dropdowns: hook `useEscapeKey` (`app/hooks/useEscapeKey.ts`)
- Animaciones: respetar `prefers-reduced-motion`

---

## Estructura del Proyecto

```
/
├── app/
│   ├── api/                          # 39 API route handlers
│   │   ├── auth/session/             # POST/DELETE/GET sesiones
│   │   ├── moddulo/                  # CRUD proyectos + chat SSE
│   │   └── centinela/pestel/        # config, feed, trigger, status
│   ├── components/
│   │   ├── centinela/pestel/dashboard/  # RiskVectorWidget, PESTLPanel
│   │   └── moddulo/
│   ├── centinela/pestel/
│   │   ├── page.tsx                  # Hub (lista de análisis)
│   │   └── analisis/[id]/page.tsx    # Vista individual PEST-L
│   └── moddulo/proyecto/[projectId]/[phaseId]/
├── lib/
│   ├── ai/claude.ts                  # Instancia Anthropic
│   ├── server/                       # Utilidades solo servidor
│   └── centinela/pestel/            # Lógica PESTEL
├── types/
│   ├── pestel.types.ts
│   ├── moddulo.types.ts
│   ├── firestore.types.ts
│   ├── session.types.ts
│   └── subscription.types.ts
├── context/AuthContext.tsx
├── functions/src/pestel/          # Cloud Functions (build separado)
│   ├── scrapeAndAnalyze.ts           # HTTP CF principal
│   ├── scheduledMonitor.ts           # Cron cada 6 horas
│   ├── generateFeed.ts               # Orquestador PEST-L
│   ├── classifier/claudePESTL.ts     # Clasificación con Claude
│   ├── risk/vectorCalculator.ts      # Cálculo determinístico
│   └── scrapers/                     # googleNewsRSS, dof, inegi, banxico
├── firestore.rules
├── storage.rules
└── firebase.json
```

---

## Cloud Functions — Reglas de Desarrollo

Las functions tienen su propio `package.json` y `tsconfig.json` en
`functions/`. **No pueden importar desde `lib/` del proyecto raíz.**

### Lógica duplicada: puntos de sincronización manual obligatorios

Cuando se modifique cualquiera de estos archivos, actualizar AMBAS copias simultáneamente:

| Lógica | Next.js | Cloud Function |
|--------|---------|---------------|
| Google News RSS scraper + tabla de locales por país | `lib/centinela/pestel/scraper/googleNewsRSS.ts` | `functions/src/pestel/scrapers/googleNewsRSS.ts` |
| Gate de país `isMexico()` | `lib/centinela/pestel/utils/country.ts` | `functions/src/utils/country.ts` |
| Pesos del escaneo PESTEL por tipo de proyecto (dimensiones prioritarias/seguimiento) | `lib/moddulo/dimensionPriority.ts` | `functions/src/pestel/dimensionPriority.ts` |

**Checklist obligatorio al sincronizar instrucciones de PROMPT (no solo tablas/funciones)
entre el path express (una sola llamada a Claude cubre las 6 dimensiones) y el path
Centinela (una llamada por dimensión, vía `buildDimensionPrompt`):**

No basta con igualar el texto por rama/dimensión. Antes de dar por cerrada la
sincronización, verificar explícitamente si la instrucción que se está portando
dependía, en el path de una-sola-llamada, de un bloque **global/implícito** que
aplica a las 6 dimensiones a la vez (ej. una sección única de "reglas de campo"
al final del prompt) — ese bloque **no tiene equivalente natural** en el path
por-dimensión de Centinela, donde cada llamada solo conoce su propia dimensión.
Si la instrucción incluye un caso negativo o una excepción ("no aplica cuando...",
"deja este campo en false salvo que...", "omite esto para el resto de los casos"),
esa regla debe reescribirse explícitamente **dentro de cada rama relevante** del
prompt por-dimensión, no asumirse heredada de un bloque global que allí no existe.

Precedente: el campo auditable `escaladaPorRelevanciaLocal` (M1, pesos por tipo
de proyecto) se implementó primero en express con la regla negativa en un bloque
global de reglas de campo aplicable a las 6 dimensiones; al portar el mismo
criterio a `claudePESTL.ts` (Centinela, prompt por dimensión) esa regla negativa
no tenía dónde vivir y se perdió — resultado: una dimensión ya prioritaria podía
marcarse incorrectamente como "escalada por relevancia local", detectado recién
en verificación en vivo (26-07-19). Mismo tipo de punto ciego que el header
combinado INEGI/Banxico y el sesgo hacia datos numéricos del contexto Legal de
Colombia: una suposición válida en la forma de datos/granularidad de un path deja
de sostenerse al portarla al otro sin re-derivarla explícitamente.

### ESLint Google style guide (obligatorio para deploy)

- Comillas **dobles** `"` (no simples)
- Indentación **2 espacios**
- Líneas máximo **80 caracteres**
- Operadores ternarios `?` y `:` al **final** de la línea
- JSDoc con `@param` y `@return` en todas las funciones exportadas
- Sin espacios dentro de `{}` en imports: `import {foo} from "bar"`

### Workflow de deploy

```bash
cd functions && npm install       # Siempre antes si cambió package.json
firebase deploy --only functions
```

### Secrets (Firebase Secret Manager, no `.env`)

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set INEGI_TOKEN
firebase functions:secrets:set BANXICO_TOKEN
```

---

## Firestore — Colecciones

| Colección | Propósito |
|-----------|-----------|
| `users` | Perfiles, roles, suscripciones, progreso talleres |
| `posts` | Blog — subcollection: `comments` |
| `moddulo_projects` | Proyectos Moddulo con historial de chat por fase |
| `moddulo_redactor_projects` | Proyectos del Redactor |
| `moddulo_redactor_generations` | Historial de generaciones |
| `pestel_configs` | Configuraciones legacy (V1) — solo lectura |
| `pestel_feeds` | Resultados PEST-L V1 legacy (`vigente: true/false`) |
| `pestel_projects` | Proyectos V2 con tipo, nombre, horizonte, etapa |
| `pestel_variable_configs` | Config variables PEST-L por proyecto (E3) |
| `pestel_analyses` | Resultados PEST-L V2 (`PestlAnalysisV2`) |
| `pestel_data_sources` | Datos manuales cargados en E4 |
| `pestel_jobs` | Estado de jobs (`pending/running/completed/failed`) |
| `pestel_raw_articles` | Artículos crudos del scraper |
| `pestel_alerts` | Alertas por umbral de riesgo |
| `fontana_sesiones` | Sesiones de Fontana (T10) — selección de indicadores por familia, `canvasItems[]`. Subcolecciones append-only: `mensajes` (chat del agente), `adjuntos` (texto extraído de archivos del usuario — nunca el binario; purga a 90 días) |
| `notifications` | Notificaciones in-app |
| `newsletter_subscribers` | Suscriptores |
| `resources` | Recursos descargables |

**Regla**: queries con `where` + `orderBy` requieren índice compuesto en
Firestore. Si no existe, la query falla silenciosamente. Preferir ordenar
en memoria cuando el volumen es pequeño (< 100 docs por usuario).

---

## PESTEL — Arquitectura y Estado

### Flujo completo V2 (activo)

```
Wizard E1-E3: usuario crea pestel_projects + pestel_variable_configs
  ↓
E4 /datos: agrega fuentes manuales → semáforo cobertura
  → POST /api/centinela/pestel/project/[id]/data-source
  → GET  /api/centinela/pestel/project/[id]/coverage
  ↓
Botón "Ejecutar análisis IA" (habilitado solo si ningún 🔴 en semáforo)
  → POST /api/centinela/pestel/trigger { projectId }
  → Pre-crea job (status: "pending") en pestel_jobs
  → Llama scrapeAndAnalyze CF sin esperar (fire-and-forget)
  → Retorna { jobId } inmediatamente
  ↓
Frontend polling a /api/centinela/pestel/status?jobId=
  ↓
Cloud Function scrapeAndAnalyze (V2 path):
  → Ejecuta 4 scrapers en paralelo (Promise.allSettled)
  → Guarda artículos crudos en pestel_raw_articles
  → Llama generateAnalysisV2:
      → 5 llamadas paralelas a Claude (una por dimensión P/E/S/T/L)
      → 1 llamada adicional para cadenas de impacto
      → Detección de sesgos determinística (sin Claude)
      → Calcula globalConfidence ponderado
      → Guarda pestel_analyses (PestlAnalysisV2)
  → Actualiza job (status: "completed", analysisId)
  ↓
Frontend detecta "completed" → carga análisis → muestra E5
```

### Páginas V2

```
/centinela/pestel                           Hub (pestel_projects)
/centinela/pestel/nuevo                     Wizard E1-E3
/centinela/pestel/[projectId]/datos         E4 — semáforo + carga manual
/centinela/pestel/[projectId]/analisis      E5 — resultados IA (PESTLPanelV2)
```

### Estado de fases

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| E1-E3 | Wizard: tipo, territorio, variables PEST-L | ✅ Completado |
| E4    | Datos: semáforo cobertura + carga manual | ✅ Completado |
| E5    | Análisis IA: 5 dims paralelas + sesgos + cadenas | ✅ Completado |
| E6    | Interpretación: matriz drag-drop, human-in-loop | ⏳ Pendiente |
| E7    | Informes: 4 formatos, scorecard, escenarios | ⏳ Pendiente |
| E8    | Monitoreo continuo + alertas | ⏳ Pendiente |
| —     | Integración con Moddulo F2 (exploración) | ⏳ Pendiente |

### Especificaciones funcionales

Las decisiones de UX y metodología de PESTEL están en `_docs/specs/pestel/`.
**Leer la spec del módulo antes de desarrollar cualquier componente de PESTEL.**

| Archivo | Módulo |
|---------|--------|
| `_docs/specs/pestel/00_contexto_metodologico.md` | Por qué existe PESTEL, lógica PEST-L |
| `_docs/specs/pestel/01_onboarding.md` | Configuración del proyecto (tipo, equipo, horizonte) |
| `_docs/specs/pestel/02_territorio.md` | Definición geográfica, institucional, electoral |
| `_docs/specs/pestel/03_variables.md` | Variables PEST-L por tipo de proyecto, pesos, indicadores |
| `_docs/specs/pestel/04_datos.md` | Recolección modo mixto, semáforo de cobertura |
| `_docs/specs/pestel/05_procesamiento_ia.md` | Capas de análisis, prompts base, detección de sesgos |
| `_docs/specs/pestel/06_interpretacion.md` | Matriz impacto/probabilidad, human-in-the-loop |
| `_docs/specs/pestel/07_informes.md` | Formatos de salida, scorecard, escenarios |
| `_docs/specs/pestel/08_monitoreo.md` | Dashboard, alertas, modo crisis |
| `_docs/specs/pestel/data_model.md` | Entidades TypeScript compartidas |

### Decisiones metodológicas no negociables

Estas decisiones complementan las reglas técnicas ya documentadas arriba.
No propongas alternativas sin consultar primero.

1. **Human-in-the-loop obligatorio.** Ningún output de IA en PESTEL es
   definitivo hasta validación explícita del usuario. La IA clasifica y
   propone; el analista decide. Aplica especialmente a la Etapa 6
   (interpretación) y a cualquier reclasificación de factores PEST-L.

2. **Variables por tipo de proyecto.** Cada tipo de proyecto (electoral,
   gubernamental, legislativo, ciudadano) activa un conjunto distinto de
   variables PEST-L por defecto. Estos conjuntos están definidos en
   `_docs/specs/pestel/03_variables.md` — no inventarlos en código.

3. **Detección de sesgos en Etapa 5.** El procesamiento IA debe detectar
   y reportar: sesgo urbano, sesgo etario digital, sobrerepresentación de
   fuentes digitales sin validación de campo, y contradicciones entre datos
   oficiales y percepción ciudadana. No es un feature opcional.

4. **Modo mixto de datos por defecto.** PESTEL combina siempre fuentes
   automáticas (APIs, scraping) con carga manual del equipo. No existe un
   modo "solo automático".

5. **Semáforo de cobertura visible.** El indicador verde/amarillo/rojo por
   dimensión PEST-L debe mostrarse desde la Etapa 4 y mantenerse visible
   en las Etapas 5 y 6. Un análisis no avanza si alguna dimensión está en rojo.

### Principios de diseño de PESTEL

Estos principios rigen las decisiones de UX y arquitectura del sistema. No
son negociables y aplican a todas las etapas, incluyendo las futuras E6-E8.

1. **Transparencia metodológica.** Toda salida de IA debe incluir su nivel
   de confianza y las fuentes que la respaldan. El usuario siempre sabe qué
   datos usó el sistema y qué tan confiables son. Las narrativas deben citar
   sus fuentes con el formato `(Fuente: nombre, fecha)`.

2. **Trazabilidad.** Cada análisis debe poder reconstruirse: qué artículos
   se usaron, qué variables estaban activas, qué fecha. Los documentos
   `pestel_analyses` conservan el `jobId` de origen que apunta al
   documento `pestel_raw_articles` con los datos crudos.

3. **Colaborador estratégico, no oráculo.** PESTEL propone; el analista
   decide. Los outputs de IA son insumos para el juicio profesional, no
   recomendaciones definitivas. Ningún output es definitivo sin validación
   explícita del usuario (E6 human-in-the-loop).

---

## Fontana (T10) — Capa conversacional

Detalle completo: `docs/ecosistema/T10-fontana/` y `_docs/fontana-t10-contexto-desarrollo.md`.

**UI (`app/centinela/fontana/`)** — `FontanaMain` (header) → `FontanaWorkspace`
con 2 pestañas:
- **Indicadores** (`FontanaIndicadoresAccordion`): acordeón horizontal de las 5
  familias, una abierta a la vez. Carga perezosa por familia con caché en
  estado local; mutar la selección (añadir/quitar) invalida esa caché.
  F1/F2/F3/F5 → `FontanaComparativeTable`; F4 → `FontanaF4Panel` (shape propio).
- **Fontana** (`FontanaCanvasTab`): lienzo de `FontanaSesion.canvasItems[]`
  (`FontanaCanvasItemCard` — resumen / grafica / tabla / desglose).

**Agente "Fontana"** (`FontanaAgentBubble` + `app/components/shared/chat/*`):
burbuja persistente + panel en `ResponsivePanel` (sidebar derecho desktop, con
auto-open; bottom sheet mobile, sin auto-open). SSE en `POST /api/fontana/chat`
con **tool use real** del SDK Anthropic (`lib/fontana/agente/`):
- `consultar_indicador` — valor de un indicador en el territorio de la sesión;
  `compararNiveles: true` (default recomendado) devuelve `nivelesComparados`.
  Narrativos F5 (F5-1/3/4/5/9/10) van a `GET .../sesion/[id]/narrativa`.
- `consultar_indicador_territorio_externo` — indicador en un estado/municipio
  DISTINTO al del proyecto, solo cuando el usuario lo nombra explícitamente.
  `GET .../consulta-territorio` — resuelve el nombre vía `claveCanonicaMunicipio`
  (helper compartido `lib/fontana/geo/resolverTerritorioNombre.ts`);
  `ambiguo` si el municipio se repite entre estados (el agente pregunta). Fase 1:
  solo lectura, sin Canvas.
- `consultar_serie_temporal` — serie histórica (varios años) de un indicador
  con historia. **Sin `enum` en el schema**: valida contra el config
  `lib/fontana/series/seriesDisponibles.ts` (`SERIES_DISPONIBLES` / `tieneSerie`).
  1ª ola (2026-09-01): **F2-6, F2-12, F3-16, F3-17, F2-1, F2-2, F2-14** (corte
  nacional/estatal) + **F2-17** (piloto). 2ª ola (2026-09-03): series
  **MUNICIPALES** — **F2-3** (CONEVAL Rezago Social, est+mun) y **F2-5,
  F2-20, F2-21, F2-22** (PNUD IDH/sub-índices, municipal). Dispatcher
  `lib/fontana/ingesta/serieTemporal.ts` → resolver por familia de fuente
  (`resolverSerieEnigh` / `resolverSerieHuelgas` / `resolverSerieIep` /
  `resolverSerieInegiPm` / `resolverSerieConeval` / `resolverSeriePnud` / el
  pilot `resolverSerieCompetitividadEstatal`), todos junto a la función de
  celda existente, sin tocarla. `GET .../serie-temporal`.
  Sin `territorioNombre` = territorio del proyecto; con `territorioNombre` =
  un estado o municipio nombrado (un municipio se mantiene municipal solo si
  el indicador publica serie municipal). Proyecto plural multi-estado
  (`estadosDelTerritorio`) → `multiEstado`; proyecto plural multi-municipio
  en series municipales (`municipiosDelTerritorio`, `lib/fontana/geo/`) →
  `multiMunicipio` — en ambos el agente pregunta a cuál se refiere, nunca
  asume. La respuesta lleva `nivel` (nacional / estatal / municipal) — si es
  estatal, el agente aclara que aplica a todo el estado, no es promedio de
  los municipios/distritos. `tieneSerie: boolean`
  expuesto en `consultar_indicador`, `listar_indicadores_familia`,
  `listar_indicadores_activos_todas_familias`, `GET /familia/[id]`,
  `GET /contexto` → el system prompt no lleva lista de excepciones. No genera
  Canvas — para eso `generar_visualizacion` tipo `serie_temporal`. F3-16
  (huelgas): serie DENSA min-año..año-en-curso-1 (año en curso excluido por
  parcial; año sin registros = 0 real).
- `consultar_detalle_indicador` — lista de entidades detrás de un
  conteo/clasificación; solo F3-8 (municipios ZAP), F5-6 (giros DENUE), F5-8
  (localidades GACP), vía `GET .../familia/[familiaId]/detalle`.
- `listar_indicadores_familia` — indicadores activos + `catalogoCompleto` de
  UNA familia; el agente NUNCA enumera de memoria.
- `listar_indicadores_activos_todas_familias` — las 5 familias en 1 llamada
  (evita encadenar 5).
- `generar_visualizacion` — crea un `canvasItem` (`resumen` / `grafica` /
  `tabla` / `desglose` / `distribucion` / `serie_temporal`). Tres ejes:
  `grafica` = mismo indicador entre niveles geográficos; `distribucion` (F1-2,
  F1-11, F1-12, F2-12) = categorías dentro de un nivel; `serie_temporal`
  (SOLO F2-17) = evolución en el tiempo. Rechaza F4. Todos llevan
  `fuenteEtiqueta`. El agente NUNCA anuncia el resultado en el mismo turno.
- `navegar_pestana` — cambia de pestaña / abre familia.

Las líneas de trazabilidad de herramientas (`toolCalls`) se persisten con el
mensaje pero **no se renderizan al usuario** — el chat muestra un indicador
genérico "Consultando datos…". Los IDs de indicador (`F<n>-<n>`) NUNCA
aparecen en la prosa dirigida al usuario. Ver `app/components/shared/chat/`.

**Metadata de las 5 familias** (nombre, descripción, color): fuente única en
`lib/fontana/familias.ts` (`FAMILIAS_FONTANA` / `FAMILIA_META`) — la consumen el
acordeón, las cards del Canvas, `tools.ts` y el system prompt del agente. Nunca
re-hardcodear en otro sitio. La LISTA de indicadores por familia sale del
registry vía `/api/fontana/familia/[familiaId]`, nunca hardcodeada.

**Regla no negociable**: el agente SOLO responde con datos devueltos por una
herramienta — nunca con conocimiento propio. Los datos salen de los endpoints
ya existentes (`familia/[familiaId]`, `narrativa`), nunca de `resolverIndicadorFontana`
importado directo ni de una fuente paralela.

**Persistencia**: `FontanaSesion.canvasItems[]` (campo, aditivo) + subcolección
append-only `fontana_sesiones/{sesionId}/mensajes` (`GET .../mensajes` para
rehidratar). Sin store cliente nuevo — `useState` + endpoints.

**Adjuntar archivo (2026-09-01)**: el composer sube archivos a
`POST /api/fontana/sesion/[id]/adjunto` (multipart). Se extrae SOLO el texto
(extractor compartido `lib/moddulo/attachments.ts` — PDF/DOCX/XLSX/TXT/CSV,
XLSX vía `exceljs`), **nunca el binario** (ni en Storage ni temporalmente).
Validación de tipo real en servidor (magic bytes), límite 10 MB, texto
truncado a 50 000 chars. Se guarda en la subcolección append-only
`fontana_sesiones/{id}/adjuntos` (`{ id, nombreArchivo, textoExtraido,
tipoMime, cargadoEn: Timestamp }`). El chat antepone ese texto al turno como
**contexto** (`lib/fontana/agente/adjuntosContexto.ts`, presupuesto 60 000
chars), nunca como fuente de datos. Borrado en cascada con la sesión
(`recursiveDelete`) + purga automática a los 90 días
(`functions/src/fontana/purgeAdjuntos.ts`, `onSchedule` cada 24 h — requiere
`firebase deploy --only functions`).

**Dictado de voz (2026-09-01)**: botón de micrófono en el composer sobre la
Web Speech API nativa (`useSpeechDictation`, `es-MX`). Texto editable, sin
auto-envío. Estado explícito de navegador no soportado. `next.config.ts`
relaja `Permissions-Policy: microphone=(self)` **solo** para
`/centinela/fontana` (el resto del sitio mantiene `microphone=()`).

**Patrón reutilizable**: `docs/ecosistema/patrones-compartidos/agente-conversacional.md`
(referencia para Sefix-AI T06 y apps futuras).

---

## Moddulo — Arquitectura

9 fases secuenciales por proyecto:

```
proposito → exploracion → investigacion → diagnostico →
estrategia → tactica → gerencia → seguimiento → evaluacion
```

- Chat con Claude vía **streaming SSE** en `/api/moddulo/chat/[phaseId]`
- En la fase `exploracion` (F2), Moddulo debe consumir PESTEL para
  generar el análisis PEST-L del territorio del proyecto.

---

## Suscripciones

| Rol | Plan | Precio MXN | Acceso relevante |
|-----|------|-----------|------------------|
| `user` | freemium | $0 | Blog, Redactor limitado |
| `basic` | basic | $2,899/mes | + Cursos, Sefix |
| `premium` | premium | $5,899/mes | + Centinela, Moddulo |
| `professional` | professional | $9,899/mes | + API, white label |

Ver `types/subscription.types.ts` → `PLAN_FEATURES` para detalles completos.

---

## Seguridad — Reglas de Oro

1. Nunca hardcodear secrets. Usar `.env` (Next.js) o Firebase Secret Manager
   (Cloud Functions).
2. Siempre verificar sesión en API routes con `getSessionFromRequest()`.
3. Siempre validar que el `userId` del token coincide con el recurso
   solicitado antes de retornar datos.
4. Nunca `dangerouslySetInnerHTML` sin sanitizar con DOMPurify.
5. Las cookies de sesión son HTTP-only — nunca accederlas desde JS cliente.
6. Nunca ejecutar comandos que impriman valores de variables de entorno o
   credenciales en el output: `cat .env`, `grep .env`, `echo $VAR`, `printenv`,
   ni variantes. Para verificar que una variable existe, usar:
   `[ -n "$VAR" ] && echo "OK" || echo "FALTA"` — solo confirma presencia,
   nunca revela el valor.

---

## Variables de Entorno

**Next.js (`.env`):**
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_PROJECT_ID        # eskemma-3c4c3
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
ANTHROPIC_API_KEY
RESEND_API_KEY
FIREBASE_FUNCTIONS_URL                 # https://us-central1-eskemma-3c4c3.cloudfunctions.net
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_ENVIRONMENT                # development | production
INEGI_TOKEN
BANXICO_TOKEN
```

**Cloud Functions** (Firebase Secret Manager, no en `.env`):
```
ANTHROPIC_API_KEY
INEGI_TOKEN
BANXICO_TOKEN
```

---

## Comandos Frecuentes

```bash
# Desarrollo local
npm run dev

# Firestore + Storage rules
firebase deploy --only firestore:rules
firebase deploy --only storage

# Cloud Functions
cd functions && npm install
cd functions && npm run lint && npm run build   # Verificar antes de deploy
firebase deploy --only functions

# Secrets
firebase functions:secrets:set <NOMBRE>

# Logs
firebase functions:log
```

---

## Documentación Interna

| Archivo | Contenido |
|---------|-----------|
| `_docs/pestel-engineering-plan.md` | Plan de ingeniería detallado de PESTEL |
| `_docs/specs/pestel/` | Especificaciones funcionales de PESTEL (9 archivos) |

---

## Deuda Técnica Conocida

| Ítem | Detalle | Detectado |
|------|---------|-----------|
| Drift `capacidades` XPCTO (3 vs. 4 subcampos) | El FAT 2.0 (Fase 1, variable C) define 4 dimensiones: Financiero, Humano, Organizacional, Material. `types/moddulo.types.ts` (`XPCTO.capacidades`) solo tiene 3 campos: `financiero`, `humano` (comentario: "Equipo y estructura organizacional" — fusiona Humano+Organizacional), `logistico` (comentario: "Infraestructura y medios operativos" ≈ Material). No bloquea funcionalidad actual; evaluar si separar en 4 campos al tocar el wizard de F1 o el tipo `XPCTO`. | 26-07-16, auditoría snapshot XPCTO/Centinela |
| Captura de distrito electoral sin estructura en `TerritorySelector.tsx` | TerritorySelector.tsx (compartido por Moddulo y PESTEL) captura el número de distrito electoral y la descripción de su cabecera en un único campo de texto libre, sin separación estructurada entre ambos. Fontana depende de parsear ese texto (vía `extraerCiudadCabecera()`, regex sobre la frase "con cabecera en X") para resolver la alcaldía/municipio dominante en proyectos de nivel distrito_federal/distrito_local — si el texto no sigue ese formato exacto (como el proyecto de prueba de CDMX, Distrito Local 27), Fontana no puede determinar el municipio y muestra el texto de "sin municipio definido" aunque el dato geográfico real sí exista en el catálogo de Fontana (`cabeceras_loc.json`). Recomendación evaluada y descartada: un selector/catálogo de distritos por país (mala UX fuera de México, catálogos inmanejables). Recomendación pendiente de evaluar en el chat de Moddulo: separar el campo actual en dos inputs de texto libre — (a) identificador del distrito, (b) descripción/cabecera — sin necesidad de catálogo por país, solo para que Fontana pueda cruzar por estado + identificador de distrito en vez de depender del parseo de una frase completa. Proyecto de prueba `nZvpYu4nnZrsw5hoGcVP` (CDMX, Distrito Local 27) se deja sin modificar deliberadamente, como caso de verificación para cuando se implemente el fix real. **Resuelto 26-08-16/17** por el rediseño de territorio (selector estructurado + `TipoAgregacionTerritorial`) — se deja la fila como registro histórico. | 26-08-12, revisión de consistencia Fontana T10 (Incremento 4) |
| ~~Clasificación `agregacionPlural` de F3/F4/F5 pendiente de poblar~~ **RESUELTO** | Al cerrar Familias 3/4/5 (commits 26-08-22/25/27), el registry pasó de 41 a **86 entradas** con `agregacionPlural.tipo` clasificado en las 5 familias (verificado 26-08-27: `scripts/verify-fontana-agregacion-plural-cobertura.ts` → 86/86, 0 sin clasificar; `scripts/diff-fontana-registry.ts` → local == Storage, 0 diffs). `app/api/fontana/familia/[familiaId]/route.ts` ya NO responde 400 para F3/F4/F5 — soporta F1/F2/F3/F5 por el flujo geográfico común y F4 por su rama propia; el 400 solo aplica a un `familiaId` que no sea una de las 5. Se deja la fila como registro histórico. | 26-08-17, Fase 3 del rediseño de territorio |
| Duplicación del primitivo de chat (shared/chat vs. ModduloChat/AdvisorPanel) | La capa conversacional de Fontana (T10) introdujo `app/components/shared/chat/` (`useChatStream`, `ChatBubble`, `ChatPanel`, `MarkdownContent`) — nuevos, inspirados en el patrón de `app/moddulo/components/ModduloChat.tsx` pero sin modificarlo. El loop de lectura SSE y el renderer markdown quedan duplicados entre `shared/chat/` y `ModduloChat.tsx` + `app/moddulo/proyecto/[projectId]/exploracion/components/AdvisorPanel.tsx`. Esos dos NO se tocaron esta ronda; migrarlos a los primitivos compartidos queda para un chat dedicado. | 26-08-27, capa conversacional de Fontana (T10) |
| ~~Subcolección `mensajes` huérfana al borrar una sesión de Fontana~~ **RESUELTO** | El `DELETE` de `app/api/fontana/sesion/[sesionId]/route.ts` hacía solo `ref.delete()`, que en Firestore NO borra subcolecciones — cada sesión eliminada dejaba su `mensajes` huérfano. Detectado en la auditoría de adjuntos (2026-09-01). Corregido en la misma ronda al cambiar a `adminDb.recursiveDelete(ref)` (necesario de todos modos para la nueva subcolección `adjuntos`): arrastra `mensajes` y `adjuntos`. Se deja como registro. | 26-09-01, ronda de adjuntar archivo + dictado de voz |
| Rate limiting del fallback de visión (PDF sin texto nativo → Claude) | Todo PDF cuyo texto nativo sea < 120 chars dispara una llamada a `claude-sonnet-4-6` como visión, sin límite por sesión ni usuario. Aplica a `lib/moddulo/attachments.ts` (chat de Moddulo, import PESTEL, adjuntos de Fontana) y a `app/api/centinela/pestel/project/[projectId]/upload-source/route.ts`. No se implementó un límite básico esta ronda (no era trivial de añadir limpio al reusar el extractor). Vector de coste, no de seguridad. | 26-09-01, ronda de adjuntar archivo + dictado de voz |
| Purga de adjuntos de Fontana: sin `collectionGroup`, deploy manual | `functions/src/fontana/purgeAdjuntos.ts` (`onSchedule` cada 24 h, primera función programada del repo que fija `timeoutSeconds`/`memory`) **itera sesión por sesión** en vez de una query `collectionGroup("adjuntos")` — decisión explícita para no introducir el primer índice `COLLECTION_GROUP` del repo. Migrar solo si el conteo de sesiones lo hace lento. La purga no corre hasta `firebase deploy --only functions`. `next.config.ts` ahora tiene un override de `Permissions-Policy` por ruta (`/centinela/fontana`, `microphone=(self)`). | 26-09-01, ronda de adjuntar archivo + dictado de voz |
| Functions emulator + `firebase-functions` desactualizado: `admin.firestore.Timestamp` sale `undefined` | Al probar `purgeAdjuntos` en el Functions emulator (firebase-tools 15, `firebase-functions ^6.0.1`), `admin.firestore.Timestamp.fromMillis(...)` dentro del handler tira `Cannot read properties of undefined (reading 'fromMillis')` — el runtime parcheado del emulador no expone el estático `Timestamp` en el namespace `firestore`. **No es un bug del código de producción** (en GCF real funciona); es del emulador con esta versión de `firebase-functions` (el propio emulador avisa "outdated version"). Mitigación aplicada en `purgeAdjuntos.ts`: el `cutoff` se construye como `Date` (`new Date(...)`), que Firestore convierte a `Timestamp` en la query de forma transparente. Si alguien prueba otra función programada en el emulador y necesita un `Timestamp`, construirlo desde una instancia (`admin.firestore().Timestamp` no; usar `Date` o `admin.firestore.Timestamp` importado de `firebase-admin/firestore`) o actualizar `firebase-functions`. Nota adicional: el emulador de Firestore exige **Java ≥ 21** (firebase-tools 15). | 26-09-01, verificación en desarrollo de `purgeAdjuntos` |
| Sin vista previa de contenido en M2 (F3-Investigación) | M2 no tiene ningún mecanismo de vista previa del contenido de un resultado antes de que el usuario lo apruebe — aplica a Canal 2, Canal 3 y Canal 1 (Fontana) por igual, ninguno está resuelto. Hoy la aprobación se basa solo en metadatos (pregunta, origen, cobertura), sin que el usuario vea el contenido real. Pendiente de diseño, fuera del alcance de Fontana — afecta a F3 en general. Suspendido deliberadamente: se aborda en un chat dedicado a M2, no en el de Fontana/Canal 1. | 26-08-19, verificación en navegador de Fontana T10 (Escenarios b/c + Canal 1) |
| Incidente CVE_MUN INE-vs-INEGI (Fontana F1/F2) — **RESUELTO** | `resolveMunicipioCve()`/`getMunicipiosOptions()` (`lib/geo/municipios.ts`, numeración INE) divergía del CVE_MUN oficial en ~55-63% de los municipios (1,573/2,848 reverificado). Usado como join externo en `coneval.ts` (F2-1/F2-2/F2-3/F2-14), `conapoMarginacion.ts` (F2-4) y `bienestar.ts` (F2-7/F2-8) — producía el valor de OTRO municipio, sin error visible. Paso 1: mitigación de emergencia (aviso "En validación..."), verificada en navegador. Paso 2: `eceg.ts` verificado NO expuesto (32/32 estados, 0 divergencias — join internamente consistente, INE contra INE). Paso 3: auditoría de producción — 1 entrega afectada encontrada (proyecto `fvpuanYx7EYhdV3WLqBr`), confirmada como cuenta de pruebas interna, no cliente real, sin necesidad de notificación; datos marcados para reprocesar tras el fix. Paso 4: fix de fondo — los 3 adaptadores migrados a join por NOMBRE (mismo patrón ya aprobado en `icmm.ts`), incluyendo el path de agregación distrital ponderada (`resolverNumeradorDenominadorMunicipios`, vulnerable por la misma causa, no estaba en la lista original) — verificado con 18 municipios reales de 8 estados, valores correctos por municipio (no más "El Grullo" al pedir Guadalajara). Paso 5: documento central `docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md`. | 26-08-23, verificación en vivo de `gacp.ts` (Familia 5) |
| Discrepancia menor F1-1 (ECEG) en Tuxtla Gutiérrez, Chiapas | Spot-check del incidente CVE_MUN (arriba) comparó valores reales de F1-1 (Población Total) contra la cifra oficial INEGI (Censo 2020, Comunicado 37/21): Tuxtla Gutiérrez muestra 604,089 en Fontana vs. 604,147 oficial — diferencia real de 58 habitantes (0.0096%). Causa distinta al incidente de CVE_MUN: `eceg-data-pipeline.ts` (`buildMunicipiosData`) calcula el nivel municipal sumando secciones electorales reasignadas a municipio vía `SECCION.shp`, no leyendo el total censal oficial por municipio directamente — artefacto de reconciliación sección↔municipio en el borde entre municipios. Otros 4 territorios verificados en el mismo spot-check (Nacional, Chiapas estatal, Aldama, Benemérito de las Américas) coincidieron exactamente. Diferido deliberadamente — prioridad del incidente de CVE_MUN era mayor. Pendiente: muestrear más municipios para confirmar si es un caso aislado o un patrón sistemático en el borde sección/municipio. | 26-08-23, verificación Paso 2 del incidente CVE_MUN |
| F2-17/F2-6/F2-15/F2-16 (indicadores estatal-only) — celda simple muestra el primer estado en silencio para proyecto plural multi-estado | En un proyecto plural que abarca más de un estado, la celda de la tabla comparativa muestra el valor del PRIMER estado seleccionado sin advertir al usuario que el proyecto incluye otros estados con valores potencialmente distintos. Encontrado durante el piloto de serie temporal de F2-17 (26-09-01). Afecta un dato ya mostrado en producción. Causa raíz: `resolverCompetitividadEstatal` (`imco.ts:89-97`) y el patrón gemelo `enigh.ts:233-238` usan solo `territorio.estado`, que `TerritorySelector.tsx:326/330/339` fija al estado del PRIMER elemento seleccionado. El piloto de serie NO hereda el hueco (lo cubre con `multiEstado` → preguntar a cuál estado, vía `estadosDelTerritorio`), pero la celda simple de la tabla sí. Corrección pendiente: aparte, con su propio análisis de impacto en la UI de la tabla (no se resuelve en esta ronda). | 26-09-01, piloto de serie temporal F2-17 |
| F2-20/F2-21 serie municipal (PNUD) no cubre Oaxaca, la celda sí — **decisión ratificada 26-09-03** | `resolverSeriePnud` lee el combinado `ID_IDH_COMBINADO` (única fuente con 2010/2015/2020), que colapsa los 570 municipios de Oaxaca en 30 regiones (capital y Tuxtepec incluidas — verificado en vivo). La CELDA de F2-20/F2-21 lee standalone 2020 (`ID_SE_2020`/`ID_SI_2020`) que SÍ traen Oaxaca. Decisión (hallazgo 3): la serie mantiene `MOTIVO_OAXACA_SERIE` — una serie de un solo punto (2020) no es una serie, y generarla confundiría a quien pidió una tendencia. La inconsistencia con la celda es aceptable y explicable (la celda nunca prometió historia). Revisar solo si aparece una fuente PNUD con historia municipal que desagregue Oaxaca. | 26-09-03, series municipales 2ª ola |
| Modal de municipios (`FontanaMunicipiosModal.tsx`, modo buscador) sin virtualizar | `ModalEstado` en modo "buscador" (>119 municipios, ej. Oaxaca 570) renderiza todas las filas sin virtualización (`filtradosIndice.map(...)` en un `<ul>` plano). El bug de solapamiento de texto se corrigió con `min-w-0`/`break-words` (26-09-03), pero 570 filas montadas siguen siendo un costo de render. Migrar a lista virtualizada solo si el modo buscador se vuelve lento en la práctica. | 26-09-03, hallazgo 4 |

---

## Historial de Sprints

| Fecha | Sprint | Resultado |
|-------|--------|-----------|
| 26-03-24 | Fase 0 Centinela | Base del hub Centinela, homepage fixes |
| 26-03-25 | PESTEL F1+F2 | Scraping + clasificación PEST-L completados |
| 26-03-26 | PESTEL F3 inicio | 1ª versión UI dashboard PESTEL |
| 26-03-27 | PESTEL F3 cont. | Hub multi-territorio + página análisis individual |
| 26-03-27 | PESTEL rediseño E1-E5 | Rediseño completo alineado con specs: wizard E1-E3, semáforo E4, análisis por dimensión E5, tipos V2, nuevas colecciones Firestore |
| 26-03-28 | PESTEL correcciones post-E5 | Persistencia análisis (latest-analysis endpoint), fix economicData INEGI/Banxico→Claude, contexto legal LGIPE/INE, citación fuentes, integración Sefix (datos electorales dim-P), semáforo amarillo texto negro, principios de diseño en CLAUDE.md |
| 26-08-27 | Fontana T10 — capa conversacional | Estructura de 2 pestañas (Indicadores / Fontana-Canvas) que reemplaza la vista única de tabla; acordeón de 5 familias con carga perezosa + caché. Agente "Fontana" con tool use real del SDK Anthropic (`consultar_indicador`, `generar_visualizacion`, `navegar_pestana`) — solo responde con datos de una llamada a herramienta. Endpoints nuevos: `POST /api/fontana/chat` (SSE), `GET .../sesion/[id]/mensajes`, `GET .../sesion/[id]/narrativa`. Persistencia: `FontanaSesion.canvasItems[]` + subcolección `fontana_sesiones/{id}/mensajes`. Primitivos compartidos nuevos: `app/components/shared/{Tabs,ResponsivePanel,chat/*}`. |
| 26-09-01 | Fontana T10 — adjuntar archivo + dictado de voz | Composer con adjuntar archivo (PDF/DOCX/XLSX/TXT/CSV; extrae SOLO texto vía `lib/moddulo/attachments.ts` + `exceljs`, nunca el binario; validación de tipo real server-side; endpoint `POST .../sesion/[id]/adjunto`; subcolección append-only `adjuntos`; contexto por turno con presupuesto de 60 000 chars) y dictado de voz (Web Speech API nativa, `useSpeechDictation`, `es-MX`, sin auto-envío, estado de navegador no soportado; `Permissions-Policy: microphone=(self)` solo en `/centinela/fontana`). Retención: `recursiveDelete` en cascada (también cierra el hallazgo de `mensajes` huérfano) + purga a 90 días (`functions/src/fontana/purgeAdjuntos.ts`, `onSchedule` cada 24 h; lógica en `purgarAdjuntosVencidos()` separada del wrapper, verificada en el emulador 26-09-01 — deploy a producción pendiente, ver `docs/ecosistema/T10-fontana/purga-adjuntos-runbook.md`). Doc de patrón reutilizable: `docs/ecosistema/patrones-compartidos/agente-conversacional.md`. `lib/moddulo/attachments.ts` pasa de 5 a 6 consumidores. |
| 26-09-01 | Fontana T10 — piloto de serie temporal F2-17 | Primera serie histórica consultable de Fontana. Tool nueva `consultar_serie_temporal` (enum `["F2-17"]`) + Canvas `serie_temporal` (`generar_visualizacion`) + ruta `GET /api/fontana/serie-temporal` + adaptador `resolverSerieCompetitividadEstatal` (`imco.ts`, lee los 10 años 2016-2025 del mismo `imco_ice/2025.json`). Helpers de geo compartidos: `resolverTerritorioNombre` extraído de `consulta-territorio` a `lib/fontana/geo/`, `estadosDelTerritorio` nuevo. Proyecto plural multi-estado → `multiEstado` (el agente pregunta a cuál estado, nunca asume). `alcance:"estatal"` propagado a tool/Canvas/render/prompt (el ICE aplica a todo el estado, no es promedio de municipios). System prompt: 3ª rama de desambiguación (temporal) + excepción F2-17 en "evolución temporal" + regla "no anunciar" blindada por tipo. Deuda pre-existente registrada (celda simple estatal-only muestra el primer estado en silencio) — no corregida esta ronda. Sin campo `serieHistorica` en los otros 85 (piloto de un caso). |
| 26-09-01 | Fontana T10 — series temporales 1ª ola (7 indicadores nac/est) | Generalización del piloto F2-17. Config `lib/fontana/series/{seriesDisponibles,tipos}.ts` (`SERIES_DISPONIBLES` / `tieneSerie` — fuente única de verdad, sin `enum` en la tool). Dispatcher `lib/fontana/ingesta/serieTemporal.ts` → 4 resolvers nuevos por familia de fuente (`resolverSerieEnigh` F2-6/F2-12, `resolverSerieHuelgas` F3-16, `resolverSerieIep` F3-17, `resolverSerieInegiPm` F2-1/2/14 — todos junto a la función de celda, sin tocarla) + el pilot IMCO enrutado por `fuenteId:"imco"`. Canvas type generalizado: `alcance:"estatal"` → `nivel: NivelTablaFontana`; `esEstadoDelProyecto` → `esTerritorioDelProyecto`; render con nota por nivel. `tieneSerie` en 5 superficies de lista → prompt genérico ("si `tieneSerie:true`, usa `consultar_serie_temporal`"), sin lista. F2-6 Gini → `formato:"indice"` (coeficiente, no conteo). F3-16 huelgas → serie densa, año en curso excluido (parcial), año sin registros = 0. Fuera de esta ola: municipales (necesitan `municipiosDelTerritorio` + `no_agregable`), F4, F2-15/16/10/8, F1-18. |
| 26-09-03 | Fontana T10 — correcciones razonamiento/streaming + series 2ª ola (5 municipales) | **(a)** Correcciones de calidad del agente registradas como estándar reutilizable en `docs/ecosistema/patrones-compartidos/agente-conversacional.md` §7: `thinking` habilitado en `chat/route.ts` (`budget_tokens:2000`, `max_tokens:6000`), supresión de texto de iteraciones intermedias del loop de tool-use vía evento SSE `text_suppress`, regla de prompt ampliada (nada de "espera/en realidad/corrijo", verificar aritmética, IDs internos invisibles cueste 1 o 5 llamadas), higiene de textos de rechazo de tool. **(b)** Series **municipales**: `resolverSerieConeval` (F2-3 Rezago Social, est+mun — lee los 5 xlsx del ZIP IRS 2000-2020; offsets 14/16 verificados estables en los 5 años; año sin encabezado verificable → `valor:null` + nota, nunca se omite) y `resolverSeriePnud` (F2-5/20/21/22 IDH+sub-índices, municipal — lee las columnas 2010/2015/2020 del combinado `ID_IDH_COMBINADO`, mapa de columnas verificado en vivo vía identidad media-geométrica + standalone SE/SI). Guard nuevo `lib/fontana/geo/municipiosDelTerritorio.ts` (espejo de `estadosDelTerritorio`) → `multiMunicipio` en route/tool/prompt (espejo de `multiEstado`). `nivelObjetivoSerie` generalizado a `"nacional"|"estatal"|"municipal"|null`. Cross-check: punto 2020 de cada serie == celda actual (F2-3 GDL −1.3417; F2-5 GDL 0.815; F2-20 GDL 0.739). Fuera de esta ola: corte municipal de F2-1/2/14, F2-8 (`aditivo`, CKAN por trimestre), F4, F2-15/16/10, F1-18, aplicar thinking+supresión a `moddulo/chat`. |
| 26-09-03 | Fontana T10 — 4 hallazgos de verificación de la 2ª ola | **1 (crítico):** `generar_visualizacion serie_temporal` generó 3 tarjetas de F2-14 estatal cuando se pidió F2-5 municipal para 3 municipios. Causa: el modelo pasó un `indicadorId` equivocado + la ruta colapsaba un `territorioNombre` de municipio a su estado en silencio (`ok:true`) + `generarSerieTemporal` no verificaba geografía. Fix: `serie-temporal/route.ts` devuelve `{ok:false, colapsoNivel:true, entregaNivel, municipioPedido, estado, motivo}` en vez de colapsar; `consultarSerieTemporal` instruye a aclararlo ANTES; `generarSerieTemporal` → `reject` + guard `pedidoMunicipio && nivel!=="municipal"`. System prompt: la regla "nunca adivines un ID" se extiende a `generar_visualizacion` (reconfirmar antes de CADA llamada, incluso cross-turno), N entidades = N llamadas con el MISMO indicador descrito así, y "consultar X no habilita a graficar Y". **2 (crítico):** sección nueva del system prompt "## Confirma que puedes hacer algo antes de ofrecerlo o ejecutarlo" (mismo peso que la regla absoluta de datos; incisos a/b/c). También en el doc de patrón §8. **3:** verificado en vivo que el PNUD colapsa los 570 municipios de Oaxaca en 30 regiones — capital y Tuxtepec incluidas — así que `MOTIVO_OAXACA` para F2-5/F2-22 es correcto, NO sobre-clasificación; la celda de F2-20/F2-21 (standalone, sí trae Oaxaca) no cambia; la serie de F2-20/F2-21 mantiene `MOTIVO_OAXACA_SERIE` (decisión: una serie de 1 punto no es serie). `MOTIVO_OAXACA` reescrito autosuficiente (el agente lo cita verbatim, sin inventar "municipios pequeños y dispersos"). **4:** modal `FontanaMunicipiosModal.tsx` (`ModalEstado` buscador) — filas con texto solapado para nombres largos (Guanajuato 49 ch, Oaxaca 44, Tlaxcala/Hidalgo/Veracruz/Guerrero/Puebla ≥32); NO por volumen ni por dato sucio (catálogo limpio, 2477 registros verificados), NO preselección por default (es "Seleccionar todos"). Fix general: `min-w-0 flex-1 break-words` en el nombre + `max-w-[45%]` en la columna de valor, en los 4 `Fila*`. Virtualización de 570 filas → deuda de rendimiento, fuera de esta ronda. |
| 26-09-03 | Fontana T10 — 1 investigación PNUD + 3 correcciones de UI | **1 (solo reporte, sin código):** escaneo de `ID_IDH_COMBINADO` (32 estados) — Oaxaca es el ÚNICO estado agregado (30 regiones, capital incluida); los otros 31 están individualizados y completos (los 7 deltas negativos son municipios creados post-marco-2020, no huecos; única omisión real: Chiapas 095, ya documentada). Sin fuente alternativa estructurada de IDH municipal tras evaluar 5 (PNUD PAD sirve el mismo archivo; edición 2014 solo PDF; CONABIO 2010 metodología vieja; CONEVAL Rezago Social mide otra cosa; Coplade sin dataset). Límite de la fuente primaria a nivel nacional — comportamiento actual (`MOTIVO_OAXACA`) correcto y definitivo. **2:** quitado el botón × del composer del chat (`ChatPanel.tsx`); el cierre queda en la × del header + Escape + backdrop mobile. **3:** `SerieTemporalGrafica` (`FontanaCanvasItemCard.tsx`) pasa de barras horizontales a **gráfica de líneas** (SVG en línea a mano, sin recharts — que solo se usa en Sefix; `viewBox 0 0 100 100` + `preserveAspectRatio="none"` + puntos posicionados en HTML; nulos parten la línea en segmentos; eje X thinned si >12 años; ranking `#N/32` por punto; etiquetas de valor thinned si >8). **Separación de `formato`**: `"indice"` (0-100, 2 dec — solo F2-17) se divide en `"coeficiente"` (0-1 y negativos, 4 dec — F2-6 Gini, F2-3 rezago, F2-5/20/21/22 IDH) y `"puntaje"` (1-5, 3 dec — F3-17 IEP). Unión ampliada en `series/tipos.ts`, `types/fontana.types.ts`, `canvasBuilder.ts`, `tools.ts`; `fmt()` con rama por formato. Regresión verificada: ningún valor crudo cambia de magnitud, solo la precisión mostrada (Gini 2024 = 0.3612 crudo; IEP 2025 = 2.54583; ICE = escala 0-100). **4:** `text-red-eske` en los textos de carga de Fontana que no lo tenían (`FontanaIndicadoresAccordion` "Cargando indicadores…", `FontanaDetalleModal` ×2, `FontanaF4PaisesModal`, `ChatPanel` "Consultando datos…"); el label "Consultando…" del CTA primario de `FontanaOnboarding` se deja sin cambio (rojear un CTA primario se lee como error). |
| 26-09-03 | Fontana T10 — F1-2 pirámide de edades real por sexo | Investigación previa: los CSV del ITER 2020 que Fontana ya tiene en disco (`info_geo_eske/iter_2020/`) traen `P_<grupo>_F`/`_M` (diccionario `fd_iter_cpv2020.pdf`, secc. "ESTRUCTURA POR EDAD Y SEXO", ind. 48-101) — sin descarga nueva. `scripts/fontana-iter-pipeline.ts` ampliado (`QUINQUENAL_GROUPS_SEXO`, 36 columnas, junto a los 18 totales) + validación cruzada H+M=total (los **32 estados** pasan exacto, incluidos los 570 municipios de Oaxaca) — bodega `iter_2020/piramide/{estatal,municipios/{NN}}.json` **re-subida**. Adaptador `iter.ts`: `distribucionSexo?: Record<grupo,{hombres,mujeres}>` en `ValorIndicadorFontana`/`CeldaTablaFontana`, poblado por `toPiramideCelda` + `resolverNacionalIter` (nacional agrega los 32). Canvas: `FontanaCanvasDistribucion` gana `piramideSexo?: {etiqueta,hombres,mujeres}[]`; `construirCanvasDistribucion` la arma para F1-2; `NOTA_F1_2` ("no separado por sexo") eliminada. Render: `PiramideSexo` en `FontanaCanvasItemCard.tsx` — barras espejo desde eje central (hombres izq. `color`, mujeres der. `color` @0.55), grupo más viejo arriba, conteos abreviados. System prompt: F1-2 pasa de "pirámide/histograma" a "pirámide de edades por sexo (dos lados)". Verificado: nacional POBTOT 126,014,024, P_85YMAS 433,968 H / 605,583 M; Guadalajara municipal 1,385,629, cruce H+M=total OK por grupo. |
| 26-09-04 | Fontana T10 — guards de calidad del agente (3 hallazgos, forense de Firestore) | **Forense (dump real, no inferencia):** (1+2) el modelo produjo un turno completo afirmando "genero la pirámide ahora / ya está en tu Canvas / aquí la lectura" para Cuernavaca **con CERO tool calls** — alucinó acción y resultado; el usuario vio un canvasItem viejo (append-only) del 09-01. Path de datos verificado perfecto (Morelos bodega con `_M/_F` en los 36 municipios). (3) los 8 municipios de Jalisco: instancias tempranas = código no desplegado (mtimes 20:13-21:09 local vs turnos); la instancia real = hueco arquitectónico (el modelo resuelve los N nombres y pasa `territorioNombre` en cada llamada → `multiMunicipio` nunca se dispara). **Fixes:** **(A)** `chat/route.ts` — al cerrar turno, si `toolCallsAcum.length===0` Y el texto final matchea `AFIRMA_RESULTADO` (regex de aserción de resultado, verificada: matchea las 2 alucinaciones, no 5 respuestas legítimas sin tool) → inyecta aviso `[verificación del sistema]` + fuerza UNA iteración de corrección (`text_suppress` borra el texto falso). System prompt: sección nueva "Nunca reportes el resultado de una acción que no ejecutaste" (mismo peso que la regla absoluta de datos). **(B)** `ToolContext.vizTerritoriosDelTurno: Set` (1 por turno); `limiteTerritoriosLote` en `generarSerieTemporal` + rama F1-2/F1-11: a la 3ª `territorioNombre` DISTINTO sin `confirmadoLote:true` → `reject` forzando UNA pregunta por lote. Campo `confirmadoLote` nuevo en el schema; flujo documentado en el prompt. **(C)** `construirCanvasDistribucion` — si `distribucionSexoCruda` llega con TODOS los valores en 0 (bodega vieja) → NO emite `piramideSexo`, cae a `categorias` + nota honesta (verificado). **Auditoría C de los otros builders:** `serie_temporal` ya guardado (render "Sin datos para graficar"); `distribucion`/`tabla` ok; **`grafica` y `resumen` SIN guard** — crean tarjeta aunque todos los niveles/filas sean "sin dato" (render honesto con motivos, pero tarjeta inútil) → hallazgo menor, pendiente de decidir si se corrige. |
| 26-09-06 | Fontana T10 — recortes en los bordes de las imágenes descargadas del Canvas | Tras el primer uso real de "Descargar PNG/JPG" (`exportElementAsImage.ts`), el usuario reportó valores ilegibles en los extremos de la pirámide de edades y de la gráfica de serie temporal. Causa (2 bugs de layout distintos, no un problema del mecanismo de exportación): **(1) Pirámide** (`PiramideSexo`) — la barra y su etiqueta de conteo comparten la misma fila flex; el ancho de la barra se calculaba como `(valor/max)*100%` SIN tope, así que el grupo de edad con el valor máximo llegaba a 100% y dejaba 0% de espacio para su propio número, empujándolo fuera del contenedor — visible en pantalla si hay margen ambiente de la página, pero cortado en la imagen exportada porque `exportElementAsImage` captura exactamente el recuadro del nodo, sin margen para overflow. **Primer fix (revertido — incorrecto):** tope de 80% en el ancho de la barra — corregía el corte pero aplanaba la lectura de proporciones (varios grupos con valores distintos entre 61k-76k se veían con la misma longitud de barra), detectado por el usuario en verificación visual. **Fix correcto:** la etiqueta pasa a una columna de ancho fijo (`shrink-0`) fuera del cálculo de porcentaje; la barra se escala 0-100% dentro de un "carril" (bar-track, `flex-1` anidado) que ya excluye el ancho de la etiqueta — a cualquier valor, incluido el máximo, la barra llena como mucho su propio carril sin invadir la columna de la etiqueta. Proporcionalidad exacta entre barras preservada, sin tope artificial. **(2) Serie temporal** (`SerieTemporalGrafica`) — las etiquetas de los puntos extremos (año/valor en x=0% y x=100%) se centran con `-translate-x-1/2`, así que la mitad del texto ("0.759", "2020") cae fuera del contenedor en los bordes; el contenedor solo tenía `mx-1` (4px) de margen. Fix: `mx-8` (32px). **(3) Defensa en profundidad**: el wrapper `graficaRef` (el nodo que captura `exportElementAsImage`) de los 3 tipos gráficos pasa de `p-1` a `p-4` — más margen base para cualquier overflow menor no cubierto por los 2 fixes anteriores. `tsc --noEmit` y `next build` limpios. |
| 26-09-06 | Fontana T10 — verificación en navegador post-fix de catálogo: 4 hallazgos, `nivelObjetivoSerie` corregido | **Punto 1 (corrección de premisa, sin fix):** el "motivo fabricado" reportado ("El IDH y sus sub-índices solo existen a nivel municipal en PNUD...") en realidad es el `motivo` LITERAL de `resolverSeriePnud` (`pnud.ts:438`) — coincide palabra por palabra. El guard `VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO` no lo bloqueó porque no debía: el texto SÍ estaba respaldado. No hay una nueva forma de fabricación evadiendo el guard. **Punto 2 (CONFIRMADO, causa real distinta a la hipótesis inicial de "catálogo corrupto tipo ITER"):** el catálogo de nombres de PNUD ya usa `claveCanonicaMunicipio` y está verificado 16/16 para las alcaldías de CDMX (comentario de cabecera `pnud.ts:22-24`, mismo dataset que usa la serie) — el catálogo estaba bien. El bug real: `nivelObjetivoSerie` (`lib/fontana/series/tipos.ts`) NUNCA intentaba "municipal" para proyectos `distrito_local`/`distrito_federal`/`distrito` (legacy) — solo probaba "estatal", pase lo que pase — aunque el indicador SÍ publicara serie municipal y el `territorio.municipio` ya viniera resuelto (vía `extraerCiudadCabecera`, ya cableado en cada resolver desde el Incremento 4). Afectaba a los 5 resolvers que usan la función (`coneval`, `enigh`, `pnud`, `stpsHuelgas`, `inegiPm`) — con 2 síntomas distintos según si el indicador tenía o no nivel "estatal" como alternativa (F2-5/20/21/22 → motivo genérico de "no existe a ese nivel"; F2-3 → silenciosamente devolvía el dato de TODO el estado en vez de intentar el municipio). **Fix:** la función ahora prueba "municipal" ANTES que "estatal" para los 4 tipos con municipio resoluble (municipal + los 3 distrito_*), y sigue sin tocar el camino "estatal puro" (nunca intenta municipal ahí, correcto). Verificado con 8 casos de regresión (pura función, incluye los 2 casos de no-regresión pedidos: estatal puro con indicador estatal+municipal sigue en estatal; distrito_local con indicador solo nacional/estatal sigue cayendo a estatal) — los 8 pasan. Verificación end-to-end con datos REALES: `resolverSeriePnud("F2-21", iztapalapa)` y `resolverSerieConeval("F2-3", iztapalapa)` con un `Territorio` sintético `distrito_local` → ambos devuelven ahora la serie MUNICIPAL real de Iztapalapa (IDH-Ingreso 2010/2015/2020: 0.787/0.805/0.759; Rezago Social 2000-2020 con sus 5 valores reales), no un motivo de error. **Punto 3 (CONFIRMADO, hueco de cobertura real, no regresión de una regla que dejó de aplicar):** la regla "IDs de indicador son internos" (`systemPrompt.ts`) nunca prohibió citar el nombre snake_case de una tool — solo cubría IDs y narración de proceso HACIA ADELANTE. El modelo, al autocorregirse ante la corrección del usuario, citó `listar_indicadores_activos_todas_familias` literal. **Fix (prompt + guard server-side, mismo patrón que los 2 guards anteriores):** sección renombrada "Los IDs de indicador y los nombres de herramientas son internos" con prohibición explícita + ejemplo del incidente + cobertura explícita del contexto retrospectivo/autocorrección; guard nuevo en `chat/route.ts` (`contieneNombreHerramienta`, chequeo EXACTO —no regex difusa— contra los 8 nombres reales de `FONTANA_TOOLS`) que fuerza una corrección si el texto final cita cualquiera; probado contra la frase real de la transcripción (detecta) y 2 frases limpias (no detecta, sin falsos positivos). **Punto 4 (CONFIRMADO, sin implementar — decisión de producto pendiente del usuario):** `useChatStream.ts:89-96` pinta cada `text_delta` en pantalla EN VIVO, antes de saber si esa iteración terminará suprimida (`chat/route.ts` solo decide después de `finalMessage()`, cuando todo el texto de la iteración ya viajó) — el parpadeo es consecuencia directa y esperada del diseño "pintar en vivo, decidir después", no un bug de temporización menor. 3 rutas evaluadas (buffer cliente, buffer servidor por iteración, heurística de detección temprana) — ninguna es gratis: todas sacrifican el streaming token-a-token de la iteración FINAL para eliminar el parpadeo de las intermedias, porque no se puede saber de antemano si el modelo llamará una herramienta después de escribir texto. Usuario decidió mantener streaming en vivo, aceptar el riesgo residual — sin cambios este punto. `tsc --noEmit` y `next build` limpios. |
| 26-09-05 | Fontana T10 — catálogo de series históricas mal etiquetado (incidente Iztapalapa) — 2 bugs, 3 fixes | **Diagnóstico (sin forense de Firestore — la sesión pegada no existe en las 12 sesiones reales de producción; solo lectura de código/registry):** el usuario reportó 5/11 indicadores mal etiquetados en la tabla de "qué tiene serie histórica" para un proyecto municipal (Iztapalapa). **Bug 1:** `listar_indicadores_familia`/`listar_indicadores_activos_todas_familias` (`tools.ts`) exponían `tieneSerie` (booleano) pero NUNCA `niveles` — la columna "Nivel de la serie" que el modelo mostraba era pura inferencia del NOMBRE del indicador ("IDH Municipal"→"Municipal"), sin respaldo de ningún tool result. **Bug 2 (confirmado leyendo `data/fontana/INDICATOR_REGISTRY.json` directamente):** los 13 indicadores YA cableados en `SERIES_DISPONIBLES` (incluido F2-17, el piloto original, no solo los 5 reportados) conservaban `disponibilidadTemporal.categoria:"a"/"c"` con nota "función pendiente" — nunca actualizado al construir su conector real (2ª ola, 26-09-03). El modelo, al no encontrar el motivo real de la falla, reciclaba ese vocabulario stale ("el conector no está activo" — frase que solo existe en `systemPrompt.ts` como explicación de categoría "b", ni siquiera la "a" real del registry) en vez de citar el `motivo` real de `resolverSeriePnud`/`resolverSerieConeval` (`Municipio "X" no reconocido...`) — violación de la regla ya existente de reportar el motivo verbatim. **Fixes:** **(1)** `scripts/fix-fontana-series-disponibilidad-sync.ts` puso `disponibilidadTemporal: null` en los 13 IDs de `SERIES_DISPONIBLES` (diff verificado contra Storage antes de subir — solo cambió ese campo, en esos 13 IDs; subido con `upload-fontana-registry.ts`); guard permanente `scripts/verify-fontana-series-disponibilidad-sync.ts` (falla si algún ID de `SERIES_DISPONIBLES` conserva categoría no-null; probado en ambas direcciones — pasa limpio y detecta una desincronización de prueba deliberada). **(2)** `nivelesSerie` (de `SERIES_DISPONIBLES[id].niveles`) expuesto junto a `tieneSerie` en `indicadoresActivos`/`catalogoCompleto` de las 2 herramientas de catálogo; system prompt instruye usarlo literal, nunca inferir del nombre. **(3)** guard server-side nuevo en `chat/route.ts` (mismo espíritu que `AFIRMA_RESULTADO`) — `VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO` (conector/función pendiente/no está activo-conectado): si el texto final usa ese vocabulario y NINGÚN resultado real de herramienta del turno (`toolResultTextsAcum`, nuevo acumulador) lo contiene, se descarta y fuerza una corrección; probado con 8 casos (3 frases reales de la transcripción, 4 motivos reales del código de los resolvers, 1 caso legítimo simulando que la herramienta sí trae ese vocabulario) — los 8 correctos. System prompt: sección nueva "Nunca inventes POR QUÉ algo no está disponible". **(4) Forense de Iztapalapa: NO localizado** — las 12 sesiones reales de `fontana_sesiones` no incluyen ninguna con territorio Iztapalapa; la corrección se apoya en la evidencia de código (registry + tools + regex), no en un dump real de esa conversación. `tsc --noEmit` y `next build` limpios. |
| 26-09-05 | Fontana T10 — 3 ajustes de UI: bulk add/clear indicadores, composer a 2 niveles, descargar/eliminar en Canvas | **1:** botones "Añadir todos los indicadores"/"Limpiar indicadores" en `FontanaIndicadoresAccordion.tsx` (mismo patrón visual `text-[11px] underline` que "Seleccionar todos"/"Limpiar seleccionados" de `FontanaMunicipiosModal.tsx`) — nueva rama bulk en el PATCH de `sesion/[sesionId]/route.ts` (`accion:"agregar_todos"\|"quitar_todos"`, catálogo completo importado server-side igual que ya hace `familia/[familiaId]/route.ts`); "quitar_todos" solo vacía `seleccionUsuario` (los `minimos`/candado viven en array separado, nunca se tocan — sin necesidad de filtrar). **2:** composer del chat compartido (`ChatPanel.tsx`) reestructurado de 1 fila a 2 niveles: textarea sola arriba a todo el ancho, adjuntar+dictado abajo a la izquierda (centro vacío), botón enviar fuera de la columna con `self-stretch` (pasa de círculo fijo 36×36 a `rounded-2xl w-11` con alto = las 2 filas combinadas). **3 (investigación previa + implementación):** kebab (⋮) en `FontanaCanvasItemCard.tsx` con Descargar/Eliminar. Descargar PDF (resumen/tabla/desglose) reutiliza **literal** `lib/shared/reportExport.ts` (`exportToPdf`+`buildFilename`, mismo mecanismo popup+`window.print()` de Moddulo/PESTEL) vía serializador nuevo `lib/fontana/canvasExport.ts` (`canvasItemToMarkdown`, solo contenido, no mecanismo). Descargar PNG/JPG (grafica/distribucion/serie_temporal) — verificado por grep que NO existía ningún precedente de captura DOM→imagen en el repo — primera instancia con `html-to-image` (dependencia nueva, liviana, sin deps nativas), envuelta en util **compartida** `app/components/shared/exportElementAsImage.ts` (no enterrada en Fontana) para que el próximo módulo la reutilice. Eliminar = borrado suave: `FontanaCanvasItemBase.eliminado?: boolean` (mismo patrón que `FontanaSesion.archivada`), nueva rama PATCH `{canvasItemId, eliminarCanvasItem:true}` (Firestore no permite update parcial de un elemento de array — se lee y reescribe completo), `FontanaCanvasTab` filtra `!eliminado` al renderizar. Modal de confirmación: mirror inline de `FontanaSesionesHub.tsx` (`SesionCard`) — no existe componente compartido de confirmación en el repo, se documenta como hallazgo. Texto del modal deliberadamente honesto sobre el borrado suave ("Dejará de verse en tu Canvas", sin "no se puede deshacer"/"permanente", que sí aplica en `SesionCard` porque ahí es borrado duro). "Ver en Canvas": confirmado que hoy NO apunta a un item específico (solo cambia de pestaña, sin scroll/resaltado por `canvasItemId`) — sin cambio de alcance esta ronda, decisión explícita del usuario. Verificado: `canvasItems` son snapshots de valores ya resueltos, sin dependencia de la selección activa de indicadores (grep sin resultados en `FontanaCanvasTab`/`FontanaCanvasItemCard` sobre `indicadoresPorFamilia`) — "Limpiar indicadores" no afecta tarjetas de Canvas ya generadas. `tsc --noEmit` y `next build` limpios. |
| 26-09-05 | Fontana T10 — 2 fallos post-fix `confirmadoLote`: umbral de lote penaliza selección explícita + re-llamada redundante duplica tarjetas | **Fallo 1 (umbral):** tras la pregunta correcta del agente, el usuario nombró 3 municipios explícitos en una sola respuesta ("solo Guadalajara, Zapopan y Tlaquepaque") — caso que la regla original decía que pasaba directo — pero el 3º (Tlaquepaque) se bloqueó igual, porque `limiteTerritoriosLote` contaba territorios DISTINTOS en el turno sin mirar si el usuario ya los había nombrado. **Fix:** `territorioNombradoPorUsuario()` (`tools.ts`) — compara (vía `normalizeGeoName`) el territorio de la llamada contra `ctx.ultimoMensajeUsuario` (el mensaje que disparó el turno, nuevo campo en `ToolContext`/`chat/route.ts`); match por substring completo O por último token ≥4 caracteres (cubre que el modelo expanda "Tlaquepaque" a "San Pedro Tlaquepaque"). Si el usuario ya lo nombró, esa llamada NO cuenta hacia el límite — sin tope de cantidad (se rechazó deliberadamente subir el número mágico de 3 a otro). **Fallo 2 (GRAVE, re-llamada redundante) — forense de Firestore de la sesión real (`vO9JFif6W3UQc7DlyqPq`) ANTES de tocar código:** confirmado que NO hubo alucinación esta vez (Tlaquepaque sí se generó y persistió, turno `d4cab890`) — el problema apareció en el turno SIGUIENTE, al pedir "lectura comparativa de estas tres gráficas": el agente volvió a llamar `generar_visualizacion` para Guadalajara/Zapopan (duplicando sus tarjetas) y Tlaquepaque (bloqueada de nuevo, 3ª del turno). Causa raíz: `generar_visualizacion` es la ÚNICA herramienta que devuelve los valores numéricos de una pirámide (`piramideSexo`) al modelo — no existe un tool de solo-lectura equivalente para F1-2 — y `historial` (`chat/route.ts`) reconstruye cada turno solo con el TEXTO narrado de mensajes previos, nunca con los `tool_result` crudos, así que el modelo estructuralmente no tiene forma de "releer" los números sin volver a llamar la herramienta. Confirmado con el usuario: no es un caso aislado, es arquitectónico. **Fix (2 capas, ambas por decisión explícita del usuario — no una en vez de la otra):** capa prompt (`systemPrompt.ts`) instruye que si el resultado trae `yaExistiaEnCanvas:true` no se anuncia "agregué/generé"; capa server-side (la que realmente evita el problema, sin depender de que el modelo obedezca) — `FontanaCanvasDistribucion` gana `territorioLabel?: string` (mismo campo que ya tenía `FontanaCanvasSerieTemporal`, poblado en `construirCanvasDistribucion`); `ToolContext.canvasItemsSesion: FontanaCanvasItem[]` (snapshot de `sesion.canvasItems` al iniciar el turno, mutado in-place según se agregan tarjetas EN el turno); `buscarCanvasItemExistente()` compara `indicadorId+territorioLabel` (match bidireccional por substring, sirve tanto para la aproximación pre-fetch en `limiteTerritoriosLote` con el nombre crudo como para el match exacto post-fetch) — si ya existe, la rama F1-2/F1-11 de `generarVisualizacion` y `generarSerieTemporal` devuelven los datos de la tarjeta EXISTENTE (`yaExistiaEnCanvas:true`, sin `canvasItem` en el resultado) en vez de duplicar la escritura en Firestore; `limiteTerritoriosLote` tampoco cuenta esa llamada hacia el límite. **Verificación:** heurística de Fallo 1 probada contra los textos reales de la transcripción (5/5 casos, incluida la frase real "Sólo dame los de Guadalajara, Zapopan y Tlaquepaque."); matcher de Fallo 2 probado contra los labels reales del dump ("Guadalajara" vs "GUADALAJARA, JALISCO", etc., 6/6 casos). `tsc --noEmit` y `next build` limpios. |
| 26-09-04 | Fontana T10 — `confirmadoLote` deja de ser un booleano ciego (2ª forma de falla, 8 municipios de Jalisco) | Forense (mismo método): tras el fix del guard B, el modelo SÍ preguntó algo antes de generar — pero preguntó el TIPO de gráfica ("¿pirámide o urbano/rural?"), y al responder el usuario ("sí, pirámide de edades") el modelo trató esa respuesta como confirmación del LOTE DE MUNICIPIOS, mandando `confirmadoLote:true` en las 8 llamadas desde la primera (turno `84de2db5`, 2026-09-04T18:15:04Z, verificado en el dump). Causa: `confirmadoLote` era un booleano autoreportado sin verificación semántica — mismo principio ya aplicado en el guard A (nunca confiar en lo que el modelo afirma de sí mismo sin contrastarlo con la conversación real). **Fix:** `ToolContext.municipiosPreguntadosPrevio: boolean` (nuevo campo, `chat/route.ts`) — calculado del ÚLTIMO mensaje real del asistente (excluyendo `id:"welcome"`) contra `esPreguntaDeMunicipios()`: dos coincidencias independientes, menciona "municipio(s)" Y lenguaje de cantidad/selección (`cuál(es)`, `cuánto(s)`, `todos`, `todas`, `en particular`, `algunos`). `limiteTerritoriosLote` (`tools.ts`) solo honra `confirmadoLote:true` si además `ctx.municipiosPreguntadosPrevio` es cierto; si no, cae al conteo normal (3ª sin confirmar bloquea) y deja un `console.warn` no bloqueante (`[fontana] confirmadoLote:true rechazado...`) para medir con qué frecuencia el modelo intenta el atajo. System prompt reforzado en el bloque "Flujo de lote confirmado": el flag nunca vale por haber contestado OTRA pregunta (tipo, formato), y el servidor lo verifica de forma independiente. **Verificación manual de la heurística** (8 casos, incluida la transcripción real que falló): 1 falso negativo encontrado y corregido antes de cerrar la ronda — `cu[aá]les?` no matcheaba el singular "cuál" (le faltaba la rama sin "es"), corregido a `cu[aá]l(es)?`; los 8 casos pasan tras el ajuste, incluida la pregunta real "¿de cuál de los 8 municipios quieres ver la evolución?". `tsc --noEmit` y `next build` limpios. |
| 26-09-03 | Fontana T10 — `distribucion` con territorio explícito + guard multiMunicipio (F1-2/F1-11) | Mismo patrón que `serie_temporal`, extendido a `generar_visualizacion tipo:"distribucion"`. Ruta nueva `GET /api/fontana/distribucion` (F1-2 pirámide / F1-11 urbano-rural — ambos vía `resolverIndicadorIter`, que acepta cualquier `Territorio`): sin `territorio` y proyecto plural municipal → `{ok:false, multiMunicipio:true, municipios:[...]}`; con `territorio` → `resolverTerritorioNombre` + `esTerritorioExterno`/`esTerritorioDelProyecto`. `tools.ts`: `generar_visualizacion` schema gana `territorioNombre`/`estadoNombre` para `distribucion`; F1-2/F1-11 pasan por la ruta nueva (rechazo con instrucción "pregunta a cuál/cuáles municipios, una tarjeta por cada uno, nunca combines"), F1-12/F2-12 siguen por el flujo de familia (rechazan `territorioNombre`). System prompt: bloque de territorio para `distribucion` de F1-2/F1-11. Verificado: proyecto plural → `multiMunicipio` con los 3 municipios; `territorioNombre:"Jalisco"` → pirámide estatal (POBTOT 8,348,151) con `esTerritorioExterno:true`; `territorioNombre:"Zapopan"` (del proyecto) → `esTerritorioDelProyecto:true`; proyecto singular sin cambios; F1-11 "Jalisco" → %urbano 87.95. |
| 26-09-03 | Fontana T10 — fix sistémico de resolución de nombres de municipio (ITER) | **Causa raíz (byte a byte):** `scripts/fontana-iter-pipeline.ts` leía los CSV del ITER (UTF-8) como `latin1` → `NOM_MUN` acentuados quedaban mojibake (`TONALÃ¡`) en `iter_2020/catalogo_municipios/{NN}.json` → todo municipio acentuado fallaba en `resolverMunicipioCveIter` (Tonalá, Tlajomulco de Zúñiga, Juanacatlán, Cuauhtémoc/CDMX, Oaxaca de Juárez…). NO era divergencia de normalización ni fallo de `resolverTerritorioNombre` (ese resuelve bien). **Fix:** (a) módulo puro nuevo `lib/geo/municipioCanonico.ts` (`normalizeGeoName`, `normalizarNombreMunicipio`, `ALIAS_MUNICIPIO`, `claveCanonicaMunicipio` — sin firebase/topojson; `municipios.ts` lo re-exporta, importadores sin cambio); (b) pipeline lee `utf-8` y keyea el catálogo con `claveCanonicaMunicipio` (misma función que el query time — se elimina el `normalizeGeoName` local que podía divergir); (c) `conapo.ts` y `compendio.ts` (otros 2 consumidores del catálogo) alineados a `claveCanonicaMunicipio`; la ruta `familia/[id]/municipios` ya no usaba el catálogo. Bodega **re-subida** con validación round-trip: **INE→catálogo 32/32 estados** (28 al 100%, 4 con municipios creados post-Censo-2020 sin fila ITER, Oaxaca 570/570 con la colisión conocida SAN JUAN/PEDRO MIXTEPEC documentada). Verificado en vivo: Tonalá POBTOT 569,913 · Tlajomulco de Zúñiga 727,750 · Juanacatlán 30,855 · Cuauhtémoc CDMX 545,884 · CONAPO F2-4 Tlajomulco 48.66 · Compendio densidad 1017.52 · 0 llaves con mojibake. **Prompt:** frase colectiva ("los municipios del proyecto") ya NO autoriza al modelo a enumerar y disparar N tarjetas — pregunta primero; solo nombrar municipios explícitos autoriza generación directa. |