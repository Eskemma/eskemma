"use client";

// app/components/shared/chat/MarkdownContent.tsx
// Renderer markdown compartido para paneles de chat del ecosistema.
// Extraído del patrón de app/moddulo/components/ModduloChat.tsx (que NO
// se modifica en esta ronda — ver deuda técnica en CLAUDE.md: ModduloChat
// y AdvisorPanel quedan pendientes de migrar a estas primitivas).

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-bold text-gray-900 dark:text-[#C7D6E0] mt-3 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold text-gray-800 dark:text-[#C7D6E0] mt-3 mb-1.5 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#9AAEBE] mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-gray-800 dark:text-[#C7D6E0] leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-[#C7D6E0]">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-gray-700 dark:text-[#9AAEBE]">{children}</em>,
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 space-y-1 mb-2 text-sm text-gray-800 dark:text-[#C7D6E0]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 space-y-1 mb-2 text-sm text-gray-800 dark:text-[#C7D6E0]">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        hr: () => <hr className="border-gray-200 dark:border-white/10 my-3" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-300 dark:border-white/10 px-3 py-1.5 bg-gray-100 dark:bg-[#112230] font-semibold text-gray-700 dark:text-[#C7D6E0] text-left">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 dark:border-white/10 px-3 py-1.5 text-gray-800 dark:text-[#C7D6E0]">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-bluegreen-eske/40 pl-3 italic text-gray-600 dark:text-[#9AAEBE] my-2">{children}</blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-gray-100 dark:bg-[#112230] px-1.5 py-0.5 rounded text-xs font-mono text-gray-700 dark:text-[#C7D6E0]">{children}</code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
