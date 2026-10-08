import { describe, expect, it } from "vitest";
import { crearPerfilSiNoExiste, type TransaccionMin } from "./crearPerfilSiNoExiste";

// Minimal in-memory Firestore: transactions run one at a time (as the server
// serializes conflicting ones), which is what makes create-if-absent safe.
function crearDb(inicial: Record<string, unknown> = {}) {
  const docs = new Map<string, unknown>(Object.entries(inicial));
  const escrituras: string[] = [];
  const tx: TransaccionMin<string> = {
    get: async (ref) => ({ exists: () => docs.has(ref), data: () => docs.get(ref) }),
    set: (ref, data) => { escrituras.push(ref); docs.set(ref, data); },
  };
  return { docs, escrituras, tx };
}

const perfil = { uid: "u1", role: "visitor", profileCompleted: false, showOnboardingModal: true, createdAt: "2026-10-08" };

describe("crearPerfilSiNoExiste", () => {
  it("perfil nuevo → lo crea una sola vez", async () => {
    const db = crearDb();
    const r = await crearPerfilSiNoExiste(db.tx, "users/u1", perfil);
    expect(r).toEqual({ creado: true, data: perfil });
    expect(db.escrituras).toEqual(["users/u1"]);
  });

  it("perfil existente → NO lo modifica y devuelve el existente", async () => {
    const existente = { uid: "u1", role: "premium", profileCompleted: true, showOnboardingModal: false, createdAt: "2026-01-01" };
    const db = crearDb({ "users/u1": existente });
    const r = await crearPerfilSiNoExiste(db.tx, "users/u1", perfil);
    expect(r).toEqual({ creado: false, data: existente });
    expect(db.escrituras).toEqual([]);
    expect(db.docs.get("users/u1")).toBe(existente);
  });

  it("dos cargas simultáneas (dos pestañas): una crea, la otra respeta lo creado", async () => {
    const db = crearDb();
    const primera = await crearPerfilSiNoExiste(db.tx, "users/u1", perfil);
    // La pestaña 1 ya avanzó: completó el perfil antes de que la 2 ejecute su transacción.
    db.docs.set("users/u1", { ...perfil, profileCompleted: true, showOnboardingModal: false });
    const segunda = await crearPerfilSiNoExiste(db.tx, "users/u1", { ...perfil, createdAt: "2026-10-09" });
    expect(primera.creado).toBe(true);
    expect(segunda.creado).toBe(false);
    expect(db.escrituras).toEqual(["users/u1"]);
    expect(db.docs.get("users/u1")).toMatchObject({ profileCompleted: true, showOnboardingModal: false, createdAt: "2026-10-08" });
  });

  it("negativo: el setDoc sin condición anterior sí pisaba el perfil existente", async () => {
    const db = crearDb({ "users/u1": { ...perfil, profileCompleted: true, createdAt: "2026-01-01" } });
    db.tx.set("users/u1", perfil); // comportamiento anterior: setDoc a ciegas
    expect(db.docs.get("users/u1")).toMatchObject({ profileCompleted: false, createdAt: "2026-10-08" });
  });
});
