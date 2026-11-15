// 7b-7 — siembra compartida de las pruebas de canal3/vincular (no es una prueba).
import type { ModduloProject } from "@/types/moddulo.types";

export const UID = "uidA";
export const PROJECT_ID = "projA";
export const RESULTADO_ID = "res1";
export const OWN_PATH = `moddulo/${UID}/${PROJECT_ID}/f3/${RESULTADO_ID}/archivo.pdf`;
export const SESION_FONTANA = "sesF1";

export const rutaProyecto = `moddulo_projects/${PROJECT_ID}`;
export const rutaResultado = `${rutaProyecto}/f3Resultados/${RESULTADO_ID}`;

export const territorioJalisco = { nivel: "estatal", nombre: "Jalisco", estado: "Jalisco", pais: "México" };
export const territorioYucatan = { nivel: "estatal", nombre: "Yucatán", estado: "Yucatán", pais: "México" };

/** Documento CRUDO del proyecto (lo que lee la transacción). */
export function proyectoDoc(extra: Record<string, unknown> = {}) {
  return {
    name: "Proyecto de prueba",
    type: "electoral",
    territorio: territorioJalisco,
    xpcto: { tiempo: { fechaLimite: "2026-12-31" } },
    phases: { investigacion: { fontanaPendiente: { sesionId: SESION_FONTANA, territorio: "x", fechaCreacion: "2026-11-01" } } },
    ...extra,
  };
}

export const metadatosFuente = {
  nombreHerramienta: "Test",
  territorioDeclarado: territorioJalisco,
  fechaObtencion: "2026-01-01",
  metodoDeclarado: "prueba",
  familiaMetodologica: "otro",
  tipoProyectoDeclarado: "electoral",
};

export const bodyValido = {
  projectId: PROJECT_ID,
  resultadoId: RESULTADO_ID,
  storagePath: OWN_PATH,
  nombre: "archivo.pdf",
  tipo: "application/pdf",
  metadatosFuente,
  moduloPIP: "¿Pregunta?",
  cobertura: { completa: true },
};

export const comoProject = (doc: unknown) => doc as unknown as ModduloProject;
