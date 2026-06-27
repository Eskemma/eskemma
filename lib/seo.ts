// lib/seo.ts
import { PostData } from "@/types/post.types";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";
const SITE_NAME = "El Baúl de Fouché - Eskemma";
const DEFAULT_IMAGE = `${SITE_URL}/images/blog-hero.jpg`;

export interface SEOData {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  keywords?: string[];
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

/**
 * Genera metadata SEO completa para un post individual
 */
export function generatePostSEO(post: PostData): SEOData {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = post.featureImage || DEFAULT_IMAGE;
  
  // Asegurar que la descripción no esté vacía
  let description = post.metaDescription || post.content.substring(0, 160);
  if (description.length > 160) {
    description = description.substring(0, 157) + "...";
  }
  
  return {
    title: post.metaTitle || post.title,
    description,
    image,
    url,
    type: "article",
    author: post.author?.displayName || "Eskemma",
    publishedTime: post.createdAt.toISOString(),
    modifiedTime: post.updatedAt.toISOString(),
  };
}

/**
 * Genera metadata para la página principal del blog
 */
export function generateBlogSEO(): SEOData {
  return {
    title: "El Baúl de Fouché - Blog de Comunicación Política | Eskemma",
    description: "Artículos sobre estrategia electoral, comunicación política, análisis de datos y campañas políticas. Contenido profesional para consultores y equipos de campaña.",
    image: `${SITE_URL}/images/blog-hero.jpg`,
    url: `${SITE_URL}/blog`,
    type: "website",
    keywords: [
      "comunicación política",
      "estrategia electoral",
      "campañas políticas",
      "análisis electoral",
      "consultoría política",
      "marketing político",
    ],
  };
}

/**
 * Genera metadata para categorías del blog
 */
export function generateCategorySEO(
  categoryId: string,
  categoryLabel: string,
  categoryDescription?: string
): SEOData {
  return {
    title: `${categoryLabel} - El Baúl de Fouché | Eskemma`,
    description:
      categoryDescription ||
      `Artículos sobre ${categoryLabel.toLowerCase()} en comunicación política y estrategia electoral.`,
    image: `${SITE_URL}/images/categories/${categoryId}.jpg`,
    url: `${SITE_URL}/blog?category=${categoryId}`,
    type: "website",
  };
}

/**
 * Genera JSON-LD para structured data de artículos
 * Esto ayuda a Google a entender mejor el contenido y mostrarlo en Rich Results
 */
export function generateArticleStructuredData(post: PostData, seoData: SEOData) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: seoData.title,
    description: seoData.description,
    image: {
      "@type": "ImageObject",
      url: seoData.image,
      width: 1200,
      height: 630,
    },
    author: {
      "@type": "Person",
      name: seoData.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Eskemma",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/esk_log_cwm.png`,
      },
    },
    datePublished: seoData.publishedTime,
    dateModified: seoData.modifiedTime,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": seoData.url,
    },
    // ✅ Información adicional para Rich Results
    ...(post.keywords && post.keywords.length > 0 && {
      keywords: post.keywords.join(", "),
    }),
    ...(post.category && {
      articleSection: post.category,
    }),
  };
}

/**
 * Genera JSON-LD para el sitio web completo (organización)
 * Útil para la página principal y el blog
 */
export function generateOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Eskemma",
    alternateName: "El Baúl de Fouché",
    url: SITE_URL,
    logo: `${SITE_URL}/images/esk_log_cwm.png`,
    description:
      "Plataforma especializada en comunicación política, estrategia electoral y análisis de datos políticos en México.",
    sameAs: [
      "https://x.com/eskemmapol",
      "https://www.facebook.com/eskemmaPol",
      "https://linkedin.com/company/eskemma",
      "https://www.youtube.com/@eskemmaPol",
      "https://www.tiktok.com/@eskemmapol",
      "https://www.quora.com/profile/Eskemma",
    ],
  };
}

/**
 * Genera JSON-LD para BreadcrumbList (ruta de navegación)
 * Ayuda a Google a entender la jerarquía del sitio
 */
export function generateBreadcrumbStructuredData(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}

/**
 * Genera JSON-LD para BlogPosting list (lista de posts)
 * Útil para la página principal del blog
 */
export function generateBlogListStructuredData(posts: PostData[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "El Baúl de Fouché",
    description: "Blog de Comunicación Política y Estrategia Electoral",
    url: `${SITE_URL}/blog`,
    blogPost: posts.slice(0, 10).map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.metaDescription || post.content.substring(0, 160),
      image: post.featureImage || DEFAULT_IMAGE,
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.createdAt.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      author: {
        "@type": "Person",
        name: post.author?.displayName || "Eskemma",
      },
    })),
  };
}

/**
 * Genera JSON-LD FAQPage para secciones de preguntas frecuentes
 * Habilita rich results de acordeón en SERPs de Google
 */
export function generateFAQStructuredData(
  items: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * Valida que una URL de imagen sea válida
 */
export function validateImageUrl(url?: string): string {
  if (!url) return DEFAULT_IMAGE;
  
  // Verificar que la URL sea válida
  try {
    new URL(url);
    return url;
  } catch {
    // Si es una ruta relativa, convertirla a absoluta
    if (url.startsWith("/")) {
      return `${SITE_URL}${url}`;
    }
    return DEFAULT_IMAGE;
  }
}

/**
 * Sanitiza y valida el título para SEO
 */
export function sanitizeTitle(title: string, maxLength: number = 60): string {
  if (!title) return "Sin título - El Baúl de Fouché";
  
  let sanitized = title.trim();
  
  // Si excede el límite, truncar inteligentemente
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3).trim() + "...";
  }
  
  return sanitized;
}

/**
 * Sanitiza y valida la descripción para SEO
 */
export function sanitizeDescription(description: string, maxLength: number = 160): string {
  if (!description) return "Artículo de El Baúl de Fouché sobre comunicación política y estrategia electoral.";
  
  let sanitized = description.trim();
  
  // Remover markdown básico
  sanitized = sanitized
    .replace(/[#*_~`]/g, "") // Eliminar símbolos de markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convertir links a texto
    .replace(/\s+/g, " "); // Normalizar espacios
  
  // Si excede el límite, truncar inteligentemente
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3).trim() + "...";
  }
  
  return sanitized;
}

/**
 * Genera keywords automáticos desde el contenido si no existen
 */
export function generateKeywordsFromContent(
  content: string,
  existingKeywords?: string[]
): string[] {
  if (existingKeywords && existingKeywords.length > 0) {
    return existingKeywords;
  }
  
  // Palabras comunes a excluir
  const stopWords = new Set([
    "el", "la", "de", "que", "y", "a", "en", "un", "ser", "se", "no", "por",
    "con", "para", "una", "su", "al", "lo", "como", "más", "del", "pero",
    "sus", "le", "ya", "o", "fue", "este", "ha", "si", "porque", "esta",
  ]);
  
  // Extraer palabras y contar frecuencia
  const words = content
    .toLowerCase()
    .replace(/[^a-záéíóúñ\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !stopWords.has(word));
  
  const wordCount = new Map<string, number>();
  words.forEach((word) => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });
  
  // Ordenar por frecuencia y tomar las top 5-10
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}