import { describe, expect, it } from "vitest";
import { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { leerSelloVigente } from "./selloVigente";
import { FASE_F3, PUNTERO_F3 } from "./artefactosF3";
import { idRevision } from "@/lib/versionado/registrar";

const P = "moddulo_projects/p1";
const ART = "f3Resultado:r1";
const VID = "f3Resultado:r1__000002";
const doc = (db: ReturnType<typeof createMockAdminDb>, datosRaiz: Record<string, unknown> | undefined) =>
  db.runTransaction((tx) => leerSelloVigente(tx as never, db.collection("moddulo_projects").doc("p1") as never, datosRaiz, ART));

const conPuntero = (n: unknown) => ({ phases: { investigacion: { revision: { n } } } });
const manifiesto = (extra: Record<string, unknown> = {}) => ({ n: 3, fase: FASE_F3, artefactos: { [ART]: { versionId: VID } }, ...extra });

function sembrar(version: Record<string, unknown> | null, man: Record<string, unknown> | null = manifiesto()) {
  const db = createMockAdminDb();
  const docs: Record<string, unknown> = {};
  if (man) docs[`${P}/revisiones/${idRevision(FASE_F3, 3)}`] = man;
  if (version) docs[`${P}/versiones/${VID}`] = version;
  db.reset(docs);
  return db;
}

describe("leerSelloVigente — `aprobacion.en` de la versión VIGENTE, solo si trae aprobado:true", () => {
  it("versión vigente aprobada con fecha → esa fecha", async () => {
    const db = sembrar({ en: "2026-11-20T00:00:00Z", aprobacion: { aprobado: true, por: "u", en: "2026-11-13T03:30:00.000Z" } });
    expect(await doc(db, conPuntero(3))).toBe("2026-11-13T03:30:00.000Z");
  });
  it("versión vigente SIN aprobación → null, aunque la versión tenga su marca de escritura `en`", async () => {
    const db = sembrar({ en: "2026-11-20T00:00:00Z", contenido: {} });
    expect(await doc(db, conPuntero(3))).toBeNull();
  });
  it("aprobacion.aprobado:false (aprobación retirada) → null, aunque traiga `en`", async () => {
    const db = sembrar({ en: "2026-11-20T00:00:00Z", aprobacion: { aprobado: false, por: "u", en: "2026-11-19T00:00:00Z" } });
    expect(await doc(db, conPuntero(3))).toBeNull();
  });
  it("aprobada sin sello (previo_sin_historial: en null) → null", async () => {
    const db = sembrar({ aprobacion: { aprobado: true, por: null, en: null } });
    expect(await doc(db, conPuntero(3))).toBeNull();
  });
  it("sin puntero o datosRaiz ausente → null", async () => {
    const db = sembrar({ aprobacion: { aprobado: true, por: "u", en: "2026-11-13T03:30:00.000Z" } });
    expect(await doc(db, undefined)).toBeNull();
    expect(await doc(db, { phases: {} })).toBeNull();
  });
  it.each([[0], [-1], [1.5], ["3"], [null]])("puntero malformado (%j) → null", async (n) => {
    const db = sembrar({ aprobacion: { aprobado: true, por: "u", en: "2026-11-13T03:30:00.000Z" } });
    expect(await doc(db, conPuntero(n))).toBeNull();
  });
  it("falta el manifiesto → null", async () => {
    const db = sembrar({ aprobacion: { aprobado: true, por: "u", en: "2026-11-13T03:30:00.000Z" } }, null);
    expect(await doc(db, conPuntero(3))).toBeNull();
  });
  it("el manifiesto no trae el artefacto → null", async () => {
    const db = sembrar({ aprobacion: { aprobado: true, por: "u", en: "2026-11-13T03:30:00.000Z" } }, manifiesto({ artefactos: {} }));
    expect(await doc(db, conPuntero(3))).toBeNull();
  });
  it("falta la versión → null", async () => {
    const db = sembrar(null);
    expect(await doc(db, conPuntero(3))).toBeNull();
  });
  it("inconsistencia (manifiesto con otro n o de otra fase) → null", async () => {
    const v = { aprobacion: { aprobado: true, por: "u", en: "2026-11-13T03:30:00.000Z" } };
    expect(await doc(sembrar(v, manifiesto({ n: 9 })), conPuntero(3))).toBeNull();
    expect(await doc(sembrar(v, manifiesto({ fase: "otra" })), conPuntero(3))).toBeNull();
  });
  it("nunca lanza: un fallo de lectura devuelve null", async () => {
    const db = sembrar({ aprobacion: { aprobado: true, por: "u", en: "x" } });
    const r = await db.runTransaction(async () =>
      leerSelloVigente({ get: () => { throw new Error("boom"); } } as never, db.collection("moddulo_projects").doc("p1") as never, conPuntero(3), ART)
    );
    expect(r).toBeNull();
    expect(PUNTERO_F3).toBe("phases.investigacion.revision");
  });
});
