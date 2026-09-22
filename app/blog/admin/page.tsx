// app/blog/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/firebase/firebaseConfig";
import StatsCard from "./components/StatsCard";
import PopularPostsList from "./components/PopularPostsList";
import CategoryChart from "./components/CategoryChart";
import QuickActions from "./components/QuickActions";
import PopularTags from "./components/PopularTags";

interface DashboardStats {
  totalPosts: number;
  totalViews: number;
  totalComments: number;
  publishedPosts: number;
  draftPosts: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      const response = await fetch("/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div 
        className="flex items-center justify-center h-64"
        role="status"
        aria-live="polite"
        aria-label="Cargando estadísticas del dashboard"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bluegreen-eske mx-auto" aria-hidden="true"></div>
          <p className="mt-4 text-black-eske-20 dark:text-[#9AAEBE]">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Message */}
      <section 
        className="bg-gradient-to-r from-bluegreen-eske to-blue-eske text-white rounded-xl p-6 shadow-lg"
        aria-labelledby="welcome-title"
      >
        <h1 
          id="welcome-title"
          className="text-3xl font-bold mb-2"
        >
          ¡Bienvenido al Dashboard!
        </h1>
        <p className="text-blue-eske-10">
          Gestiona tu blog desde aquí. Revisa estadísticas, posts y comentarios.
        </p>
      </section>

      {/* Stats Cards */}
      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">Estadísticas generales del blog</h2>
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          role="list"
          aria-label="4 estadísticas principales del blog"
        >
          <div role="listitem">
            <StatsCard
              title="Total de Posts"
              value={stats?.totalPosts || 0}
              icon={
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              color="bg-blue-eske"
              subtitle={`${stats?.publishedPosts || 0} publicados, ${stats?.draftPosts || 0} borradores`}
            />
          </div>

          <div role="listitem">
            <StatsCard
              title="Vistas Totales"
              value={stats?.totalViews || 0}
              icon={
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
              color="bg-bluegreen-eske"
            />
          </div>

          <div role="listitem">
            <StatsCard
              title="Comentarios"
              value={stats?.totalComments || 0}
              icon={
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
              color="bg-green-eske"
            />
          </div>

          <div role="listitem">
            <StatsCard
              title="Promedio Vistas"
              value={stats?.totalPosts ? Math.round((stats?.totalViews || 0) / stats.totalPosts) : 0}
              icon={
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              color="bg-yellow-eske"
              subtitle="vistas por post"
            />
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="sr-only">Acciones rápidas</h2>
        <QuickActions />
      </section>

      {/* Content Grid */}
      <section aria-labelledby="content-overview-title">
        <h2 id="content-overview-title" className="sr-only">Resumen de contenido</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Popular Posts - 2 columns */}
          <div className="lg:col-span-2">
            <PopularPostsList />
          </div>

          {/* Category Chart - 1 column */}
          <div className="lg:col-span-1 space-y-6">
            <CategoryChart />
            <PopularTags />
          </div>
        </div>
      </section>
    </div>
  );
}
