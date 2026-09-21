"use client";

import { useState, useEffect } from "react";

interface IframePanelProps {
  dashboardUrl: string;
  title?: string;
}

export default function IframePanel({
  dashboardUrl,
  title = "SEFIX Dashboard",
}: IframePanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        setHasError(true);
        setIsLoading(false);
      }
    }, 20000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    window.location.reload();
  };

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 160px)" }}>
      {/* Estado de carga */}
      {isLoading && !hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-white-eske dark:bg-[#18324A] z-20"
          aria-live="polite"
          aria-label="Cargando dashboard"
        >
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4" aria-hidden="true">
              <div className="absolute inset-0 border-4 border-gray-eske-20 rounded-full" />
              <div className="absolute inset-0 border-4 border-blue-eske rounded-full animate-spin border-t-transparent" />
            </div>
            <p className="text-black-eske-20 dark:text-[#9AAEBE] text-sm font-medium">
              Cargando dashboard...
            </p>
          </div>
        </div>
      )}

      {/* Estado de error */}
      {hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-eske-10 dark:bg-[#112230] z-20"
          role="alert"
        >
          <div className="text-center max-w-md mx-auto p-6">
            <div
              className="w-16 h-16 mx-auto mb-4 bg-red-eske-10 rounded-full flex items-center justify-center"
              aria-hidden="true"
            >
              <svg
                className="w-8 h-8 text-red-eske"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-black-eske dark:text-[#C7D6E0] mb-2">
              Error al cargar
            </h2>
            <p className="text-black-eske-20 dark:text-[#9AAEBE] text-sm mb-4">
              No se pudo conectar con el servidor del dashboard.
            </p>
            <button
              onClick={handleRetry}
              className="bg-blue-eske hover:bg-blue-eske-70 text-white-eske font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        src={dashboardUrl}
        title={title}
        className="w-full h-full border-none"
        onLoad={handleIframeLoad}
        loading="eager"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals"
        referrerPolicy="no-referrer-when-downgrade"
        allow="fullscreen"
      />
    </div>
  );
}
