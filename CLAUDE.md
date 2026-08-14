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
| Captura de distrito electoral sin estructura en `TerritorySelector.tsx` | TerritorySelector.tsx (compartido por Moddulo y PESTEL) captura el número de distrito electoral y la descripción de su cabecera en un único campo de texto libre, sin separación estructurada entre ambos. Fontana depende de parsear ese texto (vía `extraerCiudadCabecera()`, regex sobre la frase "con cabecera en X") para resolver la alcaldía/municipio dominante en proyectos de nivel distrito_federal/distrito_local — si el texto no sigue ese formato exacto (como el proyecto de prueba de CDMX, Distrito Local 27), Fontana no puede determinar el municipio y muestra el texto de "sin municipio definido" aunque el dato geográfico real sí exista en el catálogo de Fontana (`cabeceras_loc.json`). Recomendación evaluada y descartada: un selector/catálogo de distritos por país (mala UX fuera de México, catálogos inmanejables). Recomendación pendiente de evaluar en el chat de Moddulo: separar el campo actual en dos inputs de texto libre — (a) identificador del distrito, (b) descripción/cabecera — sin necesidad de catálogo por país, solo para que Fontana pueda cruzar por estado + identificador de distrito en vez de depender del parseo de una frase completa. Proyecto de prueba `nZvpYu4nnZrsw5hoGcVP` (CDMX, Distrito Local 27) se deja sin modificar deliberadamente, como caso de verificación para cuando se implemente el fix real. | 26-08-12, revisión de consistencia Fontana T10 (Incremento 4) |

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