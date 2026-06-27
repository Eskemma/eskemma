// app/centinela/CentinelaHeroSection.tsx
import Image from "next/image";

export default function CentinelaHeroSection() {
  return (
    <section
      className="relative min-h-50 max-sm:min-h-40 w-full flex items-center justify-center bg-bluegreen-eske overflow-hidden"
      aria-labelledby="centinela-hero-title"
    >
      <Image
        src="/images/yanmin_yang.jpg"
        alt="Imagen de fondo Centinela"
        fill
        style={{ objectFit: "cover" }}
        className="object-cover"
        priority
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-bluegreen-eske dark:bg-bluegreen-eske-80 opacity-75" aria-hidden="true" />
      <div className="relative z-10 text-center text-white-eske px-4 sm:px-6 md:px-8 max-w-7xl mx-auto w-full py-8 max-sm:py-6">
        <h1
          id="centinela-hero-title"
          className="text-[36px] max-sm:text-2xl leading-tight font-bold"
        >
          Centinela
        </h1>
        <p className="mt-4 max-sm:mt-2 text-[18px] max-sm:text-base leading-relaxed font-light">
          Inteligencia de contexto para la toma de decisiones estratégicas.
        </p>
      </div>
    </section>
  );
}
