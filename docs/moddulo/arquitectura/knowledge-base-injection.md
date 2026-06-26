# Inyección de base de conocimiento por fase — Moddulo
**Para Claude Code · Implementar en `lib/moddulo/knowledge-injector.ts`**

---

## Principio

El RAE, RPF, MEC, MVP, FODA y KPIs NO se buscan por similitud vectorial.
Se cargan de Firestore y se inyectan **directamente en el system prompt** de Claude,
seleccionando solo lo relevante para la fase y el tipo de proyecto actuales.

El system prompt de cada fase tiene dos partes:
1. **Contexto de base de conocimiento** (generado por `buildPhaseContext`)
2. **System prompt específico de la fase** (el que ya existe o se definirá por fase)

El contexto va PRIMERO. El system prompt existente no se elimina.

---

## Qué se inyecta por fase

### F1 — Propósito

**RAE:** Inyectar los axiomas cuyas `variable_xpcto` incluyan cualquier variable
de XPCTO y cuyas `fases_aplicacion` incluyan `1`.

Propósito: que Claude proponga borradores de variables con la profundidad
teórica correcta (ej. entender que X debe ser "el candidato menos malo, no
el mejor" per el Axioma de Contraste Crítico).

```typescript
const axiomas = rae.axiomas.filter(a =>
  a.fases_aplicacion.includes(1) &&
  a.variable_xpcto.length > 0
)
```

**RPF, MEC, MVP, FODA, KPIs:** No inyectar en F1.

Formato de inyección en prompt:
```
=== AXIOMAS DE REFERENCIA (RAE v{version}) ===
Los siguientes axiomas de comunicación política deben orientar tus propuestas
y validaciones. No los cites explícitamente al usuario; úsalos para calibrar
la calidad de las variables XPCTO.

{id}: {nombre}
Axioma: {axioma_original}
Aplicación para {variable}: {protocolo_accion}
---
```

---

### F2 — Exploración

**RAE:** Axiomas de `fases_aplicacion` = [2]. Típicamente: Adaptabilidad
Estructural, Coalición Momentánea, Optimización del Blanco.

**RPF, MEC, MVP, FODA, KPIs:** No inyectar.

---

### F3 — Investigación

**RAE:** Axiomas de `fases_aplicacion` = [3]. Típicamente: Imagen como Atajo,
Atajos Cognitivos, Telegenia sobre Programa.

**RPF, MEC, MVP, FODA, KPIs:** No inyectar.

---

### F4 — Diagnóstico ⚠️ FASE CRÍTICA

**RAE:** Todos los axiomas del tipo de proyecto (`tipos_proyecto` incluye el
tipo actual, o `tipos_proyecto` está vacío = aplica a todos).

**MEC:** Inyectar el instrumento completo para el tipo de proyecto.
Cargar de `mec_instruments/{MEC-{TIPO.toUpperCase()}}`.

**MVP:** Inyectar completo. Cargar de `mvp_instruments/MVP-GENERAL`.

**FODA-CAME-IBEA:** Inyectar los tres marcos. Cargar de `foda_instruments/FODA-CAME-IBEA`.

**RPF, KPIs:** No inyectar en F4 (se usan en F5-F6).

```typescript
// Cargar todo en paralelo
const [rae, mec, mvp, foda] = await Promise.all([
  getActiveRAEVersion(),
  getMECByType(projectType),
  getMVPGeneral(),
  getFODAInstrument(),
])
```

---

### F5 — Diseño Estratégico

**RAE:** Axiomas del tipo de proyecto con `fases_aplicacion` ⊇ [5].

**RPF:** Cargar entradas donde `tipos_proyecto` incluye el tipo actual.
Filtrar adicionalmente por `maniobra` del output de F4:
- Si maniobra = 'defensiva': priorizar entradas con "Defensiva" o "Conservar"
  en su `logica_coherencia`.
- Si maniobra = 'ofensiva': priorizar entradas con "Ofensiva" o "Ampliar".

```typescript
const rpfEntries = await getRPFEntries(projectType)
const rpfFiltrado = rpfEntries.filter(e =>
  e.logica_coherencia.toLowerCase().includes(f4Output.maniobra)
)
```

**MEC, MVP, FODA:** Solo el resultado de F4 (ya guardado en el proyecto), no
los instrumentos completos de nuevo.

**KPIs:** No inyectar en F5.

---

### F6 — Diseño Táctico

**RAE:** Axiomas del tipo de proyecto con `fases_aplicacion` ⊇ [6].

**RPF:** Inyectar las entradas completas del tipo de proyecto. F6 usa el RPF
como insumo central para construir el plan táctico.

**KPIs:** Inyectar el catálogo completo del tipo de proyecto.
Cargar de `kpi_catalog` donde `tipos_proyecto` incluye el tipo actual.

```typescript
const kpis = await getKPIsByType(projectType)
```

---

### F7 — Gerencia

**RAE:** No inyectar.
**RPF:** No inyectar (ya fue usado en F5-F6).
**KPIs:** Solo los KPIs seleccionados/confirmados en F6 (guardados en el proyecto).

---

### F8 — Seguimiento

**RAE:** No inyectar.
**KPIs:** Los KPIs activos del proyecto (heredados de F6-F7).

---

### F9 — Evaluación / Legado

**RAE:** Inyectar TODOS los axiomas del tipo de proyecto.
Propósito: que Claude evalúe el ciclo completo contra la base teórica y
proponga actualizaciones al RAE como parte del legado del proyecto.

Los axiomas propuestos para actualización se guardan en el documento F9
del proyecto, NO se suben directamente al RAE. Un admin de Eskemma revisa
y ejecuta el seed con la nueva versión cuando lo apruebe.

---

## Implementación en código

### `lib/moddulo/knowledge-injector.ts`

```typescript
import { getActiveRAEVersion, getMECByType, getMVPGeneral,
         getFODAInstrument, getRPFEntries, getKPIsByType } from './knowledge-repository'
import type { TipoProyecto, RAEAxioma, F4PhaseData } from '@/types/firestore-schema'

export async function buildPhaseContext(params: {
  phaseId: number
  projectType: TipoProyecto
  f4Output?: F4PhaseData
}): Promise<string> {
  const { phaseId, projectType, f4Output } = params
  const parts: string[] = []

  const rae = await getActiveRAEVersion()

  // RAE — siempre evaluar
  const axiomas = rae.axiomas.filter(a =>
    a.fases_aplicacion.includes(phaseId) &&
    (a.tipos_proyecto.length === 0 || a.tipos_proyecto.includes(projectType))
  )
  if (axiomas.length > 0) {
    parts.push(formatAxiomasSection(axiomas, rae.versionId))
  }

  // MEC + MVP + FODA — F4 en adelante
  if (phaseId === 4) {
    const [mec, mvp, foda] = await Promise.all([
      getMECByType(projectType),
      getMVPGeneral(),
      getFODAInstrument(),
    ])
    if (mec)  parts.push(formatMECSection(mec))
    if (mvp)  parts.push(formatMVPSection(mvp))
    if (foda) parts.push(formatFODASection(foda))
  }

  // RPF — F5 y F6
  if (phaseId >= 5 && phaseId <= 6) {
    const rpfEntries = await getRPFEntries(projectType, f4Output?.maniobra)
    if (rpfEntries.length > 0) {
      parts.push(formatRPFSection(rpfEntries, phaseId))
    }
  }

  // KPIs — F6, F7, F8, F9
  if (phaseId >= 6) {
    const kpis = await getKPIsByType(projectType)
    if (kpis.length > 0) {
      parts.push(formatKPISection(kpis))
    }
  }

  return parts.join('\n\n---\n\n')
}
```

### `lib/moddulo/knowledge-repository.ts`

Funciones de acceso a Firestore (server-side únicamente):

```typescript
// Carga la versión activa del RAE desde Firestore
export async function getActiveRAEVersion(): Promise<RAEVersion>

// Carga el MEC para un tipo de proyecto
export async function getMECByType(tipo: TipoProyecto): Promise<MECInstrument | null>

// Carga el MVP (es único, no varía por tipo)
export async function getMVPGeneral(): Promise<MVPInstrument | null>

// Carga el instrumento FODA-CAME-IBEA
export async function getFODAInstrument(): Promise<FODAInstrument | null>

// Carga entradas del RPF filtradas por tipo y maniobra
export async function getRPFEntries(
  tipo: TipoProyecto,
  maniobra?: 'ofensiva' | 'defensiva' | 'combinada'
): Promise<RPFEntry[]>

// Carga KPIs por tipo de proyecto
export async function getKPIsByType(tipo: TipoProyecto): Promise<KPIEntry[]>
```

### Integración en el chat handler

En la API Route `/api/moddulo/chat/[phaseId]` (ya existente), añadir:

```typescript
// ANTES de llamar a Claude, construir el contexto de conocimiento
const knowledgeContext = await buildPhaseContext({
  phaseId: parseInt(phaseId),
  projectType: project.tipo,
  f4Output: project.phases?.diagnostico,  // undefined si F4 no está completada
})

// Anteponer al system prompt existente
const systemPrompt = knowledgeContext
  ? `${knowledgeContext}\n\n---\n\n${EXISTING_SYSTEM_PROMPT}`
  : EXISTING_SYSTEM_PROMPT
```

---

## Notas de rendimiento

1. **Cachear en memoria** los instrumentos fijos (MEC, MVP, FODA) dentro de la
   misma instancia de la Cloud Function. Son documentos que no cambian entre
   requests concurrentes.

2. **El RAE activo** cambia raramente (solo cuando un admin sube una nueva
   versión). Cachear con TTL de 1 hora es seguro:
   ```typescript
   let raeCache: { data: RAEVersion; loadedAt: number } | null = null
   const RAE_CACHE_TTL = 60 * 60 * 1000 // 1 hora
   ```

3. **El RPF** es grande. Cargar solo las entradas que coinciden con el tipo de
   proyecto, no el catálogo completo. Usar `where('tipos_proyecto', 'array-contains', tipo)`.
