// app/components/componentsCursos/listado/FeaturedCourse.tsx

import Link from "next/link";

interface FeaturedCourseProps {
  slug: string;
  title: string;
  description: string;
  tag: string;
  stats: string;
  image?: string;
}

export default function FeaturedCourse({ 
  slug, 
  title, 
  description, 
  tag, 
  stats,
  image
}: FeaturedCourseProps) {
  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-2xl p-6 md:p-8 mb-10 border border-bluegreen-eske/20 dark:border-white/10 shadow-md flex flex-col md:flex-row gap-6 items-center hover:shadow-lg transition-all">
      <div className="flex-1 text-center md:text-left">
        <span className="inline-block bg-green-eske text-white-eske px-4 py-1 rounded-full text-xs font-semibold mb-3">
          {tag}
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] mb-2">
          {title}
        </h2>
        <p className="text-black-eske dark:text-[#C7D6E0] mb-4 font-normal">
          {description}
        </p>
        <div className="text-sm font-medium text-bluegreen-eske mb-6">
          {stats}
        </div>
        <Link
          href={`/cursos/${slug}`}
          className="inline-block bg-yellow-eske hover:bg-yellow-eske-60 text-black-eske font-bold px-8 py-3 rounded-lg transition-colors focus-ring-primary shadow-sm active:scale-95"
        >
          Ver programa completo →
        </Link>
      </div>
      
      {/* Elemento visual decorativo - Ahora con imagen opcional */}
      <div className="w-full md:w-1/3 h-48 bg-white dark:bg-[#21425E] rounded-xl flex items-center justify-center overflow-hidden border border-gray-eske-10 dark:border-white/10">
        {image ? (
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <div className="text-5xl opacity-40 grayscale group-hover:grayscale-0 transition-all">
            🚀
          </div>
        )}
      </div>
    </div>
  );
}

