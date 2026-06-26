/**
 * scripts/seed-knowledge-base.ts
 *
 * Carga RAE, RPF, MEC, MVP y FODA a Firestore.
 * Uso:
 *   --type=rae   --file=./data/moddulo_docs/RAE.xlsx  --version=1.0
 *   --type=rpf   --file=./data/moddulo_docs/RPF.xlsx  --version=1.0
 *   --type=mec   --file=./data/moddulo_docs/MEC.md    --version=1.0
 *   --type=mvp   --file=./data/moddulo_docs/MVP.md    --version=1.0
 *   --type=foda  --file=./data/moddulo_docs/FODA.md   --version=1.0
 */

import * as admin from "firebase-admin";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ─── Firebase Admin ───────────────────────────────────────────────────────────

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    console.error(
      "Faltan variables: FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID"
    );
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}
const db = admin.firestore();

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : null;
};

const filePath = getArg("file");
const version = getArg("version");
const notes = getArg("notes");
const docType = getArg("type") || "rae";

if (!filePath || !version) {
  console.error(
    "Uso: npx ts-node scripts/seed-knowledge-base.ts --file=FILE --version=1.0 --type=rae"
  );
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Archivo no encontrado: ${resolvedPath}`);
  process.exit(1);
}

// ─── Generic text helpers (Markdown parsers) ──────────────────────────────────

/** Remove Word-to-Markdown artifacts: lone page numbers, double spaces */
function normalizeText(text: string): string {
  return text
    .replace(/^## \d+\s*$/gm, "")
    .replace(/  +/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract text starting after startMarker, ending before endMarker (or EOF) */
function extractBetweenMarkers(text: string, startMarker: string, endMarker: string): string {
  const si = text.indexOf(startMarker);
  if (si < 0) return "";
  const after = text.substring(si + startMarker.length);
  const ei = endMarker ? after.indexOf(endMarker) : -1;
  return ei >= 0 ? after.substring(0, ei) : after;
}

// ─── Helpers for xlsx parsers ─────────────────────────────────────────────────

function parseFases(raw: string): number[] {
  return raw
    .split(/[,/\r\n]+/)
    .map((f) => parseInt(f.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 9);
}

function parseVariablesXPCTO(raw: string): string[] {
  const map: Record<string, string> = { X: "X", P: "P", C: "C", T: "T", O: "O" };
  return raw
    .split(/[,/]+/)
    .map((v) => v.trim())
    .map((v) => {
      for (const key of Object.keys(map)) {
        if (v.startsWith(key)) return map[key];
      }
      return null;
    })
    .filter((v): v is string => v !== null);
}

function parseSeveridad(raw: string): string {
  const count = (raw.match(/\*/g) || []).length;
  if (count >= 5) return "crítica";
  if (count >= 4) return "muy_alta";
  if (count >= 3) return "alta";
  if (count >= 2) return "media";
  return "baja";
}

// ─── RAE parser ───────────────────────────────────────────────────────────────

function parseRAE(workbook: XLSX.WorkBook, versionId: string, notesStr: string) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  const axiomas = rows
    .filter((row) => row["ID/Nombre del Axioma"]?.trim())
    .map((row, index) => {
      const variables = parseVariablesXPCTO(row["Variable XPCTO"] || "");
      const fases = parseFases(row["Fase"] || "");
      const keywords = (row["Keywords (#)"] || "")
        .split(/[,\s]+/)
        .filter((k) => k.startsWith("#"));

      return {
        id: `RAE-${String(index + 1).padStart(3, "0")}`,
        nombre: row["ID/Nombre del Axioma"].trim(),
        axioma: row["Protocolo de Acción (Sugerencia Moddulo)"]?.trim() || "",
        axioma_original: row["Axioma original"]?.trim() || "",
        variable_xpcto: variables,
        fases_aplicacion: fases.length > 0 ? fases : [1, 2, 3, 4, 5, 6, 7, 8, 9],
        tipos_proyecto: [],
        protocolo_accion: row["Protocolo de Acción (Sugerencia Moddulo)"]?.trim() || "",
        keywords,
        severidad: parseSeveridad(row["Severidad"] || ""),
      };
    });

  return {
    versionId,
    notas: notesStr || `Versión ${versionId}`,
    axiomas,
    publicadoEn: admin.firestore.Timestamp.now(),
    publicadoPor: "seed-script",
  };
}

// ─── RPF parser ───────────────────────────────────────────────────────────────

const VALID_TIPOS = ["Electoral", "Gubernamental", "Legislativo", "Ciudadano"];

function parseRPF(workbook: XLSX.WorkBook, versionId: string) {
  const entries: object[] = [];
  let entryIndex = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

    rows
      .filter((row) => {
        const tipo = row["Tipo"]?.trim();
        return (
          VALID_TIPOS.includes(tipo) &&
          row["Componente"]?.trim() &&
          row["Sub-componente"]?.trim()
        );
      })
      .forEach((row) => {
        const tipo = row["Tipo"].trim().toLowerCase();
        entryIndex++;

        entries.push({
          id: `RPF-${tipo.toUpperCase().slice(0, 3)}-${String(entryIndex).padStart(3, "0")}`,
          componente: row["Componente"]?.trim() || "",
          sub_componente: row["Sub-componente"]?.trim() || "",
          apartado: row["Apartado"]?.trim() || "",
          tipos_proyecto: [tipo],
          descripcion_alcance: row["Descripción alcance"]?.trim() || "",
          planeacion: row["Planeación (Marco analítico)"]?.trim() || "",
          organizacion: row["Organización (Recursos del consultor)"]?.trim() || "",
          direccion: row["Dirección (Criterio técnico)"]?.trim() || "",
          control: row["Control (Estándar de calidad)"]?.trim() || "",
          aporte_tactico: row["Aporte táctico al cometido"]?.trim() || "",
          variables_personalizacion: row["Variables de personalización (F5/F6)"]?.trim() || "",
          logica_coherencia: row["Lógica de coherencia estratégica"]?.trim() || "",
          vinculo_kpi: row["Vínculo con KPI (M3 de F7)"]?.trim() || "",
          axiomas_rae: (row["Axiomas RAE aplicables"] || "")
            .split("·")
            .map((s: string) => s.trim())
            .filter(Boolean),
          instrumentos_vinculados: (row["Instrumento del ecosistema vinculado"] || "")
            .split("·")
            .map((s: string) => s.trim())
            .filter(Boolean),
          version: versionId,
          actualizadoEn: admin.firestore.Timestamp.now(),
        });
      });
  }

  return entries;
}

// ─── MEC parser ───────────────────────────────────────────────────────────────
// MEC.md has 4 sections, one per tipo_proyecto.
// Each section is anchored by "Bloque 1 · Los ejes del MEC [Tipo]".
// The anchor appears TWICE: once in the TOC (followed by dots) and once in content.
// We extract:
//   - ejes: from Bloque 1 (Eje N — name + ## Polo+ ←→ Polo-)
//   - narrativas: from Bloque 5 (## Narrativa N · name, Sugerencia estratégica: ...)

/** Find the content-area occurrence of anchor, skipping TOC entries (followed by dots) */
function findContentAnchor(content: string, anchor: string): number {
  let idx = 0;
  while (true) {
    const found = content.indexOf(anchor, idx);
    if (found < 0) return -1;
    const lineEnd = content.indexOf("\n", found);
    const afterAnchor = content.substring(
      found + anchor.length,
      lineEnd > 0 ? lineEnd : found + anchor.length + 30
    );
    if (!afterAnchor.includes("..")) return found;
    idx = found + 1;
  }
}

interface MECNarrativaRaw {
  id: string;
  nombre: string;
  cuadrante: string;
  instruccion_moddulo: string;
}

interface MECEjeRaw {
  id: string;
  nombre: string;
  descripcion: string;
  polos: { positivo: string; negativo: string };
}

function parseMECEjes(bloque1Text: string): MECEjeRaw[] {
  const ejes: MECEjeRaw[] = [];
  const ejeRx = /^Eje (\d+) — (.+)$/gm;
  let m: RegExpExecArray | null;

  while ((m = ejeRx.exec(bloque1Text)) !== null) {
    const num = m[1];
    const nombre = m[2].trim();
    const after = bloque1Text.substring(m.index + m[0].length);
    // Pole line: "## Continuidad ←————————→ Cambio"
    const poleMatch = after.match(/^## ([^←\n]+?) ←[—]+→ (.+)$/m);
    ejes.push({
      id: `eje-${num}`,
      nombre,
      descripcion: poleMatch ? `${poleMatch[1].trim()} ←→ ${poleMatch[2].trim()}` : "",
      polos: {
        positivo: poleMatch ? poleMatch[1].trim() : "",
        negativo: poleMatch ? poleMatch[2].trim() : "",
      },
    });
  }

  return ejes;
}

function parseMECNarrativas(bloque5Text: string, tipoPrefix: string): MECNarrativaRaw[] {
  // Narratives appear as either:
  //   "## Narrativa N · Name" (heading) — cuadrante on next line
  //   "Narrativa N · Name Escenario CX" (plain, cuadrante same line)
  //   "Narrativa N · Name\nEscenario CX" (plain, cuadrante next line)
  // Both formats can appear in the same tipo section, so we always try both and merge.

  const seenNums = new Set<number>();
  const collected: { index: number; num: number; nombre: string; cuadrante: string }[] = [];
  let m: RegExpExecArray | null;

  // Format A: ## heading (allow multiple spaces from Word conversion)
  const rxA = /^##\s+Narrativa\s+(\d+)\s+·\s+(.+)$/gm;
  while ((m = rxA.exec(bloque5Text)) !== null) {
    const num = parseInt(m[1]);
    const after = bloque5Text.substring(m.index + m[0].length);
    const cuadMatch = after.match(/Escenario (C\d+)/);
    seenNums.add(num);
    collected.push({
      index: m.index,
      num,
      nombre: normalizeText(m[2]),
      cuadrante: cuadMatch ? cuadMatch[1] : "",
    });
  }

  // Format B: plain text — cuadrante may be on same or next line
  const rxB = /^Narrativa\s+(\d+)\s+·\s+(.+)$/gm;
  while ((m = rxB.exec(bloque5Text)) !== null) {
    const num = parseInt(m[1]);
    if (seenNums.has(num)) continue; // already captured by Format A
    const rawName = m[2].trim();
    // If cuadrante is on the same line: "El Arquitecto Escenario C1"
    const sameLineCuad = rawName.match(/^(.+?)\s+Escenario (C\d+)/);
    let nombre: string;
    let cuadrante: string;
    if (sameLineCuad) {
      nombre = sameLineCuad[1].trim();
      cuadrante = sameLineCuad[2];
    } else {
      nombre = rawName;
      // Look for cuadrante in the next few lines
      const after = bloque5Text.substring(m.index + m[0].length, m.index + m[0].length + 200);
      const nextLineCuad = after.match(/Escenario (C\d+)/);
      cuadrante = nextLineCuad ? nextLineCuad[1] : "";
    }
    seenNums.add(num);
    collected.push({ index: m.index, num, nombre, cuadrante });
  }

  collected.sort((a, b) => a.index - b.index);

  return collected.map((match) => {
    const after = bloque5Text.substring(match.index);
    const sugMatch = after.match(
      /Sugerencia\s+estrat[eé]gica[:\s]+([\s\S]+?)(?=\n\n## (?:Escenario|Narrativa)|\nNarrativa \d+ ·|\nNarrativas del|\nBloque \d|$)/
    );
    return {
      id: `${tipoPrefix}-nar-${String(match.num).padStart(2, "0")}`,
      nombre: match.nombre,
      cuadrante: match.cuadrante,
      instruccion_moddulo: sugMatch ? normalizeText(sugMatch[1]) : "",
    };
  });
}

function parseMECFile(content: string): object[] {
  const TIPOS = ["Electoral", "Gubernamental", "Legislativo", "Ciudadano"];
  const instruments: object[] = [];

  for (let i = 0; i < TIPOS.length; i++) {
    const tipo = TIPOS[i];
    const anchor = `Bloque 1 · Los ejes del MEC ${tipo}`;
    const start = findContentAnchor(content, anchor);
    if (start < 0) {
      console.warn(`   ⚠️  No se encontró ancla de contenido para MEC ${tipo}`);
      continue;
    }

    const nextTipo = TIPOS[i + 1];
    const nextAnchor = nextTipo ? `Bloque 1 · Los ejes del MEC ${nextTipo}` : null;
    const end = nextAnchor ? findContentAnchor(content, nextAnchor) : -1;
    const sectionText = end >= 0
      ? content.substring(start + anchor.length, end)
      : content.substring(start + anchor.length);

    // Bloque 1 ends at "Bloque 2"
    const bloque1 = extractBetweenMarkers(sectionText, "", "\nBloque 2");
    const ejes = parseMECEjes(bloque1);

    // Bloque 5 starts at "Bloque 5"
    const bloque5Start = sectionText.indexOf("\nBloque 5");
    const bloque5 = bloque5Start >= 0 ? sectionText.substring(bloque5Start) : "";
    const tipoPrefix = tipo.toLowerCase().slice(0, 3);
    const narrativas = parseMECNarrativas(bloque5, tipoPrefix);

    instruments.push({
      id: `mec-${tipo.toLowerCase()}`,
      tipo_proyecto: tipo.toLowerCase(),
      nombre: `MEC ${tipo}`,
      descripcion: `Mapa de Espacio Competitivo para proyectos de tipo ${tipo}. ` +
        `Define los ejes de posicionamiento político y las narrativas estratégicas disponibles.`,
      ejes,
      narrativas,
      version: version!,
      actualizadoEn: admin.firestore.Timestamp.now(),
    });

    console.log(`   ${tipo}: ${ejes.length} ejes, ${narrativas.length} narrativas`);
  }

  return instruments;
}

// ─── MVP parser ───────────────────────────────────────────────────────────────
// MVP.md has 6 vectors in the content area (after the TOC, ~line 640).
// Each vector starts with "Vector N. Name" (plain text, no dots in content area).
// We extract: definicion, especificidades (4 types), indicadores.

interface MVPVectorRaw {
  id: string;
  nombre: string;
  descripcion: string;
  indicadores: string[];
  umbral_critico: string;
  especificidades: {
    electoral: string;
    gubernamental: string;
    legislativo: string;
    ciudadano: string;
  };
}

function extractMVPDefinicion(vectorText: string): string {
  const start = vectorText.indexOf("## Definición");
  if (start < 0) return "";
  const after = vectorText.substring(start + "## Definición".length);
  // Ends at next plain-text section header or ## heading
  const nextMatch = after.match(/\nPropósito estratégico|\nDimensiones de análisis|\nEspecificidades|\n## /);
  const end = nextMatch ? after.indexOf(nextMatch[0]) : -1;
  const raw = end >= 0 ? after.substring(0, end) : after.substring(0, 800);
  return normalizeText(raw);
}

function extractMVPEspecificidades(vectorText: string): {
  electoral: string; gubernamental: string; legislativo: string; ciudadano: string;
} {
  const tipoEntries: { key: string; marker: string }[] = [
    { key: "electoral", marker: "Especificidades para proyectos electorales" },
    { key: "gubernamental", marker: "Especificidades para proyectos gubernamentales" },
    { key: "legislativo", marker: "Especificidades para proyectos legislativos" },
    { key: "ciudadano", marker: "Especificidades para proyectos ciudadanos" },
  ];
  const result = { electoral: "", gubernamental: "", legislativo: "", ciudadano: "" };

  for (let i = 0; i < tipoEntries.length; i++) {
    const { key, marker } = tipoEntries[i];
    const nextMarker = i + 1 < tipoEntries.length
      ? tipoEntries[i + 1].marker
      : "Aplicación por tipo";

    const si = vectorText.indexOf(marker);
    if (si < 0) continue;

    const after = vectorText.substring(si + marker.length);
    const ei = after.indexOf(nextMarker);
    const raw = ei >= 0 ? after.substring(0, ei) : after.substring(0, 600);
    result[key as keyof typeof result] = normalizeText(raw);
  }

  return result;
}

function extractMVPIndicadores(vectorText: string): string[] {
  const si = vectorText.indexOf("Indicadores clave");
  if (si < 0) return [];
  const after = vectorText.substring(si + "Indicadores clave".length);
  const ei = after.indexOf("\nInteracción");
  const block = ei >= 0 ? after.substring(0, ei) : after;
  return block
    .split("\n")
    .filter((l) => /^[-•]/.test(l.trim()))
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function parseMVPFile(content: string): object {
  // Content area starts at first "Vector 1." occurrence after the TOC (~line 640)
  // TOC entries have trailing dots; content entries don't.
  const lines = content.split("\n");
  const contentStartLine = lines.findIndex(
    (line, i) => i > 600 && /^Vector 1\./.test(line) && !line.includes(".")
    // Note: The content "Vector 1. Identidad y Posicionamiento" won't have trailing dots
    // but let's also try a fallback by checking if there are "..." in the line
  );
  // Fallback: use a character offset (TOC is ~first 15000 chars)
  const contentOffset = contentStartLine >= 0
    ? lines.slice(0, contentStartLine).join("\n").length
    : 15000;

  const contentArea = content.substring(contentOffset);

  // Split into vector sections by "Vector N. " at line start
  const vectorSections = contentArea.split(/(?=^Vector \d+\. )/m);

  const vectores: MVPVectorRaw[] = [];

  for (const section of vectorSections) {
    const firstLineMatch = section.match(/^Vector (\d+)\. (.+)$/m);
    if (!firstLineMatch) continue;

    const num = firstLineMatch[1];
    const nombre = firstLineMatch[2].trim();

    const descripcion = extractMVPDefinicion(section);
    const especificidades = extractMVPEspecificidades(section);
    const indicadores = extractMVPIndicadores(section);

    vectores.push({
      id: `mvp-v${num}`,
      nombre,
      descripcion,
      indicadores,
      umbral_critico: "",
      especificidades,
    });
  }

  console.log(`   ${vectores.length} vectores encontrados`);
  for (const v of vectores) {
    const indCount = v.indicadores.length;
    const hasEsp = Object.values(v.especificidades).filter(Boolean).length;
    console.log(`     ${v.id}: "${v.nombre}" — ${indCount} indicadores, ${hasEsp}/4 especificidades`);
  }

  return {
    id: "mvp-general",
    nombre: "Marco de Vectores Políticos (MVP)",
    descripcion: "Los seis vectores que articulan el posicionamiento político integral de un proyecto.",
    vectores,
    version: version!,
    actualizadoEn: admin.firestore.Timestamp.now(),
  };
}

// ─── FODA parser ──────────────────────────────────────────────────────────────
// FODA.md has 5 instrumentos in the content area (after TOC, ~line 500).
// Each instrumento: "Instrumento N – Name" (plain text).
// We extract: definicion, componentes (name + definicion).
// Instrumento 1 & 2: ## Componente N · Name headings
// Instrumento 3: Matriz A/B/C/D – Name plain text
// Instrumento 4 & 5: Componente X · Name plain text

interface FODAComponenteRaw {
  nombre: string;
  definicion: string;
}

interface FODAMarcoRaw {
  sigla: string;
  nombre: string;
  fase: string;
  definicion: string;
  componentes: FODAComponenteRaw[];
}

const FODA_INSTRUMENTOS: { sigla: string; nombre: string; fase: string }[] = [
  { sigla: "FODA", nombre: "FODA Propio", fase: "Fase 3" },
  { sigla: "ADV", nombre: "FODA de Adversarios", fase: "Fase 3" },
  { sigla: "MAT", nombre: "Matrices de valoración", fase: "Fase 3" },
  { sigla: "CAME", nombre: "CAME", fase: "Fase 4" },
  { sigla: "IBEA", nombre: "IBEA", fase: "Fase 4" },
];

function extractFODAComponentes(instrText: string): FODAComponenteRaw[] {
  // Collect all component positions from three possible patterns:
  //   1. "## Componente N · Name" (Instr 1 & 2)
  //   2. "Componente X · Name" plain (Instr 4 & 5) — must start at line beginning
  //   3. "Matriz A – Name" or "Matriz A/B/C/D – Name" (Instr 3)
  const matches: { index: number; nombre: string }[] = [];

  // rx1: ## Componente N · Name (Instrumento 1 & 2 as heading — but only Instrumento 1 uses ##)
  // rx2: Componente N · Name or Componente X · Name plain text (Instrumento 2, 4, 5)
  // rx3: Matriz A – Name (Instrumento 3)
  const rx1 = /^## Componente \d+ · (.+)$/gm;
  const rx2 = /^Componente (?:[A-Z]|\d+) · (.+)$/gm;
  const rx3 = /^Matriz ([A-D]) [–-] (.+)$/gm;

  let m: RegExpExecArray | null;
  while ((m = rx1.exec(instrText)) !== null) {
    matches.push({ index: m.index, nombre: m[1].trim() });
  }
  while ((m = rx2.exec(instrText)) !== null) {
    // Avoid double-matching positions already captured by rx1
    if (!matches.some((x) => Math.abs(x.index - m!.index) < 5)) {
      matches.push({ index: m.index, nombre: m[1].trim() });
    }
  }
  while ((m = rx3.exec(instrText)) !== null) {
    matches.push({ index: m.index, nombre: `Matriz ${m[1]} – ${m[2].trim()}` });
  }

  matches.sort((a, b) => a.index - b.index);

  return matches.map((match, i) => {
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : instrText.length;
    const compText = instrText.substring(match.index, nextIndex);

    // Find first ## Definición inside this component block
    const defStart = compText.indexOf("## Definición");
    let definicion = "";
    if (defStart >= 0) {
      const afterDef = compText.substring(defStart + "## Definición".length);
      // Collect until next ## heading or a blank line followed by a capitalized word
      const stop = afterDef.match(/\n## |\n\nLógica|\n\nPrincipio|\n\n[A-Z][a-záéíóú]{3}/);
      const end = stop ? afterDef.indexOf(stop[0]) : -1;
      const raw = end >= 0 ? afterDef.substring(0, end) : afterDef.substring(0, 500);
      definicion = normalizeText(raw);
    }

    return { nombre: match.nombre, definicion };
  });
}

function extractFODADefinicion(instrText: string): string {
  const start = instrText.indexOf("## Definición");
  if (start < 0) return "";
  const after = instrText.substring(start + "## Definición".length);
  // End at next ## heading or at "Estructura" / "Principio" section
  const stop = after.match(/\n## (?!Definición)|\nEstructura del|\nPrincipio rector/);
  const end = stop ? after.indexOf(stop[0]) : -1;
  const raw = end >= 0 ? after.substring(0, end) : after.substring(0, 600);
  return normalizeText(raw);
}

function parseFODAFile(content: string): object {
  // Content area starts after the TOC (~line 500, ~12000 chars)
  // The first "Instrumento 1" in content (not TOC) has no trailing dots
  const contentStart = (() => {
    let idx = 0;
    while (true) {
      const found = content.indexOf("\nInstrumento 1", idx);
      if (found < 0) return 12000;
      // Check if the line has dots (TOC entry) or not (content)
      const lineEnd = content.indexOf("\n", found + 1);
      const line = content.substring(found + 1, lineEnd > 0 ? lineEnd : found + 80);
      if (!line.includes("....")) return found;
      idx = found + 1;
    }
  })();

  const contentArea = content.substring(contentStart);
  const marcos: FODAMarcoRaw[] = [];

  for (let i = 0; i < FODA_INSTRUMENTOS.length; i++) {
    const meta = FODA_INSTRUMENTOS[i];
    const anchor = `Instrumento ${i + 1}`;
    const si = contentArea.indexOf(anchor);
    if (si < 0) {
      console.warn(`   ⚠️  No se encontró ${anchor} en el contenido`);
      continue;
    }

    const nextAnchor = i + 1 < FODA_INSTRUMENTOS.length ? `Instrumento ${i + 2}` : null;
    const ei = nextAnchor ? contentArea.indexOf(nextAnchor, si + anchor.length) : -1;
    const instrText = ei >= 0
      ? contentArea.substring(si, ei)
      : contentArea.substring(si);

    const definicion = extractFODADefinicion(instrText);
    const componentes = extractFODAComponentes(instrText);

    marcos.push({
      sigla: meta.sigla,
      nombre: meta.nombre,
      fase: meta.fase,
      definicion,
      componentes,
    });

    console.log(`   ${meta.sigla}: "${meta.nombre}" — ${componentes.length} componentes`);
  }

  return {
    id: "foda-general",
    nombre: "Sistema FODA-CAME-IBEA",
    descripcion:
      "Los cinco instrumentos de diagnóstico estratégico: FODA Propio, FODA de Adversarios, " +
      "Matrices de valoración, CAME e IBEA.",
    marcos,
    version: version!,
    actualizadoEn: admin.firestore.Timestamp.now(),
  };
}

// ─── Firestore writers ────────────────────────────────────────────────────────

async function seedRAE(workbook: XLSX.WorkBook) {
  console.log("📚 Procesando RAE...");
  const raeData = parseRAE(workbook, version!, notes || "");
  console.log(`   ${raeData.axiomas.length} axiomas encontrados`);

  await db.collection("rae_versions").doc(version!).set(raeData);
  console.log(`   ✅ Snapshot guardado en rae_versions/${version}`);

  await db.collection("rae_versions").doc("active").set({
    versionId: version,
    actualizadoEn: admin.firestore.Timestamp.now(),
  });
  console.log(`   ✅ Puntero 'active' actualizado → versión ${version}`);
}

async function seedRPF(workbook: XLSX.WorkBook) {
  console.log("📋 Procesando RPF...");
  const entries = parseRPF(workbook, version!);
  console.log(`   ${entries.length} entradas encontradas`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((entry: any) => {
      const ref = db.collection("rpf_entries").doc(entry.id);
      batch.set(ref, entry);
    });
    await batch.commit();
    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} entradas`);
  }
  console.log(`   ✅ ${entries.length} entradas escritas en rpf_entries/`);
}

async function seedMEC(content: string) {
  console.log("🗺️  Procesando MEC...");
  const instruments = parseMECFile(content);

  const batch = db.batch();
  for (const instr of instruments) {
    const doc = instr as { id: string };
    const ref = db.collection("mec_instruments").doc(doc.id);
    batch.set(ref, instr);
  }
  await batch.commit();
  console.log(`   ✅ ${instruments.length} documentos escritos en mec_instruments/`);
}

async function seedMVP(content: string) {
  console.log("🎯 Procesando MVP...");
  const instrument = parseMVPFile(content);
  await db.collection("mvp_instruments").doc("mvp-general").set(instrument);
  console.log("   ✅ Documento escrito en mvp_instruments/mvp-general");
}

async function seedFODA(content: string) {
  console.log("🔍 Procesando FODA...");
  const instrument = parseFODAFile(content);
  await db.collection("foda_instruments").doc("foda-general").set(instrument);
  console.log("   ✅ Documento escrito en foda_instruments/foda-general");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 Seed de base de conocimiento — tipo: ${docType}, versión: ${version}`);
  console.log(`   Archivo: ${resolvedPath}\n`);

  const isMarkdown = resolvedPath.endsWith(".md");

  if (["mec", "mvp", "foda"].includes(docType) && !isMarkdown) {
    console.error(`El tipo '${docType}' requiere un archivo .md`);
    process.exit(1);
  }
  if (["rae", "rpf"].includes(docType) && isMarkdown) {
    console.error(`El tipo '${docType}' requiere un archivo .xlsx`);
    process.exit(1);
  }

  if (isMarkdown) {
    const content = fs.readFileSync(resolvedPath, "utf-8");
    switch (docType) {
      case "mec":
        await seedMEC(content);
        break;
      case "mvp":
        await seedMVP(content);
        break;
      case "foda":
        await seedFODA(content);
        break;
      default:
        console.error(`Tipo no reconocido: ${docType}. Usa: rae | rpf | mec | mvp | foda`);
        process.exit(1);
    }
  } else {
    const workbook = XLSX.readFile(resolvedPath);
    switch (docType) {
      case "rae":
        await seedRAE(workbook);
        break;
      case "rpf":
        await seedRPF(workbook);
        break;
      default:
        console.error(`Tipo no reconocido: ${docType}. Usa: rae | rpf | mec | mvp | foda`);
        process.exit(1);
    }
  }

  console.log("\n✅ Seed completado correctamente.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error durante el seed:", err);
  process.exit(1);
});
