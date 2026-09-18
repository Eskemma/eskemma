# Todo: guards de integridad del chat de Moddulo (2026-09-18)

Base: forense sobre 11 proyectos reales (una sola cuenta de pruebas). B1
(confirmación antes de `__action`) queda FUERA — sin evidencia; documentado
en CLAUDE.md junto a la Regla de Oro #3.

## Task 1: reglas de prompt (cubre el hallazgo más frecuente)
- [x] `lib/ai/phases/prompts.ts` — bloque "LÍMITES DE TU INFORMACIÓN" en
  `MODDULO_BASE_IDENTITY` (heredado por las 9 fases): (a) sin acceso →
  "no tengo ese dato en este momento", sin inventar causa técnica; (b) sin
  presentar como verificado lo que no viene del contexto/usuario.
- [x] `prompts.test.ts` (11): las reglas están en las 3 fases con chat y en las 9.

## Task 2: guard de grounding, versión tolerante a formato
- [x] `lib/moddulo/extractedDataGrounding.ts` — determinista (justificado en
  el archivo): cifras (miles/decimales, millones, MDP, palabras), fechas
  (ISO/dd-mm-aa/texto/relativas/hoy), sumas-productos-conteos derivados.
- [x] `route.ts` — descarta ANTES de emitir y de escribir; aviso al usuario;
  respaldo = historial PERSISTIDO + adjuntos del turno + contexto inyectado +
  borrador XPCTO / adjuntos de F2 guardados + confirmación corta.
- [x] Tests: 42 unit (casos reales del forense + falsos positivos de formato)
  + 6 de ruta. Mutación: 3 capas desactivadas → fallan 3/6/6 tests.
- [x] Replay sobre las conversaciones reales (solo lectura).

## Fuera de alcance (reportado, no forzado)
- Omisión de un dato que el usuario sí dio (Kg5tOo, margen <5%).
- Parafraseo sin cifras/fechas (p. ej. nombre de institución equivocado).
- Dato ya contaminado en YgKs7M (~170,000): NO se toca sin confirmación.
