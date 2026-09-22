// app/blog/[slug]/PostNavigation.tsx
"use client";

import Link from "next/link";
import { getCategoryColor, getCategoryLabel } from "@/lib/constants/categories";

interface Post {
  slug: string;
  title: string;
  category: string;
  featureImage?: string | null;
}

interface PostNavigationProps {
  previous: Post | null;
  next: Post | null;
}

export default function PostNavigation({ previous, next }: PostNavigationProps) {
  if (!previous && !next) {
    return null;
  }

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
      role="list"
      aria-label="Navegación entre artículos anterior y siguiente"
    >
      {/* Post Anterior */}
      {previous ? (
        <Link
          href={`/blog/${previous.slug}`}
          className="group flex flex-col p-6 bg-white-eske dark:bg-[#18324A] border border-gray-eske-30 dark:border-white/10 rounded-lg hover:shadow-lg transition-all duration-300 focus-ring-primary"
          aria-label={`Artículo anterior: ${previous.title}`}
          role="listitem"
        >
          <div className="flex items-center gap-2 text-sm text-black-eske dark:text-[#C7D6E0] font-medium mb-3">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Anterior</span>
          </div>

          {previous.featureImage && (
            <img
              src={previous.featureImage}
              alt={`Imagen del artículo: ${previous.title}`}
              className="w-full h-32 object-cover rounded-lg mb-4"
            />
          )}

          <div className="mb-2">
            <span
              className="inline-block px-2 py-1 text-xs font-semibold rounded-full text-white"
              style={{ backgroundColor: getCategoryColor(previous.category) }}
              role="text"
              aria-label={`Categoría: ${getCategoryLabel(previous.category)}`}
            >
              {getCategoryLabel(previous.category)}
            </span>
          </div>

          <h4 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] group-hover:text-bluegreen-eske dark:group-hover:text-[#6BA4C6] transition-colors line-clamp-2">
            {previous.title}
          </h4>
        </Link>
      ) : (
        <div className="hidden md:block" aria-hidden="true"></div>
      )}

      {/* Post Siguiente */}
      {next && (
        <Link
          href={`/blog/${next.slug}`}
          className="group flex flex-col p-6 bg-white-eske dark:bg-[#18324A] border border-gray-eske-30 dark:border-white/10 rounded-lg hover:shadow-lg transition-all duration-300 focus-ring-primary"
          aria-label={`Artículo siguiente: ${next.title}`}
          role="listitem"
        >
          <div className="flex items-center justify-end gap-2 text-sm text-black-eske dark:text-[#C7D6E0] font-medium mb-3">
            <span>Siguiente</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>

          {next.featureImage && (
            <img
              src={next.featureImage}
              alt={`Imagen del artículo: ${next.title}`}
              className="w-full h-32 object-cover rounded-lg mb-4"
            />
          )}

          <div className="mb-2 flex justify-end">
            <span
              className="inline-block px-2 py-1 text-xs font-semibold rounded-full text-white"
              style={{ backgroundColor: getCategoryColor(next.category) }}
              role="text"
              aria-label={`Categoría: ${getCategoryLabel(next.category)}`}
            >
              {getCategoryLabel(next.category)}
            </span>
          </div>

          <h4 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] group-hover:text-bluegreen-eske dark:group-hover:text-[#6BA4C6] transition-colors line-clamp-2 text-right">
            {next.title}
          </h4>
        </Link>
      )}
    </div>
  );
}