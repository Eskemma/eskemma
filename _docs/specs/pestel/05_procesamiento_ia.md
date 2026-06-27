# Spec — Etapa 5: Procesamiento IA y análisis automatizado

## Propósito de esta etapa

La IA procesa todos los datos recolectados en la Etapa 4 y produce
el análisis PEST-L estructurado. El trabajo se divide en tres capas
secuenciales. Todo output de IA va acompañado de un indicador de
confianza y queda pendiente de validación humana (Etapa 6).

---

## Capa 1 — Estructuración de datos

**Qué hace**: Prepara los datos brutos para el análisis.

Tareas:
- Clasificar cada dato en su dimensión PEST-L correspondiente (P/E/S/T/L).
- Detectar y marcar duplicados entre fuentes.
- Resolver conflictos entre fuentes (cuando dos fuentes reportan valores
  distintos para el mismo indicador, registrar ambos y marcar el conflicto
  para revisión humana — no resolver automáticamente).
- Normalizar indicadores para hacerlos comparables entre sí.

**Output**: Dataset estructurado por dimensión, con metadatos de origen.

---

## Capa 2 — Análisis por dimensión

**Qué hace**: Para cada dimensión PEST-L, la IA genera un análisis
completo con los siguientes elementos. Todos son obligatorios.

| Campo | Descripción | Tipo |
|-------|-------------|------|
| `tendencia` | Dirección del factor | `'ASCENDENTE' | 'DESCENDENTE' | 'ESTABLE'` |
| `intensidad` | Magnitud del impacto | `'ALTA' | 'MEDIA' | 'BAJA'` |
| `señal_principal` | El dato más relevante de la dimensión | string (máx. 150 chars) |
| `narrativa` | Explicación del análisis | string (2-3 párrafos, lenguaje no técnico) |
| `clasificacion` | Posición estratégica del factor | `'OPORTUNIDAD' | 'AMENAZA' | 'NEUTRAL'` |
| `confianza` | % de confianza basado en cobertura, consistencia y recencia | number (0-100) |

**Prompt base para el análisis por dimensión** (usar como punto de
partida, ajustar según el contexto del proyecto):

```
Eres un consultor experto en comunicación política y análisis de contexto
en Latinoamérica. Analiza la dimensión [DIMENSION] del análisis PEST-L
para el siguiente proyecto político:

- Tipo de proyecto: [TYPE]
- Territorio: [TERRITORY]
- Horizonte temporal: [HORIZON]

Con base en los siguientes datos recolectados:
[DATOS_ESTRUCTURADOS]

Genera:
1. Tendencia del factor (ASCENDENTE/DESCENDENTE/ESTABLE)
2. Intensidad del impacto (ALTA/MEDIA/BAJA)
3. La señal principal: el dato más relevante en máximo 150 caracteres
4. Narrativa explicativa: 2-3 párrafos en lenguaje claro para un equipo
   político (no académico). Evita tecnicismos. Sé directo sobre las
   implicaciones para el proyecto.
5. Clasificación: ¿este factor representa una OPORTUNIDAD, una AMENAZA
   o es NEUTRAL para el proyecto?
6. Nivel de confianza (0-100) basado en: cobertura de datos (¿cuántas
   fuentes?), consistencia (¿coinciden?), recencia (¿qué tan actuales?).

Responde en JSON con las claves: tendencia, intensidad, señal_principal,
narrativa, clasificacion, confianza.
```

---

## Capa 3 — Análisis cruzado (cadenas de impacto)

**Qué hace**: Detecta relaciones significativas entre dimensiones y las
presenta como "cadenas de impacto" para revisión del analista.

Una cadena de impacto es una secuencia de factores de distintas
dimensiones que se refuerzan mutuamente. Ejemplo:
> Crisis económica (E) → malestar social (S) → en contexto de baja
> confianza institucional (P) → amplificada por redes sociales (T) →
> con regulación débil (L) = escenario de alta conflictividad.

PESTEL debe identificar entre 2 y 5 cadenas de impacto por análisis.
Cada cadena incluye:
- Las dimensiones involucradas (mínimo 2, máximo 5).
- Descripción narrativa de la cadena (máx. 200 chars).
- Nivel de riesgo: `'CRÍTICO' | 'MODERADO' | 'BAJO'`.
- Recomendación de atención estratégica (máx. 100 chars).

---

## Detección automática de sesgos

Antes de cerrar la Etapa 5, PESTEL ejecuta una verificación de sesgos
y reporta al usuario. Esta verificación es **obligatoria y no se puede
omitir**.

Sesgos que PESTEL debe detectar y reportar:

| Tipo de sesgo | Condición de detección |
|---------------|----------------------|
| Sesgo urbano | > 70% de fuentes son de zonas metropolitanas |
| Sesgo etario digital | > 60% de datos sociales vienen de redes sociales sin complemento de campo |
| Sesgo de disponibilidad | Una dimensión tiene > 80% de su peso en un solo evento reciente |
| Datos oficiales vs. percepción | Indicadores oficiales contradicen datos de percepción ciudadana |
| Cobertura insuficiente | Alguna dimensión tiene nivel de confianza < 40% |

Cada sesgo detectado genera una alerta visible que el analista debe
reconocer explícitamente antes de avanzar a la Etapa 6.

---

## Indicador de confianza global

Además del confianza por dimensión, PESTEL calcula un indicador de
confianza global del análisis:

```
confianza_global = promedio ponderado de confianza por dimensión
                  (ponderado por el peso asignado a cada variable en Etapa 3)
```

Umbrales de interpretación:
- 75-100: Análisis sólido. Proceder con confianza.
- 50-74: Análisis parcial. Se recomienda complementar fuentes antes de
  tomar decisiones estratégicas.
- < 50: Análisis insuficiente. PESTEL bloquea el avance a la Etapa 6
  y solicita incorporar más datos en la Etapa 4.

---

## Estado persistido al completar esta etapa

```typescript
type PestlAnalysis = {
  projectId: string;
  version: number;         // incrementa cada vez que se re-analiza
  analyzedAt: Date;
  globalConfidence: number;
  dimensions: DimensionAnalysis[];
  impactChains: ImpactChain[];
  biasAlerts: BiasAlert[];
  status: 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED';
}

type DimensionAnalysis = {
  code: 'P' | 'E' | 'S' | 'T' | 'L';
  trend: 'ASCENDENTE' | 'DESCENDENTE' | 'ESTABLE';
  intensity: 'ALTA' | 'MEDIA' | 'BAJA';
  mainSignal: string;
  narrative: string;
  classification: 'OPORTUNIDAD' | 'AMENAZA' | 'NEUTRAL';
  confidence: number;
  humanAdjustment?: HumanAdjustment;  // se llena en Etapa 6
}

type ImpactChain = {
  dimensions: ('P' | 'E' | 'S' | 'T' | 'L')[];
  description: string;
  riskLevel: 'CRÍTICO' | 'MODERADO' | 'BAJO';
  recommendation: string;
}

type BiasAlert = {
  type: string;
  description: string;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}
```

---

## Consideraciones de implementación

- Usar `claude-sonnet-4-6` como modelo de análisis principal.
- Las llamadas a la API deben hacerse por dimensión (5 llamadas
  paralelas), no en una sola llamada para todo el PEST-L. Esto mejora
  la calidad y permite mostrar resultados progresivamente.
- El análisis cruzado es una 6ª llamada, posterior a las 5 dimensionales.
- Implementar reintentos automáticos con backoff exponencial.
- Cachear los resultados por versión del análisis — no re-analizar si
  los datos no cambiaron.
