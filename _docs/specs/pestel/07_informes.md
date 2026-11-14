---

# Spec — Etapa 7: Generación de informes y síntesis estratégica

## Formatos de salida

PESTEL genera automáticamente cinco tipos de informe. Todos son
editables antes de exportar.

### 1. Reporte ejecutivo

- Extensión: 2-3 páginas.
- Contenido: resumen de hallazgos críticos por dimensión + scorecard
  ponderado + las 3 principales implicaciones estratégicas para el
  proyecto político.
- Audiencia: dirección política, no el equipo técnico.
- Tono: claro, directo, sin tecnicismos.

### 2. Reporte técnico (condensado, con presupuesto por sección)

> Cambio del 26-11-13 (H75, B1). Antes: «reporte técnico completo», sin límite de
> extensión y con la narrativa detallada de cada dimensión. Con ese diseño el
> informe se cortaba por el tope de tokens sin llegar a las secciones 5 y 6 (con
> 12 000 tokens, 234 s y 4 de 6 secciones) y excedía el techo de duración. Ahora es
> un informe **condensado** con un presupuesto por sección.

- Extensión total: máximo ~2 500 palabras (≈ 3 500-4 500 tokens, ~75 s). Es un
  tope, no una meta.
- Seis secciones, en este orden, con su presupuesto:
  1. Ficha metodológica — hasta 150 palabras (tipo, territorio, fecha, versión,
     confianza global y metodología).
  2. Análisis por dimensión — sección elástica: por cada una de las 6 dimensiones,
     hasta 230 palabras (clasificación · tendencia · intensidad · confianza; una
     lectura condensada de hasta 90 palabras; hasta 3 señales clave con su cita).
  3. Cadenas de impacto transversal — hasta 300 palabras, una línea por cadena.
  4. Scorecard ponderado — tabla completa y score global.
  5. Alertas de sesgo y limitaciones — hasta 250 palabras; usa las alertas de
     sesgo reales del análisis (reconocidas o pendientes) y 3 a 5 limitaciones.
  6. Ajustes del analista — hasta 120 palabras; la justificación del analista se
     copia textualmente, sin ampliarla.
- Las secciones 5 y 6 son obligatorias: si hay que recortar, se recorta la 2.
- Audiencia: equipo interno de análisis.
- Qué pierde respecto del diseño anterior: la narrativa íntegra y el inventario
  completo de señales por dimensión. Siguen disponibles en la pantalla de
  análisis y en los demás formatos.
- Límite conocido: la sección 5 puede incluir alguna inferencia que no está en el
  análisis (p. ej. un umbral «mínimo recomendado»).

### 3. Informe de síntesis FODA-lista

- Los hallazgos del PEST-L pre-clasificados como Oportunidades y Amenazas.
- Listos para alimentar directamente un análisis FODA posterior.
- PESTEL puede iniciar el FODA desde aquí (feature de fase siguiente).

### 4. Escenarios prospectivos

Basados en combinación de factores de alto impacto y alta probabilidad:
- Escenario optimista
- Escenario base
- Escenario pesimista

Cada escenario incluye: narrativa descriptiva + implicaciones
comunicacionales específicas para el tipo de proyecto.

### 5. Mapa de insights por tipo de proyecto

- Electoral: insights agrupados por etapa de campaña (precampaña,
  campaña, cierre).
- Gubernamental: por eje de agenda de gobierno.
- Legislativo: por momento legislativo (apertura, debate, votación).
- Ciudadano: por fase del movimiento (emergencia, consolidación, impacto).

Al recargar la página de informes se conserva el formato abierto (parámetro
`?formato=` de la URL) si ese formato tiene informe guardado; si no, se abre el
más recientemente generado. Nunca se genera un informe por abrir la página.

---

## Scorecard ponderado

El scorecard es una tabla resumen con:
- Una fila por dimensión PEST-L.
- Columnas: dimensión, señal principal, tendencia, intensidad,
  clasificación, peso, score ponderado.
- Score total del análisis (promedio ponderado).

El peso de cada dimensión se hereda de los pesos asignados en la Etapa 3.


