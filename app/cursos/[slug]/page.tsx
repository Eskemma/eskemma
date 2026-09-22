// app/cursos/[slug]/page.tsx
// ============================================================
// PÁGINA DINÁMICA PARA CURSOS Y TALLERES
// CORREGIDO: Ruta de importación actualizada a lib/cursos/taller/
// ============================================================

"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { TALLER_DIAGNOSTICO } from "@/lib/cursos/taller/diagnostico-electoral/config";
import { canAccessCourse, getUpgradeMessage } from "@/utils/courseAccessUtils";

// Mapa de slugs a configuraciones de cursos
const COURSE_CONFIGS: Record<string, any> = {
  "taller-diagnostico-electoral": TALLER_DIAGNOSTICO,
  // Aquí se agregarán más cursos en el futuro
};

export default function CursoPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user } = useAuth();
  
  const course = COURSE_CONFIGS[slug];
  
  if (!course) {
    return (
      <main className="min-h-screen bg-white-eske dark:bg-[#0B1620] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-eske-80 dark:text-[#EAF2F8] mb-4">
            Curso no encontrado
          </h1>
          <Link href="/cursos" className="text-bluegreen-eske hover:underline">
            ← Volver a cursos
          </Link>
        </div>
      </main>
    );
  }

  const userRole = user?.role || null;
  const hasAccess = canAccessCourse(userRole, course.requiredRole);
  
  const stats = {
    estudiantes: 156,
    modulos: course.modules.length,
    sesiones: course.modules.reduce((acc: number, m: any) => acc + m.sessions.length, 0),
    horas: Math.round(course.estimatedDuration / 60),
  };

  // Si es el taller de diagnóstico, mostrar el contenido completo
  if (slug === "taller-diagnostico-electoral") {
    return (
      <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
        {/* Hero Section — Diseño Optimizado */}
        <section className="relative bg-bluegreen-eske text-white py-12 md:py-20 px-4 overflow-hidden">
          {/* Overlay sutil para profundidad */}
          <div className="absolute inset-0 bg-black/10 z-0" aria-hidden="true" />
          
          <div className="relative z-10 w-[90%] mx-auto max-w-7xl">
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              
              {/* Columna Izquierda: Información del Curso */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-6">
                  <Link 
                    href="/cursos" 
                    className="flex items-center gap-1 text-white/70 hover:text-white transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Cursos
                  </Link>
                  <span className="text-white/30">/</span>
                  <span className="bg-blue-eske-20 text-black-eske px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">
                    TALLER PRÁCTICO
                  </span>
                </div>

                <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                  {course.hero.title}
                </h1>
                
                <p className="text-lg md:text-xl text-white/90 mb-6 font-medium">
                  {course.hero.subtitle}
                </p>
                
                <p className="text-base md:text-lg text-white/70 max-w-2xl leading-relaxed">
                  {course.hero.description}
                </p>
              </div>

              {/* Columna Derecha: Card de Acción y Stats */}
              <div className="w-full lg:w-[380px] shrink-0">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 md:p-8 shadow-xl">
                  {/* Stats en Grid Compacto */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/5">
                      <div className="text-xl font-bold text-yellow-eske">{stats.modulos}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/60">Módulos</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/5">
                      <div className="text-xl font-bold text-yellow-eske">{stats.sesiones}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/60">Sesiones</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/5">
                      <div className="text-xl font-bold text-yellow-eske">{stats.horas}h</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/60">Contenido</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/5">
                      <div className="text-xl font-bold text-yellow-eske">{stats.estudiantes}+</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/60">Alumnos</div>
                    </div>
                  </div>
                  {/* Botón de Acción Principal */}
                  <div className="space-y-4">
                    {hasAccess ? (
                      <Link
                        href="/cursos/taller-diagnostico-electoral/modulo/modulo-1-fundamentos/sesion/sesion-1-1-que-es-una-eleccion"
                        className="flex items-center justify-center w-full bg-yellow-eske hover:bg-yellow-eske-60 text-black-eske font-bold px-6 py-4 rounded-xl transition-all shadow-lg active:scale-95 text-center"
                      >
                        Comenzar taller →
                      </Link>
                    ) : (
                      <>
                        <button
                          disabled
                          className="flex items-center justify-center w-full bg-white/20 text-white/50 font-bold px-6 py-4 rounded-xl cursor-not-allowed"
                        >
                          Acceso restringido
                        </button>
                        <p className="text-xs text-center text-white/60">
                          {getUpgradeMessage(course.requiredRole)}
                          {!user && <Link href="/login" className="text-yellow-eske hover:underline ml-1">Inicia sesión</Link>}
                        </p>
                      </>
                    )}
                  </div>

                  
                  {/* Características rápidas */}
                  <div className="mt-8 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      <svg className="w-4 h-4 text-yellow-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Certificación al finalizar
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      <svg className="w-4 h-4 text-yellow-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Acceso de por vida
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Características */}
        <section className="py-16 px-4 bg-gray-eske-10 dark:bg-[#112230]">
          <div className="w-[90%] mx-auto max-w-7xl">
            <h2 className="text-3xl font-bold text-center mb-12 dark:text-[#EAF2F8]">
              ¿Qué aprenderás en este taller?
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {course.hero.features.map((feature: string, index: number) => (
                <div key={index} className="bg-white-eske dark:bg-[#18324A] p-6 rounded-lg shadow-md">
                  <div className="w-12 h-12 bg-bluegreen-eske/10 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-bluegreen-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 dark:text-[#EAF2F8]">{feature}</h3>
                  <p className="text-black-eske dark:text-[#C7D6E0] font-normal">
                    {index === 0 && "Sube tus propios datasets y trabaja con ellos durante todo el taller."}
                    {index === 1 && "Ejercicios con código real que puedes ejecutar directamente en el navegador."}
                    {index === 2 && "Conecta con APIs de Twitter, Google Civic Info y datos públicos."}
                    {index === 3 && "Obtén una certificación al completar todos los módulos y ejercicios."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Módulos del taller */}
        <section className="py-16 px-4">
          <div className="w-[90%] mx-auto max-w-7xl">
            <h2 className="text-3xl font-bold text-center mb-4 dark:text-[#EAF2F8]">
              Estructura del taller
            </h2>
            <p className="text-center text-black-eske dark:text-[#C7D6E0] font-normal mb-12 max-w-2xl mx-auto">
              6 módulos diseñados para llevarte desde los fundamentos hasta la práctica avanzada del diagnóstico electoral.
            </p>
            
            <div className="space-y-6">
              {course.modules.map((module: any, index: number) => (
                <div key={module.id} className="border border-gray-eske-30 dark:border-white/10 rounded-lg overflow-hidden">
                  <div className="bg-gray-eske-10 dark:bg-[#21425E] p-4 flex items-center justify-between">
                    <div>
                      <span className="text-sm text-black-eske dark:text-[#9AAEBE] font-normal">Módulo {index + 1}</span>
                      <h3 className="text-xl font-semibold dark:text-[#EAF2F8]">{module.title}</h3>
                      <p className="text-black-eske dark:text-[#C7D6E0] text-sm mt-1 font-normal">{module.description}</p>
                    </div>
                    <div className="text-sm text-black-eske dark:text-[#9AAEBE] font-normal">
                      {module.sessions.length} sesiones · {Math.round(module.estimatedDuration / 60)}h
                    </div>
                  </div>
                  <div className="p-4 bg-white-eske dark:bg-[#18324A]">
                    <div className="grid md:grid-cols-2 gap-2">
                      {module.sessions.map((session: any) => (
                        <div key={session.id} className="text-sm text-black-eske dark:text-[#C7D6E0] font-normal flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-bluegreen-eske rounded-full"></span>
                          {session.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="bg-bluegreen-eske text-white py-16 px-4">
          <div className="w-[90%] mx-auto max-w-7xl text-center">
            <h2 className="text-3xl font-bold mb-4">
              ¿Listo para dominar el diagnóstico electoral?
            </h2>
            <p className="text-xl text-gray-eske-20 mb-8 max-w-2xl mx-auto">
              Únete a más de 150 profesionales que ya están aprendiendo con este taller práctico.
            </p>
            
            {hasAccess ? (
              <Link
                href="/cursos/taller-diagnostico-electoral/modulo/modulo-1-fundamentos/sesion/sesion-1-1-que-es-una-eleccion"
                className="inline-block bg-yellow-eske hover:bg-yellow-eske-60 text-black-eske font-bold px-8 py-4 rounded-lg transition-colors text-lg shadow-md active:scale-95"
              >
                Comenzar ahora →
              </Link>
            ) : (
              <Link
                href="/suscripciones"
                className="inline-block bg-yellow-eske hover:bg-yellow-eske/90 text-blue-eske-90 font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
              >
                Ver planes de suscripción
              </Link>
            )}
          </div>
        </section>
      </main>
    );
  }

  // Para otros cursos (futuros)
  return (
    <main className="min-h-screen bg-white-eske">
      <div className="w-[90%] mx-auto max-w-7xl py-16">
        <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
        <p className="text-lg text-black-eske dark:text-[#C7D6E0] font-normal">{course.description}</p>
        {/* Template para otros cursos */}
      </div>
    </main>
  );
}