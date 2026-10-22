# Contrato de F2 · Análisis PESTEL (M1) y motores M2–M5

Estado al 26-10-22 (HEAD `c3b4890`). Describe lo que el código hace hoy; cada afirmación lleva el archivo y la función que la sostiene. Si cambia el código, cambia este documento. **No es historia**: los commits de la ronda están en la entrada de `CLAUDE.md` («Historial de Sprints», 26-10-15 a 26-10-22).

Nota sobre `docs/moddulo/arquitectura/` (junio de 2026): quedó **superada** en esta parte. No conoce `phases.exploracion.m1`, la copia congelada, los sellos ni la compuerta; no se actualiza (es una instantánea) y no debe usarse para F2.

La sección **Provisional** (al final) NO es contrato estable.

---

## 1. Modelo `phases.exploracion.m1`

Tipos en `types/moddulo.types.ts` (`M1Datos`, `M1Edicion`, `M1Aprobacion`, `M1Generacion`, `M1Finalizacion`). Vive junto a `linkedSource.payload` (el análisis de trabajo), `draftDVS`, `dvs` y `motorAprobaciones`, todos dentro de `phases.exploracion`.

| Campo | Qué es | Quién lo escribe |
|---|---|---|
| `linkedSource.payload` | El análisis PESTEL de trabajo (`MapaPESTEL`). | Los tres escritores de M1 (`generate-m1-express`, `import-pestel`, `link-moddulo`) y `m1-edit` (narrativa y clasificación). |
| `m1.creadoEn` | Cuándo se generó o importó este M1. | `camposNuevoM1` (`lib/moddulo/m1Escritura.ts`): reemplaza todo `m1` por `{ creadoEn }`, vacía `motorAprobaciones` y borra `draftDVS`. No toca `dvs`. |
| `m1.ediciones` | Por ruta (`P.narrativa`, `L.clasificacion`…): original de la IA, valor editado, autor y fecha. | `m1-edit` con `registrarEdicion` (`m1Aprobacion.ts`). Volver al original borra la entrada; la narrativa se compara recortada (`mismoValorDeEdicion`). |
| `m1.aprobacion` | `{por, en, huella, categoriasEditadas, total, mapa}`; `mapa` es la **copia congelada** de lo aprobado. | `m1-approve`. |
| `m1.generacion` | `{huella, en}`: de qué aprobación salió el **borrador** de motores. | `generate-dvs` (modo borrador). |
| `m1.finalizacion` | `{huella, en}`: de qué aprobación salió el **Reporte F2** (`dvs`) finalizado. | `finalize-dvs` (huella de `m1.generacion` leída dentro de su transacción; sin generación borra el sello) y `generate-dvs` en modo final. Sin registro `m1` no se escribe. |
| `m1.reabiertoEn/Por` | El usuario reabrió el M1 aprobado y aún no lo vuelve a aprobar. | `m1-reopen`. |

**Huella** (`lib/moddulo/m1Huella.ts`, `huellaMapaPESTEL`): sha-256 de la serialización estable del objeto guardado, independiente del orden de claves. Solo el servidor la calcula (usa `node:crypto`). **Invariante:** no depende del texto que reciben los prompts; `m1Huella.ts` no importa `prompts.ts` (una prueba lee el fuente para mantenerlo).

### Estados (`estadoM1`, `lib/moddulo/m1Aprobacion.ts`)
`sin_m1` · `sin_m1_con_restos` · `anterior` (hay análisis y `dvs` o restos, **sin** registro `m1`) · `borrador` · `reabierto` · `aprobado` (la aprobación existe y su huella coincide con la del payload actual: `aprobacionValida`).

### Qué conserva cada acción
| Acción (ruta) | Escribe | No toca |
|---|---|---|
| Reabrir (`m1-reopen`) | Borra solo `m1.aprobacion`; marca `reabiertoEn/Por`. | `dvs`, `draftDVS`, `motorAprobaciones`, `m1.generacion`, `m1.finalizacion`. |
| Editar (`m1-edit`, solo Express) | `payload` y `m1.ediciones` en una transacción. | Todo lo demás. |
| Aprobar (`m1-approve`) | `m1.aprobacion` con copia congelada. Si el contenido aprobado **difiere** del que generó el borrador: borra `draftDVS`, `motorAprobaciones` y `m1.generacion` en la misma transacción (conservación diferida: si es idéntico, se conservan). | `dvs`, `m1.finalizacion`. |
| Generar borrador (`generate-dvs`) | `draftDVS`, `motorAprobaciones: {}`, `m1.generacion`. | `dvs`. |
| Finalizar (`finalize-dvs`) | Reemplaza `dvs` (copia previa a `dvsVersiones`), borra `draftDVS` y `motorAprobaciones`, escribe `m1.finalizacion`. | `m1.aprobacion`. |
| Nuevo M1 (los tres escritores) | `camposNuevoM1`. | `dvs`. |

Todas las rutas de M1 responden `409 fase_cerrada` con la fase cerrada (`lib/moddulo/faseCerrada.ts`, `exploracionCerrada`); ver «Provisional».

## 2. Compuerta de M2–M5

`decidirCompuertaM1` (`lib/moddulo/compuertaM1.ts`): sin registro `m1` o sin payload → `sin_m1` (el proyecto anterior sigue como siempre); aprobación vigente y copia congelada cuya huella coincide con `aprobacion.huella` → `pasa` (devuelve la **copia** y la huella); en otro caso `bloquea` (`no_aprobado` o `copia_inconsistente`).

- `generate-dvs`, `regenerate-m5`, `approve-motor`, `save-draft` y `finalize-dvs` responden `409 m1_no_aprobado` (`respuestaM1NoAprobado`) cuando la compuerta bloquea, **antes de llamar al modelo**.
- `generate-dvs` y `regenerate-m5` generan desde la **copia congelada**, no desde el payload, y capturan la huella al inicio.
- La escritura final es una transacción que revalida con `coincideCompuertaM1` contra la huella capturada; si el M1 se reabrió o se aprobó otro contenido mientras el modelo generaba, responde 409 sin escribir.
- Proyectos sin `m1` o sin payload (anteriores, formulario, tras desvincular): nada cambia (`sin_m1`).

## 3. Precedencia del análisis aprobado en los prompts

- `seccionPrecedenciaPESTL(aprobado)` (`lib/ai/phases/prompts.ts`) va en el prompt de **usuario** de M2, M3, M4 y M5, después del mapa y antes de las instrucciones; el prompt de sistema no la lleva.
- Cuerpo común (`PRECEDENCIA_PESTL_CUERPO`): la clasificación y la narrativa de cada dimensión son la lectura vigente y prevalecen sobre las señales individuales y sobre cualquier otra lectura del motor; las señales son evidencia y pueden señalar matices sin cambiar esa lectura.
- Dos aperturas: `PRECEDENCIA_PESTL_APROBADO` (compuerta pasada) y `PRECEDENCIA_PESTL_VIGENTE` (proyecto sin registro `m1`; no afirma aprobación). No se marcan las categorías editadas.
- **Serialización sin límites** (`serializeMapaPESTEL`): todas las señales de cada categoría en el orden de entrada, descripción y narrativa íntegras, `(Fuente: X)` solo si la fuente no está vacía; no emite `fechaCorte`, `nivelConfianza`, `origenInternacional` ni la marca de escalada. Con la serialización sola sobre `MAX_CHARS_MAPA_SERIALIZADO` (150 000) lanza `MapaDemasiadoGrandeError`; `generate-dvs` y `regenerate-m5` responden `422 mapa_demasiado_grande` antes de llamar al modelo y sin escribir (`lib/moddulo/respuestaMapaDemasiadoGrande.ts`).
- Fallo del modelo: 500 `fallo_modelo` con `causa` (`causaDeFalloModelo`, `lib/moddulo/registroModelo.ts`), sin devolver el mensaje del proveedor.

## 4. Vigencia del Reporte F2 y cierre de la fase

- `estadoM1` calcula `dvsDeOtroAnalisis`: con aprobación válida y `dvs`, es `m1.finalizacion.huella !== aprobacion.huella`; **regla de compatibilidad** para un `dvs` finalizado antes del sello: se asume vigente solo si no hay `draftDVS` pendiente. Límite conocido: un `dvs` vigente con un borrador sobrante se marca como de otro análisis.
- `motivoNoCerrarF2` (`lib/moddulo/pantallaM1.ts`) es la **única** decisión de cierre; la usan `complete-phase` (`app/api/moddulo/projects/[projectId]/complete-phase/route.ts`) y el botón «Cerrar Fase 2». Motivos: `ya_cerrada`, `m1_no_aprobado`, `reporte_f2_no_finalizado`, `reporte_f2_de_otro_analisis`. Sin registro `m1` solo se exige el Reporte F2.
- Una fase ya cerrada responde `200 {yaCerrada}` antes de cualquier validación, sin reescribir `completedAt` ni el RDA; el resumen del GET fuerza `dvsDeOtroAnalisis` a falso (`resumenM1ParaCliente`, `lib/moddulo/m1Servidor.ts`).
- `dvsVersiones`: cada `dvs` reemplazado se copia a `moddulo_projects/{id}/dvsVersiones` (`lib/moddulo/dvsVersiones.ts`, `reemplazarDVSConVersion`).

## 5. Línea de trazabilidad

Una sola línea, calculada al mostrar; no se escribe ni se migra nada. `resumenM1ParaCliente` entrega dos valores:

- `trazabilidad` (`lineaTrazabilidadReporte`, `pantallaM1.ts`): para el Reporte F2 (encabezado de `DVSView` y descarga). Exige Reporte F2. Con M1 aprobado, aprobación válida y Reporte de esa aprobación: «Análisis aprobado sin ajustes el …» o «Análisis revisado y ajustado por el usuario el …, en N de T categorías» (`lineaTrazabilidadM1`, `m1Aprobacion.ts`). Estado `anterior` con Reporte F2: `TEXTO_ANTERIOR` («Aprobación no registrada (proyecto anterior)»). En cualquier otro caso, `null`.
- `trazabilidadPestel` (`lineaTrazabilidadPestel`): para la descarga del PESTEL. No depende de que exista un Reporte F2 ni de que sea vigente: aprobación válida → línea de aprobación; `anterior` → `TEXTO_ANTERIOR`; el resto `null`.
- Sin origen (Centinela/Express) en la línea. Las descargas (`formatF2Report`, `formatPestelAnalysis`, `lib/moddulo/reportFormatters.ts`) aceptan la línea; sin ella su salida es idéntica. La descarga del PESTEL usa la copia aprobada (`m1.datos.aprobacion.mapa`) cuando la aprobación es válida.

## 6. Mapa de los criterios de suficiencia

- `elegirMapaParaCriterios` (`m1Aprobacion.ts`): copia aprobada si la aprobación es válida; si no, el payload. `mapaParaCriterios` y `proyectoConMapaParaCriterios` (`m1Servidor.ts`) lo aplican en el servidor: `complete-phase` pasa a `planRDAUpdate` el proyecto con esa copia en la ranura del payload (`lib/moddulo/rda.ts` lo importa el cliente y no puede calcular huellas). La pantalla lo usa en `handleOpenReview`.
- **No tiene efecto observable hoy**: con aprobación válida la copia y el payload tienen la misma huella (medido con los 11 proyectos con análisis).
- Recomendaciones de los criterios 1, 8 y 9 por origen: `getRecomendacionDVS(id, origen)` (`lib/moddulo/dvs-criteria.ts`); el ítem del RDA guarda `origenAnalisis`. `origenDeAnalisis(kind)`: todo `kind` distinto de `T22` es Express. El criterio 8 con una dimensión prioritaria en NEUTRAL sigue siendo advertencia; el criterio 10 es siempre falso al evaluar.

---

## Provisional — NO estable (vinculado al Bloque 4, «reapertura de fases cerradas con trabajo posterior»)

1. **Contención de fase cerrada.** Con F2 cerrada, `generate-m1-express`, `import-pestel`, `link-moddulo`, `unlink-pestel`, `m1-edit`, `m1-approve` y `m1-reopen` responden `409 fase_cerrada`; la pantalla no avisa de XPCTO modificado y no bloquea acciones del reporte. Es una medida de contención, no el diseño final: el Bloque 4 decide cómo se reabre una fase cerrada y qué pasa con lo construido encima (F3).
2. **Regla de `elegirMapaParaCriterios`.** Hoy es equivalente a leer el payload (con aprobación válida ambos tienen la misma huella). `m1-reopen` **borra la aprobación** (`phases.exploracion.m1.aprobacion`), así que al reabrir una fase cerrada no habría copia que elegir y la regla podría **dejar de proteger algo**. Habrá que revisarla en el Bloque 4 (¿se conserva la copia de la fase cerrada?).
3. **Procedencia mixta (N6).** `POST /api/centinela/pestel/project` escribe `sourceId`, `kind: "T22"` y `componente: "centinela"` en `linkedSource` al crear el proyecto de PESTEL desde F2, dejando el payload Express hasta que `import-pestel` lo reemplace. Durante esa ventana `origenDeAnalisis` dice «Centinela»: las recomendaciones por origen del RDA, el origen guardado en el ítem y `permisoEdicionM1` pueden mostrar el origen equivocado. Abierto para el Bloque 4 / ronda H16.
4. **Camino legado de `generate-dvs`.** Si no hay payload, `runLegacyPath` lee `pestel_analyses/{sourceAnalysisId}` en vivo en lugar de una copia aprobada (residual de N12). No se retira aquí; paso aparte antes de la Beta, con medición previa de cuántos proyectos lo usan.
5. **Bloqueo por Reporte F3 existente** (`reemplazo_bloqueado`) en los candados de reemplazo y de generación de F3: provisional hasta que exista cómo reabrir F3 o marcar lo derivado como desactualizado.
