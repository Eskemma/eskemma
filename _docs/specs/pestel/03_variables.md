# Spec — Etapa 3: Selección y personalización de variables PEST-L

## Propósito de esta etapa

Es el corazón metodológico de PESTEL. Define exactamente qué se va a
medir en el análisis. La pantalla se presenta como una configuración
modular con las cinco dimensiones PEST-L desplegables. El usuario puede
aceptar las sugerencias de PESTEL o personalizar completamente.

---

## Variables por defecto según tipo de proyecto

### Tipo ELECTORAL

| Dimensión | Variables por defecto |
|-----------|----------------------|
| P — Político | Aprobación presidencial, correlación de fuerzas, polarización política, voto histórico de la circunscripción |
| E — Económico | Inflación percibida, desempleo, economía informal, satisfacción económica ciudadana |
| S — Social | Agenda ciudadana dominante, inseguridad, flujos migratorios, malestar social |
| T — Tecnológico | Penetración de plataformas digitales por segmento etario, desinformación activa en redes |
| L — Legal/Ambiental | Normativa electoral aplicable, topes de gasto de campaña, regulación de medios en período electoral, eventos ambientales recientes con impacto político |

### Tipo GUBERNAMENTAL

| Dimensión | Variables por defecto |
|-----------|----------------------|
| P — Político | Aprobación de gestión, relación ejecutivo-legislatura, correlación de fuerzas, conflictividad política |
| E — Económico | Ejecución presupuestal, crecimiento económico local, empleo formal, recaudación |
| S — Social | Conflictos socioambientales, percepción de servicios públicos, demandas ciudadanas activas |
| T — Tecnológico | Adopción de gobierno digital, penetración internet en el territorio, narrativas en redes sobre la gestión |
| L — Legal/Ambiental | Reformas legales en curso, cumplimiento de normativa ambiental, litigios activos contra el gobierno |

### Tipo LEGISLATIVO

| Dimensión | Variables por defecto |
|-----------|----------------------|
| P — Político | Composición legislativa, alianzas y coaliciones, agenda legislativa activa |
| E — Económico | Proyectos de ley con impacto económico, presupuesto en discusión |
| S — Social | Demandas ciudadanas en agenda, grupos de presión activos |
| T — Tecnológico | Proyectos de regulación digital, debate legislativo en redes |
| L — Legal/Ambiental | Iniciativas ambientales, reformas constitucionales en proceso |

### Tipo CIUDADANO

| Dimensión | Variables por defecto |
|-----------|----------------------|
| P — Político | Actores políticos aliados y adversarios, nivel de reconocimiento del movimiento |
| E — Económico | Condición socioeconómica de la base social, demandas económicas del movimiento |
| S — Social | Identidad del movimiento, narrativas dominantes, conflictos internos |
| T — Tecnológico | Organización digital del movimiento, canales de comunicación activos |
| L — Legal/Ambiental | Marco legal de protesta y organización civil, riesgos jurídicos |

---

## Personalización disponible

El usuario puede, sobre cualquier variable:

1. **Agregar** una variable nueva (texto libre + dimensión asignada).
2. **Quitar** una variable sugerida.
3. **Renombrar** una variable para adaptarla al contexto local.
4. **Asignar peso de importancia**: escala de 1 a 5 (1 = marginal, 5 = determinante). El peso afecta el scorecard de la Etapa 7.
5. **Marcar como prioritaria**: la IA la monitorea con mayor frecuencia en la Etapa 8.

---

## Indicadores por variable

Cada variable viene acompañada de:
- Indicadores cuantitativos sugeridos (al menos 1, máximo 3).
- Indicadores cualitativos sugeridos (al menos 1).
- Fuente de datos recomendada (ya asignada por PESTEL, editable por el usuario).

Ejemplos para la variable "aprobación presidencial":
- Cuantitativo: porcentaje de aprobación en encuestas de opinión pública (fuente: encuestadora nacional o Latinobarómetro).
- Cualitativo: narrativa dominante sobre el presidente en medios de comunicación (fuente: monitoreo de medios).

---

## Plantillas guardadas

- Si el usuario ya tiene proyectos anteriores en PESTEL, puede cargar
  la configuración de variables de cualquier proyecto anterior como
  punto de partida.
- Las plantillas se guardan automáticamente al completar la Etapa 3.
- Las plantillas son por tipo de proyecto (no se mezclan tipos).

---

## Estado persistido al completar esta etapa

```typescript
type PestlConfig = {
  projectId: string;
  dimensions: PestlDimension[];
  templateId?: string;  // si se cargó desde plantilla
  savedAt: Date;
}

type PestlDimension = {
  code: 'P' | 'E' | 'S' | 'T' | 'L';
  variables: PestlVariable[];
}

type PestlVariable = {
  id: string;
  name: string;
  weight: 1 | 2 | 3 | 4 | 5;
  isPriority: boolean;
  isDefault: boolean;      // true si vino del preset, false si fue agregada
  indicators: Indicator[];
}

type Indicator = {
  description: string;
  type: 'QUANTITATIVE' | 'QUALITATIVE';
  dataSource: string;
  isCustom: boolean;
}
```

---

## Reglas de negocio

- Cada dimensión debe tener al menos 1 variable para avanzar a la Etapa 4.
- Si una dimensión tiene menos de 3 variables, PESTEL muestra una
  advertencia (no bloqueo): "Esta dimensión tiene cobertura limitada.
  Considera agregar más variables para un análisis robusto."
- El total de variables no debe superar 30 (para mantener la manejabilidad
  del análisis). Mostrar contador visible.
