# Todo: 3 huecos de IDOR restantes (auditoría de patrones, 2026-09-18)

Mismo patrón que el IDOR de Canal 1/Canal 3 (`lib/moddulo/storagePathAuth.ts`).
No se toca lógica de negocio más allá del guard. NO se tocan:
`notifications/route.ts`, `auth/find-user`, `test-admin`, `posts/[id]`.

## Hallazgos verificados por lectura de código (no asumidos)

- **H1** `f3/confirm/route.ts`: mismo flujo que Canal 1/3 — el `storagePath`
  viene de `request-upload` (`moddulo/${uid}/${projectId}/f3/...`). El guard
  existente aplica tal cual (`projectId` y `session.uid` en scope).
- **H2** `chat/[phaseId]/route.ts`: `projectId` SÍ está en scope antes de
  cualquier uso (línea 33; `getProject` en 43). El cliente (único: `ModduloChat.tsx:119`)
  arma `moddulo/${uid}/${projectId}/fases/${phaseId}/attachments/...` →
  el prefijo del guard existente aplica. PERO la estructura difiere: es un
  ARREGLO (`attachments[]`), `storagePath` es OPCIONAL, y `extractTextPerFile`
  cae a `fetch(attachment.url)` si falta. Un guard que solo valide el
  `storagePath` "cuando viene" se salta omitiéndolo → hay que exigirlo.
  Ajuste: helper nuevo que compone `esStoragePathDeUsuario` sobre el
  arreglo, fail-closed (no-arreglo, elemento malformado o sin storagePath → false).
- **H3** `pestel/project/route.ts` POST: `modduloProjectId` se usa en 4 sitios
  (write-back del dedup, lectura del guard de conflicto, lectura de
  `confirmReplace`, write-back final). Un solo `getProject(modduloProjectId,
  session.uid)` temprano (copiado de `link-moddulo`) los cubre a todos.

## Task 1: helper `sonAdjuntosDeUsuario` (para H2)
- [ ] `lib/moddulo/storagePathAuth.ts` — compone `esStoragePathDeUsuario`
- [ ] Acepta `unknown`; false si no es arreglo, si un elemento no es objeto
  o si `storagePath` no es string que pase el guard

## Task 2: H1 — `confirm/route.ts`
- [ ] Guard tras validar campos requeridos, antes de `getProject` → 403

## Task 3: H2 — `chat/[phaseId]/route.ts`
- [ ] Guard tras validar `projectId`, antes de cualquier I/O → 403

## Task 4: H3 — `pestel/project/route.ts` POST
- [ ] `getProject(modduloProjectId, session.uid)` tras validar `tipo`,
  antes del dedup → 404 (mismo status/mensaje que `link-moddulo`)

## Task 5: pruebas de regresión (Vitest)
- [ ] `confirm/route.test.ts`, `chat/[phaseId]/route.test.ts`,
  `pestel/project/route.test.ts` — 401/400/403|404/200 por endpoint,
  con assert de cero llamadas downstream en el camino de rechazo
- [ ] Tests unitarios de `sonAdjuntosDeUsuario`

## Task 6: verificación real (usuarios sintéticos, Firebase real, HTTP real
del handler) para LOS 3 endpoints; script desechable, limpieza verificada

## Task 7: check-docs-freshness + ¿CLAUDE.md/manifiesto?

## Task 8: code-review-and-quality + tsc --noEmit + next build
