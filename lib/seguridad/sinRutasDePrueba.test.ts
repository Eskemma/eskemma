// lib/seguridad/sinRutasDePrueba.test.ts
// /api/test-admin llegó a producción como ruta pública que sondeaba el Admin
// SDK (H-V81). Esta guarda impide que reaparezca una ruta de prueba o
// depuración bajo app/api: ningún segmento de ruta puede llamarse test*,
// debug*, dev*, diag*, sandbox* ni health*/ping* (si algún día hace falta un
// health check legítimo, se agrega a la lista blanca con su razón).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DIR_API = path.join(process.cwd(), "app", "api");
const NOMBRE_DE_PRUEBA = /^(test|debug|dev|diag|diagnostico|sandbox|health|ping|echo)([-_].*)?$/i;
const LISTA_BLANCA: string[] = [];

export function segmentosDeRutaDePrueba(dir: string, base: string = dir): string[] {
  const salida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    const rel = path.relative(base, p).split(path.sep).join("/");
    if (NOMBRE_DE_PRUEBA.test(e.name) && !LISTA_BLANCA.includes(rel)) salida.push(rel);
    salida.push(...segmentosDeRutaDePrueba(p, base));
  }
  return salida;
}

describe("app/api no tiene rutas de prueba públicas", () => {
  it("ningún segmento se llama test*, debug*, dev*, diag*, sandbox*, health*, ping* o echo*", () => {
    expect(segmentosDeRutaDePrueba(DIR_API)).toEqual([]);
  });
  it("el escáner SÍ detecta una ruta de prueba (negativo)", () => {
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "rutas-"));
    fs.mkdirSync(path.join(tmp, "moddulo", "test-admin"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "geo", "candidatos"), { recursive: true });
    try {
      expect(segmentosDeRutaDePrueba(tmp)).toEqual(["moddulo/test-admin"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
