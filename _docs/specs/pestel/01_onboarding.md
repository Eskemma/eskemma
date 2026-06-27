# Spec — Etapa 1: Onboarding y configuración del proyecto

## Propósito de esta etapa

Es el punto de entrada de PESTEL. Define el contexto completo del
proyecto antes de que comience cualquier análisis. El tono es
conversacional: guía al usuario como un asistente, no como un formulario.

---

## Flujo funcional

### Paso 1.1 — Tipo de proyecto político

PESTEL presenta cuatro tarjetas visuales seleccionables. Solo se puede
seleccionar una. La selección determina las variables por defecto en la
Etapa 3.

| Opción | Código interno |
|--------|----------------|
| Electoral / Campaña | `TYPE_ELECTORAL` |
| Gubernamental | `TYPE_GUBERNAMENTAL` |
| Legislativo | `TYPE_LEGISLATIVO` |
| Ciudadano / Movimiento social | `TYPE_CIUDADANO` |

### Paso 1.2 — Nombre del proyecto y equipo

- Campo de texto: nombre del proyecto (obligatorio).
- Sección de colaboradores: el usuario puede invitar personas por email.
- Roles disponibles: `ROLE_ANALISTA`, `ROLE_ESTRATEGA`, `ROLE_REVISOR`.
- Cada rol tiene permisos distintos (documentar en la spec de permisos
  cuando se desarrolle el sistema de autenticación).

### Paso 1.3 — Horizonte temporal

El usuario selecciona uno de tres modos. Esto afecta la profundidad del
análisis y el número de indicadores propuestos por defecto en la Etapa 3.

| Modo | Duración estimada | Indicadores por dimensión |
|------|-------------------|--------------------------|
| Diagnóstico completo (PEST-L base) | 4-8 semanas | Máximo (todos los disponibles) |
| Revisión rápida | 3-5 días | Reducido (solo los prioritarios) |
| Monitoreo continuo | Indefinido | Configurable |

### Paso 1.4 — Nivel de profundidad

Opciones de selección única:
- Diagnóstico completo
- Revisión rápida
- Monitoreo periódico

### Paso 1.5 — Output esperado

En esta versión el output por defecto es: **reporte presentable**.
No hay otras opciones en la versión inicial. Campo informativo, no
configurable aún.

---

## Reglas de negocio

- Ningún campo de esta etapa puede dejarse vacío para avanzar a la
  Etapa 2.
- Al seleccionar el tipo de proyecto, PESTEL muestra un texto de
  confirmación describiendo qué variables se activarán por defecto.
- La combinación tipo_proyecto + horizonte_temporal determina la
  "plantilla base" que se carga en la Etapa 3.

---

## Estado persistido al completar esta etapa

```typescript
type ProjectConfig = {
  id: string;                    // UUID generado al crear
  name: string;
  type: 'ELECTORAL' | 'GUBERNAMENTAL' | 'LEGISLATIVO' | 'CIUDADANO';
  horizon: 'FULL' | 'QUICK' | 'CONTINUOUS';
  depth: 'COMPLETE' | 'QUICK' | 'PERIODIC';
  team: TeamMember[];
  createdAt: Date;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

type TeamMember = {
  email: string;
  role: 'ANALISTA' | 'ESTRATEGA' | 'REVISOR';
  invitedAt: Date;
  acceptedAt?: Date;
}
```

---

## UX — notas para el desarrollador

- El onboarding debe sentirse como una conversación, no como un formulario.
  Usar preguntas directas ("¿Qué tipo de proyecto estás analizando?")
  en lugar de etiquetas de campo ("Tipo de proyecto:").
- Mostrar progreso visual: el usuario debe saber que está en el paso 1
  de 8, y cuánto le falta.
- Al completar esta etapa, mostrar un resumen de la configuración antes
  de avanzar y pedir confirmación explícita.
