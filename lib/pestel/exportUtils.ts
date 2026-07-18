// lib/pestel/exportUtils.ts
// Client-side export utilities for E7 report generation.
// Thin PESTEL-specific wrapper around lib/shared/reportExport.ts (the
// generic markdown→PDF/DOCX mechanism, extracted so Moddulo and future
// modules can reuse the same layout/typography without duplicating it).
// Behavior and call sites in app/centinela/pestel/[projectId]/informes/page.tsx
// are unchanged.

import {
  exportToPdf as sharedExportToPdf,
  exportToDocx as sharedExportToDocx,
  buildFilename as sharedBuildFilename,
  markdownToHtml,
} from "@/lib/shared/reportExport";

export type ReportFormat = "executive" | "technical" | "foda" | "scenarios";

const FORMAT_SLUG: Record<ReportFormat, string> = {
  executive: "ejecutivo",
  technical: "tecnico",
  foda: "foda",
  scenarios: "escenarios",
};

const FORMAT_LABEL: Record<ReportFormat, string> = {
  executive: "Ejecutivo",
  technical: "Técnico",
  foda: "FODA",
  scenarios: "Escenarios",
};

const BRAND_LABEL = "Centinela — PESTEL";

/** Returns "Nombre_Proyecto_ejecutivo_2026-03-29" */
export function buildFilename(
  projectName: string,
  format: ReportFormat,
  ext: string
): string {
  return sharedBuildFilename(projectName, FORMAT_SLUG[format], ext);
}

export { markdownToHtml };

export async function exportToPdf(
  markdown: string,
  projectName: string,
  format: ReportFormat
): Promise<void> {
  return sharedExportToPdf(markdown, projectName, FORMAT_SLUG[format], FORMAT_LABEL[format], BRAND_LABEL);
}

export async function exportToDocx(
  markdown: string,
  projectName: string,
  format: ReportFormat
): Promise<void> {
  return sharedExportToDocx(markdown, projectName, FORMAT_SLUG[format], BRAND_LABEL);
}
