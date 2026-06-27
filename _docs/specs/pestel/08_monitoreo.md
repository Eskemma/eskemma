---

# Spec — Etapa 8: Monitoreo continuo y actualización

## Propósito

Convierte el análisis estático (Etapas 1-7) en un sistema vivo de
inteligencia de contexto.

---

## Componentes

### Dashboard en tiempo real

- Muestra el estado actual de cada dimensión con indicadores de movimiento.
- Cualquier cambio significativo aparece como alerta con su clasificación
  PEST-L automática.
- El umbral de "cambio significativo" es configurable por el usuario.

### Sistema de alertas configurables

El usuario define umbrales. Ejemplos:
- Si la conversación sobre un tema supera el Y% del volumen total de
  menciones → alerta.
- Si el índice de sentimiento cae del umbral Z → alerta.
- Si un indicador económico cambia más de X% → alerta.

Canales de notificación: en la app (obligatorio) + email (opcional).

### Ciclo de re-análisis programado

PESTEL ejecuta actualizaciones parciales por dimensión según la
frecuencia configurada en la Etapa 2 (semanal, quincenal, mensual).

Cada actualización:
- Integra datos nuevos desde las fuentes de la Etapa 4.
- Señala qué cambió respecto al análisis anterior.
- Incrementa el número de versión del análisis.
- No modifica el análisis validado anterior — crea una versión nueva.

### Modo crisis

Condición de activación: la IA detecta un evento de alto impacto en el
territorio monitoreado (escándalo, desastre, resultado electoral
sorpresivo, cambio de gobierno abrupto).

Al activarse:
- Actualiza las dimensiones más afectadas en menos de 24 horas.
- Genera alerta prioritaria al equipo completo del proyecto.
- Crea una versión de análisis marcada como "crisis" con timestamp.

Definición de "evento de alto impacto": cualquier evento que genere un
spike de menciones > 300% sobre la media de los 7 días anteriores en el
territorio monitoreado.

### Comparativa histórica

- Líneas de tendencia por dimensión a lo largo del tiempo.
- Permite ver si el contexto mejora o se deteriora para el proyecto.
- Exportable como gráfico para reportes.