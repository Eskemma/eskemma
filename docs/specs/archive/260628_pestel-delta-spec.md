# Delta Spec — App PESTEL · Centinela
## Para Claude Code · Junio 2026

Lee este archivo completo antes de escribir una sola línea de código.
Confirma qué archivos vas a modificar antes de empezar.
Lee primero los archivos existentes de PESTEL para entender la estructura actual.
No refactorices nada que no esté en esta lista.

---

## Contexto

La app PESTEL en Centinela tiene una implementación funcional con 8 etapas
actualmente. Este documento describe exactamente qué cambiar. Los cambios
se agrupan en tres categorías: estructurales (afectan el modelo de datos),
de UI (afectan componentes visuales) y de integración (afectan la conexión
con Moddulo F2).

Ruta base: `/centinela/pestel/`

---

## Cambio 1 — Compactar de 8 a 6 etapas en el StepIndicator

Las etapas 1, 2 y 3 actuales (Tipo y nombre, Territorio, Variables PESTEL)
pasan a ser **sub-pasos de una sola Etapa 1 — Configuración**.

El StepIndicator debe mostrar exactamente 6 etapas:

```
1 Config.  →  2 Datos  →  3 Análisis  →  4 Interpr.  →  5 Informes  →  6 Monitoreo
```

Los sub-pasos de la Etapa 1 se navegan internamente (paso 1/3, 2/3, 3/3)
sin cambiar el número en el StepIndicator principal. El StepIndicator
permanece en "1" durante toda la configuración.

**Renombrar** el texto de la última etapa de "Centinela" a **"Monitoreo"**
en el StepIndicator y en todos los headers de esa etapa.

---

## Cambio 2 — Separar "Legal/Ambiental" en dos dimensiones independientes

⚠️ Este es el cambio más importante. Afecta toda la app.

Actualmente existe una dimensión fusionada "L — Legal/Ambiental".
Debe separarse en:
- **L — Legal**: marco normativo, leyes, decretos, regulaciones
- **Ec — Ecológico**: factores ambientales con impacto político

### 2.1 Modelo de datos

```typescript
// Antes
interface DimensionPESTEL {
  L: DimensionData   // Legal/Ambiental fusionado
}

// Después
interface DimensionPESTEL {
  L: DimensionData   // Legal
  Ec: DimensionData  // Ecológico (nuevo)
}
```

Añadir `Ec` como campo opcional con migración graceful:
si no existe `Ec` en un análisis existente, inicializarlo vacío.

### 2.2 UI — todos los lugares donde aparecen las dimensiones

Sustituir "Legal / Ambiental" (o "L — Legal/Ambiental") por dos entradas:
- "L — Legal" con inicial L
- "Ec — Ecológico" con inicial Ec (color diferenciado del L)

Lugares afectados:
- Etapa 1.3: acordeón de Variables PESTEL
- Etapa 2: Semáforo de cobertura (tabla de dimensiones)
- Etapa 3: tabs de análisis por dimensión
- Etapa 3: sección Cadenas de impacto (las dimensiones L y Ec son ahora independientes)
- Etapa 4: Matriz de impacto/probabilidad
- Etapa 4: tab Comparativa (lista de dimensiones estables/cambiadas)
- Etapa 5: Scorecard ponderado
- Etapa 6: tarjetas de Estado actual PESTEL

---

## Cambio 3 — Señales tripartitas en el resultado del análisis

El análisis actualmente produce un solo veredicto por dimensión ("Amenaza").
Debe producir tres categorías simultáneas de señales:

```typescript
// Antes
interface DimensionAnalisis {
  clasificacion: 'amenaza' | 'oportunidad' | 'neutral'
  // ...
}

// Después
interface DimensionAnalisis {
  señalesFavorables: Señal[]
  señalesAdversas: Señal[]
  señalesInciertas: Señal[]
  clasificacionGlobal: 'amenaza' | 'oportunidad' | 'neutral'  // mantener como resumen
  // ...resto de campos existentes sin cambio
}

interface Señal {
  descripcion: string
  fuente: string
  fechaCorte: string
  nivelConfianza: 'alto' | 'medio' | 'bajo'
  origenInternacional: boolean
}
```

### 3.1 Prompt de análisis IA — actualizar

En el Cloud Function o API Route que llama a Claude para el análisis por dimensión,
añadir al prompt la instrucción de devolver señales tripartitas:

```
Para cada dimensión, identifica y separa:
1. Señales favorables: factores del entorno que benefician el proyecto
2. Señales adversas: factores que dificultan o amenazan el proyecto
3. Señales inciertas: factores cuyo impacto no puede determinarse con los datos disponibles

Devuelve el JSON con esta estructura:
{
  "señalesFavorables": [{"descripcion": "...", "fuente": "...", "fechaCorte": "...", "nivelConfianza": "alto|medio|bajo", "origenInternacional": false}],
  "señalesAdversas": [...],
  "señalesInciertas": [...],
  "clasificacionGlobal": "amenaza|oportunidad|neutral",
  "titular": "...",
  "narrativa": "...",
  "confianza": 0-100,
  "tendencia": "ascendente|estable|descendente",
  "intensidad": "alta|media|baja"
}
```

### 3.2 UI — Etapa 3, sección "Análisis por dimensión"

Dentro de cada tab de dimensión, sustituir el badge único "Amenaza" por
tres secciones expandibles (acordeón):

```
[CheckCircle verde] Señales favorables (N)
  → lista de señales
[AlertTriangle rojo] Señales adversas (N)
  → lista de señales
[HelpCircle gris] Señales inciertas (N)
  → lista de señales
[Separador]
Clasificación global: [badge Amenaza/Oportunidad/Neutral]
```

Mantener el titular, narrativa, confianza, tendencia e intensidad
exactamente como están — no cambiar esa parte.

---

## Cambio 4 — Scorecard ponderado: corregir score global

El "Score global ponderado" muestra 0/100 en la implementación actual.
Verificar la lógica del cálculo y corregirla:

```typescript
// Fórmula correcta:
// score_dimensión = (confianza_dimensión / 100) × suma_pesos_variables_esa_dimensión
// score_global = (suma(score_dimensión × peso_dimensión) / suma(pesos_totales)) × 100

// Donde peso_dimensión = promedio de pesos de las variables de esa dimensión
```

Mostrar el score como número entero (0-100) con barra de progreso.

---

## Cambio 5 — Etapa 6: Monitoreo — cambios de comportamiento

### 5.1 Botón "Iniciar proyecto en Moddulo" → condicional

El botón cambia según el origen del análisis:

```typescript
if (analysis.modduloOrigenEscenario === 'A') {
  // Viene de Moddulo F2
  // Mostrar: "Regresar a F2 con resultados"
  // Acción: exportar análisis y redirect a F2 con ?pest_analysis_id={id}
  // Estilo: chip con borde bluegreen, NO naranja
} else {
  // Uso independiente (escenario B)
  // Mostrar: "Iniciar proyecto en Moddulo"
  // Acción: modal ¿Nuevo proyecto o vincular a existente?
  // Estilo: chip naranja (acción terminal)
}
```

El campo `modduloOrigenEscenario` se establece en `'A'` cuando la URL
de creación contiene `?moddulo_project_id=`.

### 5.2 Monitoreo automático — mostrar costo estimado

Antes de que el usuario active el toggle de monitoreo automático,
mostrar el costo estimado en tokens:

```typescript
// Al hacer hover o antes del toggle
const tokensEstimados = calcularTokensEstimados(intervaloHoras, analysis.variables.length)
// Mostrar: "~{N} tokens por mes al intervalo de {X} horas"
```

El intervalo sugerido debe ser adaptativo según tipo de proyecto y horizonte:

```typescript
function calcularIntervaloSugerido(tipo: string, horizonte: number): number {
  // horizonte en meses
  if (horizonte > 12) return tipo === 'legislativo' ? 48 : 72
  if (horizonte > 6)  return tipo === 'legislativo' ? 24 : 48
  if (horizonte > 3)  return tipo === 'legislativo' ? 12 : 24
  if (horizonte > 1)  return tipo === 'legislativo' ? 6  : 12
  return tipo === 'legislativo' ? 4 : 6
}
```

Mostrar el intervalo sugerido con opción de ajuste manual (select o slider).

### 5.3 Eliminar "Iniciar proyecto en Moddulo" de las cards del Hub

Las cards de proyectos en el Hub de PESTEL (`/centinela/pestel`) no deben
tener el botón "Iniciar proyecto en Moddulo". Esa acción solo está disponible
en la Etapa 6 — Monitoreo.

---

## Cambio 6 — Color de card en Hub de PESTEL y Hub de Centinela

### 6.1 Etapa 1.1 — Añadir selector de color al formulario de nuevo proyecto

Al final del sub-paso "Tipo y nombre", antes del campo "Horizonte temporal",
añadir un selector de color con esta estructura:

```tsx
<ColorPicker
  label="Color de identificación"
  value={color}
  onChange={setColor}
  palette={['#026988','#248cc1','#ffa366','#649941','#ffd14a','#d10f3f','#474747']}
  // + botón "+" que abre input[type=color] para color libre
  // + campo de texto para ingresar hex manualmente
/>
```

Guardar el color elegido en `centinela_pestel_analyses/{id}.color`.

### 6.2 Cuando viene de Moddulo (escenario A)

Pre-llenar el color desde el proyecto de Moddulo:

```typescript
// En la URL de creación desde F2:
// /centinela/pestel/nuevo?moddulo_project_id={id}&...&color={hex}
// El color es editable — el usuario puede cambiarlo en PESTEL si lo desea
```

### 6.3 Cards en el Hub — borde izquierdo de color

```tsx
// En el componente de la card de proyecto PESTEL
<div style={{ borderLeft: `4px solid ${analysis.color || '#026988'}` }}>
```

---

## Cambio 7 — Persistencia del análisis como datos estructurados en Firestore

Actualmente los informes solo se generan como texto (para PDF/Word).
Añadir persistencia estructurada para que F2 de Moddulo pueda leerlos:

```typescript
// En el endpoint de generación de informe, además de generar el texto:
await updateDoc(analysisRef, {
  'informes': arrayUnion({
    id: generateId(),
    formato,
    contenidoTexto: textoGenerado,
    datosEstructurados: {
      // Para formato 'escenarios':
      escenarios: { optimista: '...', base: '...', pesimista: '...' },
      // Para formato 'foda_lista':
      fodaLista: { oportunidades: [...], amenazas: [...] },
      // Para todos los formatos:
      scorecard: scorecardItems,
      // MapaPESTEL en formato compatible con F2:
      mapaPESTEL: transformarParaModdulo(analisisActual.dimensiones)
    },
    generadoEn: serverTimestamp()
  })
})
```

---

## Cambio 8 — Pre-llenar Etapa 1 desde Moddulo (Escenario A)

Cuando la URL contiene `?moddulo_project_id=`, leer los parámetros y
pre-llenar los campos de la Etapa 1:

| Parámetro URL | Campo de Etapa 1 |
|---|---|
| `tipo` | Tipo de proyecto (seleccionado) |
| `nombre` | Nombre del proyecto (pre-llenado) |
| `nivel` | Nivel territorial |
| `pais` | País |
| `estado_geografico` | Estado/entidad |
| `municipio` | Municipio |
| `horizonte` | Slider de horizonte temporal |
| `color` | Color del proyecto |

Todos los campos pre-llenados son **editables sin restricción**.
Si el usuario cambia el tipo de proyecto, recargar las variables por defecto
del nuevo tipo (ya implementado — solo asegurarse de que funciona con el tipo pre-llenado).

Al crear el proyecto, guardar:
```typescript
modduloProjectId: searchParams.get('moddulo_project_id'),
modduloOrigenEscenario: 'A'
```

---

## Cambio 9 — Sin emojis en botones

Revisar todos los botones de la app PESTEL y eliminar emojis:

| Botón con emoji actual | Reemplazar por |
|---|---|
| "⚡ Importar PESTEL" | "Importar PESTEL" o con ícono de lucide-react |
| Cualquier otro botón con emoji | Texto plano o ícono lucide-react |

Los íconos de lucide-react sí están permitidos junto al texto del botón.
Los emojis Unicode en labels de botón no están permitidos en ningún caso.

---

## Cambio 10 — Exportar a Moddulo (endpoint de salida)

Crear o verificar el endpoint que prepara el análisis para F2:

```typescript
// POST /api/centinela/pestel/export-to-moddulo
// Input: analysisId, modduloProjectId? (opcional si es escenario B)

// Output: pestAnalysisId + mapaPESTEL en formato F2
// El mapaPESTEL transforma las señales tripartitas al formato:
// { P: { señalesFavorables, señalesAdversas, señalesInciertas, narrativa, confianza, ... }, E: {...}, ... }

// Si modduloProjectId existe:
//   Actualizar moddulo_projects/{id}.phases.exploracion.pestAnalysisId = analysisId

// Redirect final:
// /moddulo/proyecto/{modduloProjectId}/exploracion?pest_analysis_id={analysisId}
```

---

## Archivos probablemente a modificar

```
app/centinela/pestel/
├── page.tsx                              ← Hub: eliminar botón en cards (C5.3)
├── nuevo/page.tsx                        ← Etapa 1: sub-pasos, color picker (C6.1, C8)
└── [analysisId]/
    ├── layout.tsx                        ← StepIndicator de 6 pasos (C1)
    ├── datos/page.tsx                    ← Semáforo con 6 dimensiones (C2.2)
    ├── analisis/page.tsx                 ← Señales tripartitas, 6 tabs (C3.2)
    ├── interpretacion/page.tsx           ← Matriz con Ec separado (C2.2)
    ├── informes/page.tsx                 ← Scorecard corregido, persistencia (C4, C7)
    └── monitoreo/page.tsx                ← Botón condicional, costo tokens (C5)

app/api/centinela/pestel/
├── analyze/route.ts                      ← Prompt tripartito (C3.1)
├── export-to-moddulo/route.ts           ← NUEVO o extender (C10)
└── (endpoint de informes)               ← Persistencia estructurada (C7)

types/                                    ← Añadir Ec, señales tripartitas (C2.1, C3)
```

Antes de modificar cualquier archivo, léelo y muéstrame las secciones
relevantes que vas a cambiar. Implementa los cambios en este orden:
C2 (separar Legal/Ec) → C1 (StepIndicator) → C3 (tripartición) →
C5 (Monitoreo) → C6 (color) → C4 (scorecard) → C7 (persistencia) →
C8 (pre-llenado) → C9 (emojis) → C10 (export).
