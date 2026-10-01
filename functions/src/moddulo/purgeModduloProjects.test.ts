// functions/src/moddulo/purgeModduloProjects.test.ts
// Pruebas de purgarUnProyecto con mocks de Firestore/Storage — mismo
// patrón que vectorRiesgoV2.test.ts (node:test/node:assert, sin
// framework nuevo). No hay evidencia real hoy de un colaborador no-dueño
// con archivos (ver CLAUDE.md, verificación de lectura §11.2, 26-09-29)
// — el caso de "colaborador no-dueño" de este archivo es SINTÉTICO a
// propósito, para probar que el diseño lo cubre aunque la realidad
// actual no lo ejerza.
// Ejecutar: npm run test (desde functions/).

import {test, describe} from "node:test";
import assert from "node:assert/strict";
import * as admin from "firebase-admin";
import {
  purgarUnProyecto,
  smokeTestLecturaStorage,
} from "./purgeModduloProjects";

// admin.firestore.FieldValue.delete() es un singleton (misma referencia
// en cada llamada, verificado) — el fake usa esa referencia REAL para
// que update() detecte exactamente lo que purgarUnProyecto pasa.
const FIELD_DELETE = admin.firestore.FieldValue.delete();

type Store = Map<string, Record<string, unknown> | null>;

/**
 * Crea un Firestore falso mínimo — solo los métodos que purgarUnProyecto
 * usa (collection/doc/get/update/where/recursiveDelete).
 * @return {object} instancia del Firestore falso.
 */
function crearFakeFirestore() {
  const store: Store = new Map();
  const recursiveDeleteCalls: string[] = [];

  const docRef = (collectionName: string, id: string) => {
    const key = `${collectionName}/${id}`;
    return {
      id,
      get: async () => {
        const data = store.get(key) ?? null;
        return {exists: data !== null, data: () => data ?? undefined};
      },
      update: async (patch: Record<string, unknown>) => {
        const next = {...(store.get(key) ?? {})};
        for (const [k, v] of Object.entries(patch)) {
          if (v === FIELD_DELETE) delete next[k];
          else next[k] = v;
        }
        store.set(key, next);
      },
    };
  };

  const collection = (name: string) => ({
    doc: (id: string) => docRef(name, id),
    where: (field: string, _op: string, value: unknown) => ({
      get: async () => {
        const docs = [];
        for (const [key, data] of store.entries()) {
          if (!key.startsWith(`${name}/`)) continue;
          if (data && (data as Record<string, unknown>)[field] === value) {
            const id = key.split("/")[1];
            docs.push({id, ref: docRef(name, id)});
          }
        }
        return {docs};
      },
    }),
  });

  return {
    collection,
    recursiveDelete: async (ref: {id: string}) => {
      recursiveDeleteCalls.push(ref.id);
      for (const key of Array.from(store.keys())) {
        if (key.endsWith(`/${ref.id}`)) store.delete(key);
      }
    },
    recursiveDeleteCalls,
    set: (col: string, id: string, data: Record<string, unknown> | null) => {
      store.set(`${col}/${id}`, data);
    },
    get: (col: string, id: string) => store.get(`${col}/${id}`),
  };
}

type FakeFirestore = ReturnType<typeof crearFakeFirestore>;

/**
 * Crea un Bucket falso mínimo (solo getFiles/deleteFiles).
 * @return {object} instancia del bucket falso.
 */
function crearFakeBucket() {
  const archivos = new Map<string, true>();
  const deleteFilesCalls: string[] = [];
  const getFilesCalls: string[] = [];

  return {
    archivos,
    deleteFilesCalls,
    getFilesCalls,
    getFiles: async (opts: {prefix: string; maxResults?: number}) => {
      getFilesCalls.push(opts.prefix);
      const nombres = [...archivos.keys()]
        .filter((p) => p.startsWith(opts.prefix))
        .map((name) => ({name}));
      const limitados = opts.maxResults ?
        nombres.slice(0, opts.maxResults) :
        nombres;
      return [limitados];
    },
    deleteFiles: async (opts: {prefix: string}) => {
      deleteFilesCalls.push(opts.prefix);
      for (const path of Array.from(archivos.keys())) {
        if (path.startsWith(opts.prefix)) archivos.delete(path);
      }
    },
    setArchivo: (path: string) => archivos.set(path, true),
  };
}

type FakeBucket = ReturnType<typeof crearFakeBucket>;

const fakeTimestamp = (ms: number) => ({toMillis: () => ms});

/**
 * Datos base de un proyecto en papelera, listo para overrides puntuales.
 * @param {Record<string, unknown>} overrides campos a sobreescribir.
 * @return {Record<string, unknown>} datos del proyecto de prueba.
 */
function proyectoBase(overrides: Record<string, unknown> = {}) {
  return {
    userId: "owner1",
    name: "Proyecto de prueba",
    deletedAt: fakeTimestamp(1000),
    collaborators: [{uid: "owner1", role: "owner"}],
    ...overrides,
  };
}

/**
 * Llama purgarUnProyecto con los fakes ya castcados al tipo real.
 * @param {FakeFirestore} db Firestore falso.
 * @param {FakeBucket} bucket bucket falso.
 * @param {string} id id del proyecto.
 * @param {boolean} real true = modo real, false = simulación.
 * @return {Promise<object>} resultado de la purga.
 */
function purgar(
  db: FakeFirestore, bucket: FakeBucket, id: string, real: boolean
) {
  return purgarUnProyecto(
    db as unknown as Parameters<typeof purgarUnProyecto>[0],
    bucket as unknown as Parameters<typeof purgarUnProyecto>[1],
    id,
    {modoReal: real}
  );
}

describe("purgarUnProyecto — modo simulación (default)", () => {
  test("no ejecuta operaciones destructivas, solo cuenta", async () => {
    const db = crearFakeFirestore();
    db.set("moddulo_projects", "p1", proyectoBase());
    db.set("pestel_projects", "pest1", {
      userId: "owner1", modduloProjectId: "p1",
    });
    db.set("fontana_sesiones", "fon1", {
      modduloProjectId: "p1", tareaPipIds: [],
    });

    const bucket = crearFakeBucket();
    bucket.setArchivo("moddulo/owner1/p1/archivo1.pdf");

    const resultado = await purgar(db, bucket, "p1", false);

    assert.equal(resultado.estado, "purgado");
    assert.equal(resultado.archivosStorage, 1);
    assert.equal(resultado.documentoBorrado, false);
    assert.deepEqual(resultado.pestelDesvinculados, ["pest1"]);
    assert.deepEqual(resultado.fontanaDesvinculadas, ["fon1"]);

    assert.equal(bucket.deleteFilesCalls.length, 0);
    assert.equal(db.recursiveDeleteCalls.length, 0);
    assert.ok(db.get("moddulo_projects", "p1"), "el proyecto sigue ahí");
    const pest = db.get("pestel_projects", "pest1") as Record<string, unknown>;
    assert.equal(pest.modduloProjectId, "p1", "back-link intacto en sim.");
    const fon = db.get("fontana_sesiones", "fon1") as Record<string, unknown>;
    assert.equal(fon.modduloProjectId, "p1", "Fontana intacta en sim.");
  });
});

describe("purgarUnProyecto — modo real", () => {
  test("limpia Storage, PESTEL, Fontana y borra el doc, en orden", async () => {
    const db = crearFakeFirestore();
    db.set("moddulo_projects", "p1", proyectoBase());
    db.set("pestel_projects", "pest1", {
      userId: "owner1", modduloProjectId: "p1",
    });
    db.set("fontana_sesiones", "fon1", {
      modduloProjectId: "p1", tareaPipIds: ["tarea1"],
    });

    const bucket = crearFakeBucket();
    bucket.setArchivo("moddulo/owner1/p1/archivo1.pdf");
    bucket.setArchivo("moddulo/owner1/p1/archivo2.pdf");

    const resultado = await purgar(db, bucket, "p1", true);

    assert.equal(resultado.estado, "purgado");
    assert.equal(resultado.archivosStorage, 2);
    assert.equal(resultado.documentoBorrado, true);
    assert.deepEqual(resultado.pestelDesvinculados, ["pest1"]);
    assert.deepEqual(resultado.fontanaDesvinculadas, ["fon1"]);

    assert.equal(bucket.archivos.size, 0, "Storage borrado de verdad");
    assert.equal(db.recursiveDeleteCalls.length, 1);
    assert.equal(db.get("moddulo_projects", "p1"), undefined);
    const pest = db.get("pestel_projects", "pest1") as Record<string, unknown>;
    assert.equal(pest.modduloProjectId, undefined, "back-link limpiado");
    const fon = db.get("fontana_sesiones", "fon1") as Record<string, unknown>;
    assert.equal(
      fon.modduloProjectId,
      undefined,
      "Fontana Escenario A (tareaPipIds no vacío) SÍ se desvincula aquí"
    );
  });

  test("colaborador NO-dueño (sintético): Storage por CADA uid", async () => {
    const db = crearFakeFirestore();
    db.set("moddulo_projects", "p1", proyectoBase({
      collaborators: [
        {uid: "owner1", role: "owner"},
        {uid: "colabNoOwner", role: "analyst"},
      ],
    }));

    const bucket = crearFakeBucket();
    bucket.setArchivo("moddulo/owner1/p1/archivo_owner.pdf");
    bucket.setArchivo("moddulo/colabNoOwner/p1/archivo_colab.pdf");

    const resultado = await purgar(db, bucket, "p1", true);

    assert.equal(resultado.archivosStorage, 2);
    assert.deepEqual(
      bucket.getFilesCalls.sort(),
      ["moddulo/colabNoOwner/p1/", "moddulo/owner1/p1/"],
      "se consultó el prefijo de AMBOS colaboradores"
    );
    assert.equal(bucket.archivos.size, 0);
  });

  test(
    "proyecto NO vencido también se purga (el filtro de días es del " +
      "disparador)",
    async () => {
      const db = crearFakeFirestore();
      db.set("moddulo_projects", "p1", proyectoBase({
        deletedAt: fakeTimestamp(Date.now()),
      }));
      const bucket = crearFakeBucket();

      const resultado = await purgar(db, bucket, "p1", true);

      assert.equal(resultado.estado, "purgado");
    });
});

describe("purgarUnProyecto — abortos", () => {
  test("proyecto inexistente → abortado_no_existe", async () => {
    const db = crearFakeFirestore();
    const bucket = crearFakeBucket();

    const resultado = await purgar(db, bucket, "noExiste", true);

    assert.equal(resultado.estado, "abortado_no_existe");
    assert.equal(bucket.getFilesCalls.length, 0);
  });

  test("proyecto activo (sin deletedAt) → abortado_no_papelera", async () => {
    const db = crearFakeFirestore();
    db.set("moddulo_projects", "p1", proyectoBase({deletedAt: undefined}));
    const bucket = crearFakeBucket();
    bucket.setArchivo("moddulo/owner1/p1/archivo.pdf");

    const resultado = await purgar(db, bucket, "p1", true);

    assert.equal(resultado.estado, "abortado_no_en_papelera");
    assert.equal(bucket.getFilesCalls.length, 0);
    assert.ok(db.get("moddulo_projects", "p1"), "proyecto activo intacto");
  });

  test("concurrencia: restaurado antes del 1er paso → aborta", async () => {
    const db = crearFakeFirestore();
    db.set("moddulo_projects", "p1", proyectoBase());
    const bucket = crearFakeBucket();
    bucket.setArchivo("moddulo/owner1/p1/archivo.pdf");

    // Intercepta la 2ª lectura de moddulo_projects/p1 (1ª = lectura
    // inicial; 2ª = reconfirmarVigente de antes de Storage) y simula
    // que el usuario restauró el proyecto justo en ese instante.
    let lecturas = 0;
    const originalCollection = db.collection;
    db.collection = ((name: string) => {
      const col = originalCollection(name);
      if (name !== "moddulo_projects") return col;
      const originalDoc = col.doc;
      return {
        ...col,
        doc: (id: string) => {
          const ref = originalDoc(id);
          const originalGet = ref.get;
          return {
            ...ref,
            get: async () => {
              lecturas++;
              if (lecturas === 2) {
                const actual = db.get("moddulo_projects", "p1") as
                  Record<string, unknown>;
                db.set("moddulo_projects", "p1", {
                  ...actual, deletedAt: undefined,
                });
              }
              return originalGet();
            },
          };
        },
      };
    }) as typeof db.collection;

    const resultado = await purgar(db, bucket, "p1", true);

    assert.equal(resultado.estado, "abortado_restaurado_durante_purga");
    assert.equal(bucket.getFilesCalls.length, 0, "no se consultó Storage");
    assert.equal(bucket.deleteFilesCalls.length, 0, "nada borrado");
    assert.ok(db.get("moddulo_projects", "p1"), "documento restaurado");
  });

  test("concurrencia: deletedAt distinto entre pasos → aborta", async () => {
    const db = crearFakeFirestore();
    db.set("moddulo_projects", "p1", proyectoBase({
      deletedAt: fakeTimestamp(1000),
    }));
    const bucket = crearFakeBucket();
    bucket.setArchivo("moddulo/owner1/p1/archivo.pdf");

    let lecturas = 0;
    const originalCollection = db.collection;
    db.collection = ((name: string) => {
      const col = originalCollection(name);
      if (name !== "moddulo_projects") return col;
      const originalDoc = col.doc;
      return {
        ...col,
        doc: (id: string) => {
          const ref = originalDoc(id);
          const originalGet = ref.get;
          return {
            ...ref,
            get: async () => {
              lecturas++;
              if (lecturas === 2) {
                // Restaurado y vuelto a borrar entre los dos pasos —
                // un deletedAt DISTINTO (no ausente) tampoco continúa.
                const actual = db.get("moddulo_projects", "p1") as
                  Record<string, unknown>;
                db.set("moddulo_projects", "p1", {
                  ...actual, deletedAt: fakeTimestamp(9999),
                });
              }
              return originalGet();
            },
          };
        },
      };
    }) as typeof db.collection;

    const resultado = await purgar(db, bucket, "p1", true);

    assert.equal(resultado.estado, "abortado_restaurado_durante_purga");
    assert.equal(bucket.deleteFilesCalls.length, 0, "nada borrado");
  });
});

describe("smokeTestLecturaStorage", () => {
  test("ok:true cuando bucket.getFiles responde sin error", async () => {
    const bucket = crearFakeBucket();
    bucket.setArchivo("moddulo/algunUid/algunProyecto/x.pdf");

    const resultado = await smokeTestLecturaStorage(
      bucket as unknown as Parameters<typeof smokeTestLecturaStorage>[0]
    );

    assert.equal(resultado.ok, true);
  });

  test("ok:false cuando bucket.getFiles lanza (sin permiso)", async () => {
    const bucket = crearFakeBucket();
    bucket.getFiles = (async () => {
      throw new Error("PERMISSION_DENIED: simulado para la prueba");
    }) as typeof bucket.getFiles;

    const resultado = await smokeTestLecturaStorage(
      bucket as unknown as Parameters<typeof smokeTestLecturaStorage>[0]
    );

    assert.equal(resultado.ok, false);
    assert.match(resultado.detalle, /PERMISSION_DENIED/);
  });
});
