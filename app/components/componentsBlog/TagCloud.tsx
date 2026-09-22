// app/components/componentsBlog/TagCloud.tsx
import Link from "next/link";
import { TagItem } from "@/types/post.types";

interface TagCloudProps {
  tags: TagItem[];
  maxTags?: number;
}

export default function TagCloud({ tags, maxTags = 15 }: TagCloudProps) {
  if (tags.length === 0) return null;

  const displayTags = tags.slice(0, maxTags);
  const maxCount = Math.max(...displayTags.map((t) => t.count));
  const minCount = Math.min(...displayTags.map((t) => t.count));

  // Calcular tamaño de fuente basado en frecuencia
  const getFontSize = (count: number) => {
    const normalized = (count - minCount) / (maxCount - minCount || 1);
    return 0.75 + normalized * 0.5; // Entre 0.75rem y 1.25rem
  };

  return (
    <aside
      className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-6 mb-6"
      aria-labelledby="tagcloud-title"
    >
      <h3
        id="tagcloud-title"
        className="text-lg font-semibold text-black-eske dark:text-[#C7D6E0] mb-4 flex items-center gap-2"
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
            d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
          />
        </svg>
        Etiquetas
      </h3>
      <nav aria-label="Nube de etiquetas del blog">
        <div className="flex flex-wrap gap-2" role="list">
          {displayTags.map((tag) => (
            <Link
              key={tag.tag}
              href={`/blog?search=${encodeURIComponent(tag.tag)}`}
              className="inline-block px-3 py-1 bg-gray-eske-10 dark:bg-[#21425E] hover:bg-bluegreen-eske hover:text-white-eske text-black-eske-40 dark:text-[#C7D6E0] rounded-full transition-colors duration-200 focus-ring-primary"
              style={{
                fontSize: `${getFontSize(tag.count)}rem`,
              }}
              role="listitem"
              aria-label={`Buscar artículos con la etiqueta ${tag.tag}, ${tag.count} ${tag.count === 1 ? "artículo" : "artículos"}`}
            >
              {tag.tag}
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
}
