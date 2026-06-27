# Auditoría del Proyecto Eskemma
**Fecha:** 26-03-27
**Objetivo:** Estado real del proyecto para orientar desarrollo futuro.

---

## 1. Estructura de Carpetas y Archivos Principales

```
eskemma/
├── app/                             # Next.js 16 — App Router
│   ├── api/                         # 39 API Route Handlers
│   │   ├── auth/session/            # POST / DELETE / GET — sesiones HTTP-only
│   │   ├── admin/                   # Moderación, claims, stats (solo admins)
│   │   ├── moddulo/                 # CRUD proyectos + chat SSE con Claude
│   │   ├── centinela/pestel/       # config · feed · status · trigger
│   │   ├── posts/                   # Blog CRUD + comentarios + likes + vistas
│   │   ├── newsletter/              # Suscripción, confirmación, baja
│   │   ├── notifications/           # Notificaciones in-app
│   │   ├── contact/                 # Formulario de contacto
│   │   ├── cursos/taller/progress/  # Progreso de talleres
│   │   └── sefix/                   # APIs padrón y resultados electorales
│   │
│   ├── components/                  # Componentes UI compartidos
│   │   ├── Layout.tsx               # Header + Footer wrapper
│   │   ├── Header.tsx               # Navbar con auth, notificaciones y badge
│   │   ├── Footer.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── componentsBlog/          # PostCard, CommentForm, ShareButtons…
│   │   ├── componentsCursos/        # CourseCard, ProgressTracker…
│   │   ├── componentsHome/          # Hero, secciones de homepage
│   │   ├── moddulo/                 # Modales, selectors, redactor
│   │   └── centinela/pestel/
│   │       ├── config/TerritorioSelector.tsx    ✅ implementado
│   │       ├── dashboard/RiskVectorWidget.tsx   ✅ implementado
│   │       ├── dashboard/PESTLPanel.tsx         ✅ implementado
│   │       ├── dashboard/TrendChart.tsx         ⚠️ placeholder
│   │       └── export/MatrizExporter.tsx        ⚠️ placeholder
│   │
│   ├── hooks/
│   │   ├── useFocusTrap.ts          # Trampa de foco para modales (a11y)
│   │   └── useEscapeKey.ts          # Tecla Escape para modales/dropdowns
│   │
│   ├── centinela/
│   │   ├── page.tsx                 # Hub Centinela — catálogo de apps
│   │   └── pestel/
│   │       ├── page.tsx             # ✅ Hub multi-territorio
│   │       ├── analisis/[id]/       # ✅ Vista individual PEST-L
│   │       ├── configurar/page.tsx  # ⚠️ UnderConstruction (redundante con hub)
│   │       └── export/page.tsx      # ⚠️ UnderConstruction
│   │
│   ├── moddulo/
│   │   ├── redactor/                # ✅ App generación de contenido
│   │   └── proyecto/[projectId]/
│   │       ├── layout.tsx           # Sidebar con las 9 fases
│   │       └── [phaseId]/page.tsx   # 9 fases: proposito → evaluacion
│   │
│   ├── blog/                        # ✅ Blog completo con admin
│   ├── cursos/                      # ✅ Cursos y talleres
│   ├── sefix/                       # ✅ Dashboard Shiny embebido
│   └── contacto/ servicios/ faq/    # Páginas estáticas
│
├── lib/                             # Lógica compartida
│   ├── session.ts                   # Manejo de session cookies
│   ├── session-config.ts
│   ├── firebase-admin.ts            # Admin SDK (adminAuth, adminDb)
│   ├── ai/claude.ts                 # Instancia Anthropic
│   ├── server/                      # Helpers solo-servidor
│   ├── centinela/pestel/           # Scrapers/classifier (Next.js side — sin uso activo)
│   ├── moddulo/                     # Lógica fases, prompts, risks
│   ├── redactor/                    # Validación, proyectos, knowledge base
│   ├── cursos/                      # Lógica talleres
│   └── email.ts / emailService.ts
│
├── types/                           # TypeScript strict — interfaces Firestore
│   ├── pestel.types.ts
│   ├── moddulo.types.ts
│   ├── firestore.types.ts
│   ├── session.types.ts
│   ├── subscription.types.ts
│   ├── post.types.ts
│   ├── course.types.ts
│   └── redactor.types.ts
│
├── context/AuthContext.tsx          # useAuth() — estado de sesión en cliente
│
├── functions/src/pestel/         # Firebase Cloud Functions (Node 22)
│   ├── scrapeAndAnalyze.ts          # HTTP CF: scraping + análisis PEST-L
│   ├── scheduledMonitor.ts          # Cron 6h: dispara análisis automáticos
│   ├── generateFeed.ts              # Orquestador interno PEST-L
│   ├── classifier/claudePESTL.ts    # Clasificación con Claude (batches 10)
│   ├── risk/vectorCalculator.ts     # Cálculo determinístico de índices
│   ├── feedSync.ts                  # Sincronización feeds → Moddulo
│   └── scrapers/                    # googleNewsRSS · dof · inegi · banxico
│
├── firebase.json
├── firestore.rules
├── storage.rules
├── CLAUDE.md                        # Instrucciones para Claude Code
└── _docs/                           # Documentación técnica interna
```

---

## 2. Stack Tecnológico

### Frontend / Framework
| Tecnología | Versión | Notas |
|-----------|---------|-------|
| Next.js | ^16.1.1 | App Router, Server + Client Components |
| React | ^19.2.3 | |
| TypeScript | ^5 | Modo strict activado |
| Tailwind CSS | ^4.1.5 | Con `@theme` para design tokens custom |
| PostCSS | ^8.5.3 | |

### Backend / Cloud
| Tecnología | Versión | Notas |
|-----------|---------|-------|
| Firebase Admin SDK | ^13.6.0 | Auth + Firestore server-side |
| Firebase SDK (cliente) | ^11.8.1 | Auth cliente |
| Firebase Cloud Functions | ^6.0.1 | Gen2, Node 22 |
| Firestore | — | NoSQL, 17 colecciones |
| Firebase Storage | — | Avatares, imágenes posts, assets Sefix |

### Inteligencia Artificial
| Tecnología | Versión | Notas |
|-----------|---------|-------|
| @anthropic-ai/sdk | ^0.78.0 | Modelo `claude-sonnet-4-6` |
| Streaming SSE | — | Chat Moddulo vía `/api/moddulo/chat/[phaseId]` |

### Utilidades
| Tecnología | Versión | Notas |
|-----------|---------|-------|
| Resend | ^6.3.0 | Emails transaccionales |
| Nodemailer | ^7.0.10 | Fallback SMTP (Gmail) |
| DOMPurify | ^3.2.6 | Sanitización XSS |
| isomorphic-dompurify | ^2.26.0 | SSR-safe |
| docx | ^9.5.1 | Exportación proyectos Moddulo a .docx |
| Puppeteer | ^24.36.0 | Exportación PDF (pesado — ver deuda técnica) |
| rss-parser | ^3.13.0 | Parseo de feeds RSS (Google News, DOF) |
| react-markdown | ^10.1.0 | Render de markdown en blog y chat |
| remark / remark-gfm | ^15/^4 | Pipeline markdown |
| gray-matter | ^4.0.3 | Front-matter en posts |
| date-fns | ^4.1.0 | Manipulación de fechas |
| browser-image-compression | ^2.0.2 | Compresión de imágenes antes del upload |
| @heroicons/react | ^2.2.0 | Íconos SVG |

### Despliegue
| Entorno | Plataforma |
|---------|-----------|
| Frontend (Next.js) | Vercel |
| Cloud Functions | Google Cloud (Firebase) |
| Base de datos | Firestore (Google Cloud) |
| Storage | Firebase Storage |
| Proyecto Firebase | `eskemma-3c4c3` |

---

## 3. Módulos Implementados

### Blog — El Baúl de Fouché ✅ Completo
- CRUD completo de posts (admin): crear, editar, publicar, eliminar
- Filtros por categoría, estado y tags
- Comentarios con aprobación manual
- Likes, contador de vistas, tiempo de lectura
- Posts guardados por usuario
- Recursos descargables asociados a posts
- Panel de administración con estadísticas
- SEO: metaTags, Open Graph, keywords por post
- Tipografía Philosopher para títulos (design diferenciado)

### Cursos / Talleres ✅ Completo (con limitaciones)
- Listado de cursos con filtros (categoría, nivel, plan)
- Progreso por módulo/sesión guardado en Firestore (`users/{uid}/workshopProgress`)
- Control de acceso por plan (freemium / basic / premium)
- Renderizado de contenido markdown con ejercicios
- Actualmente solo hay 1 taller publicado ("Diagnóstico Electoral")

### Sefix ✅ Completo (dependencia externa)
- Dashboard de análisis electoral embebido vía iframe
- Origen: Shiny app en `shinyapps.io` (R/Shiny, equipo externo)
- CSP configurado en `next.config.ts` para permitir el iframe
- APIs propias: `/api/sefix/padron` y `/api/sefix/resultados`
- Requiere plan `basic` o superior

### Moddulo — Proyectos Políticos ✅ Arquitectura completa / algunos flujos incompletos
- 9 fases secuenciales: `proposito → evaluacion`
- Chat con Claude via streaming SSE por fase
- XPCTO model: Hito, Sujeto, Capacidades, Tiempo, Objetivo
- Exportación de proyectos a DOCX
- Generación de reporte por fase
- Redactor: generación de contenido (freemium limitado, premium ilimitado)
- **Pendiente**: fase `exploracion` (F2) debe usar PESTEL para PEST-L automático

### PESTEL — Centinela PEST-L ✅ Backend completo / UI en curso
Ver sección 4 (módulos en construcción).

### Autenticación y Sesiones ✅ Completo
- Firebase Auth (email/password + Google OAuth)
- Session cookies HTTP-only de 5 días
- Custom claims por rol
- 9 roles: `visitor → registered → user → basic → premium → professional → unsubscribed → expired → admin`
- Cloud Functions que sincronizan claims al crear/actualizar usuario

### Suscripciones ✅ Estructura definida / pagos pendientes
- 4 tiers: freemium ($0), basic ($2,899), premium ($5,899), professional ($9,899) MXN/mes
- `PLAN_FEATURES` completo en `types/subscription.types.ts`
- Integración con Stripe referenciada en tipos pero no confirmada en código de routes
- El control de acceso por plan está implementado en frontend (guarda por plan en Firestore)

### Newsletter ✅ Completo
- Suscripción con double opt-in por email
- Confirmación vía link
- Baja voluntaria

### Notificaciones In-App ✅ Completo
- `NotificationBell` en el header con dropdown
- Tipos: comentario aprobado, mención, sistema
- Marcado como leídas

### Contacto ✅ Completo
- Formulario con scoring de prioridad
- Envío por email (Resend)
- Almacenamiento en Firestore

---

## 4. Módulos en Construcción o Incompletos

### PESTEL — UI (Fase 3 en curso)

| Componente/Ruta | Estado | Nota |
|----------------|--------|------|
| `page.tsx` (Hub) | ✅ Implementado | Multi-territorio, cards, formulario inline |
| `analisis/[id]/page.tsx` | ✅ Implementado | Vista completa con polling |
| `RiskVectorWidget.tsx` | ✅ Implementado | 3 KPI cards con colores semáforo |
| `PESTLPanel.tsx` | ✅ Implementado | Tabs + factor cards + fuentes clickeables |
| `TrendChart.tsx` | ⚠️ Placeholder | Solo retorna texto "[pendiente]" |
| `MatrizExporter.tsx` | ⚠️ Placeholder | Solo retorna texto "[pendiente]" |
| `configurar/page.tsx` | ⚠️ UnderConstruction | Redundante con el hub; podría eliminarse |
| `export/page.tsx` | ⚠️ UnderConstruction | Espera `MatrizExporter` |

### Moddulo F2 — Integración con PESTEL ⚠️ Pendiente
- La página `exploracion/page.tsx` existe y tiene la estructura PEST-L
- Falta el botón/flujo "Importar PESTEL" que consuma el feed vigente
- El tipo `ExplorationForm.pestl` en `moddulo.types.ts` ya define la estructura
- Hay un `feedSync.ts` en Cloud Functions pero sin confirmar si orquesta esto

### Exportación de Análisis PEST-L ⚠️ Pendiente
- `MatrizExporter.tsx` es un placeholder
- No hay endpoint de exportación para PESTEL

### Redactor — Knowledge Base ⚠️ Parcial
- Existe `lib/redactor/knowledge/countries/mexico/` pero no está claro si está completa
- La lógica de generación usa Claude, pero el contexto de conocimiento puede ser limitado

---

## 5. Convenciones de Código Observadas

### Estructura de Componentes
- Componentes de página: `"use client"` explícito cuando hay estado/efectos
- Componentes puramente de presentación: sin directiva (Server Components por defecto)
- Props interfaces definidas inline o justo antes del componente
- Componentes auxiliares pequeños definidos en el mismo archivo que el padre

### Naming
- Componentes: `PascalCase` (`RiskVectorWidget.tsx`)
- Hooks: `camelCase` con prefijo `use` (`useFocusTrap`)
- API routes: siempre `route.ts` dentro de carpeta con el nombre del endpoint
- Tipos: `PascalCase` con sufijo descriptivo (`PESTELFeed`, `SessionPayload`)
- Variables de estado: `camelCase` descriptivo (`isAnalyzing`, `loadingFeed`)

### Manejo de Estado
- Estado local con `useState` (preferido — no hay Zustand ni Redux)
- Efectos de carga con `useEffect` + fetch directo a API routes propias
- Sin SWR ni React Query (oportunidad de mejora)
- Context solo para AuthContext (scope global)
- Polling manual con `setInterval` (en PESTEL para jobs)

### Llamadas a API
- Siempre a rutas propias (`/api/...`), nunca directo a Firestore desde el cliente
- Patrón consistente: `fetch` + cast de tipos + manejo de `!res.ok`
- En Cloud Functions: `getSessionFromRequest(request)` al inicio de cada handler

### TypeScript
- Modo `strict: true` en todo el proyecto
- Tipos explícitos en respuestas de fetch: `as {field: type}`
- Sin `any` (excepciones comentadas cuando existen)
- Import alias `@/` para rutas absolutas desde la raíz

### Estilos
- Tailwind exclusivamente (sin CSS modules, sin styled-components)
- Colores del design system siempre (nunca `blue-500` en componentes nuevos)
- Clases largas: multilínea con indentación dentro de template strings
- Mobile-first: clases base para móvil, `sm:` y `lg:` para breakpoints mayores

### Cloud Functions (Google ESLint style guide — diferente al resto)
- Comillas dobles `"` (no simples como en Next.js)
- `max-len: 80` caracteres
- JSDoc con `@param` y `@return` obligatorio en exportadas
- Sin espacios en `{}` de imports

---

## 6. Base de Datos — Esquema Firestore

### Colecciones Permanentes

#### `users/{userId}`
```
uid, email, role, name, lastName, userName
subscriptionPlan, subscriptionStatus
subscriptionStartDate, subscriptionEndDate
stripeCustomerId, stripeSubscriptionId
profileCompleted, emailVerified, showOnboardingModal
workshopProgress: { [workshopId]: UserWorkshopProgress }
createdAt, updatedAt
  └─ savedPosts/{postId}  (subcollección)
```

#### `posts/{postId}`
```
title, content, slug, status ("draft"|"published")
author { uid, name, email }
category, tags[], featureImage, secondaryImages[]
metaTitle, metaDescription, keywords[]
likes, views, createdAt, updatedAt
  └─ comments/{commentId}  (subcollección)
     content, author, createdAt, isApproved, parentId?
```

#### `moddulo_projects/{projectId}`
```
userId, type, name, description
xpcto { hito, sujeto, capacidades, tiempo, justificacion }
currentPhase, status
phases: Record<PhaseId, PhaseState>
  PhaseState { status, data, chatHistory, completedAt?, report?, reportText? }
collaborators[], settings { aiLevel, language }
createdAt, updatedAt, lastAccessedAt
```

#### `moddulo_redactor_projects` + `moddulo_redactor_generations`
```
userId, name, configuration, stats
isActive, isArchived, createdAt, updatedAt
```

#### `pestel_configs/{configId}` — PERMANENTE
```
userId, modo ("ciudadano"|"gubernamental"), isActive
territorio { nivel, estado?, municipio?, nombre }
alertas { vectorRiesgoUmbral, notificarEmail, notificarInApp }
createdAt, updatedAt
```

#### `pestel_feeds/{feedId}` — PERMANENTE, núcleo del producto
```
configId, userId, territorio, vigente (bool), generadoEn
pestl {
  politico, economico, social, tecnologico, legal  →  DimensionPESTL
    DimensionPESTL { contexto, factores[], tendencia, fuentes[] }
      Factor { descripcion, impacto, sentiment, fuente, isManual }
}
vectorRiesgo (0-100), indicePresionSocial (0-100), indiceClimaInversion (0-100)
syncedToModdulo (bool)
```

#### `pestel_jobs/{jobId}` — Temporal/Debug
```
configId, userId, status ("pending"|"running"|"completed"|"failed")
startedAt, completedAt?, error?, feedId?, rawDataId?
```

#### `pestel_raw_articles/{jobId}` — Temporal
```
jobId, configId, userId, territorio
articles[], economicData { inegi[], banxico[] }
articlesCount, generadoEn
```

#### `notifications/{notificationId}`
```
userId, type, message, isRead, createdAt
postId?, postSlug?, commentId?
```

#### `newsletter_subscribers`, `resources`, `contactMessages`
```
(Estándar — email, estado, fechas)
```

### Regla Crítica sobre Índices
Queries con `where(A) + orderBy(B)` donde `A ≠ B` requieren índice compuesto.
**Solución actual**: ordenar en memoria para evitar crear índices adicionales
(documentado en `config/route.ts`).

---

## 7. APIs Externas Integradas

| API | Propósito | Autenticación | Dónde se usa |
|-----|-----------|--------------|-------------|
| **Anthropic Claude Sonnet 4.6** | Chat Moddulo (SSE) + clasificación PEST-L PESTEL | API key en `.env` y Firebase Secret | `lib/ai/claude.ts`, `functions/src/pestel/classifier/` |
| **Firebase Auth** | Autenticación de usuarios | SDK key pública + Admin SDK privado | `lib/firebase-admin.ts`, `context/AuthContext.tsx` |
| **Firestore** | Base de datos principal | Admin SDK | Toda la app |
| **Firebase Storage** | Imágenes, avatares, assets | Admin SDK | Posts, cursos, sefix |
| **Google News RSS** | Noticias por territorio | Sin auth (feed público) | `functions/src/pestel/scrapers/googleNewsRSS.ts` |
| **DOF RSS** | Diario Oficial de la Federación | Sin auth (feed público) | `functions/src/pestel/scrapers/dof.ts` |
| **INEGI BIE API** | Indicadores económicos | Token en Firebase Secret | `functions/src/pestel/scrapers/inegi.ts` |
| **Banxico SIE API** | Series financieras | Token en Firebase Secret | `functions/src/pestel/scrapers/banxico.ts` |
| **Resend** | Emails transaccionales | API key en `.env` | `lib/emailService.ts` |
| **Gmail SMTP** | Fallback de emails | App password en `.env` | `lib/emailService.ts` via Nodemailer |
| **Shiny (shinyapps.io)** | Dashboard electoral Sefix | Sin auth (iframe público) | `app/sefix/page.tsx` |
| **Stripe** | Pagos de suscripción | Referenciado en tipos, implementación pendiente | `types/subscription.types.ts` |

---

## 8. Deuda Técnica e Identificada

### Alta Prioridad

**1. Puppeteer en producción (Vercel)**
- `puppeteer@^24.36.0` está en las dependencias de Next.js, pero Vercel no soporta
  Chrome headless en su runtime serverless estándar.
- **Riesgo**: el build puede fallar en producción o el PDF no renderiza.
- **Solución recomendada**: mover la exportación PDF a una Cloud Function o usar
  `puppeteer-core` con `@sparticuz/chromium`.

**2. Stripe no implementado**
- Los tipos definen `stripeCustomerId`, `stripeSubscriptionId`, pero no hay
  routes `/api/stripe/webhook` ni lógica de checkout.
- Los planes están definidos con precios pero el cobro no existe.
- **Riesgo**: los usuarios pueden asignarse cualquier plan sin pagar.

**3. Integración PESTEL ↔ Moddulo F2 pendiente**
- La fase `exploracion` de Moddulo debería consumir el feed vigente de PESTEL.
- Actualmente, el usuario rellena el PEST-L manualmente en F2.
- Esto es una feature core prometida del producto.

### Media Prioridad

**4. Sin caché ni revalidación (SWR/React Query ausente)**
- Todos los fetches se rehacen en cada montaje de componente.
- No hay `staleWhileRevalidate` ni invalidación de caché.
- Impacto: latencia innecesaria + llamadas redundantes a Firestore.

**5. Páginas placeholder activas en rutas públicas**
- `/centinela/pestel/configurar` y `/centinela/pestel/export` son
  `UnderConstructionPage` accesibles por URL directa.
- Deberían redirigir al hub o no estar en el router hasta implementarse.

**6. `TrendChart.tsx` y `MatrizExporter.tsx` como placeholders**
- Importados en la interfaz pero devuelven solo texto.
- Si se usan en una demo o producción, se ven rotos.

**7. Doble definición de lógica de scrapers**
- Existe `lib/centinela/pestel/scraper/` (Next.js side) y
  `functions/src/pestel/scrapers/` (Cloud Functions).
- La versión en `lib/` no tiene uso activo. Genera confusión sobre cuál es
  la fuente de verdad.

**8. Gestión de errores inconsistente en el cliente**
- Algunos componentes usan `alert()` para mostrar errores (mal patrón en producción).
- Ejemplo: `analisis/[id]/page.tsx` línea de handleTrigger usa `alert()`.
- Debería usarse un sistema de toasts o mensajes en-pantalla.

**9. Ordenamiento en memoria para evitar índices Firestore**
- La solución es correcta para volúmenes pequeños, pero si un usuario tiene
  muchos configs/feeds, puede ser costoso.
- Documentado, pero hay que monitorearlo.

**10. `pestel_raw_articles` crece sin límite**
- Cada análisis genera un documento nuevo de artículos crudos.
- No hay TTL ni proceso de limpieza implementado.
- Impacto en costos de Firestore a mediano plazo.

### Baja Prioridad / Decisiones Provisionales

**11. Rate limiting ausente en APIs**
- Ninguna route tiene rate limiting.
- Un usuario podría disparar PESTEL 100 veces seguidas, generando
  costos en Claude y Firestore.
- Solución: middleware de rate limit por `userId` o `IP`.

**12. Secrets en `.env` vs Firebase Secret Manager**
- `ANTHROPIC_API_KEY` está en `.env` (para Next.js) Y en Firebase Secret Manager
  (para Cloud Functions). Son dos versiones del mismo secret que hay que
  mantener sincronizadas manualmente.

**13. `google-auth-library` y `gtoken` en dependencias raíz**
- Probablemente heredadas de alguna integración anterior.
- No hay evidencia de uso directo en el código revisado.
- Candidatas a eliminar si no son necesarias.

**14. TypeScript version mismatch en Cloud Functions**
- `functions/` usa TypeScript 5.7.3, pero `@typescript-eslint` soporta
  hasta 5.1.x oficialmente → warning en cada lint.
- No bloquea el deploy pero genera ruido.

---

## Resumen Ejecutivo

| Dimensión | Estado |
|-----------|--------|
| Autenticación | ✅ Sólida y completa |
| Blog | ✅ Feature-completo |
| Cursos | ✅ Funcional (1 curso publicado) |
| Sefix | ✅ Funcional (dependencia externa) |
| Moddulo — Proyectos | ✅ Arquitectura completa, algunos flujos por pulir |
| PESTEL — Backend | ✅ Completo y en producción |
| PESTEL — UI | 🔄 Hub y análisis individual implementados; export y charts pendientes |
| PESTEL ↔ Moddulo F2 | ⏳ Pendiente — feature core no implementada |
| Suscripciones / Cobro | ⚠️ Estructura sin backend de pagos |
| Exportación PDF | ⚠️ Puppeteer problemático en Vercel |