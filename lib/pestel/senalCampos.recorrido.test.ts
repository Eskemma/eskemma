// T7 C4 — vigilante de `senalCampos`: todo archivo que MENCIONE `fechaCorte` o `nivelConfianza` (los campos que se
// muestran o serializan de una señal) debe importar `@/lib/pestel/senalCampos` o estar en la lista de excepciones de
// abajo, cada una con su motivo. Si alguien imprime una fecha de señal por su cuenta, este test falla.
// Alcance: .ts/.tsx de app/, lib/, types/ y functions/src/ (sin pruebas ni fixtures). `fuente` no se vigila por nombre:
// es demasiado genérico (Fontana, geografía…); `fechaCorte` y `nivelConfianza` sí identifican a una señal.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();
const CAMPOS = /\b(fechaCorte|nivelConfianza)\b/;
const IMPORTA_HELPER = /from\s+["']@\/lib\/pestel\/senalCampos["']|from\s+["']\.\/senalCampos["']/;

export const EXCEPCIONES: Record<string, string> = {
  "lib/pestel/senalCampos.ts": "es el propio módulo",
  "lib/centinela/pestel/transformToMapaPESTEL.ts": "COPIA al guardar el mapa de F2: decisión «mostrar-solo» (no se normaliza lo guardado ni la huella M1); el mostrar pasa por senalCampos",
  "lib/centinela/pestel/contenidoOrigen.ts": "huella de origen: describe lo guardado tal cual; normalizarlo cambiaría hashes ya guardados",
  "lib/ai/phases/prompts.ts": "prompt de generación Express (esquemas JSON de ejemplo) y serializeMapaPESTEL, que solo emite la fuente y NO la fecha ni el nivel hacia M2–M5",
  "functions/src/pestel/classifier/claudePESTL.ts": "prompt y esquema de la Cloud Function (copia aparte, no importa lib/); ahí nace el literal «sin fecha»",
  "types/pestel.types.ts": "declaración de tipos",
  "types/moddulo.types.ts": "declaración de tipos",
  "app/centinela/fontana/FontanaComparativeTable.tsx": "`fechaCorte` de otro concepto: corte de un indicador de Fontana, no de una señal PESTEL",
  "app/sefix/components/lne/charts/OrigenCharts.tsx": "`fechaCorte` de otro concepto: corte de la Lista Nominal en Sefix, no de una señal PESTEL",
};

function listar(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre === ".next") continue;
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    if (st.isDirectory()) {
      if (nombre === "__fixtures__" || nombre === "__tests__") continue;
      listar(ruta, acc);
    } else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.(ts|tsx)$/.test(nombre) && !/\.d\.ts$/.test(nombre)) {
      acc.push(ruta);
    }
  }
  return acc;
}

/** Archivos que mencionan los campos de una señal sin importar `senalCampos` y sin estar exceptuados. Pura. */
export function archivosQueLeenSenalSinHelper(archivos: { ruta: string; texto: string }[], excepciones: Record<string, string> = EXCEPCIONES): string[] {
  return archivos
    .filter((a) => CAMPOS.test(a.texto) && !IMPORTA_HELPER.test(a.texto) && !(a.ruta in excepciones))
    .map((a) => a.ruta);
}

describe("senalCampos — recorrido", () => {
  const archivos = ["app", "lib", "types", "functions/src"].flatMap((d) => listar(join(RAIZ, d))).map((r) => ({
    ruta: relative(RAIZ, r).split("\\").join("/"),
    texto: readFileSync(r, "utf8"),
  }));

  it("hoy ningún archivo muestra o serializa fecha/nivel de una señal fuera de senalCampos (sin falsos positivos)", () => {
    expect(archivosQueLeenSenalSinHelper(archivos)).toEqual([]);
  });

  it("cada excepción existe y de verdad menciona el campo (no quedan excepciones muertas) y trae su motivo", () => {
    for (const [ruta, motivo] of Object.entries(EXCEPCIONES)) {
      const a = archivos.find((x) => x.ruta === ruta);
      expect(a, `la excepción ${ruta} no existe`).toBeDefined();
      expect(CAMPOS.test(a!.texto), `la excepción ${ruta} ya no menciona fechaCorte/nivelConfianza`).toBe(true);
      expect(motivo.length).toBeGreaterThan(10);
    }
  });

  it("EN NEGATIVO: un archivo nuevo que imprime `s.fechaCorte` por su cuenta SÍ se detecta; con el import o exceptuado, no", () => {
    const nuevo = { ruta: "app/nueva/Pie.tsx", texto: "export const P = ({ s }) => <span>{s.fechaCorte}</span>;" };
    expect(archivosQueLeenSenalSinHelper([nuevo])).toEqual(["app/nueva/Pie.tsx"]);
    expect(archivosQueLeenSenalSinHelper([{ ...nuevo, texto: nuevo.texto + '\nimport { fechaLegible } from "@/lib/pestel/senalCampos";' }])).toEqual([]);
    expect(archivosQueLeenSenalSinHelper([{ ruta: "app/nueva/Pie.tsx", texto: "s.nivelConfianza" }])).toEqual(["app/nueva/Pie.tsx"]);
    expect(archivosQueLeenSenalSinHelper([nuevo], { "app/nueva/Pie.tsx": "motivo de prueba" })).toEqual([]);
  });

  it("EN NEGATIVO REAL: el escáner sobre el árbol detectaría una de las piezas migradas si perdiera el import", () => {
    const pie = archivos.find((a) => a.ruta === "app/components/centinela/pestel/dashboard/PieSenalCentinela.tsx")!;
    expect(IMPORTA_HELPER.test(pie.texto)).toBe(true);
    const sinImport = { ruta: pie.ruta, texto: pie.texto.replace(/import \{[^}]*\} from "@\/lib\/pestel\/senalCampos";\n?/, "") + "\n// s.fechaCorte" };
    expect(archivosQueLeenSenalSinHelper([sinImport])).toEqual([pie.ruta]);
  });
});
