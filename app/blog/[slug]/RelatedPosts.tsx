// app/blog/[slug]/RelatedPosts.tsx
import Link from "next/link";
import { getCategoryColor, getCategoryLabel } from "@/lib/constants/categories";
import type { RelatedPost } from "@/lib/server/posts.server";

interface RelatedPostsProps {
  posts: RelatedPost[];
  currentCategory: string;
}

export default function RelatedPosts({
  posts,
  currentCategory,
}: RelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  const categoryColor = getCategoryColor(currentCategory);
  const categoryLabel = getCategoryLabel(currentCategory);

  return (
    <section 
      className="mt-16 pt-8 border-t border-gray-eske-30"
      aria-labelledby="related-posts-heading"
    >
      <div className="mb-8">
        <h2 
          id="related-posts-heading"
          className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-2"
        >
          Posts relacionados
        </h2>
        <p className="text-sm text-black-eske-20 dark:text-[#9AAEBE]">
          Más sobre{" "}
          <span
            className="inline-block px-2 py-1 text-xs font-semibold rounded-full text-white"
            style={{ backgroundColor: categoryColor }}
            role="text"
            aria-label={`Categoría: ${categoryLabel}`}
          >
            {categoryLabel}
          </span>
        </p>
      </div>

      <div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        role="list"
        aria-label={`${posts.length} artículo${posts.length !== 1 ? 's' : ''} relacionado${posts.length !== 1 ? 's' : ''}`}
      >
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex flex-col bg-white-eske dark:bg-[#18324A] border border-gray-eske-30 dark:border-white/10 rounded-lg hover:shadow-lg transition-all duration-300 overflow-hidden focus-ring-primary"
            aria-label={`Leer artículo: ${post.title}`}
            role="listitem"
          >
            {/* Imagen */}
            {post.featureImage ? (
              <img
                src={post.featureImage}
                alt={`Imagen del artículo: ${post.title}`}
                className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div
                className="w-full h-40 flex items-center justify-center"
                style={{ backgroundColor: categoryColor + "20" }}
                aria-hidden="true"
              >
                <svg
                  className="w-16 h-16 opacity-30"
                  style={{ color: categoryColor }}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}

            {/* Contenido */}
            <div className="p-4 flex-1 flex flex-col">
              {/* Badge de categoría */}
              <div className="mb-3">
                <span
                  className="inline-block px-2 py-1 text-xs font-semibold rounded-full text-white"
                  style={{ backgroundColor: categoryColor }}
                  role="text"
                  aria-label={`Categoría: ${categoryLabel}`}
                >
                  {categoryLabel}
                </span>
              </div>

              {/* Título */}
              <h3 className="text-base font-semibold text-black-eske dark:text-[#C7D6E0] group-hover:text-bluegreen-eske dark:group-hover:text-[#6BA4C6] transition-colors line-clamp-2 mb-2">
                {post.title}
              </h3>

              {/* Fecha */}
              <time 
                className="text-xs text-black-eske-20 dark:text-[#6D8294] mt-auto"
                dateTime={post.updatedAt.toISOString()}
              >
                {post.updatedAt.toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}