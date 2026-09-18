// scripts/lib/freshnessGit.ts
// Boundary de I/O real (git + filesystem) para check-docs-freshness.ts —
// separado en su propio módulo para poder mockearlo en tests, mismo
// criterio de "mocking en el boundary del módulo" usado en gap A
// (lib/moddulo/__tests__/fixtures/adminMocks.ts).

import { execFileSync } from "child_process";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../..");

/** Contenido completo de un archivo en un ref dado. Lanza si el ref/archivo no existe. */
export function gitShowFile(ref: string, filePath: string): string {
  return execFileSync("git", ["show", `${ref}:${filePath}`], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

/** Timestamp unix del último commit que tocó esa línea de un archivo, hasta `ref`. Null si no se pudo determinar. */
export function gitLogLineTimestamp(ref: string, filePath: string, line: number): number | null {
  try {
    const out = execFileSync(
      "git",
      ["log", ref, "-1", "--format=%at", "-L", `${line},${line}:${filePath}`],
      { cwd: REPO_ROOT, encoding: "utf-8" }
    );
    const firstLine = out.split("\n")[0].trim();
    return firstLine ? parseInt(firstLine, 10) : null;
  } catch {
    return null;
  }
}

/** Timestamp unix del último commit que tocó `codePath`, hasta `ref`. Null si no hay commits (ruta sin código aún). */
export function gitLogPathTimestamp(ref: string, codePath: string): number | null {
  try {
    const out = execFileSync("git", ["log", ref, "-1", "--format=%at", "--", codePath], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();
    return out ? parseInt(out, 10) : null;
  } catch {
    return null;
  }
}
