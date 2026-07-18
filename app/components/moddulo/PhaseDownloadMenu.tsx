"use client";

// app/components/moddulo/PhaseDownloadMenu.tsx
// Menú de descarga compartido entre fases de Moddulo. Lee la configuración
// de lib/moddulo/downloadableDocuments.ts según la fase activa — no debe
// agregarse aquí ningún "if (phaseId === ...)"; para agregar/cambiar
// documentos por fase, editar el registro, no este componente.
//
// Cada page.tsx de fase arma su propio `content` (docId → markdown ya
// construido, o null si los datos fuente no están listos) y lo pasa aquí.

import { useState, useRef, useEffect } from "react";
import type { PhaseId } from "@/types/moddulo.types";
import {
  PHASE_DOWNLOADABLE_DOCS,
  DOWNLOAD_FORMAT_LABEL,
  type DownloadFormat,
} from "@/lib/moddulo/downloadableDocuments";
import { exportToPdf, exportToDocx, buildFilename } from "@/lib/shared/reportExport";

const BRAND_LABEL = "Eskemma — Moddulo";

export interface PhaseDownloadMenuProps {
  phaseId: PhaseId;
  projectName: string;
  /** docId → markdown ya construido, o null si los datos fuente no están listos todavía. */
  content: Record<string, string | null>;
}

export default function PhaseDownloadMenu({ phaseId, projectName, content }: PhaseDownloadMenuProps) {
  const docs = PHASE_DOWNLOADABLE_DOCS[phaseId];
  const [open, setOpen] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setExpandedDoc(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!docs || docs.length === 0) return null;

  function handleDownload(markdown: string, docLabel: string, format: DownloadFormat) {
    if (format === "md" || format === "txt") {
      const blob = new Blob([markdown], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename(projectName, docLabel, format);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      void exportToPdf(markdown, projectName, docLabel, docLabel, BRAND_LABEL);
    } else if (format === "docx") {
      void exportToDocx(markdown, projectName, docLabel, BRAND_LABEL);
    } else {
      console.warn(`[PhaseDownloadMenu] formato "${format}" aún no tiene generador implementado.`);
      return;
    }
    setOpen(false);
    setExpandedDoc(null);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Descargar archivos de esta fase"
        className="p-1.5 rounded-lg border border-gray-eske-20 dark:border-white/10 text-black-eske-10 dark:text-[#C7D6E0] hover:border-bluegreen-eske hover:text-bluegreen-eske dark:hover:border-bluegreen-eske-40 dark:hover:text-[#6BA4C6] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-xl shadow-lg z-20 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/50 dark:bg-[#112230]">
            <p className="text-xs font-bold text-black-eske dark:text-[#9AAEBE] uppercase tracking-widest">Descargar</p>
          </div>
          {docs.map((doc) => {
            const markdown = content[doc.id];
            const available = markdown != null;
            const isExpanded = expandedDoc === doc.id;
            return (
              <div key={doc.id} className="border-b border-gray-eske-10 dark:border-white/5 last:border-b-0">
                <button
                  type="button"
                  onClick={() => available && setExpandedDoc(isExpanded ? null : doc.id)}
                  disabled={!available}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                    available
                      ? "text-bluegreen-eske hover:bg-gray-eske-10 dark:hover:bg-white/5 cursor-pointer"
                      : "text-gray-eske-40 dark:text-[#6D8294] cursor-not-allowed"
                  }`}
                >
                  <span className="truncate">{doc.label}</span>
                  {available && (
                    <span className="text-xs shrink-0" aria-hidden="true">{isExpanded ? "▲" : "▼"}</span>
                  )}
                </button>
                {isExpanded && available && (
                  <div className="flex gap-1.5 px-3 pb-2.5 flex-wrap">
                    {doc.formats.map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleDownload(markdown, doc.label, fmt)}
                        className="text-xs px-2.5 py-1 rounded-md border border-bluegreen-eske/40 text-bluegreen-eske hover:bg-bluegreen-eske/10 transition-colors"
                      >
                        {DOWNLOAD_FORMAT_LABEL[fmt]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
