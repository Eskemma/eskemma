# Patrón — Agente conversacional del ecosistema

Extracción de lo construido para **Fontana (T10)** — la primera capa
conversacional del ecosistema. Sirve de referencia para las siguientes
(Sefix-AI / T06 y apps futuras). Está escrito en términos reutilizables: los
nombres concretos de Fontana aparecen solo en la sección de "Implementación
de ejemplo". **No es un contrato rígido** — es el conjunto de decisiones que
ya se tomaron y por qué, para que la siguiente app copie en vez de
reinventar.

Última actualización: 2026-09-01 (ronda de adjuntar archivo + dictado de voz).

---

## 1. Arquitectura de UI

- **Burbuja flotante persistente** (esquina inferior derecha) que abre el
  panel. Se **oculta mientras el panel está abierto** — nunca dos controles
  de cerrar compitiendo por el mismo espacio (el panel ya trae su `×` en el
  header y otra en el composer).
- **Panel responsive** (`ResponsivePanel`): sidebar derecho fijo en desktop
  (con `translate` + `useEscapeKey`, `widthDesktop` configurable),
  bottom-sheet en mobile. Auto-open **solo en desktop** (`matchMedia("(min-width:
  1024px)")`); en mobile nunca se abre solo.
- El contenido de la página se desplaza (`lg:mr-[width]`) cuando el panel
  está abierto en desktop.
- **Composer**: textarea autoexpandible (máx. ~120 px) + botón de adjuntar +
  botón de dictado + botón de enviar (ícono, nunca solo texto) + botón de
  cerrar. Enter envía, Shift+Enter salto de línea.
- **Indicador de progreso genérico**: mientras el agente trabaja se muestra
  "Consultando datos…" con puntos animados (respeta `prefers-reduced-motion`).
  **Nunca** se renderizan nombres de herramienta ni argumentos al usuario,
  aunque se persistan para traza.

## 2. Tool use real (SDK de Anthropic)

- `anthropic.messages.stream({ system, messages, tools })` con bucle sobre
  `stop_reason === "tool_use"` y `MAX_ITERACIONES` (5). **No** se parsea JSON
  a mano de la respuesta del modelo.
- Stream SSE manual (`ReadableStream`) con eventos tipados: `text`,
  `tool_call`, `nav`, `canvas_item`, `done`, `error`. El cliente
  (`useChatStream`) despacha cada evento a callbacks.
- **Regla absoluta de datos**: el agente SOLO responde con lo que devolvió
  una herramienta **en ese turno**. Sin conocimiento propio. Las herramientas
  consumen los endpoints ya existentes de la app, nunca una fuente paralela.
- **Nunca anunciar el resultado de una acción en el mismo turno que la
  dispara** (ej. "¡listo, ya está en el Canvas!" junto a la llamada) —
  todavía no se sabe si funcionó. Confirmar en el turno siguiente con el
  `resultSummary` real.
- **Identificadores internos nunca se muestran al usuario** (en Fontana, los
  `F<familia>-<n>`). El agente los usa solo para llamar herramientas; al
  usuario le habla con nombres en lenguaje llano.
- Metadata estable (nombres de familias/categorías) vive en **una sola
  fuente** que consumen el prompt, las tools y la UI — nunca re-hardcodeada.

## 3. Adjuntar archivo

- **Extraer y descartar** — patrón de PESTEL `upload-source`, **no** el de
  Moddulo. El binario **nunca** toca Storage, ni siquiera temporalmente: el
  buffer vive solo en memoria de la request. Evita heredar deuda de retención
  y no requiere tocar `storage.rules`.
- **Extractor compartido**: `lib/moddulo/attachments.ts`
  (`extractTextFromBuffer(buffer, mime, nombre)` / `extractTextPerFile` /
  `isExtractionError` / `resolveEffectiveMime`). Cubre PDF (pdf-parse +
  fallback a visión de Claude), DOCX (mammoth), XLSX (exceljs — **no**
  SheetJS/`xlsx`, ese paquete npm está desactualizado con advisories),
  TXT/CSV/JSON (texto directo), imágenes (visión de Claude). No dupliques
  esta lógica: reúsala.
- **Validación de tipo REAL en servidor** (magic bytes + extensión), no solo
  el MIME que manda el navegador — el chat de Moddulo no valida nada
  server-side y ése es el hueco a no repetir. PDF → `%PDF`; DOCX/XLSX →
  firma ZIP `PK\x03\x04`; TXT/CSV → UTF-8 decodable sin bytes NUL.
- **Límite de tamaño 10 MB** (mismo que Moddulo y PESTEL). Texto extraído
  truncado a `MAX_TEXT_CHARS` (50 000, igual que PESTEL).
- El texto es **contexto del turno**, no una herramienta ni una fuente de
  datos: el agente nunca cita una cifra del documento como si fuera un valor
  oficial. Regla explícita en el system prompt.
- **Errores de extracción reportados con claridad** (chip en estado error con
  mensaje legible), nunca en silencio.
- **Presupuesto de contexto**: el bloque de adjuntos que se antepone al turno
  tiene un tope en caracteres (`PRESUPUESTO_ADJUNTOS_CHARS`, 60 000 ≈ 16 K
  tokens). Orden de llenado: primero los adjuntos del turno actual completos,
  luego el resto de la sesión (más recientes primero), luego un aviso de
  cuántos quedaron fuera. Con la ventana de 200 K de Claude Sonnet 4.6 esto
  deja ≥ 130 K de headroom incluso en conversaciones largas.

## 4. Retención

- El texto extraído se persiste en una **subcolección append-only** ligada a
  la sesión (`.../sesiones/{id}/adjuntos`), mismo patrón que los mensajes de
  chat.
- **Borrado en cascada al eliminar la sesión**: `adminDb.recursiveDelete(ref)`
  (no `ref.delete()`, que deja subcolecciones huérfanas en Firestore).
- **Purga por antigüedad**: Cloud Function programada (`onSchedule` de
  `firebase-functions/v2/scheduler`, `every 24 hours`,
  `timeZone: "America/Mexico_City"`) que borra los adjuntos con más de
  **90 días** de `cargadoEn`, aunque la sesión siga activa — dato político
  sensible, no debe acumularse.
- `cargadoEn` se guarda como **`Timestamp`** (no ISO string) para que la
  query de rango de la purga funcione sin índice compuesto.
- La purga **itera sesión por sesión** en vez de una `collectionGroup` query
  global — suficiente para el volumen esperado y evita el primer índice
  `COLLECTION_GROUP` del repo. Migrar solo si el conteo de sesiones lo hace
  lento.
- Deploy de la función es manual (`firebase deploy --only functions`); la
  purga no corre hasta ese deploy.

## 5. Dictado de voz

- **Web Speech API nativa** (`window.SpeechRecognition ??
  window.webkitSpeechRecognition`), sin librería. `lang = "es-MX"`,
  `interimResults = true`, `continuous = false`.
- El texto reconocido aparece **editable en el composer**, nunca se
  auto-envía.
- **Estado explícito de navegador no soportado** (Firefox y varios móviles no
  tienen la API): botón deshabilitado con `aria-label`/`title` explicativo +
  nota visible bajo el composer. Nunca falla en silencio.
- Errores mapeados a mensaje legible (`not-allowed` → permiso denegado,
  `audio-capture` → sin micrófono, etc.).
- **Permiso de micrófono acotado por ruta** en `next.config.ts`: el header
  global es `Permissions-Policy: microphone=()` (site-wide, bloqueado); solo
  la ruta de la app conversacional lo relaja a `microphone=(self)` con un
  bloque `headers()` posterior al global (en Next.js gana la última
  coincidencia con la misma `key`). **Nunca** se relaja site-wide.

## 6. Persistencia

- Mensajes de chat en **subcolección append-only** (`.../sesiones/{id}/mensajes`),
  no en un campo del documento (puede crecer sin el límite de 1 MB por doc).
- Salidas fijadas (Canvas) en un **campo array aditivo** del documento de
  sesión.
- **Sin store de cliente nuevo**: `useState` + endpoints. Rehidratación al
  montar vía `GET .../mensajes`.
- Firestore Admin **rechaza `undefined`** (no se activa
  `ignoreUndefinedProperties`): helper `limpiarUndefined()` en profundidad
  antes de cada `.set()`.

---

## Implementación de ejemplo (Fontana T10)

| Pieza | Archivo |
|---|---|
| Burbuja + panel | `app/centinela/fontana/FontanaAgentBubble.tsx` |
| Panel + composer | `app/components/shared/chat/ChatPanel.tsx` |
| Panel responsive | `app/components/shared/ResponsivePanel.tsx` |
| Hook SSE | `app/components/shared/chat/useChatStream.ts` |
| Hook de dictado | `app/components/shared/chat/useSpeechDictation.ts` |
| Renderer markdown | `app/components/shared/chat/MarkdownContent.tsx` |
| System prompt | `lib/fontana/agente/systemPrompt.ts` |
| Definición + ejecución de tools | `lib/fontana/agente/tools.ts` |
| Builders de salidas (Canvas) | `lib/fontana/agente/canvasBuilder.ts` |
| Bloque de contexto de adjuntos | `lib/fontana/agente/adjuntosContexto.ts` |
| Ruta de chat SSE | `app/api/fontana/chat/route.ts` |
| Ruta de subida de adjunto | `app/api/fontana/sesion/[sesionId]/adjunto/route.ts` |
| Extractor de texto compartido | `lib/moddulo/attachments.ts` |
| Purga programada | `functions/src/fontana/purgeAdjuntos.ts` |
| Header de micrófono por ruta | `next.config.ts` (bloque `/centinela/fontana`) |
| Metadata de familias (fuente única) | `lib/fontana/familias.ts` |

### Deuda conocida heredada del patrón

- **Duplicación del primitivo de chat**: `app/components/shared/chat/*` (nuevo,
  Fontana) coexiste con `app/moddulo/components/ModduloChat.tsx` +
  `AdvisorPanel.tsx` (loop SSE y renderer markdown duplicados). Migrar los de
  Moddulo a los primitivos compartidos queda pendiente.
- **`extractTextPerFile` no lanza** si falta el objeto en Storage — devuelve
  un placeholder del set cerrado; los callers deben usar `isExtractionError`.
- **Rate limiting del fallback de visión** (Claude leyendo un PDF sin texto
  nativo como imagen): no implementado ni en PESTEL ni en Fontana.
