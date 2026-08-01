# Moddulo F1-F3 — Resumen técnico de traspaso

**Propósito de este documento:** dar contexto suficiente a una nueva sesión de trabajo para continuar de forma eficiente con el desarrollo de las apps del ecosistema Eskemma, sin necesidad de releer todo el historial de chat. Cubre arquitectura, modelo de datos, decisiones de diseño y el punto exacto de integración entre Moddulo F3 y las apps por construir.

**Fecha de corte:** 2026-07-22. Estado: F1-F3 completos y verificados; arranca desarrollo de apps del ecosistema.

---

## 1. Qué es Moddulo y dónde vive

Moddulo es el módulo central de Eskemma (`/moddulo`): metodología de consultoría política con IA, organizada en **9 fases secuenciales**:

```
proposito → exploracion → investigacion → diagnostico →
estrategia → tactica → gerencia → seguimiento → evaluacion
```

Cada proyecto (`moddulo_projects` en Firestore) avanza fase por fase. Cada fase tiene:
- Un chat con Claude vía streaming SSE (`/api/moddulo/chat/[phaseId]`), donde el consultor conversa con Moddulo.
- Uno o más "motores" (M1, M2, M3...) que son llamadas estructuradas a Claude que generan JSON tipado (no texto libre de chat) y alimentan un formulario/dictamen validado por el usuario.
- Un reporte descargable determinístico (`lib/moddulo/reportFormatters.ts`) que renderiza a Markdown lo ya generado/aprobado en pantalla — nunca llama a Claude, y es defensivo: campos ausentes se marcan explícitamente en vez de tronar.

Solo **F1 (Propósito), F2 (Exploración) y F3 (Investigación)** están completos hoy. F4 (Diagnóstico) en adelante no existen aún.

---

## 2. F1 — Propósito (XPCTO)

Formulario de 5 variables que define el hito estratégico del proyecto:

- **X** — Hito
- **P** — Sujeto
- **C** — Capacidades (`financiero`, `humano`, `logistico` — nota de deuda técnica: el FAT 2.0 define 4 dimensiones separando Humano/Organizacional; aquí están fusionadas en `humano`. No bloquea nada, evaluar solo si se toca el wizard de F1).
- **T** — Tiempo (`fechaLimite`, `duracionMeses`)
- **O** — Justificación

El chat de F1 termina en un **Dictamen** validado por el usuario. Este dictamen es el input fijo que F2 y F3 usan como referencia ("HEI" — Hipótesis Estratégica Inicial la refina F2).

Criterios de evaluación de suficiencia de F1 viven en `lib/moddulo/criterios.ts` — alimentan el RDA (ver §6).

---

## 3. F2 — Exploración (DVS)

F2 produce el `DVSF2` (Diagnóstico de Viabilidad Situacional), con 5 motores:

- **M1** — no listado explícitamente en el resumen de F1, análogo interno de arranque.
- **M2 — Contraste XPCTO-Entorno**: por cada dimensión XPCTO (X/P/C/T/O), un veredicto `coherente | requiere_ajuste | requiere_investigacion` con argumentación y señales PESTEL de respaldo.
- **M3 — Semáforo de Riesgo de Veto**: identifica actores (`ActorVetoF2`) con `nivelRiesgo: rojo|ambar|verde` y si `requiereInvestigacion`. Estos actores rojos/ámbar alimentan después el FODA de Adversarios en F3-M3.
- **M4 — Mapa de Incertidumbres Estratégicas**: cada incertidumbre tiene `urgencia`, `resolucion` (alta/media/baja) y `destino` (a dónde se deriva: PIP, RDA, etc.).
- **M5 — PIP (Programa de Investigación Profunda)**: la lista `PIPItem[]` (`numero`, `pregunta`, `metodo`, `profundidad`, `vinculoHito`) que se convierte en el input directo de F3 — cada `PIPItem` se convierte en una `TareaPIP` en F3.
- **HEI refinada**: `contexto`, `tensionCentral`, `condicionesFavorables/Adversas`, `premisaEstrategica` — la hipótesis que F3-M4 termina veredicto-ando.

También corre el análisis **PESTEL** (`MapaPESTEL`, dimensiones P/E/S/T/Ec/L) — comparte metodología con el módulo standalone `/centinela/pestel` pero es una instancia propia dentro del proyecto Moddulo, no el mismo dato.

Criterios de suficiencia de F2 en `lib/moddulo/dvs-criteria.ts`.

**Nota de integración pendiente** (documentada en CLAUDE.md, no resuelta aún): en la fase `exploracion` (F2), Moddulo debería poder consumir el módulo PESTEL real de Centinela para generar el análisis del territorio del proyecto. Hoy F2 genera su propio PESTEL vía Claude, sin integración directa con `/centinela/pestel`. Es un candidato natural para cuando se conecten los módulos como apps del ecosistema.

---

## 4. F3 — Investigación (el bloque más grande, foco de esta sesión)

F3 ejecuta el PIP heredado de F2: cada `PIPItem` se convierte en una `TareaPIP` que debe cubrirse con evidencia real, vía un **modelo multi-canal**, y termina en un veredicto sobre la HEI.

### 4.1 Modelo de asignación multi-canal (`AsignacionCanal`)

Cada `TareaPIP` tiene un arreglo `asignaciones: AsignacionCanal[]` — múltiples vías simultáneas e independientes para responder la misma pregunta de investigación, no una sola vía con fallback:

```ts
interface AsignacionCanal {
  asignacionId: string;
  tipo: "primaria" | "complementaria"; // interno, solo bookkeeping de M1 al generar — NUNCA se muestra en UI
  canal: "canal1" | "canal2" | "canal3";
  tecnicaId?: TecnicaId;      // solo canal1
  estadoApp?: "disponible" | "proximamente"; // solo canal1
  justificacion: string;
  estado: "pendiente" | "en_curso" | "recibido" | "derivado";
  resultadoId?: string;
  activada: boolean;          // Ronda 5 — toggle independiente por asignación
}
```

**Los tres canales:**
- **Canal 1 — App del ecosistema**: la técnica (`tecnicaId`, catálogo MMEE de 35 técnicas, `TECNICA_TITULOS` en `types/f3.types.ts`) se resuelve idealmente vía una app real de Eskemma (Sefix, Referencias, Radar...). Hoy `APP_TO_F3_CONTRACTS` está **vacío** — este es exactamente el gancho que las apps por construir deben llenar (ver §8).
- **Canal 2 — Carga manual**: el consultor sube evidencia directamente (`CargaManualForm` en `F3TareasPIP.tsx`), declarando `metodoDeclarado` (texto libre) y `familiaMetodologica` (sugerida automáticamente vía `sugerirFamiliaMetodologica()`, editable).
- **Canal 3 — Herramienta externa**: vincula una fuente ya obtenida fuera del ecosistema (`VincularFuenteForm`), con evaluación de compatibilidad antes de vincular (ver §4.4).

**Regla de negocio clave (Ronda 5, reemplaza el modelo previo de "primaria/complementaria"):** el campo `tipo` sigue existiendo en el tipo pero **ya no gatea nada visible ni funcional** — es vestigial para M1. Lo que gatea todo ahora es `activada: boolean`, un toggle independiente por asignación:

```ts
// lib/moddulo/f3Suficiencia.ts
export function tareaCubierta(tarea: TareaPIP): boolean {
  const asignaciones = tarea.asignaciones ?? [];
  return asignaciones.some((a) => a.activada && (a.estado === "recibido" || a.estado === "derivado"));
}
```

Una tarea está cubierta si **al menos una** asignación activada llegó a resultado. Desactivar una asignación (`activada: false`) la saca de la cuenta de suficiencia para M4, pero **no borra su resultado ni su relevancia para M2/M3** — ver la distinción crítica en §4.3.

### 4.2 Los 4 motores de F3

- **M1 — Tablero de tareas**: genera las `AsignacionCanal[]` propuestas por tarea. UI: `F3TareasPIP.tsx` — tarjetas ordenadas canal1-primero (`P{numero}` como header, no `#{numero}`), badge de etiqueta (`asignacionEtiquetaCompleta`, formato `"App: {nombre}"` / `"Acción a realizar: {nombre}"`), selector Activada/Desactivada junto al badge de estado.
- **M2 — Aprobación de resultados**: cada `ResultadoF3` (carga manual o fuente externa) requiere `aprobado: boolean` explícito del usuario antes de entrar a M3. Ningún resultado entra a síntesis sin aprobación humana — regla de human-in-the-loop no negociable (heredada de la spec de PESTEL, aplica igual aquí).
- **M3 — Síntesis de hallazgos** (`app/api/moddulo/f3/sintesis/generar/route.ts`): cruza resultados aprobados con el tablero, produce `SintesisF3`:
  - `convergencias: Convergencia[]` — `{ texto: string; sustentoUnico?: boolean }` (antes `string[]`; el campo `sustentoUnico` es la triangulación nueva, ver §4.5).
  - `contradicciones: string[]`
  - `vaciosResiduales: VacioResidual[]` — dos tipos: tarea completa sin cobertura, o una asignación específica sin resultado aunque otra de la misma tarea sí tenga. Cada uno con `destino: "RDA" | "SIP"` según urgencia/resolución.
  - `fodaPropioInsumo` / `fodaAdversariosInsumo` — línea base de FODA (no el FODA final, eso es F4), un FODA de adversario por cada `ActorVetoF2` relevante del Semáforo de F2.
- **M4 — Veredicto sobre la HEI** (`VeredictoHEI`): dictamina si la Hipótesis Estratégica Inicial de F2 se sostiene, con `resultado`, `contraste`, `argumentacion`, `premisaResultante` opcional. Solo puede generarse cuando todas las tareas están `tareaCubierta()` (semáforo de suficiencia, `F3CoberturaSidebar.tsx` / `F3Veredicto.tsx`).

El reporte final de F3 (`formatF3Report` en `reportFormatters.ts`) consolida M1+M3+M4 en un solo Markdown descargable — es el "DIE" (documento de investigación) de la fase.

### 4.3 La distinción `activada` — regla que gobierna todo F3

Establecida explícitamente por el usuario y aplicada de forma consistente en 3 puntos distintos del código: **`activada` solo gatea la suficiencia de M4 (`tareaCubierta`), nunca qué evidencia usa M2/M3 para sintetizar.**

Esto significa:
1. `tareaCubierta()` / `tareasSinCubrir()` — SÍ filtran por `activada`.
2. `sintesis/generar/route.ts` — filtra `tareasParaPrompt` para que Claude no genere un vacío residual duplicando una desactivación ya trazada aparte en el RDA, pero si el filtrado deja una tarea sin ninguna asignación, se marca `sinViasActivas: true` explícitamente (nunca desaparece en silencio).
3. `tareasConSustentoUnico()` (triangulación, `lib/moddulo/triangulacion.ts`) — **NO** filtra por `activada`: una asignación desactivada con `resultadoId` y resultado aprobado sigue contando para la señal de triangulación, porque esa evidencia sigue siendo real y sigue siendo parte de lo que M3 ya usó para sintetizar.

Cuando el usuario desactiva una asignación, esa decisión se traza en el RDA vía `evaluarDesactivaciones()` (`lib/moddulo/criterios-investigacion.ts`) con `estado: "activo"` + `aceptadoAutomaticamente: true` (ver §6).

### 4.4 Canal 3 — Herramienta externa (reescrito esta sesión)

`VincularFuenteForm` (dentro de `F3TareasPIP.tsx`) es un mini-flujo de 2 pasos:

- **Paso 1 — Territorio**: reutiliza `app/components/shared/TerritorySelector.tsx` tal cual (componente de wizard con su propia navegación Atrás/Continuar) — decisión deliberada de no construir un selector nuevo.
- **Paso 2 — Datos + evaluación**: `nombreHerramienta`, `fechaObtencion`, `tipoProyectoDeclarado`, `metodoDeclarado` (texto libre, ya no el catálogo MMEE `tecnicaId`/`otro`), `familiaMetodologica` (sugerida, editable), archivo.
  - Botón "Evaluar compatibilidad" → `POST /api/moddulo/f3/canal3/evaluar` (sin archivo) → `EvaluacionCompatibilidad`: `pertinencia` (rechazo duro sin bypass si `cumple:false`), `territorioRequiereConfirmacion` (checkbox propio), `vigencia` (checkbox propio si no cumple), `compatibilidadMetodologica` (siempre informativo).
  - Botón "Vincular fuente" habilitado solo cuando pertinencia cumple y las confirmaciones necesarias están marcadas → sube archivo (`request-upload` + `uploadMedia`) → `POST /api/moddulo/f3/canal3/vincular`.

`MetadatosFuenteExterna` en `types/f3.types.ts` ahora incluye `familiaMetodologica: FamiliaMetodologica`, alineando Canal 3 con el mismo modelo de familia metodológica que Canal 2 (`cuantitativa | cualitativa | documental | mixta`) — esto es lo que habilita la triangulación de M3 a resolver familia también para resultados de Canal 3.

### 4.5 Triangulación informativa (`lib/moddulo/triangulacion.ts`, nuevo)

Señal puramente informativa, no bloqueante: si una tarea tiene ≥2 resultados aprobados y **todos** resuelven a la misma familia metodológica (sin variedad de evidencia), se marca como "sustento único". La resolución de familia por canal:

- `canal1` → `FAMILIA_METODOLOGICA_POR_TECNICA[tecnicaId]`
- `canal2` → `resultado.metadatosCarga.familiaMetodologica`
- `canal3` → `resultado.metadatosFuente.familiaMetodologica`

Claude recibe la lista de números de tarea marcados y decide, por convergencia, si `sustentoUnico: true` aplica — se muestra en UI como badge amarillo discreto ("Sustento único") en `F3Sintesis.tsx` y se anota en el reporte Markdown.

---

## 5. Catálogo MMEE y `APP_TO_F3_CONTRACTS` — el punto de integración con las apps

`types/f3.types.ts` define:

```ts
export type TecnicaId = "T01" | ... | "T35"; // 35 técnicas metodológicas (types/shared.types.ts)
export const TECNICA_TITULOS: Record<TecnicaId, string> = { T01: "Encuesta de opinión pública...", ... };
export const NOMBRES_COMERCIALES: Record<TecnicaId, string>; // T34→"Radar", T06→"Sefix", T22→"Pestel", T25→"Referencias"...
export const FAMILIA_METODOLOGICA_POR_TECNICA: Record<TecnicaId, FamiliaMetodologica>;

export interface AppContractConfig {
  tecnicaId: TecnicaId;
  componente: "sefix" | "centinela" | "recursos";
  pipModulos: string[];
  deliveryMechanism: "api-push" | "link-manual";
  payloadSchema?: string;
}
export const APP_TO_F3_CONTRACTS: Partial<Record<TecnicaId, AppContractConfig>> = {}; // VACÍO
```

`ResultadoF3<TPayload>` (el contrato genérico que cualquier canal produce) vive en `types/f3.types.ts` + `types/shared.types.ts`:

```ts
interface ResultadoF3<TPayload = unknown> {
  moduloPIP: string;
  origen: OrigenTrazabilidad; // { sourceKind, componente, analisisId, fechaEntrega }
  cobertura: CoberturaDeclarada; // { completa, detalle? }
  payload: TPayload;
  aprobado?: boolean; // M2 — gate de human-in-the-loop
  notasUsuario?: string;
}
```

**Esto es exactamente lo que las apps del ecosistema (Sefix, Centinela/PESTEL, Referencias, Radar, etc.) deben producir cuando entregan un resultado a Canal 1 de F3.** Hoy `APP_TO_F3_CONTRACTS` está vacío porque ninguna app real empuja resultados todavía — Canal 1 en la práctica se comporta como un placeholder ("estadoApp: proximamente" en la mayoría de técnicas). El trabajo de construir cada app del ecosistema consiste, en parte, en:

1. Definir su `AppContractConfig` (qué técnicas cubre, mecanismo de entrega `api-push` vs `link-manual`, schema del payload).
2. Implementar el lado app → F3: cuando el análisis de la app está listo, empujar un `ResultadoF3` con `origen.componente` correcto y `payload` tipado, entrando exactamente al mismo pipeline de aprobación M2 → síntesis M3 que ya usan Canal 2 y Canal 3.
3. Actualizar `estadoApp` de `"proximamente"` a `"disponible"` para las técnicas que la app ya resuelve.

Precedente ya construido y sirve de referencia de patrón: `linkedSource` (Canal 2 de PESTEL — vinculación de fuente externa con evaluación de compatibilidad, commit `8e906a5`) sigue la misma forma de contrato app↔F3 que Canal 3 de Moddulo, y ambos comparten la generalización en `types/shared.types.ts` (`OrigenTrazabilidad`, `CoberturaDeclarada`, territorio/tipo con "bloqueo duro sin bypass").

---

## 6. RDA (Registro de Deficiencias Activas) — mecanismo transversal

El RDA acumula deficiencias detectadas a lo largo de todas las fases. Patrón de implementación: **recomputación en vivo + diff**, nunca persistencia de derivados por separado.

- Cada fase tiene su función pura `evaluar*()` (`lib/moddulo/criterios.ts` F1, `lib/moddulo/dvs-criteria.ts` F2, `lib/moddulo/criterios-investigacion.ts` F3) que, dado el estado actual del proyecto, devuelve el conjunto "vigente" de items de deficiencia.
- `lib/moddulo/rda.ts` → `planRDAUpdate()` compara ese conjunto vigente contra `project.rda` persistido y computa un plan `nuevos`/`resueltos` fresco en cada evaluación — cualquier item `"activo"` cuyo id ya no aparece en "vigentes" se auto-resuelve.
- `RDAItem.estado: "activo" | "resuelto" | "aceptado"`.
- `RDAItem.origenMecanismo` ahora incluye `"asignacion_desactivada"` (Ronda 5) junto a `"criterio_suficiencia"` y `"vacio_residual"`.
- `RDAItem.aceptadoAutomaticamente?: boolean` — nuevo campo para desactivaciones: usan `estado: "activo"` deliberadamente (para que el motor de reconciliación las auto-resuelva si la asignación se reactiva) pero se muestran en `RDAHistoryModal.tsx` como "Aceptado automáticamente" (sin botón de aceptar, indistinguible en tratamiento de un `"aceptado"` manual pero con badge distinto).

Esto significa: cualquier app nueva que module el estado de una `AsignacionCanal` (aprobarla, desactivarla, entregar resultado) debe considerar que el RDA se recalculará solo en el siguiente ciclo de evaluación — no requiere que la app escriba al RDA directamente.

---

## 7. Convenciones técnicas transversales (aplican a todo, incluidas las apps nuevas)

- **Stack**: Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4.1.5 con `@theme` (colores custom `blue-eske/orange-eske/bluegreen-eske/gray-eske/black-eske/white-eske/yellow-eske/green-eske/red-eske`, escalas `-10` a `-90` — nunca colores genéricos de Tailwind en componentes nuevos).
- **Auth**: sesión Firebase vía cookie HTTP-only (`lib/session.ts`, `lib/server/auth-helpers.ts` para API routes con `getSessionFromRequest(request)`, `lib/server/session.server.ts` para Server Components con `getServerSession()`). Toda API route de una app nueva debe validar sesión y que el `userId` del token coincide con el recurso pedido.
- **Cloud Functions**: paquete separado en `functions/`, no puede importar de `lib/` raíz — cualquier lógica compartida (ej. scrapers, gates de país, pesos de dimensión) debe mantenerse **duplicada y sincronizada manualmente** en ambos lados; ver tabla de puntos de sincronización en CLAUDE.md.
- **Firestore**: queries con `where`+`orderBy` requieren índice compuesto o fallan en silencio — preferir ordenar en memoria si el volumen es bajo (<100 docs/usuario).
- **Defensividad de datos generados por Claude**: todo componente que renderiza un campo que viene de una respuesta JSON de Claude asume que puede faltar (`?? []`, `?? {}`) — nunca debe tronar el render por un campo ausente; se marca explícitamente como pendiente en vez de fallar.
- **Verificación establecida en esta sesión** (patrón reutilizable para cuando se prueben las apps nuevas):
  - Sesión real: custom-token → ID-token (Identity Toolkit REST) → session cookie vía `/api/auth/session` real.
  - Funciones puras: bundlear con esbuild (`--bundle --platform=node --format=esm --packages=external`) + ejecutar con `node` plano — **tsx tiene un bug conocido en este sandbox que trunca silenciosamente exports de import dinámico**, no usarlo para este propósito.
  - Visual: Puppeteer a 380-420px (mobile) y 1440px (desktop); dark mode se activa con `localStorage.setItem("eskemma:theme","dark")` (NO vía `prefers-color-scheme` — es class-based `.dark` en `<html>`, controlado por script inline en `app/layout.tsx`).
  - Limitación aceptada y no un bug: `uploadMedia()` (Storage client SDK) no puede completarse en Puppeteer headless sin sign-in real de Firebase Auth en cliente — una cookie de sesión de servidor no basta. Ya es así también en Canal 2, no es nuevo.
  - Siempre limpiar: docs Firestore sembrados, archivos de Storage, usuarios de Auth de prueba, archivos scratch, y procesos de dev server (`pkill -9 -f "next dev"` + borrar `.next/dev/lock`) al cerrar verificación.
- **Commits**: formato `YY-MM-DD. tipo(scope): descripción`, siempre en español para el mensaje, código/comentarios en inglés.

---

## 8. Relación con el resto del sitio Eskemma y roadmap de apps

Rutas activas hoy fuera de Moddulo: `/centinela/pestel` (análisis PEST-L, comparte metodología conceptual con el PESTEL interno de F2 pero es un módulo independiente), `/cursos`, `/sefix` (dashboard electoral Shiny embebido), `/blog`. Suscripciones por rol (`freemium/basic/premium/professional`) gatean acceso — Centinela y Moddulo requieren `premium+`.

**El trabajo que arranca ahora** es construir las apps reales del ecosistema (una por técnica o grupo de técnicas del catálogo MMEE) que:
1. Operan de forma standalone (con su propio valor, ej. Sefix ya existe como dashboard electoral).
2. Se conectan a F3-Canal 1 de Moddulo llenando `APP_TO_F3_CONTRACTS`, produciendo `ResultadoF3` reales en vez de placeholders `"proximamente"`.
3. Siguen el mismo patrón de contrato app↔F3 ya probado por Canal 2 (carga manual) y Canal 3 (fuente externa con evaluación de compatibilidad) — territorio/tipo con bloqueo duro, familia metodológica, aprobación M2 explícita antes de entrar a síntesis.

Punto de partida recomendado para la próxima sesión: decidir qué técnica(s)/app(s) se construyen primero (candidatos con nombre comercial ya asignado en `NOMBRES_COMERCIALES`: T34→Radar, T06→Sefix ya existe y podría ser el primer caso de conexión real vía Canal 1 en vez de placeholder, T22→Pestel apunta a integrar `/centinela/pestel` real con F2/F3, T25→Referencias), y diseñar su `AppContractConfig` + el endpoint de entrega hacia `ResultadoF3`.
