// 7b-7 — siembra compartida de las pruebas de canal1/entregar (no es una prueba).
import type { ModduloProject } from "@/types/moddulo.types";

export const UID = "uidA";
export const PROJECT_ID = "projA";
export const SESION_ID = "sesA";
export const OWN_PATH = `moddulo/${UID}/${PROJECT_ID}/f3/res1/fontana-contexto.json`;
export const REPORTE_PATH = `moddulo/${UID}/${PROJECT_ID}/f3/res1/reporte.md`;
export const RESULTADO_PREVIO = "res-previo";

export const rutaProyecto = `moddulo_projects/${PROJECT_ID}`;
export const rutaSesion = `fontana_sesiones/${SESION_ID}`;
export const rutaResultado = (id: string) => `${rutaProyecto}/f3Resultados/${id}`;

/** Documento CRUDO del proyecto (lo que lee la transacción). `asig` modifica la asignación Canal 1/T10. */
export function proyectoDoc(asig: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    name: "Proyecto de prueba",
    phases: {
      investigacion: {
        f3TareasPIP: [
          {
            pipItemId: "pip1",
            asignaciones: [
              {
                asignacionId: "asig1",
                tipo: "primaria",
                canal: "canal1",
                tecnicaId: "T10",
                justificacion: "test",
                estado: "en_curso",
                activada: true,
                ...asig,
              },
              // Otra asignación de la misma tarea: no debe tocarse.
              {
                asignacionId: "asig2",
                tipo: "complementaria",
                canal: "canal3",
                justificacion: "otra vía",
                estado: "pendiente",
                activada: true,
              },
            ],
          },
        ],
      },
      exploracion: { dvs: { pip: [{ pipItemId: "pip1", pregunta: "¿Test?" }] } },
    },
    ...extra,
  };
}

export function sesionDoc(extra: Record<string, unknown> = {}) {
  return { uid: UID, modduloProjectId: PROJECT_ID, tareaPipIds: ["pip1"], ...extra };
}

/** Lo que devuelve getProject (copia del proyecto que usa el pre-chequeo). */
export const comoProject = (doc: unknown) => doc as unknown as ModduloProject;
