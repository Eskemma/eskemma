// app/components/componentsCursos/listado/CoursesHeroSection.tsx

import Image from "next/image";

export default function CoursesHeroSection() {
  return (
    <section
      className="relative min-h-50 max-sm:min-h-40 w-full flex items-center justify-center bg-bluegreen-eske overflow-hidden"
      aria-labelledby="hero-title"
    >
      {/* Imagen de Fondo */}
      <Image
        src="/images/yanmin_yang.jpg"
        alt="Imagen de fondo para la sección de cursos"
        fill
        style={{ objectFit: "cover" }}
        className="object-cover"
        priority
        aria-hidden="true"
      />

      {/* Overlay con opacidad estándar */}
      <div
        className="absolute inset-0 bg-bluegreen-eske dark:bg-bluegreen-eske-80 opacity-75 z-10"
        aria-hidden="true"
      />

      {/* Contenido Centrado */}
      <div className="relative z-20 text-center text-white-eske px-4 sm:px-6 md:px-8 max-w-7xl mx-auto w-full py-8 max-sm:py-6">
        <h1
          id="hero-title"
          className="text-[36px] max-sm:text-2xl leading-tight font-bold"
        >
          Cursos y Talleres
        </h1>
        <p className="mt-4 max-sm:mt-2 text-[18px] max-sm:text-base leading-relaxed font-light">
          Formación práctica para dominar el diagnóstico electoral y la comunicación política.
        </p>
      </div>
    </section>
  );
}
