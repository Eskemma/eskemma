# Sefix — Matriz de Niveles Electorales

**Versión:** 1.0 — 2026-07-10  
**Fuente de verdad para:**
- `NIVEL_MATRIX` / `CONTRASTE_MAP` en `app/moddulo/proyecto/[projectId]/exploracion/page.tsx`
- `getSefixPriority` en `lib/sefix/sefixContext.ts`
- Etiquetas de granularidad en widget y en `buildSourcesSection` (`lib/ai/phases/prompts.ts`)

Antes de modificar la matriz de niveles, la nomenclatura de granularidad, o la
resolución de scope territorial, consultar este documento como fuente de verdad.
No usar la memoria de sesión ni el código existente como referencia primaria.

---

## Criterio de nomenclatura de granularidad

| Etiqueta | Cuándo aplica |
|----------|---------------|
| **"Elección de mayoría relativa [en {Entidad} / a nivel Nacional]"** | El dato representa UNA SOLA contienda electoral real con un ganador oficial. El número de votos es el resultado directo de esa elección. |
| **"Promedio ponderado de votación [en {Entidad} / a nivel Nacional]"** | El dato es un AGREGADO que el sistema calcula a partir de VARIAS contiendas distintas (distritos, municipios, estados). No existe una sola "elección estatal de diputados" — son N elecciones distritales que promediamos. |

Cargos directos (una sola contienda): **Presidencia, Senaduría, Gubernatura, Ayuntamiento en municipio específico, Diputación en distrito específico.**  
Cargos agregados (promedio calculado): **Diputados Federales/Locales promedio de entidad, Ayuntamientos promedio de entidad.**

---

## Matriz de niveles electorales

| Proyecto (nivel) | Dato primario | Granularidad primario | Contraste 1 | Contraste 2 | Contraste 3 |
|---|---|---|---|---|---|
| **Diputación Federal** | Diputación Federal | Mismo distrito federal si se especifica; si no, promedio de distritos federales de la entidad | Presidencia (nacional, directo) | Senaduría (misma entidad, directo) | Gubernatura (misma entidad, directo) |
| **Senaduría** | Senaduría | Misma entidad, directo | Presidencia (nacional, directo) | Diputación Federal (promedio de distritos de la entidad) | Gubernatura (misma entidad, directo) |
| **Presidencia** | Presidencia | Nacional, directo | Senaduría (promedio nacional, mismo año) | Diputación Federal (promedio nacional, mismo año) | — |
| **Gubernatura (Estatal)** | Gubernatura | Misma entidad, directo | Diputación Local (promedio de la entidad) | Ayuntamiento (promedio de la entidad) | Diputación Federal (promedio de la entidad) |
| **Diputación Local** | Diputación Local | Mismo distrito local si se especifica; si no, promedio de distritos locales de la entidad | Gubernatura (misma entidad, directo) | Ayuntamiento (promedio de la entidad) | Diputación Federal (promedio de la entidad) |
| **Ayuntamiento** | Ayuntamiento | Mismo municipio, directo | Diputación Local (promedio de la entidad) | Gubernatura (misma entidad, directo) | — |

---

## Etiquetas de granularidad por cargo y scope

| Cargo | Scope | Etiqueta en widget | Etiqueta en prompt (buildSourcesSection) |
|---|---|---|---|
| Presidencia | Nacional (siempre) | `Elección de mayoría relativa a nivel Nacional` | `[Elección de mayoría relativa a nivel Nacional]` |
| Senaduría | Entidad | `Elección de mayoría relativa en {Estado}` | `[Promedio ponderado de votación en {ESTADO}]`* |
| Gubernatura | Entidad | `Elección de mayoría relativa en {Estado}` | inferido de `r.estado` |
| Diputación Federal — distrito resuelto | Distrito específico | `Dtto. Elect. Federal {NN} - {Ciudad}` | `[Dtto. Elect. Federal {NN} - {Ciudad}]` |
| Diputación Federal — promedio | Entidad | `Promedio ponderado de votación en {Estado}` | `[Promedio ponderado de votación en {ESTADO}]` |
| Diputación Local — distrito resuelto | Distrito específico | `Dtto. Elect. Local {NN} - {Ciudad}` | `[Dtto. Elect. Local {NN} - {Ciudad}]` |
| Diputación Local — promedio | Entidad | `Promedio ponderado de votación en {Estado}` | `[Promedio ponderado de votación en {ESTADO}]` |
| Ayuntamiento — municipio específico | Municipio | `{Nombre del municipio}` | (no aplica: ayun no llega a sefixContext sin geo) |
| Ayuntamiento — promedio | Entidad | `Promedio ponderado de votación en {Estado}` | `[Promedio ponderado de votación en {ESTADO}]` |

\* Senaduría en `buildSourcesSection`: `r.estado` = nombre del estado en mayúsculas (ej. "JALISCO"),
`r.distrito` = null → etiqueta: `[Promedio ponderado de votación en JALISCO]`.
Nota: Senaduría es técnicamente "directa" pero en `sefixContext.ts` se obtiene con
`getResultadosByEstado(estado, "senadores")` que agrega las 3 fórmulas (MR + RP listas A/B).
Si en el futuro se separa la MR de la representación proporcional, revisar este criterio.

---

## Implementación — referencias de código

| Concepto | Archivo | Función/Const |
|---|---|---|
| Prioridad de cargos por tipo/nivel | `lib/sefix/sefixContext.ts` | `getSefixPriority()` |
| Scope de contrastes | `page.tsx` | `CONTRASTE_MAP` |
| Etiquetas de cargo | `page.tsx` | `ELEC_LABELS` |
| Granularidad (widget) | `page.tsx` | `fetchSefixEleccion()` — bloque `granularity = ...` |
| Granularidad (prompt) | `lib/ai/phases/prompts.ts` | `buildSourcesSection()` — variable `geo` |
| Fetch presidencia nacional | `lib/sefix/sefixContext.ts` | `fetchCargoPESTEL()` — `estadoForQuery = cargoKey === "pdte" ? "" : estadoNombre` |
| Formato label distrito | `lib/sefix/districtMatching.ts` | `formatDistritoCabecera()` |

---

## Notas de bugs corregidos

- **2026-07-10**: `buildSefixContext` pasaba `estadoNombre = "Jalisco"` para `pdte` →
  Claude recibía resultados presidenciales de Jalisco en vez de nacionales.
  Fix: `estadoForQuery = cargoKey === "pdte" ? "" : estadoNombre` en `fetchCargoPESTEL`.
