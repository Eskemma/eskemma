# Spec — 00: Fundamento metodológico del PEST-L en PESTEL

> Este documento es el "por qué" de PESTEL. Claude Code debe leerlo
> para entender las decisiones de diseño que a veces parecen restrictivas
> pero tienen una razón metodológica sólida.

---

## Qué es el análisis PEST-L

El análisis PEST-L es un framework de exploración del macroentorno
externo que organiza las fuerzas del contexto en cinco categorías:

- **P — Político**: correlación de fuerzas, estabilidad institucional,
  sistema electoral, confianza ciudadana en instituciones.
- **E — Económico**: indicadores macro, percepción ciudadana de la
  economía, informalidad laboral.
- **S — Social**: demografía, valores culturales, agenda ciudadana,
  malestar social, movimientos sociales.
- **T — Tecnológico**: penetración digital, brecha de conectividad,
  ecosistema mediático, desinformación.
- **L — Legal/Ambiental**: normativa electoral, regulación de medios,
  protección de datos, conflictos socioambientales.

## Por qué PESTEL usa PEST-L (y no FODA)

El PEST-L analiza el entorno externo. El FODA analiza la posición del
actor (fortalezas y debilidades internas + oportunidades y amenazas del
entorno). La secuencia correcta es: primero PEST-L (entender el
territorio), luego FODA (posicionarse en ese territorio).

PESTEL hace el PEST-L. El FODA es una feature posterior.

## Por qué el analista humano siempre valida

Los estudios académicos (Hackenburg et al., Science 2025) demuestran
que donde los LLMs aumentan su persuasión, también disminuyen su
precisión factual. En comunicación política esto es crítico: una
clasificación errónea de OPORTUNIDAD/AMENAZA puede llevar a decisiones
estratégicas equivocadas con consecuencias reales.

PESTEL usa IA para procesar volúmenes de información imposibles para
un equipo humano, pero no sustituye el juicio estratégico del analista.

## Por qué la trazabilidad es obligatoria

En contextos latinoamericanos, los datos oficiales frecuentemente
contradicen la percepción ciudadana. Los análisis deben ser auditables
para que el equipo político pueda cuestionar las fuentes y tomar
decisiones informadas sobre qué datos priorizar.

## El contexto latinoamericano que PESTEL debe respetar

- Volatilidad política extrema: el contexto cambia rápido.
- Desigualdad extrema: segmenta radicalmente los públicos.
- Informalidad laboral masiva (>46% regional): invisible para datos
  oficiales, visible en datos de campo.
- Brecha digital multidimensional: ~30-40% de la población excluida del
  ecosistema digital. Los análisis solo digitales tienen sesgo severo.
- Heterogeneidad regulatoria electoral: varía drásticamente por país y
  por tipo de elección.

---

# Spec — data_model: Modelo de datos compartido

> Las entidades definidas aquí son las canónicas. Todas las specs de
> etapas hacen referencia a estos tipos.

```typescript
// ============================================================
// ENTIDADES PRINCIPALES
// ============================================================

type Project = {
  id: string;                  // UUID
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  config: ProjectConfig;       // Etapa 1
  territory: TerritoryConfig;  // Etapa 2
  pestlConfig: PestlConfig;    // Etapa 3
  analyses: PestlAnalysis[];   // Etapas 5-6, versionadas
  team: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

type ProjectType = 'ELECTORAL' | 'GUBERNAMENTAL' | 'LEGISLATIVO' | 'CIUDADANO';
type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'MONITORING' | 'ARCHIVED';

// ============================================================
// ANÁLISIS PEST-L (versionado)
// ============================================================

type PestlAnalysis = {
  id: string;
  projectId: string;
  version: number;             // empieza en 1, incrementa en re-análisis
  type: 'FULL' | 'PARTIAL' | 'CRISIS';
  analyzedAt: Date;
  globalConfidence: number;    // 0-100
  dimensions: DimensionAnalysis[];
  impactChains: ImpactChain[];
  biasAlerts: BiasAlert[];
  humanReview: HumanReview;
  reports: Report[];
  status: AnalysisStatus;
}

type AnalysisStatus =
  | 'PROCESSING'        // Etapa 5 en curso
  | 'PENDING_REVIEW'    // Etapa 5 completa, esperando Etapa 6
  | 'REVIEWED'          // Etapa 6 completa
  | 'REPORTS_GENERATED' // Etapa 7 completa
  | 'MONITORING';       // Etapa 8 activa

// ============================================================
// DATOS Y FUENTES
// ============================================================

type DataPoint = {
  id: string;
  projectId: string;
  dimension: 'P' | 'E' | 'S' | 'T' | 'L';
  variableId: string;
  value: string | number;
  source: string;
  capturedAt: Date;
  reliabilityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  isManual: boolean;
  conflictsWith?: string[];    // IDs de datos que contradicen este
}

// ============================================================
// ALERTAS Y MONITOREO (Etapa 8)
// ============================================================

type Alert = {
  id: string;
  projectId: string;
  type: 'THRESHOLD' | 'CRISIS' | 'BIAS' | 'UPDATE';
  dimension?: 'P' | 'E' | 'S' | 'T' | 'L';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

type MonitoringConfig = {
  projectId: string;
  updateFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  thresholds: AlertThreshold[];
  notifyEmails: string[];
  crisisDetectionEnabled: boolean;
  crisisSpikeMultiplier: number;  // default: 3 (300% sobre media de 7 días)
}
```
