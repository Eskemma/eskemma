# Arquitectura Global — Eskemma / Moddulo
**Para Claude Code · Leer completo antes de escribir una sola línea**

---

## ⚠️ REGLA NÚMERO UNO

Este proyecto tiene una versión funcional en producción.
**Lee los archivos existentes antes de proponer cualquier cambio.**
Cuando vayas a modificar un archivo que ya existe, muéstrame el código
actual relevante y explica qué cambias y por qué antes de escribir.
Nunca elimines ni renombres colecciones de Firestore existentes.
Añade campos nuevos siempre como opcionales (`?`) para no romper datos existentes.

---

## 1. Stack (existente — no cambiar versiones)

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.1.1 (App Router) |
| UI | React 19.2.3 + TypeScript strict |
| Estilos | Tailwind CSS 4 + tokens custom (`globals.css`) |
| Auth | Firebase Auth (ya implementado — ver AuthContext antes de tocar) |
| Base de datos | Firestore (colecciones existentes: ver sección 3) |
| Backend IA | Firebase Cloud Functions Gen2 (Node.js 20) |
| IA | Anthropic Claude API (`claude-sonnet-4-6`) — cliente en `lib/ai/claude.ts` |
| Deploy | Vercel (frontend) + Firebase (functions + firestore) |

---

## 2. Autenticación — leer AuthContext PRIMERO

Antes de tocar cualquier cosa relacionada con auth, sesiones o permisos:
1. Lee `context/AuthContext.tsx` (o donde esté definido el AuthContext).
2. Lee `lib/auth/` si existe.
3. Lee las Firestore Security Rules actuales.

**Lo que SÍ vamos a añadir** (sin romper lo existente):

### Tipos de plan de usuario

Añadir campo `planType` al perfil de usuario en Firestore:

```typescript
// Añadir a la colección users/{uid} (o donde esté el perfil)
planType: 'individual' | 'collaborative'
```

- `individual`: el usuario es el único miembro de sus proyectos.
- `collaborative`: el usuario puede invitar colaboradores a sus proyectos.

Si el campo no existe en un documento de usuario (datos legacy), asumir `'individual'`.

### Roles por proyecto

Para el plan `collaborative`, cada proyecto tiene miembros con roles:

```typescript
// Subcollection: moddulo_projects/{projectId}/members/{uid}
{
  uid: string
  email: string
  role: 'owner' | 'collaborator' | 'viewer'
  invitadoEn: Timestamp
  aceptadoEn?: Timestamp
  estado: 'pendiente' | 'activo'
}
```

- `owner`: acceso total (CRUD + cerrar fases + invitar).
- `collaborator`: puede editar variables, chatear, no puede cerrar fases ni invitar.
- `viewer`: solo lectura del EPP y reportes.
- Para plan `individual`, no existe la subcollección `members`; el propietario es el único con acceso.

### Reglas de Firestore a actualizar

```javascript
// moddulo_projects/{projectId}
// Lectura: propietario O miembro activo del proyecto
allow read: if request.auth != null && (
  resource.data.userId == request.auth.uid ||
  exists(/databases/$(database)/documents/moddulo_projects/$(projectId)/members/$(request.auth.uid))
  && get(/databases/$(database)/documents/moddulo_projects/$(projectId)/members/$(request.auth.uid)).data.estado == 'activo'
);

// Escritura completa: solo propietario
allow write: if request.auth != null && resource.data.userId == request.auth.uid;

// Escritura parcial (variables, chat): owner + collaborator
// Implementar con custom claims o verificación en Cloud Function

// Base de conocimiento (RAE, RPF, MEC, MVP, FODA, KPIs)
// Solo lectura para usuarios autenticados; escritura solo para rol eskemma_admin
match /rae_versions/{doc} {
  allow read: if request.auth != null;
  allow write: if request.auth.token.eskemma_admin == true;
}
// Aplicar la misma regla a: rpf_entries, mec_instruments, mvp_instruments,
// foda_instruments, kpi_catalog
```

---

## 3. Colecciones Firestore — existentes y nuevas

### Existentes (NO renombrar, NO eliminar)

```
moddulo_projects/         ← proyectos de Moddulo (ya existe)
centinela_feeds/          ← feeds de Centinela (ya existe)
centinela_configs/        ← configuración de Centinela (ya existe)
users/                    ← perfiles de usuario (confirmar nombre real con AuthContext)
```

Para cualquier otra colección existente detectada al leer el código: **no tocar**.

### Nuevas colecciones (añadir)

```
moddulo_projects/{id}/members/    ← subcollección para colaboración
rae_versions/                     ← snapshots del RAE
rpf_entries/                      ← entradas del RPF (subdocumentos por tipo)
mec_instruments/                  ← instrumentos del MEC (fijos)
mvp_instruments/                  ← vectores del MVP (fijos)
foda_instruments/                 ← marcos FODA-CAME-IBEA (fijos)
kpi_catalog/                      ← catálogo de KPIs (fijo)
```

El esquema detallado de cada colección está en `firestore-schema.ts`.

---

## 4. Rutas Next.js — completas

### Públicas (sin auth)
```
/                         ← landing page (ya existe)
/login                    ← ya existe
/registro                 ← ya existe
```

### Autenticadas
```
/dashboard                ← ya existe

/moddulo                  ← Hub de Moddulo (ya existe)
/moddulo/nuevo-proyecto   ← formulario nuevo proyecto (ya existe)
/moddulo/proyecto/[id]    ← redirect a /f1 (ya existe)
/moddulo/proyecto/[id]/proposito     ← F1 (ya existe)
/moddulo/proyecto/[id]/exploracion   ← F2 (ya existe, parcial)
/moddulo/proyecto/[id]/investigacion ← F3 (esqueleto)
/moddulo/proyecto/[id]/diagnostico   ← F4 (esqueleto)
/moddulo/proyecto/[id]/estrategia    ← F5 (esqueleto)
/moddulo/proyecto/[id]/tactica       ← F6 (esqueleto)
/moddulo/proyecto/[id]/gerencia      ← F7 (esqueleto)
/moddulo/proyecto/[id]/seguimiento   ← F8 (esqueleto)
/moddulo/proyecto/[id]/evaluacion    ← F9 (esqueleto)
/moddulo/proyecto/[id]/miembros      ← gestión de colaboradores (nueva)

/monitor/centinela        ← ya existe, renombrado como Centinela
/monitor/centinela/[id]   ← ya existe

/sefix                    ← ya existe (si aplica)
```

### API Routes
```
/api/moddulo/chat/[phaseId]         ← ya existe (SSE streaming)
/api/moddulo/projects/[id]          ← ya existe
/api/moddulo/projects/[id]/members  ← nueva
/api/moddulo/epp/generate           ← nueva (o verificar si ya existe)
/api/moddulo/epp/update             ← nueva (o verificar si ya existe)
/api/knowledge/rae                  ← nueva (lectura del RAE activo)
/api/knowledge/rpf                  ← nueva (lectura de entradas RPF filtradas)
```

---

## 5. Patrones de Cloud Functions

El chat ya usa SSE streaming desde el cliente hacia una API Route de Next.js.
**Mantener ese patrón para todas las fases.**

Para operaciones pesadas (generar EPP completo, ejecutar dictamen de coherencia,
cargar base de conocimiento), usar Cloud Functions Gen2. El cliente llama a la
API Route de Next.js, que a su vez invoca la Cloud Function.

**Nunca llamar a la API de Anthropic directamente desde el cliente.**
El cliente llama a `/api/moddulo/chat/[phaseId]`, que usa `lib/ai/claude.ts`.

---

## 6. Base de conocimiento — estrategia de inyección por fase

El RAE, RPF, MEC, MVP, FODA y KPIs NO se buscan por similitud vectorial.
Se inyectan de forma **estructurada y selectiva** en el system prompt de Claude
según la fase actual y el tipo de proyecto.

### Qué se inyecta y cuándo

| Fase | RAE | RPF | MEC | MVP | FODA | KPIs |
|---|---|---|---|---|---|---|
| F1 Propósito | Axiomas mapeados a XPCTO (calibración) | No | No | No | No | No |
| F2 Exploración | Axiomas de entorno (Adaptabilidad, Coalición) | No | No | No | No | No |
| F3 Investigación | Axiomas de segmentación | No | No | No | No | No |
| F4 Diagnóstico | Todos los aplicables al tipo de proyecto | No | Sí (completo) | Sí (completo) | Sí (completo) | No |
| F5 Estratégico | RAE filtrado por tipo | RPF filtrado por tipo + maniobra | No | No | No | No |
| F6 Táctico | RAE por protocolo | RPF completo para el tipo | No | No | No | Sí (completo) |
| F7 Gerencia | No | No | No | No | No | KPIs de F6 |
| F8 Seguimiento | No | No | No | No | No | KPIs activos |
| F9 Evaluación | Todos (para cierre de legado) | No | No | No | No | KPIs finales |

### Cómo se carga en el prompt

```typescript
// lib/moddulo/knowledge-injector.ts
export async function buildPhaseContext(
  phaseId: number,
  projectType: 'electoral' | 'gubernamental' | 'legislativo' | 'ciudadano',
  xpcto?: XPCTO,
  f4Output?: DiagnosticoOutput  // solo disponible desde F5
): Promise<string> {
  const parts: string[] = []

  // 1. RAE: cargar versión activa de Firestore, filtrar por fase y tipo
  const rae = await getActiveRAEVersion()
  const axiomas = filterAxiomasByPhaseAndType(rae.axiomas, phaseId, projectType)
  if (axiomas.length > 0) {
    parts.push(formatAxiomasForPrompt(axiomas))
  }

  // 2. Instrumentos fijos (MEC, MVP, FODA): solo desde F4
  if (phaseId >= 4) {
    const mec = await getMECByType(projectType)
    parts.push(formatMECForPrompt(mec))
    // similar para MVP y FODA
  }

  // 3. RPF: solo desde F5, filtrado por tipo y maniobra (si disponible)
  if (phaseId >= 5 && f4Output) {
    const rpfEntries = await getRPFEntries(projectType, f4Output.maniobra)
    parts.push(formatRPFForPrompt(rpfEntries))
  }

  return parts.join('\n\n---\n\n')
}
```

Este contexto se antepone al system prompt existente de cada fase.
El system prompt existente no se elimina: el contexto de la base de conocimiento
va ANTES, seguido del prompt actual.

---

## 7. Actualización del RAE (Opción A — script)

```bash
# Ejecutar desde la raíz del proyecto con credenciales de admin Firebase
npm run seed:rae -- --file=./data/RAE_v2.xlsx --version=2.0 --notes="Ciclo 2026"
```

El script (`scripts/seed-knowledge-base.ts`):
1. Lee el Excel del RAE.
2. Parsea todas las hojas y axiomas.
3. Valida la estructura contra el schema de Firestore.
4. Crea un nuevo documento en `rae_versions/` con la versión como ID.
5. Actualiza `rae_versions/active` con un puntero a la nueva versión.
6. Guarda el anterior como `rae_versions/v{N-1}` (nunca se elimina).

El script para RPF, MEC, MVP, FODA y KPIs es análogo.

---

## 8. Convenciones obligatorias

- **Tipografía web**: exclusivamente Arimo. Nunca Lora (solo editorial impresa).
- **Colores**: solo tokens de `globals.css` (`bluegreen-eske`, `blue-eske`, etc.).
  Para JSX con valores inline, usar los hex exactos del kit de prototipado.
- **Navegación**: siempre `<Link>` de Next.js. Nunca `router.push` en botones de
  navegación principal ni `onClick` que reemplace un enlace.
- **Producto Centinela**: en todo el código nuevo, el producto se llama "Centinela".
  Nunca "Monitor" en strings visibles al usuario. Las colecciones de Firestore
  existentes (`centinela_feeds`, etc.) ya usan el nombre correcto.
- **Server Components por defecto**: `"use client"` solo cuando hay interactividad
  real (estado, eventos de usuario, hooks). Los componentes de datos son Server.
- **Variables de entorno**: nunca hardcodear keys. Usar `.env.local` en desarrollo.

---

## 9. Lo que NO se toca sin autorización explícita

- El sistema de autenticación existente (AuthContext, Firebase Auth config).
- Las colecciones de Firestore existentes (solo se extienden con campos opcionales).
- Las rutas de Centinela ya implementadas.
- El cliente de Claude en `lib/ai/claude.ts` (solo se extiende si es necesario).
- Las Cloud Functions de Centinela ya desplegadas.
- Cualquier componente global del sitio (Header, Footer, layout principal).
