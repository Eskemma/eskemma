// app/components/componentsCursos/listado/TagCloudCourses.tsx
import Link from "next/link";

interface TagCloudCoursesProps {
  tags: { tag: string; count: number }[];
}

export default function TagCloudCourses({ tags }: TagCloudCoursesProps) {
  if (tags.length === 0) return null;

  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-6 mb-6 border border-gray-eske-10 dark:border-white/10">
      <h3 className="text-lg font-semibold text-black-eske dark:text-[#C7D6E0] mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-bluegreen-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
        Etiquetas
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag.tag}
            href={`/cursos?search=${encodeURIComponent(tag.tag)}`}
            className="inline-block px-3 py-1 bg-gray-eske-10 dark:bg-[#21425E] hover:bg-bluegreen-eske hover:text-white-eske text-black-eske-40 dark:text-[#C7D6E0] rounded-full transition-colors text-xs font-medium"
          >
            {tag.tag}
          </Link>
        ))}
      </div>
    </div>
  );
}
