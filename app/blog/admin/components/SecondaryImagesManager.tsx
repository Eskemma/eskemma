// app/blog/admin/components/SecondaryImagesManager.tsx
"use client";

import { useState } from "react";
import { SecondaryImage } from "@/types/post.types";

interface SecondaryImagesManagerProps {
  images: SecondaryImage[];
  content: string;
  onImagesChange: (images: SecondaryImage[]) => void;
  onInsertImage: (imageUrl: string, filename: string) => void;
  onDeleteImage: (imageId: string) => void;
}

export default function SecondaryImagesManager({
  images,
  content,
  onImagesChange,
  onInsertImage,
  onDeleteImage,
}: SecondaryImagesManagerProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Verificar si una imagen ya está insertada en el contenido
  const isImageInContent = (imageUrl: string) => {
    return content.includes(imageUrl);
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section
      className="bg-gray-eske-10 dark:bg-[#112230] rounded-xl p-4 border border-gray-eske-30 dark:border-white/10"
      aria-labelledby="secondary-images-title"
    >
      <div className="flex items-center justify-between mb-4">
        <h4
          id="secondary-images-title"
          className="text-sm font-bold text-black-eske dark:text-[#EAF2F8] flex items-center gap-2"
        >
          <svg
            className="w-4 h-4 text-bluegreen-eske"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Galería de Imágenes
        </h4>
        <span
          className="text-xs text-black-eske-20 dark:text-[#9AAEBE] bg-white-eske dark:bg-white/10 px-2 py-1 rounded-full"
          aria-label={`${images.length} ${images.length === 1 ? "imagen" : "imágenes"} en galería`}
        >
          {images.length} {images.length === 1 ? "imagen" : "imágenes"}
        </span>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-8 text-black-eske-10 dark:text-[#9AAEBE] text-sm" role="status">
          <svg
            className="w-12 h-12 mx-auto mb-2 text-gray-eske-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p>No hay imágenes secundarias subidas</p>
          <p className="text-xs mt-1">Sube una imagen para comenzar</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-3"
          role="list"
          aria-label={`${images.length} ${images.length === 1 ? "imagen" : "imágenes"} en galería`}
        >
          {images.map((image) => {
            const isInserted = isImageInContent(image.url);
            return (
              <article
                key={image.id}
                className="relative bg-white-eske dark:bg-[#18324A] rounded-lg overflow-hidden border border-gray-eske-30 dark:border-white/10 hover:shadow-md transition-shadow"
                role="listitem"
              >
                {/* Imagen */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedImage(
                      expandedImage === image.id ? null : image.id
                    )
                  }
                  className="relative h-32 bg-gray-eske-20 cursor-pointer w-full focus-ring-primary"
                  aria-label={`${isInserted ? "Imagen insertada" : "Imagen"}: ${image.filename}. Clic para ampliar`}
                >
                  <img
                    src={image.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />

                  {/* Badge de insertado */}
                  {isInserted && (
                    <div
                      className="absolute top-2 right-2 bg-green-eske text-white text-xs px-2 py-1 rounded-full flex items-center gap-1"
                      role="status"
                      aria-label="Imagen insertada en el contenido"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span aria-hidden="true">Insertada</span>
                    </div>
                  )}

                  {/* Ícono de expandir */}
                  <div
                    className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white p-1 rounded"
                    aria-hidden="true"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Info y acciones */}
                <div className="p-2">
                  <p
                    className="text-xs text-black-eske-40 dark:text-[#C7D6E0] truncate mb-2"
                    title={image.filename}
                  >
                    {image.filename}
                  </p>

                  <div
                    className="flex gap-1"
                    role="group"
                    aria-label={`Acciones para ${image.filename}`}
                  >
                    <button
                      type="button"
                      onClick={() => onInsertImage(image.url, image.filename)}
                      disabled={isInserted}
                      className={`flex-1 text-xs py-1.5 rounded transition-colors focus-ring-primary ${
                        isInserted
                          ? "bg-gray-eske-40 dark:bg-white/10 text-black-eske-10 dark:text-[#6D8294] cursor-not-allowed"
                          : "bg-bluegreen-eske text-white hover:bg-bluegreen-eske-70"
                      }`}
                      aria-label={
                        isInserted
                          ? `${image.filename} ya está insertada en el contenido`
                          : `Insertar ${image.filename} en el contenido`
                      }
                    >
                      {isInserted ? "✓ Insertada" : "Insertar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar "${image.filename}"?`)) {
                          onDeleteImage(image.id);
                        }
                      }}
                      className="px-2 py-1.5 bg-red-eske text-white rounded hover:bg-red-eske-60 transition-colors focus-ring-primary"
                      aria-label={`Eliminar imagen ${image.filename}`}
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Vista expandida */}
                {expandedImage === image.id && (
                  <div
                    className="absolute inset-0 bg-black bg-opacity-90 z-10 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`expanded-image-title-${image.id}`}
                  >
                    <h5
                      id={`expanded-image-title-${image.id}`}
                      className="sr-only"
                    >
                      Vista ampliada de {image.filename}
                    </h5>
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="max-w-full max-h-full object-contain"
                    />
                    <button
                      onClick={() => setExpandedImage(null)}
                      className="absolute top-2 right-2 bg-white text-black-eske rounded-full p-2 hover:bg-gray-eske-20 focus-ring-primary"
                      aria-label="Cerrar vista ampliada"
                    >
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Información adicional */}
      {images.length > 0 && (
        <div
          className="mt-3 pt-3 border-t border-gray-eske-30 dark:border-white/10 text-xs text-black-eske-20 dark:text-[#9AAEBE]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span>
              {images.filter((img) => isImageInContent(img.url)).length} de{" "}
              {images.length} insertadas en el contenido
            </span>
            <span
              aria-label={`Tamaño total: ${
                images.reduce((acc, img) => acc + (img.size || 0), 0) > 0
                  ? formatFileSize(
                      images.reduce((acc, img) => acc + (img.size || 0), 0)
                    )
                  : "No disponible"
              }`}
            >
              Total:{" "}
              {images.reduce((acc, img) => acc + (img.size || 0), 0) > 0
                ? formatFileSize(
                    images.reduce((acc, img) => acc + (img.size || 0), 0)
                  )
                : "N/A"}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
