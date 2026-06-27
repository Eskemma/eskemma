# CLAUDE.md — PESTEL: Instrucciones de desarrollo

> Este archivo es la fuente de verdad para el desarrollo de PESTEL.
> Léelo completo antes de escribir cualquier código. Las decisiones aquí
> documentadas no son sugerencias: son compromisos de diseño ya validados.

---

## Qué es PESTEL

PESTEL es una aplicación web con IA para realizar análisis PEST-L
(Político, Económico, Social, Tecnológico, Legal/Ambiental) aplicados a
proyectos de comunicación política en Latinoamérica.

Su propósito es transformar un análisis estratégico que hoy se hace de
forma intuitiva e incompleta en un proceso sistemático, trazable y
potenciado por IA — sin reemplazar el juicio humano del analista.

Tipos de proyecto que soporta:
- Electoral / Campaña
- Gubernamental
- Legislativo
- Ciudadano / Movimiento social

Contexto geográfico principal: Latinoamérica (México como mercado
prioritario, escalable a toda la región).

---

## Arquitectura funcional — las 8 etapas

El flujo de PESTEL tiene 8 etapas secuenciales con retroalimentación
continua. Cada etapa tiene su spec detallada en `/docs/specs/`.

| Etapa | Nombre | Spec |
|-------|--------|------|
| 1 | Onboarding y configuración del proyecto | `/docs/specs/01_onboarding.md` |
| 2 | Definición del territorio y alcance | `/docs/specs/02_territorio.md` |
| 3 | Selección y personalización de variables PEST-L | `/docs/specs/03_variables.md` |
| 4 | Recolección de datos e integración de fuentes | `/docs/specs/04_datos.md` |
| 5 | Procesamiento IA y análisis automatizado | `/docs/specs/05_procesamiento_ia.md` |
| 6 | Interpretación y priorización estratégica | `/docs/specs/06_interpretacion.md` |
| 7 | Generación de informes y síntesis estratégica | `/docs/specs/07_informes.md` |
| 8 | Monitoreo continuo y actualización | `/docs/specs/08_monitoreo.md` |

Antes de desarrollar cualquier módulo, lee la spec correspondiente.

---

## Decisiones de diseño NO negociables

Estas decisiones ya fueron tomadas. No las cuestiones ni propongas
alternativas salvo que encuentres un impedimento técnico crítico.

### 1. El analista humano siempre valida
La IA nunca toma decisiones finales. Toda salida de IA en las Etapas 2-7
requiere validación explícita del usuario antes de avanzar. Esto es un
principio metodológico, no solo UX.

### 2. Trazabilidad completa de datos
Cada dato en el sistema debe registrar: fuente, fecha de captura y nivel
de confiabilidad. Los informes deben ser auditables. No existen datos
"sin origen" en PESTEL.

### 3. Detección de sesgos es obligatoria
La Etapa 5 incluye detección automática de sesgos (urbano, etario,
digital). La Etapa 6 incluye un "check de sesgo asistido" antes de
cerrar la interpretación. Estos no son features opcionales.

### 4. El PEST-L es una foto + un sistema vivo
El análisis inicial (Etapas 1-7) produce un estado base. La Etapa 8 lo
convierte en monitoreo continuo. El diseño de datos debe soportar
versiones temporales del análisis desde el inicio.

### 5. Modo mixto de datos por defecto
PESTEL no funciona solo con APIs ni solo con carga manual. El modo
por defecto combina ambos (automático + asistido). El diseño de la Etapa
4 debe reflejar esto siempre.

### 6. Variables PEST-L predefinidas por tipo de proyecto
Cada tipo de proyecto (electoral, gubernamental, legislativo, ciudadano)
activa un conjunto distinto de variables por defecto en la Etapa 3.
Estas variables están documentadas en `/docs/specs/03_variables.md` y no
deben ser inventadas durante el desarrollo.

---

## Principios de UX de PESTEL

- El onboarding es **conversacional**, no un formulario frío.
- Nunca mostrar un campo vacío sin una sugerencia inteligente.
- El semáforo de cobertura (verde/amarillo/rojo) aparece en la Etapa 4
  y se mantiene visible durante las Etapas 5 y 6.
- Las plantillas guardadas son un ciudadano de primera clase: siempre
  ofrecer la opción de cargar una plantilla antes de configurar desde cero.
- El usuario puede invitar colaboradores con roles diferenciados:
  analista, estratega, revisor.

---

## Stack tecnológico (decisión pendiente / propuesta)

> ⚠️ NOTA: El stack aún no está cerrado. Cuando se defina, actualizar
> esta sección y documentar aquí las decisiones con su justificación.

Propuesta inicial para discusión:
- **Frontend**: React + TypeScript
- **Backend**: Node.js / FastAPI (pendiente de decisión)
- **IA**: Anthropic API (claude-sonnet-4-6 como modelo principal)
- **Base de datos**: PostgreSQL (datos estructurados) + vector DB para
  embeddings de documentos cargados manualmente
- **Monitoreo/social listening**: integración API con Meltwater o
  Brandwatch (pendiente de contratos)

---

## Cómo trabajar con este proyecto

1. Antes de iniciar una tarea, lee la spec del módulo en `/docs/specs/`.
2. Si algo en el código contradice una spec, la spec gana. Documenta la
   discrepancia y consulta antes de resolver por tu cuenta.
3. Los nombres de las etapas y módulos son canónicos: úsalos exactamente
   como aparecen en este documento (Etapa 1, Etapa 2, etc.).
4. No inventes features. Si la spec no lo menciona, no lo desarrolles
   sin consultar primero.
5. Cuando completes una etapa, actualiza este archivo señalando el estado
   (En desarrollo / Completada / En revisión).

---

## Estado del desarrollo

| Módulo | Estado |
|--------|--------|
| Todas las etapas | ⏳ Pendiente de iniciar |

Última actualización de este archivo: 2026-03-27
