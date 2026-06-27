// app/cursos/page.tsx
// ============================================================
// PÁGINA PRINCIPAL DE CURSOS (HUB)
// Rediseñada siguiendo el patrón de app/blog/page.tsx
// ============================================================

import { Metadata } from "next";
import Link from "next/link";
import { 
  getCourses, 
  getCategories, 
  getAllTags, 
  getPopularCourses 
} from "@/lib/cursos/shared/courses";
import { getServerSession } from "@/lib/server/session.server";
import PaginationCursos from "../components/componentsCursos/listado/PaginationCursos";
import SidebarCursos from "../components/componentsCursos/listado/SidebarCursos";
import CourseContent from "../components/componentsCursos/listado/CourseContent";
import CoursesHeroSection from "../components/componentsCursos/listado/CoursesHeroSection";
import FeaturedCourse from "../components/componentsCursos/listado/FeaturedCourse";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Cursos y Talleres | Eskemma",
  description: "Formación práctica para profesionales de la comunicación política y el análisis electoral.",
  openGraph: {
    title: "Cursos y Talleres | Eskemma",
    description: "Formación práctica para profesionales de la comunicación política y el análisis electoral.",
    url: `${SITE_URL}/cursos`,
    siteName: "Eskemma",
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/images/blog-hero.jpg`,
        width: 1200,
        height: 630,
        alt: "Cursos y Talleres de Comunicación Política — Eskemma",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cursos y Talleres | Eskemma",
    description: "Formación práctica para profesionales de la comunicación política y el análisis electoral.",
    images: [`${SITE_URL}/images/blog-hero.jpg`],
  },
};

interface CursosPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    difficulty?: string;
    search?: string;
    sort?: string;
  }>;
}

export default async function CursosPage({ searchParams }: CursosPageProps) {
  try {
    const params = await searchParams;
    const currentPage = Number(params.page) || 1;
    const selectedCategory = params.category || "todos";
    const selectedDifficulty = params.difficulty || "todos";
    const searchTerm = params.search || "";
    const sortBy = params.sort || "newest";
    const coursesPerPage = 6;

    // 1. Obtener la sesión del usuario (Server Side)
    const session = await getServerSession();
    const userRole = session?.role ?? null;

    // 2. Obtener datos filtrados
    const {
      courses,
      totalPages,
      totalCourses,
    } = await getCourses({
      page: currentPage,
      limit: coursesPerPage,
      category: selectedCategory === "todos" ? undefined : selectedCategory,
      difficulty: selectedDifficulty === "todos" ? undefined : selectedDifficulty,
      search: searchTerm || undefined,
    });

    // 3. Obtener datos para el Sidebar
    const [popularCourses, categories, allTags] = await Promise.all([
      getPopularCourses(5),
      getCategories(),
      getAllTags(),
    ]);

    return (
      <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
        {/* Hero Section — Unificado con Moddulo/Centinela */}
        <CoursesHeroSection />

        {/* Sección de Contenido con Sidebar — Unificado con Blog */}
        <section className="bg-gray-eske-10 dark:bg-[#112230] py-12 px-4 sm:px-6 md:px-8 min-h-screen">
          <div className="w-[90%] mx-auto max-w-7xl">
            
            {/* Layout Principal: 2 columnas */}
            <div className="flex flex-col lg:flex-row gap-8">
              
              {/* Columna Principal: Listado */}
              <div className="flex-1 lg:w-2/3">
                
                {/* Curso Destacado — Anteriormente en el Hero */}
                <FeaturedCourse 
                  slug="taller-diagnostico-electoral"
                  tag="NUEVO TALLER"
                  title="Taller de Diagnóstico Electoral"
                  description="Aprende estrategias y procesos para analizar una elección con datos reales."
                  stats="6 módulos · 20 horas · 100% práctico"
                  image="/images/cursos/diagnostico_electoral.png"
                />

                {/* Resumen de resultados */}
                <div className="mb-8 text-center sm:text-left flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <p className="text-gray-600 dark:text-[#9AAEBE] text-sm">
                      Explora <span className="font-semibold text-bluegreen-eske">{totalCourses}</span> cursos disponibles
                    </p>
                  </div>
                  {searchTerm && (
                    <div className="text-sm bg-bluegreen-eske/10 px-4 py-2 rounded-lg border border-bluegreen-eske/20">
                      Resultados para: <span className="font-bold text-bluegreen-eske">&quot;{searchTerm}&quot;</span>
                    </div>
                  )}
                </div>

                <CourseContent 
                  courses={courses} 
                  userRole={userRole} 
                  categories={categories}
                />

                {/* Paginación */}
                <PaginationCursos
                  currentPage={currentPage}
                  totalPages={totalPages}
                  categoryFilter={selectedCategory}
                  difficultyFilter={selectedDifficulty}
                  searchQuery={searchTerm}
                  sortBy={sortBy}
                />
              </div>

              {/* Columna Lateral: Sidebar */}
              <div className="lg:w-1/3">
                <SidebarCursos
                  popularCourses={popularCourses}
                  categories={categories}
                  tags={allTags}
                />
              </div>

            </div>
          </div>
        </section>
      </main>
    );

  } catch (error) {
    console.error("Error en CursosPage:", error);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">¡Ups! Algo salió mal</h2>
          <p className="text-gray-600 dark:text-[#9AAEBE]">No pudimos cargar los cursos en este momento.</p>
          <a
            href="/cursos"
            className="mt-4 inline-block px-6 py-2 bg-bluegreen-eske text-white rounded-lg"
          >
            Reintentar
          </a>
        </div>
      </div>
    );
  }
}