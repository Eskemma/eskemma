"use client";

import { useState, useEffect } from "react";

export default function VideoPresentation() {
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isVideoLoading) {
        setIsVideoLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isVideoLoading]);

  return (
    <div className="relative w-full max-w-170 mx-auto overflow-hidden shadow-lg mb-8 max-sm:mb-6 rounded-lg bg-black">
      {isVideoLoading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black"
          aria-live="polite"
        >
          <div className="w-12 h-12 max-sm:w-10 max-sm:h-10 border-4 border-bluegreen-eske/30 border-t-bluegreen-eske rounded-full animate-spin"></div>
          <span className="sr-only">Cargando video de presentación</span>
          <p className="mt-4 text-white-eske text-sm max-sm:text-xs font-light">
            Cargando video...
          </p>
        </div>
      )}

      <div className="relative aspect-video w-full overflow-hidden">
        <iframe
          src="https://drive.google.com/file/d/1b8qZHWHYyID5Q-PN26pEbhCUySrilivE/preview"
          title="Video de presentación de Eskemma - Sobre nosotros"
          className="video-iframe absolute left-0 w-full border-none"
          style={{
            opacity: isVideoLoading ? 0 : 1,
            transition: "opacity 0.5s ease",
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setIsVideoLoading(false)}
        ></iframe>
      </div>
    </div>
  );
}
