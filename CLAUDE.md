# CLAUDE.md — Eskemma

Contexto e instrucciones para el desarrollo del proyecto.
**Actualizar al cerrar cada sprint.**

---

## Idioma y Commits

- Responder siempre en **español**
- Código y comentarios técnicos en **inglés**
- Formato de commits obligatorio: `YY-MM-DD. <descripción>`
  - Ejemplo: `26-03-27. feat(centinela): refactorizar trigger a fire-and-forget`

---

## Qué es Eskemma

Plataforma SaaS de consultoría política con IA, orientada a consultores,
equipos de campaña y funcionarios públicos en México.

| Ruta | Módulo | Estado |
|------|--------|--------|
| `/moddulo` | Moddulo — gestión de proyectos políticos con IA (9 fases) | Activo |
| `/monitor/centinela` | Centinela — análisis PEST-L en tiempo real | En desarrollo |
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
│   │   └── monitor/centinela/        # config, feed, trigger, status
│   ├── components/
│   │   ├── monitor/centinela/dashboard/  # RiskVectorWidget, PESTLPanel
│   │   └── moddulo/
│   ├── monitor/centinela/
│   │   ├── page.tsx                  # Hub (lista de análisis)
│   │   └── analisis/[id]/page.tsx    # Vista individual PEST-L
│   └── moddulo/proyecto/[projectId]/[phaseId]/
├── lib/
│   ├── ai/claude.ts                  # Instancia Anthropic
│   ├── server/                       # Utilidades solo servidor
│   └── monitor/centinela/            # Lógica Centinela
├── types/
│   ├── centinela.types.ts
│   ├── moddulo.types.ts
│   ├── firestore.types.ts
│   ├── session.types.ts
│   └── subscription.types.ts
├── context/AuthContext.tsx
├── functions/src/centinela/          # Cloud Functions (build separado)
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
| `centinela_configs` | Configuraciones legacy (V1) — solo lectura |
| `centinela_feeds` | Resultados PEST-L V1 legacy (`vigente: true/false`) |
| `centinela_projects` | Proyectos V2 con tipo, nombre, horizonte, etapa |
| `centinela_variable_configs` | Config variables PEST-L por proyecto (E3) |
| `centinela_analyses` | Resultados PEST-L V2 (`PestlAnalysisV2`) |
| `centinela_data_sources` | Datos manuales cargados en E4 |
| `centinela_jobs` | Estado de jobs (`pending/running/completed/failed`) |
| `centinela_raw_articles` | Artículos crudos del scraper |
| `centinela_alerts` | Alertas por umbral de riesgo |
| `notifications` | Notificaciones in-app |
| `newsletter_subscribers` | Suscriptores |
| `resources` | Recursos descargables |

**Regla**: queries con `where` + `orderBy` requieren índice compuesto en
Firestore. Si no existe, la query falla silenciosamente. Preferir ordenar
en memoria cuando el volumen es pequeño (< 100 docs por usuario).

---

## Centinela — Arquitectura y Estado

### Flujo completo V2 (activo)

```
Wizard E1-E3: usuario crea centinela_projects + centinela_variable_configs
  ↓
E4 /datos: agrega fuentes manuales → semáforo cobertura
  → POST /api/monitor/centinela/project/[id]/data-source
  → GET  /api/monitor/centinela/project/[id]/coverage
  ↓
Botón "Ejecutar análisis IA" (habilitado solo si ningún 🔴 en semáforo)
  → POST /api/monitor/centinela/trigger { projectId }
  → Pre-crea job (status: "pending") en centinela_jobs
  → Llama scrapeAndAnalyze CF sin esperar (fire-and-forget)
  → Retorna { jobId } inmediatamente
  ↓
Frontend polling a /api/monitor/centinela/status?jobId=
  ↓
Cloud Function scrapeAndAnalyze (V2 path):
  → Ejecuta 4 scrapers en paralelo (Promise.allSettled)
  → Guarda artículos crudos en centinela_raw_articles
  → Llama generateAnalysisV2:
      → 5 llamadas paralelas a Claude (una por dimensión P/E/S/T/L)
      → 1 llamada adicional para cadenas de impacto
      → Detección de sesgos determinística (sin Claude)
      → Calcula globalConfidence ponderado
      → Guarda centinela_analyses (PestlAnalysisV2)
  → Actualiza job (status: "completed", analysisId)
  ↓
Frontend detecta "completed" → carga análisis → muestra E5
```

### Páginas V2

```
/monitor/centinela                           Hub (centinela_projects)
/monitor/centinela/nuevo                     Wizard E1-E3
/monitor/centinela/[projectId]/datos         E4 — semáforo + carga manual
/monitor/centinela/[projectId]/analisis      E5 — resultados IA (PESTLPanelV2)
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

Las decisiones de UX y metodología de Centinela están en `_docs/specs/centinela/`.
**Leer la spec del módulo antes de desarrollar cualquier componente de Centinela.**

| Archivo | Módulo |
|---------|--------|
| `_docs/specs/centinela/00_contexto_metodologico.md` | Por qué existe Centinela, lógica PEST-L |
| `_docs/specs/centinela/01_onboarding.md` | Configuración del proyecto (tipo, equipo, horizonte) |
| `_docs/specs/centinela/02_territorio.md` | Definición geográfica, institucional, electoral |
| `_docs/specs/centinela/03_variables.md` | Variables PEST-L por tipo de proyecto, pesos, indicadores |
| `_docs/specs/centinela/04_datos.md` | Recolección modo mixto, semáforo de cobertura |
| `_docs/specs/centinela/05_procesamiento_ia.md` | Capas de análisis, prompts base, detección de sesgos |
| `_docs/specs/centinela/06_interpretacion.md` | Matriz impacto/probabilidad, human-in-the-loop |
| `_docs/specs/centinela/07_informes.md` | Formatos de salida, scorecard, escenarios |
| `_docs/specs/centinela/08_monitoreo.md` | Dashboard, alertas, modo crisis |
| `_docs/specs/centinela/data_model.md` | Entidades TypeScript compartidas |

### Decisiones metodológicas no negociables

Estas decisiones complementan las reglas técnicas ya documentadas arriba.
No propongas alternativas sin consultar primero.

1. **Human-in-the-loop obligatorio.** Ningún output de IA en Centinela es
   definitivo hasta validación explícita del usuario. La IA clasifica y
   propone; el analista decide. Aplica especialmente a la Etapa 6
   (interpretación) y a cualquier reclasificación de factores PEST-L.

2. **Variables por tipo de proyecto.** Cada tipo de proyecto (electoral,
   gubernamental, legislativo, ciudadano) activa un conjunto distinto de
   variables PEST-L por defecto. Estos conjuntos están definidos en
   `_docs/specs/centinela/03_variables.md` — no inventarlos en código.

3. **Detección de sesgos en Etapa 5.** El procesamiento IA debe detectar
   y reportar: sesgo urbano, sesgo etario digital, sobrerepresentación de
   fuentes digitales sin validación de campo, y contradicciones entre datos
   oficiales y percepción ciudadana. No es un feature opcional.

4. **Modo mixto de datos por defecto.** Centinela combina siempre fuentes
   automáticas (APIs, scraping) con carga manual del equipo. No existe un
   modo "solo automático".

5. **Semáforo de cobertura visible.** El indicador verde/amarillo/rojo por
   dimensión PEST-L debe mostrarse desde la Etapa 4 y mantenerse visible
   en las Etapas 5 y 6. Un análisis no avanza si alguna dimensión está en rojo.

### Principios de diseño de Centinela

Estos principios rigen las decisiones de UX y arquitectura del sistema. No
son negociables y aplican a todas las etapas, incluyendo las futuras E6-E8.

1. **Transparencia metodológica.** Toda salida de IA debe incluir su nivel
   de confianza y las fuentes que la respaldan. El usuario siempre sabe qué
   datos usó el sistema y qué tan confiables son. Las narrativas deben citar
   sus fuentes con el formato `(Fuente: nombre, fecha)`.

2. **Trazabilidad.** Cada análisis debe poder reconstruirse: qué artículos
   se usaron, qué variables estaban activas, qué fecha. Los documentos
   `centinela_analyses` conservan el `jobId` de origen que apunta al
   documento `centinela_raw_articles` con los datos crudos.

3. **Colaborador estratégico, no oráculo.** Centinela propone; el analista
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
- En la fase `exploracion` (F2), Moddulo debe consumir Centinela para
  generar el análisis PEST-L del territorio del proyecto.

---

## Suscripciones

| Rol | Plan | Precio MXN | Acceso relevante |
|-----|------|-----------|------------------|
| `user` | freemium | $0 | Blog, Redactor limitado |
| `basic` | basic | $2,899/mes | + Cursos, Sefix |
| `premium` | premium | $5,899/mes | + Monitor, Moddulo |
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
| `_docs/centinela-engineering-plan.md` | Plan de ingeniería detallado de Centinela |
| `_docs/specs/centinela/` | Especificaciones funcionales de Centinela (9 archivos) |

---

## Historial de Sprints

| Fecha | Sprint | Resultado |
|-------|--------|-----------|
| 26-03-24 | Fase 0 Monitor | Base del hub Monitor, homepage fixes |
| 26-03-25 | Centinela F1+F2 | Scraping + clasificación PEST-L completados |
| 26-03-26 | Centinela F3 inicio | 1ª versión UI dashboard Centinela |
| 26-03-27 | Centinela F3 cont. | Hub multi-territorio + página análisis individual |
| 26-03-27 | Centinela rediseño E1-E5 | Rediseño completo alineado con specs: wizard E1-E3, semáforo E4, análisis por dimensión E5, tipos V2, nuevas colecciones Firestore |
| 26-03-28 | Centinela correcciones post-E5 | Persistencia análisis (latest-analysis endpoint), fix economicData INEGI/Banxico→Claude, contexto legal LGIPE/INE, citación fuentes, integración Sefix (datos electorales dim-P), semáforo amarillo texto negro, principios de diseño en CLAUDE.md |