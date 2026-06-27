# Sefix — Technical Brief: APIs y roadmap Next.js

> **Alcance:** Este documento cubre el lado **Next.js/API** de la integración Sefix en Eskemma.
> Para el desarrollo del app Shiny en R, ver: [`sefix-shiny-brief.md`](./sefix-shiny-brief.md)
> Última actualización: 2026-03-18

---

## 1. Estado actual de la integración Sefix ↔ Moddulo

### APIs construidas (ya en producción en `feature/session-cookies`)

```
GET /api/sefix/resultados?estado={estado}&cargo={cargo}&anio={anio}
GET /api/sefix/padron?estado={estado}
```

**Utilidad central:** `lib/sefix/storage.ts`
- Streaming de CSV desde Firebase Storage (sin cargar el archivo completo en memoria)
- Caché en memoria con TTL de 30 minutos por query
- Normalización de nombres de estado (acepta variantes con/sin acento, abreviaciones)

**Integración activa en Moddulo:**
- F2 Exploración detecta el estado mexicano desde el XPCTO del proyecto
- Carga automática de resultados electorales + padrón al entrar a la sección Político
- Widget compacto en el formulario: LNE, padrón H/M, top partidos
- Datos inyectados en `xpctoContext` → Claude los usa en el análisis PEST-L

---

## 2. Datos disponibles en Firebase Storage

**Bucket:** `eskemma-3c4c3.firebasestorage.app`

### 2.1 Resultados electorales federales

**Ruta:** `sefix/results/federals/pef_{cargo}_{año}.csv`

| Cargo | Clave | Años disponibles |
|-------|-------|-----------------|
| Diputados federales | `dip` | 2006, 2009, 2012, 2015, 2018, 2021, 2024 |
| Senadores | `sen` | 2006, 2012, 2018, 2021, 2023, 2024 |
| Presidente | `pdte` | 2006, 2012, 2018, 2024 |

**Esquema de columnas (archivo tipo `pef_sen_2024.csv`):**
```
id, anio, cve_ambito, ambito, cve_cargo, cargo, cve_principio, principio,
cve_tipo, tipo, cve_circunscripcion, circunscripcion, cve_estado, estado,
cve_def, cabecera, cve_mun, municipio, seccion,
PAN, PRI, PRD, PVEM, PT, MC, MORENA,
PAN_PRI_PRD, PAN_PRI, PAN_PRD, PRI_PRD, PVEM_PT_MORENA, PVEM_PT, PVEM_MORENA, PT_MORENA,
no_reg, vot_nul, total_votos, lne, part_ciud
```

- **Granularidad:** por sección electoral (≈68,000 filas/archivo)
- **Geografía:** `cve_estado` (1–32), `estado` (nombre uppercase), `cve_def` (distrito), `cve_mun`, `municipio`, `seccion`
- **Partidos:** columnas individuales (PAN, PRI, etc.) + coaliciones (PAN_PRI_PRD, etc.)
- `lne`: Lista Nominal Electoral de esa sección
- `part_ciud`: porcentaje de participación ciudadana pre-calculado por sección

### 2.2 Padrón Electoral y Lista Nominal Histórico

**Ruta:** `sefix/pdln/historico/derfe_pdln_{YYYYMMDD}_base.csv`

- **Volumen:** 91 archivos, snapshots mensuales desde ~2007 hasta julio 2025
- **Granularidad:** por sección electoral

**Esquema de columnas:**
```
cve_entidad, nombre_entidad, cve_distrito, cabecera_distrital,
cve_municipio, nombre_municipio, seccion,
padron_nacional_hombres, padron_nacional_mujeres, padron_nacional_no_binario, padron_nacional,
padron_extranjero_hombres, padron_extranjero_mujeres, padron_extranjero_no_binario, padron_extranjero,
lista_nacional_hombres, lista_nacional_mujeres, lista_nacional_no_binario, lista_nacional,
lista_extranjero_hombres, lista_extranjero_mujeres, lista_extranjero_no_binario, lista_extranjero
```

### 2.3 Padrón Electoral y Lista Nominal Semanal

**Ruta base:** `sefix/pdln/semanal/derfe_pdln_{YYYYMMDD}_{tipo}.csv`

**Tres variantes por fecha:**

| Tipo | Archivo | Contenido |
|------|---------|-----------|
| `_sexo` | `..._sexo.csv` | Padrón/LNE por sexo (H/M/NB) por sección |
| `_edad` | `..._edad.csv` | Padrón/LNE por cohortes de edad (18, 19, 20-24, 25-29... 65+) |
| `_origen` | `..._origen.csv` | Padrón por estado de origen (pad_jalisco, pad_cdmx, etc.) |

- **Volumen:** 106 archivos totales, actualizaciones semanales enero–16 oct 2025
- **Archivo más reciente:** `derfe_pdln_20251016_*.csv`

**Esquema `_sexo` (el más usado en Moddulo):**
```
cve_entidad, nombre_entidad, cve_distrito, cabecera_distrital,
cve_municipio, nombre_municipio, seccion,
padron_hombres, padron_mujeres, padron_no_binario, padron_electoral,
lista_hombres, lista_mujeres, lista_no_binario, lista_nominal
```

---

## 3. Gap actual — Lo que falta para un análisis completo

| Gap | Estado | Impacto en Moddulo |
|-----|--------|-------------------|
| **Solo datos federales** — no estatales/locales | Pendiente exportar desde Shiny | F2 político da contexto federal; la dinámica local (regidores, presidentes municipales) no está disponible |
| **Sin datos de encuestas** | No aplica (requiere fuente externa) | Brecha anotada en `__brechas` del análisis PEST-L |
| **Sin datos de gasto de campaña** | Pendiente (COFIPE/INE reportes públicos) | Puede agregarse como fuente adicional |
| **Sin series electorales estatales** | Pendiente exportar | Para proyectos de gubernatura, diputaciones locales, presidencias municipales |

---

## 4. Roadmap: Sefix Dashboard en Next.js

La ruta `/sefix` ya existe en Eskemma como página estática. Se propone convertirla en un dashboard interactivo equivalente al de Shiny:

### 4.1 Componentes a replicar desde Shiny

| Feature Shiny | Implementación Next.js propuesta |
|--------------|----------------------------------|
| Selección de territorio (estado/municipio/sección) | `Select` con datos del INE |
| Gráfico de resultados electorales por partido | `recharts` o `Chart.js` |
| Mapa choroplético de participación/resultados | `leaflet` + GeoJSON del INEGI |
| Serie histórica padrón/LNE | Línea temporal con datos de los 91 archivos históricos |
| Comparativa hombres/mujeres en LNE | Bar chart por cohortes |
| Descarga de datos filtrados | Export CSV/Excel |

### 4.2 APIs adicionales a construir

```
GET /api/sefix/resultados/municipio?estado={estado}&municipio={mun}&cargo={cargo}&anio={anio}
GET /api/sefix/padron/historico?estado={estado}&desde={YYYY-MM}&hasta={YYYY-MM}
GET /api/sefix/padron/edad?estado={estado}&corte={fecha}
GET /api/sefix/territorios  → lista de estados/municipios/secciones disponibles
```

### 4.3 Arquitectura sugerida

```
app/sefix/
  page.tsx                 — Dashboard principal (server component con suspense)
  components/
    TerritorySelector.tsx  — Selector jerárquico estado → municipio → sección
    ResultadosChart.tsx    — Bar chart de resultados electorales
    PadronChart.tsx        — Serie temporal + breakdown demográfico
    MapView.tsx            — Mapa choroplético (optional, Leaflet)
  hooks/
    useSefixResultados.ts  — SWR/fetch para /api/sefix/resultados
    useSefixPadron.ts      — SWR/fetch para /api/sefix/padron

app/api/sefix/
  resultados/route.ts      — ✅ Ya construido
  padron/route.ts          — ✅ Ya construido
  municipio/route.ts       — Pendiente
  historico/route.ts       — Pendiente
  territorios/route.ts     — Pendiente

lib/sefix/
  storage.ts               — ✅ Ya construido
  geo.ts                   — Pendiente: utilidades geográficas (INEGI GeoJSON)
```

---

## 5. Roadmap: Apps Centinela y su integración con Moddulo

Cada app del ecosistema Centinela sigue el mismo patrón: **datos en Firebase Storage / Firestore → API Next.js → integración en `xpctoContext` de Moddulo**.

| App | Fase de Moddulo | Datos de entrada | Output para Claude |
|-----|----------------|-------------------|--------------------|
| **Sefix** (ya parcial) | F2 Político, Social | Resultados electorales + padrón | Contexto cuantitativo del territorio |
| **Centinela de noticias** | F2 Político, Social | RSS/scraping de medios locales | Señales críticas en tiempo real |
| **Análisis SNA** | F2 Semáforo de Veto, F3 | Grafos de relaciones (personas/organizaciones) | Actores de veto con métricas de influencia |
| **Perfiles de actores/stakeholders** | F2 Político, F4 | Base de datos de actores políticos | Fichas estructuradas: posición, capacidad, historial |
| **Indicadores socioeconómicos** | F2 Social/Económico | INEGI, CONEVAL, OCDE | Brecha territorial: IDH, rezago social, empleo |
| **Análisis cluster** | F3 Investigación, F5 | Datos demográficos + electorales | Segmentación de secciones electorales |
| **Psicografía** | F5 Estrategia | Encuestas, redes sociales | Perfiles de valores y motivaciones del electorado |

### Patrón de integración con Moddulo

1. La app Centinela procesa sus datos y los almacena en Firestore o Storage
2. Moddulo lee los datos vía API interna (`/api/centinela/{fuente}`)
3. Los datos se inyectan en `xpctoContext` en la fase correspondiente
4. Claude los referencia directamente en el análisis: números, nombres, posiciones
5. El widget de la app aparece en el panel de formulario de la fase correspondiente

---

## 6. Priorización sugerida (sprints paralelos con Moddulo)

| Sprint par | App | Justificación |
|-----------|-----|--------------|
| Sprint 2 | Sefix dashboard en Next.js | Base ya construida; alta visibilidad para el consultor |
| Sprint 4 | Centinela de noticias (RSS + IA) | Señales críticas para F2 político y social |
| Sprint 6 | Perfiles de actores/stakeholders | Semáforo de Veto en F2 + F4 Diagnóstico |
| Sprint 8 | Indicadores socioeconómicos (INEGI) | F2 Social/Económico + F3 Investigación |
| Sprint 10 | Análisis SNA | F2 Semáforo + F3 redes de poder |
| Sprint 12 | Cluster + Psicografía | F5 Estrategia (requiere datos acumulados) |
