# Implementation Plan: Gap B — detector de frescura CLAUDE.md ↔ código

## Overview

Construir el mecanismo aprobado tras la investigación de la ronda
anterior: un script determinístico (Opción 1) que compara la fecha del
último commit real de ciertas rutas de código contra la fecha del
último commit que tocó la sección de `CLAUDE.md` que las describe, un
párrafo de proceso en `CLAUDE.md` que lo activa en cada cierre de ronda
(Opción 2), y la documentación del flujo de redacción asistida cuando
el detector marca algo (Opción 3 acotada — sin comando nuevo).

## Architecture Decisions

- **Manifiesto**: JSON en `docs/claude-md-freshness-manifest.json` —
  JSON y no YAML porque el repo no tiene ninguna dependencia de parseo
  YAML instalada (`js-yaml` no está en `package.json`) y JSON se lee
  nativo sin dependencia nueva, consistente con "instalar solo lo
  mínimo necesario" de las rondas anteriores.
- **Anclas por texto, no por línea**: cada entrada tiene un `anchor`
  (string exacto a buscar con `grep -n` en `CLAUDE.md`, ej.
  `"| \`/sefix\`"` o `"| E6"`) — el script resuelve el número de línea
  actual en cada corrida. Esto es la corrección explícita a la
  limitación que identifiqué en la investigación (números de línea fijos
  se corren con cada edición del archivo).
- **Rango de líneas para `git log -L`**: cada entrada apunta a UNA línea
  (la fila de tabla es una sola línea en Markdown) — no un rango
  multilínea, así que `-L <n>,<n>:CLAUDE.md` es exacto y no ambiguo.
- **Manejo de rutas sin commits** (ej. la fila "Integración con Moddulo
  F2 (exploración)", `⏳ Pendiente`, cuyo código aún no existe): el
  script debe tratarlo como "sin datos, no flaguear" — no como error ni
  como falso positivo. Confirmado en el Paso 5 con evidencia real.
- **Formato de salida**: tabla de texto plano por stdout — no JSON — el
  consumidor es el humano/agente cerrando la ronda, no otro script.
  Código de salida 0 si nada está desactualizado, 1 si hay al menos una
  sección marcada (permite usarlo luego en un hook si se decide, sin
  rediseñar nada).

## Task List

### Fase 1: Manifiesto
- [ ] Tarea 1: Revisar `CLAUDE.md` completo por segunda vez (además del
  grep de emojis ya hecho) para confirmar que no queda ninguna otra
  sección con afirmación de estado verificable contra código — no solo
  los 2 casos ya conocidos.
- [ ] Tarea 2: Escribir `docs/claude-md-freshness-manifest.json` con
  todas las entradas encontradas (mínimo: fila de Sefix, fila de PESTEL
  en la tabla de módulos, las 5 filas de "Estado de fases" de PESTEL).

### Fase 2: Script
- [ ] Tarea 3: `scripts/check-docs-freshness.ts` — resuelve ancla →
  línea (grep), línea → fecha (git log -L), ruta(s) → fecha más
  reciente (git log -1 --format=%at por ruta, toma el máximo si hay
  varias), compara, reporta brecha en días.
- [ ] Tarea 4: Agregar `"check-docs-freshness": "tsx scripts/check-docs-freshness.ts"`
  a `package.json`.

### Checkpoint: Script funcional
- [ ] `npm run check-docs-freshness` corre sin error contra el estado
  actual del repo (ya corregido) y no marca ni Sefix ni PESTEL E6/E7/E8
  — ambos siguen desactualizados en la BRECHA que mide (código más
  nuevo que el texto), pero el texto ya es correcto, así que aquí el
  detector seguiría marcándolos por fecha aunque el CONTENIDO ya esté
  bien — ver nota de diseño abajo, resuelta antes del Paso 5.

**Nota de diseño importante, descubierta al planear el Paso 5**: mi
corrección de Sefix (Fase de diagnóstico) SÍ actualizó la línea de
`CLAUDE.md`, así que su fecha de "última edición" ahora es reciente
(2026-09-15, la corrección) — el detector NO la marcará, correctamente.
Pero la fila de **PESTEL E6/E7/E8 sigue sin corregir** (la señalé pero
no la arreglé, por instrucción explícita de "repórtala, no la
corrijas todas sin decírmelo primero") — así que el detector SÍ la va a
marcar en la corrida real de la Fase 5, con la fecha actual del código
(94-108 días de brecha) — **esto es la prueba positiva pedida en el
Paso 5, ocurre de forma natural, no hace falta revertir nada
mentalmente**. Para el caso de Sefix (ya corregido), la prueba del
"antes" se hace apuntando el mismo manifiesto al commit `380dd67`
(el estado justo antes de mi corrección) en vez de `HEAD`.

### Fase 3: Proceso (Opción 2 + Opción 3 acotada)
- [ ] Tarea 5: Párrafo breve en `CLAUDE.md` (sección nueva y corta, o
  añadido a "Idioma y Commits" — decidir ubicación al escribir)
  documentando: correr `npm run check-docs-freshness` al cerrar una
  ronda, antes de escribir la entrada del Historial de Sprints; si
  marca algo, pedirle a Claude Code que lea el código real de la ruta
  señalada y redacte la corrección de esa sección específica — mismo
  flujo ya usado manualmente con Sefix y PESTEL en esta conversación.
  Sin comando nuevo para esto.

### Fase 4: Prueba real
- [ ] Tarea 6: Corrida contra `HEAD` (estado actual) — confirmar que
  Sefix NO se marca (ya corregido) y que PESTEL E6/E7/E8 SÍ se marca
  (nunca corregido, y sigue el mismo código, más viejo cada día que
  pasa).
- [ ] Tarea 7: Corrida contra el commit `380dd67` (el estado previo a mi
  corrección de Sefix) — confirmar que AMBOS se marcan ahí, con la
  brecha de ~125/~94-108 días medida en la investigación.

### Fase 5: Cierre
- [ ] Tarea 8: Checklist completo de `code-review-and-quality`, honesto.
- [ ] Tarea 9: `tsc --noEmit` + `next build`, el par completo, reales.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `git log -L` es lento en un repo con historial largo | Bajo — el manifiesto tiene ~7 entradas, no cientos | Medir el tiempo real de la corrida completa en el Paso 5 y reportarlo, no asumir que es rápido |
| Una ruta del manifiesto ya no existe (renombrada/borrada) | Medio — el script podría crashear | `git log -1 -- <path>` con una ruta inexistente no truena, devuelve vacío — el script debe tratar "sin commits" como "sin datos", no como error (mismo criterio que la fila de Moddulo F2 sin código aún) |
| El ancla de texto deja de ser única si se edita `CLAUDE.md` y aparece 2 veces | Bajo | El script debe fallar RUIDOSAMENTE (no en silencio) si un ancla resuelve a 0 o >1 líneas — mejor un error visible que una comparación contra la línea equivocada |

## Open Questions

Ninguna para el usuario — el Paso 5 ya viene con la forma de demostración
resuelta arriba (PESTEL da la prueba positiva "en vivo" contra HEAD sin
necesidad de revertir nada; Sefix se prueba contra el commit anterior a
mi propia corrección).
