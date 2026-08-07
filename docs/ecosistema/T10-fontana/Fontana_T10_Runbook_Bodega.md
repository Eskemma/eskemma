# Fontana (T10) — Runbook operativo de la bodega de datos

**Propósito:** documento operativo, no de arquitectura. Por cada fuente
ya integrada, responde: ¿cuándo hay que revisarla?, ¿qué comando corro?,
¿cómo confirmo que salió bien?, ¿qué hago si falla a medio camino?

**Alcance actual:** solo Familia 1 (Sociodemográficos), los 5 mecanismos
ya construidos (ECEG, ITER, Compendio 2010, CONAPO, Banxico). **Este
documento se actualiza conforme se construyan Familias 2-5** — no
agregar fuentes nuevas por adelantado, solo cuando existan de verdad.

---

## Persistencia de archivos crudos locales (`info_geo_eske/`)

Confirmado por inspección directa (2026-08-01): la carpeta
`info_geo_eske/` (~39 GB) vive en disco local
(`/Users/raul/Documents/development/eskemma/info_geo_eske/`) y está
excluida de git (`.gitignore:101`).

**La aplicación en producción nunca lee de esta carpeta.** Todos los
adaptadores de `lib/fontana/ingesta/` leen de Firebase Storage
(`fontana/bodega/`, `fontana/registry/`, `sefix/eceg_2020/`) vía Firebase
Admin SDK — nunca del disco local del equipo de desarrollo. Es seguro
respaldar `info_geo_eske/` fuera del proyecto (o eliminarla) sin ningún
efecto en la app en producción. Su único valor es como material de
investigación para desarrollo futuro (ej. reprocesar los XLSX crudos de
ECEG para desbloquear F1-10/F1-12).

---

## ECEG (F1-1, F1-3, F1-4, F1-5, F1-6, F1-7, F1-8, F1-9, F1-13, F1-14, F1-15, F1-19)

- **Cuándo revisar:** estática hasta el Censo 2030. Revisar solo si se
  decide desbloquear F1-10/F1-12 (requiere reprocesar los XLSX crudos de
  ECEG — workstream de Sefix, no de Fontana).
- **Comando:** `scripts/eceg-data-pipeline.ts` — vive en Sefix, no en
  Fontana. Coordinar con ese workstream antes de re-ejecutar; Fontana
  solo consume el resultado (`sefix/eceg_2020/` en Storage), no lo genera.
- **Cómo confirmar que salió bien:** `npx tsx scripts/verify-fontana-eceg.ts`
  — confirma valores reales para 2 territorios (Zapopan, Monterrey).
- **Si falla a medio camino:** el pipeline de Sefix escribe un archivo
  por estado (`sefix/eceg_2020/municipios/{01..32}.json`) — un estado que
  falla no corrompe los demás; re-ejecutar solo ese estado (ver el propio
  script de Sefix para su interfaz de argumentos).

## ITER (F1-2, F1-11)

- **Cuándo revisar:** estática hasta el Censo 2030 (dataset precomputado,
  no bajo demanda).
- **Comando:**
  ```bash
  npx tsx scripts/fontana-iter-pipeline.ts --estado <id> [--upload|--dry-run]
  npx tsx scripts/fontana-iter-pipeline.ts --all-estados [--upload|--dry-run]
  ```
  Usar `--dry-run` primero para validar sin escribir a Storage.
- **Cómo confirmar que salió bien:** `npx tsx scripts/verify-fontana-iter.ts`.
- **Si falla a medio camino:** el pipeline procesa por entidad — un
  estado que falla no afecta a los demás. Identificar qué archivos faltan
  en `fontana/bodega/iter_2020/{piramide,urbano_rural}/municipios/` (y el
  catálogo `iter_2020/catalogo_municipios/`) y re-ejecutar
  `--estado <id>` solo para esos.

## Compendio de Información Geográfica Municipal 2010 (F1-16)

- **Cuándo revisar:** sin mecanismo de refresco — el Compendio 2010 no
  tiene edición posterior confirmada. Revisar solo si INEGI publica una
  edición nueva (verificación manual esporádica, no programable; no hay
  comando de "actualizar todo").
- **Comando:** no aplica — es bodega bajo demanda con **caché
  permanente**. Cada municipio se descarga/parsea la primera vez que un
  proyecto real lo consulta (`lib/fontana/ingesta/compendio.ts`) y queda
  guardado para siempre en `fontana/bodega/compendio_2010/{estadoCve}{municipioCve}.json`.
- **Cómo confirmar que salió bien:** `npx tsx scripts/verify-fontana-compendio.ts`
  (y `verify-fontana-compendio-parse.ts` para el regex de parseo del PDF
  específicamente).
- **Si falla a medio camino:** si el regex no matchea el PDF de un
  municipio (formato distinto al esperado), el registro simplemente no
  se crea — la siguiente consulta a ese municipio reintenta sola, sin
  intervención manual, salvo que el formato del PDF de INEGI haya
  cambiado de verdad (en ese caso, ajustar el regex en `compendio.ts`).

## CONAPO — Razón de dependencia demográfica (F1-18)

- **Cuándo revisar:** bodega bajo demanda con caché permanente — **con
  una excepción real que sí requiere mantenimiento periódico**:
  `ANO_VIGENTE = "2026"` está hardcodeado en
  `lib/fontana/ingesta/conapo.ts` (criterio: "año en curso al momento de
  la implementación"). **Revisar y actualizar manualmente una vez al
  año** — no es un comando de script, es un cambio de código de una
  línea + redeploy.
- **Comando:** no aplica para el dato en sí (bajo demanda). Para el bump
  anual: editar `ANO_VIGENTE` en `conapo.ts`, verificar, desplegar.
- **Cómo confirmar que salió bien:** `npx tsx scripts/verify-fontana-conapo.ts`.
- **Si falla a medio camino:** CKAN de datos.gob.mx puede fallar por
  request — el adaptador no escribe caché parcial (solo guarda si la
  respuesta fue válida), así que no hay estado corrupto que limpiar,
  solo reintentar la consulta real. Nota de infraestructura: este host
  sirve una cadena TLS incompleta — `conapo.ts` usa `https` nativo con
  `rejectUnauthorized:false` como excepción acotada a este host (GET
  público, sin credenciales). Si datos.gob.mx corrige su certificado en
  el futuro, se puede quitar esa excepción sin cambiar el resto del
  adaptador.

## Banxico SIE — Remesas per cápita (F1-17)

- **Cuándo revisar:** bodega bajo demanda con **TTL de 30 días**
  (auto-revalidación en cada consulta real — sin intervención manual en
  operación normal, ya que Banxico publica remesas trimestralmente).
- **Comando:** no aplica — se revalida solo. Requiere `BANXICO_TOKEN`
  vigente en Firebase Secret Manager / `.env` (confirmar presencia con
  `[ -n "$BANXICO_TOKEN" ] && echo OK`, nunca imprimir el valor).
- **Cómo confirmar que salió bien:** `npx tsx scripts/verify-fontana-banxico.ts`.
- **Si falla a medio camino (API caída o token vencido):** el adaptador
  prefiere devolver el dato cacheado vencido a no devolver nada
  (`resolverRemesasEstatal`, `lib/fontana/ingesta/banxico.ts`) — la
  interfaz sigue mostrando un valor, aunque desactualizado, en vez de
  "sin dato". Nivel municipal: siempre `no_viable` — Banxico no publica
  remesas por municipio con un mecanismo de serie confirmado; esto no es
  una falla, es el estado permanente de esa celda.
