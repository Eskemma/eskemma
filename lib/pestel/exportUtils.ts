// lib/pestel/exportUtils.ts
// Client-side export utilities for E7 report generation.
// Converts Markdown reports to PDF (print popup) and DOCX (docx package).

import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Header,
  TabStopType,
} from "docx";

export type ReportFormat = "executive" | "technical" | "foda" | "scenarios";

const FORMAT_SLUG: Record<ReportFormat, string> = {
  executive: "ejecutivo",
  technical: "tecnico",
  foda: "foda",
  scenarios: "escenarios",
};

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

/** Normalizes a string for use in filenames (no accents, no spaces). */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

/** Returns "Nombre_Proyecto_ejecutivo_2026-03-29" */
export function buildFilename(
  projectName: string,
  format: ReportFormat,
  ext: string
): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = slugify(projectName);
  return `${slug}_${FORMAT_SLUG[format]}_${date}.${ext}`;
}

// ─────────────────────────────────────────────────────────────
// Markdown → HTML  (for PDF popup)
// ─────────────────────────────────────────────────────────────

export async function markdownToHtml(md: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkHtml as Parameters<ReturnType<typeof remark>["use"]>[0], { sanitize: false })
    .process(md);
  return String(file);
}

// ─────────────────────────────────────────────────────────────
// PDF export — opens a print popup with rendered HTML
// ─────────────────────────────────────────────────────────────

/** Inline print CSS for the popup window. */
const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    margin: 1.5cm 2cm;
    size: A4 portrait;
  }

  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    color: #111;
    background: #fff;
    line-height: 1.6;
  }

  /* Document header */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.4cm;
    border-bottom: 1.5pt solid #ddd;
    margin-bottom: 0.8cm;
  }
  .doc-header .logo {
    display: block;
    height: 32px;
    width: auto;
  }
  .doc-header .brand {
    font-family: Arial, sans-serif;
    font-size: 10pt;
    font-weight: 600;
    color: #0066cc;
  }

  /* Content typography */
  h1 { font-size: 18pt; margin: 14pt 0 8pt; line-height: 1.3; }
  h2 { font-size: 14pt; margin: 12pt 0 6pt; line-height: 1.3; border-bottom: 0.5pt solid #ddd; padding-bottom: 2pt; }
  h3 { font-size: 12pt; margin: 10pt 0 5pt; }
  h4 { font-size: 11pt; margin: 8pt 0 4pt; }

  p  { margin: 0 0 8pt; }
  ul, ol { padding-left: 1.4em; margin: 0 0 8pt; }
  li { margin-bottom: 3pt; }

  strong { font-weight: bold; }
  em     { font-style: italic; }
  code   { font-family: "Courier New", monospace; font-size: 9.5pt; background: #f5f5f5; padding: 0 2pt; }
  pre    { font-family: "Courier New", monospace; font-size: 9.5pt; background: #f5f5f5; padding: 8pt; margin: 8pt 0; white-space: pre-wrap; }
  blockquote { border-left: 3pt solid #ccc; padding-left: 10pt; margin: 8pt 0; color: #555; }

  /* Tables (for FODA and scorecard sections) */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  thead tr { background: #f0f0f0; }
  th {
    border: 0.5pt solid #bbb;
    padding: 4pt 6pt;
    font-weight: bold;
    text-align: left;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  td {
    border: 0.5pt solid #ccc;
    padding: 4pt 6pt;
    vertical-align: top;
  }
  tr:nth-child(even) td {
    background: #fafafa;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Page break helpers */
  h2 { page-break-after: avoid; }
  h3 { page-break-after: avoid; }

  /* Suppress link URLs */
  a[href]::after { content: none !important; }
`;

export async function exportToPdf(
  markdown: string,
  projectName: string,
  format: ReportFormat
): Promise<void> {
  const html = await markdownToHtml(markdown);
  const filename = buildFilename(projectName, format, "pdf");
  const formatLabel = FORMAT_SLUG[format].charAt(0).toUpperCase() + FORMAT_SLUG[format].slice(1);

  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    alert(
      "El navegador bloqueó la ventana emergente. Permite popups para este sitio y vuelve a intentarlo."
    );
    return;
  }

  // Use innerHTML to avoid the deprecated document.write API
  popup.document.documentElement.innerHTML = `
<head>
  <meta charset="utf-8" />
  <title>${filename}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="doc-header">
    <img
      class="logo"
      src="${window.location.origin}/images/esk_log_csm.svg"
      alt="eskemma"
    />
    <span class="brand">Centinela — PESTEL · ${formatLabel}</span>
  </div>
  <div class="doc-body">${html}</div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>`;
}

// ─────────────────────────────────────────────────────────────
// DOCX export — uses the `docx` npm package
// ─────────────────────────────────────────────────────────────

/** Parses inline markdown (bold, italic) into TextRun[]. */
function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Very simple tokenizer for **bold** and *italic*
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      runs.push(new TextRun(text.slice(last, match.index)));
    }
    if (match[0].startsWith("**")) {
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else {
      runs.push(new TextRun({ text: match[3], italics: true }));
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    runs.push(new TextRun(text.slice(last)));
  }
  return runs.length > 0 ? runs : [new TextRun(text)];
}

/** Determines if a line is a markdown table row. */
function isTableRow(line: string): boolean {
  return line.trimStart().startsWith("|") && line.trimEnd().endsWith("|");
}

/** Determines if a line is a table separator row (|---|---| etc). */
function isTableSeparator(line: string): boolean {
  return isTableRow(line) && /^\|[\s\-|:]+\|$/.test(line.trim());
}

/** Parses a table row string into cell text array. */
function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function buildDocxTable(rows: string[][]): Table {
  const docxRows = rows.map((cells, rowIdx) =>
    new TableRow({
      children: cells.map(
        (cellText) =>
          new TableCell({
            children: [
              new Paragraph({
                children: parseInline(cellText),
                ...(rowIdx === 0 ? { heading: HeadingLevel.HEADING_4 } : {}),
              }),
            ],
            width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
            },
          })
      ),
    })
  );

  return new Table({ rows: docxRows, width: { size: 9000, type: WidthType.DXA } });
}

/** Converts a markdown string into an array of docx block elements. */
function markdownToDocxChildren(
  md: string
): (Paragraph | Table)[] {
  const lines = md.split("\n");
  const elements: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith("# ")) {
      elements.push(
        new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 })
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 })
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 })
      );
      i++;
      continue;
    }

    // Bullet list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const text = line.slice(2);
      elements.push(
        new Paragraph({
          children: parseInline(text),
          bullet: { level: 0 },
        })
      );
      i++;
      continue;
    }

    // Numbered list (basic: "1. text")
    const numberedMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (numberedMatch) {
      elements.push(
        new Paragraph({
          children: parseInline(numberedMatch[1]),
          numbering: { reference: "default-numbering", level: 0 },
        })
      );
      i++;
      continue;
    }

    // Table — collect all consecutive table rows
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isTableSeparator(lines[i])) {
          tableLines.push(lines[i]);
        }
        i++;
      }
      if (tableLines.length > 0) {
        const rows = tableLines.map(parseTableRow);
        elements.push(buildDocxTable(rows));
        elements.push(new Paragraph("")); // spacing after table
      }
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      elements.push(new Paragraph({ text: "", border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } } }));
      i++;
      continue;
    }

    // Empty line → spacing paragraph
    if (line.trim() === "") {
      elements.push(new Paragraph(""));
      i++;
      continue;
    }

    // Default: paragraph with inline formatting
    elements.push(new Paragraph({ children: parseInline(line) }));
    i++;
  }

  return elements;
}

export async function exportToDocx(
  markdown: string,
  projectName: string,
  format: ReportFormat
): Promise<void> {
  const filename = buildFilename(projectName, format, "docx");
  const children = markdownToDocxChildren(markdown);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [
                  {
                    type: TabStopType.RIGHT,
                    position: 9000,
                  },
                ],
                children: [
                  new TextRun({ text: "eskemma", bold: true, size: 22 }),
                  new TextRun({ text: "\t" }),
                  new TextRun({
                    text: "Centinela — PESTEL",
                    color: "0066CC",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        },
        properties: {
          page: {
            margin: {
              top: 1134,   // ~2cm in twentieths of a point
              bottom: 1134,
              left: 1418,  // ~2.5cm
              right: 1134,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
