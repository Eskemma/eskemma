// app/blog/[slug]/SaveForLater.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/firebase/firebaseConfig";

interface SaveForLaterProps {
  postId: string;
  postTitle: string;
  postSlug: string;
}

export default function SaveForLater({
  postId,
  postTitle,
  postSlug,
}: SaveForLaterProps) {
  const { user, setIsLoginModalOpen } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Manejo de Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showLoginPrompt) {
        setShowLoginPrompt(false);
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

  // Verificar si el post está guardado al montar el componente
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (!user) {
        setIsCheckingStatus(false);
        return;
      }

      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setIsCheckingStatus(false);
          return;
        }

        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/posts/save?postId=${postId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsSaved(data.isSaved);
        }
      } catch (error) {
        console.error("Error al verificar estado guardado:", error);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkSavedStatus();
  }, [user, postId]);

  const handleSave = async () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setShowLoginPrompt(true);
        return;
      }

      const token = await currentUser.getIdToken();
      const action = isSaved ? "unsave" : "save";

      const response = await fetch("/api/posts/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId,
          action,
          postTitle,
          postSlug,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar post");
      }

      const data = await response.json();
      setIsSaved(!isSaved);
    } catch (error) {
      console.error("Error al guardar/quitar post:", error);
      alert("Error al procesar la solicitud. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div 
        className="flex items-center justify-center py-4"
        role="status"
        aria-live="polite"
        aria-label="Verificando estado de guardado"
      >
        <div className="animate-pulse flex items-center gap-2 text-black-eske-20 dark:text-[#9AAEBE]">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          <span className="text-sm">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* MODAL DE LOGIN PROMPT */}
      {showLoginPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
          onClick={() => setShowLoginPrompt(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-login-modal-title"
        >
          <div
            className="bg-white dark:bg-[#18324A] rounded-lg shadow-lg w-full max-w-md p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón de cierre */}
            <button
              className="absolute top-4 right-4 text-black-eske-40 dark:text-[#C7D6E0] hover:text-red-eske transition-colors focus-ring-primary rounded"
              onClick={() => setShowLoginPrompt(false)}
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

            {/* Contenido */}
            <div className="text-center">
              {/* Icono */}
              <div className="mb-4 flex justify-center" aria-hidden="true">
                <svg
                  className="w-16 h-16 text-bluegreen-eske"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </div>

              <h3 
                id="save-login-modal-title"
                className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4"
              >
                Debes iniciar sesión para guardar posts
              </h3>

              <p className="text-black-eske-40 dark:text-[#C7D6E0] mb-6">
                Si aún no tienes tu usuario y contraseña, te invitamos a
                registrarte en nuestra comunidad de Eskemma.
              </p>

              <button
                onClick={() => {
                  setShowLoginPrompt(false);
                  setIsLoginModalOpen(true);
                }}
                className="w-full px-6 py-3 bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske-70 transition-colors font-semibold focus-ring-primary"
                aria-label="Iniciar sesión para guardar artículos"
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN GUARDAR */}
      <div className="flex items-center justify-center py-6 border-t border-gray-eske-20">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className={`flex items-center gap-3 px-6 py-3 rounded-lg border-2 transition-all duration-300 focus-ring-primary ${
            isSaved
              ? "bg-bluegreen-eske text-white border-bluegreen-eske hover:bg-bluegreen-eske-70"
              : "bg-white-eske dark:bg-[#18324A] border-gray-eske-30 dark:border-white/10 text-black-eske-40 dark:text-[#C7D6E0] hover:border-bluegreen-eske-40 hover:text-bluegreen-eske-40"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={isSaved ? "Artículo guardado. Clic para quitar de guardados" : "Guardar artículo para leer después"}
          aria-pressed={isSaved}
        >
          <svg
            className={`w-6 h-6 transition-transform duration-300 ${
              isSaved ? "scale-110" : "scale-100"
            }`}
            fill={isSaved ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          <span className="font-semibold">
            {isSaved ? "Guardado" : "Guardar para leer después"}
          </span>
        </button>
      </div>
    </>
  );
}
