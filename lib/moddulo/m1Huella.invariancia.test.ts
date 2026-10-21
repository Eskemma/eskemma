// Paso 5: the fingerprint of an approved analysis must NOT change when the serialization of the motors' prompts
// changes. The literal hash below was computed BEFORE the change, outside the repo code (sha-256 of the
// key-sorted JSON of this mapa), and written here.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { huellaMapaPESTEL } from "./m1Huella";
import { serializeMapaPESTEL } from "@/lib/ai/phases/prompts";
import { serializacionEstable } from "./serializacionEstable";

const senal = (descripcion: string, over: Record<string, unknown> = {}) => ({
  descripcion, fuente: "INEGI, 2020", fechaCorte: "2020-01", nivelConfianza: "medio", origenInternacional: false, ...over,
});
const MAPA = {
  P: {
    code: "P", label: "Político", clasificacion: "AMENAZA", confidence: 80, narrativa: "Narrativa P completa.",
    senalesFavorables: [senal("a".repeat(300))],
    senalesAdversas: [1, 2, 3, 4, 5].map((i) => senal(`adversa ${i}`, { fuente: "", fechaCorte: "", nivelConfianza: "bajo" })),
    senalesInciertas: [],
  },
  L: { code: "L", label: "Legal", clasificacion: "NEUTRAL", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] },
};
const HUELLA_ANTES_DEL_CAMBIO = "d1a9d0c3c656c5bf7661206659ed1d51433da81fdc1945e2ba5120d37ddeec3c";

describe("huella del análisis aprobado — invariante ante la serialización de los prompts", () => {
  it("la huella de un análisis ya aprobado es la de antes del cambio (literal)", () => {
    expect(huellaMapaPESTEL(MAPA)).toBe(HUELLA_ANTES_DEL_CAMBIO);
  });

  it("serializar para los prompts no muta la entrada ni cambia la huella", () => {
    const antes = serializacionEstable(MAPA);
    serializeMapaPESTEL(MAPA);
    expect(serializacionEstable(MAPA)).toBe(antes);
    expect(huellaMapaPESTEL(MAPA)).toBe(HUELLA_ANTES_DEL_CAMBIO);
  });

  it("la huella no depende del orden de las claves (como siempre)", () => {
    const reordenado = { L: MAPA.L, P: { ...MAPA.P, senalesInciertas: [], code: "P" } };
    expect(huellaMapaPESTEL(reordenado)).toBe(HUELLA_ANTES_DEL_CAMBIO);
  });

  it("m1Huella.ts no importa prompts.ts (estático)", () => {
    const fuente = readFileSync(new URL("./m1Huella.ts", import.meta.url), "utf8");
    const imports = fuente.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
    expect(imports).not.toMatch(/prompts/);
    expect(imports).not.toMatch(/ai\/phases/);
  });
});
