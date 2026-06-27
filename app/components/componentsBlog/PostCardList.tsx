// app/components/componentsBlog/PostCardList.tsx

import Link from "next/link";
import { getCategoryColor, getCategoryLabel } from "@/lib/constants/categories";

interface PostCardListProps {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  slug: string;
  author: string;
  featureImage?: string;
  category: string;
  views: number;
}

export default function PostCardList({
  id,
  title,
  date,
  excerpt,
  slug,
  author,
  featureImage,
  category,
  views,
}: PostCardListProps) {
  const categoryColor = getCategoryColor(category);
  const categoryLabel = getCategoryLabel(category);

  return (
    <article className="flex flex-col sm:flex-row gap-4 sm:gap-6 bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-4 sm:p-6">
      {/* Imagen destacada - Responsive */}
      {featureImage && (
        <div className="w-full sm:w-48 md:w-64 shrink-0">
          <Link
            href={`/blog/${slug}`}
            className="focus-ring-primary rounded-lg block"
            aria-label={`Ver imagen de ${title}`}
          >
            <img
              src={featureImage}
              alt={`Imagen destacada: ${title}`}
              className="w-full h-40 sm:h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </Link>
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 flex flex-col">
        {/* Categoría con color */}
        <div className="mb-2">
          <span
            className="inline-block px-3 py-1 text-xs font-semibold rounded-full text-white"
            style={{ backgroundColor: categoryColor }}
            role="text"
            aria-label={`Categoría: ${categoryLabel}`}
          >
            {categoryLabel}
          </span>
        </div>

        {/* Título */}
        <h3 className="text-xl sm:text-2xl font-semibold text-bluegreen-eske-60 dark:text-[#6BA4C6] mb-2 sm:mb-3 hover:text-bluegreen-eske transition-colors duration-300">
          <Link href={`/blog/${slug}`} className="focus-ring-primary rounded">
            {title}
          </Link>
        </h3>

        {/* Excerpt - Más líneas en desktop */}
        <div
          className="text-sm sm:text-base text-gray-eske-90 dark:text-[#9AAEBE] mb-3 sm:mb-4 grow line-clamp-2 sm:line-clamp-3"
          dangerouslySetInnerHTML={{ __html: excerpt }}
        />

        {/* Metadata y botón */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mt-auto">
          {/* Fecha, autor y vistas */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-700 dark:text-[#C7D6E0]">
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-gray-eske-60 dark:text-[#6D8294]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <time className="text-gray-eske-70 dark:text-[#9AAEBE]" dateTime={date}>
                {new Date(date).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>

            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-gray-eske-60 dark:text-[#6D8294]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="text-gray-eske-70 dark:text-[#9AAEBE] font-medium">{author}</span>
            </div>

            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-gray-eske-60 dark:text-[#6D8294]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="text-gray-eske-70 dark:text-[#9AAEBE]">
                {views} vista{views !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Botón leer más */}
          <Link
            href={`/blog/${slug}`}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-bluegreen-eske text-white-eske rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-all duration-300 text-sm whitespace-nowrap focus-ring-primary"
            aria-label={`Leer el artículo completo: ${title}`}
          >
            Leer completo
            <svg
              className="w-4 h-4"
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
          </Link>
        </div>
      </div>
    </article>
  );
}
