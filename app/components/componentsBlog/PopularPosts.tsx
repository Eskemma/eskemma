// app/components/componentsBlog/PopularPosts.tsx
import Link from "next/link";
import { PopularPostItem } from "@/types/post.types";

interface PopularPostsProps {
  posts: PopularPostItem[];
}

export default function PopularPosts({ posts }: PopularPostsProps) {
  if (posts.length === 0) return null;

  return (
    <aside 
      className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-6 mb-6"
      aria-labelledby="popular-posts-title"
    >
      <h3 
        id="popular-posts-title"
        className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-4 flex items-center gap-2"
      >
        <svg
          className="w-5 h-5 text-bluegreen-eske"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
        Más Populares
      </h3>
      <nav aria-label="Publicaciones más populares">
        <ul className="space-y-4" role="list">
          {posts.map((post, index) => (
            <li key={post.id}>
              <Link
                href={`/blog/${post.slug}`}
                className="flex gap-3 group hover:bg-white-eske-40 dark:hover:bg-white/5 p-2 rounded-lg transition-colors focus-ring-primary"
                aria-label={`Publicación número ${index + 1}: ${post.title}, ${post.views} vistas`}
              >
                {/* Número */}
                <div 
                  className="flex-shrink-0 w-8 h-8 bg-bluegreen-eske text-white-eske rounded-full flex items-center justify-center font-bold text-sm"
                  aria-hidden="true"
                >
                  {index + 1}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] group-hover:text-bluegreen-eske dark:group-hover:text-[#6BA4C6] transition-colors line-clamp-2">
                    {post.title}
                  </h4>
                  <p className="text-xs text-black-eske-10 dark:text-[#6D8294] mt-1 flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
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
                    <span>{post.views} vista{post.views !== 1 ? 's' : ''}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}