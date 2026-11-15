// lib/versionado/index.ts — API pública del historial unificado (C1a). SOLO SERVIDOR.
// Para el cliente importar únicamente `@/lib/versionado/tipos` (y, si hace falta, `retencion` o `tamano`,
// que son puros); `huella`, `serializacion` y `registrar` usan node:crypto o el Admin SDK.
export * from "./tipos";
export { huellaContenido, huellaTupla, huellasPorItem, diffItems } from "./huella";
export { decidirPoda, artefactosNoRecuperables, revisionEsParcial } from "./retencion";
export { estimarBytes, evaluarTamanoVersion, decidirContenido, reportarTamano } from "./tamano";
export { prepararVersion, aplicarVersion, traducirErrorHistorial, idRevision, idVersion } from "./registrar";
export type { CambioArtefacto, CambioFase, PlanVersion, ResultadoVersion } from "./registrar";
