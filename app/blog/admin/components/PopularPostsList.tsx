// app/blog/admin/components/PopularPostsList.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/firebase/firebaseConfig";
import Link from "next/link";
import { getCategoryColor, getCategoryLabel } from "@/lib/constants/categories";

interface PopularPost {
  id: string;
  title: string;
  slug: string;
  views: number;
  category: string;
  featureImage?: string;
}

export default function PopularPostsList() {
  const [posts, setPosts] = useState<PopularPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPopularPosts();
  }, []);

  const loadPopularPosts = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      const response = await fetch("/api/admin/stats/popular-posts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts);
      }
    } catch (error) {
      console.error("Error al cargar posts populares:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section
        className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md border border-gray-eske-30 dark:border-white/10 p-6"
        role="status"
        aria-live="polite"
        aria-label="Cargando posts más populares"
      >
        <h3 className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4">
          Posts Más Populares
        </h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex gap-4">
              <div
                className="w-16 h-16 bg-gray-eske-20 dark:bg-white/10 rounded"
                aria-hidden="true"
              ></div>
              <div className="flex-1 space-y-2">
                <div
                  className="h-4 bg-gray-eske-20 dark:bg-white/10 rounded w-3/4"
                  aria-hidden="true"
                ></div>
                <div
                  className="h-3 bg-gray-eske-20 dark:bg-white/10 rounded w-1/2"
                  aria-hidden="true"
                ></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="bg-white-eske rounded-xl shadow-md border border-gray-eske-30 p-6"
      aria-labelledby="popular-posts-title"
    >
      <div className="flex items-center justify-between mb-6">
        <h3
          id="popular-posts-title"
          className="text-xl font-bold text-black-eske dark:text-[#EAF2F8]"
        >
          Posts Más Populares
        </h3>
        <Link
          href="/blog/admin/blog"
          className="text-sm text-bluegreen-eske hover:text-bluegreen-eske-70 font-semibold focus-ring-primary rounded"
          aria-label="Ver todos los posts del blog"
        >
          Ver todos →
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-8 text-black-eske-20 dark:text-[#9AAEBE]" role="status">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-eske-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>No hay posts publicados aún</p>
        </div>
      ) : (
        <div
          className="space-y-4"
          role="list"
          aria-label={`${posts.length} posts más populares`}
        >
          {posts.map((post, index) => {
            const categoryColor = getCategoryColor(post.category);
            const categoryLabel = getCategoryLabel(post.category);

            return (
              <article
                key={post.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-gray-eske-30 dark:border-white/10 hover:border-bluegreen-eske dark:hover:border-white/20 hover:shadow-md transition-all duration-300 group"
                role="listitem"
              >
                {/* Ranking Number */}
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                  style={{ backgroundColor: categoryColor }}
                  aria-label={`Posición ${index + 1}`}
                >
                  <span aria-hidden="true">{index + 1}</span>
                </div>

                {/* Feature Image */}
                {post.featureImage ? (
                  <img
                    src={post.featureImage}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg"
                    aria-hidden="true"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: categoryColor + "20" }}
                    aria-hidden="true"
                  >
                    <svg
                      className="w-8 h-8"
                      style={{ color: categoryColor }}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}

                {/* Post Info */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    className="font-semibold text-black-eske dark:text-[#EAF2F8] hover:text-bluegreen-eske dark:hover:text-[#6BA4C6] transition-colors line-clamp-1 focus-ring-primary rounded"
                    aria-label={`${post.title} (abre en nueva pestaña)`}
                  >
                    {post.title}
                  </Link>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className="inline-block px-2 py-1 text-xs font-semibold rounded-full text-white"
                      style={{ backgroundColor: categoryColor }}
                      aria-label={`Categoría: ${categoryLabel}`}
                    >
                      {categoryLabel}
                    </span>
                    <span
                      className="flex items-center gap-1 text-sm text-black-eske-20 dark:text-[#9AAEBE]"
                      aria-label={`${post.views.toLocaleString()} vistas`}
                    >
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
                      <span aria-hidden="true">
                        {post.views.toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Edit Button */}
                <Link
                  href={`/blog/admin/blog/edit/${post.id}`}
                  className="flex-shrink-0 p-2 text-black-eske-20 dark:text-[#9AAEBE] hover:text-bluegreen-eske dark:hover:text-[#6BA4C6] hover:bg-bluegreen-eske-10 dark:hover:bg-white/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus-ring-primary"
                  aria-label={`Editar post: ${post.title}`}
                >
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
