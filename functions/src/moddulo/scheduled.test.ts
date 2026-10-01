// functions/src/moddulo/scheduled.test.ts
// Pruebas de purgarProyectosVencidos — confirma que solo procesa
// proyectos con deletedAt ANTERIOR al cutoff (DIAS_RETENCION_PROYECTOS),
// dejando intactos los recién movidos a papelera. purgarUnProyecto en sí
// ya está probado en purgeModduloProjects.test.ts — aquí solo se prueba
// el filtro de vencimiento y el conteo.

import {test, describe} from "node:test";
import assert from "node:assert/strict";
import type {Bucket} from "@google-cloud/storage";
import {purgarProyectosVencidos} from "./scheduled";
import {DIAS_RETENCION_PROYECTOS} from "./papeleraConfig";

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const fakeTimestamp = (ms: number) => ({toMillis: () => ms});

type Proyecto = {deletedAt?: {toMillis: () => number}};

/**
 * Firestore falso mínimo — solo lo que purgarProyectosVencidos y
 * purgarUnProyecto necesitan: where("deletedAt","<",cutoff) y doc/get.
 * @param {Record<string, Proyecto>} proyectos mapa id → datos.
 * @return {object} Firestore falso.
 */
function crearFakeFirestore(proyectos: Record<string, Proyecto>) {
  const store = new Map<string, Record<string, unknown> | null>(
    Object.entries(proyectos).map(([id, p]) => [
      `moddulo_projects/${id}`, p as Record<string, unknown>,
    ])
  );

  const docRef = (id: string) => ({
    id,
    get: async () => {
      const data = store.get(`moddulo_projects/${id}`) ?? null;
      return {exists: data !== null, data: () => data ?? undefined};
    },
    update: async () => {
      // No usado en estas pruebas (modoReal:false en todos los casos).
    },
  });

  return {
    collection: (name: string) => ({
      doc: (id: string) => docRef(id),
      where: (field: string, op: string, cutoff: Date) => ({
        get: async () => {
          // purgarUnProyecto también consulta pestel_projects y
          // fontana_sesiones (por modduloProjectId) — solo el filtro por
          // deletedAt de moddulo_projects aplica en esta prueba; el resto
          // devuelve vacío (sin back-links que desvincular aquí).
          if (name !== "moddulo_projects" || field !== "deletedAt") {
            return {docs: []};
          }
          assert.equal(op, "<");
          const docs = [];
          for (const [key, data] of store.entries()) {
            const id = key.split("/")[1];
            const deletedAt = (data as Proyecto | null)?.deletedAt;
            if (deletedAt && deletedAt.toMillis() < cutoff.getTime()) {
              docs.push({id, ref: docRef(id)});
            }
          }
          return {docs};
        },
      }),
    }),
    recursiveDelete: async () => {
      // No usado en estas pruebas (modoReal:false).
    },
  };
}

describe("purgarProyectosVencidos", () => {
  test("procesa solo los vencidos, no toca los recién borrados", async () => {
    const ahora = Date.now();
    const vencido = ahora - (DIAS_RETENCION_PROYECTOS + 5) * MS_POR_DIA;
    const reciente = ahora - 2 * MS_POR_DIA;

    const db = crearFakeFirestore({
      pVencido: {deletedAt: fakeTimestamp(vencido)},
      pReciente: {deletedAt: fakeTimestamp(reciente)},
      pActivo: {},
    });
    const bucket = {getFiles: async () => [[]]} as unknown as Bucket;

    const procesados = await purgarProyectosVencidos(
      db as unknown as Parameters<typeof purgarProyectosVencidos>[0],
      () => bucket,
      false
    );

    assert.equal(procesados, 1, "solo el vencido se procesa");
  });

  test("sin proyectos vencidos, procesados:0", async () => {
    const db = crearFakeFirestore({
      pReciente: {deletedAt: fakeTimestamp(Date.now())},
    });
    const bucket = {getFiles: async () => [[]]} as unknown as Bucket;

    const procesados = await purgarProyectosVencidos(
      db as unknown as Parameters<typeof purgarProyectosVencidos>[0],
      () => bucket,
      false
    );

    assert.equal(procesados, 0);
  });
});
