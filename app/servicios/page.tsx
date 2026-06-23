// app/servicios/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";

export const metadata: Metadata = {
  title: "Nuestros Servicios | Eskemma",
  description:
    "Descubre Moddulo, Sefix, Centinela y los cursos especializados de Eskemma: soluciones con IA para profesionalizar tu consultoría política y campañas electorales en México.",
  alternates: {
    canonical: `${SITE_URL}/servicios`,
  },
};

export default function ServiciosPage() {
  return (
    <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      {/* Hero Section */}
      <section
        className="relative min-h-[200px] max-sm:min-h-[160px] w-full flex items-center justify-center bg-bluegreen-eske overflow-hidden"
        aria-labelledby="hero-title"
      >
        {/* Imagen de fondo */}
        <Image
          src="/images/yanmin_yang.jpg"
          alt="Imagen de fondo"
          fill
          style={{ objectFit: "cover" }}
          className="object-cover"
          priority
          aria-hidden="true"
        />

        {/* Overlay con transparencia */}
        <div className="absolute inset-0 bg-bluegreen-eske dark:bg-bluegreen-eske-80 opacity-75" aria-hidden="true"></div>

        {/* Contenido del Hero */}
        <div className="relative z-10 text-center text-white-eske px-4 sm:px-6 md:px-8 max-w-screen-xl mx-auto w-full py-8 max-sm:py-6">
          <h1
            id="hero-title"
            className="text-[36px] max-sm:text-2xl leading-tight font-bold"
          >
            Nuestros Servicios
          </h1>
          <p className="mt-4 max-sm:mt-2 text-[18px] max-sm:text-base leading-relaxed font-light">
            Descubre cómo podemos ayudarte a profesionalizar tu carrera
            política.
          </p>
        </div>
      </section>

      {/* Sección de Descripción General */}
      <section
        className="bg-white-eske dark:bg-[#0B1620] py-12 max-sm:py-8 px-4 sm:px-6 md:px-8"
        aria-labelledby="description-title"
      >
        <div className="w-[90%] mx-auto max-w-screen-xl">
          <h2
            id="description-title"
            className="text-3xl max-sm:text-2xl font-semibold text-center text-bluegreen-eske dark:text-[#6BA4C6] mb-8 max-sm:mb-6"
          >
            ¿Qué ofrecemos?
          </h2>
          <p className="text-lg max-sm:text-base font-light text-center text-black-eske dark:text-[#C7D6E0] mb-8 max-sm:mb-6">
            En Eskemma, brindamos soluciones integrales para apoyar tu proyecto político.
          </p>
        </div>
      </section>

      {/* Sección de Servicios Detallados */}
      <section
        className="bg-white-eske dark:bg-[#0B1620] py-2 px-4 sm:px-6 md:px-8"
        aria-labelledby="services-title"
      >
        <div className="w-[90%] mx-auto max-w-screen-xl mb-12 max-sm:mb-8">
          <h2
            id="services-title"
            className="sr-only"
          >
            Lista de servicios disponibles
          </h2>

          {/* Grilla de Servicios */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-sm:gap-6"
            role="list"
            aria-label="9 servicios disponibles"
          >
            {/* Servicio 1 */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Consultoria.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Consultoría Política
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Estrategias personalizadas para fortalecer tu proyecto político.
              </p>
            </article>

            {/* Servicio 2 */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Moddulo.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Herramientas Digitales
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Acceso a metodologías y herramientas para diseñar y gestionar tu estrategia política.
              </p>
            </article>

            {/* Servicio 3 */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Sefix.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Dashboards Interactivos
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Visualización de datos para profundizar en el análisis de información política.
              </p>
            </article>

            {/* Servicio 4: Cursos y Talleres */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Cursos.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Cursos y Talleres
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Plataforma virtual, disponible 24/7, para aprender a desarrollar soluciones prácticas.
              </p>
            </article>

            {/* Servicio 5: Monitoreo de Información */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Monitor.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Monitoreo de Información
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Seguimiento y análisis de datos relevantes para tu proyecto
                político.
              </p>
            </article>

            {/* Servicio 6: Capacitación */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Cursos.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Capacitación
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Presencial y virtual para el desarrollo de habilidades
                políticas.
              </p>
            </article>

            {/* Servicio 7: Desarrollo de Software */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Software.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Desarrollo de Software
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Soluciones tecnológicas adaptadas a las necesidades de tu proyecto.
              </p>
            </article>

            {/* Servicio 8: Producción Audiovisual */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Producción.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Producción Audiovisual
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Creación de contenido multimedia para campañas electorales y de gobierno.
              </p>
            </article>

            {/* Servicio 9: Investigación Cuantitativa y Cualitativa */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <Image
                src="/icons/icon_Investigación.svg"
                alt=""
                width={80}
                height={80}
                className="mb-4 max-sm:mb-3 max-sm:w-16 max-sm:h-16 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Investigación Cuantitativa y Cualitativa
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Análisis profundo de datos sociales y políticos para tomar
                decisiones informadas.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section
        className="bg-gray-eske-20 dark:bg-[#112230] py-12 max-sm:py-8 px-4 sm:px-6 md:px-8 text-center text-black-eske-90 dark:text-[#C7D6E0]"
        aria-labelledby="cta-title"
      >
        <div className="w-[90%] mx-auto max-w-screen-xl">
          <h2
            id="cta-title"
            className="text-2xl max-sm:text-xl font-semibold mb-4 max-sm:mb-3"
          >
            ¿Comenzamos?
          </h2>
          <p className="text-lg max-sm:text-base font-light mb-8 max-sm:mb-6">
            Contáctanos para obtener más información sobre nuestros servicios.
          </p>
          <Link
            href="/contacto"
            className="inline-block bg-orange-eske text-white-eske px-8 max-sm:px-6 py-4 max-sm:py-3 rounded-lg font-medium hover:bg-orange-eske-70 transition-all duration-300 focus-ring-primary text-base max-sm:text-sm"
            aria-label="Ir a la página de contacto para solicitar información"
          >
            CONTACTAR AHORA
          </Link>
        </div>
      </section>
    </main>
  );
}

