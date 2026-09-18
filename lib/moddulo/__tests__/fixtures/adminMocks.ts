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

  function docRef(path: string) {
    return {
      id: path.split("/").at(-1) as string,
      get: vi.fn(async () => ({
        exists: store.has(path),
        data: () => store.get(path),
      })),
      set: vi.fn(async (data: unknown) => {
        store.set(path, data);
      }),
      update: vi.fn(async (data: Record<string, unknown>) => {
        store.set(path, { ...(store.get(path) as object ?? {}), ...data });
      }),
      collection: (name: string) => collectionRef(`${path}/${name}`),
    };
  }

  function collectionRef(path: string) {
    return {
      // Sin id → id automático, como el `.doc()` real de Firestore.
      doc: (id?: string) => docRef(`${path}/${id ?? `auto-${++autoIdCounter}`}`),
      where: (field: string, _op: "==", value: unknown) => queryRef(path, [[field, value]]),
    };
  }

  // Soporta SOLO where(campo, "==", valor) encadenado + get() sobre los
  // hijos directos de la colección — lo que usa pestel/project POST en su
  // dedup. No pretende cubrir el resto de operadores/órdenes de Firestore.
  function queryRef(path: string, clauses: [string, unknown][]) {
    return {
      where: (field: string, _op: "==", value: unknown) =>
        queryRef(path, [...clauses, [field, value]]),
      get: vi.fn(async () => {
        const docs = [...store.entries()]
          .filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/"))
          .filter(([, data]) =>
            clauses.every(([f, v]) => (data as Record<string, unknown> | undefined)?.[f] === v)
          )
          .map(([p, data]) => ({ id: p.split("/").at(-1) as string, data: () => data }));
        return { empty: docs.length === 0, docs };
      }),
    };
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
