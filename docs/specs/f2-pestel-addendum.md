# Addendum — Delta Specs F2 y PESTEL
## Para Claude Code · Junio 2026

Este archivo complementa `f2-delta-spec.md` y `pestel-delta-spec.md`.
Los cambios aquí descritos tienen prioridad sobre cualquier indicación
anterior en los dos archivos base cuando haya contradicción.

---

## A1 — Página de Inicio de F2 (faltante — recrear como F1)

F2-Exploración no tiene página de inicio. Debe crearse replicando el patrón
de F1 Propósito.

**Ruta:** `/moddulo/proyecto/[projectId]/exploracion` (la ruta actual del
chat pasa a `/moddulo/proyecto/[projectId]/exploracion/chat`)

O alternativamente, la ruta actual se mantiene y la página de inicio se
muestra como primera vista antes de activar el chat — igual que F1.

**Contenido de la página de inicio de F2:**

```
[Nombre del proyecto]
[Badge: País] [Badge: Tipo] [Badge: Nivel]

F2 establece el mapa situacional del entorno del proyecto mediante
el modelo PESTEL, contrasta las señales del entorno con las variables
XPCTO definidas en F1, y produce el Programa de Investigación Profunda
que guiará la Fase 3.

[Sección: Los cinco motores de F2]
M1 — Escaneo PESTEL situado
     Análisis de las seis dimensiones del entorno: Político, Económico,
     Social, Tecnológico, Ecológico y Legal.

M2 — Contraste XPCTO-Entorno
     Veredicto por cada variable del proyecto frente a las señales del entorno.

M3 — Semáforo de Riesgo de Veto
     Identificación de actores con poder de bloqueo y su nivel de riesgo.

M4 — Mapa de Incertidumbres Estratégicas
     Clasificación de lo que no sabemos por urgencia y posibilidad de resolución.

M5 — Hipótesis Estratégica Inicial
     Síntesis interpretativa del entorno que F3 validará, ajustará o refutará.

[Nota informativa]
"Los resultados de F2 son editables en cualquier momento.
Cualquier cambio actualiza automáticamente el DVS y puede
impactar las fases anteriores y posteriores."

[Botón primario] "Comenzar Fase 2"
```

El botón "Comenzar Fase 2" navega al chat de F2, que inicia con el
mensaje actualizado descrito en A2.

---

## A2 — Mensaje de apertura del chat de F2 (actualizar)

Sustituir el mensaje actual por este texto exacto:

```
Estamos en la Fase 2 — Exploración. Aquí realizaremos el escaneo situacional
del entorno de tu proyecto para contrastar el contexto real con las variables
XPCTO que ya definimos.

Tienes dos vías para este análisis:

Análisis de contexto express — Yo propongo el escaneo PESTEL directamente
aquí en F2, a partir del Propósito que ya definimos. Si tienes documentos,
estudios o reportes sobre el entorno —encuestas, notas de campo, análisis
previos— puedes adjuntarlos aquí o pegar el texto en el chat para enriquecer
el análisis.

Análisis PESTEL — Usa la app PESTEL de Centinela: configurarás las variables
con pesos, agregarás fuentes de datos y obtendrás interpretación, informes
y monitoreo continuo. Si compartes documentos aquí primero, PESTEL los
recuperará automáticamente.

¿Con qué información cuentas y cuál vía prefieres?
```

**Notas de implementación:**
- El texto no usa negritas en el sistema prompt — el formateado bold es
  responsabilidad del componente que renderiza el mensaje de Moddulo.
- "Análisis de contexto express" y "Análisis PESTEL completo" sí deben
  renderizarse en bold en la interfaz.
- El chip "Abrir PESTEL" aparece en la barra de botones (no en el chat)
  y permanece activo desde el inicio de F2 en estado `en_progreso`.
- Las dos vías se denominan "Análisis de contexto express" y "Análisis PESTEL"
  sin adjetivos adicionales. No usar "completo", "profundo" ni ningún
  calificativo que implique superioridad de una vía sobre la otra.

---

## A3 — Adjuntar archivos en el chat de Moddulo (todas las fases)

**Alcance:** F1, F2, F3, F4, F5, F6, F7, F8 y F9 — todas las fases que
tengan interfaz de chat.

**Implementación en el componente de input del chat (ChatInput):**

Añadir un botón de adjuntar junto al textarea. Estilo: ícono `Paperclip`
de lucide-react, mismo tamaño y estilo que el botón de envío.

```tsx
// Junto al botón de envío (Send), añadir:
<button onClick={triggerFileInput} aria-label="Adjuntar archivo">
  <Paperclip size={16} />
</button>
<input
  ref={fileInputRef}
  type="file"
  accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg"
  multiple
  style={{ display: 'none' }}
  onChange={handleFileAttach}
/>
```

**Comportamiento:**
- Archivos adjuntos se muestran como chips sobre el textarea antes de enviar.
- Al enviar, los archivos se suben a Firebase Storage en
  `moddulo/{projectId}/fases/{faseId}/attachments/{fileName}`
- La URL de descarga y el nombre del archivo se incluyen en el mensaje
  de usuario enviado al chat handler.
- El chat handler (API Route) convierte el archivo a texto antes de
  pasarlo a Claude:
  - PDF: usar la librería existente de extracción de texto
  - DOCX: usar mammoth (ya instalado para PESTEL)
  - TXT/CSV: leer directamente
  - Imágenes: enviar como `image` block en la API de Claude (base64)

**Almacenamiento para transferencia a PESTEL (solo F2):**

En F2, los archivos adjuntos se almacenan también en Firestore:

```typescript
// moddulo_projects/{projectId}.phases.exploracion.archivosAdjuntos
interface ArchivoAdjunto {
  nombre: string
  url: string                   // Firebase Storage URL
  tipo: string                  // mime type
  dimension?: string            // si el usuario especifica la dimensión PESTEL
  cargadoEn: Timestamp
}
```

Cuando el usuario hace clic en "Abrir PESTEL", estos archivos se pasan
a la URL de PESTEL como referencia:

```
/centinela/pestel/nuevo
  ?moddulo_project_id={id}
  &adjuntos={base64(JSON.stringify(archivosAdjuntos))}
  &...resto de parámetros
```

La app PESTEL lee el parámetro `adjuntos` en la Etapa 2 (Datos) y
pre-carga esos archivos como datos manuales del usuario, con dimensión
asignada si viene especificada o marcada como "Por asignar".

---

## A4 — Datos de Sefix en F2 y PESTEL: lógica de niveles federal y local

### Contexto

Sefix dispone de resultados electorales en dos niveles:

**Federal:**
- Diputaciones federales (por distrito)
- Senadurías (por entidad)
- Presidencia de la República

**Local/Estatal:**
- Diputaciones locales (por distrito local)
- Gubernaturas (por entidad)
- Ayuntamientos (por municipio)

### Regla de presentación según nivel del proyecto

En la dimensión **Político (P)** del sidebar derecho de F2 y en la
Etapa 3 de PESTEL (tab P), mostrar siempre ambos niveles pero en orden
de relevancia:

```typescript
function ordenarResultadosSefix(nivel: string, tipo: string) {
  // Nivel federal o nacional → federales primero
  if (['Federal', 'Nacional'].includes(nivel)) {
    return ['federal', 'local']
  }
  // Nivel estatal → estatales primero
  if (nivel === 'Estatal') {
    return ['local', 'federal']
  }
  // Nivel municipal o local → municipales primero
  if (['Municipal', 'Local', 'Distrital'].includes(nivel)) {
    return ['local', 'federal']
  }
  return ['federal', 'local']
}
```

### Qué mostrar por tipo de elección

**Proyectos federales** (nivel = 'Federal' | 'Nacional'):

```
DATOS ELECTORALES FEDERALES (primario)
Última elección federal en el territorio:
  - Si tipo = 'electoral' y cargo relacionado con diputación federal:
    → Resultados del distrito federal correspondiente
  - Si tipo = 'electoral' y cargo relacionado con senaduría:
    → Resultados de la entidad federativa
  - Si tipo = 'electoral' y cargo = presidencial:
    → Resultados nacionales + desagregado por entidad

DATOS ELECTORALES LOCALES (contraste)
Última elección local en el territorio:
  → Gubernatura de la entidad (si aplica)
  → Lista nominal y padrón de la entidad
```

**Proyectos estatales** (nivel = 'Estatal'):

```
DATOS ELECTORALES LOCALES (primario)
  - Gubernatura: resultados más recientes de la entidad
  - Diputaciones locales: resultados del distrito local si se especifica
  - Lista Nominal y Padrón Electoral de la entidad

DATOS ELECTORALES FEDERALES (contraste)
  - Resultados federales más recientes en esa entidad
  - (Diputaciones federales y/o Senaduría)
```

**Proyectos municipales o locales** (nivel = 'Municipal' | 'Local' | 'Distrital'):

```
DATOS ELECTORALES MUNICIPALES (primario)
  - Ayuntamiento: resultados más recientes del municipio
  - Lista Nominal del municipio
  - Padrón Electoral: H: X · M: X

DATOS ELECTORALES ESTATALES Y FEDERALES (contraste)
  - Gubernatura más reciente de la entidad
  - Diputación federal del distrito (si aplica)
  - Participación comparada: municipio vs. entidad vs. nacional
```

### Implementación

En el componente que consulta Sefix para la dimensión P:

```typescript
// Llamada actual (mantener):
const datosSefix = await getSefixData({
  nivel: project.nivel,
  estado: project.territorio.estado,
  municipio: project.territorio.municipio,
})

// Añadir: segunda llamada para el nivel de contraste
const nivelContraste = getNivelContraste(project.nivel)
const datosContraste = await getSefixData({
  nivel: nivelContraste,
  estado: project.territorio.estado,
  // municipio omitido si el contraste es estatal o federal
})

// Renderizar ambos niveles con headers diferenciados
```

El componente actual que muestra "Lista Nominal" y "Padrón Electoral"
y "Última elección" se convierte en dos secciones:

```
[Encabezado nivel primario — ej. "DATOS SEFIX — MUNICIPAL"]
  Tarjeta: Lista Nominal + Padrón
  Tarjeta: Última elección (ayuntamiento)

[Encabezado nivel contraste — ej. "CONTRASTE — ESTATAL Y FEDERAL"]
  Tarjeta: Última gubernatura
  Tarjeta: Última elección federal en el distrito/entidad
```

**Nota:** Si el proyecto es de tipo no Electoral (Gubernamental, Legislativo,
Ciudadano), los datos de Sefix siguen siendo relevantes como contexto
de correlación de fuerzas pero se presentan con la etiqueta "Contexto
electoral de referencia" en lugar de "Datos electorales".

---

## A6 — Archivos adjuntos en F1: modo extracción de XPCTO

### El escenario

El usuario puede tener briefs, presentaciones o documentos previos que
ya contienen la información de X, P, C, T y O. Pedirle que transcriba
esa información variable por variable en el chat es innecesario. F1 debe
permitir que el usuario adjunte esos documentos y que Moddulo los procese
para extraer los valores de XPCTO.

### Dos modos del chat handler de F1

**Modo conversacional (flujo actual — no cambiar):**
Moddulo pregunta variable por variable en el chat. El usuario responde
en texto. Este modo se mantiene exactamente como está.

**Modo extracción (cuando el usuario adjunta archivos):**
Se activa cuando el mensaje del usuario incluye uno o más archivos adjuntos.
El sistema procesa el archivo y extrae los valores que puede inferir para
cada variable XPCTO.

### Implementación del modo extracción en el chat handler de F1

En `app/api/moddulo/chat/proposito/route.ts` (o el equivalente existente),
añadir la detección de archivos adjuntos y el flujo de extracción:

```typescript
// 1. Detectar si el mensaje incluye archivos adjuntos
if (message.attachments && message.attachments.length > 0) {
  // 2. Convertir los archivos a texto (PDF → texto, DOCX → mammoth, etc.)
  const contenidoDocumentos = await extractTextFromAttachments(message.attachments)

  // 3. Llamada de extracción a Claude con prompt especializado
  const extraction = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: `Eres el asistente de extracción de variables XPCTO de Moddulo.
A partir del documento proporcionado por el usuario, extrae los valores
para las cinco variables del proyecto:
X (Hito/Meta de victoria): resultado cuantificable, ámbito, fecha, criterio de verificación
P (Sujeto/Actor principal): identidad, trayectoria, imagen, arquetipo, fronteras éticas
C (Capacidades): financiero, humano, organizacional, material
T (Tiempo): fecha inicio, fecha hito, hitos intermedios, restricciones
O (Justificación): problema público, beneficiarios, conexión P-O, criterio integridad

Para cada variable:
- Si encuentras información suficiente: extrae el valor propuesto
- Si la información es parcial: extrae lo que hay y marca los campos faltantes
- Si no encuentras información: marca como "no encontrado"

Responde ÚNICAMENTE con JSON válido:
{
  "x": { "resultado": "...", "ambito": "...", "fecha": "...", "criterioVerificacion": "...", "confianza": "alta|media|baja|no_encontrado" },
  "p": { "identidad": "...", "trayectoria": "...", "imagenActual": "...", "arquetipoEstilo": "...", "fronterasEticas": "...", "confianza": "..." },
  "c": { "financiero": "...", "humano": "...", "organizacional": "...", "material": "...", "confianza": "..." },
  "t": { "fechaInicio": "...", "fechaHito": "...", "hitosIntermedios": "...", "restricciones": "...", "confianza": "..." },
  "o": { "problemaPublico": "...", "beneficiarios": "...", "conexionPO": "...", "criterioIntegridad": "...", "confianza": "..." }
}`,
    messages: [{ role: 'user', content: contenidoDocumentos }]
  })

  // 4. Parsear el JSON de extracción
  const xpctoExtraido = JSON.parse(extraction.content[0].text)

  // 5. Guardar el borrador extraído en Firestore
  await updateDoc(projectRef, {
    'phases.proposito.xpctoBorrador': xpctoExtraido
  })

  // 6. Construir el mensaje de respuesta de Moddulo al usuario
  // Presentar lo encontrado variable por variable para confirmación
  const respuesta = construirMensajeConfirmacion(xpctoExtraido)
  return streamResponse(respuesta)
}
```

### Función `construirMensajeConfirmacion`

El mensaje que Moddulo envía al usuario tras la extracción sigue este patrón:

```
He analizado el documento que compartiste. A partir de él propongo los
siguientes valores para las variables XPCTO. Revisa cada uno y confirma,
corrige o complementa:

X — Hito: [valor extraído, o "No encontré información suficiente para esta variable"]
P — Sujeto: [valor extraído]
C — Capacidades: [valor extraído]
T — Tiempo: [valor extraído]
O — Justificación: [valor extraído]

¿Qué ajustes necesita esta propuesta?
```

Si una variable tiene confianza "no_encontrado", Moddulo la pregunta
normalmente al usuario después de mostrar las que sí encontró.

### Nota sobre el flujo de chat después de la extracción

El modo extracción no interrumpe el flujo conversacional — lo acelera.
Después del mensaje de confirmación, el chat continúa normalmente:
el usuario confirma o ajusta, y Moddulo registra los valores aprobados
variable por variable, exactamente como en el modo conversacional.

---

## A7 — Ubicación del botón "Abrir PESTEL" en F2

### Principio de diseño

El botón "Abrir PESTEL" es una acción contextual que solo tiene sentido
en un momento específico del flujo. No debe estar siempre visible en
el header porque genera ruido antes de que el usuario lo necesite.

### Lugar 1 — Acción inline en el chat (momento de mayor relevancia)

Inmediatamente después del mensaje de apertura del chat de F2 (el que
presenta las dos vías), renderizar un botón de acción inline dentro del
área del chat — **no en el header**:

```tsx
// Después del primer mensaje de Moddulo, si el estado es en_progreso
// y M1 no está completado todavía:
<div className="flex justify-start mt-2 ml-10">
  <button
    onClick={handleAbrirPESTEL}
    className="text-sm font-semibold rounded-full px-4 py-1.5"
    style={{ border: `1px solid ${colors.bluegreen60}`, color: colors.bluegreen60, background: 'transparent' }}
  >
    Abrir PESTEL
  </button>
</div>
```

Este botón desaparece del área del chat cuando:
- El usuario elige la vía express (responde en el chat eligiendo esa opción)
- M1 queda completado por cualquier vía

### Lugar 2 — Header, solo mientras M1 está en progreso vía PESTEL

Cuando el usuario hizo clic en "Abrir PESTEL" (inline) y regresó de
PESTEL sin completar el análisis, o cuando quiere actualizar el análisis
desde PESTEL en cualquier momento posterior en que M1 NO esté lista:

```
Estado en_progreso + usuario eligió vía PESTEL:
  → Chip 1 del header: "Abrir PESTEL" (activo, bluegreen)
  → Chip 2: "Editar análisis" (disabled)
  → Chip 3: "Cerrar Fase 2" (disabled)
```

Cuando M1 está completado (por cualquier vía):
```
  → Chip 1: "DVS F2" (activo cuando estado = lista)
  → Chip 2: "Editar análisis"
  → Chip 3: "Cerrar Fase 2"
```

### Resumen del comportamiento del chip 1 del header

| Condición | Chip 1 muestra |
|---|---|
| en_progreso + M1 sin completar + vía express | nada (disabled) |
| en_progreso + M1 sin completar + vía PESTEL elegida | "Abrir PESTEL" (activo) |
| en_progreso + M1 completado | nada (disabled) |
| lista | "DVS F2" (activo) |
| editando | "Cancelar" (activo) |

---

