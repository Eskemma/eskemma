// lib/posts.ts

if (typeof window !== "undefined") {
  throw new Error("Este archivo solo debe ser importado en el servidor.");
}

// Importar las funciones del servidor
import { getSortedPostsData as serverGetSortedPostsData } from "./server/posts.server";
import { getPaginatedPosts as serverGetPaginatedPosts } from "./server/posts.server";
import { getPaginatedPostsByCategory as serverGetPaginatedPostsByCategory } from "./server/posts.server";
import { getFilteredPosts as serverGetFilteredPosts } from "./server/posts.server";
import { getAllPostIds as serverGetAllPostIds } from "./server/posts.server";
import { getPostData as serverGetPostData } from "./server/posts.server";
import { updatePost as serverUpdatePost } from "./server/posts.server";
import { getPopularPosts as serverGetPopularPosts } from "./server/posts.server";
import { getCategoryCounts as serverGetCategoryCounts } from "./server/posts.server";
import { getAllTags as serverGetAllTags } from "./server/posts.server";

// Importar la interfaz PostData
import { PostData } from "@/types/post.types";

// Exportar las funciones del servidor
export function getSortedPostsData() {
  return serverGetSortedPostsData();
}

export function getPaginatedPosts(page: number = 1, postsPerPage: number = 6) {
  return serverGetPaginatedPosts(page, postsPerPage);
}

export function getPaginatedPostsByCategory(
  page: number = 1,
  postsPerPage: number = 6,
  category: string | null = null
) {
  return serverGetPaginatedPostsByCategory(page, postsPerPage, category);
}

export function getFilteredPosts(
  page: number = 1,
  postsPerPage: number = 6,
  category: string | null = null,
  searchTerm: string | null = null,
  sortBy: "newest" | "oldest" | "popular" = "newest"
) {
  return serverGetFilteredPosts(
    page,
    postsPerPage,
    category,
    searchTerm,
    sortBy
  );
}

export async function getAllPostIds() {
  const posts = await serverGetAllPostIds();
  return posts.map((post) => ({
    slug: post.slug || "",
  }));
}

export async function getPostData(slug: string): Promise<PostData | null> {
  try {
    const postData = await serverGetPostData(slug);
    if (!postData) {
      console.warn(`No se encontró ningún post con el slug: ${slug}`);
      return null;
    }

    // Validar y asignar valores predeterminados si es necesario
    const validatedPostData: PostData = {
      id: postData.id || "",
      title: postData.title || "Sin título",
      content: postData.content || "",
      category: postData.category || "",
      tags: postData.tags || [],
      status: postData.status || "draft",
      featureImage: postData.featureImage || undefined,
      slug: postData.slug || "",
      author: postData.author || {
        uid: "",
        displayName: "Desconocido",
        email: "correo@desconocido.com",
      },
      likes: postData.likes || 0,
      views: postData.views || 0,
      createdAt:
        postData.createdAt instanceof Date &&
        !isNaN(postData.createdAt.getTime())
          ? postData.createdAt
          : new Date(),
      updatedAt:
        postData.updatedAt instanceof Date &&
        !isNaN(postData.updatedAt.getTime())
          ? postData.updatedAt
          : new Date(),
      metaTitle: postData.metaTitle || postData.title || "Sin título",
      metaDescription:
        postData.metaDescription || postData.content?.substring(0, 160) || "",
      keywords: postData.keywords || [],
    };

    return validatedPostData;
  } catch (error) {
    console.error("Error al obtener los datos del post:", error);
    return null;
  }
}

export function updatePost(
  slug: string,
  updatedData: { title: string; date: string; content: string }
) {
  return serverUpdatePost(slug, updatedData);
}

// ✅ AGREGAR estas funciones para sidebar en Blog
export function getPopularPosts(limit: number = 5) {
  return serverGetPopularPosts(limit);
}

export function getCategoryCounts() {
  return serverGetCategoryCounts();
}

export function getAllTags() {
  return serverGetAllTags();
}

/**
 * Obtiene posts relacionados por categoría
 */
export async function getRelatedPosts(
  currentSlug: string,
  category: string,
  limit: number = 3
) {
  const { getRelatedPosts: serverGetRelatedPosts } = await import(
    "./server/posts.server"
  );
  return serverGetRelatedPosts(currentSlug, category, limit);
}

/**
 * Obtiene el post anterior y siguiente
 */
export async function getAdjacentPosts(currentSlug: string) {
  const allPosts = await getSortedPostsData();
  const publishedPosts = allPosts.filter((post) => post.status === "published");

  const currentIndex = publishedPosts.findIndex(
    (post) => post.slug === currentSlug
  );

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: currentIndex > 0 ? publishedPosts[currentIndex - 1] : null,
    next:
      currentIndex < publishedPosts.length - 1
        ? publishedPosts[currentIndex + 1]
        : null,
  };
}

/**
 * Calcula el tiempo de lectura estimado
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200; // Promedio de palabras por minuto en español
  const words = content.trim().split(/\s+/).length;
  const readingTime = Math.ceil(words / wordsPerMinute);
  return readingTime;
}

/**
 * Extrae encabezados del contenido Markdown para tabla de contenidos.
 * Delega a lib/shared/extractHeadings.ts — misma lógica, ahora compartida
 * con otros consumidores del ecosistema (ej. MethodologyDocView, T10-Fontana)
 * en vez de vivir solo aquí. Sin cambio de comportamiento para el blog.
 */
export { extractHeadings } from "@/lib/shared/extractHeadings";
