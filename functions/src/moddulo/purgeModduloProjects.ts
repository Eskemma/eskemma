// functions/src/moddulo/purgeModduloProjects.ts
// Purga real de proyectos de Moddulo en papelera — fase (c) del plan (ver
// CLAUDE.md, Historial de Sprints, papelera de proyectos). Fases (a)/(b) ya
// dejaron el soft-delete (deletedAt/deletedBy) y la UI de Papelera; ESTA
// pieza es la única implementación de borrado destructivo real, reusada por
// 2 disparadores (scheduled.ts: purga programada al vencer la retención;
// purgeNow.ts: "eliminar definitivamente ahora" desde la UI) — nunca
// reimplementada en Next.js (functions/ no puede importar lib/, y el
// borrado destructivo no debe vivir en 2 lugares).
//
// Orden (§11.1 del plan, idempotente en cada paso):
//   1. Storage — moddulo/{uid}/{projectId}/ para CADA colaborador (no solo
//      el dueño — §11.2, ver CLAUDE.md: sin evidencia real hoy de un
//      colaborador no-dueño con archivos, pero el diseño lo cubre como red
//      de seguridad estructural).
//   2. Back-link de PESTEL — pestel_projects con modduloProjectId ==
//      projectId pierden ese campo (puede haber más de 1 en teoría legacy
//      pre-guard de createProject; el guard de 26-09-29 hace que hoy nunca
//      debería haber más de 1 real).
//   3. Sesiones de Fontana vinculadas — fontana_sesiones con modduloProjectId
//      == projectId pierden ese campo. Esto SÍ desvincula sesiones de
//      Escenario A (tareaPipIds.length > 0), que el guard 409 del usuario
//      normal no deja tocar — aquí es intencional: el proyecto se está
//      destruyendo de forma permanente, no tiene sentido dejar el vínculo
//      colgado para siempre (decisión ya tomada: NO se relaja el guard de
//      usuario, la purga es la única vía de liberación).
//   4. Documento — SOLO al final, con admin.firestore().recursiveDelete()
//      (arrastra subcolecciones: changelog, f3Resultados — mismo mecanismo
//      ya usado para fontana_sesiones/{id}/{mensajes,adjuntos}).
//
// Guarda de concurrencia (§11.6): antes de CADA paso destructivo se relee
// moddulo_projects/{projectId} y se aborta (sin tocar lo que falte) si
// deletedAt ya no está presente o cambió de valor desde la lectura inicial
// — alguien restauró el proyecto, o lo volvió a borrar después (un
// deletedAt nuevo no es "el mismo borrado" que activó esta purga).
//
// Modo simulación (opts.modoReal === false, default en el primer deploy):
// recorre EXACTAMENTE los mismos pasos y condiciones, pero cada operación
// destructiva se reemplaza por una lectura equivalente (para contar cuánto
// se habría borrado) + logger.info — nunca ejecuta admin.storage()
// deleteFiles/update/recursiveDelete en modo real.

import * as admin from "firebase-admin";
import type {Bucket} from "@google-cloud/storage";
import {logger} from "firebase-functions";

export interface ResultadoPurga {
  projectId: string;
  estado:
    | "purgado"
    | "abortado_no_existe"
    | "abortado_no_en_papelera"
    | "abortado_restaurado_durante_purga";
  modoReal: boolean;
  archivosStorage: number;
  pestelDesvinculados: string[];
  fontanaDesvinculadas: string[];
  documentoBorrado: boolean;
  detalle: string[];
}

interface EstadoPapelera {
  existe: boolean;
  deletedAtMs: number | null;
  collaboratorsUids: string[];
}

/**
 * Lee el estado actual de papelera de un proyecto — usada tanto para la
 * lectura inicial como para la relectura de concurrencia antes de cada
 * paso destructivo.
 * @param {admin.firestore.Firestore} db instancia de Firestore.
 * @param {string} projectId id del proyecto.
 * @return {Promise<EstadoPapelera>} estado actual del documento.
 */
async function leerEstadoPapelera(
  db: admin.firestore.Firestore,
  projectId: string
): Promise<EstadoPapelera> {
  const snap = await db.collection("moddulo_projects").doc(projectId).get();
  if (!snap.exists) {
    return {existe: false, deletedAtMs: null, collaboratorsUids: []};
  }
  const data = snap.data() ?? {};
  const deletedAt = data.deletedAt as
    | admin.firestore.Timestamp
    | undefined;
  const collaborators = (data.collaborators ?? []) as {uid: string}[];
  return {
    existe: true,
    deletedAtMs: deletedAt ? deletedAt.toMillis() : null,
    collaboratorsUids: collaborators.map((c) => c.uid).filter(Boolean),
  };
}

/**
 * Confirma que el borrado en curso sigue siendo el MISMO borrado que lo
 * activó — mismo deletedAt, documento sigue existiendo. Se llama antes de
 * cada paso destructivo.
 * @param {admin.firestore.Firestore} db instancia de Firestore.
 * @param {string} projectId id del proyecto.
 * @param {number} deletedAtEsperadoMs el deletedAt capturado al iniciar.
 * @return {Promise<EstadoPapelera | null>} el estado actual si sigue
 *   vigente, o null si debe abortarse la purga en este punto.
 */
async function reconfirmarVigente(
  db: admin.firestore.Firestore,
  projectId: string,
  deletedAtEsperadoMs: number
): Promise<EstadoPapelera | null> {
  const estado = await leerEstadoPapelera(db, projectId);
  if (!estado.existe) return null;
  if (estado.deletedAtMs !== deletedAtEsperadoMs) return null;
  return estado;
}

/**
 * Purga un solo proyecto de Moddulo ya en papelera — Storage, back-links de
 * PESTEL/Fontana, y finalmente el documento con sus subcolecciones. Idempotente
 * en cada paso; aborta sin tocar lo restante si el proyecto fue restaurado o
 * vuelto a borrar durante la ejecución.
 * @param {admin.firestore.Firestore} db instancia de Firestore.
 * @param {Bucket} bucket bucket de Storage.
 * @param {string} projectId id del proyecto a purgar.
 * @param {{modoReal: boolean}} opts modoReal=false solo registra qué se
 *   habría borrado, sin ejecutar ninguna operación destructiva.
 * @return {Promise<ResultadoPurga>} resultado detallado de la purga.
 */
export async function purgarUnProyecto(
  db: admin.firestore.Firestore,
  bucket: Bucket,
  projectId: string,
  opts: {modoReal: boolean}
): Promise<ResultadoPurga> {
  const {modoReal} = opts;
  const detalle: string[] = [];
  const resultadoBase = {
    projectId,
    modoReal,
    archivosStorage: 0,
    pestelDesvinculados: [] as string[],
    fontanaDesvinculadas: [] as string[],
    documentoBorrado: false,
    detalle,
  };

  const inicial = await leerEstadoPapelera(db, projectId);
  if (!inicial.existe) {
    detalle.push("El proyecto ya no existe — nada que purgar.");
    return {...resultadoBase, estado: "abortado_no_existe"};
  }
  if (inicial.deletedAtMs === null) {
    detalle.push(
      "El proyecto no está en papelera (deletedAt ausente) — se aborta."
    );
    return {...resultadoBase, estado: "abortado_no_en_papelera"};
  }
  const deletedAtEsperadoMs = inicial.deletedAtMs;

  // ── Paso 1: Storage, por CADA colaborador ──────────────────────────
  let vigente = await reconfirmarVigente(db, projectId, deletedAtEsperadoMs);
  if (!vigente) {
    detalle.push(
      "Abortado antes de Storage: el proyecto fue restaurado o vuelto a borrar."
    );
    return {...resultadoBase, estado: "abortado_restaurado_durante_purga"};
  }
  let archivosStorage = 0;
  for (const uid of vigente.collaboratorsUids) {
    const prefix = `moddulo/${uid}/${projectId}/`;
    const [files] = await bucket.getFiles({prefix});
    if (modoReal) {
      if (files.length > 0) await bucket.deleteFiles({prefix});
    } else {
      logger.info(
        `[purgeModduloProjects][sim] ${files.length} archivo(s) bajo ${prefix}`
      );
    }
    archivosStorage += files.length;
  }
  const verbo1 = modoReal ? "borrados" : "a borrar";
  detalle.push(
    `Storage: ${archivosStorage} archivo(s) ${verbo1} en ` +
    `${vigente.collaboratorsUids.length} prefijo(s) de colaborador.`
  );

  // ── Paso 2: back-link de PESTEL ─────────────────────────────────────
  vigente = await reconfirmarVigente(db, projectId, deletedAtEsperadoMs);
  if (!vigente) {
    detalle.push(
      "Abortado antes de PESTEL: el proyecto fue restaurado o vuelto a borrar."
    );
    return {
      ...resultadoBase,
      archivosStorage,
      estado: "abortado_restaurado_durante_purga",
    };
  }
  const pestelSnap = await db
    .collection("pestel_projects")
    .where("modduloProjectId", "==", projectId)
    .get();
  const pestelDesvinculados: string[] = [];
  for (const doc of pestelSnap.docs) {
    if (modoReal) {
      await doc.ref.update({
        modduloProjectId: admin.firestore.FieldValue.delete(),
      });
    } else {
      logger.info(
        `[purgeModduloProjects][sim] desvincularía pestel_projects/${doc.id}`
      );
    }
    pestelDesvinculados.push(doc.id);
  }
  const verbo2 = modoReal ? "desvinculados" : "a desvincular";
  detalle.push(
    `PESTEL: ${pestelDesvinculados.length} proyecto(s) ${verbo2}.`
  );

  // ── Paso 3: sesiones de Fontana vinculadas ──────────────────────────
  vigente = await reconfirmarVigente(db, projectId, deletedAtEsperadoMs);
  if (!vigente) {
    detalle.push(
      "Abortado antes de Fontana: el proyecto fue restaurado o vuelto a borrar."
    );
    return {
      ...resultadoBase,
      archivosStorage,
      pestelDesvinculados,
      estado: "abortado_restaurado_durante_purga",
    };
  }
  const fontanaSnap = await db
    .collection("fontana_sesiones")
    .where("modduloProjectId", "==", projectId)
    .get();
  const fontanaDesvinculadas: string[] = [];
  for (const doc of fontanaSnap.docs) {
    if (modoReal) {
      await doc.ref.update({
        modduloProjectId: admin.firestore.FieldValue.delete(),
        fechaUltimoGuardado: new Date().toISOString(),
      });
    } else {
      logger.info(
        `[purgeModduloProjects][sim] desvincularía fontana_sesiones/${doc.id}`
      );
    }
    fontanaDesvinculadas.push(doc.id);
  }
  const verbo3 = modoReal ? "desvinculadas" : "a desvincular";
  detalle.push(
    `Fontana: ${fontanaDesvinculadas.length} sesión(es) ${verbo3}.`
  );

  // ── Paso 4: documento (y subcolecciones), al final ──────────────────
  vigente = await reconfirmarVigente(db, projectId, deletedAtEsperadoMs);
  if (!vigente) {
    detalle.push(
      "Abortado antes del documento: restaurado o vuelto a borrar."
    );
    return {
      ...resultadoBase,
      archivosStorage,
      pestelDesvinculados,
      fontanaDesvinculadas,
      estado: "abortado_restaurado_durante_purga",
    };
  }
  if (modoReal) {
    await db.recursiveDelete(db.collection("moddulo_projects").doc(projectId));
    detalle.push(
      "Documento moddulo_projects (y subcolecciones) borrado."
    );
  } else {
    logger.info(
      `[purgeModduloProjects][sim] borraría moddulo_projects/${projectId}`
    );
    detalle.push("Documento: se borraría (simulación, no ejecutado).");
  }

  return {
    ...resultadoBase,
    archivosStorage,
    pestelDesvinculados,
    fontanaDesvinculadas,
    documentoBorrado: modoReal,
    estado: "purgado",
  };
}

export interface ResultadoSmokeTest {
  ok: boolean;
  detalle: string;
}

/**
 * Smoke test de lectura de Storage (§3.5 del plan) — confirma que la
 * identidad de runtime de la Cloud Function tiene al menos acceso de
 * LECTURA al bucket real, antes de intentar cualquier operación
 * destructiva. No prueba permiso de borrado (eso se confirma en el primer
 * despliegue en modo simulación, subiendo y borrando un archivo desechable
 * bajo moddulo/_purge_test/ — ver purgeModduloProjects runbook).
 * @param {Bucket} bucket bucket de Storage.
 * @return {Promise<ResultadoSmokeTest>} resultado del smoke test.
 */
export async function smokeTestLecturaStorage(
  bucket: Bucket
): Promise<ResultadoSmokeTest> {
  try {
    const [files] = await bucket.getFiles({
      prefix: "moddulo/",
      maxResults: 1,
    });
    return {
      ok: true,
      detalle: `Lectura OK — ${files.length} archivo(s) bajo moddulo/.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {ok: false, detalle: `Lectura FALLÓ: ${msg}`};
  }
}
