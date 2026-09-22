// app/blog/[slug]/DownloadableResources.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { DownloadableResource } from "@/types/post.types";
import { getCategoryColor } from "@/lib/constants/categories";

interface DownloadableResourcesProps {
  resources: DownloadableResource[];
  category: string;
}

export default function DownloadableResources({
  resources,
  category,
}: DownloadableResourcesProps) {
  const { user, setIsLoginModalOpen } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<DownloadableResource | null>(null);

  const categoryColor = getCategoryColor(category);

  // Manejo de Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showLoginPrompt) {
        setShowLoginPrompt(false);
        setSelectedResource(null);
      }
    };

    if (showLoginPrompt) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [showLoginPrompt]);

  const getFileIcon = (fileType: string) => {
    const iconProps = {
      className: "w-5 h-5",
      fill: "currentColor",
      viewBox: "0 0 20 20",
      "aria-hidden": true as const,
    };

    switch (fileType) {
      case "pdf":
        return (
          <svg {...iconProps}>
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        );
      case "xlsx":
        return (
          <svg {...iconProps}>
            <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L13 1.586A2 2 0 0011.586 1H9z" />
          </svg>
        );
      default:
        return (
          <svg {...iconProps}>
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const handleDownload = async (resource: DownloadableResource) => {
    // Si no hay usuario, mostrar modal de login
    if (!user) {
      setSelectedResource(resource);
      setShowLoginPrompt(true);
      return;
    }

    // Verificar nivel de acceso
    const userRole = user.role || "visitor";
    const hasAccess = resource.accessLevel.includes(userRole as any);

    if (!hasAccess) {
      alert(
        "Este recurso requiere una suscripción activa. Por favor, actualiza tu plan."
      );
      return;
    }

    // Si es gratis y tiene acceso, procesar descarga
    if (resource.isFree) {
      try {
        alert(
          `Procesando descarga de: ${resource.title}\n\nEn producción, aquí se generaría el link de descarga desde Firebase Storage.`
        );
      } catch (error) {
        console.error("Error al descargar recurso:", error);
        alert("Error al procesar la descarga. Inténtalo de nuevo.");
      }
    } else {
      alert(
        `Recurso de pago: $${resource.price}\n\nEn producción, aquí se redirigiría a la página de compra.`
      );
    }
  };

  return (
    <>
      {/* Modal de login */}
      {showLoginPrompt && selectedResource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
          onClick={() => {
            setShowLoginPrompt(false);
            setSelectedResource(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
        >
          <div
            className="bg-white dark:bg-[#18324A] rounded-lg shadow-lg w-full max-w-md p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 text-black-eske-40 dark:text-[#C7D6E0] hover:text-red-eske transition-colors focus-ring-primary rounded"
              onClick={() => {
                setShowLoginPrompt(false);
                setSelectedResource(null);
              }}
              aria-label="Cerrar modal de inicio de sesión"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: categoryColor + "20" }}
                  aria-hidden="true"
                >
                  <svg
                    className="w-8 h-8"
                    style={{ color: categoryColor }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                </div>
              </div>

              <h3
                id="login-modal-title"
                className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4"
              >
                Debes iniciar sesión para descargar recursos
              </h3>

              <p className="text-black-eske-40 dark:text-[#C7D6E0] mb-6">
                Si aún no tienes tu usuario y contraseña, te invitamos a
                registrarte en nuestra comunidad de Eskemma.
              </p>

              <button
                onClick={() => {
                  setShowLoginPrompt(false);
                  setSelectedResource(null);
                  setIsLoginModalOpen(true);
                }}
                className="w-full px-6 py-3 bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske-70 transition-colors font-semibold focus-ring-primary"
                aria-label="Iniciar sesión para acceder a recursos"
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card de recursos */}
      <aside
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-6 border border-gray-eske-20 dark:border-white/10"
        aria-labelledby="resources-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            id="resources-title"
            className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] flex items-center gap-2"
          >
            <svg
              className="w-5 h-5 text-bluegreen-eske"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Recursos descargables
          </h3>
        </div>

        <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mb-4">
          Materiales complementarios para este tema
        </p>

        <div
          className="space-y-3"
          role="list"
          aria-label={`${resources.length} recurso${resources.length !== 1 ? "s" : ""} disponible${resources.length !== 1 ? "s" : ""}`}
        >
          {resources.map((resource) => (
            <article
              key={resource.id}
              className="group border border-gray-eske-30 dark:border-white/10 rounded-lg p-3 hover:border-bluegreen-eske hover:shadow-sm transition-all"
              role="listitem"
            >
              {/* Header con icono y badge */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: categoryColor }}
                    aria-hidden="true"
                  >
                    {getFileIcon(resource.fileType)}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-black-eske-40 dark:text-[#9AAEBE] uppercase">
                      {resource.fileType}
                    </span>
                    <span className="text-xs text-black-eske-20 dark:text-[#6D8294] ml-2">
                      {resource.fileSize}
                    </span>
                  </div>
                </div>

                {resource.isFree && (
                  <span
                    className="px-2 py-0.5 bg-green-eske/20 text-green-eske-70 text-xs font-semibold rounded"
                    role="text"
                  >
                    Gratis
                  </span>
                )}
              </div>

              {/* Título */}
              <h4 className="text-sm font-semibold text-black-eske dark:text-[#C7D6E0] mb-1 line-clamp-2">
                {resource.title}
              </h4>

              {/* Descripción */}
              <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mb-3 line-clamp-2">
                {resource.description}
              </p>

              {/* Botón de descarga */}
              <button
                onClick={() => handleDownload(resource)}
                className="w-full px-3 py-2 bg-bluegreen-eske text-white text-sm font-medium rounded hover:bg-bluegreen-eske-70 transition-colors flex items-center justify-center gap-2 focus-ring-primary"
                aria-label={`Descargar recurso: ${resource.title} ${resource.isFree ? "gratis" : `por $${resource.price}`}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {resource.isFree
                  ? "Descargar gratis"
                  : `Obtener - $${resource.price}`}
              </button>
            </article>
          ))}
        </div>

        {/* Link a página de recursos */}
        <a
          href="/recursos"
          className="block mt-4 text-center text-sm text-bluegreen-eske hover:text-bluegreen-eske-70 font-medium transition-colors focus-ring-primary rounded"
          aria-label="Ver todos los recursos disponibles"
        >
          Ver más recursos →
        </a>
      </aside>
    </>
  );
}
