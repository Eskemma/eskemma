# PROJECT AUDIT — Eskemma

> Auditoría técnica del estado actual del repositorio.
> Generado: 2026-06-23 · Actualizar al cerrar cada sprint mayor.

---

## 1. Estructura de carpetas

```
eskemma/
├── _archive/                        # Código deprecated (no importar)
├── _docs/                           # Documentación interna de producto
│   └── specs/pestel/             # Especificaciones funcionales PESTEL (9 archivos)
├── _moddulo-docs/                   # Documentos comerciales del módulo Moddulo
├── app/                             # App Router de Next.js
│   ├── api/                         # 83 route handlers
│   │   ├── admin/                   # 9 rutas de administración
│   │   ├── auth/                    # 2 rutas (sesión, buscar usuario)
│   │   ├── contact/                 # 1 ruta
│   │   ├── cursos/                  # 1 ruta (progreso taller)
│   │   ├── geo/                     # 2 rutas (formas TopoJSON, opciones)
│   │   ├── moddulo/                 # 7 rutas (chat SSE, CRUD proyectos, exportar)
│   │   ├── centinela/pestel/       # 39 rutas (proyectos, análisis, alertas, trigger)
│   │   ├── newsletter/              # 4 rutas
│   │   ├── notifications/           # 1 ruta
│   │   ├── posts/                   # 6 rutas (blog CRUD, likes, vistas)
│   │   └── sefix/                   # 30 rutas de datos electorales
│   ├── blog/                        # Blog El Baúl de Fouché
│   │   ├── [slug]/                  # Artículo individual (12 componentes)
│   │   └── admin/                   # Panel administración blog
│   ├── components/                  # 92 componentes compartidos
│   │   ├── componentsBlog/          # 14 componentes de blog
│   │   ├── componentsCursos/        # 17 componentes de cursos
│   │   ├── componentsHome/          # 23 modales y secciones del home
│   │   ├── geo/                     # 5 componentes de mapas Leaflet
│   │   ├── legal/                   # 6 componentes legales
│   │   ├── moddulo/                 # 2 componentes (modal, en construcción)
│   │   ├── centinela/pestel/       # 24 componentes del dashboard PESTEL
│   │   └── ui/                      # 1 componente (InfoTooltip)
│   ├── hooks/                       # 4 hooks de cliente
│   ├── moddulo/                     # Módulo Moddulo (9 fases + redactor)
│   │   ├── proyecto/[projectId]/    # Fases F1–F9 (9 page.tsx)
│   │   ├── redactor/                # App Redactor + 6 componentes
│   │   └── components/              # 4 componentes compartidos Moddulo
│   ├── centinela/pestel/           # Módulo PESTEL E1–E8
│   │   ├── [projectId]/             # Vistas por etapa (datos, análisis, interpretación, informes)
│   │   └── analisis/[id]/           # Vista individual de análisis
│   ├── sefix/                       # Dashboard SEFIX + componentes
│   └── [otras rutas públicas]       # contacto, faq, cursos, servicios, blog, etc.
├── context/                         # AuthContext.tsx (hook useAuth)
├── data/                            # CSVs y JSONs del padrón electoral (DERFE/INE)
│   └── pdln/                        # Datos semanales e históricos
├── docs/                            # Documentación técnica
│   ├── compliance/                  # 5 documentos de cumplimiento legal
│   ├── sefix_R/                     # Código Shiny original de SEFIX
│   └── specs/                       # Especificaciones SEO técnico
├── firebase/                        # Config cliente de Firebase
├── functions/                       # Cloud Functions Gen2 (Node 22)
│   └── src/pestel/               # 11 archivos: scrapers, análisis, scheduler
├── info_geo_eske/                   # Geodatos masivos INE/INEGI (32 estados)
├── lib/                             # Lógica compartida (solo servidor o isomórfica)
│   ├── ai/                          # Cliente Claude + prompts de 9 fases
│   ├── pestel/                   # Utilidades de exportación y reportes
│   ├── constants/                   # Categorías, cursos, recursos
│   ├── geo/                         # Utilidades de color y JSON geográfico
│   ├── moddulo/                     # Lógica de proyectos, riesgos, changelog
│   ├── redactor/                    # Lógica del generador de contenido
│   ├── sefix/                       # 11 utilidades especializadas de datos electorales
│   └── server/                      # Helpers exclusivos de servidor (sesión, posts)
├── public/                          # Assets estáticos (imágenes, íconos, SVGs)
├── scripts/                         # 17 scripts de pipeline de datos y generadores
├── types/                           # 11 archivos de tipos TypeScript
└── utils/                           # 5 utilidades (acceso, suscripción, roles, usuarios)
```

---

## 2. Stack en uso

### Frontend

| Tecnología | Versión | Notas |
|---|---|---|
| Next.js | 16.1.1 | App Router, Server Components por defecto |
| React | 19.2.3 | — |
| TypeScript | 5.x | strict mode |
| Tailwind CSS | 4.1.5 | Con `@theme` y tokens custom en globals.css |
| Leaflet + react-leaflet | 1.9.4 / 5.0.0 | Mapas coropléticos (SEFIX) |
| Recharts | 3.8.1 | Gráficas de datos electorales |
| DOMPurify | 3.2.6 | Sanitización de HTML del blog |
| date-fns | 4.1.0 | Formateo de fechas |
| remark / remark-html | 15.0.1 / 16.0.1 | Renderizado Markdown |
| react-markdown | 10.1.0 | Renderizado inline |
| topojson-client | 3.1.0 | Cartografía |
| docx | 9.5.1 | Exportación a Word (Moddulo informes) |

### Backend / Infraestructura

| Tecnología | Versión | Notas |
|---|---|---|
| Firebase Auth | 11.8.1 | Session cookies HTTP-only (5 días) |
| Firestore | 11.8.1 | Base de datos principal |
| Firebase Storage | 11.8.1 | Archivos, JSONs pregenerados de SEFIX |
| Firebase Admin | 13.6.0 | SDK servidor |
| Cloud Functions (Node) | 22 | Gen2, build separado en `/functions` |
| firebase-functions | 6.0.1 | SDK de funciones |
| Vercel | — | Deploy frontend + Edge Network CDN |

### Inteligencia Artificial

| Tecnología | Versión | Notas |
|---|---|---|
| @anthropic-ai/sdk | 0.78.0 | Modelo claude-sonnet-4-6 |
| Streaming SSE | — | Chat de Moddulo vía `/api/moddulo/chat/[phaseId]` |

### Comunicación

| Tecnología | Versión | Notas |
|---|---|---|
| Resend | 6.3.0 | Emails transaccionales (newsletter, contacto) |
| Nodemailer | 7.0.10 | SMTP de respaldo (Gmail App Password) |

### Herramientas de datos

| Tecnología | Versión | Notas |
|---|---|---|
| xlsx | 0.18.5 | Lectura de CSVs del DERFE/INE |
| pdf-parse | 2.4.55 | Extracción de texto de PDFs |
| mammoth | 1.12.0 | Conversión DOCX → HTML |
| puppeteer | 24.36.0 | Scraping (pipeline SEFIX) |
| rss-parser | 3.13.0 | Scrapers de Google News RSS en Cloud Functions |
| shapefile | 0.6.6 | Procesamiento de shapefiles INE/INEGI |
| proj4 | 2.20.8 | Proyecciones geográficas |

---

## 3. Módulos implementados y su estado

| Módulo | Ruta | Estado | Descripción |
|---|---|---|---|
| **Blog — El Baúl de Fouché** | `/blog` | ✅ Activo | CRUD completo, categorías, tags, comentarios, vistas, likes, recursos |
| **Blog Admin** | `/blog/admin` | ✅ Activo | Panel completo: posts, comentarios, tags, estadísticas |
| **SEFIX** | `/sefix` | ✅ Activo | Dashboard electoral: padrón, lista nominal, resultados, geodatos |
| **Cursos** | `/cursos` | ✅ Activo | Listado + taller interactivo con progreso por sesión |
| **Moddulo — Redactor** | `/moddulo/redactor` | ✅ Activo | Generador de contenido político con planes freemium/premium |
| **Moddulo — F1 Propósito** | `/moddulo/proyecto/[id]/proposito` | ✅ Implementado | Captura XPCTO: hito, sujeto, capacidades, tiempo, justificación |
| **Moddulo — F2 Exploración** | `/moddulo/proyecto/[id]/exploracion` | ✅ Implementado | PEST-L, actores, hipótesis, viabilidad, matriz de brechas |
| **Moddulo — F3–F9** | `/moddulo/proyecto/[id]/[fase]` | ⚠️ Esqueleto | Rutas y layouts existentes; contenido de fases en construcción |
| **PESTEL — E1–E3 Wizard** | `/centinela/pestel/nuevo` | ✅ Completado | Tipo de proyecto, territorio, variables PEST-L (3 pasos) |
| **PESTEL — E4 Datos** | `/centinela/pestel/[id]/datos` | ✅ Completado | Semáforo de cobertura, carga manual de fuentes |
| **PESTEL — E5 Análisis IA** | `/centinela/pestel/[id]/analisis` | ✅ Completado | 5 dims paralelas + sesgos + cadenas de impacto |
| **PESTEL — E6 Interpretación** | `/centinela/pestel/[id]/interpretacion` | ⚠️ En progreso | Ajuste manual, matriz, human-in-the-loop (parcial) |
| **PESTEL — E7 Informes** | `/centinela/pestel/[id]/informes` | ⚠️ En progreso | Viewer de reporte, scorecard (parcial) |
| **PESTEL — E8 Monitoreo** | `/centinela/pestel/[id]/monitoreo` | ⚠️ En progreso | Dashboard de alertas y tendencias (parcial) |
| **Centinela Hub** | `/centinela` | ✅ Activo | Landing con catálogo de herramientas |
| **Autenticación** | Transversal | ✅ Activo | Firebase Auth + session cookies HTTP-only |
| **Suscripciones** | `/suscripciones` | ⚠️ En progreso | Gestión de planes (integración de pago pendiente) |
| **Perfil** | `/profile` | ✅ Activo | Datos de usuario, avatar, contraseña |
| **Newsletter** | `/newsletter/confirm`, `/newsletter/unsubscribe` | ✅ Activo | Doble opt-in, cancelación |
| **Recursos** | `/recursos` | 🚧 Esqueleto | Placeholder (UnderConstructionPage) |
| **Planes Colaborativos** | `/planes-colaborativos` | 🚧 Esqueleto | Placeholder |
| **Pasarela de Pago** | `/pasarela-de-pago` | 🚧 Esqueleto | Placeholder sin integración |

---

## 4. Rutas existentes (App Router)

### Páginas públicas e institucionales

| URL | Archivo | Metadata SEO |
|---|---|---|
| `/` | `app/page.tsx` | ✅ title + description + OG + canonical |
| `/blog` | `app/blog/page.tsx` | ✅ completa |
| `/blog/[slug]` | `app/blog/[slug]/page.tsx` | ✅ dinámica (`generateMetadata`) |
| `/contacto` | `app/contacto/page.tsx` | ✅ vía `layout.tsx` |
| `/cursos` | `app/cursos/page.tsx` | ✅ completa |
| `/cursos/[slug]` | `app/cursos/[slug]/page.tsx` | ❌ `use client` sin metadata (deuda) |
| `/faq` | `app/faq/page.tsx` | ✅ vía `layout.tsx` |
| `/servicios` | `app/servicios/page.tsx` | ✅ title + description + canonical |
| `/sefix` | `app/sefix/page.tsx` | ✅ con canonical |
| `/centinela` | `app/centinela/page.tsx` | ✅ con canonical |
| `/recursos` | `app/recursos/page.tsx` | ❌ sin metadata (placeholder) |
| `/condiciones-de-uso` | `app/condiciones-de-uso/page.tsx` | ✅ |
| `/politica-de-privacidad` | `app/politica-de-privacidad/page.tsx` | ✅ |
| `/politica-de-cookies` | `app/politica-de-cookies/page.tsx` | ✅ |
| `/condiciones-asesorias-gratuitas` | `app/condiciones-asesorias-gratuitas/page.tsx` | ❌ `use client` |
| `/newsletter/confirm` | `app/newsletter/confirm/page.tsx` | — |
| `/newsletter/unsubscribe` | `app/newsletter/unsubscribe/page.tsx` | — |
| `/recover-password` | `app/recover-password/page.tsx` | — |

### Rutas autenticadas

| URL | Archivo | Notas |
|---|---|---|
| `/moddulo` | `app/moddulo/page.tsx` | Dashboard principal |
| `/moddulo/onboarding` | `app/moddulo/onboarding/page.tsx` | Wizard inicial |
| `/moddulo/proyecto` | `app/moddulo/proyecto/page.tsx` | Listado |
| `/moddulo/proyecto/nuevo` | `app/moddulo/proyecto/nuevo/page.tsx` | Crear |
| `/moddulo/proyecto/[id]` | `app/moddulo/proyecto/[projectId]/page.tsx` | Hub del proyecto |
| `/moddulo/proyecto/[id]/proposito` | → `[projectId]/proposito/page.tsx` | F1 ✅ |
| `/moddulo/proyecto/[id]/exploracion` | → `[projectId]/exploracion/page.tsx` | F2 ✅ |
| `/moddulo/proyecto/[id]/investigacion` | → `[projectId]/investigacion/page.tsx` | F3 ⚠️ |
| `/moddulo/proyecto/[id]/diagnostico` | → `[projectId]/diagnostico/page.tsx` | F4 ⚠️ |
| `/moddulo/proyecto/[id]/estrategia` | → `[projectId]/estrategia/page.tsx` | F5 ⚠️ |
| `/moddulo/proyecto/[id]/tactica` | → `[projectId]/tactica/page.tsx` | F6 ⚠️ |
| `/moddulo/proyecto/[id]/gerencia` | → `[projectId]/gerencia/page.tsx` | F7 ⚠️ |
| `/moddulo/proyecto/[id]/seguimiento` | → `[projectId]/seguimiento/page.tsx` | F8 ⚠️ |
| `/moddulo/proyecto/[id]/evaluacion` | → `[projectId]/evaluacion/page.tsx` | F9 ⚠️ |
| `/moddulo/redactor` | `app/moddulo/redactor/page.tsx` | ✅ Activo (freemium) |
| `/centinela/pestel` | `app/centinela/pestel/page.tsx` | Hub proyectos |
| `/centinela/pestel/nuevo` | `app/centinela/pestel/nuevo/page.tsx` | Wizard E1–E3 |
| `/centinela/pestel/[id]` | → `[projectId]/page.tsx` | Hub proyecto |
| `/centinela/pestel/[id]/datos` | → `[projectId]/datos/page.tsx` | E4 ✅ |
| `/centinela/pestel/[id]/analisis` | → `[projectId]/analisis/page.tsx` | E5 ✅ |
| `/centinela/pestel/[id]/interpretacion` | → `[projectId]/interpretacion/page.tsx` | E6 ⚠️ |
| `/centinela/pestel/[id]/informes` | → `[projectId]/informes/page.tsx` | E7 ⚠️ |
| `/centinela/pestel/[id]/monitoreo` | → `[projectId]/monitoreo/page.tsx` | E8 ⚠️ |
| `/centinela/pestel/analisis/[id]` | `app/centinela/pestel/analisis/[id]/page.tsx` | Vista individual análisis |
| `/profile` | `app/profile/page.tsx` | Perfil usuario |
| `/suscripciones` | `app/suscripciones/page.tsx` | Planes |

### Rutas de administración

| URL | Notas |
|---|---|
| `/blog/admin` | Panel de gestión del blog |
| `/blog/admin/blog` | Listado y edición de posts |
| `/blog/admin/blog/new` | Crear post |
| `/blog/admin/blog/edit/[id]` | Editar post |
| `/blog/admin/comments` | Moderación de comentarios |
| `/blog/admin/tags` | Gestión de etiquetas |
| `/admin/setup-claims` | Setup inicial de roles admin |
| `/dev/geo-test` | Prueba de geodatos (solo dev) |

---

## 5. Componentes compartidos

### Núcleo (`app/components/`)

| Componente | Propósito |
|---|---|
| `Breadcrumb.tsx` | Navegación jerárquica con JSON-LD |
| `Footer.tsx` | Pie de página global |
| `Header.tsx` | Encabezado global con navegación y autenticación |
| `Layout.tsx` | Shell principal (Header + children + Footer) |
| `NotificationBell.tsx` | Campana de notificaciones in-app |
| `SubscriptionBadge.tsx` | Indicador de plan activo |
| `UnderConstructionPage.tsx` | Placeholder genérico |

### Blog (`componentsBlog/` — 14 componentes)
`Pagination`, `Sidebar`, `PostCardList`, `PostCardSkeleton`, `CategoryFilter`, `SanitizedContent`, `NewsletterSignup`, `TagCloud`, `ViewToggle`, `BlogToolbar`, `CategoryList`, `PopularPosts`, `LoadingSpinner`, `PostsLoadingGrid`

### Cursos (`componentsCursos/` — 17 componentes)
**Listado:** `CourseCard`, `CourseGrid`, `CourseFilters`, `FeaturedCourse`, `CoursesHeroSection`, `Sidebar`, `Pagination`, `Toolbar`, y otros.
**Taller:** `ExerciseRenderer`, `ProgressTracker`, `WorkshopHeader`, `WorkshopSidebar`

### Home — Modales (`componentsHome/` — 23 componentes)
`LoginModal`, `RegisterModal`, `SignInModal`, `OnboardingModal`, `AcceptTermsModal`, `CompleteRegisterModal`, `VerifyEmailModal`, `RecoverPassword`, `SuscriptionBasicModal`, `SuscriptionPremiumModal`, `SuscriptionProfessionalModal`, `TeamModal`, `GuestContactModal`, `FaqSection`, `BenefitsSection`, y otros.

### Mapas / Geografía (`geo/` — 5 componentes)
`GeoVisualizador`, `GeoVisualizadorMap`, `GeoNavegador`, `GeoLegend`, `GeoMapSkeleton`

### Centinela / PESTEL (`centinela/pestel/` — 24 componentes)

| Área | Componentes |
|---|---|
| Wizard | `WizardStep1Tipo`, `WizardStep2Territorio`, `WizardStep3Variables` |
| Dashboard E5 | `PESTLPanel`, `PESTLPanelV2`, `RiskVectorWidget`, `TrendChart` |
| Interpretación E6 | `ImpactMatrix`, `AdjustmentModal`, `BiasCheckPanel`, `VoicesPanelE6`, `ComparisonPanel` |
| Monitoreo E8 | `AlertsFeed`, `CrisisBanner`, `DimensionStatusGrid`, `HistoryChart` |
| Informes E7 | `ReportViewer`, `ScorecardTable`, `PrintStyles` |
| Exportar | `MatrizExporter` |
| Navegación | `PESTELStageNav`, `TerritorioSelector` |

### Legal (`legal/` — 6 componentes)
`CookieBanner`, `CookieConfigButton`, `ClientOnlyBanner`, `LegalHero`, `LegalSection`, `TableOfContents`

---

## 6. Esquema de datos

### Colecciones de Firestore

| Colección | Propósito | Estado |
|---|---|---|
| `users` | Perfiles, roles, suscripciones, progreso talleres | Activo |
| `posts` | Artículos del blog | Activo |
| `posts/{id}/comments` | Subcollection de comentarios | Activo |
| `moddulo_projects` | Proyectos Moddulo (9 fases, historial de chat) | Activo |
| `moddulo_redactor_projects` | Proyectos del Redactor | Activo |
| `moddulo_redactor_generations` | Historial de generaciones del Redactor | Activo |
| `pestel_projects` | Proyectos V2 (tipo, nombre, horizonte, etapa) | Activo |
| `pestel_variable_configs` | Config variables PEST-L por proyecto (E3) | Activo |
| `pestel_analyses` | Resultados PEST-L V2 (`PestlAnalysisV2`) | Activo |
| `pestel_data_sources` | Fuentes de datos manuales cargadas en E4 | Activo |
| `pestel_jobs` | Estado de jobs (`pending/running/completed/failed`) | Activo |
| `pestel_raw_articles` | Artículos crudos del scraper | Activo |
| `pestel_alerts` | Alertas por umbral de riesgo | Activo |
| `pestel_configs` | Configuraciones legacy V1 (solo lectura) | Deprecated |
| `pestel_feeds` | Resultados PEST-L V1 legacy | Deprecated |
| `notifications` | Notificaciones in-app | Activo |
| `newsletter_subscribers` | Suscriptores del newsletter | Activo |
| `resources` | Recursos descargables | Activo |

### Tipos TypeScript principales

**`ModduloProject`** (`types/moddulo.types.ts`)
```typescript
{
  id: string
  userId: string
  type: ProjectType             // electoral | gubernamental | legislativo | ciudadano
  name: string
  xpcto: XPCTO                  // hito, sujeto, capacidades, tiempo, justificación
  currentPhase: PhaseId         // proposito → evaluacion
  phases: Record<PhaseId, PhaseState>  // status, data{}, chatHistory[], report
  collaborators: Collaborator[]
  status: ProjectStatus         // draft | active | paused | completed | archived
  settings: { aiLevel, language }
}
```

**`PestlAnalysisV2`** (`types/pestel.types.ts`)
```typescript
{
  id: string
  projectId: string
  version: 2
  analyzedAt: Date
  globalConfidence: number       // 0-100, ponderado por dimensión
  dimensions: DimensionAnalysis[]  // P, E, S, T, L
  impactChains: ImpactChain[]
  biasAlerts: BiasAlert[]
  status: AnalysisStatus         // PENDING_REVIEW | REVIEWED | APPROVED
  vigente: boolean
  adjustments: HumanAdjustment[] // Human-in-the-loop (E6)
  jobId: string                  // trazabilidad → pestel_jobs
}
```

**`FirestoreUser`** (`types/firestore.types.ts`)
```typescript
{
  uid, email, role: UserRole
  name, lastName, userName
  subscriptionPlan: SubscriptionPlan | null
  subscriptionStatus: SubscriptionStatus | null
  subscriptionStartDate, subscriptionEndDate
  workshopProgress: Record<string, UserWorkshopProgress>
}
```

**`SessionPayload`** (`types/session.types.ts`)
```typescript
{ uid, email, role, subscriptionPlan, subscriptionStatus, emailVerified, iat, exp }
```

### Planes de suscripción (`types/subscription.types.ts`)

| Plan | Rol | Precio MXN | Acceso principal |
|---|---|---|---|
| freemium | `user` | $0 | Blog, Redactor (limitado) |
| basic | `basic` | $2,899/mes | + Cursos, SEFIX |
| premium | `premium` | $5,899/mes | + Centinela, Moddulo |
| professional | `professional` | $9,899/mes | + API, white label |

---

## 7. APIs externas integradas

| Servicio | Propósito | Capa | Configuración |
|---|---|---|---|
| **Anthropic Claude** (claude-sonnet-4-6) | Chat de fases Moddulo, análisis PEST-L PESTEL | `lib/ai/claude.ts` + Cloud Functions | `ANTHROPIC_API_KEY` |
| **Firebase Auth** | Autenticación (email/password, Google) + session cookies | `context/AuthContext.tsx`, `lib/session.ts` | `NEXT_PUBLIC_FIREBASE_*` |
| **Firestore** | Base de datos principal | `lib/firebase-admin.ts` (servidor), `firebase/firebaseConfig.ts` (cliente) | `FIREBASE_PROJECT_ID` + credenciales admin |
| **Firebase Storage** | JSONs pregenerados SEFIX, archivos de usuario | `firebase/storageUtils.ts` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| **Cloud Functions Gen2** | Scraping + análisis PEST-L (fire-and-forget) | `FIREBASE_FUNCTIONS_URL` | Secrets en Firebase Secret Manager |
| **Resend** | Emails transaccionales (newsletter, contacto, verificación) | `lib/email.ts` | `RESEND_API_KEY` |
| **Nodemailer + Gmail** | SMTP de respaldo | `lib/emailService.ts` | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| **INEGI API** | Indicadores económicos para PESTEL | Cloud Function `scrapers/inegi.ts` | `INEGI_TOKEN` (Secret Manager) |
| **Banxico API** | Datos financieros para PESTEL | Cloud Function `scrapers/banxico.ts` | `BANXICO_TOKEN` (Secret Manager) |
| **Google News RSS** | Artículos de noticias para PESTEL | Cloud Function `scrapers/googleNewsRSS.ts` | Sin key requerida |
| **DOF (Diario Oficial)** | Marco legal para PESTEL | Cloud Function `scrapers/dof.ts` | Sin key requerida |
| **Vercel** | Deploy frontend + CDN Edge global | — | Configuración de dominio y env vars |

---

## 8. Variables de entorno requeridas

### Next.js (`.env`)

```bash
# Firebase cliente (públicas)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=eskemma-3c4c3
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (privadas, servidor)
FIREBASE_PROJECT_ID=eskemma-3c4c3
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_TYPE=service_account
FIREBASE_CLIENT_ID=
FIREBASE_AUTH_URI=
FIREBASE_TOKEN_URI=
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=
FIREBASE_CLIENT_X509_CERT_URL=

# IA
ANTHROPIC_API_KEY=

# Email
RESEND_API_KEY=
GMAIL_USER=
GMAIL_APP_PASSWORD=

# Datos electorales
INEGI_TOKEN=
BANXICO_TOKEN=

# URLs y entorno
NEXT_PUBLIC_APP_URL=https://eskemma.com
NEXT_PUBLIC_ENVIRONMENT=development            # "production" activa indexación
FIREBASE_FUNCTIONS_URL=https://us-central1-eskemma-3c4c3.cloudfunctions.net

# Analytics (pendiente de configurar)
# GA_MEASUREMENT_ID=G-XXXXXXXXXX
# FB_PIXEL_ID=XXXXXXXXXXXXXXX
# GOOGLE_ADS_ID=AW-XXXXXXXXXX
```

### Cloud Functions (Firebase Secret Manager)

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set INEGI_TOKEN
firebase functions:secrets:set BANXICO_TOKEN
```

> **Nota:** No existe `.env.example` en el repositorio. Este bloque es el equivalente documentado.

---

## 9. Decisiones de arquitectura (resumen de `CLAUDE.md`)

### Autenticación
- Flujo: `Firebase signIn → getIdToken() → POST /api/auth/session → cookie HTTP-only (5 días)`
- En API routes: `getSessionFromRequest(request)` de `lib/server/auth-helpers.ts`
- En Server Components: `getServerSession()` de `lib/server/session.server.ts`
- Nunca acceder a cookies desde JS cliente

### Renderizado
- **Server Components por defecto.** Solo `"use client"` cuando hay interactividad real
- Páginas de contenido editorial deben ser Server Components para SEO (Google first pass)
- Excepciones documentadas: páginas de dashboard autenticado usan `force-dynamic`

### Estilos
- Tailwind CSS 4 con tokens custom en `@theme` — nunca usar colores genéricos de Tailwind (`blue-500`)
- Tokens: `blue-eske`, `orange-eske`, `bluegreen-eske`, `white-eske`, `gray-eske`, `black-eske`
- Tipografías: Arimo (body), PT Sans (captions), Philosopher (blog)

### Cloud Functions
- Build separado: `functions/` tiene su propio `package.json` y `tsconfig.json`
- No pueden importar desde `lib/` del proyecto raíz
- Estilo ESLint Google: comillas dobles, 2 espacios, máx. 80 chars, JSDoc obligatorio

### PESTEL — pipeline de análisis
- Fire-and-forget: el frontend solicita el trigger y hace polling al estado del job
- 5 llamadas paralelas a Claude (una por dimensión PEST-L)
- Human-in-the-loop obligatorio en E6 — ningún output de IA es definitivo sin validación explícita
- Semáforo de cobertura bloquea el análisis si alguna dimensión está en rojo

### Seguridad (reglas de oro)
1. Nunca hardcodear secrets — `.env` o Firebase Secret Manager
2. Siempre verificar sesión en API routes con `getSessionFromRequest()`
3. Validar que `userId` del token coincide con el recurso antes de retornar datos
4. `dangerouslySetInnerHTML` solo con DOMPurify
5. Cookies de sesión son HTTP-only — no acceder desde JS cliente
6. Nunca imprimir valores de variables de entorno en el output

---

## 10. Estado de Moddulo, Centinela/PESTEL

### Moddulo — Fases

| Fase | Ruta | Estado | Componentes clave |
|---|---|---|---|
| F1 Propósito | `/moddulo/proyecto/[id]/proposito` | ✅ Implementado | Formulario XPCTO (5 ejes), chat con Claude |
| F2 Exploración | `/moddulo/proyecto/[id]/exploracion` | ✅ Implementado | PEST-L, actores, hipótesis, viabilidad, matriz brechas |
| F3 Investigación | `/moddulo/proyecto/[id]/investigacion` | ⚠️ Esqueleto | Ruta y layout, contenido básico |
| F4 Diagnóstico | `/moddulo/proyecto/[id]/diagnostico` | ⚠️ Esqueleto | Ruta y layout, contenido básico |
| F5 Estrategia | `/moddulo/proyecto/[id]/estrategia` | ⚠️ Esqueleto | Ruta y layout, contenido básico |
| F6 Táctica | `/moddulo/proyecto/[id]/tactica` | ⚠️ Esqueleto | Ruta y layout, contenido básico |
| F7 Gerencia | `/moddulo/proyecto/[id]/gerencia` | ⚠️ Esqueleto | Ruta y layout, contenido básico |
| F8 Seguimiento | `/moddulo/proyecto/[id]/seguimiento` | ⚠️ Esqueleto | Ruta y layout, contenido básico |
| F9 Evaluación | `/moddulo/proyecto/[id]/evaluacion` | ⚠️ Esqueleto | Ruta y layout, contenido básico |

**Componentes activos de Moddulo:**
- `ModduloChat.tsx` — Chat con streaming SSE para todas las fases
- `PhaseNav.tsx` — Navegación entre fases con estado
- `PhaseReportView.tsx` — Vista de reporte generado por Claude
- `PhaseTransitionReview.tsx` — Revisión antes de avanzar de fase
- API: `POST /api/moddulo/chat/[phaseId]` (streaming), `GET/POST /api/moddulo/projects/[id]`

**Pendiente de implementar:** F3–F9 requieren formularios propios de recolección de datos y prompts de Claude especializados por fase. La arquitectura de chat ya está lista; falta el contenido metodológico.

### Centinela / PESTEL — Etapas

| Etapa | Descripción | Estado | Archivos clave |
|---|---|---|---|
| E1–E3 Wizard | Tipo, territorio, variables | ✅ Completado | `pestel/nuevo/page.tsx`, `WizardStep[1-3].tsx` |
| E4 Datos | Semáforo cobertura + carga manual | ✅ Completado | `[id]/datos/page.tsx`, `coverage` API |
| E5 Análisis IA | 5 dims paralelas + sesgos + cadenas | ✅ Completado | `[id]/analisis/page.tsx`, `PESTLPanelV2.tsx` |
| E6 Interpretación | Matriz, ajuste humano, human-in-the-loop | ⚠️ Parcial | `[id]/interpretacion/page.tsx`, `ImpactMatrix.tsx`, `AdjustmentModal.tsx` |
| E7 Informes | 4 formatos, scorecard, escenarios | ⚠️ Parcial | `[id]/informes/page.tsx`, `ReportViewer.tsx`, `ScorecardTable.tsx` |
| E8 Monitoreo continuo | Dashboard, alertas, modo crisis | ⚠️ Parcial | `[id]/monitoreo/page.tsx`, `AlertsFeed.tsx`, `CrisisBanner.tsx` |

**Cloud Functions activas:**
- `scrapeAndAnalyze` — HTTP function principal (trigger manual)
- `scheduledMonitor` — Cron cada 6 horas
- `generateFeed` / `feedSync` — Orquestación PEST-L
- `claudePESTL` — Clasificación con Claude
- `vectorCalculator` — Cálculo determinístico de riesgo
- 4 scrapers: `googleNewsRSS`, `dof`, `inegi`, `banxico`

**Pendiente de implementar:**
- E6: drag-and-drop de matriz de impacto/probabilidad
- E7: exportación a 4 formatos (PDF, Word, PPT, JSON)
- E8: alertas automáticas por umbral (reglas configurables)
- Integración PESTEL → Moddulo F2 (exploración consume análisis PEST-L existente)

---

## 11. Conflictos y deuda técnica conocida

### Deuda de código (TODOs en repo)

| Prioridad | Archivo | Deuda |
|---|---|---|
| Alta | `app/api/moddulo/export/route.ts` | `// TODO: Adaptar a la nueva arquitectura ModduloProject` — endpoint de exportación sin migrar |
| Media | `lib/redactor/projects.ts:388` | `// TODO: Implementar eliminación de generaciones` — deleteGenerations flag sin efecto |
| Baja | `lib/utils/cookieConsent.ts` | 3 IDs de analytics con placeholders (`G-XXXXXXXXXX`, `XXXXXXXXXXXXXXX`, `AW-XXXXXXXXXX`) |

### Tipos deprecated (migración pendiente)

En `types/pestel.types.ts` existen interfaces V1 marcadas con `@deprecated`:
- `PESTELConfig`, `Factor`, `DimensionPESTL`, `PESTLAnalysis`, `PESTELFeed`, `PESTELAlert`
- `ImpactoFactor` (alto/medio/bajo) → reemplazar por `Intensity` (ALTA/MEDIA/BAJA)
- `ModoAnalisis` → reemplazar por `TipoProyecto`

Estas interfaces aún pueden estar en uso por código de lectura de registros V1 en Firestore.

### Deuda SEO

| Elemento | Problema |
|---|---|
| `/cursos/[slug]/page.tsx` | `"use client"` — sin metadata dinámica por curso. Requiere Server Component wrapper con `generateMetadata` |
| `/condiciones-asesorias-gratuitas/page.tsx` | `"use client"` con metadata comentada — requiere `layout.tsx` |
| `NEXT_PUBLIC_SITE_URL` | Variable huérfana referenciada en `app/robots.ts` (línea 6) — debería ser `NEXT_PUBLIC_APP_URL` |
| featureImage en blog | Usa `<img>` plano en vez de `next/image` — pérdida de optimización WebP/AVIF y LCP |

### Conflictos de versiones

| Elemento | Conflicto |
|---|---|
| `firebase-admin` | `package.json` raíz usa `^13.6.0`; `functions/package.json` usa `^12.6.0` — versiones distintas |
| `NEXT_PUBLIC_APP_URL` vs `NEXT_PUBLIC_SITE_URL` | Dos nombres de variable para la misma URL del sitio; `robots.ts` aún usa la variable antigua |

### Rutas sin metadata o sin indexación controlada

| Ruta | Estado |
|---|---|
| `/recursos`, `/planes-colaborativos`, `/pasarela-de-pago` | Placeholders sin `robots: noindex` — Google podría indexar páginas vacías |
| `/dev/geo-test` | Página de desarrollo sin protección ni `noindex` |
| `/admin/setup-claims` | Sin protección de rol admin a nivel de ruta (depende de client-side auth check) |

### Archivo huérfano

- `_archive/` contiene componentes antiguos de Moddulo (`moddulo-components/`, `export/`). No están importados en ningún lugar del código activo pero ocupan espacio y pueden confundir al navegar el repo.

---

*Este documento refleja el estado del repositorio al 2026-06-23. Actualizar al cerrar cada sprint o cuando cambie la arquitectura de módulos.*
