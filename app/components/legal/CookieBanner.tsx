// app/components/legal/CookieBanner.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getCookieConsent,
  saveCookieConsent,
  acceptAllCookies,
  acceptEssentialOnly,
  hasGivenConsent,
} from "../../../lib/utils/cookieConsent";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,  // Siempre true
    analytics: false,
    marketing: false,
  });

  // Hooks de accesibilidad para el modal
  const modalRef = useFocusTrap(showConfigModal);
  useEscapeKey(showConfigModal, () => setShowConfigModal(false));

  // Verificar si ya se dio consentimiento al montar
  useEffect(() => {
    const hasConsent = hasGivenConsent();
    
    if (!hasConsent) {
      // Mostrar banner después de 1 segundo para mejor UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Cargar preferencias actuales si existen
  useEffect(() => {
    const consent = getCookieConsent();
    if (consent) {
      setPreferences({
        essential: consent.essential,
        analytics: consent.analytics,
        marketing: consent.marketing,
      });
    }
  }, []);

  const handleAcceptAll = () => {
    acceptAllCookies();
    setShowBanner(false);
    setShowConfigModal(false);
  };

  const handleAcceptEssential = () => {
    acceptEssentialOnly();
    setShowBanner(false);
    setShowConfigModal(false);
  };

  const handleOpenConfig = () => {
    setShowConfigModal(true);
  };

  const handleSavePreferences = () => {
    saveCookieConsent({
      essential: true, // Siempre true
      analytics: preferences.analytics,
      marketing: preferences.marketing,
    });
    setShowBanner(false);
    setShowConfigModal(false);
  };

  const handleTogglePreference = (category: 'analytics' | 'marketing') => {
    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // No mostrar nada si ya se dio consentimiento
  if (!showBanner) return null;

  return (
    <>
      {/* Banner Principal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-eske-20 dark:bg-[#112230] shadow-2xl border-t-2 border-bluegreen-eske dark:border-[#4791B3] animate-slide-up">
        <div className="w-[90%] max-w-screen-xl mx-auto py-6 px-4 sm:px-6">
          {/* Contenedor principal */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Ícono y texto */}
            <div className="flex-1">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl flex-shrink-0" role="img" aria-label="Cookie">🍪</span>
                <div>
                  <h3 className="text-[18px] max-sm:text-[16px] font-bold text-black-eske dark:text-[#C7D6E0] mb-2">
                    Usamos cookies para mejorar tu experiencia
                  </h3>
                  <p className="text-[14px] max-sm:text-[12px] text-black-eske-20 dark:text-[#9AAEBE] leading-relaxed">
                    Utilizamos cookies esenciales para el funcionamiento del sitio y cookies opcionales 
                    para análisis y marketing. Puedes elegir qué cookies aceptar.
                  </p>
                </div>
              </div>

              {/* Mini preview de categorías */}
              <div className="ml-11 space-y-1 text-[12px] text-black-eske-30 dark:text-[#6D8294]">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-green-eske rounded-full" aria-hidden="true"></span>
                  <span>Esenciales: Siempre activas</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-gray-eske-40 rounded-full" aria-hidden="true"></span>
                  <span>Analíticas: Opcional</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-gray-eske-40 rounded-full" aria-hidden="true"></span>
                  <span>Marketing: Opcional</span>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:flex-shrink-0">
              <button
                onClick={handleAcceptAll}
                className="px-6 py-2 bg-bluegreen-eske text-white-eske rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-colors duration-300 text-[14px] whitespace-nowrap focus-ring-primary"
              >
                Aceptar todo
              </button>
              
              <button
                onClick={handleAcceptEssential}
                className="px-6 py-2 bg-gray-eske text-black-eske rounded-lg font-medium hover:bg-gray-eske-90 hover:text-white-eske transition-colors duration-300 text-[14px] whitespace-nowrap focus-ring-primary"
              >
                Solo esenciales
              </button>
              
              <button
                onClick={handleOpenConfig}
                className="px-6 py-2 border-2 border-bluegreen-eske dark:border-[#4791B3] text-bluegreen-eske bg-white-eske dark:bg-[#18324A] rounded-lg font-medium hover:bg-bluegreen-eske-10 transition-colors duration-300 text-[14px] whitespace-nowrap focus-ring-primary"
              >
                Configurar
              </button>
            </div>
          </div>

          {/* Link a política de cookies */}
          <div className="mt-3 ml-11 text-[12px]">
            <Link 
              href="/politica-de-cookies" 
              className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline transition-colors focus-ring-primary rounded"
            >
              Leer más sobre nuestras cookies
            </Link>
          </div>
        </div>
      </div>

      {/* Modal de Configuración */}
      {showConfigModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfigModal(false);
          }}
        >
          <div 
            ref={modalRef as React.RefObject<HTMLDivElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-config-title"
            className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto animate-modal-appear"
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between mb-6">
              <h2 id="cookie-config-title" className="text-2xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] flex items-center gap-2">
                <span role="img" aria-label="Configuración">⚙️</span>
                Configurar Cookies
              </h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-black-eske-40 dark:text-[#C7D6E0] hover:text-red-eske transition-colors focus-ring-primary rounded"
                aria-label="Cerrar configuración de cookies"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Descripción */}
            <p className="text-[14px] text-black-eske-20 dark:text-[#9AAEBE] mb-6 leading-relaxed">
              Personaliza qué cookies deseas permitir. Las cookies esenciales son necesarias 
              para el funcionamiento del sitio y no se pueden desactivar.
            </p>

            {/* Categorías de cookies */}
            <div className="space-y-4">
              {/* Cookies Esenciales */}
              <div className="border-2 border-green-eske rounded-lg p-4 bg-green-eske-10 dark:bg-[#112230]">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" role="img" aria-label="Seguridad">🔒</span>
                    <h3 className="text-[16px] font-bold text-black-eske dark:text-[#C7D6E0]">
                      Cookies Esenciales
                    </h3>
                  </div>
                  <span className="text-[12px] font-semibold text-green-eske-70 bg-green-eske-20 px-3 py-1 rounded-full">
                    SIEMPRE ACTIVAS
                  </span>
                </div>
                <p className="text-[14px] text-black-eske-20 dark:text-[#9AAEBE] mb-2">
                  Necesarias para la autenticación, seguridad y funcionamiento básico del sitio.
                </p>
                <ul className="text-[12px] text-black-eske-30 dark:text-[#6D8294] space-y-1 ml-4">
                  <li>• Sesión de usuario</li>
                  <li>• Seguridad y prevención de fraude</li>
                  <li>• Funcionalidad básica del sitio</li>
                </ul>
              </div>

              {/* Cookies Analíticas */}
              <div className="border border-gray-eske-40 dark:border-white/10 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" role="img" aria-label="Análisis">📊</span>
                    <h3 className="text-[16px] font-bold text-black-eske dark:text-[#C7D6E0]">
                      Cookies Analíticas
                    </h3>
                  </div>
                  <button
                    onClick={() => handleTogglePreference('analytics')}
                    role="switch"
                    aria-checked={preferences.analytics}
                    aria-label="Activar cookies analíticas"
                    className={`relative w-12 h-6 rounded-full transition-colors focus-ring-primary ${
                      preferences.analytics ? 'bg-bluegreen-eske' : 'bg-gray-eske-40'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white-eske rounded-full transition-transform ${
                        preferences.analytics ? 'translate-x-6' : 'translate-x-0'
                      }`}
                      aria-hidden="true"
                    ></span>
                  </button>
                </div>
                <p className="text-[14px] text-black-eske-20 dark:text-[#9AAEBE] mb-2">
                  Nos ayudan a entender cómo usas el sitio para mejorarlo. Los datos se anonimizan.
                </p>
                <ul className="text-[12px] text-black-eske-30 dark:text-[#6D8294] space-y-1 ml-4">
                  <li>• Google Analytics (datos anonimizados)</li>
                  <li>• Análisis de uso y comportamiento</li>
                  <li>• Duración: hasta 2 años</li>
                </ul>
              </div>

              {/* Cookies de Marketing */}
              <div className="border border-gray-eske-40 dark:border-white/10 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" role="img" aria-label="Marketing">📢</span>
                    <h3 className="text-[16px] font-bold text-black-eske dark:text-[#C7D6E0]">
                      Cookies de Marketing
                    </h3>
                  </div>
                  <button
                    onClick={() => handleTogglePreference('marketing')}
                    role="switch"
                    aria-checked={preferences.marketing}
                    aria-label="Activar cookies de marketing"
                    className={`relative w-12 h-6 rounded-full transition-colors focus-ring-primary ${
                      preferences.marketing ? 'bg-bluegreen-eske' : 'bg-gray-eske-40'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white-eske rounded-full transition-transform ${
                        preferences.marketing ? 'translate-x-6' : 'translate-x-0'
                      }`}
                      aria-hidden="true"
                    ></span>
                  </button>
                </div>
                <p className="text-[14px] text-black-eske-20 dark:text-[#9AAEBE] mb-2">
                  Permiten mostrarte anuncios relevantes en otras plataformas.
                </p>
                <ul className="text-[12px] text-black-eske-30 dark:text-[#6D8294] space-y-1 ml-4">
                  <li>• Facebook Pixel</li>
                  <li>• Google Ads (remarketing)</li>
                  <li>• Duración: hasta 90 días</li>
                </ul>
              </div>
            </div>

            {/* Botones del modal */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSavePreferences}
                className="flex-1 px-6 py-3 bg-bluegreen-eske text-white-eske rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-colors duration-300 focus-ring-primary"
              >
                Guardar preferencias
              </button>
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-eske-40 dark:border-white/10 text-black-eske dark:text-[#C7D6E0] rounded-lg font-medium hover:bg-gray-eske-10 transition-colors duration-300 focus-ring-primary"
              >
                Cancelar
              </button>
            </div>

            {/* Link adicional */}
            <p className="text-[12px] text-center text-black-eske-30 dark:text-[#6D8294] mt-4">
              Para más información, consulta nuestra{" "}
              <Link 
                href="/politica-de-cookies" 
                className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline focus-ring-primary rounded"
              >
                Política de Cookies
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Estilos para animaciones */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }

        @keyframes modal-appear {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-modal-appear {
          animation: modal-appear 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
