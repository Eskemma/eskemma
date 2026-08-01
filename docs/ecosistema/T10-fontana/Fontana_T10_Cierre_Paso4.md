# Fontana (T10) — Cierre del Paso 4 (Prototipo interactivo)

**Fecha de cierre:** 29 de julio de 2026
**Ecosistema:** Eskemma — Centinela
**Prelación:** #2 (después de T06/Sefix-AI)
**Estado:** Paso 4 completo. Prototipo interactivo validado en Artifacts (`fontana_prototipo.jsx`). Fontana pasa al **Paso 5: implementación real con Claude Code.**

**Documentos relacionados:**
- `Fontana_T10_Cierre_Paso2_v2.md` — catálogo de 84 indicadores
- `Fontana_T10_Arquitectura_Paso3_v2.md` — arquitectura funcional, ya ajustada con lo que este paso exigió
- `Fontana_T10_Paso4_Bitacora_Cambios.md` — registro cronológico de las iteraciones de este paso (este documento lo consolida y formaliza)
- `fontana_prototipo.jsx` — prototipo funcional en React/Artifacts

---

## 1. Propósito de este paso

El Paso 4 no construyó "la app" — usó el Artifact como **medio de verificación barata** antes de comprometer tiempo de Code: permitió *ver* y *tocar* decisiones que en el Paso 3 quedaron solo como texto/JSON (candado en mínimos, tabla comparativa con motivo explícito, tool use del agente, escenarios a/b/c, seguimiento de exportación) y detectar ahí mismo qué no funcionaba como se esperaba o qué caso faltaba, antes de que eso se convirtiera en un prompt para Code.

Por acuerdo explícito con Raúl: **el diseño visual pixel-perfect no fue objeto de revisión en este paso** — el sistema de diseño real (PESTEL/Centinela) lo aplicará Code directamente en el Paso 5, tomando este documento y el prototipo como referencia de *lógica de interacción y reglas de negocio*, no de estética final.

---

## 2. Alcance prototipado

- **Escenario principal:** (a) — dentro de proyecto activo en Moddulo, con los indicadores mínimos del PIP precargados.
- **Escenario alterno:** (b)/(c) — uso independiente en Centinela, accesible en el prototipo mediante un control de demostración (no forma parte de la interfaz final) para comparar ambos flujos sin recargar la aplicación.
- **Familias con densidad completa:** F1 (Sociodemográficos) y F2 (Socioeconómicos).
- **Familias con densidad reducida pero con la misma mecánica funcional:** F3 (Geopolíticos) y F5 (Características territoriales).
- **F4 (Comparación internacional):** layout propio, sin niveles subnacionales — coherente con la regla de no forzar comparación entre países fuera de esta familia.

---

## 3. Wizard de primer uso

Replica el patrón ya aplicado en PESTEL: la primera vez que se abre Fontana en cada escenario, aparece un wizard antes del cuerpo de la app.

| | Escenario (a) | Escenario (b)/(c) |
|---|---|---|
| Datos precargados | Nombre del proyecto, ruta territorial, tarea PIP, resumen de mínimos por familia | Ninguno — no hay PIP de referencia |
| Campos a requisitar | Ninguno | Nombre de proyecto (opcional), territorio |
| Botón de inicio | **"Consultar indicadores del proyecto"** | **"Comenzar a explorar indicadores"** |
| Repetición | Solo la primera vez por proyecto; aperturas posteriores lo omiten | Solo la primera vez en modo independiente |

El texto del botón de (a) se ajustó respecto a la propuesta inicial ("Iniciar consulta de indicadores") para nombrar la acción desde lo que el usuario controla, sin ambigüedad con "consulta" como sustantivo del PIP. **Pendiente de confirmación final de Raúl.**

En el prototipo, el estado de "wizard ya completado" se rastrea de forma independiente por escenario, para poder revisar ambos flujos en la misma sesión de demo mediante el control "Reiniciar asistente de bienvenida" — este control es exclusivo de la demo, no de la interfaz final.

---

## 4. Modelo de interacción de indicadores

- **Mínimos del PIP:** candado visual, sin control de "quitar" disponible — verificado tanto en la interfaz directa como en las respuestas del agente conversacional (rechazo explícito).
- **Selección del usuario:** libremente añadible/removible desde un selector inline ("+ Añadir indicador") o desde el agente.
- **Tabla comparativa por nivel:** cada celda sin dato disponible muestra el motivo explícito (nunca una celda vacía sin explicación) — regla verificada de forma consistente en las 4 familias con tabla estándar.
- **Presentación de naturaleza del dato y fuente (ajuste de diseño de este paso):** las etiquetas de naturaleza pasaron de relleno sólido a **borde delgado y fondo transparente** del color de la categoría; la fuente se muestra como texto discreto sin pill, junto a la etiqueta — un tratamiento visual menos invasivo que el propuesto originalmente.
- **Íconos de información (i):** junto al nombre de cada indicador (tarjetas, tabla comparativa, tarjetas de Familia 4). Al hacer clic muestran un tooltip con el formato `Nombre: definición. (Fuente)`.

---

## 5. Paleta de colores por familia (definitiva)

| Familia | Color | Hex |
|---|---|---|
| F1 — Sociodemográficos | bluegreen-eske | `#026988` |
| F2 — Socioeconómicos | orange-eske | `#DB6015` |
| F3 — Geopolíticos | red-eske | `#D10F3F` |
| F4 — Comparación internacional | blue-eske | `#248CC1` |
| F5 — Características territoriales | yellow-eske | `#FFD14A` |

El Canvas del agente (sección 6.3) usa un color propio (`#5b3a8e`, morado) deliberadamente fuera de esta paleta, para señalar que no es una familia de indicadores sino un espacio generado por el agente.

---

## 6. Agente conversacional "Fontana" — arquitectura formal

Este es el primer documento que formaliza el diseño del agente; en el Paso 3 no se había abordado. Se apoya en dos precedentes ya identificados en la investigación previa: `ModduloChat.tsx`/`ChatBubble` (implementación de referencia, no reutilizable tal cual por acoplamiento a Moddulo) y **cero precedente real de tool use** en el resto del repo — Fontana es la primera app del ecosistema en usarlo.

### 6.1 Config genérica (reutilizable por otras apps futuras)

```typescript
interface AgenteConversacionalConfig {
  tecnicaId: TecnicaId;
  nombreAgente: string;
  mensajeBienvenida: string;
  systemPromptBase: string;
  tools: ToolDefinition[];
  coleccionPersistencia: string;
}

const AGENTE_CONFIGS: Partial<Record<TecnicaId, AgenteConversacionalConfig>> = {
  T10: { /* Fontana */ }
};
```

```
POST /api/agente/[tecnicaId]/route.ts   ← genérico, no exclusivo de Fontana
```

### 6.2 Las 4 herramientas (`tools`)

El diseño original (Paso 3, sección 4 del traspaso previo) contemplaba 3 herramientas. El prototipo de este paso identificó la necesidad de una cuarta al simular peticiones que piden salidas extensas (una gráfica, un listado completo) — ver sección 6.3.

| Herramienta | Input | Dónde se ejecuta | Regla de negocio |
|---|---|---|---|
| `consultar_indicador` | `{ indicadorId, nivel }` | Servidor — regresa `tool_result`, el bucle continúa | Ninguna restricción; si no hay dato en ese nivel, la respuesta debe incluir el motivo, nunca solo "sin datos" |
| `modificar_sesion` | `{ accion: "agregar"\|"quitar", indicadorId }` | Servidor | **Debe rechazar** `quitar` si el indicador está en `minimos` — verificado en el prototipo con mensaje explícito al usuario, no un error silencioso |
| `navegar_pestana` | `{ familiaId }` | **Frontend** — el backend no la ejecuta, la reenvía como evento de UI (`ui-action`) | Arquitectónicamente distinta de las otras dos desde el diseño original |
| `generar_visualizacion` 🆕 | `{ tipo: "grafica"\|"listado"\|"tabla", indicadorId?, familiaId? }` | **Frontend** — igual que `navegar_pestana` en que la ejecuta el cliente, pero además **persiste** contenido (a diferencia de `navegar_pestana`, que solo cambia de vista) | El resultado se deposita en el Canvas (sección 6.3), nunca directamente en la burbuja de chat |

### 6.3 Canvas — espacio de salidas del agente

**Motivación:** una gráfica o un listado extenso no debe vivir dentro de la sesión de una familia (no es un indicador que se añade/quita del PIP) ni forzarse dentro del espacio reducido de una burbuja de chat.

**Diseño adoptado:** una pestaña adicional, visualmente distinta de las 5 familias ("Agente · Resultados"), donde se acumulan las salidas generadas por `generar_visualizacion`. La respuesta del agente en el chat queda breve, con un enlace "Ver en Canvas" que lleva a esa pestaña.

**Persistencia:** las salidas del Canvas se guardan en `FontanaSesion.salidasAgente` (tipo `SalidaAgente`, definido en `Fontana_T10_Arquitectura_Paso3_v2.md`, sección 8.3) para que el usuario no las pierda entre aperturas de la misma sesión. Regla de negocio explícita: **nunca viajan en el payload de entrega a F3** — son un recurso interno de Fontana, no un indicador del PIP.

### 6.4 Formato de respuesta — sin notación técnica cruda

Las respuestas de `consultar_indicador` se presentan como una tarjeta con: valor contextualizado al territorio del proyecto, naturaleza del dato, fuente, y una descripción breve (máx. 2 líneas) del indicador — nunca como una línea de texto plana con la notación técnica de la llamada visible como si fuera la respuesta final. La llamada a herramienta sí se muestra, pero como una línea monoespaciada claramente diferenciada (con ícono, no con notación de función cruda como única señal).

**Regla transversal: el sistema no utiliza emojis**, en ninguna parte de la interfaz ni de las respuestas del agente.

### 6.5 Layout del panel

- **Escritorio:** al activarse, el chat aparece como panel integrado a la derecha — el contenido central se recorre con una transición de margen, no se superpone.
- **Mobile:** hoja inferior (bottom sheet).
- **Burbuja de mostrar/ocultar:** persiste siempre visible en ambos formatos, y se reposiciona fuera del área del panel cuando está abierto para no confundirse con el botón de enviar del composer. El estado de la conversación se conserva íntegro al ocultar/mostrar (no se reinicia).
- **Composer:** patrón estándar de chat — adjuntar archivo (affordance visual en el prototipo, sin función real todavía), texto multilínea con autoajuste, botón de enviar, `Enter` para enviar y `Shift+Enter` para salto de línea. Replica el precedente de `ModduloChat`/`ChatBubble`.

---

## 7. Seguimiento de exportación a F3

Antes de este paso, el botón "Regresar a Moddulo F3 con resultados" no tenía lógica detrás. Se diseñó el flujo de confirmación que antecede a la llamada real de Canal 1:

1. Al presionar el botón, se abre un **"Resumen de entrega a F3"**.
2. Muestra, por familia: conteo de indicadores en sesión y estado respecto al último envío confirmado — **nunca enviada**, **modificada** o **sin cambios**.
3. Al confirmar, Fontana congela una copia de la sesión como referencia para el siguiente diff e incrementa `versionSesion`.

Esto hace visible al usuario el mecanismo de `familiasModificadasDesdeUltimaExportacion` y `versionSesion` ya definidos en la arquitectura del Paso 3 — no introduce cálculo nuevo, expone uno que ya existía solo en el modelo de datos. Queda documentado también como ajuste de interfaz en `Fontana_T10_Arquitectura_Paso3_v2.md`, sección 8.1.

---

## 8. Verificación de reglas de negocio

Se realizó una verificación explícita (no solo implícita durante la construcción) de las reglas de negocio acumuladas en los Pasos 1-3, punto por punto, contra el prototipo. Resultado:

**Verificadas y demostradas en el prototipo:**
- Sin comparación forzada entre países fuera de Familia 4.
- Cálculos electorales derivados nunca se calculan en Fontana (Participación electoral 2024 etiquetada `proxy_conceptual`, consumida de Sefix).
- Naturaleza del dato declarada por nivel geográfico, no por indicador.
- Ninguna celda vacía sin motivo explícito.
- Confiabilidad diferenciada por campo (Índice de Democracia EIU).
- Metodología etiquetada cuando hay versiones distintas de un mismo concepto (los "3 Gini de México").
- Mínimos del PIP no editables/eliminables, incluso vía lenguaje natural.
- Selección del usuario libremente removible.
- Escenario (a) ejecuta mínimos automáticamente al abrirse.
- `navegar_pestana` ejecutada por el frontend.
- `modificar_sesion` rechaza mínimos.
- Sin exposición de `TecnicaId` ni jerga interna en el texto conversacional del agente.
- Sin emojis.

**No aplicables a un prototipo de frontend sin backend real** (quedan como verificación pendiente del Paso 5, no como gaps de este paso): un endpoint por familia, `resultadoId` determinístico, ausencia de auth servicio-a-servicio, mecánica exacta de `.set()` sin el campo `aprobado`.

**Gaps reales identificados y su estado:**

| Gap | Estado al cierre de este paso |
|---|---|
| Columnas de tabla comparativa no-electorales (`Nacional\|Estatal\|Municipal\|AGEB`) nunca implementadas — solo se probó la variante electoral | **Sigue abierto.** Ver sección 9. |
| Botón de exportación a F3 sin lógica real | **Resuelto** (sección 7). |

---

## 9. Pendientes explícitos que salen de este paso

- **Indicadores por default en uso independiente (b)/(c):** sigue sin resolverse — correctamente, no se fingió una respuesta en el prototipo. Requiere decisión de Raúl antes o durante el Paso 5.
- **Variante no-electoral de la tabla comparativa:** no se verificó visualmente en el prototipo. Decidir si amerita una vuelta rápida de revisión antes de instruir a Code, o si se verifica directamente en la interfaz real durante el Paso 5.
- **Confirmación del texto de los botones del wizard** (sección 3).
- **Población de `INDICATOR_REGISTRY.json`** (incluye ahora `definicion` y `fuenteEtiqueta`) — Paso 5, indicador por indicador, junto con cada conector real.
- **Relación Fontana↔PESTEL:** sigue pendiente de decidir (Paso 1), no se abordó en este paso.

---

## 10. Próximo paso — Paso 5 con Code

Con el prototipo validado y las reglas de negocio verificadas, Fontana pasa al **Paso 5: implementación real**, bajo el mismo flujo de trabajo ya usado en T06:

1. Raúl y Claude conversan y deciden cada pieza de alcance antes de instruir a Code — Code nunca decide alcance por su cuenta.
2. Claude prepara el prompt de arranque para Code.
3. Code plantea su plan antes de ejecutar.
4. Se intercambian observaciones sobre ese plan hasta que quede correcto.
5. Solo entonces se ejecuta.
6. Se verifica con evidencia real (navegador o pruebas directas de Code) — nunca "debería funcionar".
7. Se itera en la interfaz real hasta cerrar cada pieza, aplicando en ese momento el sistema de diseño real de PESTEL/Centinela (no el aproximado de este prototipo).

Este documento, junto con `Fontana_T10_Arquitectura_Paso3_v2.md` y el catálogo de indicadores del Paso 2, es la base de referencia para preparar ese primer prompt.
