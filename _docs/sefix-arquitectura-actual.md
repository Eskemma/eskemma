# Sefix — Arquitectura actual (reporte técnico)

**Propósito de este documento:** dejar un snapshot completo y verificado del estado
real del código de Sefix (`/sefix`) — arquitectura, componentes, capa de datos,
integración con Moddulo/Centinela y mapeo con el catálogo MMEE — como insumo de
referencia para cuando se defina el alcance de una nueva pestaña dentro de Sefix
vinculada a la técnica T06 de Moddulo F3.

**Fecha de corte:** 2026-07-22.

---

## 1. Qué es Sefix hoy

Sefix es un **dashboard electoral nativo Next.js/React**, servido en la ruta pública
`/sefix`. Pese a que buena parte de la documentación existente (`CLAUDE.md`, brief de
marzo 2026) todavía lo describe como "Shiny embebido" vía iframe, **eso ya no
corresponde al código actual**: el backend R/Shiny fue reemplazado por lectura
directa de CSV/JSON pre-generados desde Firebase Storage. No hay dependencia de
`shinyapps.io` en producción (ver §10, hallazgo 1).

El acceso es libre: no hay gating de sesión ni de plan de suscripción aplicado
sobre `/sefix` ni sobre sus API routes (ver §7).

---

## 2. Rutas y páginas (`app/sefix/`)

| Archivo | Rol |
|---|---|
| `app/sefix/page.tsx` | Server Component. Metadata SEO (title/description/canonical `/sefix`). Llama `getServerSession()` y pasa `session?.role` a `SefixDashboard`, pero el componente lo recibe como `_role` — **recibido y descartado, sin uso funcional**. |
| `app/sefix/layout.tsx` | Layout mínimo: solo inyecta `<link rel="stylesheet" href="/leaflet.css">` para los mapas Leaflet de las pestañas geográficas. |
| `app/sefix/SefixDashboard.tsx` | Client Component raíz. Estado `activeTab: SefixTabId` vía `useState`. Renderiza `SefixHeroSection`, `TabNav`, y — según la tab activa — uno de: `LnePanel`, `EleccionesFedPanel`, `EleccionesLocalesPanel`, `GeoElectoralMapPanel`, `GeoEcegPanel`, o `UnderConstructionPage` para tabs marcadas como no disponibles. Cierra con `SefixFeedbackBanner`. |
| `app/sefix/SefixHeroSection.tsx` | Sección hero puramente visual (imagen de fondo + título "SEFIX"). |

No existen `loading.tsx` ni `error.tsx` adicionales en esta ruta.

---

## 3. Componentes por dominio

```
app/sefix/components/
├── TabNav.tsx                    # role="tablist", lee SEFIX_TABS; punto gris "Próximamente" en tabs no disponibles
├── LnePanel.tsx                  # delega a components/lne/
├── EleccionesFedPanel.tsx        # delega a components/elecciones/
├── EleccionesLocalesPanel.tsx    # delega a components/elecciones-locales/
├── IframePanel.tsx               # ⚠️ huérfano — no importado en ningún panel actual (ver §10)
├── SefixFeedbackBanner.tsx       # banner estático mailto:sefix@eskemma.com
│
├── geo/
│   ├── GeoElectoralMapPanel.tsx, GeoElectoralMapContent.tsx, GeoElectoralMapContentLoc.tsx
│   │     # mapa choroplético electoral (federal y local) vía Leaflet
│   └── GeoEcegPanel.tsx, GeoEcegContent.tsx, GeoEcegFilters.tsx,
│         EcegPerfilTable.tsx, EcegDynamicText.tsx
│         # panel "Estadísticos Geoelectorales" (datos ECEG/INEGI 2020)
│
├── lne/
│   ├── HistoricoView.tsx, SemanalView.tsx
│   ├── HistoricoDataTable.tsx, SemanalDataTable.tsx
│   ├── GeoFilter.tsx, DynamicTextBlock.tsx, SemanalTextBlock.tsx
│   ├── MobileFirstVisitHint.tsx
│   └── charts/
│         EdadCharts, G1TrendChart, G2BarChart, G3MultiYearChart, G3SexChart, OrigenCharts, SexoCharts
│
├── elecciones/
│   EleccionesDataTable, EleccionesDynamicText, EleccionesFedPanelContent,
│   EleccionesFilters, HistoricoComparison, HistoricoPartidos, PartidosBarChart,
│   ResultadosStatCards
│
└── elecciones-locales/
    EleccionesLocalesDataTable, EleccionesLocalesDynamicText, EleccionesLocalesFilters,
    EleccionesLocalesPanelContent, HistoricoPartidosLoc, PartidosBarChartLoc,
    ResultadosLocalesStatCards
```

**Capa de hooks** (`app/sefix/hooks/*`): cada panel se conecta a su endpoint vía un
hook dedicado — `useEleccionesFilters`, `useEleccionesLocalesFilters`,
`useGeoEcegContexto`, `useGeoEcegFilters`, `useGeoEcegMap`,
`useGeoElectoralMap`/`useGeoElectoralMapLoc`, `useLneHistorico`,
`useLneOrigenMatriz`, `useLneSemanal`, `useLneSemanalesSerie`, `useResultados`/
`useResultadosLocales`. Estos hooks gestionan tanto el fetch como el estado de
filtros geográficos.

Componente relacionado fuera de `/sefix`: `app/components/geo/GeoNavegador.tsx`
(posible navegador geográfico compartido, referencia a Sefix detectada).

---

## 4. API routes (`app/api/sefix/**`)

Todos son endpoints **`GET`**, sin verificación de sesión — confirmado
explícitamente en `territorios/route.ts`: *"Sin auth: /sefix es público. Caché 30
min en storage.ts."*

| Ruta | Función |
|---|---|
| `resultados/route.ts` | `?estado&cargo&anio` → resultados electorales federales agregados por partido. |
| `padron/route.ts` | `?estado` → padrón/LNE más reciente (semanal o histórico) por estado. |
| `historico/route.ts`, `historico-tabla/route.ts`, `historico-geo/route.ts` | Series históricas del padrón (G1/G2/G3) con filtro geográfico progresivo. |
| `semanal/route.ts`, `semanal-tabla/route.ts`, `semanal-nb/route.ts`, `semanal-origen-matriz/route.ts` | Cortes semanales por sexo/edad/origen, incl. desglose No Binario. |
| `serie-historico/route.ts`, `serie-semanal/route.ts` | Series nacionales pre-agregadas. |
| `elecciones-tabla/route.ts`, `elecciones-geo/route.ts` | Datos tabulares y geo-opciones (estado→distrito→municipio→sección) para resultados federales. |
| `elecciones-locales-tabla/route.ts`, `elecciones-locales-geo/route.ts`, `elecciones-locales-resultados/route.ts` | Equivalentes para resultados locales. |
| `geo-resultados/route.ts`, `geo-resultados-locales/route.ts` | Datos para el mapa choroplético (por partido/participación). |
| `lne-distrito/route.ts` | LNE agregada a nivel distrito. |
| `nb-anual/route.ts` | Serie anual No Binario. |
| `eceg-contexto/route.ts`, `eceg-datos/route.ts`, `eceg-perfil/route.ts` | Indicadores ECEG 2020 (demografía, educación, economía, salud, vivienda, hogar, conectividad, religión). |
| `territorios/route.ts` | Jerarquía de estados/municipios/secciones disponibles. |

Relacionado pero fuera de `app/api/sefix/`:
- `app/api/centinela/pestel/sefix-data/route.ts` y `app/api/centinela/pestel/trigger/route.ts` consumen `lib/sefix/sefixContext.ts` para inyectar datos electorales en el análisis PEST-L.
- `app/api/moddulo/f2/generate-m1-express/route.ts` usa `buildSefixContext`.

---

## 5. Capa de datos (`lib/sefix/`)

| Archivo | Propósito |
|---|---|
| `storage.ts` (~3500 líneas) | Núcleo del backend. Lee/parsea CSVs desde Firebase Storage (bucket `eskemma-3c4c3.firebasestorage.app`) en streaming, con caché en memoria TTL 30 min y deduplicación de descargas concurrentes. Expone `getResultadosByEstado`, `getResultadosFiltered`, `getResultadosLocalesFiltered`, `getPadronByEstado`, `getPadronNacional`, `getHistoricoSeries(Geo)`, `getSemanalSeccionSnapshot/Serie`, `getEleccionesGeo`, `getEleccionesLocalesGeo`, `listStorageFiles`, `normalizeEstado`/`resolveEstadoName`, `toStorageKey`, entre otros. Usa JSONs columnares pre-generados por entidad (`sefix/pdln/historico_entidad/{ENTIDAD}_anual.json` / `_{YYYY}.json`) en vez de leer los 195 CSV en tiempo real — mejora documentada de 5-15 min a 500-800ms (`docs/compliance/MODULOS/sefix.md`). Mantiene su propio `ESTADO_MAP` local, deliberadamente duplicado de `constants.ts` para evitar dependencia circular. |
| `sefixContext.ts` | Construye contexto Sefix para PEST-L (Centinela/Moddulo F2). Expone `buildSefixContext()`, `getSefixPriority()` (tabla de prioridad de 4 cargos según tipo/nivel de proyecto) y `resolveDistrictCabecera()`. Consumido por `app/api/centinela/pestel/trigger/route.ts` y `app/api/moddulo/f2/generate-m1-express/route.ts`. |
| `constants.ts` | `ESTADO_MAP` (32 estados), `PARTY_COLORS` (identidad partidaria — deliberadamente fuera del design system), `CARGOS_LIST`. |
| `clientUtils.ts` | Utilidades cliente-only: `storagePublicUrl()`, `fetchCsv()` — lee CSVs pre-agregados públicos sin `firebase-admin`. |
| `districtMatching.ts` | `matchDistrito()` — función pura compartida entre el widget de F2 y `sefixContext.ts`. |
| `ecegConstants.ts` | Catálogo curado de indicadores ECEG 2020 (grupos: demografía, educación, economía, salud, vivienda, hogar, conectividad, religión). |
| `ecegTextUtils.ts` | Generación de texto dinámico para el sidebar "Análisis Textual Dinámico" del panel ECEG. |
| `eleccionesConstants.ts` / `eleccionesLocalesConstants.ts` | Constantes de cargo/partido, portadas literalmente de `partidos_colores.R`/`partidos_mapping.R` (versión R Shiny original). |
| `eleccionesTextUtils.ts` / `eleccionesLocalesTextUtils.ts` | Funciones puras de texto dinámico, equivalentes a `elecciones_federales_server_text_analysis.R`. |
| `semanalUtils.ts` | Transformación/proyección de series semanales, migrado de `docs/sefix_R/modules/lista_nominal_graficas/`. |
| `seriesUtils.ts` | Transformación de series históricas del padrón; tipos `Ambito`, `MesPoint`. |

---

## 6. Tipos (`types/sefix.types.ts`)

Archivo central de tipos de Sefix:

- `SefixTabId`, `SefixTab`, `SEFIX_TABS` — las 6 pestañas y su flag `available`.
- `GeoNivel` / `GeoScope` — filtro jerárquico nacional → estatal → distrital → municipal → seccional.
- Tipos de fila para series pre-agregadas: `SexoSerieRow`, `EdadSerieRow`, `OrigenSerieRow`.
- Tipos de corte semanal: `LneSemanalSexoRow`, `LneHistoricoRow`.
- Tipos de resultados: `ResultadosChartData`, `EleccionesFilterParams`, `EleccionesLocalesFilterParams`, `ResultadosEleccionesData`, `GeoEleccionesOpcion`.
- Máquina de estados de filtros: `GeoFilterState` / `GeoFilterAction`.

Otros tipos que referencian Sefix:
- `types/subscription.types.ts` → `sefixAccess: AccessLevel` (ver §7).
- `types/f3.types.ts` / `types/shared.types.ts` → mapeo T06 (ver §8).
- `types/pestel.types.ts` → `Territorio`, `NivelTerritorial`, importados por `storage.ts`/`sefixContext.ts`.

---

## 7. Gating de suscripción/permisos

- **`/sefix` es pública, sin gating funcional real.** `page.tsx` obtiene
  `session?.role` pero `SefixDashboard` lo recibe como `_role` (prefijo underscore
  = explícitamente no usado) y no aplica ninguna restricción visual ni de acceso.
- Todos los API routes de `/api/sefix/` son de lectura pública.
- Existe declarativamente `sefixAccess: AccessLevel` en `PlanFeatures`
  (`types/subscription.types.ts`) con valores `freemium` (plan `user`), `basic`,
  `premium`, `professional` — pero **no hay ningún consumidor de este campo en el
  código** (`grep` solo devuelve la definición). El texto "Acceso a Sefix" sí
  aparece en `utils/subscriptionUtils.ts:200` como copy de marketing del plan
  Basic, sin enforcement real detrás.
- `canAccessModduloApp()` / `FREEMIUM_APPS` en `utils/subscriptionUtils.ts` gatean
  apps de **Moddulo**, no Sefix.
- **Conclusión**: en la práctica, Sefix es de acceso libre para cualquier
  visitante (autenticado o no), pese a que el modelo de negocio documentado lo
  presenta como beneficio incluido desde el plan Basic.

---

## 8. Mapeo con el catálogo MMEE (T06)

Confirmado en múltiples archivos:

- `types/f3.types.ts` → `NOMBRES_COMERCIALES: Record<TecnicaId, string> = { T06: "Sefix", ... }`.
- `types/f3.types.ts` → `FAMILIA_METODOLOGICA_POR_TECNICA: { T06: "documental", ... }`.
- `types/f3.types.ts` → `TECNICA_TITULOS: { T06: "Investigación de electorado", ... }`.
- `types/shared.types.ts` → `T06` es uno de los 35 `TecnicaId` válidos (`T01`...`T35`).
- `docs/specs/MMEE_v2_0.md` — ficha completa de **T06 - Investigación de
  electorado**: familia metodológica "Cuantitativa · Documental"; descripción
  *"Análisis integral del electorado: geografía electoral, participación
  histórica y resultados por unidad territorial. Núcleo de Sefix."*; componente
  del ecosistema: **Sefix (núcleo)**; prioridad **Alta — Prelación 1**; vínculo
  con F3 ("insumo para vector Territorial del MVP") y con F8/SIP (línea base
  histórica del territorio). El propio documento aclara que **T10 (Análisis de
  datos abiertos) es exclusivo de Centinela, no de Sefix** — Sefix implementa
  exclusivamente T06.
- `_docs/moddulo-f1-f3-handoff.md` confirma este mapeo y señala a T06/Sefix como
  candidato natural para ser el primer caso de conexión real vía Canal 1 (en vez
  de placeholder `"proximamente"`).

`types/f3.types.ts` también define `AppContractConfig` (con
`componente: "sefix" | "centinela" | "recursos"`) y
`APP_TO_F3_CONTRACTS: Partial<Record<TecnicaId, AppContractConfig>> = {}` —
**actualmente vacío**: el contrato formal Sefix→F3 (Canal 1, `api-push`) aún no
está implementado en código, pese a que la integración de datos ya existe de
facto vía `sefixContext.ts`.

---

## 9. Documentación existente y su vigencia

| Archivo | Contenido | Vigencia |
|---|---|---|
| `_docs/sefix-technical-brief.md` (2026-03-18) | Brief orientado a Next.js/API: endpoints, esquema de columnas CSV en Storage, gaps de datos (solo federal, faltan estatales/locales/encuestas/gasto de campaña), roadmap de dashboard Next.js. | Roadmap ya superado por el código actual. |
| `_docs/sefix-shiny-brief.md` (2026-03-18) | Brief orientado a R/Shiny: contrato de datos Firebase Storage, convención de rutas para datasets estatales/locales. | ⚠️ Desactualizado — describe el iframe Shiny como estado presente. |
| `docs/compliance/MODULOS/sefix.md` (2026-04-10) | Documentación INDAUTOR — **la más autoritativa y actual**. Describe el problema de rendimiento resuelto (195 CSVs → 5-15 min) y la solución de pre-generación offline (`scripts/pregenerate-sefix.ts` → JSON columnar por entidad → 500-800ms). Detalla las 3 gráficas (G1 proyección anual, G2 evolución histórica, G3 desglose por sexo) y atribución de autoría. | Vigente. |
| `docs/specs/sefix-matriz-niveles.md` (2026-07-10) | Fuente de verdad de la matriz de niveles electorales usada en `getSefixPriority()` y en F2 de Moddulo. Incluye nota de bug corregido (Presidencia recibía scope estatal en vez de nacional, corregido 2026-07-10). | Vigente. |
| `docs/specs/MMEE_v2_0.md` | Ficha oficial de T06 dentro del catálogo MMEE (ver §8). | Vigente. |
| `docs/sefix_R/` | Código fuente legado de la app R/Shiny original (`app.R`, `modules/*.R`, `server/*.R`, `utils*.R`). | Conservado como referencia histórica de migración, no como documentación activa. |
| `CLAUDE.md` | Tabla de rutas (Sefix listado como "Shiny embebido"); tabla de planes (Basic incluye "Cursos, Sefix"); changelog de integración Sefix↔PESTEL (2026-03-28). | ⚠️ Etiqueta desactualizada — ver §10. |

---

## 10. Hallazgos e inconsistencias detectadas

1. **Etiqueta "Shiny embebido" obsoleta.** `CLAUDE.md` y `_docs/sefix-shiny-brief.md`
   describen Sefix como un iframe embebiendo `https://kj6hbt-ra0l-s0nchez.shinyapps.io/sefix/`,
   con una variable de entorno `NEXT_PUBLIC_SEFIX_DASHBOARD_URL` que **no existe en
   ningún lugar del código actual**. `next.config.ts` todavía conserva una CSP
   header residual (`frame-src 'self' https://*.shinyapps.io
   https://kj6hbt-ra0l-s0nchez.shinyapps.io;`) aplicada solo a la ruta `/sefix`.
   El código real ya es un dashboard nativo Next.js/React sin backend R/Shiny en
   producción (confirmado por `docs/compliance/MODULOS/sefix.md`, la fuente más
   reciente). Recomendación: actualizar la etiqueta en `CLAUDE.md` y evaluar si
   retirar la CSP de `shinyapps.io` en `next.config.ts`.

2. **`IframePanel.tsx` huérfano.** Existe en `app/sefix/components/IframePanel.tsx`
   (wrapper de `<iframe>` genérico con loading/error/retry, sandbox
   `allow-same-origin allow-scripts allow-popups allow-forms allow-downloads
   allow-modals`) pero no está importado en ningún panel actual — vestigio de la
   arquitectura anterior.

3. **Gating de suscripción declarado sin enforcement.** `sefixAccess: AccessLevel`
   vive en el modelo de planes (`types/subscription.types.ts`) y aparece como
   copy de marketing ("Acceso a Sefix" en plan Basic), pero no hay ningún punto
   del código que lo lea o lo aplique. `/sefix` es hoy de acceso público
   confirmado explícitamente en comentarios (`territorios/route.ts`).

4. **`APP_TO_F3_CONTRACTS` vacío para T06.** Pese a que la integración de datos
   Sefix→Moddulo F2/Centinela ya funciona de facto vía `sefixContext.ts` y los
   endpoints de `/api/centinela/pestel/`, el contrato formal de Canal 1
   (`AppContractConfig` con `componente: "sefix"`, mecanismo `api-push` o
   `link-manual`, `payloadSchema`) todavía no tiene entrada para T06 — este es
   exactamente el punto de partida cuando se diseñe la nueva pestaña de Sefix
   como fuente real de `ResultadoF3` para Canal 1 de F3.

---

## Fuente de esta investigación

Este documento se generó a partir de un mapeo exhaustivo del código en
`/Users/raul/Documents/development/eskemma` realizado el 2026-07-22, cubriendo
`app/sefix/`, `app/api/sefix/`, `lib/sefix/`, `types/sefix.types.ts`,
`types/f3.types.ts`, `types/shared.types.ts`, `types/subscription.types.ts`,
`next.config.ts`, y la documentación en `_docs/` y `docs/` relacionada con Sefix.
