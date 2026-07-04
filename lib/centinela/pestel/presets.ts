// lib/centinela/pestel/presets.ts
// Default PEST-L variable presets by project type.
// Source of truth: _docs/specs/pestel/03_variables.md

import type { TipoProyecto, PestlDimensionConfig } from "@/types/pestel.types";

type PresetMap = Record<TipoProyecto, PestlDimensionConfig[]>;

export const PESTL_PRESETS: PresetMap = {
  electoral: [
    {
      code: "P",
      variables: [
        {
          id: "p-electoral-01",
          name: "Aprobación presidencial",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Porcentaje de aprobación en encuestas de opinión pública",
              type: "QUANTITATIVE",
              dataSource: "Encuestadora nacional o Latinobarómetro",
              isCustom: false,
            },
            {
              description: "Narrativa dominante sobre el presidente en medios",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de medios",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-electoral-02",
          name: "Correlación de fuerzas",
          weight: 4,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Distribución de escaños legislativos por partido",
              type: "QUANTITATIVE",
              dataSource: "INE / Congreso local",
              isCustom: false,
            },
            {
              description: "Alianzas políticas activas y en negociación",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de prensa política",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-electoral-03",
          name: "Polarización política",
          weight: 3,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Índice de polarización en redes sociales",
              type: "QUANTITATIVE",
              dataSource: "Social listening / Brandwatch",
              isCustom: false,
            },
            {
              description: "Tono editorial de medios según alineación política",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de medios",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-electoral-04",
          name: "Voto histórico de la circunscripción",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Resultados electorales últimas 3 elecciones",
              type: "QUANTITATIVE",
              dataSource: "INE / PREP histórico",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "E",
      variables: [
        {
          id: "e-electoral-01",
          name: "Inflación percibida",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "INPC mensual en el territorio",
              type: "QUANTITATIVE",
              dataSource: "INEGI — INPC",
              isCustom: false,
            },
            {
              description: "Narrativa de precios en redes y medios locales",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de medios",
              isCustom: false,
            },
          ],
        },
        {
          id: "e-electoral-02",
          name: "Desempleo",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Tasa de desempleo ETOE trimestral",
              type: "QUANTITATIVE",
              dataSource: "INEGI — ETOE",
              isCustom: false,
            },
          ],
        },
        {
          id: "e-electoral-03",
          name: "Economía informal",
          weight: 2,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Porcentaje de empleo informal en el estado",
              type: "QUANTITATIVE",
              dataSource: "INEGI — ENOE",
              isCustom: false,
            },
          ],
        },
        {
          id: "e-electoral-04",
          name: "Satisfacción económica ciudadana",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Índice de satisfacción con la situación económica personal",
              type: "QUANTITATIVE",
              dataSource: "Latinobarómetro / encuesta propia",
              isCustom: false,
            },
            {
              description: "Sentimiento ciudadano sobre la economía en redes",
              type: "QUALITATIVE",
              dataSource: "Social listening",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "S",
      variables: [
        {
          id: "s-electoral-01",
          name: "Agenda ciudadana dominante",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Temas más mencionados en redes en el territorio",
              type: "QUANTITATIVE",
              dataSource: "Social listening / Google Trends",
              isCustom: false,
            },
            {
              description: "Demandas ciudadanas en medios locales",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de medios locales",
              isCustom: false,
            },
          ],
        },
        {
          id: "s-electoral-02",
          name: "Inseguridad",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Tasa de incidencia delictiva por 100k hab.",
              type: "QUANTITATIVE",
              dataSource: "SESNSP",
              isCustom: false,
            },
            {
              description: "Percepción de inseguridad en encuestas ENVIPE",
              type: "QUANTITATIVE",
              dataSource: "INEGI — ENVIPE",
              isCustom: false,
            },
          ],
        },
        {
          id: "s-electoral-03",
          name: "Flujos migratorios",
          weight: 2,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Volumen de migración interna y externa",
              type: "QUANTITATIVE",
              dataSource: "INEGI / CONAPO",
              isCustom: false,
            },
          ],
        },
        {
          id: "s-electoral-04",
          name: "Malestar social",
          weight: 4,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Número de protestas y manifestaciones registradas",
              type: "QUANTITATIVE",
              dataSource: "Monitoreo de medios",
              isCustom: false,
            },
            {
              description: "Tono emocional de conversación en redes",
              type: "QUALITATIVE",
              dataSource: "Social listening",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "T",
      variables: [
        {
          id: "t-electoral-01",
          name: "Penetración de plataformas digitales por segmento etario",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "% de uso de redes sociales por grupos de edad en el territorio",
              type: "QUANTITATIVE",
              dataSource: "ENDUTIH — INEGI",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-electoral-02",
          name: "Desinformación activa en redes",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Volumen de narrativas falsas sobre el territorio o campaña",
              type: "QUANTITATIVE",
              dataSource: "Social listening / Brandwatch",
              isCustom: false,
            },
            {
              description: "Análisis cualitativo de campañas de desinformación activas",
              type: "QUALITATIVE",
              dataSource: "Monitoreo especializado",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-electoral-03",
          name: "Identificación de contenidos sintéticos",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Casos reportados de deepfakes, bots o desinformación generada por IA",
              type: "QUANTITATIVE",
              dataSource: "Monitoreo especializado / medios",
              isCustom: false,
            },
            {
              description: "Cobertura mediática sobre uso de IA en el contexto electoral",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de prensa",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "Ec",
      variables: [
        {
          id: "ec-electoral-01",
          name: "Eventos ambientales con impacto político",
          weight: 2,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Desastres naturales, sequías, inundaciones en el territorio",
              type: "QUALITATIVE",
              dataSource: "CENAPRED / Protección Civil",
              isCustom: false,
            },
          ],
        },
        {
          id: "ec-electoral-02",
          name: "Agenda ambiental de los candidatos",
          weight: 2,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Propuestas ambientales en plataformas electorales",
              type: "QUALITATIVE",
              dataSource: "Plataformas partidistas / declaraciones",
              isCustom: false,
            },
          ],
        },
        {
          id: "ec-electoral-03",
          name: "Riesgo de desastres naturales durante la campaña",
          weight: 2,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Temporadas de riesgo (huracanes, lluvias, sequías) que coinciden con el calendario electoral",
              type: "QUALITATIVE",
              dataSource: "CENAPRED / SMN / Atlas de Riesgo",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "L",
      variables: [
        {
          id: "l-electoral-01",
          name: "Normativa electoral aplicable",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Cambios normativos del INE/OPLE aplicables al proceso",
              type: "QUALITATIVE",
              dataSource: "DOF / Diario Oficial del estado",
              isCustom: false,
            },
          ],
        },
        {
          id: "l-electoral-02",
          name: "Topes de gasto de campaña",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Topes oficiales publicados por INE/OPLE",
              type: "QUANTITATIVE",
              dataSource: "INE / OPLE local",
              isCustom: false,
            },
          ],
        },
        {
          id: "l-electoral-03",
          name: "Regulación de medios en período electoral",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Restricciones de publicidad en período de veda",
              type: "QUALITATIVE",
              dataSource: "DOF / resoluciones INE",
              isCustom: false,
            },
          ],
        },
      ],
    },
  ],

  gubernamental: [
    {
      code: "P",
      variables: [
        {
          id: "p-gub-01",
          name: "Aprobación de gestión",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Nivel de aprobación del gobierno en encuestas",
              type: "QUANTITATIVE",
              dataSource: "Encuestadora / Latinobarómetro",
              isCustom: false,
            },
            {
              description: "Narrativa sobre la gestión en medios y redes",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de medios",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-gub-02",
          name: "Relación ejecutivo-legislatura",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Tasa de aprobación de iniciativas del ejecutivo",
              type: "QUANTITATIVE",
              dataSource: "Congreso local / Cámara",
              isCustom: false,
            },
            {
              description: "Tensiones y alianzas reportadas en prensa política",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de prensa",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-gub-03",
          name: "Correlación de fuerzas",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Composición de órganos legislativos y de representación",
              type: "QUANTITATIVE",
              dataSource: "INE / Congreso",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-gub-04",
          name: "Conflictividad política",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Número de conflictos políticos activos reportados",
              type: "QUANTITATIVE",
              dataSource: "Monitoreo de medios",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "E",
      variables: [
        {
          id: "e-gub-01",
          name: "Ejecución presupuestal",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "% del presupuesto ejecutado vs aprobado",
              type: "QUANTITATIVE",
              dataSource: "Secretaría de Finanzas / SHCP",
              isCustom: false,
            },
          ],
        },
        {
          id: "e-gub-02",
          name: "Crecimiento económico local",
          weight: 4,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "PIB estatal o municipal (disponible trimestral/anual)",
              type: "QUANTITATIVE",
              dataSource: "INEGI — SCNM",
              isCustom: false,
            },
          ],
        },
        {
          id: "e-gub-03",
          name: "Empleo formal",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Trabajadores registrados ante el IMSS",
              type: "QUANTITATIVE",
              dataSource: "IMSS",
              isCustom: false,
            },
          ],
        },
        {
          id: "e-gub-04",
          name: "Recaudación",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Ingresos fiscales del gobierno vs meta",
              type: "QUANTITATIVE",
              dataSource: "Secretaría de Finanzas / SAT",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "S",
      variables: [
        {
          id: "s-gub-01",
          name: "Conflictos socioambientales",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Número de conflictos activos documentados",
              type: "QUANTITATIVE",
              dataSource: "OEIDRUS / Monitoreo de medios",
              isCustom: false,
            },
          ],
        },
        {
          id: "s-gub-02",
          name: "Percepción de servicios públicos",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Satisfacción con servicios públicos en encuestas",
              type: "QUANTITATIVE",
              dataSource: "ENCIG — INEGI",
              isCustom: false,
            },
            {
              description: "Quejas y reclamos en redes sobre servicios",
              type: "QUALITATIVE",
              dataSource: "Social listening",
              isCustom: false,
            },
          ],
        },
        {
          id: "s-gub-03",
          name: "Demandas ciudadanas activas",
          weight: 4,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Temas de demanda ciudadana en agenda pública",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de medios y redes",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "T",
      variables: [
        {
          id: "t-gub-01",
          name: "Adopción de gobierno digital",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "% de trámites realizados en línea",
              type: "QUANTITATIVE",
              dataSource: "Secretaría de Innovación Gubernamental",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-gub-02",
          name: "Penetración de internet en el territorio",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "% de hogares con acceso a internet",
              type: "QUANTITATIVE",
              dataSource: "ENDUTIH — INEGI",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-gub-03",
          name: "Narrativas en redes sobre la gestión",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Volumen y sentimiento de menciones de la gestión en redes",
              type: "QUANTITATIVE",
              dataSource: "Social listening",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-gub-04",
          name: "Identificación de contenidos sintéticos",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Casos reportados de deepfakes o desinformación por IA sobre la gestión",
              type: "QUANTITATIVE",
              dataSource: "Monitoreo especializado / medios",
              isCustom: false,
            },
            {
              description: "Cobertura mediática sobre uso de IA en el contexto gubernamental",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de prensa",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "Ec",
      variables: [
        {
          id: "ec-gub-01",
          name: "Cumplimiento de normativa ambiental",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Auditorías ambientales y resultados de cumplimiento",
              type: "QUALITATIVE",
              dataSource: "SEMARNAT / PROFEPA",
              isCustom: false,
            },
          ],
        },
        {
          id: "ec-gub-02",
          name: "Conflictos ambientales en el territorio",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Conflictos por agua, tierra o contaminación activos",
              type: "QUALITATIVE",
              dataSource: "SEMARNAT / Monitoreo de medios",
              isCustom: false,
            },
          ],
        },
        {
          id: "ec-gub-03",
          name: "Inversión en infraestructura verde y resiliencia",
          weight: 2,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Proyectos de infraestructura climática y sostenibilidad en ejecución",
              type: "QUALITATIVE",
              dataSource: "SEMARNAT / Secretaría de Obras",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "L",
      variables: [
        {
          id: "l-gub-01",
          name: "Reformas legales en curso",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Iniciativas de ley que afectan el ámbito de gobierno",
              type: "QUALITATIVE",
              dataSource: "DOF / Congreso local",
              isCustom: false,
            },
          ],
        },
        {
          id: "l-gub-02",
          name: "Litigios activos contra el gobierno",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Número de amparos y demandas activas",
              type: "QUANTITATIVE",
              dataSource: "Poder Judicial / Suprema Corte",
              isCustom: false,
            },
          ],
        },
        {
          id: "l-gub-03",
          name: "Marco normativo de las políticas prioritarias",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Leyes, decretos y reglamentos que habilitan o limitan las políticas de gobierno",
              type: "QUALITATIVE",
              dataSource: "DOF / Congreso local",
              isCustom: false,
            },
          ],
        },
      ],
    },
  ],

  legislativo: [
    {
      code: "P",
      variables: [
        {
          id: "p-leg-01",
          name: "Composición legislativa",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Distribución de escaños por partido en el congreso",
              type: "QUANTITATIVE",
              dataSource: "Congreso local / Cámara",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-leg-02",
          name: "Alianzas y coaliciones",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Acuerdos de votación en bloque documentados",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de prensa legislativa",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-leg-03",
          name: "Agenda legislativa activa",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Iniciativas en proceso por etapa legislativa",
              type: "QUANTITATIVE",
              dataSource: "Sistema de seguimiento legislativo",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "E",
      variables: [
        {
          id: "e-leg-01",
          name: "Proyectos de ley con impacto económico",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Iniciativas con evaluación de impacto regulatorio",
              type: "QUALITATIVE",
              dataSource: "Congreso / COFECE / Banxico",
              isCustom: false,
            },
          ],
        },
        {
          id: "e-leg-02",
          name: "Presupuesto en discusión",
          weight: 4,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Estado de discusión del PEF / presupuesto local",
              type: "QUALITATIVE",
              dataSource: "SHCP / Congreso",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "S",
      variables: [
        {
          id: "s-leg-01",
          name: "Demandas ciudadanas en agenda",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Peticiones ciudadanas vinculadas a iniciativas en proceso",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de medios y peticiones públicas",
              isCustom: false,
            },
          ],
        },
        {
          id: "s-leg-02",
          name: "Grupos de presión activos",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Organizaciones y empresas ejerciendo lobbying activo",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de prensa y declaraciones",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "T",
      variables: [
        {
          id: "t-leg-01",
          name: "Proyectos de regulación digital",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Iniciativas de regulación de plataformas, IA, datos",
              type: "QUALITATIVE",
              dataSource: "Congreso / DOF",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-leg-02",
          name: "Debate legislativo en redes",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Volumen y sentimiento del debate legislativo en redes",
              type: "QUANTITATIVE",
              dataSource: "Social listening",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-leg-03",
          name: "Identificación de contenidos sintéticos",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Casos reportados de deepfakes o desinformación por IA en el debate legislativo",
              type: "QUANTITATIVE",
              dataSource: "Monitoreo especializado / medios",
              isCustom: false,
            },
            {
              description: "Proyectos legislativos o debates sobre regulación de IA y contenido sintético",
              type: "QUALITATIVE",
              dataSource: "Gaceta legislativa / medios",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "Ec",
      variables: [
        {
          id: "ec-leg-01",
          name: "Iniciativas ambientales en agenda",
          weight: 4,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Proyectos de ley de carácter ambiental en discusión",
              type: "QUALITATIVE",
              dataSource: "Congreso / SEMARNAT",
              isCustom: false,
            },
          ],
        },
        {
          id: "ec-leg-02",
          name: "Presión de grupos ambientalistas en el congreso",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Organizaciones ambientales ejerciendo lobbying activo",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de prensa y declaraciones",
              isCustom: false,
            },
          ],
        },
        {
          id: "ec-leg-03",
          name: "Legislación ambiental aplicable al territorio",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Leyes federales y locales de medio ambiente vigentes que impactan la agenda",
              type: "QUALITATIVE",
              dataSource: "DOF / SEMARNAT / Congreso local",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "L",
      variables: [
        {
          id: "l-leg-01",
          name: "Reformas constitucionales en proceso",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Iniciativas de reforma constitucional y su estado",
              type: "QUALITATIVE",
              dataSource: "Congreso / Suprema Corte",
              isCustom: false,
            },
          ],
        },
        {
          id: "l-leg-02",
          name: "Marco regulatorio aplicable a la bancada",
          weight: 4,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Normativa interna del congreso y reglamentos legislativos",
              type: "QUALITATIVE",
              dataSource: "Congreso local / DOF",
              isCustom: false,
            },
          ],
        },
        {
          id: "l-leg-03",
          name: "Litigios o amparos contra iniciativas clave",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Recursos judiciales interpuestos contra iniciativas de la bancada",
              type: "QUALITATIVE",
              dataSource: "Poder Judicial / Suprema Corte",
              isCustom: false,
            },
          ],
        },
      ],
    },
  ],

  ciudadano: [
    {
      code: "P",
      variables: [
        {
          id: "p-ciu-01",
          name: "Actores políticos aliados y adversarios",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Mapa de alianzas y oposiciones políticas del movimiento",
              type: "QUALITATIVE",
              dataSource: "Declaraciones públicas / prensa",
              isCustom: false,
            },
          ],
        },
        {
          id: "p-ciu-02",
          name: "Nivel de reconocimiento del movimiento",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Menciones del movimiento en medios nacionales y locales",
              type: "QUANTITATIVE",
              dataSource: "Monitoreo de medios",
              isCustom: false,
            },
            {
              description: "Percepciones sobre el movimiento en redes",
              type: "QUALITATIVE",
              dataSource: "Social listening",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "E",
      variables: [
        {
          id: "e-ciu-01",
          name: "Condición socioeconómica de la base social",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Indicadores de pobreza y marginación en zonas de influencia",
              type: "QUANTITATIVE",
              dataSource: "CONEVAL / INEGI",
              isCustom: false,
            },
          ],
        },
        {
          id: "e-ciu-02",
          name: "Demandas económicas del movimiento",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Demandas económicas explícitas del movimiento",
              type: "QUALITATIVE",
              dataSource: "Documentos del movimiento / prensa",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "S",
      variables: [
        {
          id: "s-ciu-01",
          name: "Identidad del movimiento",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Elementos identitarios: narrativa, símbolos, demandas centrales",
              type: "QUALITATIVE",
              dataSource: "Documentos internos / análisis comunicacional",
              isCustom: false,
            },
          ],
        },
        {
          id: "s-ciu-02",
          name: "Narrativas dominantes",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Temas y marcos más usados en la comunicación del movimiento",
              type: "QUALITATIVE",
              dataSource: "Análisis de mensajes / redes",
              isCustom: false,
            },
          ],
        },
        {
          id: "s-ciu-03",
          name: "Conflictos internos",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Tensiones y fracturas documentadas dentro del movimiento",
              type: "QUALITATIVE",
              dataSource: "Observación directa / prensa",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "T",
      variables: [
        {
          id: "t-ciu-01",
          name: "Organización digital del movimiento",
          weight: 4,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Plataformas digitales usadas y nivel de actividad",
              type: "QUANTITATIVE",
              dataSource: "Análisis de redes del movimiento",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-ciu-02",
          name: "Canales de comunicación activos",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Canales utilizados (WhatsApp, Telegram, medios propios)",
              type: "QUALITATIVE",
              dataSource: "Inventario de comunicación del movimiento",
              isCustom: false,
            },
          ],
        },
        {
          id: "t-ciu-03",
          name: "Identificación de contenidos sintéticos",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Casos de deepfakes o desinformación por IA que afecten al movimiento",
              type: "QUANTITATIVE",
              dataSource: "Monitoreo especializado / medios",
              isCustom: false,
            },
            {
              description: "Percepción ciudadana sobre uso de IA en procesos de participación",
              type: "QUALITATIVE",
              dataSource: "Encuestas / grupos focales",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "Ec",
      variables: [
        {
          id: "ec-ciu-01",
          name: "Reivindicaciones ambientales del movimiento",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Demandas ambientales en el pliego del movimiento",
              type: "QUALITATIVE",
              dataSource: "Documentos del movimiento / prensa",
              isCustom: false,
            },
          ],
        },
        {
          id: "ec-ciu-02",
          name: "Impacto ambiental del conflicto central",
          weight: 3,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Factores ambientales que motivan o contextualizan el movimiento",
              type: "QUALITATIVE",
              dataSource: "CENAPRED / Monitoreo de medios",
              isCustom: false,
            },
          ],
        },
        {
          id: "ec-ciu-03",
          name: "Alianzas con organizaciones ambientalistas",
          weight: 2,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Grupos ecologistas que apoyan o se oponen al movimiento",
              type: "QUALITATIVE",
              dataSource: "Monitoreo de medios / declaraciones",
              isCustom: false,
            },
          ],
        },
      ],
    },
    {
      code: "L",
      variables: [
        {
          id: "l-ciu-01",
          name: "Marco legal de protesta y organización civil",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Leyes de reunión, asociación y protesta aplicables",
              type: "QUALITATIVE",
              dataSource: "DOF / Constitución / leyes locales",
              isCustom: false,
            },
          ],
        },
        {
          id: "l-ciu-02",
          name: "Riesgos jurídicos",
          weight: 5,
          isPriority: true,
          isDefault: true,
          indicators: [
            {
              description: "Procesos legales activos contra integrantes del movimiento",
              type: "QUALITATIVE",
              dataSource: "Poder Judicial / prensa",
              isCustom: false,
            },
          ],
        },
        {
          id: "l-ciu-03",
          name: "Jurisprudencia favorable o adversa reciente",
          weight: 4,
          isPriority: false,
          isDefault: true,
          indicators: [
            {
              description: "Criterios judiciales recientes que afectan derechos de protesta y organización",
              type: "QUALITATIVE",
              dataSource: "Suprema Corte / Poder Judicial / prensa especializada",
              isCustom: false,
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Returns a deep copy of the preset for the given project type.
 * Variables are cloned so mutations in the wizard do not affect the preset.
 */
export function getPreset(tipo: TipoProyecto): PestlDimensionConfig[] {
  return JSON.parse(JSON.stringify(PESTL_PRESETS[tipo])) as PestlDimensionConfig[];
}
