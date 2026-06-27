# 04_CHANGELOG_COMPLIANCE.md | Eskemma
## Historial de Sesiones para INDAUTOR

**Fecha de creación:** 2026-04-10  
**Autor:** Raúl Sánchez Salgado  
**Versión:** 1.0

---

> **Nota metodológica:** Este changelog registra el historial de desarrollo de
> Eskemma organizado por sesiones de trabajo. Cada entrada documenta qué se
> construyó, qué decisiones tomó Raúl Sánchez Salgado, y cuál fue la contribución
> de la herramienta de IA (Claude Code) como asistente de codificación.

---

## Sesión 2026-04-10 — Compliance INDAUTOR + Optimización SEFIX

**Raúl:** Diseño y supervisión  
**Claude Code:** Implementación asistida

### Trabajo realizado

#### 1. Configuración del sistema de compliance

Raúl identificó la necesidad de documentar formalmente el proyecto para registro
ante INDAUTOR (Instituto Nacional del Derecho de Autor de México). Raúl diseñó
la estructura documental y supervisó la creación de todos los archivos.

**Decisión de Raúl:** Crear 5 documentos principales + documentación por módulo +
plantillas legales en `/docs/compliance/`.

**Archivos creados:**
- `docs/compliance/README.md` — índice de documentación
- `docs/compliance/00_PROYECTO.md` — descripción del proyecto
- `docs/compliance/01_ARQUITECTURA_GENERAL.md` — arquitectura y stack
- `docs/compliance/02_REGISTRO_INTERVENCIONES.md` — registro de intervención humana
- `docs/compliance/03_AUDIT_DEPENDENCIAS.md` — auditoría de dependencias y licencias
- `docs/compliance/04_CHANGELOG_COMPLIANCE.md` — este archivo
- `docs/compliance/MODULOS/moddulo.md`
- `docs/compliance/MODULOS/pestel.md`
- `docs/compliance/MODULOS/sefix.md`
- `docs/compliance/MODULOS/cursos.md`
- `docs/compliance/MODULOS/blog.md`
- `docs/compliance/LEGAL/TEMPLATE_CONTRATO.md`
- `docs/compliance/LEGAL/CHECKLIST_COLABORADORES.md`

#### 2. Optimización SEFIX — Pre-generación offline de datos históricos

**Problema identificado por Raúl:** Las consultas históricas por entidad tardaban
5-15 minutos (Estado de México: nunca terminaba). Causa raíz: lectura de ~195 archivos
CSV desde Firebase Storage en tiempo de consulta.

**Solución diseñada por Raúl:** Arquitectura de pre-generación offline inspirada en
el comportamiento del sistema Shiny original (~3s por consulta).

**Archivos creados/modificados:**
- `scripts/pregenerate-sefix.ts` — script offline de pre-generación (NUEVO)
- `lib/sefix/storage.ts` — refactorización completa (eliminado lazy-building)
- `app/api/sefix/historico-geo/route.ts` — simplificación (eliminado polling 202)
- `app/api/sefix/prewarm-entidad/route.ts` — ELIMINADO (obsoleto)
- `app/sefix/hooks/useLneHistorico.ts` — eliminado loop de polling
- `app/sefix/components/lne/HistoricoView.tsx` — eliminado estado `isBuilding`
- `.gitignore` — agregado `/data/`

**Resultado:** Consultas históricas geo: 5-15 min → 500-800ms (después de ejecutar script)

**Corrección adicional:** Raúl identificó el error TypeScript `EXTRANJERO_CACHE_KEY`
no declarado en `storage.ts` y supervisó su corrección.

---

## Sesión 2026-04-06 — Vista Histórico SEFIX en Stack React

**Raúl:** Diseño de la vista y componentes  
**Claude Code:** Implementación asistida

### Trabajo realizado

Raúl diseñó e implementó la vista "Histórico" de SEFIX dentro del Stack de Eskemma
con React (Next.js). Esto reemplazó el sistema Shiny (R) con un dashboard React nativo.

**Componentes creados:**
- Vista principal `/sefix` con GeoFilter
- Gráficas G1 (proyección anual), G2 (evolución histórica), G3 (desglose por sexo)
- Hook `useLneHistorico` para carga de datos geo-filtrados
- Integración con Firebase Storage para datos históricos

**Decisión de Raúl:** Mantener el nivel de sección electoral como mínima unidad
de análisis (consistente con la capacidad del sistema Shiny original).

---

## Sesión 2026-03-31 — App PESTEL Vinculada con F2 en Moddulo

**Raúl:** Diseño de integración PESTEL → Moddulo  
**Claude Code:** Implementación asistida

### Trabajo realizado

Raúl completó la versión 1 de la app PESTEL (Cloud Function `scrapeAndAnalyze`
vinculada con la fase de Exploración F2 de Moddulo).

**Componentes completados:**
- Cloud Function `scrapeAndAnalyze` con 4 scrapers paralelos
- Análisis PEST-L con 5 llamadas paralelas a Claude Sonnet 4.6
- Detección de sesgos determinística (sin IA)
- Integración de datos SEFIX en dimensión Política

---

## Sesiones 2026-03-24 a 2026-03-29 — PESTEL E1-E5

**Raúl:** Diseño metodológico y de producto  
**Claude Code:** Implementación asistida

### Trabajo realizado (resumen)

Serie de sesiones donde Raúl diseñó e implementó las etapas E1 a E5 de PESTEL:

| Fecha | Sprint | Resultado |
|-------|--------|-----------|
| 26-03-24 | Fase 0 Centinela | Base del hub Centinela, homepage fixes |
| 26-03-25 | PESTEL F1+F2 | Scraping + clasificación PEST-L completados |
| 26-03-26 | PESTEL F3 inicio | 1ª versión UI dashboard PESTEL |
| 26-03-27 | PESTEL F3 cont. | Hub multi-territorio + página análisis individual |
| 26-03-27 | PESTEL rediseño E1-E5 | Rediseño completo alineado con specs |
| 26-03-28 | PESTEL correcciones | Persistencia análisis, integración SEFIX, accesibilidad |
| 26-03-29 | PESTEL E6-E8 avance | Avance en etapas de interpretación |

**Decisiones metodológicas clave de Raúl en este período:**
- Adaptación de PEST-L al contexto político mexicano (LGIPE, INE, LGIPE)
- Detección de sesgos determinística (rechazó propuesta de usar Claude)
- Arquitectura fire-and-forget con polling para superar límites de Vercel
- Human-in-the-loop obligatorio en E6

---

## Sesiones anteriores (~2024 – 2026-03)

### Inicialización del proyecto

Raúl inició Eskemma como monorepo Next.js con App Router. Las decisiones
arquitectónicas fundacionales documentadas en `01_ARQUITECTURA_GENERAL.md`
(DA-1 a DA-8) fueron tomadas en este período.

### Sprint de autenticación

Raúl diseñó el flujo de autenticación con session cookies HTTP-only y corrigió
la vulnerabilidad inicial donde el token JWT se almacenaba en memoria del cliente.

### Sprint de design system

Raúl diseñó la paleta completa (9 tokens de color con escala -10 a -90) y la
tipografía (Arimo, PT Sans, Philosopher) del brand de Eskemma.

### Sprint de Moddulo

Raúl diseñó las 9 fases secuenciales de Moddulo y la arquitectura de chat con
streaming SSE. El módulo se completó y está activo en producción.

### Sprint de accesibilidad

Raúl auditó los componentes y estableció WCAG AA como requisito no negociable.
Creó los hooks `useFocusTrap` y `useEscapeKey`.

### Sprint de Cloud Functions

Raúl decidió mover el procesamiento de IA de PESTEL a Cloud Functions Gen2
para superar los límites de timeout de Vercel.

### Auditoría de seguridad API routes

Raúl revisó los ~39 API routes y añadió `getSessionFromRequest()` en todos los
que faltaban verificación de sesión.

---

## Pendientes de Documentar

| Sesión | Trabajo | Estado |
|--------|---------|--------|
| 2026-04-10 | Ejecución del script `pregenerate-sefix.ts` | ⏳ Pendiente |
| Futuras | E6 PESTEL (interpretación + drag-drop) | ⏳ No iniciado |
| Futuras | E7 PESTEL (informes) | ⏳ No iniciado |
| Futuras | E8 PESTEL (monitoreo + alertas) | ⏳ No iniciado |
| Futuras | Integración PESTEL → Moddulo F2 | ⏳ No iniciado |

---

*Documento generado bajo supervisión de Raúl Sánchez Salgado — 2026-04-10*
