// app/components/centinela/pestel/informes/ReportViewer.tsx
// Displays streaming or static report Markdown content.
// - While streaming: raw text with animated cursor.
// - After streaming: rendered markdown (react-markdown + remark-gfm).
// - Edit mode: textarea for free editing before export.

"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const MD_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mt-5 mb-2 leading-snug">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] mt-5 mb-2
      border-b border-gray-eske-20 dark:border-white/10 pb-1 leading-snug">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] mt-4 mb-1.5 leading-snug">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-medium text-black-eske dark:text-[#EAF2F8] mt-3 mb-1 leading-snug">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-bold text-black-eske dark:text-[#EAF2F8]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-bluegreen-eske/30 pl-3 my-2
      italic text-black-eske dark:text-[#9AAEBE]">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-gray-eske-10 dark:bg-[#21425E] px-1 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-eske-10 dark:bg-[#21425E] rounded-lg p-3 mb-3 overflow-x-auto text-xs font-mono">
      {children}
    </pre>
  ),
  hr: () => (
    <hr className="border-gray-eske-20 dark:border-white/10 my-4" />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-eske-10 dark:bg-[#21425E]">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-gray-eske-10/50 dark:even:bg-white/5">{children}</tr>,
  th: ({ children }) => (
    <th className="border border-gray-eske-20 dark:border-white/10 px-2 py-1.5
      font-semibold text-left text-black-eske dark:text-[#EAF2F8]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-eske-20 dark:border-white/10 px-2 py-1.5 align-top">
      {children}
    </td>
  ),
};

interface Props {
  content: string;
  streaming: boolean;
  onContentChange: (text: string) => void;
}

export default function ReportViewer({
  content,
  streaming,
  onContentChange,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editMode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editMode]);

  useEffect(() => {
    if (streaming) setEditMode(false);
  }, [streaming]);

  if (streaming) {
    return (
      <div
        className="min-h-[300px] w-full rounded-lg border border-gray-eske-20 dark:border-white/10
          bg-white-eske dark:bg-[#112230] p-5 text-sm text-black-eske dark:text-[#C7D6E0]
          leading-relaxed whitespace-pre-wrap font-sans"
        aria-live="polite"
        aria-label="Generando informe…"
      >
        {content}
        <span
          className="inline-block w-2 h-4 bg-bluegreen-eske animate-pulse rounded-sm ml-0.5 align-text-bottom"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {content && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-eske-20
              dark:border-white/10 text-black-eske dark:text-[#C7D6E0]
              hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
          >
            {editMode ? "Vista previa" : "Editar texto"}
          </button>
        </div>
      )}

      {editMode ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          className="min-h-[400px] w-full rounded-lg border border-gray-eske-20 dark:border-white/10
            bg-white-eske dark:bg-[#112230] p-5 text-sm text-black-eske dark:text-[#C7D6E0]
            leading-relaxed font-mono outline-none resize-y
            focus-visible:ring-2 focus-visible:ring-bluegreen-eske/30"
          aria-label="Editar informe"
        />
      ) : (
        <div
          className="min-h-[300px] w-full rounded-lg border border-gray-eske-20 dark:border-white/10
            bg-white-eske dark:bg-[#112230] p-5 text-sm text-black-eske dark:text-[#C7D6E0]"
          aria-label="Vista previa del informe"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
            {content}
          </ReactMarkdown>
        </div>
      )}

      {content && !editMode && (
        <p className="text-xs text-gray-eske-50 dark:text-[#6D8294]">
          Haz clic en "Editar texto" para modificar antes de exportar.
        </p>
      )}
    </div>
  );
}
