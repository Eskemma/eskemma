// app/blog/BlogContent.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import BlogToolbar from "../components/componentsBlog/BlogToolbar";
import PostCardList from "../components/componentsBlog/PostCardList";
import { ViewMode } from "../components/componentsBlog/ViewToggle";

interface Post {
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

interface BlogContentProps {
  posts: Post[];
  sortBy: string;
}

export default function BlogContent({ posts, sortBy }: BlogContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  return (
    <>
      {/* Barra de herramientas con ViewToggle */}
      <BlogToolbar onViewChange={(view) => setViewMode(view)} />

      {/* Posts en modo Grid o Lista */}
      {posts.length === 0 ? (
        <div className="text-center py-12" role="status" aria-live="polite">
          <svg
            className="mx-auto h-24 w-24 text-gray-eske-90 dark:text-[#6D8294] mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-xl text-gray-eske-60 dark:text-[#6D8294] mb-2">
            No se encontraron resultados
          </p>
          <p className="text-black-eske-10 dark:text-[#9AAEBE] mb-4">
            Intenta ajustar los filtros o términos de búsqueda
          </p>
          <Link
            href="/blog"
            className="inline-block px-6 py-2 bg-bluegreen-eske text-white-eske rounded-lg hover:bg-bluegreen-eske-70 transition-colors duration-300 focus-ring-primary"
            aria-label="Limpiar todos los filtros y volver al blog"
          >
            Limpiar filtros
          </Link>
        </div>
      ) : (
        <>
          {/* Vista Grid (2 columnas en desktop, 1 en móvil - siempre centrado) */}
          {viewMode === "grid" && (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
              role="list"
              aria-label="Publicaciones del blog en vista de cuadrícula"
            >
              {posts.map(
                ({
                  id,
                  title,
                  date,
                  excerpt,
                  slug,
                  author,
                  featureImage,
                  views,
                  category,
                }) => (
                  <article
                    key={id}
                    className="flex flex-col items-center text-center bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-6"
                    role="listitem"
                  >
                    {featureImage && (
                      <Link
                        href={`/blog/${slug}`}
                        className="focus-ring-primary rounded-lg block w-full"
                        aria-label={`Ver imagen de ${title}`}
                      >
                        <img
                          src={featureImage}
                          alt={`Imagen destacada: ${title}`}
                          className="w-full h-48 object-cover rounded-lg mb-4"
                        />
                      </Link>
                    )}

                    <h3 className="text-xl text-bluegreen-eske-60 dark:text-[#6BA4C6] font-semibold mb-2 hover:text-bluegreen-eske transition-colors duration-300">
                      <Link
                        href={`/blog/${slug}`}
                        className="focus-ring-primary rounded"
                      >
                        {title}
                      </Link>
                    </h3>

                    <div
                      className="text-[16px] font-light text-gray-eske-90 dark:text-[#9AAEBE] mb-4 line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: excerpt }}
                    />

                    <div className="flex justify-between w-full text-sm text-black-eske-40 dark:text-[#C7D6E0] mb-4 px-2">
                      <time
                        className="text-gray-eske-60 dark:text-[#6D8294] text-sm"
                        dateTime={date}
                      >
                        {new Date(date).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                      <small className="text-gray-eske-60 dark:text-[#6D8294] font-medium">
                        {author}
                      </small>
                    </div>

                    {sortBy === "popular" && (
                      <div className="w-full text-xs text-black-eske-10 dark:text-[#9AAEBE] mb-2 flex items-center justify-center gap-1">
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
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        <span>
                          {views} {views === 1 ? "vista" : "vistas"}
                        </span>
                      </div>
                    )}

                    <Link
                      href={`/blog/${slug}`}
                      className="block text-center w-full bg-bluegreen-eske text-white-eske py-2 rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-all duration-300 text-[14px] focus-ring-primary"
                      aria-label={`Leer el artículo completo: ${title}`}
                    >
                      Leer completo →
                    </Link>
                  </article>
                )
              )}
            </div>
          )}

          {/* Vista Lista (1 columna - layout horizontal en móvil y desktop) */}
          {viewMode === "list" && (
            <div
              className="space-y-6 mb-8"
              role="list"
              aria-label="Publicaciones del blog en vista de lista"
            >
              {posts.map((post) => (
                <PostCardList key={post.id} {...post} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
