// app/page.tsx
import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { BlogPost } from "@/types/post.types";
import HomeClient from "./HomeClient";
import PublicModeHandler from "./PublicModeHandler";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";

export const metadata: Metadata = {
  title: "Eskemma — Plataforma de Consultoría Política con IA",
  description:
    "Herramientas avanzadas para consultores, equipos de campaña y funcionarios públicos en México: análisis PEST-L, datos electorales, metodología por fases y formación especializada.",
  openGraph: {
    title: "Eskemma — Plataforma de Consultoría Política con IA",
    description:
      "Herramientas avanzadas para consultores, equipos de campaña y funcionarios públicos en México.",
    url: SITE_URL,
    siteName: "Eskemma",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eskemma — Plataforma de Consultoría Política con IA",
    description:
      "Herramientas avanzadas para consultores y equipos de campaña en México.",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const postsSnapshot = await adminDb
      .collection("posts")
      .where("status", "==", "published")
      .orderBy("updatedAt", "desc")
      .limit(3)
      .get();

    const posts: BlogPost[] = postsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "Sin título",
        slug: data.slug || "",
        content: data.content || "",
        category: data.category || "general",
        featureImage: data.featureImage,
        updatedAt: data.updatedAt?.toDate() || new Date(),
        author: data.author,
        status: data.status,
        tags: data.tags || [],
      };
    });

    return posts;
  } catch (error) {
    console.error("Error al cargar posts del blog:", error);
    return [];
  }
}

export default async function HomePage() {
  const blogPosts = await getBlogPosts();

  return (
    <>
      <PublicModeHandler />
      <HomeClient blogPosts={blogPosts} />
    </>
  );
}