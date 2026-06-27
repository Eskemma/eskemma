// app/components/componentsBlog/PostsLoadingGrid.tsx

import PostCardSkeleton from "./PostCardSkeleton";

interface PostsLoadingGridProps {
  count?: number;
}

export default function PostsLoadingGrid({ count = 6 }: PostsLoadingGridProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
      role="status"
      aria-busy="true"
      aria-label={`Cargando ${count} publicaciones del blog`}
    >
      {Array.from({ length: count }, (_, index) => (
        <PostCardSkeleton key={index} />
      ))}
      <span className="sr-only">
        Cargando {count} publicación{count !== 1 ? "es" : ""} del blog. Por
        favor espera...
      </span>
    </div>
  );
}
