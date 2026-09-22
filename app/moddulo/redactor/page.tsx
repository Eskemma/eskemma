// app/moddulo/redactor/page.tsx - VERSIÓN SIMPLIFICADA UNIVERSAL
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RedactorForm from "./components/RedactorForm";
import PostPreview from "./components/PostPreview";
import FreemiumBanner from "./components/FreemiumBanner";
import ConfigWizard from "./components/ConfigWizard";
import ProjectSelector from "./components/ProjectSelector";
import ProjectDropdown from "./components/ProjectDropdown";
import type { 
  RedactorInput, 
  RedactorOutput, 
  RedactorUsage,
  RedactorProject,
  ProjectConfiguration,
} from "@/types/redactor.types";
import { getPlanLimits, isFreemiumUser, MESSAGES } from "@/lib/redactor/constants";

export default function RedactorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Estado de proyectos
  const [currentProject, setCurrentProject] = useState<RedactorProject | null>(null);
  const [allProjects, setAllProjects] = useState<RedactorProject[]>([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Estado UI
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentOutput, setCurrentOutput] = useState<RedactorOutput | null>(null);
  const [selectedVarianteId, setSelectedVarianteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState<RedactorUsage | null>(null);
  
  // Estado de configuración y wizard
  const [showConfigWizard, setShowConfigWizard] = useState(false);

  // Calcular límites según plan
  const userPlan = user?.subscriptionPlan || null;
  const limits = getPlanLimits(userPlan);
  const isFreemium = isFreemiumUser(userPlan);
  const isLimitReached = isFreemium && usageInfo && usageInfo.totalGenerations >= 2;

  /**
   * INICIALIZACIÓN AL MONTAR
   */
  useEffect(() => {
    if (loading) return;
    
    if (user) {
      // Usuario autenticado
      loadUserProjects();
    } else {
      // Usuario NO autenticado (visitante freemium)
      loadFreemiumState();
    }
  }, [user, loading]);

  /**
   * Cargar uso del usuario
   */
  useEffect(() => {
    if (user && isFreemium) {
      loadUsageInfo();
    } else if (!user) {
      loadVisitorUsageInfo();
    }
  }, [user, isFreemium]);

  /**
   * ============================================
   * CARGAR PROYECTOS (USUARIOS AUTENTICADOS)
   * ============================================
   */
  const loadUserProjects = async () => {
    setIsLoadingProjects(true);
    
    try {
      const projectsModule = await import("@/lib/redactor/projects");
      const userProjects = await projectsModule.getUserProjects(user!.uid);
      
      setAllProjects(userProjects);

      if (userProjects.length === 0) {
        // NO tiene proyectos: Mostrar ProjectSelector
        setShowProjectSelector(true);
      } else {
        // Tiene proyectos: Buscar el activo
        const activeProject = userProjects.find(p => p.isActive);
        
        if (activeProject) {
          setCurrentProject(activeProject);
          
          if (!activeProject.configuration) {
            setShowConfigWizard(true);
          }
        } else {
          setShowProjectSelector(true);
        }
      }
    } catch (error: any) {
      console.error("Error al cargar proyectos:", error);
      
      // Si es error de índice, mostrar selector
      if (error.message?.includes("index") || error.message?.includes("query")) {
        setShowProjectSelector(true);
      } else {
        setError("No se pudieron cargar tus proyectos. Intenta recargar la página.");
      }
    } finally {
      setIsLoadingProjects(false);
    }
  };

  /**
   * ============================================
   * CARGAR ESTADO FREEMIUM (VISITANTES)
   * ============================================
   * Para visitantes, tratamos igual que freemium autenticado:
   * SI no tiene proyectos → Mostrar ProjectSelector
   */
  const loadFreemiumState = () => {
    setIsLoadingProjects(true);
    
    try {
      // Intentar cargar proyectos de localStorage
      const storedProjects = localStorage.getItem("redactor_visitor_projects");
      
      if (storedProjects) {
        const projects: RedactorProject[] = JSON.parse(storedProjects);
        setAllProjects(projects);
        
        const activeProject = projects.find(p => p.isActive);
        
        if (activeProject) {
          setCurrentProject(activeProject);
          
          if (!activeProject.configuration) {
            setShowConfigWizard(true);
          }
        } else {
          // ✅ Igual que usuario autenticado sin proyectos
          setShowProjectSelector(true);
        }
      } else {
        // ✅ Primera vez: Mostrar ProjectSelector (igual que freemium autenticado)
        setShowProjectSelector(true);
      }
    } catch (error) {
      console.error("Error al cargar estado freemium:", error);
      setShowProjectSelector(true);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleProjectSelected = async (project: RedactorProject) => {
    setCurrentProject(project);
    setShowProjectSelector(false);
    
    // Si es visitante, guardar en localStorage
    if (!user) {
      const projects = [project];
      localStorage.setItem("redactor_visitor_projects", JSON.stringify(projects));
      setAllProjects(projects);
    }
    
    if (!project.configuration) {
      setShowConfigWizard(true);
    }
  };

  const handleProjectChange = async (project: RedactorProject) => {
    try {
      if (user) {
        const projectsModule = await import("@/lib/redactor/projects");
        await projectsModule.setActiveProject(user.uid, project.id);
      } else {
        const updatedProjects = allProjects.map(p => ({
          ...p,
          isActive: p.id === project.id,
        }));
        setAllProjects(updatedProjects);
        localStorage.setItem("redactor_visitor_projects", JSON.stringify(updatedProjects));
      }
      
      setCurrentProject(project);
      
    } catch (error) {
      console.error("Error al cambiar proyecto:", error);
      setError("No se pudo cambiar de proyecto. Intenta de nuevo.");
    }
  };

  const handleOpenProjectSelector = () => {
    setShowProjectSelector(true);
  };

  const handleConfigComplete = async (config: Partial<ProjectConfiguration>) => {
    try {
      if (!currentProject) {
        setError("Error: No hay proyecto seleccionado");
        return;
      }

      const fullConfig: ProjectConfiguration = {
        id: currentProject.id,
        userId: currentProject.userId,
        context: config.context!,
        country: config.country!,
        createdAt: new Date(),
        updatedAt: new Date(),
        electoral: config.electoral,
        governmental: config.governmental,
        guidelines: config.guidelines,
      };

      if (user) {
        const projectsModule = await import("@/lib/redactor/projects");
        await projectsModule.updateProjectConfiguration(currentProject.id, fullConfig);
        
        setCurrentProject({
          ...currentProject,
          configuration: fullConfig,
        });
      } else {
        const updatedProject = {
          ...currentProject,
          configuration: fullConfig,
        };
        
        setCurrentProject(updatedProject);
        
        const updatedProjects = allProjects.map(p =>
          p.id === currentProject.id ? updatedProject : p
        );
        setAllProjects(updatedProjects);
        localStorage.setItem("redactor_visitor_projects", JSON.stringify(updatedProjects));
      }

      setShowConfigWizard(false);
      
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      setError("Error al guardar configuración. Intenta de nuevo.");
    }
  };

  const handleEditConfig = () => {
    setShowConfigWizard(true);
  };

  const loadUsageInfo = async () => {
    if (!user) return;

    try {
      setUsageInfo({
        userId: user.uid,
        totalGenerations: 0,
        lastGeneration: new Date(),
        isFreemium: true,
      });
    } catch (error) {
      console.error("Error al cargar uso:", error);
    }
  };

  const loadVisitorUsageInfo = () => {
    try {
      const stored = localStorage.getItem("redactor_visitor_usage");
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setUsageInfo({
          userId: "visitor",
          totalGenerations: parsed.totalGenerations || 0,
          lastGeneration: new Date(parsed.lastGeneration),
          isFreemium: true,
        });
      } else {
        setUsageInfo({
          userId: "visitor",
          totalGenerations: 0,
          lastGeneration: new Date(),
          isFreemium: true,
        });
      }
    } catch (error) {
      console.error("Error al cargar uso de visitante:", error);
      setUsageInfo({
        userId: "visitor",
        totalGenerations: 0,
        lastGeneration: new Date(),
        isFreemium: true,
      });
    }
  };

  const handleGenerate = async (input: RedactorInput) => {
    if (isLimitReached) {
      setError(MESSAGES.FREEMIUM_LIMIT_REACHED);
      return;
    }

    if (!currentProject || !currentProject.configuration) {
      setError("Por favor, completa la configuración del proyecto primero.");
      setShowConfigWizard(true);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/moddulo/redactor/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          context: currentProject.configuration.context,
          country: currentProject.configuration.country,
          config: currentProject.configuration,
          projectId: currentProject.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al generar posts");
      }

      const data = await response.json();
      const mockOutput: RedactorOutput = data.output;

      setCurrentOutput(mockOutput);
      setSelectedVarianteId(mockOutput.variantes[0].id);

      if (user && currentProject.id.startsWith("visitor_") === false) {
        const projectsModule = await import("@/lib/redactor/projects");
        await projectsModule.incrementProjectGenerations(currentProject.id);
      }

      if (isFreemium) {
        if (user && usageInfo) {
          setUsageInfo({
            ...usageInfo,
            totalGenerations: usageInfo.totalGenerations + 1,
            lastGeneration: new Date(),
          });
        } else if (!user && usageInfo) {
          const newUsage = {
            ...usageInfo,
            totalGenerations: usageInfo.totalGenerations + 1,
            lastGeneration: new Date(),
          };
          
          setUsageInfo(newUsage);
          
          localStorage.setItem("redactor_visitor_usage", JSON.stringify({
            totalGenerations: newUsage.totalGenerations,
            lastGeneration: newUsage.lastGeneration.toISOString(),
          }));
        }
      }
    } catch (error: any) {
      console.error("Error al generar posts:", error);
      setError(error.message || MESSAGES.GENERATION_ERROR);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (texto: string) => {
    if (!limits.hasExportacion) {
      return;
    }

    try {
      await navigator.clipboard.writeText(texto);
    } catch (error) {
      console.error("Error al copiar:", error);
    }
  };

  if (loading || isLoadingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-eske-10 dark:bg-[#0B1620]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-bluegreen-eske border-t-transparent" />
          <p className="mt-4 text-black-eske-20 dark:text-[#9AAEBE]">Cargando Redactor...</p>
        </div>
      </div>
    );
  }

  // ✅ Mostrar selector para TODOS (visitantes y autenticados) cuando no tienen proyectos
  if (showProjectSelector) {
    return (
      <ProjectSelector
        userId={user?.uid || "visitor"}
        userPlan={userPlan}
        onProjectSelected={handleProjectSelected}
        isVisitor={!user}
      />
    );
  }

  return (
    <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] py-8 max-sm:py-6">
      {showConfigWizard && (
        <ConfigWizard
          onComplete={handleConfigComplete}
          onClose={() => {
            if (currentProject?.configuration) {
              setShowConfigWizard(false);
            } else if (allProjects.length > 0) {
              setShowProjectSelector(true);
            } else {
              router.push("/moddulo");
            }
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-sm:mb-6">
          <Link href="/moddulo" className="inline-flex items-center gap-2 text-bluegreen-eske hover:text-bluegreen-eske/80 transition-colors mb-4 focus-ring-primary rounded-lg px-2 py-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Volver al Hub</span>
          </Link>

          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-bluegreen-eske rounded-lg flex items-center justify-center">
              <svg className="w-7 h-7 text-white-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl max-sm:text-2xl font-bold text-bluegreen-eske">
                Redactor Político
              </h1>
              <p className="text-sm text-black-eske-20 dark:text-[#9AAEBE]">
                {currentProject ? currentProject.name : "Genera posts profesionales con IA"}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {currentProject && allProjects.length > 0 && (
                <ProjectDropdown
                  currentProject={currentProject}
                  allProjects={allProjects}
                  onProjectChange={handleProjectChange}
                  onCreateNew={handleOpenProjectSelector}
                />
              )}
              
              {currentProject?.configuration && (
                <button onClick={handleEditConfig} className="flex items-center gap-2 bg-gray-eske-10 dark:bg-[#18324A] hover:bg-gray-eske-20 dark:hover:bg-white/5 text-gray-eske-80 dark:text-[#C7D6E0] px-4 py-2 rounded-lg transition-colors text-sm font-medium" title="Editar configuración">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="max-sm:hidden">Configuración</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 bg-blue-eske/10 dark:bg-blue-eske/20 text-blue-eske-80 dark:text-blue-eske-30 px-3 py-1.5 rounded-full text-xs font-semibold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              {isFreemium ? "Plan Freemium" : "Plan Básico"}
            </div>
            
            {currentProject?.configuration && (
              <>
                <div className="inline-flex items-center gap-2 bg-green-eske/10 text-green-eske-80 dark:text-green-eske-30 px-3 py-1.5 rounded-full text-xs font-semibold">
                  {currentProject.configuration.context === "electoral" ? "🗳️ Electoral" : "🏛️ Gubernamental"}
                </div>
                
                <div className="inline-flex items-center gap-2 bg-violet-eske/10 text-violet-eske-60 dark:text-violet-eske-20 px-3 py-1.5 rounded-full text-xs font-semibold">
                  {currentProject.configuration.country === "mexico" ? "🇲🇽 México" : currentProject.configuration.country}
                </div>
              </>
            )}
          </div>
        </div>

        {isFreemium && usageInfo && (
          <div className="mb-6">
            <FreemiumBanner
              generationsUsed={usageInfo.totalGenerations}
              generationsLimit={2}
              isLimitReached={isLimitReached || false}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-eske/10 dark:bg-red-eske/20 border-l-4 border-red-eske text-red-eske-90 dark:text-red-eske-20 p-4 rounded-r-lg mb-6" role="alert">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <RedactorForm
              onSubmit={handleGenerate}
              isGenerating={isGenerating}
              disabled={isLimitReached || false || !currentProject?.configuration}
            />
          </div>

          <div className="lg:col-span-2">
            {currentOutput ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-bluegreen-eske mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Variantes generadas ({currentOutput.variantes.length})
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentOutput.variantes.map((variante) => (
                      <PostPreview
                        key={variante.id}
                        variante={variante}
                        isSelected={selectedVarianteId === variante.id}
                        onSelect={() => setSelectedVarianteId(variante.id)}
                        onCopy={() => handleCopy(variante.texto)}
                        canExport={limits.hasExportacion}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-bluegreen-eske mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      Hashtags sugeridos
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {currentOutput.hashtags.map((hashtag, index) => (
                        <span key={index} className="bg-bluegreen-eske/10 text-bluegreen-eske px-3 py-1.5 rounded-full text-sm font-medium">
                          {hashtag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-bluegreen-eske mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Descripción de imagen sugerida
                    </h3>
                    <p className="text-sm text-gray-eske-80 dark:text-[#C7D6E0] bg-gray-eske-10 dark:bg-[#112230] p-3 rounded-lg">
                      {currentOutput.imagenDescripcion}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md p-12 max-sm:p-8 text-center">
                <svg className="w-24 h-24 mx-auto text-gray-eske-30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-eske-60 dark:text-[#9AAEBE] text-lg max-sm:text-base font-medium mb-2">
                  Comienza a generar posts
                </p>
                <p className="text-black-eske-20 dark:text-[#6D8294] text-sm">
                  Completa el formulario y presiona "Generar Posts" para ver tus variantes
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

