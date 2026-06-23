// app/blog/page.tsx
import { Suspense } from "react";
import { Metadata } from "next";
import { remark } from "remark";
import remarkHtml from "remark-html";
import {
  getFilteredPosts,
  getPopularPosts,
  getCategoryCounts,
  getAllTags,
} from "@/lib/posts";
import { PopularPostItem } from "@/types/post.types";
import FoucheHeroSection from "./FoucheHeroSection";
import Pagination from "../components/componentsBlog/Pagination";
import Sidebar from "../components/componentsBlog/Sidebar";
import BlogContent from "./BlogContent";
import { generateBlogListStructuredData } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "El Baúl de Fouché - Blog de Comunicación Política | Eskemma",
  description:
    "Artículos sobre estrategia electoral, comunicación política, análisis de datos y campañas políticas. Contenido profesional para consultores y equipos de campaña en México.",
  authors: [{ name: "Eskemma" }],
  openGraph: {
    title: "El Baúl de Fouché - Blog de Comunicación Política",
    description:
      "Artículos profesionales sobre estrategia electoral y comunicación política en México.",
    url: `${SITE_URL}/blog`,
    siteName: "El Baúl de Fouché - Eskemma",
    images: [
      {
        url: `${SITE_URL}/images/blog-hero.jpg`,
        width: 1200,
        height: 630,
        alt: "El Baúl de Fouché - Blog de Comunicación Política",
      },
    ],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "El Baúl de Fouché - Blog de Comunicación Política",
    description:
      "Artículos profesionales sobre estrategia electoral y comunicación política en México.",
    images: [`${SITE_URL}/images/blog-hero.jpg`],
    creator: "@eskemma",
  },
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
};

interface BlogPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    search?: string;
    sort?: string;
  }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  try {
    const params = await searchParams;
    const currentPage = Number(params.page) || 1;
    const selectedCategory = params.category || "todos";
    const searchTerm = params.search || "";
    const sortBy = (params.sort as "newest" | "oldest" | "popular") || "newest";
    const postsPerPage = 6;

    // Obtener posts con todos los filtros aplicados
    const {
      posts: sortedPosts,
      totalPages,
      totalPosts,
    } = await getFilteredPosts(
      currentPage,
      postsPerPage,
      selectedCategory === "todos" ? null : selectedCategory,
      searchTerm || null,
      sortBy
    );

    // Obtener datos para el sidebar
    const [popularPostsRaw, categoryCounts, allTags] = await Promise.all([
      getPopularPosts(5),
      getCategoryCounts(),
      getAllTags(),
    ]);

    // Procesar posts populares
    const popularPosts: PopularPostItem[] = popularPostsRaw.map((post) => ({
      id: post.id || "",
      title: post.title || "Sin título",
      slug: post.slug || "",
      views: post.views || 0,
      featureImage: post.featureImage || undefined,
    }));

    // Procesar posts para mostrar
    const publishedPosts = sortedPosts.map(async (post) => {
      const excerptHtml = await remark()
        .use(remarkHtml)
        .process(post.content.substring(0, 160) + "...");

      const sanitizedExcerpt = excerptHtml.toString();

      const validatedDate =
        post.updatedAt instanceof Date && !isNaN(post.updatedAt.getTime())
          ? post.updatedAt
          : new Date();

      return {
        id: post.id || "",
        title: post.title || "Sin título",
        date: validatedDate.toISOString(),
        excerpt: sanitizedExcerpt,
        slug: post.slug || "",
        author: post.author?.displayName || "Desconocido",
        featureImage: post.featureImage || undefined,
        category: post.category,
        views: post.views || 0,
      };
    });

    const resolvedPosts = await Promise.all(publishedPosts);

    const blogListStructuredData = generateBlogListStructuredData(
      sortedPosts.filter((p) => p.id !== undefined) as import("@/types/post.types").PostData[]
    );

    return (
      <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListStructuredData) }}
        />
        {/* Hero Section */}
        <FoucheHeroSection />

        {/* Sección de Posts */}
        <section
          className="bg-gray-eske-10 dark:bg-[#112230] min-h-145 py-12 px-4 sm:px-6 md:px-8"
          aria-labelledby="posts-section-title"
        >
          <div className="w-[90%] mx-auto max-w-7xl">
            <h2 id="posts-section-title" className="sr-only">
              Artículos del blog
            </h2>

            <p className="text-center text-black-eske-80 dark:text-[#C7D6E0] mb-8 text-lg">
              Explora nuestros artículos sobre estrategia, análisis electoral y
              comunicación política.
            </p>

            {/* Contador de posts */}
            <div className="mb-8 text-center" role="status" aria-live="polite">
              {totalPosts === 0 ? (
                <p className="text-gray-600 dark:text-[#9AAEBE] text-sm">
                  No se encontraron artículos con los filtros seleccionados
                </p>
              ) : (
                <p className="text-gray-600 dark:text-[#9AAEBE] text-sm">
                  Mostrando{" "}
                  <span className="font-semibold text-bluegreen-eske-40">
                    {totalPosts}
                  </span>{" "}
                  {totalPosts === 1 ? "artículo" : "artículos"}
                  {searchTerm && (
                    <span className="text-gray-700 dark:text-[#C7D6E0]">
                      {" "}
                      para{" "}
                      <span className="font-medium">
                        &quot;{searchTerm}&quot;
                      </span>
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Layout con Sidebar */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Columna principal - Posts */}
              <div className="flex-1 lg:w-2/3">
                {/* Componente cliente con ViewToggle — Suspense requerido por useSearchParams en BlogToolbar */}
                <Suspense fallback={null}>
                  <BlogContent posts={resolvedPosts} sortBy={sortBy} />
                </Suspense>

                {/* Paginación */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  categoryFilter={selectedCategory}
                  searchQuery={searchTerm}
                  sortBy={sortBy}
                />
              </div>

              {/* Sidebar - Desktop */}
              <div className="hidden lg:block lg:w-1/3">
                <Sidebar
                  popularPosts={popularPosts}
                  categoryCounts={categoryCounts}
                  tags={allTags}
                />
              </div>
            </div>

            {/* Sidebar - Móvil */}
            <div className="lg:hidden mt-12">
              <Sidebar
                popularPosts={popularPosts}
                categoryCounts={categoryCounts}
                tags={allTags}
              />
            </div>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    console.error("Error al obtener los posts:", error);
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-eske-10 dark:bg-[#112230]"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center">
          <p className="text-xl text-red-500 mb-4">
            Ocurrió un error al cargar los posts.
          </p>
          <p className="text-gray-600 dark:text-[#9AAEBE]">
            Por favor, inténtalo de nuevo más tarde.
          </p>
        </div>
      </div>
    );
  }
}
