/**
 * scripts/check-docs-freshness.ts
 * Gap B — detector de frescura CLAUDE.md vs. código (Opción 1 de la
 * investigación: comparación determinística de fechas, sin LLM).
 *
 * Para cada entrada de docs/claude-md-freshness-manifest.json, resuelve
 * el ancla de texto a un número de línea ACTUAL (grep sobre el contenido
 * vía git show, nunca un número fijo — los números se corren con cada
 * edición de CLAUDE.md), obtiene la fecha del último commit real que
 * tocó esa línea (git log -L) y la compara contra la fecha del último
 * commit real que tocó cada ruta de código asociada. Si el código es más
 * reciente, marca la sección.
 *
 * Uso:
 *   npx tsx scripts/check-docs-freshness.ts [--ref <commit-ish>]
 *
 * --ref permite correr la comparación como si HEAD fuera otro commit
 * (usado para verificar retrospectivamente que el detector SÍ habría
 * marcado un caso ya conocido, antes de que se corrigiera).
 *
 * Código de salida: 0 si nada desactualizado, 1 si al menos 1 sección
 * se marca, si algún ancla no resuelve a exactamente 1 línea, o si el
 * manifiesto está mal formado.
 */

import * as fs from "fs";
import * as path from "path";
import { gitShowFile, gitLogLineTimestamp, gitLogPathTimestamp } from "./lib/freshnessGit";

const REPO_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "docs/claude-md-freshness-manifest.json");
const CLAUDE_MD = "CLAUDE.md";

export interface ManifestEntry {
  id: string;
  anchor: string;
  description: string;
  paths: string[];
}

export interface Manifest {
  entries: ManifestEntry[];
}

export class ManifestValidationError extends Error {}

/**
 * Valida la forma del manifiesto explícitamente — sin esto, un typo en
 * el JSON (campo faltante, tipo equivocado) fallaría más adelante con un
 * error de TypeScript/runtime confuso en vez de señalar QUÉ entrada y
 * QUÉ campo está mal.
 */
export function validateManifest(data: unknown): Manifest {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ManifestValidationError('El manifiesto debe ser un objeto JSON con un campo "entries".');
  }
  const entries = (data as Record<string, unknown>).entries;
  if (!Array.isArray(entries)) {
    throw new ManifestValidationError('El manifiesto debe tener un campo "entries" que sea un array.');
  }
  if (entries.length === 0) {
    throw new ManifestValidationError('"entries" no puede estar vacío.');
  }

  entries.forEach((raw, i) => {
    const entry = raw as Record<string, unknown>;
    const label = (field: string) =>
      `entries[${i}]${typeof entry?.id === "string" ? ` (id: "${entry.id}")` : ""}.${field}`;

    if (typeof entry !== "object" || entry === null) {
      throw new ManifestValidationError(`entries[${i}] debe ser un objeto.`);
    }
    if (typeof entry.id !== "string" || entry.id.trim() === "") {
      throw new ManifestValidationError(`${label("id")}: falta o está vacío (debe ser un string).`);
    }
    if (typeof entry.anchor !== "string" || entry.anchor.trim() === "") {
      throw new ManifestValidationError(`${label("anchor")}: falta o está vacío (debe ser un string).`);
    }
    if (typeof entry.description !== "string") {
      throw new ManifestValidationError(`${label("description")}: falta (debe ser un string).`);
    }
    if (!Array.isArray(entry.paths) || entry.paths.length === 0) {
      throw new ManifestValidationError(`${label("paths")}: debe ser un array con al menos 1 ruta.`);
    }
    entry.paths.forEach((p, j) => {
      if (typeof p !== "string" || p.trim() === "") {
        throw new ManifestValidationError(`${label(`paths[${j}]`)}: debe ser un string no vacío.`);
      }
    });
  });

  return data as Manifest;
}

export function loadManifest(manifestPath: string = MANIFEST_PATH): Manifest {
  const raw = fs.readFileSync(manifestPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ManifestValidationError(
      `${manifestPath} no es JSON válido: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return validateManifest(parsed);
}

export type EntryCheckResult =
  | { status: "fresh"; id: string }
  | { status: "no-code"; id: string }
  | { status: "stale"; id: string; description: string; line: number; docDate: number; codeDate: number; codePath: string; gapDays: number }
  | { status: "anchor-error"; id: string; error: string };

/** Resuelve un ancla de texto a su número de línea ACTUAL en `ref` — nunca un número fijo. */
export function resolveAnchorLine(
  anchor: string,
  ref: string,
  showFile: typeof gitShowFile = gitShowFile
): number | { error: string } {
  let content: string;
  try {
    content = showFile(ref, CLAUDE_MD);
  } catch {
    return { error: `no se pudo leer ${CLAUDE_MD} en ${ref}` };
  }
  const lines = content.split("\n");
  const matches: number[] = [];
  lines.forEach((line, i) => {
    if (line.includes(anchor)) matches.push(i + 1); // 1-indexed
  });
  if (matches.length === 0) return { error: `ancla "${anchor}" no encontrada en ${CLAUDE_MD}` };
  if (matches.length > 1) {
    return {
      error: `ancla "${anchor}" ambigua — coincide en ${matches.length} líneas (${matches.join(", ")})`,
    };
  }
  return matches[0];
}

export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / 86400);
}

export interface GitDeps {
  showFile: typeof gitShowFile;
  lineTimestamp: typeof gitLogLineTimestamp;
  pathTimestamp: typeof gitLogPathTimestamp;
}

const REAL_GIT_DEPS: GitDeps = {
  showFile: gitShowFile,
  lineTimestamp: gitLogLineTimestamp,
  pathTimestamp: gitLogPathTimestamp,
};

/** Evalúa una sola entrada del manifiesto. Inyecta `deps` en tests para no correr git de verdad. */
export function checkEntry(entry: ManifestEntry, ref: string, deps: GitDeps = REAL_GIT_DEPS): EntryCheckResult {
  const lineResult = resolveAnchorLine(entry.anchor, ref, deps.showFile);
  if (typeof lineResult === "object") {
    return { status: "anchor-error", id: entry.id, error: lineResult.error };
  }
  const line = lineResult;

  const docTs = deps.lineTimestamp(ref, CLAUDE_MD, line);
  if (docTs === null) {
    return { status: "anchor-error", id: entry.id, error: `no se pudo obtener fecha de edición de la línea ${line}` };
  }

  let newestCodeTs: number | null = null;
  let newestCodePath: string | null = null;
  for (const codePath of entry.paths) {
    const ts = deps.pathTimestamp(ref, codePath);
    if (ts !== null && (newestCodeTs === null || ts > newestCodeTs)) {
      newestCodeTs = ts;
      newestCodePath = codePath;
    }
  }

  if (newestCodeTs === null) return { status: "no-code", id: entry.id };

  if (newestCodeTs > docTs) {
    return {
      status: "stale",
      id: entry.id,
      description: entry.description,
      line,
      docDate: docTs,
      codeDate: newestCodeTs,
      codePath: newestCodePath as string,
      gapDays: daysBetween(docTs, newestCodeTs),
    };
  }

  return { status: "fresh", id: entry.id };
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function printResult(r: EntryCheckResult): void {
  switch (r.status) {
    case "fresh":
      console.log(`✅ ${r.id}: al día`);
      break;
    case "no-code":
      console.log(`•  ${r.id}: sin código todavía en ninguna de sus rutas — nada que comparar`);
      break;
    case "anchor-error":
      console.log(`⚠️  ${r.id}: ${r.error}`);
      break;
    case "stale":
      console.log(
        `🔴 DESACTUALIZADA — ${r.id} (${r.description})\n` +
          `    CLAUDE.md línea ${r.line} editada por última vez: ${formatDate(r.docDate)}\n` +
          `    ${r.codePath} tocado por última vez:        ${formatDate(r.codeDate)}\n` +
          `    Brecha: ${r.gapDays} días\n`
      );
      break;
  }
}

function parseRefArg(): string {
  const idx = process.argv.indexOf("--ref");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : "HEAD";
}

function main() {
  const ref = parseRefArg();
  console.log(`Verificando frescura de CLAUDE.md contra código real (ref: ${ref})\n`);

  let manifest: Manifest;
  try {
    manifest = loadManifest();
  } catch (err) {
    if (err instanceof ManifestValidationError) {
      console.error(`❌ Manifiesto inválido (${MANIFEST_PATH}):\n   ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const results = manifest.entries.map((entry) => checkEntry(entry, ref));
  results.forEach(printResult);

  const staleCount = results.filter((r) => r.status === "stale").length;
  const errorCount = results.filter((r) => r.status === "anchor-error").length;

  console.log(
    `\n${staleCount} sección(es) desactualizada(s), ${errorCount} error(es) de resolución de ancla, de ${manifest.entries.length} entradas.`
  );
  process.exit(staleCount > 0 || errorCount > 0 ? 1 : 0);
}

const isMain = require.main === module;
if (isMain) {
  main();
}
