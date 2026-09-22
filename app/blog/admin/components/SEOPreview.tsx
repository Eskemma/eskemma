// app/blog/admin/components/SEOPreview.tsx
"use client";

import { useState } from "react";

interface SEOPreviewProps {
  title: string;
  description: string;
  imageUrl?: string;
  slug: string;
}

export default function SEOPreview({
  title,
  description,
  imageUrl,
  slug,
}: SEOPreviewProps) {
  const [activeTab, setActiveTab] = useState<"google" | "facebook" | "twitter">(
    "google"
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://eskemma.com";
  const fullUrl = `${siteUrl}/blog/${slug}`;

  // Truncar texto para simular límites de caracteres
  const truncateTitle = (text: string, maxLength: number) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const truncateDescription = (text: string, maxLength: number) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  return (
    <section
      className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md border border-gray-eske-30 dark:border-white/10 p-6"
      aria-labelledby="seo-preview-title"
    >
      <h3
        id="seo-preview-title"
        className="text-lg font-bold text-black-eske dark:text-[#EAF2F8] mb-4 flex items-center gap-2"
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
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        Vista Previa SEO
      </h3>

      {/* Tabs */}
      <div
        className="flex gap-2 mb-4 border-b border-gray-eske-30 dark:border-white/10"
        role="tablist"
        aria-label="Plataformas de vista previa SEO"
      >
        <button
          onClick={() => setActiveTab("google")}
          role="tab"
          aria-selected={activeTab === "google"}
          aria-controls="google-preview"
          id="google-tab"
          className={`px-4 py-2 font-semibold transition-colors focus-ring-primary ${
            activeTab === "google"
              ? "border-b-2 border-bluegreen-eske text-bluegreen-eske"
              : "text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8]"
          }`}
        >
          Google
        </button>
        <button
          onClick={() => setActiveTab("facebook")}
          role="tab"
          aria-selected={activeTab === "facebook"}
          aria-controls="facebook-preview"
          id="facebook-tab"
          className={`px-4 py-2 font-semibold transition-colors focus-ring-primary ${
            activeTab === "facebook"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-black-eske-20 hover:text-black-eske"
          }`}
        >
          Facebook
        </button>
        <button
          onClick={() => setActiveTab("twitter")}
          role="tab"
          aria-selected={activeTab === "twitter"}
          aria-controls="twitter-preview"
          id="twitter-tab"
          className={`px-4 py-2 font-semibold transition-colors focus-ring-primary ${
            activeTab === "twitter"
              ? "border-b-2 border-sky-500 text-sky-500"
              : "text-black-eske-20 hover:text-black-eske"
          }`}
        >
          Twitter/X
        </button>
      </div>

      {/* Google Preview */}
      {activeTab === "google" && (
        <div
          id="google-preview"
          role="tabpanel"
          aria-labelledby="google-tab"
          className="bg-white dark:bg-[#112230] rounded-lg p-4 border border-gray-eske-20 dark:border-white/10"
        >
          <div className="text-sm text-black-eske-20 dark:text-[#9AAEBE] mb-1">{fullUrl}</div>
          <div className="text-xl text-blue-800 dark:text-[#4791B3] hover:underline cursor-pointer mb-1">
            {truncateTitle(title || "Título del post", 60)}
          </div>
          <div className="text-sm text-black-eske-40 dark:text-[#C7D6E0]">
            {truncateDescription(description || "Descripción del post", 160)}
          </div>
        </div>
      )}

      {/* Facebook Preview */}
      {activeTab === "facebook" && (
        <div
          id="facebook-preview"
          role="tabpanel"
          aria-labelledby="facebook-tab"
          className="bg-white dark:bg-[#112230] rounded-lg border border-gray-eske-20 dark:border-white/10 overflow-hidden"
        >
          {imageUrl && (
            <div className="w-full h-64 bg-gray-eske-20">
              <img
                src={imageUrl}
                alt="Vista previa de imagen destacada en Facebook"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-3 bg-white-eske-40 dark:bg-[#0B1620]">
            <div className="text-xs text-black-eske-10 dark:text-[#9AAEBE] uppercase mb-1">
              eskemma.com
            </div>
            <div className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
              {truncateTitle(title || "Título del post", 88)}
            </div>
            <div className="text-sm text-black-eske-20 dark:text-[#C7D6E0]">
              {truncateDescription(description || "Descripción del post", 200)}
            </div>
          </div>
        </div>
      )}

      {/* Twitter Preview */}
      {activeTab === "twitter" && (
        <div
          id="twitter-preview"
          role="tabpanel"
          aria-labelledby="twitter-tab"
          className="bg-white dark:bg-[#112230] rounded-2xl border border-gray-eske-20 dark:border-white/10 overflow-hidden"
        >
          {imageUrl && (
            <div className="w-full h-64 bg-gray-eske-20">
              <img
                src={imageUrl}
                alt="Vista previa de imagen destacada en Twitter"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-3">
            <div className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
              {truncateTitle(title || "Título del post", 70)}
            </div>
            <div className="text-sm text-black-eske-20 dark:text-[#C7D6E0] mb-2">
              {truncateDescription(description || "Descripción del post", 125)}
            </div>
            <div className="text-xs text-black-eske-10 dark:text-[#9AAEBE]">🔗 eskemma.com</div>
          </div>
        </div>
      )}

      {/* Validación */}
      <div
        className="mt-4 space-y-2"
        role="list"
        aria-label="Validación de contenido SEO"
      >
        <div className="flex items-center gap-2" role="listitem">
          {title && title.length > 0 && title.length <= 60 ? (
            <svg
              className="w-4 h-4 text-green-eske"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-orange-eske"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className="text-sm text-black-eske-40 dark:text-[#C7D6E0]">
            Título: {title?.length || 0}/60 caracteres
            {title && title.length > 60 && (
              <span className="text-orange-eske ml-2">
                (Se truncará en Google)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2" role="listitem">
          {description &&
          description.length > 0 &&
          description.length <= 160 ? (
            <svg
              className="w-4 h-4 text-green-eske"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-orange-eske"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className="text-sm text-black-eske-40 dark:text-[#C7D6E0]">
            Descripción: {description?.length || 0}/160 caracteres
            {description && description.length > 160 && (
              <span className="text-orange-eske ml-2">(Se truncará)</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2" role="listitem">
          {imageUrl ? (
            <svg
              className="w-4 h-4 text-green-eske"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-yellow-eske"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className="text-sm text-black-eske-40 dark:text-[#C7D6E0]">
            Imagen destacada: {imageUrl ? "Configurada ✓" : "No configurada"}
          </span>
        </div>
      </div>
    </section>
  );
}
