"use client";

// app/components/shared/MethodologyDoc/MethodologyDocView.tsx
// Vista de lectura compartida para documentos editoriales estáticos tipo
// "Notas metodológicas" — el mismo componente sirve a cualquier app del
// ecosistema (Fontana hoy, Sefix-AI y las que sigan): cada app solo
// necesita una page.tsx de 3 líneas que lea su propio .md del repo
// (fs.readFileSync, Server Component) y le pase el string aquí. Sin
// Firestore, sin generación por IA — es contenido editorial versionado en
// git, de edición manual e infrecuente (ver justificación en el plan de
// arquitectura, Fase 4 de "Notas metodológicas de Fontana").
//
// Reutiliza 2 piezas ya existentes en el repo en vez de construir desde
// cero:
//   - Índice de navegación: app/components/legal/TableOfContents.tsx (el
//     mismo patrón sticky desktop + colapsable mobile de las páginas
//     legales) — se importa tal cual, sin moverlo de carpeta esta ronda.
//   - Extracción de headings: lib/shared/extractHeadings.ts (extraído de
//     lib/posts.ts, mismo algoritmo que ya usa el blog).
//
// Los headings h2/h3 del render con react-markdown calculan su `id` con
// el MISMO slug que extractHeadings — así el índice y las anclas reales
// del DOM siempre coinciden, sin necesidad de instalar rehype-slug.

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import TableOfContents, { type TocItem } from "@/app/components/legal/TableOfContents";
import { extractHeadings, slugifyHeading } from "@/lib/shared/extractHeadings";
import { exportToPdf } from "@/lib/shared/reportExport";

interface Props {
  markdown: string;
  /** Mostrado en el toolbar/encabezado del PDF exportado (ej. "Fontana"). */
  brandLabel: string;
  /** Usado para el nombre del archivo descargado (ej. "Notas-metodologicas-Fontana"). */
  baseName: string;
}

/** children de un heading de react-markdown → texto plano, para slugificar. */
function textoPlano(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textoPlano).join("");
  if (children && typeof children === "object" && "props" in children) {
    return textoPlano((children as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

export default function MethodologyDocView({ markdown, brandLabel, baseName }: Props) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const tocItems: TocItem[] = useMemo(
    () =>
      headings
        // Solo H2/H3 en el índice — H1 es el título del documento, no una
        // sección navegable; niveles 4+ (si aparecieran) se agrupan como
        // subsección para no romper el componente compartido (level 1|2).
        .filter((h) => h.level >= 2)
        .map((h) => ({ id: h.id, title: h.text, level: h.level === 2 ? 1 : 2 })),
    [headings]
  );

  const components: Components = {
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mt-8 mb-3 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => {
      const id = slugifyHeading(textoPlano(children));
      return (
        <h2
          id={id}
          className="text-xl font-semibold text-black-eske dark:text-[#EAF2F8] mt-8 mb-3 pb-2 border-b border-gray-eske-20 dark:border-white/10 scroll-mt-24"
        >
          {children}
        </h2>
      );
    },
    h3: ({ children }) => {
      const id = slugifyHeading(textoPlano(children));
      return (
        <h3 id={id} className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] mt-6 mb-2 scroll-mt-24">
          {children}
        </h3>
      );
    },
    p: ({ children }) => <p className="mb-3 leading-relaxed text-black-eske dark:text-[#C7D6E0]">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-black-eske dark:text-[#C7D6E0]">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-black-eske dark:text-[#C7D6E0]">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-black-eske dark:text-[#EAF2F8]">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    hr: () => <hr className="border-gray-eske-20 dark:border-white/10 my-6" />,
    table: ({ children }) => (
      <div className="overflow-x-auto mb-4">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-gray-eske-10 dark:bg-[#21425E]">{children}</thead>,
    tr: ({ children }) => <tr className="even:bg-gray-eske-10/50 dark:even:bg-white/5">{children}</tr>,
    th: ({ children }) => (
      <th className="border border-gray-eske-20 dark:border-white/10 px-3 py-2 font-semibold text-left text-black-eske dark:text-[#EAF2F8]">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-eske-20 dark:border-white/10 px-3 py-2 align-top text-black-eske dark:text-[#C7D6E0]">{children}</td>
    ),
  };

  async function handleDescargarPdf() {
    setDescargando(true);
    setError(null);
    try {
      await exportToPdf(markdown, baseName, "notas-metodologicas", "Notas metodológicas", brandLabel);
    } catch {
      setError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-end mb-4">
        <button
          type="button"
          onClick={handleDescargarPdf}
          disabled={descargando}
          className="text-xs px-3 py-1.5 rounded-lg bg-bluegreen-eske text-white hover:bg-bluegreen-eske-60 transition-colors disabled:opacity-50"
        >
          {descargando ? "Descargando…" : "Descargar PDF"}
        </button>
      </div>
      {error && <p className="text-xs text-red-eske mb-3 text-right">{error}</p>}

      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8 items-start">
        {tocItems.length > 0 && (
          <TableOfContents items={tocItems} title="Índice" className="mb-6 lg:mb-0" />
        )}
        <article className="min-w-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {markdown}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
