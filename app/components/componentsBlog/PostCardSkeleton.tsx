// app/components/componentsBlog/PostCardSkeleton.tsx

export default function PostCardSkeleton() {
  return (
    <div
      className="flex flex-col items-center text-center bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md p-6 animate-pulse"
      role="status"
      aria-busy="true"
      aria-label="Cargando publicación"
    >
      {/* Skeleton de imagen */}
      <div
        className="w-full h-48 bg-gray-eske-20 dark:bg-[#21425E] rounded-lg mb-4"
        aria-hidden="true"
      ></div>

      {/* Skeleton de título */}
      <div className="w-full mb-2" aria-hidden="true">
        <div className="h-6 bg-gray-eske-20 dark:bg-[#21425E] rounded w-3/4 mx-auto mb-2"></div>
        <div className="h-6 bg-gray-eske-20 dark:bg-[#21425E] rounded w-1/2 mx-auto"></div>
      </div>

      {/* Skeleton de excerpt */}
      <div className="w-full mb-4 space-y-2" aria-hidden="true">
        <div className="h-4 bg-gray-eske-10 dark:bg-[#112230] rounded w-full"></div>
        <div className="h-4 bg-gray-eske-10 dark:bg-[#112230] rounded w-5/6 mx-auto"></div>
        <div className="h-4 bg-gray-eske-10 dark:bg-[#112230] rounded w-4/6 mx-auto"></div>
      </div>

      {/* Skeleton de metadata (fecha y autor) */}
      <div className="flex justify-between w-full mb-4 px-2" aria-hidden="true">
        <div className="h-4 bg-gray-eske-20 dark:bg-[#21425E] rounded w-24"></div>
        <div className="h-4 bg-gray-eske-20 dark:bg-[#21425E] rounded w-20"></div>
      </div>

      {/* Skeleton de botón */}
      <div
        className="w-full h-10 bg-gray-eske-20 dark:bg-[#21425E] rounded-lg"
        aria-hidden="true"
      ></div>

      {/* Texto para screen readers */}
      <span className="sr-only">Cargando publicación del blog...</span>
    </div>
  );
}
