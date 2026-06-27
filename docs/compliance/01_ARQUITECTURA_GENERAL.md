# 01_ARQUITECTURA_GENERAL.md | Eskemma
## Arquitectura del Sistema para Registro INDAUTOR

**Fecha de creación:** 2026-04-10  
**Autor:** Raúl Sánchez Salgado  
**Versión:** 1.0

---

## Diagrama C4 — Nivel 1: Sistema Eskemma

```
┌─────────────────────────────────────────────────────────────┐
│                    ESKEMMA PLATFORM                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Moddulo  │  │PESTEL │  │  SEFIX   │  │  Cursos  │  │
│  │(9 fases) │  │(PEST-L)  │  │(Electoral│  │(Talleres)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │              │         │
│  ┌────▼──────────────▼──────────────▼──────────────▼─────┐ │
│  │              Next.js App Router (API Routes)           │ │
│  └────┬───────────────────────────────────────────────────┘ │
│       │                                                      │
│  ┌────▼──────────────────────────────────────────────────┐  │
│  │                Firebase Platform                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │   Auth   │  │Firestore │  │  Cloud Storage       │ │  │
│  │  │(sessions)│  │  (BD)    │  │  (archivos, JSON)    │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────┐    ┌───────────────────────────────┐  │
│  │  Cloud Functions │    │   Anthropic Claude Sonnet 4.6 │  │
│  │  (PESTEL IA)  │    │   (Moddulo Chat + PESTEL)  │  │
│  └──────────────────┘    └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

Despliegue:
- Frontend → Vercel (CDN global)
- Cloud Functions → Google Cloud (us-central1)
- Storage/Auth/Firestore → Firebase (Google Cloud)
```

---

## Stack Tecnológico (Versiones Actuales)

| Capa | Tecnología | Versión | Licencia |
|------|-----------|---------|----------|
| Framework | Next.js App Router | 16.1.1 | MIT |
| UI | React | 19.2.3 | MIT |
| Lenguaje | TypeScript (strict) | 5.9.3 | Apache 2.0 |
| Estilos | Tailwind CSS con `@theme` | 4.1.18 | MIT |
| Auth | Firebase Auth + HTTP-only cookies | firebase@11.10.0 | Apache 2.0 |
| Base de datos | Firestore (Firebase) | firebase-admin@13.6.0 | Apache 2.0 |
| Storage | Firebase Cloud Storage | (incluido en firebase-admin) | Apache 2.0 |
| Cloud Functions | Node.js Gen2 (Google Cloud) | 22.x | — |
| IA | Anthropic Claude Sonnet 4.6 | @anthropic-ai/sdk@0.78.0 | MIT |
| Gráficas | Recharts | 3.8.1 | MIT |
| Email | Resend + Nodemailer | resend@6.6.0 / nodemailer@7.0.12 | MIT |
| Despliegue frontend | Vercel | — | Propietario |
| Despliegue functions | Google Cloud (Firebase) | — | Propietario |

---

## 8 Decisiones Arquitectónicas Principales

### DA-1: Next.js 16.x con App Router

**Decisión:** Usar Next.js App Router en lugar de Pages Router o un framework alternativo.

**Quién:** Raúl Sánchez Salgado tomó esta decisión al iniciar el proyecto.

**Justificación:**
- App Router permite Server Components: reducen JS enviado al cliente
- Streaming SSE nativo para el chat de Moddulo (sin librerías adicionales)
- API Routes co-locadas con el código — monorepo coherente
- Mejor soporte para Server Actions y layouts anidados

**Impacto:** Todo el proyecto usa la estructura `app/` con Server Components por
defecto y Client Components declarados explícitamente con `"use client"`.

---

### DA-2: TypeScript en Modo Strict

**Decisión:** TypeScript configurado en modo strict en toda la base de código.

**Quién:** Raúl definió esta regla como no negociable desde el inicio.

**Justificación:**
- Previene errores de runtime en una plataforma de producción con datos sensibles
- Firestore tipado con interfaces en `types/firestore.types.ts`
- Facilita la supervisión de código generado con IA (los errores de tipo son detectados antes)

**Impacto:** Archivos de tipos en `/types/`: `pestel.types.ts`, `moddulo.types.ts`,
`firestore.types.ts`, `session.types.ts`, `subscription.types.ts`.

---

### DA-3: Firebase Auth con Session Cookies HTTP-only

**Decisión:** Autenticación vía Firebase Auth con cookies de sesión HTTP-only (no JWT en localStorage).

**Quién:** Raúl diseñó este flujo de seguridad como no negociable.

**Flujo:**
```
Firebase signIn (cliente)
  → getIdToken()
  → POST /api/auth/session { idToken }
  → Firebase Admin verifica token
  → Crea session cookie (HTTP-only, Secure, SameSite:lax, 5 días)
```

**Justificación:**
- Cookies HTTP-only son inaccesibles desde JavaScript — previene XSS token theft
- Firebase Admin SDK verifica tokens en el servidor — no hay validación client-side
- SameSite:lax protege contra CSRF

**Archivos clave:** `lib/session.ts`, `lib/session-config.ts`,
`lib/server/auth-helpers.ts`, `lib/server/session.server.ts`, `context/AuthContext.tsx`

---

### DA-4: Firestore como Base de Datos Principal

**Decisión:** Firestore (NoSQL documental) en lugar de PostgreSQL u otra BD relacional.

**Quién:** Raúl tomó esta decisión considerando el ecosistema Firebase y la naturaleza
del dato político.

**Justificación:**
- Datos políticos son jerárquicos y variables en estructura — NoSQL es más flexible
- Integración nativa con Firebase Auth (reglas de seguridad por usuario)
- Tiempo real out-of-the-box sin necesidad de WebSockets custom
- Escalado automático para picos de tráfico en períodos electorales

**Colecciones principales:** `users`, `moddulo_projects`, `pestel_projects`,
`pestel_analyses`, `pestel_jobs`, `posts`, `pestel_variable_configs`,
`pestel_data_sources`, `pestel_raw_articles`, `pestel_alerts`, `notifications`.

---

### DA-5: Cloud Functions Gen2 para PESTEL

**Decisión:** Procesamiento IA de PESTEL en Cloud Functions Node.js Gen2, separado
del servidor Next.js.

**Quién:** Raúl diseñó esta separación para evitar timeouts en Vercel.

**Justificación:**
- El análisis PEST-L requiere 6 llamadas paralelas a Claude + scraping (~30-60s)
- Las funciones serverless de Vercel tienen límite de 300s — insuficiente
- Cloud Functions Gen2 pueden ejecutarse hasta 60 minutos
- Arquitectura fire-and-forget: Next.js lanza la función y el cliente hace polling

**Archivos:** `functions/src/pestel/` (build separado con su propio package.json)

---

### DA-6: Claude Sonnet 4.6 como Motor de IA

**Decisión:** Usar Claude Sonnet 4.6 (Anthropic) como único modelo de IA en el sistema.

**Quién:** Raúl seleccionó Claude sobre GPT-4 y otros modelos por su desempeño en
análisis de texto político en español y su contexto de 200k tokens.

**Uso en PESTEL:**
- 5 llamadas paralelas (una por dimensión PEST-L: P, E, S, T, L)
- 1 llamada adicional para cadenas de impacto
- Detección de sesgos: determinística (sin IA) — decisión de Raúl

**Uso en Moddulo:**
- Chat con streaming SSE en `/api/moddulo/chat/[phaseId]`
- Contexto del proyecto completo en cada llamada

---

### DA-7: Tailwind CSS con Sistema de Diseño @theme

**Decisión:** Tailwind CSS 4.x con tokens de color personalizados vía directiva `@theme`.

**Quién:** Raúl diseñó el sistema de colores y tipografía de Eskemma.

**Tokens de color:**
| Token | Uso |
|-------|-----|
| `blue-eske` | Primario, links, acciones principales |
| `orange-eske` | Secundario, CTAs destacados |
| `bluegreen-eske` | Headers de sección, navegación |
| `white-eske` | Fondos |
| `gray-eske` | Bordes, texto deshabilitado |
| `black-eske` | Texto principal |
| `yellow-eske` | Advertencias |
| `green-eske` | Estados de éxito |
| `red-eske` | Errores |

Cada color tiene escala: `-10` `-20` `-30` `-40` `-60` `-70` `-80` `-90`.

**Tipografía:** Arimo (body), PT Sans (captions), Philosopher (blog).

**Regla:** Nunca usar colores genéricos de Tailwind (`blue-500`, `gray-300`) en
componentes nuevos — solo tokens del design system.

---

### DA-8: Vercel + Google Cloud para Despliegue

**Decisión:** Frontend en Vercel, Cloud Functions en Google Cloud (Firebase).

**Quién:** Raúl decidió esta arquitectura dual considerando los costos y capacidades
de cada plataforma.

**Justificación:**
- Vercel: CDN global, deploys automáticos desde GitHub, integración óptima con Next.js
- Google Cloud: co-localización con Firestore/Storage reduce latencia interna
- Costos: Vercel Pro para el frontend, Firebase Blaze para Cloud Functions

---

## Accesibilidad — WCAG AA (No Negociable)

Raúl estableció WCAG AA como requisito de accesibilidad para toda la plataforma:

- `aria-hidden="true"` en íconos decorativos
- `aria-label` en botones de solo ícono
- `htmlFor` asociado a todos los inputs
- Focus rings con `focus-visible:` (no `focus:`)
- Modales: hook `useFocusTrap` (`app/hooks/useFocusTrap.ts`)
- Escape en modales/dropdowns: hook `useEscapeKey` (`app/hooks/useEscapeKey.ts`)
- Animaciones: respetar `prefers-reduced-motion`

---

## Seguridad — Reglas No Negociables

1. Nunca hardcodear secrets — `.env` (Next.js) o Firebase Secret Manager (Functions)
2. Siempre verificar sesión en API routes con `getSessionFromRequest()`
3. Siempre validar que el `userId` del token coincide con el recurso solicitado
4. Nunca `dangerouslySetInnerHTML` sin sanitizar con DOMPurify
5. Las cookies de sesión son HTTP-only — nunca accederlas desde JS cliente

---

## Flujos Principales del Sistema

### Flujo de Autenticación
```
Usuario → Login form → Firebase signIn → getIdToken
→ POST /api/auth/session → Firebase Admin verifica
→ Session cookie HTTP-only → AuthContext.tsx (cliente)
```

### Flujo de Análisis PESTEL
```
Wizard E1-E3 → E4 Datos (semáforo cobertura)
→ Trigger análisis → Cloud Function scrapeAndAnalyze
→ 4 scrapers paralelos → generateAnalysisV2
→ 5 llamadas Claude paralelas (PEST-L)
→ Guarda pestel_analyses → Frontend detecta "completed"
```

### Flujo de Chat Moddulo
```
Usuario escribe → POST /api/moddulo/chat/[phaseId]
→ Verifica sesión → Carga historial de fase desde Firestore
→ Llama Claude con streaming → SSE al cliente
→ Actualiza Firestore con nuevo mensaje
```

### Flujo de Consulta SEFIX (histórico geo)
```
Usuario selecciona entidad → GET /api/sefix/historico-geo
→ Descarga {ENTIDAD}_anual.json + {ENTIDAD}_{year}.json
→ Filtra en memoria → Retorna HistoricoMes[]
→ Recharts renderiza G1 + G2 + G3
```

---

*Documento generado bajo supervisión de Raúl Sánchez Salgado — 2026-04-10*
