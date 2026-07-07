# Delta Spec — F2 · Exploración
## Para Claude Code · Junio 2026

Lee este archivo completo antes de escribir una sola línea de código.
Confirma qué archivos vas a modificar antes de empezar.
Lee primero los archivos existentes de F2 para entender la estructura actual
y reutilizar los patrones ya establecidos.

---

## Contexto

F2-Exploración ya tiene una implementación funcional. Este documento describe
exactamente qué cambiar, qué añadir y qué no tocar. No refactorices nada
que no esté en esta lista.

La ruta actual es `/moddulo/proyecto/[projectId]/exploracion`.
Los componentes compartidos de Moddulo (ModduloChat, PhaseNav, PhaseReportView,
PhaseTransitionReview) ya existen — reutilízalos donde aplique.

---

## Cambio 1 — Nomenclatura de botones y tabs

Buscar y reemplazar en todos los componentes de F2:

| Texto actual | Texto nuevo |
|---|---|
| "Importar PESTEL" (botón) | "Abrir PESTEL" |
| Tab izquierda en estado lista | "DVS F2" |
| Cualquier referencia a "Resumen F2" | "DVS F2" |

El tab derecho "Análisis PEST-L" no cambia su label pero sí su contenido
(ver Cambio 4).

---

## Cambio 2 — Máquina de estados de los 3 botones

Replicar exactamente el patrón de F1. Los tres chips tienen el mismo estilo:

```css
border: 1px solid; background: transparent; border-radius: 9999px;
padding: 4px 12px; font-size: 12px; font-weight: 600;
```

Ningún botón usa emojis. Los íconos, si se necesitan, provienen de lucide-react.

### Estado: `en_progreso`
- **Abrir PESTEL**: activo, borde y texto `bluegreen-eske-60` (#005378)
- **Editar análisis**: deshabilitado (opacity 32%, cursor not-allowed)
- **Cerrar Fase 2**: deshabilitado

### Estado: `editando`
- **Cancelar** (reemplaza "Abrir PESTEL"): activo, borde y texto `gray-eske-70`
  → Al hacer clic: descarta draft sin guardar, restaura datos originales, vuelve a `lista`
- **Guardar cambios** (reemplaza "Editar análisis"): activo, borde y texto `gray-eske-70`
  → Al hacer clic: guarda cambios, re-genera DVS, vuelve a `lista`
- **Cerrar Fase 2**: deshabilitado

### Estado: `lista`
- **DVS F2**: activo → muestra el tab izquierdo con el DVS
- **Editar análisis**: activo → cambia estado a `editando`, activa tab de formulario
- **Cerrar Fase 2**: activo, borde y texto `bluegreen-eske-60` (único con color de marca en lista)
  → Ver Cambio 6

---

## Cambio 3 — Panel central (área del chat) en estado Lista

Cuando el estado de F2 es `lista`, el tab izquierdo se convierte en "DVS F2"
y su contenido reemplaza al chat. La estructura del DVS es:

### 3.1 HEI — Hipótesis Estratégica Inicial (sección fija superior)

Card destacada con fondo diferenciado (`bluegreen-eske-10` al 30% de opacidad,
borde izquierdo 3px `bluegreen-eske`). Contenido:

```
HIPÓTESIS ESTRATÉGICA INICIAL
[tensionCentral — texto en bold, size base]
[contexto — párrafo tamaño sm]
Condiciones favorables: [lista]
Condiciones adversas: [lista]
Premisa estratégica: [texto destacado]
```

### 3.2 Sub-tabs M2 / M3 / M4

Inmediatamente debajo de la HEI, tres sub-tabs horizontales:

**Sub-tab M2 — Contraste XPCTO**
Muestra 5 filas (X, P, C, T, O), cada una con:
- Badge de veredicto: "Coherente" (verde) | "Requiere ajuste" (amarillo) | "Requiere investigación" (rojo)
- Argumentación en texto sm
- Lista de señales PESTEL referenciadas (chips pequeños)

**Sub-tab M3 — Semáforo de Veto**
Lista de actores con indicador de color:
- Círculo rojo: actor con capacidad de veto inmediato
- Círculo ámbar: riesgo condicional
- Círculo verde: riesgo potencial bajo
Cada actor: nombre, tipo, capacidad de veto, motivación y necesidad de investigación en F3.

**Sub-tab M4 — Mapa de Incertidumbres**
Tabla o lista de incertidumbres con dos ejes:
- Urgencia (alta/media/baja) — badge de color
- Resolución (alta/media/baja) — badge de color
- Destino: "→ F3" (resolubles) o "→ SIP" (no resolubles a corto plazo)

### 3.3 PIP — Programa de Investigación Profunda (sección fija inferior)

Card al final del DVS con fondo `gray-eske-10`, borde superior 2px `bluegreen-eske`:

```
PROGRAMA DE INVESTIGACIÓN PROFUNDA → F3
[N preguntas de investigación ordenadas por prioridad]
Cada ítem: número · pregunta · método · vínculo al hito X
```

Es la sección de cierre del DVS — siempre visible, no colapsable, porque
es el insumo directo de F3-Investigación.

---

## Cambio 4 — Tab derecho "Análisis PESTEL" — 6 dimensiones con señales tripartitas

El panel derecho (sidebar en desktop, segunda tab en mobile) debe mostrar
6 dimensiones separadas: **P · E · S · T · Ec · L**

⚠️ "Ec" (Ecológico) es una dimensión independiente. "Legal/Ambiental" fusionado
está incorrecto — separarlo en dos tabs: "L — Legal" y "Ec — Ecológico".

### Estructura por dimensión

Cada tab de dimensión muestra:

1. **Datos de Sefix** (solo dimensión P): tarjetas con Lista Nominal, Padrón Electoral
   y última elección (ya implementado — no cambiar).

2. **Señales tripartitas** — tres secciones colapsables:
   - "Señales favorables" (chip verde)
   - "Señales adversas" (chip rojo)
   - "Señales inciertas" (chip amarillo/gris)
   Cada señal: descripción, fuente, fecha de corte, nivel de confianza.
   Si el origen es internacional, mostrar etiqueta "Internacional".

3. **Texto libre** (cuando no hay análisis PESTEL vinculado):
   El campo editable existente "Contexto político general", "Actores clave",
   "Actores de veto", "Señales críticas" se mantiene como fallback cuando
   `pestAnalysisId` no existe en el proyecto.

### Lógica de carga

```typescript
if (project.phases?.exploracion?.pestAnalysisId) {
  // Leer centinela_pestel_analyses/{pestAnalysisId}
  // Mostrar señales tripartitas por dimensión
} else {
  // Mostrar campos de texto editables (implementación actual)
}
```

---

## Cambio 5 — Nuevo endpoint: generar DVS (M2-M5)

Crear `app/api/moddulo/f2/generate-dvs/route.ts` (o verificar si ya existe
un endpoint equivalente y extenderlo).

```typescript
// POST /api/moddulo/f2/generate-dvs
// Input: projectId, pestel (MapaPESTEL), xpcto (del EPP), projectType
// Output: contrasteXPCTO, semaforo, incertidumbres, hei, pip, dvs, criterios, rda?

// El endpoint llama a Claude con:
// 1. RAE de fase 2 (buildPhaseContext({phaseId: 2, projectType}))
// 2. El MapaPESTEL como contexto de señales
// 3. El XPCTO del EPP de F1
// 4. Prompts diferenciados para cada motor (M2 → M3 → M4 → M5)

// Guardar resultado en:
// moddulo_projects/{projectId}.phases.exploracion.dvs
// moddulo_projects/{projectId}.phases.exploracion.estado = 'lista'
```

---

## Cambio 6 — "Cerrar Fase 2" navega a F3

Cuando el usuario hace clic en "Cerrar Fase 2" (estado `lista`):

1. Actualizar en Firestore `moddulo_projects/{projectId}`:
   - `fasesCompletadas`: añadir `2`
   - `faseActual`: `3`
   - `phases.exploracion.aprobadoEn`: `now()`
2. Copiar PIP e incertidumbres al contexto de F3:
   - `phases.investigacion.pip` = `phases.exploracion.dvs.pip`
   - `phases.investigacion.incertidumbres` = `phases.exploracion.dvs.incertidumbres`
3. Navegar a `/moddulo/proyecto/{projectId}/investigacion`

---

## Cambio 7 — Endpoint de importación PESTEL

Crear `app/api/moddulo/f2/import-pestel/route.ts`:

```typescript
// POST — importa análisis de centinela_pestel_analyses/{pestAnalysisId}
// Transforma el mapaPESTEL de PESTEL al formato de F2 (señales tripartitas)
// Guarda pestAnalysisId en moddulo_projects/{id}.phases.exploracion
// Retorna el MapaPESTEL transformado para mostrar en el sidebar derecho
```

El botón "Abrir PESTEL" (en estado `en_progreso`) redirige a:
```
/centinela/pestel/nuevo?moddulo_project_id={projectId}&tipo={project.tipo}&nivel={project.nivel}&pais={project.pais}&horizonte={mesesAlHito}
```
donde `mesesAlHito` se calcula desde `phases.proposito.xpcto.t.fechaHito`.

Cuando el usuario regresa de PESTEL con `?pest_analysis_id={id}` en la URL,
el sistema ejecuta automáticamente el import y carga el M1 en el sidebar.

---

## Cambio 8 — RDA heredado de F1

Si `moddulo_projects/{projectId}.phases.proposito.rda?.activo === true`,
mostrar al inicio de F2 una alerta informativa (no bloqueante):

```
[AlertTriangle icon] Deficiencias activas de F1
{N} deficiencias registradas en F1 permanecen sin resolver.
[Ver RDA de F1 →]
```

Esta alerta aparece en el área del chat (estado `en_progreso`) y en el DVS
(estado `lista`), pero no bloquea ninguna acción.

---

## Archivos probablemente a modificar

```
app/moddulo/proyecto/[projectId]/exploracion/
├── page.tsx                          ← lógica de estado, botones, navegación
└── components/
    ├── (componente de botones F2)    ← máquina de estados (Cambio 2)
    ├── (panel lateral PESTEL)        ← 6 dimensiones + tripartición (Cambio 4)
    └── DVSView.tsx                   ← NUEVO: HEI + tabs M2/M3/M4 + PIP (Cambio 3)

app/api/moddulo/
├── f2/generate-dvs/route.ts         ← NUEVO (Cambio 5)
└── f2/import-pestel/route.ts        ← NUEVO (Cambio 7)

types/moddulo.types.ts               ← añadir tipos F2 (F2PhaseData extendido)
```

Antes de modificar cualquier archivo, léelo completo y muéstrame las secciones
relevantes que vas a tocar.
