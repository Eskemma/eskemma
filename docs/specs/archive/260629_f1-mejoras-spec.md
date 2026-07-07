Lee este archivo completo antes de escribir una sola línea de código.
Cuando lo hayas leído, confirma que entendiste el alcance y dime qué archivos
vas a modificar antes de empezar.

---

# Spec de mejoras — F1 Propósito · Moddulo

## Contexto

F1 Propósito ya está implementado en `/app/moddulo/proyecto/[projectId]/proposito/`.
Este documento describe exactamente qué cambiar y qué agregar.
No refactorices nada que no esté en esta lista.

El proyecto usa Next.js 16, React 19, TypeScript strict, Tailwind 4 con tokens
custom en `globals.css`. Los tokens de color disponibles son `blue-eske`,
`orange-eske`, `bluegreen-eske`, `gray-eske`, `black-eske`, `green-eske`,
`red-eske`, `yellow-eske` — nunca usar colores genéricos de Tailwind.

---

## Cambio 1 — Nomenclatura (renombrar etiquetas)

Buscar y reemplazar en todos los componentes de F1 y del Hub:

| Texto actual | Texto nuevo |
|---|---|
| "Ver Resumen" (botón) | "Reporte F1" |
| "Resumen" (tab/pestaña izquierda en estado Lista) | "Reporte F1" |
| "Resumen de Propósito" (encabezado dentro del reporte) | "Reporte de Propósito F1" |

El tab derecho "Formulario XPCTO" no cambia.

---

## Cambio 2 — Máquina de estados de los 3 botones

Los tres botones en el header de F1 deben comportarse así según el estado del EPP.
El estado actual del EPP viene de Firestore (`moddulo_projects`).

### Estado: `en_progreso` (chat activo, variables sin completar)
- **Reporte F1**: deshabilitado (opacity-30, cursor-not-allowed)
- **Editar variables**: deshabilitado
- **Cerrar Fase 1**: deshabilitado

### Estado: `editando` (usuario activó edición)
- **Cancelar** (reemplaza "Reporte F1"): activo → descarta el draft, vuelve a estado `lista`
- **Guardar cambios** (reemplaza "Editar variables"): activo → guarda cambios, re-genera EPP, vuelve a `lista`
- **Cerrar Fase 1**: deshabilitado

### Estado: `lista` (EPP generado y aprobado)
- **Reporte F1**: activo → muestra el tab de reporte
- **Editar variables**: activo → cambia estado a `editando`, activa tab "Formulario XPCTO"
- **Cerrar Fase 1**: activo → ver Cambio 3

### Estilo de los 3 botones (mismo para todos, sin jerarquía visual distinta):
```
border border-bluegreen-eske-60 text-bluegreen-eske-60 bg-transparent
rounded-full px-4 py-1.5 text-sm font-semibold
disabled:opacity-30 disabled:cursor-not-allowed
```
Excepción: "Cerrar Fase 1" cuando activo usa `bg-bluegreen-eske-60 text-white`
(es la única acción terminal de la vista).

---

## Cambio 3 — "Cerrar Fase 1" navega a F2

Cuando el usuario hace clic en "Cerrar Fase 1" (estado `lista`):

1. Actualizar en Firestore `moddulo_projects/{projectId}`:
   - `fasesCompletadas`: añadir `1` al array si no está
   - `faseActual`: `2`
2. Navegar a `/moddulo/proyecto/{projectId}/exploracion`

No regresar al Hub.

---

## Cambio 4 — Cards del Hub con borde de color

En el Hub de Moddulo (`/app/moddulo/page.tsx` o donde vivan las cards de proyecto):

Cada card debe tener un borde izquierdo del color almacenado en
`moddulo_projects/{projectId}.color` (campo hex, ej. `"#026988"`).

Aplicar como inline style:
```tsx
style={{ borderLeft: `4px solid ${project.color}` }}
```

Si el proyecto no tiene campo `color` en Firestore, usar `#026988` como default.

Al **crear un nuevo proyecto**, agregar un selector de color al formulario.
La paleta de opciones predefinidas (mostrar como swatches clicables):

```
#026988  #248cc1  #ffa366  #649941  #ffd14a  #d10f3f  #474747
```

Más un botón "+" que abre un `<input type="color">` para color libre,
con un campo de texto adicional para ingresar hex manualmente.

Guardar el color seleccionado en `moddulo_projects/{projectId}.color`.

---

## Cambio 5 — Modo Edición: lógica de Cancelar

Cuando el usuario hace clic en "Editar variables":
1. Guardar una copia del XPCTO actual en estado local como `draft`
2. Hacer editables los campos del Formulario XPCTO
3. Cambiar los botones según el estado `editando` (Cambio 2)

Cuando el usuario hace clic en "Cancelar":
1. Descartar el `draft` sin guardar nada
2. Restaurar los campos del Formulario XPCTO con los valores originales
3. Cambiar el estado a `lista`
4. No llamar a ningún endpoint de Firestore

Cuando el usuario hace clic en "Guardar cambios":
1. Llamar al endpoint existente que actualiza el XPCTO en Firestore
2. Re-generar el EPP (Dictamen + criterios) con los nuevos valores
3. Cambiar el estado a `lista`
4. Mostrar el tab "Reporte F1" con el contenido actualizado

---

## Cambio 6 — Componentes del EPP en el Reporte F1

El Reporte F1 (lo que aparece en el tab izquierdo cuando estado = `lista`)
debe incluir estas secciones además de las variables XPCTO ya presentes.
Si ya existen parcialmente, completarlas; si no existen, agregarlas al final
del reporte antes del footer.

### Sección A — Dictamen de Coherencia XPCTO

Mostrar 5 cruces de validación. Cada cruce tiene:
- Etiqueta del cruce (ej. "Cruce 1 · X ↔ T")
- Pregunta de validación
- Veredicto: `coherente` (ícono CheckCircle verde) o `requiere_ajuste` (ícono AlertTriangle amarillo)
- Texto de argumentación

Los 5 cruces son:
1. X ↔ T — ¿El hito es alcanzable en el tiempo disponible?
2. X ↔ C — ¿Las capacidades son suficientes para la magnitud del hito?
3. P ↔ O — ¿La autoridad moral del sujeto es coherente con la justificación?
4. O ↔ X — ¿El propósito superior justifica el esfuerzo del hito?
5. XPCTO ↔ Tipo — ¿Las variables son consistentes con el tipo de proyecto?

El Dictamen debe generarse en el mismo llamado a Claude que genera el reporte,
extendiendo el prompt existente para que devuelva también el JSON del dictamen.
Estructura esperada del JSON:

```typescript
interface Dictamen {
  cruces: {
    id: number;
    etiqueta: string;
    pregunta: string;
    veredicto: 'coherente' | 'requiere_ajuste';
    argumentacion: string;
  }[];
}
```

Guardar el dictamen en `moddulo_projects/{projectId}.phases.proposito.dictamen`.

### Sección B — Panel de criterios de suficiencia

10 criterios evaluados automáticamente (lógica determinista, sin Claude):

| ID | Criterio | Nivel |
|---|---|---|
| 1 | Coherencia XPCTO | Prioritario |
| 2 | Viabilidad del hito (X.fecha definida) | Prioritario |
| 3 | Suficiencia de capacidades | Prioritario |
| 4 | Realismo temporal | Con advertencia |
| 5 | Solidez del propósito | Prioritario |
| 6 | Legitimidad del sujeto | Con advertencia |
| 7 | Consistencia con el universo | Prioritario |
| 8 | Claridad de escala | Prioritario |
| 9 | Criterio de integridad | Con advertencia |
| 10 | Aprobación explícita del usuario | Prioritario |

Lógica de evaluación (determinista):
- Criterios 1–9: `resuelto` si todos los campos de XPCTO están completos y el dictamen no tiene cruces `requiere_ajuste`. Para el criterio 3: `pendiente` si algún campo de VariableC está vacío.
- Criterio 10: siempre `pendiente` hasta que el usuario haga clic en "Cerrar Fase 1".

Mostrar como lista: nombre del criterio, nivel, badge de estado (`✓ Resuelto` verde / `⚠ Pendiente` rojo o amarillo según nivel).

### Sección C — Registro de Deficiencias Activas (RDA)

Mostrar solo si hay criterios en estado `pendiente`.

Para cada criterio pendiente, mostrar:
- Número y nombre del criterio
- Descripción de la deficiencia
- Ruta de resolución sugerida

El RDA viaja con el EPP cuando el usuario avanza a F2 (se almacena en Firestore
junto con el proyecto).

---

## Archivos probablemente a modificar

```
app/moddulo/
├── page.tsx                              # Hub — cards con color
├── nuevo-proyecto/page.tsx               # o donde esté el formulario — agregar selector de color
└── proyecto/[projectId]/proposito/
    ├── page.tsx                          # Estado de botones, Cancelar, Cerrar→F2
    └── components/
        ├── PhaseReportView.tsx           # Agregar Dictamen + criterios + RDA
        └── (el componente de botones)    # Lógica de estados
```

Antes de modificar, lee los archivos existentes para entender la estructura actual
y reutilizar los patrones ya establecidos.
