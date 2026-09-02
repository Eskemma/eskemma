/**
 * scripts/migrate-fontana-disponibilidad-temporal.ts
 * Migración única (idempotente) — puebla el campo `disponibilidadTemporal`
 * en los 86 indicadores de data/fontana/INDICATOR_REGISTRY.json a partir
 * de la clasificación FINAL de
 * docs/ecosistema/T10-fontana/auditoria-series-temporales.md (tras el
 * addendum de decisiones de producto del 2026-08-31).
 *
 * Uso: npx tsx scripts/migrate-fontana-disponibilidad-temporal.ts
 * Después: npx tsx scripts/upload-fontana-registry.ts  (para subir a Storage)
 *
 * NO procesa ninguna serie real — eso es la Tarea 2.
 */

import * as fs from "fs";
import * as path from "path";

const REGISTRY_PATH = path.resolve(__dirname, "../data/fontana/INDICATOR_REGISTRY.json");

// Motivos "d" reusados tal cual de lib/fontana/ingesta/types.ts
const MOTIVO_PENDIENTE_SEFIX_AI = "Pendiente — se habilitará cuando Sefix-AI esté disponible";
const MOTIVO_RFOSC_CAIDO =
  "Fuente no disponible — infraestructura de RFOSC/CLUNI caída, reintentar en una próxima ronda";

// Las 6 variantes de `nota` (ver instrucción de la ronda 2026-08-31).
const NOTA = {
  A_GEN:
    "Fontana hoy solo muestra el corte más reciente. La fuente sí tiene historia disponible; capturarla es una función pendiente, no un dato inexistente.",
  A_F38:
    "Fontana hoy solo muestra el corte más reciente. La fuente (decretos DOF) sí tiene historia, pero procesarla requiere revisar documentos de años anteriores uno por uno; no está priorizado por ahora.",
  B_GEN:
    "Este indicador no tiene serie temporal: la fuente original solo publica una medición, no un histórico.",
  B_COMPARABILIDAD:
    "Existen datos de ediciones anteriores del Censo, pero un cambio de metodología entre 2010/2015 y 2020 impide garantizar que sean comparables sin revisión adicional; no se muestra serie hasta confirmarlo.",
  B_ANVCC:
    "Este indicador no tiene serie temporal en Fontana: la fuente que usamos (ANVCC) no la expone. Existen fuentes primarias con historial (ej. CONAFOR, SEGOB), pero no están conectadas en esta versión de Fontana.",
} as const;

type Categoria = "a" | "b" | "c" | "d";

// Sub-grupos con nota especial (todo lo demás usa la nota genérica de su categoría).
const F38 = new Set(["F3-8"]);
const B_COMPARABILIDAD = new Set(["F1-15", "F1-19", "F2-13"]);
const B_ANVCC = new Set(["F5-11", "F5-12", "F5-13", "F5-14", "F5-15", "F5-16", "F5-17"]);
const D_SEFIX = new Set(["F3-5", "F3-6", "F3-9", "F3-10", "F3-11", "F3-12", "F3-13", "F3-14"]);
const D_RFOSC = new Set(["F3-15"]);

// Clasificación 1:1 con la auditoría final (a=57, b=19, c=1, d=9).
const CATEGORIA: Record<string, Categoria> = {};
const setCat = (ids: string[], cat: Categoria) => ids.forEach((id) => (CATEGORIA[id] = cat));

setCat(
  [
    // F1 (a): todos menos F1-15, F1-16, F1-19
    "F1-1", "F1-2", "F1-3", "F1-4", "F1-5", "F1-6", "F1-7", "F1-8", "F1-9", "F1-10",
    "F1-11", "F1-12", "F1-13", "F1-14", "F1-17", "F1-18",
    // F2 (a): todos menos F2-13 (b) y F2-17 (c)
    "F2-1", "F2-2", "F2-3", "F2-4", "F2-5", "F2-6", "F2-7", "F2-8", "F2-9", "F2-10",
    "F2-11", "F2-12", "F2-14", "F2-15", "F2-16", "F2-18", "F2-19", "F2-20", "F2-21", "F2-22",
    // F3 (a)
    "F3-1", "F3-2", "F3-3", "F3-4", "F3-7", "F3-8", "F3-16", "F3-17",
    // F4 (a): todos menos F4-6
    "F4-1", "F4-2", "F4-3", "F4-4", "F4-5", "F4-7", "F4-8", "F4-9", "F4-10", "F4-11",
    // F5 (a)
    "F5-6", "F5-7", "F5-8",
  ],
  "a"
);
setCat(
  [
    "F1-15", "F1-16", "F1-19", "F2-13", "F4-6",
    "F5-1", "F5-2", "F5-3", "F5-4", "F5-5", "F5-9", "F5-10",
    "F5-11", "F5-12", "F5-13", "F5-14", "F5-15", "F5-16", "F5-17",
  ],
  "b"
);
setCat(["F2-17"], "c");
setCat(
  ["F3-5", "F3-6", "F3-9", "F3-10", "F3-11", "F3-12", "F3-13", "F3-14", "F3-15"],
  "d"
);

function notaPara(id: string, cat: Categoria): string {
  if (cat === "d") return D_RFOSC.has(id) ? MOTIVO_RFOSC_CAIDO : MOTIVO_PENDIENTE_SEFIX_AI;
  if (cat === "c") return NOTA.A_GEN; // mismo efecto para el usuario que "a"
  if (cat === "a") return F38.has(id) ? NOTA.A_F38 : NOTA.A_GEN;
  // cat === "b"
  if (B_COMPARABILIDAD.has(id)) return NOTA.B_COMPARABILIDAD;
  if (B_ANVCC.has(id)) return NOTA.B_ANVCC;
  return NOTA.B_GEN;
}

function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as Array<
    Record<string, unknown> & { id: string }
  >;

  const idsRegistry = new Set(registry.map((i) => i.id));
  const idsClasificados = new Set(Object.keys(CATEGORIA));
  const faltantes = [...idsRegistry].filter((id) => !idsClasificados.has(id));
  const sobrantes = [...idsClasificados].filter((id) => !idsRegistry.has(id));
  if (faltantes.length || sobrantes.length) {
    console.error("Desajuste de IDs. Faltan clasificar:", faltantes, " | sobran:", sobrantes);
    process.exit(1);
  }

  const conteo: Record<Categoria, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (const ind of registry) {
    const cat = CATEGORIA[ind.id];
    ind.disponibilidadTemporal = { categoria: cat, nota: notaPara(ind.id, cat) };
    conteo[cat]++;
  }

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf-8");
  console.log(`OK — ${registry.length} indicadores poblados.`);
  console.log("Conteo por categoría:", conteo);
  console.log("Nota especial F3-8:", registry.find((i) => i.id === "F3-8")!.disponibilidadTemporal);
  console.log("Nota especial F5-11:", registry.find((i) => i.id === "F5-11")!.disponibilidadTemporal);
  console.log("Nota especial F1-15:", registry.find((i) => i.id === "F1-15")!.disponibilidadTemporal);
  console.log("\nSiguiente paso: npx tsx scripts/upload-fontana-registry.ts");
}

main();
