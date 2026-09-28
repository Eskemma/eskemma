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

  let autoIdCounter = 0;

  interface DocRef {
    id: string;
    get: () => Promise<{ exists: boolean; data: () => unknown; ref: DocRef }>;
    set: (data: unknown) => Promise<void>;
    update: (data: Record<string, unknown>) => Promise<void>;
    collection: (name: string) => ReturnType<typeof collectionRef>;
  }

  function docRef(path: string): DocRef {
    const ref: DocRef = {
      id: path.split("/").at(-1) as string,
      get: vi.fn(async () => ({
        exists: store.has(path),
        data: () => store.get(path),
        ref,
      })),
      set: vi.fn(async (data: unknown) => {
        store.set(path, data);
      }),
      update: vi.fn(async (data: Record<string, unknown>) => {
        store.set(path, { ...(store.get(path) as object ?? {}), ...data });
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
  return {
    collection,
    /** Reemplaza el estado en memoria — usar en beforeEach/cada test. */
    reset(newDocs: Record<string, unknown> = {}) {
      store = new Map(Object.entries(newDocs));
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
