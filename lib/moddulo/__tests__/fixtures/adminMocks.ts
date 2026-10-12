// lib/moddulo/__tests__/fixtures/adminMocks.ts
// Mocks mínimos de adminDb/adminStorage — soportan EXACTAMENTE las
// cadenas de llamada que usan canal1/entregar y canal3/vincular:
//   adminDb.collection(x).doc(y).get()/.set()/.update()
//   adminDb.collection(x).doc(y).collection(z).doc(w).set()
//   adminStorage.bucket().file(x).exists()
// No pretende ser un mock genérico de todo el SDK de Firestore/Storage.

import { vi } from "vitest";
import type { SessionPayload } from "@/types/session.types";

// Confirmado por lectura de código (grep "session." en entregar/route.ts y
// vincular/route.ts): ambos handlers SOLO leen session.uid — ningún otro
// campo de SessionPayload (email, role, subscriptionPlan, etc.) se usa en
// ninguno de los 2 archivos. Este tipo declara solo lo que realmente se
// lee. Si un handler futuro empieza a leer otro campo, agregarlo aquí
// explícitamente (nunca extender a SessionPayload completo "por si acaso").
export interface MockSessionPayload {
  uid: string;
}

// Único punto de conversión MockSessionPayload → SessionPayload (el tipo
// real que exige getSessionFromRequest). Los tests llaman esto en vez de
// castear inline — MockSessionPayload es, a propósito, un subconjunto de
// SessionPayload, así que TypeScript no lo acepta por asignación
// estructural directa; se resuelve aquí una sola vez, documentado, en vez
// de con `as never`/`as unknown` repetido en cada test.
export function mockSessionPayload(session: MockSessionPayload): SessionPayload {
  return session as unknown as SessionPayload;
}

export function createMockAdminDb(initialDocs: Record<string, unknown> = {}) {
  let store = new Map<string, unknown>(Object.entries(initialDocs));
  // Bitácora de TODAS las llamadas a update() (ruta del documento + argumento tal cual), para poder
  // asertar QUÉ se mandó a Firestore (rutas con punto incluidas) y no solo el estado resultante:
  // el mock aplica un merge superficial con las claves literales, sin interpretar rutas con punto.
  let updateLog: Array<{ path: string; data: Record<string, unknown> }> = [];

  // 7b-1 — bitácora de delete() y de batches, y modo ATÓMICO opt-in (ver `atomico()` abajo).
  let deleteLog: string[] = [];
  let batchesCommitted = 0;
  let batchCommitFalla = false;
  let rutasQueFallan = new Set<string>();
  let modoAtomico = false;
  let actualizacionesEstrictas = false;

  let autoIdCounter = 0;

  interface DocRef {
    id: string;
    path: string;
    get: () => Promise<{ id: string; exists: boolean; data: () => unknown; ref: DocRef }>;
    set: (data: unknown) => Promise<void>;
    update: (data: Record<string, unknown>) => Promise<void>;
    delete: () => Promise<void>;
    collection: (name: string) => ReturnType<typeof collectionRef>;
  }

  type Escritura =
    | { tipo: "set"; ref: DocRef; data: unknown }
    | { tipo: "update"; ref: DocRef; data: Record<string, unknown> }
    | { tipo: "delete"; ref: DocRef };

  // Aplica un lote de escrituras TODO O NADA (modelo de WriteBatch/transacción de Firestore):
  // si una escritura falla —ruta marcada con failUpdateOn, o update() de un documento que no
  // existe (NOT_FOUND real)— no se aplica ninguna. Esto MODELA la garantía; no la demuestra.
  function aplicarLote(escrituras: Escritura[]): void {
    for (const e of escrituras) {
      if (rutasQueFallan.has(e.ref.path)) throw new Error(`mock: escritura fallida en ${e.ref.path}`);
      if (e.tipo === "update" && !store.has(e.ref.path)) {
        throw new Error(`mock: NOT_FOUND al hacer update() de ${e.ref.path}`);
      }
    }
    for (const e of escrituras) {
      if (e.tipo === "set") store.set(e.ref.path, e.data);
      else if (e.tipo === "update") {
        updateLog.push({ path: e.ref.path, data: e.data });
        store.set(e.ref.path, { ...(store.get(e.ref.path) as object ?? {}), ...e.data });
      } else {
        deleteLog.push(e.ref.path);
        store.delete(e.ref.path);
      }
    }
  }

  function docRef(path: string): DocRef {
    const ref: DocRef = {
      id: path.split("/").at(-1) as string,
      path,
      get: vi.fn(async () => ({
        id: path.split("/").at(-1) as string,
        exists: store.has(path),
        data: () => store.get(path),
        ref,
      })),
      set: vi.fn(async (data: unknown) => {
        store.set(path, data);
      }),
      update: vi.fn(async (data: Record<string, unknown>) => {
        if (rutasQueFallan.has(path)) throw new Error(`mock: escritura fallida en ${path}`);
        if (actualizacionesEstrictas && !store.has(path)) throw new Error(`mock: NOT_FOUND al hacer update() de ${path}`);
        updateLog.push({ path, data });
        store.set(path, { ...(store.get(path) as object ?? {}), ...data });
      }),
      delete: vi.fn(async () => {
        if (rutasQueFallan.has(path)) throw new Error(`mock: escritura fallida en ${path}`);
        deleteLog.push(path);
        store.delete(path);
      }),
      collection: (name: string) => collectionRef(`${path}/${name}`),
    };
    return ref;
  }

  function collectionRef(path: string) {
    return {
      // Sin id → id automático, como el `.doc()` real de Firestore.
      doc: (id?: string) => docRef(`${path}/${id ?? `auto-${++autoIdCounter}`}`),
      // add(data) → crea un doc con id automático y devuelve su ref (get()/id),
      // como el `.add()` real. createProject lo usa.
      add: vi.fn(async (data: unknown) => {
        const ref = docRef(`${path}/auto-${++autoIdCounter}`);
        await ref.set(data);
        return ref;
      }),
      where: (field: string, _op: "==", value: unknown) => queryRef(path, [[field, value]]),
      // Lista los hijos directos (sin filtros) — lo usa el candado de reemplazo del dvs
      // para leer f3Resultados, también dentro de una transacción (tx.get(coleccion)).
      get: () => queryRef(path, []).get(),
    };
  }

  // Soporta where(campo, "==", valor) encadenado + orderBy(campo, dir) + limit(n) +
  // get() sobre los hijos directos de la colección — lo que usa pestel/project POST en
  // su dedup y listUserProjects (papelera, 26-09-28). No pretende cubrir el resto de
  // operadores de Firestore.
  function queryRef(
    path: string,
    clauses: [string, unknown][],
    order?: { field: string; dir: "asc" | "desc" },
    limitN?: number
  ) {
    const self = {
      where: (field: string, _op: "==", value: unknown) =>
        queryRef(path, [...clauses, [field, value]], order, limitN),
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => queryRef(path, clauses, { field, dir }, limitN),
      limit: (n: number) => queryRef(path, clauses, order, n),
      get: vi.fn(async () => {
        let docs = [...store.entries()]
          .filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/"))
          .filter(([, data]) =>
            clauses.every(([f, v]) => (data as Record<string, unknown> | undefined)?.[f] === v)
          )
          .map(([p, data]) => ({ id: p.split("/").at(-1) as string, data: () => data }));
        if (order) {
          const { field, dir } = order;
          docs = [...docs].sort((a, b) => {
            const av = (a.data() as Record<string, unknown> | undefined)?.[field];
            const bv = (b.data() as Record<string, unknown> | undefined)?.[field];
            const cmp = av === bv ? 0 : (av as string) < (bv as string) ? -1 : 1;
            return dir === "asc" ? cmp : -cmp;
          });
        }
        if (limitN != null) docs = docs.slice(0, limitN);
        return { empty: docs.length === 0, docs };
      }),
    };
    return self;
  }

  const collection = vi.fn((name: string) => collectionRef(name));
  // runTransaction: por DEFECTO mínimo (get/set/update delegan en el ref, sin aislamiento ni
  // reintentos — solo permite probar la lógica de lectura-modificación-escritura). Con
  // `atomico(true)` (opt-in, 7b-1) las escrituras quedan en búfer y se aplican TODO O NADA solo si
  // el callback termina bien. Las pruebas que ya existían no lo activan: su semántica no cambia.
  const runTransaction = vi.fn(
    async <T>(
      fn: (tx: {
        get: (ref: DocRef) => ReturnType<DocRef["get"]>;
        set: (ref: DocRef, data: unknown) => Promise<void>;
        update: (ref: DocRef, data: Record<string, unknown>) => Promise<void>;
        delete: (ref: DocRef) => Promise<void>;
      }) => Promise<T>
    ): Promise<T> => {
      if (!modoAtomico) {
        return fn({
          get: (ref) => ref.get(),
          set: (ref, data) => ref.set(data),
          update: (ref, data) => ref.update(data),
          delete: (ref) => ref.delete(),
        });
      }
      const buffer: Escritura[] = [];
      const resultado = await fn({
        get: (ref) => ref.get(),
        set: async (ref, data) => void buffer.push({ tipo: "set", ref, data }),
        update: async (ref, data) => void buffer.push({ tipo: "update", ref, data }),
        delete: async (ref) => void buffer.push({ tipo: "delete", ref }),
      });
      aplicarLote(buffer);
      return resultado;
    }
  );
  // WriteBatch: las operaciones se acumulan y SOLO se aplican en commit() (todo o nada).
  const batch = vi.fn(() => {
    const buffer: Escritura[] = [];
    return {
      set: (ref: DocRef, data: unknown) => void buffer.push({ tipo: "set", ref, data }),
      update: (ref: DocRef, data: Record<string, unknown>) => void buffer.push({ tipo: "update", ref, data }),
      delete: (ref: DocRef) => void buffer.push({ tipo: "delete", ref }),
      commit: vi.fn(async () => {
        if (batchCommitFalla) {
          batchCommitFalla = false;
          throw new Error("mock: commit del batch fallido");
        }
        aplicarLote(buffer);
        batchesCommitted++;
      }),
    };
  });
  return {
    collection,
    runTransaction,
    batch,
    /** Reemplaza el estado en memoria — usar en beforeEach/cada test. */
    reset(newDocs: Record<string, unknown> = {}) {
      store = new Map(Object.entries(newDocs));
      updateLog = [];
      deleteLog = [];
      batchesCommitted = 0;
      batchCommitFalla = false;
      rutasQueFallan = new Set();
      modoAtomico = false;
      actualizacionesEstrictas = false;
    },
    /** Opt-in: las transacciones aplican sus escrituras en búfer, todo o nada (7b-1). */
    atomico(activo = true) {
      modoAtomico = activo;
    },
    /** Opt-in: el update() SUELTO de un documento inexistente falla (NOT_FOUND), como en Firestore real. */
    estricto(activo = true) {
      actualizacionesEstrictas = activo;
    },
    /** Hace que toda escritura sobre `path` (update/delete directo, batch o transacción) falle. */
    failUpdateOn(path: string) {
      rutasQueFallan.add(path);
    },
    /** El próximo commit() de un batch lanza y no aplica nada. */
    failNextBatchCommit() {
      batchCommitFalla = true;
    },
    /** Rutas de documentos borrados con delete() desde el último reset. */
    deletes(): string[] {
      return [...deleteLog];
    },
    /** Cuántos batches se confirmaron con éxito desde el último reset. */
    batchesCommitted(): number {
      return batchesCommitted;
    },
    /** Todas las llamadas a update() desde el último reset (path + argumento literal). */
    updates(): Array<{ path: string; data: Record<string, unknown> }> {
      return updateLog.map((u) => ({ path: u.path, data: u.data }));
    },
    /** Estado actual en memoria (path → documento) — para asertar escrituras. */
    snapshot(): Record<string, unknown> {
      return Object.fromEntries(store);
    },
  };
}

export function createMockAdminStorage(existingPaths: string[] = []) {
  let existing = new Set(existingPaths);
  const file = vi.fn((path: string) => ({
    exists: vi.fn(async () => [existing.has(path)]),
  }));
  const bucket = vi.fn(() => ({ file }));
  return {
    bucket,
    reset(newExistingPaths: string[] = []) {
      existing = new Set(newExistingPaths);
    },
  };
}
