# Runbook — Purga automática de adjuntos de Fontana (`purgeAdjuntos`)

`functions/src/fontana/purgeAdjuntos.ts` — Cloud Function programada que
borra los documentos de `fontana_sesiones/{id}/adjuntos` cuyo `cargadoEn`
supera la retención (**90 días en producción**). Corre `every 24 hours`,
zona `America/Mexico_City`, `timeoutSeconds: 300`, `memory: "256MiB"`.

- La lógica de borrado está en `purgarAdjuntosVencidos(db, cutoff)` (función
  exportada, testeable). El wrapper `onSchedule` solo calcula el `cutoff`
  desde `DIAS_RETENCION` y llama a esa función.
- `cutoff` es un `Date` (`new Date(Date.now() - DIAS_RETENCION*MS_POR_DIA)`);
  Firestore lo compara contra el campo `cargadoEn` (`Timestamp`) sin
  conversión manual.

---

## Estado actual

En la rama de trabajo (`develop`):

- `DIAS_RETENCION = 90` (valor de producción), sin bloque de advertencia.
  El código está en el estado exacto que describe el paso (a) de abajo —
  listo para deploy, **pendiente de decisión y ejecución**.
- `firebase.json` tiene un bloque `emulators` (functions/firestore/pubsub/ui)
  — dev only, `firebase deploy` lo ignora. Se puede quitar si molesta.

En la rama `test/purge-adjuntos-dev-verification` (NO se mergea):

- Los scripts de verificación: `scripts/_purge-adjuntos-emulator-test.mjs`,
  `scripts/_purge-adjuntos-wrapper-e2e.mjs` (cabecera "no se mergea").
- `DIAS_RETENCION = 1 / 1440` (1 minuto) con bloque ⚠️ — solo para poder
  re-verificar la purga en minutos en el emulador.

## Verificación hecha en desarrollo (emulador) — 2026-09-01

Con JDK 25 (`JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home`;
el emulador de Firestore exige Java ≥ 21) y
`firebase emulators:start --only functions,firestore,pubsub`:

1. **Lógica** (`_purge-adjuntos-emulator-test.mjs`, invoca
   `purgarAdjuntosVencidos` real): sembradas 3 sesiones — adjunto de 10 min,
   de 3 min (otra sesión), 2 recientes, y una sesión sin adjuntos. Con
   `cutoff = now-60s`: borró **solo** los 2 vencidos (uno en cada sesión →
   confirma que itera todas), conservó los 2 recientes, `borrados === 2` y
   exactamente 2 documentos desaparecieron (nada de más). Path
   `viejos.empty` (sesión sin adjuntos) sin error. ✅
2. **Wrapper E2E** (`_purge-adjuntos-wrapper-e2e.mjs` + `curl` al shim del
   emulador `POST .../us-central1/purgeAdjuntos-0`): el `onSchedule` corrió
   entero, log `[purgeAdjuntos] 1 adjunto(s) de Fontana vencidos purgados.`,
   borró el vencido y conservó el reciente. ✅

---

## PENDIENTE DE EJECUCIÓN — pasos para el deploy real a producción

> ⛔️ **No ejecutado.** Correr esto solo cuando se decida activar la purga en
> producción. Requiere credenciales de `eskemma-3c4c3` y permiso de deploy.

### a. Confirmar el umbral de producción

En `develop` el código ya está en este estado (se revirtió tras la
verificación en desarrollo, 26-09-01). Solo hay que confirmarlo antes de
seguir:

```bash
grep -n "DIAS_RETENCION =" functions/src/fontana/purgeAdjuntos.ts
# debe imprimir:  const DIAS_RETENCION = 90;
grep -c "VALOR DE PRUEBA" functions/src/fontana/purgeAdjuntos.ts
# debe imprimir:  0
```

Estado esperado del archivo: `DIAS_RETENCION = 90`, sin bloque ⚠️, con el
split `purgarAdjuntosVencidos` / `calcularCutoffRetencion`, el `cutoff` como
`Date`, `schedule` / `timeoutSeconds` / `memory`, la iteración
sesión-por-sesión y el batch de 400 — la versión ya verificada en el
emulador. El bloque `emulators` de `firebase.json` puede quedarse (dev only,
`firebase deploy` lo ignora) o quitarse.

### b. Build + deploy

```bash
cd functions && npm run lint && npm run build && cd ..
firebase deploy --only functions --project eskemma-3c4c3
```

El `predeploy` de `firebase.json` ya corre `lint` + `build` igual; el paso
manual es solo para ver que pasan antes.

**Qué esperar en la salida del deploy:**

- `✔  functions[purgeAdjuntos(us-central1)]` — creación o actualización, sin
  error.
- Primer deploy: línea tipo
  `Creating Cloud Scheduler job with name firebase-schedule-purgeAdjuntos-us-central1`.
- Sin prompt de borrado de otras funciones (el deploy solo toca
  `purgeAdjuntos` si es lo único que cambió; si no, revisar la lista que
  Firebase pide confirmar).

**En Google Cloud Console tras el deploy:**

- **Cloud Functions** → `purgeAdjuntos`: región `us-central1`, trigger
  *Cloud Pub/Sub* (topic `firebase-schedule-purgeAdjuntos-us-central1`),
  memoria 256 MiB, timeout 300 s, runtime Node 22.
- **Cloud Scheduler** → job `firebase-schedule-purgeAdjuntos-us-central1`:
  frecuencia `every 24 hours` (cron equivalente `0 */24 * * *` o el que
  genere Firebase), zona `America/Mexico_City`, estado *Enabled*, target
  Pub/Sub al topic de arriba.

### c. Confirmar que quedó con el valor de producción (90 días), no el de prueba

1. **Ejecución manual supervisada una vez** (Cloud Scheduler → job →
   *Force run*, o `gcloud scheduler jobs run firebase-schedule-purgeAdjuntos-us-central1 --location=us-central1`).
2. **Cloud Logging** del run: la línea
   `[purgeAdjuntos] N adjunto(s) de Fontana vencidos purgados.`
   - En una base recién estrenada `N` debe ser `0` (no hay adjuntos de > 90
     días todavía). Si `N` sale distinto de 0 en el primer run tras el
     deploy, **algo está mal** (¿quedó el umbral de prueba?, ¿`cargadoEn`
     mal escrito como string en vez de Timestamp?) — abortar y revisar.
3. **Prueba positiva controlada** (opcional, recomendada): en la consola de
   Firestore, crear a mano un doc en
   `fontana_sesiones/<sesión de prueba>/adjuntos/<id>` con
   `cargadoEn` = un Timestamp de hace 100 días y los demás campos de forma
   (`id`, `nombreArchivo`, `textoExtraido`, `tipoMime`). *Force run* del
   job. Confirmar en Firestore que ese doc desapareció y que ningún adjunto
   reciente (si los hay) se tocó. Borrar la sesión de prueba.
4. **Revisión del código desplegado**: en Cloud Functions → `purgeAdjuntos`
   → *Source*, verificar que el `DIAS_RETENCION` es `90` y que no está el
   bloque ⚠️.

### d. Rollback

Si algo sale mal: `firebase deploy --only functions` desde un commit
anterior, o en Cloud Scheduler *Pause* el job para detener las corridas
mientras se investiga (no borra la función).
