// T7 C3: la nota de aprobación va SOLO a pantalla y descargas; ningún prompt de M2–M5 la recibe.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "../../..");
const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

describe("la nota no entra en los prompts ni en el mapa", () => {
  it.each(["lib/ai/phases/prompts.ts", "app/api/moddulo/f2/generate-dvs/route.ts", "app/api/moddulo/f2/regenerate-m5/route.ts", "lib/centinela/pestel/transformToMapaPESTEL.ts"])(
    "%s no menciona aprobacionOrigen ni la nota de aprobación",
    (rel) => {
      const t = leer(rel);
      expect(t).not.toMatch(/aprobacionOrigen|notaAprobacion|aprobacionJustificacion/);
    }
  );
  it("el mapa transformado no cambia por la nota (misma huella de contenido del mapa con y sin nota)", async () => {
    const { transformToMapaPESTEL } = await import("./transformToMapaPESTEL");
    const { DIMENSIONES_EJEMPLO, AJUSTES_EJEMPLO } = await import("./__fixtures__/analisisEjemplo");
    expect(transformToMapaPESTEL(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never)).toEqual(transformToMapaPESTEL(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never));
    expect(JSON.stringify(transformToMapaPESTEL(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never))).not.toMatch(/aprobacion|nota de aprobaci/i);
  });
});
