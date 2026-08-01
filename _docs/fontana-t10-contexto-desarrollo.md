# Fontana (T10) — reporte técnico de contexto acumulado, para iniciar desarrollo

**Fecha de cierre de esta ronda:** 2026-07-29.
**Propósito de este documento:** transferir a una sesión nueva todo el
contexto de investigación, diagnóstico y decisiones de arquitectura
acumulado hasta ahora sobre Fontana (T10), sin que la sesión nueva
tenga que redescubrir nada de esto. Este documento es un índice
navegable — el detalle completo de cada hallazgo vive en los archivos
referenciados, no se repite aquí palabra por palabra.

---

## 1) Qué es Fontana

Fontana es **T10** del catálogo MMEE (`docs/specs/MMEE_v2_0.md`,
`types/f3.types.ts` — `NOMBRES_COMERCIALES.T10 = "Fontana"`,
`TECNICA_TITULOS.T10 = "Análisis de datos abiertos"`). Es la app del
ecosistema Centinela dedicada a explotar fuentes de datos abiertos
oficiales (INEGI, CONAPO, CONEVAL/INEGI, SESNSP, INE, organismos
internacionales) organizadas en **5 familias de indicadores** —
Sociodemográficos, Socioeconómicos, Geopolíticos, Comparación
internacional, Características territoriales — para alimentar tanto
consultas independientes dentro de Centinela como la Fase 3
(Investigación) de Moddulo.

Existen ya sandboxes de diagnóstico previos con este nombre:
`app/dev/fontana-iter/page.tsx`, `app/dev/fontana-inegi/page.tsx`
(código de prueba, no producción — confirmar su estado al retomar).

---

## 2) Catálogo de indicadores — estado final por familia

El catálogo completo (77 filas: indicadores numerados + candidatos
nuevos sin número) fue clasificado en PESTEL (P/E/S/T/Ecológico/Legal)
para informar `pipModulos` del futuro `AppContractConfig`. Resultado
final:

| Letra | # indicadores | Incluir en `pipModulos` |
|---|---|---|
| Social | 43 | Sí |
| Económico | 28 | Sí |
| Político | 25 | Sí |
| Ecológico | 2 | Sí (cobertura delgada, depende de Familia 5) |
| Tecnológico | 2 | Sí (cobertura delgada) |
| Legal | 0 | **No** — confirmado, no forzado; candidata a activarse solo si se agrega un indicador legal/normativo real en el futuro |

### Familia 1 — Sociodemográficos (investigación de fuentes: ✅ completa)

- Mecanismo base (BIE/BISE, ITER, ECEG) ya confirmado en rondas
  iniciales del proyecto (no cubiertas en detalle en este documento,
  son anteriores a este chat).
- **4 pendientes cerrados en esta ronda** (`info_geo_eske/
  familia1_pendientes_paso2.md`):
  - **Migración neta municipal**: sin fuente — CONAPO no la calcula a
    nivel municipal (confirmado con su propio documento metodológico:
    usa suavizado matemático, no método de componentes). Se mantiene
    el proxy ya conocido (stock de inmigración vía ECEG).
    Hallazgo colateral: el mismo dataset de CONAPO sí trae **razón de
    dependencia demográfica municipal real** (`RAZ_DEP`), resuelve el
    indicador 19 sin más trabajo.
  - **Licenciatura+**: sin desagregación disponible ni a nivel
    municipal ni estatal más allá de "posbásica" (confirmado en los
    diccionarios de datos reales de ITER y ECEG). Se mantiene el proxy
    `P18YM_PB`.
  - **Densidad de población (indicador 16)**: recomendación cambió
    dos veces en esta serie — inicialmente se recomendó eliminar por
    imprecisión del cálculo geométrico (13-14% de error en Zapopan
    contra la cifra de IIEG), pero luego se encontró el "Compendio de
    Información Geográfica Municipal" de INEGI (fuente oficial, %
    editorial, no derivada por nosotros) — **tres fuentes
    independientes coinciden en ~1,148-1,163 km² para Zapopan, y la
    cifra de IIEG (1,017.24) resultó ser la atípica**. Recomendación
    final: **no eliminar**, usar el Compendio de INEGI como fuente de
    superficie. Se confirmó que no existe edición posterior a 2010 de
    ese Compendio con el mismo desglose. Ver
    `info_geo_eske/familia5_verificaciones_ronda3.md` (punto 2) para
    el cálculo completo.
  - **% Hogares con jefe migrante (indicador 18)**: ENADID confirmada
    como única fuente, pero con representatividad **estatal**, no
    municipal (3,495 hogares/entidad mínimo). **Recomendación:
    eliminar el indicador** — no hay fuente que resuelva la
    granularidad municipal requerida.

### Familia 2 — Socioeconómicos (investigación de fuentes: ✅ completa, de rondas previas a este chat)

- Indicador 27 dividido en dos indicadores reales (Producción para el
  Bienestar, Beca Benito Juárez) — `info_geo_eske/
  produccion_bienestar_2024/`, `beca_benito_juarez/`.
- Indicador 38 (Índice de Desarrollo Social) cerrado sin fuente propia
  — `info_geo_eske/familia2_cierre_indicador_38.md`.
- Gini nacional (ENIGH) con metodología por hogar documentada como
  obligatoria — `info_geo_eske/enigh2024/README.md`.

### Familia 3 — Geopolíticos (investigación de fuentes: ✅ completa)

- Los 10 indicadores con fuente externa (39-56, excluyendo los 8
  electorales que van vía Sefix) tienen mecanismo confirmado —
  resumen en `info_geo_eske/familia3_resumen_investigacion.md`.
- **Indicador 46 (ZAP) — reutilización directa de capas de Sefix
  confirmada con código real**: las capas `ageb_urbana`/`ageb_rural`
  ya productivizadas (`app/api/geo/shapes`, `scripts/geo-pipeline.ts`)
  preservan `CVE_ENT/CVE_MUN/CVE_LOC/CVE_AGEB/CVEGEO`, y el cruce con
  la declaratoria del DOF es una simple concatenación de claves, sin
  spatial join. Ver `info_geo_eske/familia3_zap_ageb_reuso.md`.

### Familia 4 — Comparación internacional (investigación de fuentes: ✅ completa)

`info_geo_eske/familia4_resumen_investigacion.md`. Hallazgo más
importante: **existen al menos tres "Gini de México" con metodologías
distintas** (CEPALSTAT/Banco Mundial per cápita ≈0.43 vs. INEGI
oficial por hogar =0.391) — Fontana debe etiquetar la metodología
siempre que muestre un Gini. Indicador 62 (EIU Democracy Index)
cerrado con decisión de Raúl: mostrar los 3 campos con confiabilidad
diferenciada por campo (rank/categoría confiables vía CRS, score de
baja confianza vía espejo no oficial).

### Familia 5 — Características territoriales (investigación de fuentes: ✅ completa, con 3 rondas de profundización)

`info_geo_eske/familia5_resumen_investigacion.md` +
`familia5_pendientes_paso2.md` + `familia5_verificaciones_ronda3.md`.
Hallazgos más relevantes:

- **CONAGUA (clima, indicador 67) resuelto por completo** —
  reverse-engineering con Playwright encontró el patrón de URL vigente
  (`Normales9120/`) con descarga real confirmada.
- **INECC/ANVCC (indicador 75) resuelto con un hallazgo excelente** —
  API GeoServer real, CSV municipal de 1.58 MB con muchos más
  indicadores de los pedidos (incendios forestales, declaratorias de
  desastre, % área natural protegida, PIB municipal, PIB turístico).
  **Verificado que no duplica el indicador 23** (Rezago Social): los
  campos `con_rezago`/`sin_rezago` son un conteo de viviendas
  (∼`vivpar_hab`), no el índice. Pero sí se confirmó que los campos
  `grs`/`gmar` del mismo archivo **sí son un reempaquetado de
  CONAPO/INEGI** — no usarlos como fuente independiente.
- **SIC (tradiciones y fiestas, indicador 70) — corrección importante
  de una ronda anterior**: no eran 18-19 entidades "sin datos", era que
  solo se había revisado una de tres tablas relevantes del SIC
  (`festividad`). Combinando `festividad` + `frpintangible` +
  `festival`, las 32 entidades tienen contenido real — ya no hace
  falta ninguna fuente estatal externa.
- **Atractivos turísticos (indicador 74)**: DATATUR descartado
  (estadística de demanda, no inventario). IIEG Jalisco (WFS/GeoServer)
  es el mecanismo correcto pero sigue caído en reintentos repetidos —
  sin alternativa viva encontrada en otro estado.
- **Candidatos nuevos de INECC/ANVCC** evaluados en tabla completa
  (nivel, periodicidad, duplicados) en `familia5_verificaciones_ronda3.md`
  punto 4 — todos son municipales-únicamente, sin fecha de referencia
  confirmable en los metadatos de la fuente (limitación real a
  documentar si se incorporan).

---

## 3) Arquitectura del payload hacia F3 — decisión tomada

Investigado el tipado real de `ResultadoF3<TPayload>` (`TPayload =
unknown`, sin restricción de forma) y el único precedente de payload
rico del ecosistema (`LinkedSourceRef<MapaPESTEL>` de F2, anidado por
dimensión). **Recomendación dada (Opción A): payload anidado por
familia**, no un objeto plano de indicadores individuales — no es una
restricción técnica, es la lectura del precedente más cercano
disponible y de la necesidad de colgar metadata de cobertura por
familia (dado que la cobertura real ya se sabe que varía mucho por
familia). No hay documento separado de esto — quedó resuelto en la
conversación, sin archivo dedicado.

---

## 4) Integración con F3 — hallazgo central que corrige la premisa inicial

**`info_geo_eske/patron_integracion_pestel_f2_f3.md`** — documento
clave. Resumen: **PESTEL nunca se integró con F3.** Se integra con F2
(Exploración), vía un mecanismo propio (`linkedSource`/
`LinkedSourceRef`, endpoints `import-pestel`/`link-moddulo`/
`find-linked-pestel`), completamente distinto del Canal 1
(`AppContractConfig`/`APP_TO_F3_CONTRACTS`) y Canal 3
(`VincularFuenteForm`/`ResultadoFuenteExterna`) que existen en los
tipos de F3 pero **nunca han sido ejercitados por ninguna app real**.

**Fontana sería la primera app en usar Canal 1/Canal 3 de F3 tal como
están diseñados en los tipos.** Esto tiene consecuencias directas:

- No hay ningún patrón "de PESTEL" que copiar para Canal 1 — hay que
  diseñarlo desde cero.
- El patrón que sí funciona (F2/PESTEL) está construido a la medida,
  con endpoints dedicados por nombre y literales hardcodeados —
  **no es reutilizable sin duplicar lógica**.
- Se encontró y **corrigió** una inconsistencia real de tipos entre
  `AppContractConfig.componente` (3 valores) y
  `OrigenTrazabilidad.componente` (6 valores) —
  ver sección 6.

### Piezas de infraestructura genérica confirmadas como reutilizables (sin construir nada nuevo)

`info_geo_eske/f3_infraestructura_generica_reutilizable.md`:

| Pieza | Estado |
|---|---|
| Sesión + ownership (`getSessionFromRequest` + `getProject`) | Genérica, reutilizable tal cual |
| Validación de `moduloPIP` contra el PIP real | No existe en ningún canal — hay que construirla nueva para Canal 1 |
| Evaluación de compatibilidad tipo Canal 3 (`evaluarCompatibilidad`) | No aplica a Canal 1 (responde una pregunta distinta: tipo/territorio/vigencia del proyecto, no existencia de PIP) |
| Auth servicio a servicio | **No existe ningún precedente en todo el repo** — sería la primera vez; considerar evitar el problema operando siempre en contexto de sesión de usuario |
| Patrón de respuesta HTTP (status + shape) | Genérico y consistente entre Canal 2/3 — replicar el subconjunto de Canal 2 |

### Brecha de versionado de resultados — diagnosticada, no resuelta

`info_geo_eske/f3_manejo_resultados_actualizados.md`: no existe ningún
mecanismo de versionado de `ResultadoF3`. Un segundo resultado para la
misma asignación crea un documento huérfano (ID aleatorio,
`.doc().id`), el puntero de la asignación se mueve sin comparar contra
el valor previo, y el documento viejo **puede seguir alimentando la
síntesis M3** si conservaba `aprobado: true`. Tampoco hay invalidación
de M3/M4 cuando cambia un resultado de origen — el motor genérico para
esto (`lib/moddulo/phasePropagation.ts`) existe pero solo tiene
poblado el par F1→F2, nunca F3.

---

## 5) Cambios de código de producción YA APLICADOS en esta serie

Dos archivos modificados, ambos verificados con `tsc --noEmit` limpio
y sin tocar nada de PESTEL/Centinela:

### `types/f3.types.ts`

`AppContractConfig.componente` dejó de ser un union literal
independiente (`"sefix" | "centinela" | "recursos"`) y ahora se deriva
por `Extract<>` desde `OrigenTrazabilidad["componente"]` (el catálogo
de 6 valores real), bajo el nombre `AppConContrato` — mismo patrón que
ya usaba `LinkedSourceRef.componente` en `types/moddulo.types.ts`.
Verificado que "centinela" sigue siendo válido y que "manual" (fuera
del subconjunto) es rechazado por el compilador. `APP_TO_F3_CONTRACTS`
sigue vacío — no se agregó ninguna entrada real, tampoco de Fontana.

### `app/api/moddulo/f3/tareas/generar/route.ts`

`asignacionId` dejó de derivarse de la posición en el arreglo
(`${numero}-${index}`) y ahora se deriva del **contenido** de la
asignación (`${numero}_${canal}_${tipo}[_${tecnicaId}]`, con
desempate por sufijo ante colisión real). Verificado con 4 casos:
determinismo entre "generaciones", no colisión entre técnicas
distintas para la misma pregunta, unicidad garantizada en colisión
real, y estabilidad de IDs previos cuando se agrega una pregunta
nueva. **Esto es un prerrequisito directo para que un futuro
`resultadoId` determinístico de Canal 1 (ej.
`canal1_${asignacionId}`) sea seguro** — antes de este cambio,
`asignacionId` no era estable entre regeneraciones del tablero.

**Nota importante:** se evaluó y **se descartó** un guard server-side
que bloqueara por completo la regeneración del tablero con avance
existente — entraba en conflicto con el principio de "editabilidad
universal" del FAT 2.0. Ese guard se implementó y luego se **revirtió
por completo** en la misma sesión (confirmado con `git diff` vacío
antes de aplicar el cambio de `asignacionId`). El enfoque correcto
(diff/merge en vez de bloqueo total) quedó documentado como propuesta
de diseño, no implementado — ver siguiente sección.

---

## 6) Pendiente de diseño (no implementado, documentado como recomendación)

**`info_geo_eske/f3_regeneracion_tablero_diff_merge.md`** — cómo
debería funcionar la regeneración de `f3TareasPIP` como diff/merge en
vez de reemplazo total (conservar avance de asignaciones que
coinciden, agregar las genuinamente nuevas, marcar como
retiradas/obsoletas las que ya no aparecen — nunca borrar en
silencio). Es infraestructura compartida de F3 (llenaría el par F2→F3
del motor `phasePropagation.ts`), no exclusiva de Fontana. El
`asignacionId` determinístico ya aplicado es la base necesaria para
que esto sea posible en el futuro; el endpoint de Canal 1 puede
construirse sin esperar a este trabajo, pero seguirá expuesto a que
una regeneración del tablero borre el vínculo hasta que se resuelva.

---

## 7) Referencia de UI/UX para el prototipo (Paso 4)

Cuatro documentos, basados en el código real del Hub de Centinela y de
PESTEL:

### `info_geo_eske/fontana_doc1_hub_centinela.md`

El hub (`app/centinela/page.tsx`) es un simple array `MONITOR_APPS`
(6 slots, solo PESTEL activo) + grid de `<AppCard>`. Fontana solo
necesita añadirse a ese array. **No hay layout compartido a nivel
`/centinela`** (el único `layout.tsx` vive dentro de PESTEL) ni
breadcrumb reutilizable — cada app resuelve su propio "volver" a mano.
Sistema de diseño (`@theme` en `globals.css`) confirmado con nombres
reales de tokens.

### `info_geo_eske/fontana_doc2_interfaz_pestel.md`

Inventario completo de las 11 pantallas de PESTEL, con advertencia de
que **conviven dos arquitecturas** (legacy de 5 dimensiones vs.
vigente de 6 — el patrón de referencia debe ser siempre el flujo
`[projectId]/*` con `PESTLPanelV2`, nunca el legacy). Componentes
compartidos reales: `TerritorySelector.tsx` (en `shared/`, también
usado por Moddulo). **PESTEL no usa mapas** pese a tener Leaflet
instalado (el único precedente de mapa real vive en Sefix). Patrón de
navegación entre las 6 dimensiones PESTEL (tabs horizontales con
`overflow-x-auto` + `role="tablist"`) es el candidato directo para las
5 familias de Fontana. **No existe ningún guardado incremental en
ningún flujo de PESTEL** — el wizard vive todo en memoria y se pierde
si se cierra el navegador a mitad; `FontanaSesion` (indicadores
mínimos vs. añadidos, guardado incremental) es una pieza nueva a
diseñar desde cero.

### `info_geo_eske/fontana_doc3_precedente_chat_ia.md`

Solo existen dos componentes de chat en todo el repo
(`ModduloChat.tsx`, `AdvisorPanel.tsx`), ambos en Moddulo, ninguno en
Centinela. Fuertemente acoplados (tipos, endpoints, textos de negocio
específicos de Moddulo) — no reutilizables tal cual. El backend
(`app/api/moddulo/chat/[phaseId]/route.ts`) sí tiene un mecanismo real
y probado de streaming SSE con historial multi-turno
(`anthropic.messages.stream`), reutilizable **como patrón de
implementación**, no como código a importar directamente.

### `info_geo_eske/fontana_doc4_tool_use_y_parametrizacion_por_app.md`

**Cero precedente de tool use/function calling real** con el SDK de
Anthropic en todo el repo (confirmado cruzando los 14 archivos que
llaman al SDK) — sería la primera vez que el ecosistema lo usa.
Tampoco hay ningún mecanismo "por app" (`appId`) que cambie
comportamiento hoy, pero sí dos precedentes de forma reutilizables:
`PHASE_PROMPTS: Record<PhaseId,...>` (probado en producción, indexado
por fase) y `APP_TO_F3_CONTRACTS: Partial<Record<TecnicaId,...>>`
(indexado literalmente por app/técnica, pero vacío/inerte). Si el
agente de Fontana es el primer mecanismo genuinamente "por app" del
ecosistema, tiene sentido indexarlo por `TecnicaId`/`AppId`.

---

## 8) Índice completo de archivos de referencia

Todo lo generado en `info_geo_eske/` (directorio gitignored — no viaja
en el repo remoto, pero persiste en este equipo). Fuentes crudas
(datasets reales descargados) en subcarpetas con su propio `README.md`
cada una; documentos de análisis en la raíz:

**Documentos de análisis (raíz de `info_geo_eske/`):**
- `familia1_pendientes_paso2.md`
- `familia2_cierre_indicador_38.md`
- `familia3_resumen_investigacion.md`
- `familia3_zap_ageb_reuso.md`
- `familia4_resumen_investigacion.md`
- `familia5_resumen_investigacion.md`
- `familia5_pendientes_paso2.md`
- `familia5_verificaciones_ronda3.md`
- `patron_integracion_pestel_f2_f3.md`
- `f3_manejo_resultados_actualizados.md`
- `f3_infraestructura_generica_reutilizable.md`
- `f3_regeneracion_tablero_diff_merge.md`
- `fontana_doc1_hub_centinela.md`
- `fontana_doc2_interfaz_pestel.md`
- `fontana_doc3_precedente_chat_ia.md`
- `fontana_doc4_tool_use_y_parametrizacion_por_app.md`
- `PLAYWRIGHT_DESCARGA_INEGI.md` (de rondas previas a este chat)

**Fuentes crudas con README propio** (30 subcarpetas): `anvcc_inecc/`,
`atractivos_turisticos_74/`, `beca_benito_juarez/`, `cepal_gini/`,
`conagua_normales_climatologicas/`, `conapo_migracion_municipal/`,
`enigh2024/`, `envipe_ensu/`, `fmi_bm_indicadores/`,
`gasto_federalizado_shcp/`, `gobernanza_percepcion/`,
`iep_indice_paz/`, `ine_estudios_censales_participacion_2009-2024/`,
`inegi_compendio_geografico_municipal/`, `latinobarometro/`,
`marginacion_conapo_2020/`, `osc_registro_federal/`,
`pnud_hdr_global/`, `pobreza_2020/`, `produccion_bienestar_2024/`,
`sesnsp_incidencia_delictiva/`, `sic_festividades/`, `stps_huelgas/`,
`sun_conapo/`, `undp_idh/`, `zap_dof/` — más las capas geográficas ya
productivizadas en Sefix (`mg_2025_INEGI/`, `mg_2025_INEGI_estados/`,
`mgs_2025_INE/`, `bgd_ne_2025_INE/`, `eceg_2020/`).

---

## 9) Lo que NO se hizo — para no asumir que está resuelto

- No se diseñó todavía ningún wireframe/prototipo de Fontana en
  Artifacts (era el siguiente paso planeado).
- No se implementó el endpoint de Canal 1 en sí — solo su
  prerrequisito (`asignacionId` determinístico).
- No se implementó el diff/merge de `f3TareasPIP` (Sección 6) —
  solo documentado.
- No se resolvió la brecha de versionado de `ResultadoF3` (Sección 4)
  — solo diagnosticada.
- No se diseñó el agente conversacional de Fontana ni su eventual
  tool use — solo se confirmó que no hay precedente que copiar.
- Varios indicadores quedaron con recomendación de **eliminar** del
  catálogo (18 de Familia 1) o **cerrados sin fuente propia** (38 de
  Familia 2) — no fueron removidos de ningún documento de catálogo
  formal porque ese catálogo vive fuera de este repo (Raúl lo
  mantiene aparte); solo quedó la recomendación documentada aquí.
