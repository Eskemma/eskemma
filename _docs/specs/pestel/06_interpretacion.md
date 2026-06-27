# Spec — Etapa 6: Interpretación y priorización estratégica

## Principio central

Esta etapa es deliberadamente **human-in-the-loop**. La IA no decide;
el analista revisa, ajusta y valida. Ninguna salida de la Etapa 5 es
definitiva hasta que pasa por esta etapa.

---

## Componentes de la interfaz

### Matriz de impacto/probabilidad interactiva

- Cada factor PEST-L aparece posicionado en la matriz según el análisis
  de la Etapa 5.
- El analista puede arrastrar y reposicionar cualquier factor.
- **Al mover un factor, el campo de justificación es obligatorio.**
  El usuario debe escribir el motivo del ajuste (mínimo 20 caracteres).
  Esto garantiza la trazabilidad metodológica.
- La posición original (propuesta por IA) queda visible como referencia.

### Check de sesgo asistido

Antes de cerrar la etapa, PESTEL ejecuta verificación automática:

Preguntas de verificación:
1. ¿Hay dimensiones con menos de 3 variables analizadas?
2. ¿Hay factores que solo tienen fuentes digitales sin validación de campo?
3. ¿Algún hallazgo contradice datos de campo cargados manualmente?

Las inconsistencias se señalan con su descripción y el analista debe
marcarlas como "revisado" (no necesariamente resueltas, pero sí
reconocidas).

### Panel "voces del territorio"

Muestra citas textuales de entrevistas, observaciones de campo o focus
groups cargados en la Etapa 4, vinculadas al factor PEST-L correspondiente.

Este panel no es decorativo: es la forma en que PESTEL evita que el
análisis quede solo en números y recupera la dimensión cualitativa.

### Comparación con análisis anteriores

Si existe un PEST-L previo del mismo territorio y proyecto:
- Mostrar qué factores cambiaron de clasificación (OPORTUNIDAD→AMENAZA,
  etc.).
- Mostrar qué factores se mantuvieron estables.
- Mostrar qué factores son nuevos en este análisis.

---

## Estado persistido

```typescript
type HumanAdjustment = {
  adjustedBy: string;
  adjustedAt: Date;
  originalClassification: string;
  newClassification: string;
  justification: string;
  originalPosition: { x: number; y: number };
  newPosition: { x: number; y: number };
}
```

