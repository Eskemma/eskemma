# Fontana (T10) — Cierre del Paso 2: Investigación profunda de metodología y viabilidad de datos

**Versión:** 2 (actualizada)
**Fecha de cierre original:** 26 de julio de 2026
**Fecha de esta actualización:** 27 de julio de 2026
**Ecosistema:** Eskemma — Centinela
**Prelación:** #2 (después de T06/Sefix-AI)
**Estado:** Paso 2 completo, incluyendo ronda adicional de pendientes. Listo para retomar el Paso 3 (arquitectura funcional + `AppContractConfig`) con este catálogo como línea base definitiva.

---

## 1. Propósito de este documento y qué cambió respecto a la v1

Este documento sustituye a la versión de cierre del 26 de julio. Después de esa primera versión, se investigó una ronda adicional de pendientes explícitos (Familias 1, 3 y 5), lo que produjo tres cambios de fondo que no estaban en la v1:

- Se eliminó un indicador de Familia 1 (jefe de hogar migrante) y se renombraron cuatro más para reflejar con precisión lo que su fuente real mide.
- Se revirtió la recomendación de eliminar "Densidad de población" (Familia 1) tras encontrar una fuente oficial no geométrica.
- Se corrigió el diagnóstico de cobertura del indicador de tradiciones y fiestas (Familia 5): no son 18 sino 19 entidades sin dato en la tabla principal del SIC, y la solución no era buscar fuentes estatales nuevas sino combinar tres tablas que el SIC ya expone.
- Se incorporaron 7 indicadores candidatos nuevos (3 en Familia 2, 6 en Familia 5 — de los cuales 1 se descartó por duplicado) y se excluyó uno de Familia 2 (Índice de Desarrollo Social).
- Se adoptó una convención de numeración por familia (`F1-1`, `F2-3`, etc.) en vez de numeración corrida, para que agregar o eliminar un indicador en el futuro no recorra la numeración de las demás familias.

El resto del documento (alcance de Fontana, decisiones de arquitectura, principios transversales) se mantiene igual que en la v1 salvo donde se indica explícitamente.

---

## 2. Alcance de Fontana — sin cambios respecto a la v1

Fontana (T10 — Análisis de datos abiertos) es la app del hub Centinela que procesa datos institucionales públicos de México (y, en una segunda fase de construcción, de otros países de Iberoamérica) para producir:

1. Datos estructurados que alimentan a otras apps del ecosistema — especialmente Sefix-AI, de forma bidireccional (Fontana consume de Sefix los datos y cálculos electorales; Sefix y otras apps futuras pueden consumir de Fontana), sin lista cerrada de consumidores.
2. Su propia interfaz de visualización (mapas, gráficas, tablas, cards), como segunda app del hub Centinela junto a PESTEL.

**Decisiones de alcance fijadas en el Paso 1 (sin cambio):**

- Fuentes no limitadas a INEGI/CONEVAL/CONAPO/Banxico.
- Todas las APIs y tokens gratuitos.
- No se fuerzan comparaciones de indicadores entre países (salvo Familia 4).
- Secuencia de construcción: México primero, Iberoamérica como parte de la misma app.
- Relación con PESTEL pendiente de decidir según resultado de resolver las barreras de acceso a datos sociodemográficos que hoy limitan a PESTEL.

---

## 3. Catálogo final de indicadores — convención `F#-#`

De aquí en adelante, cada indicador se identifica por familia y número dentro de esa familia (`F1-1` … `F1-19`, `F2-1` … `F2-22`, etc.), no por numeración corrida. Esto es lo que va a `INDICATOR_REGISTRY.json` cuando se pueble en el Paso 5.

### Familia 1 — Sociodemográficos (19 indicadores; se elimina el de jefe de hogar migrante)

**Color canónico:** `#026988` (bluegreen-eske)

**Descripción de la familia:** Indicadores derivados principalmente del Censo de Población y Vivienda del INEGI. Describen la composición, distribución y condiciones habitacionales de la población en el territorio. Son la base del diagnóstico territorial para cualquier tipo de proyecto político.

| ID | Indicador | Fuente | Mecanismo de obtención | Actualización sugerida | Mantenimiento en Fontana |
|---|---|---|---|---|---|
| F1-1 | Población total | INEGI (POBTOT) | API BIE/BISE + ECEG (ya en Sefix) + ITER | Fija hasta Censo 2030 | ECEG como fuente primaria (sección); BIE/ITER como validación cruzada |
| F1-2 | Pirámide de edades | INEGI (ITER, extracto quinquenal) | Descarga directa por entidad, parseo local | Fija hasta 2030 | Extracto mínimo en bodega propia; ampliar ECEG con cortes finos pendiente de autorización en T06 |
| F1-3 | % Población indígena | ECEG (P3YM_HLI/P_3YMAS) | Pipeline ECEG ya existente | Fija hasta 2030 | Consumo directo, sin duplicar |
| F1-4 | % Jefatura femenina | ECEG (HOGJEF_F) | Igual que F1-3 | Fija hasta 2030 | Igual que F1-3 |
| F1-5 | Escolaridad promedio | ECEG (GRAPROES) | Igual que F1-3 | Fija hasta 2030 | Igual que F1-3 |
| F1-6 | % Población inmigrante *(renombrado de "migración neta")* | ECEG (PNACOE) | Igual que F1-3 | Fija hasta 2030 | Proxy de stock, no neto — etiquetado explícito en interfaz |
| F1-7 | % Población >65 años | ECEG (POB65_MAS) | Igual que F1-3 | Fija hasta 2030 | Igual que F1-3 |
| F1-8 | % Vivienda con piso de tierra | ECEG (VPH_PISOTI) | Igual que F1-3 | Fija hasta 2030 (ENVI no baja a municipal) | Igual que F1-3 |
| F1-9 | Promedio de ocupantes por cuarto *(renombrado de "hacinamiento")* | ECEG (PRO_OCUP_C) | Igual que F1-3 | Fija hasta 2030 | Presentar como promedio, nunca como "%" |
| F1-10 | % Vivienda con servicios básicos | ECEG (VPH_C_SERV) | Igual que F1-3 | Fija hasta 2030 | Igual que F1-3 |
| F1-11 | % Población urbana/rural | ITER (TAMLOC, municipio/localidad); sección pendiente de `TIPOSEC` | Descarga directa + parseo local | Fija hasta 2030 | Extracto mínimo ITER; sección pendiente (ver §6) |
| F1-12 | Estado civil (soltero / casado / separado) | ECEG (P12YM_SOLT, P12YM_CASA, P12YM_SEPA) | Igual que F1-3 | Fija hasta 2030 | 3 categorías reales, no 6 |
| F1-13 | % Población sin escolaridad | ECEG (P15YM_SE) | Igual que F1-3 | Fija hasta 2030 | Igual que F1-3 |
| F1-14 | Educación pos-básica *(renombrado de "educación superior")* | ECEG (P18YM_PB) | Igual que F1-3 | Fija hasta 2030 | Incluye bachillerato — nombre ajustado a lo que realmente mide |
| F1-15 | % Población con discapacidad | ECEG (PCON_DISC) | Igual que F1-3 | Fija hasta 2030 | Igual que F1-3 |
| F1-16 | Densidad de población | INEGI (POBTOT/ITER ÷ superficie, Compendio Geográfico Municipal 2010) | Descarga directa (PDF por municipio) + cálculo propio | Fija (compendio sin edición posterior confirmada) | Cálculo documentado explícitamente: POBTOT ÷ superficie oficial (no geometría) |
| F1-17 | Remesas recibidas per cápita | Banxico (SIE API) | API REST con token | Mensual | Bodega propia o consumo directo con caché |
| F1-18 | Razón de dependencia demográfica | CONAPO (RAZ_DEP, municipal, 1990-2040) | Descarga directa (datos.gob.mx) | Sin cadencia fija confirmada | Bodega propia; ya no requiere cálculo propio sobre ECEG |
| F1-19 | % Población indígena monolingüe | ECEG (P3HLINHE) | Igual que F1-3 | Fija hasta 2030 | Igual que F1-3 |

*Eliminado: % Hogares con jefe migrante — ENADID, única fuente candidata, representatividad solo estatal.*

### Familia 2 — Socioeconómicos (22 indicadores)

**Color canónico:** `#DB6015` (orange-eske)

**Descripción de la familia:** Indicadores que miden las condiciones de vida, el nivel de bienestar y la distribución del ingreso en el territorio. Provienen principalmente de INEGI, CONEVAL, CONAPO y PNUD. Son el núcleo del diagnóstico de necesidades para proyectos gubernamentales, legislativos y ciudadanos.

| ID | Indicador | Fuente | Mecanismo de obtención | Actualización sugerida | Mantenimiento en Fontana |
|---|---|---|---|---|---|
| F2-1 | Pobreza multidimensional | INEGI (ex-CONEVAL) | Descarga directa | Bienal (nal/estatal); municipal congelado 2020 | Bodega versionada; causa estructural documentada una sola vez |
| F2-2 | Pobreza extrema | Igual que F2-1 | Igual | Igual | Igual |
| F2-3 | Índice de Rezago Social | INEGI (ex-CONEVAL) | Descarga directa (xlsx) | Igual que F2-1 | No comparable en el tiempo — no graficar tendencia del valor absoluto |
| F2-4 | Índice de Marginación | CONAPO | Descarga directa (xls legado) | Congelado, mismo obstáculo estructural | Usar IMN_2020 (normalizado), no IM_2020 |
| F2-5 | IDH Municipal | PNUD (PAD) | Descarga vía navegador (manual) | Sin calendario confirmado | Bodega propia; descarga documentada como frágil |
| F2-6 | Gini de ingreso | INEGI ENIGH | Descarga vía navegador (manual); cálculo propio | Bienal | Definición **por hogar**, validado contra cifra oficial (0.391) |
| F2-7 | Beneficiarios Producción para el Bienestar | Bienestar (datos.gob.mx) | API CKAN | Anual | Indicador independiente, no proxy de cobertura general |
| F2-8 | Beneficiarios Beca Benito Juárez | Bienestar (datos.gob.mx) | API CKAN | Trimestral | Igual que F2-7 |
| F2-9 | Tasa de informalidad | INEGI ENOE | Microdatos/BIE | Trimestral | Granularidad real: entidad + 39 ciudades |
| F2-10 | Salario real medio | INEGI ENOE | Igual que F2-9 | Trimestral | Igual que F2-9 |
| F2-11 | Acceso a internet en hogares | ECEG (VPH_INTER) + ENDUTIH (contexto) | ECEG ya integrado; ENDUTIH descarga anual | Fijo (ECEG) / Anual (ENDUTIH) | Mostrar ambos, sin mezclar resolución |
| F2-12 | Distribución del ingreso por decil | INEGI ENIGH | Igual que F2-6 | Bienal | Igual que F2-6 |
| F2-13 | % Población sin seguridad social (proxy) | ECEG (PDER_SS) | Ya integrado | Fijo hasta 2030 | Etiquetado como proxy de afiliación a salud, no seguridad laboral |
| F2-14 | % Población con ≥1 carencia social | INEGI (ex-CONEVAL) | Mismo archivo que F2-1 | Igual que F2-1 | Validado numéricamente contra pobreza+vulnerables |
| F2-15 | Gasto de hogares en educación | INEGI ENIGH | Igual que F2-6 | Bienal | Igual que F2-6 |
| F2-16 | Gasto de hogares en salud | INEGI ENIGH | Igual que F2-6 | Bienal | Igual que F2-6 |
| F2-17 | Competitividad Estatal (IMCO) | IMCO | Descarga directa (xlsx) | Cada 2 años (edición cambia de composición) | No comparable entre ediciones — documentar cada edición por separado |
| F2-18 | Ingreso corriente promedio municipal (ICMM) | INEGI | Descarga vía navegador (manual) | Sin calendario confirmado | Estimación SEBLUP, no medición directa — complementa, no sustituye, a Gini/deciles |
| F2-19 | Índice de Desigualdad de Género (IDG) municipal | PNUD (PAD) | Igual que F2-5 | Serie 2010-2022 | Primer eje de género propio del catálogo |
| F2-20 | Sub-índice IDH — Educación | PNUD (PAD) | Igual que F2-5 | Igual que F2-5 | Desagregación del IDH compuesto |
| F2-21 | Sub-índice IDH — Ingreso | PNUD (PAD) | Igual que F2-5 | Igual que F2-5 | Igual que F2-20 |
| F2-22 | Sub-índice IDH — Salud | PNUD (PAD) | Igual que F2-5 | Igual que F2-5 | Igual que F2-20 |

*Excluido de Familia 2: Índice de Desarrollo Social — sin fuente propia con cobertura nacional municipal vigente (EVALUA CDMX es exclusivo de una entidad; IDMb 2005 descontinuado; GDM/INAFED es autodiagnóstico voluntario no comparable). Candidato a reactivarse en el futuro únicamente si aparece una fuente sólida.*

### Familia 3 — Geopolíticos (17 indicadores)

**Color canónico:** `#D10F3F` (red-eske)

**Descripción de la familia:** Indicadores que describen el comportamiento político-electoral del territorio, la situación de seguridad pública y el ejercicio del gasto público. Integran datos del INE vía Sefix, del SESNSP y de la SHCP. Son el núcleo del análisis de riesgo para proyectos de comunicación política.

Nota: puede existir una vinculación bidireccional Sefix-AI ↔ Fontana por los datos electorales. Como ambas son aplicaciones que el usuario puede usar de manera independiente, tiene sentido esa bidireccionalidad. La confluencia de datos ocurre cuando el usuario invoca el funcionamiento de ambas apps en el marco de un proyecto particular en F3-Investigación de Moddulo.

| ID | Indicador | Fuente | Mecanismo de obtención | Actualización sugerida | Mantenimiento en Fontana |
|---|---|---|---|---|---|
| F3-1 | Tasa de homicidios dolosos | SESNSP (RNID) | Descarga (URL vía SharePoint, no estable) | Mensual | Pipeline debe re-resolver la URL en cada corrida |
| F3-2 | Incidencia delictiva | SESNSP (RNID) | Mismo archivo que F3-1 | Mensual | Igual que F3-1 |
| F3-3 | Victimización (ENVIPE) | INEGI | Catálogo NADA, descarga directa | Anual | Bodega propia, nivel estatal |
| F3-4 | Percepción de inseguridad (ENSU) | INEGI | Reporte trimestral + tabulados | Trimestral | Nivel real: 91 ciudades, no estatal |
| F3-5 | Resultados electorales | INE vía Sefix | Contrato de datos Fontana↔Sefix | Por elección | Consumo directo, sin duplicar |
| F3-6 | Participación electoral histórica | INE vía Sefix | Igual que F3-5 | Por elección | Igual que F3-5 |
| F3-7 | Gasto federalizado per cápita | SHCP | CSV vía CKAN | Anual | Cerrado a nivel estatal (SRFT municipal es de reporte, no consulta) |
| F3-8 | Zonas de Atención Prioritaria | DOF | PDF con tablas parseables | Anual | Nivel dual municipal/AGEB; cruce AGEB = concatenación de claves, ya confirmado con Sefix |
| F3-9 | Tasa de abstención histórica | INE vía Sefix (derivado) | Igual que F3-5 | Por elección | Igual que F3-5 |
| F3-10 | Índice de volatilidad electoral | INE vía Sefix (derivado) | Igual que F3-5 | Por elección | Igual que F3-5 |
| F3-11 | Voto nulo y no registrados | INE vía Sefix | Igual que F3-5 | Por elección | Igual que F3-5 |
| F3-12 | Margen de victoria | INE vía Sefix (derivado) | Igual que F3-5 | Por elección | Igual que F3-5 |
| F3-13 | Continuidad de partido ganador | INE vía Sefix (derivado) | Igual que F3-5 | Por elección | Igual que F3-5 |
| F3-14 | Índice de competitividad electoral | INE vía Sefix (derivado) | Igual que F3-5 | Por elección | Igual que F3-5 |
| F3-15 | Presencia de organizaciones sociales | RFOSC/CLUNI (INDESOL-Bienestar) | Buscador web, infraestructura caída | Variable | Fuente correcta documentada, reintentar en Paso 5 |
| F3-16 | Huelgas y paros laborales | STPS | CSV vía CKAN | Anual | Bodega propia, nivel estatal |
| F3-17 | Índice de Paz México | IEP | Excel público estructurado | Anual | Sin fricción |

*Excluido de Familia 3: Presencia de conflicto electoral (TEPJF/OPLES) — corresponde a una futura app especializada en compliance y jurisprudencia electoral, no al alcance de Fontana.*

### Familia 4 — Comparación internacional (9 indicadores)

**Color canónico:** `#248CC1` (blue-eske)

**Descripción de la familia:** Indicadores de perspectiva comparada internacional, útiles para enmarcar el contexto nacional dentro de tendencias regionales o globales. Provienen de organismos multilaterales (FMI, Banco Mundial, PNUD, CEPAL) e institutos especializados. Especialmente relevantes para proyectos legislativos y de posicionamiento institucional.

| ID | Indicador | Fuente | Mecanismo de obtención | Actualización sugerida | Mantenimiento en Fontana |
|---|---|---|---|---|---|
| F4-1 | PIB per cápita PPA | Banco Mundial / FMI | API JSON, sin token | Anual | Documentar cuál cifra es la de referencia (BM vs. FMI) |
| F4-2 | Gini internacional | CEPALSTAT / Banco Mundial | API JSON, sin token | Bienal | Etiquetar metodología — es uno de 3 "Gini de México" distintos |
| F4-3 | IDH global | PNUD HDR | CSV directo, sin token | Anual, 2 años de rezago | Distinto del IDH municipal (portal separado) |
| F4-4 | Pobreza línea internacional | Banco Mundial | API JSON, sin token | Bienal | Nota obligatoria: cambio de línea $2.15→$3.00/día |
| F4-5 | Inflación | Banco Mundial / FMI | API JSON, sin token | Anual | Marcar frontera histórico/proyección en la serie del FMI |
| F4-6 | Índice de Democracia (EIU) | The Economist Intelligence Unit | Rank/categoría corroborados oficialmente; score solo por espejo | Anual | Confiabilidad diferenciada por campo (score etiquetado "no oficial") |
| F4-7 | Índice de Percepción de Corrupción | Transparencia Internacional | Descarga directa (parseo manual XML) | Anual | Método de extracción documentado como reproducible |
| F4-8 | Libertad de Prensa (RSF) | Reporteros Sin Fronteras | CSV directo, sin token | Anual | Sin fricción |
| F4-9 | Confianza en instituciones | CEPALSTAT (cita Latinobarómetro) | API JSON, sin token | Anual, con años sin oleada | Evita depender de latinobarometro.org (SSL roto) |

*(Eliminado de Familia 4 desde el Paso 2 inicial: Competitividad Estatal IMCO — reclasificado a Familia 2, ahora F2-17.)*

### Familia 5 — Características territoriales (17 indicadores)

**Color canónico:** `#FFD14A` (yellow-eske)

**Descripción de la familia:** Indicadores geográficos, climáticos, socioculturales, identitarios, de infraestructura espacial, dinamismo económico-territorial y problemáticas ambientales que condicionan la logística de campo, la identidad local y el encuadre de la comunicación política a nivel estatal y municipal.

| ID | Indicador | Fuente | Mecanismo de obtención | Actualización sugerida | Mantenimiento en Fontana |
|---|---|---|---|---|---|
| F5-1 | Factores geográficos | INEGI (Marco Geoestadístico, ya en Sefix) | Consumo directo de `app/api/geo/shapes` | Quinquenal/decenal | No reconstruir — reutilizar endpoint existente |
| F5-2 | Factores climáticos | CONAGUA SMN | Descarga directa (`Normales9120`) | Cada actualización de normales (~década) | Bodega propia; mapeo estación→municipio |
| F5-3 | Historia del territorio | INAH / monografías / cronistas | Curación manual | Esporádica | Módulo de contenido curado, separado del pipeline automatizado |
| F5-4 | Personajes célebres | Mismas fuentes que F5-3 | Curación manual | Esporádica | Igual que F5-3 |
| F5-5 | Tradiciones y fiestas | SIC (Secretaría de Cultura) | CSV/JSON/XML, sin registro — combinar `festividad`+`frpintangible`+`festival` | Anual (calendario festivo) | Cobertura completa de 32 entidades combinando 3 tablas; calidad desigual documentada |
| F5-6 | Zonas de actividad económica | INEGI DENUE | Descarga masiva ya confirmada | Semestral | Fontana construye la agregación por zona/AGEB |
| F5-7 | Zonas habitacionales y comerciales | SEDATU/CONAPO (Sistema Urbano Nacional) | CSV/SHP vía CKAN | No verificado | Nivel regional nativo confirmado (zonas metropolitanas) |
| F5-8 | Zonas menos comunicadas | SICT | Descarga real (56 datasets CKAN) | Variable | IFT descartado (solo nacional); CONEVAL GACP pendiente |
| F5-9 | Atractivos turísticos | IIEG Jalisco (WFS) | Mecanismo identificado, infraestructura caída | N/A | Reintentar periódicamente; sin alterna viable confirmada |
| F5-10 | Problemáticas ecológicas | SEMARNAT/INECC (ANVCC) | WFS/GeoServer, descarga real | Sin fecha confirmable | Bodega propia; año de referencia no confirmado por la fuente |
| F5-11 | Incendios forestales (número) | INECC/ANVCC | Igual que F5-10 | Sin fecha confirmable | Municipal únicamente — estatal por agregación propia (estimación) |
| F5-12 | Superficie incendiada (ha) | INECC/ANVCC | Igual que F5-10 | Sin fecha confirmable | Igual que F5-11 |
| F5-13 | Declaratorias de desastre | INECC/ANVCC | Igual que F5-10 | Sin fecha confirmable | Igual que F5-11 |
| F5-14 | % Área natural protegida | INECC/ANVCC | Igual que F5-10 | Estático (depende de polígonos ANP vigentes) | Igual que F5-11 |
| F5-15 | PIB municipal | INECC/ANVCC | Igual que F5-10 | Sin fecha confirmable | Igual que F5-11; distinto conceptualmente del ICMM (F2-18) |
| F5-16 | PIB turístico municipal | INECC/ANVCC | Igual que F5-10 | Sin fecha confirmable | Igual que F5-11; cobertura real solo 61% de municipios |
| F5-17 | Rezago de vivienda (con/sin rezago) | INECC/ANVCC | Igual que F5-10 | Sin fecha confirmable | Igual que F5-11; no duplica el Índice de Rezago Social (F2-3) |

Descartado explícitamente: los campos `grs`/`gmar` del mismo archivo de INECC/ANVCC — duplican los indicadores F2-3/F2-4 (reempaquetan CONAPO/INEGI). Fontana usa las fuentes primarias ya integradas, no este reempaquetador.

**Total del catálogo: 84 indicadores** (19 + 22 + 17 + 9 + 17), frente a los 76 de la versión de trabajo original — la diferencia neta refleja las eliminaciones (2), exclusiones (2) y siete indicadores nuevos incorporados a lo largo del Paso 2.

---

## 4. Decisiones de arquitectura acumuladas — sin cambios de fondo respecto a la v1, con dos adiciones

Las diez decisiones de la v1 se mantienen vigentes (cálculos electorales en Sefix-AI; sin adaptador de armonización entre países; reutilización obligatoria de infraestructura de Sefix; bodega propia versionada; validación obligatoria antes de aceptar datos nuevos; transparencia metodológica por indicador; confiabilidad diferenciada por campo; mecanismos mixtos dentro de una familia; distinción "sin mecanismo" vs. "mecanismo caído"; distinción "problema de acceso" vs. "vacío real de contenido"). Se agregan dos:

1. **Nivel estatal derivado por agregación municipal**, cuando la fuente no lo provee de forma nativa (precedente: los 6 indicadores de INECC/ANVCC en Familia 5, y en general cualquier fuente municipal-only) — se etiqueta explícitamente como estimación derivada de Fontana, no como dato de la fuente.
2. **Patrón de estado de consulta por indicador**, para distinguir de forma consistente en toda la app: `ok` / `error_conexion` (falla técnica, reintentable) / `sin_datos_confirmado` (la fuente respondió pero no tiene registro para ese territorio) / `fuente_no_disponible` (infraestructura caída de forma sostenida, confirmado en más de un intento). Precedente idiomático ya existente en el código de Moddulo (`estadoApp?: "disponible" | "proximamente"`).

---

## 5. `AppContractConfig` de Fontana — consolidado

```json
{
  "tecnicaId": "T10",
  "componente": "Centinela",
  "pipModulos": [
    "contexto_pestel_social",
    "contexto_pestel_economico",
    "contexto_pestel_politico",
    "contexto_pestel_ecologico",
    "contexto_pestel_tecnologico"
  ],
  "deliveryMechanism": "canal1_ecosistema",
  "payloadSchema": "FontanaContextoSocioeconomico"
}
```

**Notas de este contrato:**

- Legal (L) queda excluida de `pipModulos` — ningún indicador de Fontana mide marco normativo/regulatorio (confirmado indicador por indicador, no asumido). Candidata a activarse en el futuro solo si se incorpora un indicador de esa naturaleza.
- El indicador F5-1 (factores geográficos) se clasifica como Social, no Ecológico — la conformación geográfica del territorio es contexto para entender a la sociedad, no una problemática ambiental.
- La Familia 5 completa (características territoriales) se integra dentro del Vector Social (V1) del MVP, no como un vector "Territorial" nuevo — corrección de la ficha original del MMEE, que mencionaba un vector que no existe entre los 6 vectores documentados del modelo.
- `payloadSchema` (`FontanaContextoSocioeconomico`) se estructura anidado por familia (Opción A, decidida con evidencia del código real de F3 — precedente análogo: `MapaPESTEL` en F2), con cada indicador como una entrada `IndicadorValor` (valor, unidad, nivel geográfico, naturaleza del dato, fuente, versión, confiabilidad) — misma información que alimentará `INDICATOR_REGISTRY.json`.
- Este es el primer caso real y completo de `AppContractConfig` en todo el ecosistema Eskemma (el registro `APP_TO_F3_CONTRACTS` está vacío en el código hasta ahora) — queda como precedente para las siguientes apps del catálogo de 35.

> **Nota de trazabilidad hacia el Paso 3:** en la arquitectura formal (`Fontana_T10_Arquitectura_Paso3_v2.md`) `deliveryMechanism` se renombra a `"api-push"` y `payloadSchema` a `"FontanaContextoTerritorial"` — ambos cambios están documentados ahí como decisiones explícitas del Paso 3, no contradicen este contrato preliminar, lo reemplazan formalmente.

---

## 6. Pendientes explícitos para retomar (no bloquean el Paso 3)

- Subir el archivo de `TIPOSEC` (Estudios Censales de Participación 2009-2024) siguiendo las instrucciones que Code debe precisar (ruta, columnas mínimas, formato de entrega) — resuelve el nivel de sección electoral de F1-11.
- Autorizar y ejecutar en el chat de T06 la ampliación de `CURATED_COLUMNS`/`ECEG_INDICATORS` con los cortes finos de edad detectados (diff ya preparado, no ejecutado).
- Reintentar en fecha posterior: mecanismo WFS del IIEG Jalisco (F5-9) y el buscador de OSC de Bienestar (F3-15).
- Confirmar periodicidad/año de referencia de los 6 indicadores de INECC/ANVCC (F5-10 a F5-17) cuando se implemente el pipeline real, dado que la fuente no lo declara en sus metadatos.
- Decidir la relación final entre Fontana y PESTEL.
- Poblar `INDICATOR_REGISTRY.json` con los 84 indicadores reales — se deja deliberadamente para el Paso 5 (no ahora), para no duplicar el esfuerzo de verificación en vivo que Code hará al construir cada conector.

---

## 7. Próximo paso

Con este catálogo cerrado y el `AppContractConfig` validado, Fontana retoma el **Paso 3: arquitectura funcional completa**, con este documento como línea base. Los componentes de arquitectura (Ingesta, Bodega, Validación, Cálculo/Agregación, Capa de Servicio, Interfaz), el flujo de datos bidireccional Fontana↔Sefix, y el esquema de `INDICATOR_REGISTRY.json` (sin poblar todavía) discutidos en esta conversación quedan como insumo directo para el documento formal de arquitectura, pendiente de redactar como archivo aparte.
