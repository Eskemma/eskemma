# Todo: helper geográfico único (2026-09-19)

Base: diagnóstico 2026-09-18/19 (4 fallos reales confirmados con datos reales).
Fuera de alcance (anotado en CLAUDE.md): guard de sincronización con la copia de
CF, canónico formal de distritos, desambiguación de texto libre ("México").

- [x] Paso 0 — investigación de "alcance nacional" (enum `nivel:"nacional"`, estado
  vacío/"Nacional"/"NACIONAL" en Sefix, clave `NACIONAL` en ENIGH, `nombre`=país
  "México" en territorios nacionales). Centinela: `resolverEstado("Nacional")` →
  unión discriminada `esNacional`; vacío NO es nacional en el helper compartido.
- [x] Paso 1 — `lib/geo/normalizacionGeografica.test.ts`: 18 tests fallaban contra
  el código anterior (4 bloques), 10 controles pasaban.
- [x] Paso 2 — `getPadronByGeo` compara por `claveComparacionMunicipio` (canónico +
  plegado Ñ/Ü). Sin coincidencia → cae al estatal DECLARADO (justificado abajo).
- [x] Paso 3 — `matchDistrito` compara por clave interna (sin acentos).
- [x] Paso 4 — `lib/geo/estados.ts` (`resolverEstado`, `resolverEstadoCve`,
  `esAlcanceNacional`, `claveAlmacenamiento`, catálogo); reemplaza 15 copias de
  `resolveEstadoCve`, `resolveEstadoName`, `getCveEntidad`; `ESTADO_CVE_MAP` se
  deriva del catálogo. Copia de CF: solo verificada (divergencias en test).
- [x] Paso 5 — `toStorageKey` normaliza por dentro; `out_pregenerate-sefix.ts` usa
  la misma función.
- [x] Display — `lib/geo/display.ts` (distrito con prefijo/MAYÚSCULAS; estado y
  municipio sin prefijo, con acentos donde la fuente los tiene).
- [x] Extra (hallazgo de la verificación real): `getPadronByEstado` devolvía null
  para los 4 estados con nombre DERFE distinto (MEXICO, COAHUILA DE ZARAGOZA,
  MICHOACAN DE OCAMPO, VERACRUZ DE IGNACIO DE LA LLAVE).
