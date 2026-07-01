// app/page.tsx
import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { BlogPost } from "@/types/post.types";
import HomeClient from "./HomeClient";
import PublicModeHandler from "./PublicModeHandler";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";

export const metadata: Metadata = {
  title: "Eskemma — Estrategia política digital para México y Latinoamérica",
  description:
    "Eskemma es el ecosistema digital que combina inteligencia artificial, datos electorales históricos y monitoreo de entorno político en tiempo real. Para candidatos, funcionarios, consultores y organizaciones ciudadanas en México y Latinoamérica.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Eskemma — Tu proyecto político, con el método que merece",
    description:
      "El ecosistema digital de estrategia política para México y Latinoamérica. Datos electorales, monitoreo en tiempo real e inteligencia artificial para tomar mejores decisiones desde el primer día.",
    url: SITE_URL,
    siteName: "Eskemma",
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/images/blog-hero.jpg`,
        width: 1200,
        height: 630,
        alt: "Eskemma — Estrategia política digital para México y Latinoamérica",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eskemma — Tu proyecto político, con el método que merece",
    description:
      "El ecosistema digital de estrategia política para México y Latinoamérica. Datos electorales, monitoreo en tiempo real e inteligencia artificial para tomar mejores decisiones desde el primer día.",
    images: [`${SITE_URL}/images/blog-hero.jpg`],
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