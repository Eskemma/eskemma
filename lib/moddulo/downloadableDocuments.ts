// lib/moddulo/downloadableDocuments.ts
// Registro centralizado de documentos descargables por fase. Define solo
// metadata (id, label, formatos) — la generación de contenido markdown vive
// en cada page.tsx de fase (lib/moddulo/reportFormatters.ts), porque las
// fuentes de datos son muy distintas entre fases (chat, XPCTO, DVS, mapaPESTEL,
// etc.) y forzar una interfaz común de "contenido" no aporta nada.
//
// PhaseDownloadMenu (app/components/moddulo/PhaseDownloadMenu.tsx) lee este
// registro según la fase activa — nunca debe agregarse lógica del tipo
// "if (phaseId === 'exploracion')" fuera de aquí. Para agregar F3-F9, basta
// con extender PHASE_DOWNLOADABLE_DOCS.

import type { PhaseId } from "@/types/moddulo.types";

/** Extensible — un documento futuro puede necesitar .xlsx, .txt, etc. */
export type DownloadFormat = "md" | "pdf" | "docx" | "txt" | "xlsx";

export interface DownloadableDocConfig {
  /** Clave estable usada para indexar el mapa de contenido que arma cada page.tsx. */
  id: string;
  label: string;
  formats: DownloadFormat[];
}

export const PHASE_DOWNLOADABLE_DOCS: Partial<Record<PhaseId, DownloadableDocConfig[]>> = {
  proposito: [
    { id: "reporte", label: "Reporte F1 - Propósito", formats: ["md", "pdf", "docx"] },
    { id: "chat", label: "Historial del chat", formats: ["md", "pdf", "docx"] },
    { id: "xpcto", label: "Formulario XPCTO", formats: ["md", "pdf", "docx"] },
  ],
  exploracion: [
    { id: "reporte", label: "Reporte F2 - Exploratorio", formats: ["md", "pdf", "docx"] },
    { id: "pestel", label: "Análisis PESTEL", formats: ["md", "pdf", "docx"] },
  ],
  // investigacion..evaluacion: se definen conforme se desarrolle cada fase.
};

export const DOWNLOAD_FORMAT_LABEL: Record<DownloadFormat, string> = {
  md: ".md",
  pdf: ".pdf",
  docx: ".docx",
  txt: ".txt",
  xlsx: ".xlsx",
};
