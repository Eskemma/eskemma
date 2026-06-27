# 00_PROYECTO.md | Eskemma
## Descripción del Proyecto para Registro INDAUTOR

**Fecha de creación:** 2026-04-10  
**Autor:** Raúl Sánchez Salgado  
**Versión:** 1.0

---

## Qué es Eskemma

Eskemma es una plataforma SaaS de consultoría política con inteligencia artificial,
diseñada y desarrollada por Raúl Sánchez Salgado. Está orientada a consultores políticos,
equipos de campaña, funcionarios públicos y analistas políticos en México.

La plataforma integra metodologías de análisis político con herramientas de IA para
apoyar la toma de decisiones estratégicas en procesos electorales, gubernamentales
y de gestión política.

---

## Módulos del Sistema

| Módulo | Ruta | Descripción | Estado |
|--------|------|-------------|--------|
| **Moddulo** | `/moddulo` | Gestión de proyectos políticos con IA en 9 fases secuenciales | ✅ Activo |
| **Centinela / PESTEL** | `/centinela/pestel` | Análisis PEST-L en tiempo real con IA | 🔄 En desarrollo |
| **Cursos** | `/cursos` | Talleres y cursos interactivos de consultoría | ✅ Activo |
| **SEFIX** | `/sefix` | Dashboard de estadísticas electorales y padrón nominal | ✅ Activo |
| **Blog** | `/blog` | El Baúl de Fouché — contenido editorial político | ✅ Activo |

### Moddulo
Herramienta de gestión estratégica de proyectos políticos. Raúl diseñó un flujo de
9 fases secuenciales que guían al consultor desde la definición del propósito hasta
la evaluación:

```
proposito → exploracion → investigacion → diagnostico →
estrategia → tactica → gerencia → seguimiento → evaluacion
```

Cada fase tiene un chat contextual con Claude Sonnet 4.6 vía streaming SSE. El consultor
interactúa con la IA como un asistente que conoce el proyecto completo.

### Centinela / PESTEL
Sistema de inteligencia política en tiempo real basado en la metodología PEST-L
(Político, Económico, Social, Tecnológico, Legal). Raúl diseñó un proceso de 8 etapas
donde la IA analiza fuentes de datos mixtas (automáticas + manuales) y produce
diagnósticos estructurados con detección de sesgos.

Etapas completadas: E1 (onboarding), E2 (territorio), E3 (variables), E4 (datos),
E5 (análisis IA con 5 dimensiones paralelas).  
Etapas pendientes: E6 (interpretación human-in-the-loop), E7 (informes), E8 (monitoreo).

### SEFIX
Dashboard electoral con datos del Instituto Nacional Electoral (INE). Permite
visualizar el Padrón Electoral y la Lista Nominal Estática (LNE) a nivel sección
electoral, municipal, distrital y estatal, con series históricas desde 2017.

Raúl diseñó la arquitectura de pre-generación de datos para rendimiento óptimo:
los archivos CSV del INE (~195 archivos históricos) se pre-procesan localmente y
se almacenan como JSON columnar en Firebase Storage, permitiendo consultas en
500-800ms en lugar de los 5-15 minutos del enfoque anterior.

### Cursos
Sección de capacitación con talleres interactivos sobre consultoría política,
gestión de campañas y metodologías de análisis.

### Blog — El Baúl de Fouché
Espacio editorial curado por Raúl sobre política, estrategia y análisis político
en México. Incluye sistema de comentarios y suscripciones.

---

## Audiencia Objetivo

- **Consultores políticos:** Profesionales que asesoran candidatos, partidos o funcionarios
- **Equipos de campaña:** Coordinadores y estrategas en procesos electorales activos
- **Funcionarios públicos:** Servidores públicos que requieren análisis de contexto político
- **Analistas políticos:** Investigadores y académicos con enfoque práctico

---

## Modelo de Negocio

SaaS (Software as a Service) con modelo freemium y planes por suscripción mensual:

| Plan | Precio MXN | Módulos incluidos |
|------|-----------|-------------------|
| Freemium | $0 | Blog, Redactor limitado |
| Basic | $2,899/mes | + Cursos, SEFIX |
| Premium | $5,899/mes | + Centinela (PESTEL), Moddulo |
| Professional | $9,899/mes | + API, white label |

---

## Por Qué Software Asistido por IA

Raúl tomó la decisión de integrar IA (Claude Sonnet 4.6 de Anthropic) en el núcleo
del producto por tres razones:

1. **Escala metodológica:** Las metodologías de análisis político (PEST-L, análisis
   de contexto, formulación estratégica) son complejas y requieren sistematización
   para hacerlas accesibles a equipos de diferente nivel.

2. **Personalización:** Cada proyecto político tiene características únicas de
   territorio, tipo de cargo y contexto. La IA permite adaptar el análisis sin
   necesidad de plantillas rígidas.

3. **Capacidad analítica:** El análisis de múltiples fuentes de datos (noticias,
   datos económicos, datos electorales) a la velocidad que requiere una campaña
   activa no es viable de forma manual.

En todos los casos, la IA es una **herramienta de apoyo** — no un sistema autónomo.
Raúl diseñó los flujos para que el analista humano supervise, valide y tome las
decisiones finales (principio human-in-the-loop).

---

## Cómo Se Desarrolla

- **Diseño y arquitectura:** Raúl Sánchez Salgado
- **Implementación asistida:** Claude Code (Anthropic) como herramienta de codificación
- **Supervisión y corrección:** Raúl revisa, corrige y aprueba cada implementación
- **IDE:** Antigravity con integración Claude Code
- **Control de versiones:** Git + GitHub (repositorio privado)

Todo el código es supervisado y aprobado por Raúl antes de su integración al proyecto.
Las decisiones de arquitectura, diseño de producto y metodología son exclusivamente
de autoría humana (Raúl Sánchez Salgado).

---

*Documento generado bajo supervisión de Raúl Sánchez Salgado — 2026-04-10*
