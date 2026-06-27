# Módulo: Moddulo | Eskemma
## Documentación para INDAUTOR

**Autor:** Raúl Sánchez Salgado  
**Fecha:** 2026-04-10  
**Estado:** Activo en producción

---

## Descripción

Moddulo es el módulo de gestión estratégica de proyectos políticos de Eskemma.
Raúl Sánchez Salgado diseñó el flujo de 9 fases secuenciales basado en su experiencia
como consultor político. La IA (Claude Sonnet 4.6) actúa como asistente en cada fase,
pero el consultor humano dirige el proceso.

---

## Ruta

`/moddulo` (Next.js App Router)

---

## Arquitectura de Fases

Raúl diseñó la secuencia de fases como un proceso consultivo estructurado:

```
F1: propósito      → Definición del objetivo del proyecto
F2: exploración    → Análisis de contexto y territorio (consume PESTEL)
F3: investigación  → Recopilación de datos e inteligencia
F4: diagnóstico    → Análisis de situación actual
F5: estrategia     → Definición de posicionamiento y objetivos
F6: táctica        → Planes de acción concretos
F7: gerencia       → Gestión del equipo y recursos
F8: seguimiento    → Monitoreo de avance
F9: evaluación     → Análisis de resultados
```

Cada fase tiene un chat contextual con Claude que "conoce" todo el proyecto acumulado.

---

## Componentes Principales

| Archivo | Propósito |
|---------|-----------|
| `app/moddulo/` | Páginas del módulo |
| `app/moddulo/proyecto/[projectId]/[phaseId]/` | Vista de fase con chat |
| `app/api/moddulo/` | API routes del módulo |
| `app/api/moddulo/chat/[phaseId]/route.ts` | Chat SSE con Claude |
| `app/api/moddulo/projects/` | CRUD de proyectos |

---

## Integración con IA

- **Modelo:** Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Modo:** Streaming SSE (tokens en tiempo real)
- **Contexto:** El historial completo de cada fase se envía en cada llamada
- **Historial:** Almacenado en Firestore (`moddulo_projects`)

**Decisión de Raúl:** El chat usa streaming SSE para mostrar tokens en tiempo real.
Raúl identificó y corrigió el manejo de errores al cierre del ReadableStream.

---

## Decisiones de Diseño (Raúl Sánchez Salgado)

1. **9 fases secuenciales** — basadas en metodología de consultoría política de Raúl
2. **Contexto acumulado** — cada fase hereda el contexto de fases anteriores
3. **Integración con PESTEL en F2** — la exploración consume datos PEST-L del territorio
4. **Streaming SSE** — Raúl requirió que la respuesta de IA se muestre en tiempo real

---

## Estado de Features

| Feature | Estado |
|---------|--------|
| 9 fases con chat Claude SSE | ✅ Activo |
| Persistencia historial en Firestore | ✅ Activo |
| Integración PESTEL → F2 | ⏳ Pendiente |
| Export de proyecto completo | ⏳ Pendiente |

---

*Documento bajo supervisión de Raúl Sánchez Salgado — 2026-04-10*
