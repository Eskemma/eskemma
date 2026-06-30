// app/HomeClient.tsx
import Link from "next/link";
import Image from "next/image";
import PropAnimation from "./components/componentsHome/PropAnimation";
import TeamModal from "./components/componentsHome/TeamModal";
import BenefitsSection from "./components/componentsHome/BenefitsSection";
import ComoFunciona from "./components/componentsHome/ComoFunciona";
import FaqSection from "./components/componentsHome/FaqSection";
import PropuestaInteractiva from "./components/componentsHome/PropuestaInteractiva";
import VideoPresentation from "./components/componentsHome/VideoPresentation";
import PlanesInteractivos from "./components/componentsHome/PlanesInteractivos";
import { BlogPost } from "@/types/post.types";

interface HomeClientProps {
  blogPosts: BlogPost[];
}

export default function HomeClient({ blogPosts }: HomeClientProps) {
  return (
    <main className="min-h-screen overflow-x-hidden w-full">
      {/* Hero Section */}
      <section className="relative min-h-162.5 max-sm:min-h-[50vh] w-full flex items-center justify-center overflow-hidden bg-bluegreen-eske">
        <Image
          src="/images/hero2.webp"
          alt=""
          fill
          style={{ objectFit: "cover" }}
          className="object-cover max-sm:object-contain dark:hidden"
          priority
          aria-hidden="true"
        />
        <Image
          src="/images/hero_dark_mode.webp"
          alt=""
          fill
          style={{ objectFit: "cover" }}
          className="object-cover max-sm:object-contain hidden dark:block"
          priority
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-bluegreen-eske opacity-20"
          aria-hidden="true"
        ></div>
        <div className="relative z-10 text-center text-white-eske px-4 sm:px-6 md:px-8 max-w-7xl mx-auto w-full">
          <h1 className="text-[38px] max-sm:text-xl leading-tight font-bold max-sm:font-semibold">
            La política se gana con estrategia,{" "}
            <span className="max-sm:block">no con suerte.</span>
          </h1>
          <p className="mt-8 max-sm:mt-4 text-[20px] max-sm:text-sm leading-relaxed font-light max-w-3xl mx-auto">
            El ecosistema digital que te da certeza donde solo había incertidumbre.
            Sin partido, sin agenda. Sólo tu proyecto político.
          </p>
          <div className="mt-10 max-sm:mt-6">
            <Link
              href="/moddulo"
              className="inline-block border-2 border-white-eske bg-transparent text-white-eske px-8 max-sm:px-6 py-3 max-sm:py-2.5 rounded-lg font-medium hover:bg-white-eske/20 transition-all duration-300 text-[15px] max-sm:text-sm focus-ring-light"
            >
              EXPLORAR EL ECOSISTEMA GRATIS
            </Link>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section
        className="bg-gray-eske-10 min-h-145 py-12 max-sm:py-8 px-4 sm:px-6 md:px-8 dark:bg-[#112230]"
        aria-labelledby="blog-heading"
      >
        <div className="w-[90%] mx-auto max-w-7xl">
          <h2
            id="blog-heading"
            className="text-3xl max-sm:text-xl font-semibold text-center text-bluegreen-eske mb-12 max-sm:mb-8 dark:text-[#6BA4C6]"
          >
            Hoy en Eskemma
          </h2>

          {blogPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl max-sm:text-base text-gray-eske-60">
                No hay posts disponibles
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-sm:gap-4">
              {blogPosts.map((post) => (
                <article
                  key={post.id}
                  className="flex flex-col items-center text-center bg-white-eske rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-6 max-sm:p-4 min-h-full dark:bg-[#18324A] dark:border dark:border-white/10"
                >
                  {post.featureImage && (
                    <div className="relative w-full h-48 max-sm:h-32 rounded-lg overflow-hidden mb-4 max-sm:mb-2">
                      <Image
                        src={post.featureImage}
                        alt={`Imagen destacada: ${post.title}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  )}

                  <h3 className="text-xl max-sm:text-base text-bluegreen-eske-60 font-semibold mb-2 max-sm:mb-1 hover:text-bluegreen-eske transition-colors duration-300 grow-0 dark:text-[#6BA4C6] dark:hover:text-[#EAF2F8]">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="focus-ring-primary rounded"
                    >
                      {post.title}
                    </Link>
                  </h3>

                  <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 mb-4 max-sm:mb-2 line-clamp-3 grow dark:text-[#9AAEBE]">
                    {post.content.substring(0, 160)}...
                  </p>

                  <div className="flex justify-between w-full text-sm max-sm:text-xs text-gray-700 mb-4 max-sm:mb-2 px-2 max-sm:px-1 dark:text-[#9AAEBE]">
                    <time
                      className="text-gray-eske-60"
                      dateTime={post.updatedAt.toISOString()}
                    >
                      {post.updatedAt.toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    <span className="text-bluegreen-eske font-medium dark:text-[#4791B3]">
                      {post.author?.displayName || "Desconocido"}
                    </span>
                  </div>

                  <div className="mt-auto w-full max-w-50">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="block text-center w-full bg-bluegreen-eske text-white-eske py-2 max-sm:py-1.5 rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-all duration-300 text-[14px] max-sm:text-xs focus-ring-light"
                    >
                      LEER COMPLETO →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Información Relevante Section */}
      <section
        className="bg-white-eske min-h-125 py-12 max-sm:py-8 px-4 sm:px-6 md:px-8 dark:bg-[#0B1620]"
        aria-labelledby="info-heading"
      >
        <div className="w-[90%] mx-auto max-w-7xl">
          <h2
            id="info-heading"
            className="text-3xl max-sm:text-xl font-semibold text-center text-bluegreen-eske mb-12 max-sm:mb-8 dark:text-[#6BA4C6]"
          >
            Información relevante
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-sm:gap-4">
            <div className="flex flex-col items-center text-center min-h-full">
              <video
                autoPlay
                loop
                muted
                playsInline
                width={600}
                height={338}
                className="w-full h-auto object-contain rounded-lg mb-4 max-sm:mb-2"
                aria-label="Gráfica animada de participación electoral por circunscripción en México 2006-2021"
              >
                <source src="/images/part_comparativa_circuns.mp4" type="video/mp4" />
              </video>
              <p className="text-[16px] max-sm:text-sm text-gray mb-4 max-sm:mb-2 grow dark:text-[#9AAEBE]">
                Participación electoral por circunscripción{" "}
                <br className="max-sm:hidden" />
                en las elecciones federales de México 2006-2021
              </p>
              <div className="mt-auto w-full max-w-62.5">
                <Link
                  href="/centinela"
                  className="block text-center w-full bg-bluegreen-eske text-white-eske py-2 max-sm:py-1.5 rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-all duration-300 text-[14px] max-sm:text-xs focus-ring-light"
                >
                  CONSULTAR INFORMACIÓN →
                </Link>
              </div>
            </div>

            <div className="flex flex-col items-center text-center min-h-full">
              <video
                autoPlay
                loop
                muted
                playsInline
                width={600}
                height={338}
                className="w-full h-auto object-contain rounded-lg mb-4 max-sm:mb-2"
                aria-label="Gráfica animada de participación electoral por tipo de elección en México"
              >
                <source src="/images/part_tipo_eleccion.mp4" type="video/mp4" />
              </video>
              <p className="text-[16px] max-sm:text-sm text-gray mb-4 max-sm:mb-2 grow dark:text-[#9AAEBE]">
                ¿Por qué la participación electoral aumenta en las{" "}
                <br className="max-sm:hidden" />
                elecciones presidenciales en México?
              </p>
              <div className="mt-auto w-full max-w-62.5">
                <Link
                  href="/centinela"
                  className="block text-center w-full bg-bluegreen-eske text-white-eske py-2 max-sm:py-1.5 rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-all duration-300 text-[14px] max-sm:text-xs focus-ring-light"
                >
                  CONSULTAR INFORMACIÓN →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sobre Nosotros Section */}
      <section
        className="bg-gray-eske-10 py-12 max-sm:py-8 px-4 sm:px-6 md:px-8 dark:bg-[#112230]"
        aria-labelledby="about-heading"
      >
        <div className="w-[90%] mx-auto max-w-7xl text-center">
          <h2
            id="about-heading"
            className="text-3xl max-sm:text-xl font-bold text-bluegreen-eske mb-6 max-sm:mb-4 dark:text-[#6BA4C6]"
          >
            Sobre nosotros
          </h2>
          <p className="text-xl max-sm:text-base font-normal text-black-eske mb-6 max-sm:mb-4 dark:text-[#C7D6E0]">
            Nuestro propósito es profesionalizar la vida pública.
          </p>

          {/* Client Island: iframe con spinner */}
          <VideoPresentation />

          {/* TeamModal gestiona su propio estado internamente */}
          <TeamModal />
        </div>
      </section>

      {/* Sección - Beneficios */}
      <BenefitsSection />

      {/* Sección - Cómo funciona */}
      <ComoFunciona />

      {/* Sección - Testimonios */}
      <section
        className="bg-gray-eske-10 min-h-150 max-sm:min-h-100 py-20 max-sm:py-12 px-4 sm:px-6 md:px-8 dark:bg-[#112230]"
        aria-labelledby="testimonials-heading"
      >
        <div className="w-[90%] mx-auto max-w-7xl">
          <h2
            id="testimonials-heading"
            className="text-3xl max-sm:text-xl font-semibold text-center text-bluegreen-eske mb-12 max-sm:mb-8 dark:text-[#6BA4C6]"
          >
            ¿Qué opinan nuestros clientes?
          </h2>

          <div className="space-y-12 max-sm:space-y-8">
            <figure className="flex flex-col sm:flex-row items-center max-sm:items-start sm:items-start sm:space-x-8 space-y-4 sm:space-y-0">
              <div className="flex flex-row max-sm:flex-row sm:flex-col items-center sm:items-center gap-3 max-sm:gap-3 sm:gap-2 shrink-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-60 flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src="/images/testimonial-1.jpg"
                    alt=""
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>
                <div className="text-center sm:text-center max-sm:text-left">
                  <p className="text-[12px] max-sm:text-[12px] font-semibold text-bluegreen-eske leading-tight dark:text-[#4791B3]">Carmen Arriaga</p>
                  <p className="text-[12px] max-sm:text-[11px] text-gray-eske-90 leading-tight mt-0.5 dark:text-[#9AAEBE]">Regidora</p>
                  <p className="text-[11px] max-sm:text-[10px] text-gray-eske-80 leading-tight mt-0.5 dark:text-[#6D8294]">@carriaganl</p>
                </div>
              </div>
              <blockquote className="text-[16px] max-sm:text-sm text-black-eske font-light max-sm:text-left sm:text-left w-full sm:max-w-[70%] dark:text-[#C7D6E0]">
                <p>"Cuando pensé que no había nada más que hacer en mi candidatura decidí utilizar el <em>Moddulo</em> de Eskemma. Descubrí que había muchas opciones para competir con fuerza."</p>
              </blockquote>
            </figure>

            <figure className="flex flex-col sm:flex-row-reverse items-center max-sm:items-end sm:items-start sm:space-x-reverse sm:space-x-8 space-y-4 sm:space-y-0">
              <div className="flex flex-row max-sm:flex-row sm:flex-col items-center sm:items-center gap-3 max-sm:gap-3 sm:gap-2 shrink-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-orange-60 flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src="/images/testimonial-2.jpg"
                    alt=""
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>
                <div className="text-center sm:text-center max-sm:text-left">
                  <p className="text-[12px] max-sm:text-[12px] font-semibold text-bluegreen-eske leading-tight dark:text-[#4791B3]">Sergio Hernández</p>
                  <p className="text-[12px] max-sm:text-[11px] text-gray-eske-90 leading-tight mt-0.5 dark:text-[#9AAEBE]">Analista</p>
                  <p className="text-[11px] max-sm:text-[10px] text-gray-eske-80 leading-tight mt-0.5 dark:text-[#6D8294]">@sergehernan33</p>
                </div>
              </div>
              <blockquote className="text-[16px] max-sm:text-sm text-black-eske font-light max-sm:text-right sm:text-right w-full sm:max-w-[70%] dark:text-[#C7D6E0]">
                <p>"En los cursos de comunicación política siempre hablan de estrategia, pero hasta ahora sé cómo hacerlo en territorio, no sólo en teoría."</p>
              </blockquote>
            </figure>

            <figure className="flex flex-col sm:flex-row items-center max-sm:items-start sm:items-start sm:space-x-8 space-y-4 sm:space-y-0">
              <div className="flex flex-row max-sm:flex-row sm:flex-col items-center sm:items-center gap-3 max-sm:gap-3 sm:gap-2 shrink-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-60 flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src="/images/testimonial-3.jpg"
                    alt=""
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>
                <div className="text-center sm:text-center max-sm:text-left">
                  <p className="text-[12px] max-sm:text-[12px] font-semibold text-bluegreen-eske leading-tight dark:text-[#4791B3]">Juan Carlos Montañez L.</p>
                  <p className="text-[12px] max-sm:text-[11px] text-gray-eske-90 leading-tight mt-0.5 dark:text-[#9AAEBE]">Candidato diputado local</p>
                  <p className="text-[11px] max-sm:text-[10px] text-gray-eske-80 leading-tight mt-0.5 dark:text-[#6D8294]">@JCMontañez</p>
                </div>
              </div>
              <blockquote className="text-[16px] max-sm:text-sm text-black-eske font-light max-sm:text-left sm:text-left w-full sm:max-w-[70%] dark:text-[#C7D6E0]">
                <p>"Con su ayuda logré analizar mejor la información y saber cómo aventajar a los otros partidos. Lo mejor es que lo hice yo mismo y me ahorré una lana."</p>
              </blockquote>
            </figure>

            <figure className="flex flex-col sm:flex-row-reverse items-center max-sm:items-end sm:items-start sm:space-x-reverse sm:space-x-8 space-y-4 sm:space-y-0">
              <div className="flex flex-row max-sm:flex-row sm:flex-col items-center sm:items-center gap-3 max-sm:gap-3 sm:gap-2 shrink-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-red-60 flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src="/images/testimonial-4.jpg"
                    alt=""
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>
                <div className="text-center sm:text-center max-sm:text-left">
                  <p className="text-[12px] max-sm:text-[12px] font-semibold text-bluegreen-eske leading-tight dark:text-[#4791B3]">Martha T. Sepúlveda</p>
                  <p className="text-[12px] max-sm:text-[11px] text-gray-eske-90 leading-tight mt-0.5 dark:text-[#9AAEBE]">Concejal</p>
                  <p className="text-[11px] max-sm:text-[10px] text-gray-eske-80 leading-tight mt-0.5 dark:text-[#6D8294]">@mtsepulvedaCDMX</p>
                </div>
              </div>
              <blockquote className="text-[16px] max-sm:text-sm text-black-eske font-light max-sm:text-right sm:text-right w-full sm:max-w-[70%] dark:text-[#C7D6E0]">
                <p>"Pensé que estos servicios sólo eran para grandes campañas. Participé en una elección local en 2024 y pude utilizar mucha de la ayuda que me brindaron."</p>
              </blockquote>
            </figure>
          </div>
        </div>
      </section>

      {/* Sección - Propuesta */}
      <section
        className="bg-bluegreen-eske min-h-125 max-sm:min-h-100 py-18 max-sm:py-12 px-4 sm:px-6 md:px-8"
        aria-labelledby="propuesta-heading"
      >
        <div className="w-[90%] mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between">
          <div className="w-full md:w-1/3 flex justify-center">
            <PropAnimation />
          </div>

          <div className="w-full md:w-1/2 text-center text-white-eske mt-8 md:mt-0">
            <h2
              id="propuesta-heading"
              className="text-[24px] max-sm:text-lg block mb-8 max-sm:mb-6"
            >
              El tiempo es el recurso más valioso.
            </h2>
            <p className="text-[18px] max-sm:text-base font-light mb-4 max-sm:mb-3 leading-relaxed">
              <span className="block">Nunca es demasiado pronto.</span>
              <span className="block">Comencemos a planear tu estrategia.</span>
            </p>
            <p className="text-[18px] max-sm:text-base font-light mb-12 max-sm:mb-3 leading-relaxed">
              <span className="mt-6 block">
                Podemos colaborar desde ahora con una{" "}
              </span>
              <span className="block">sesión gratuita de 30 minutos.</span>
            </p>

            {/* Client Island: botón + modales de agenda */}
            <PropuestaInteractiva />
          </div>
        </div>
      </section>

      {/* Client Island: sección completa de suscripciones */}
      <PlanesInteractivos />

      {/* Sección - FAQ */}
      <FaqSection />

      {/* Enlaces Rápidos Section */}
      <section
        className="bg-white-eske min-h-125 py-16 max-sm:py-12 px-4 sm:px-6 md:px-8 dark:bg-[#0B1620]"
        aria-labelledby="quick-links-heading"
      >
        <div className="w-[90%] mx-auto max-w-7xl">
          <h2
            id="quick-links-heading"
            className="text-3xl max-sm:text-xl font-bold text-center text-bluegreen-eske mb-14 max-sm:mb-8 dark:text-[#6BA4C6]"
          >
            Enlaces rápidos
          </h2>

          <nav
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-sm:gap-4"
            aria-label="Enlaces rápidos a secciones principales"
          >
            <Link
              href="/moddulo"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-60 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <Image src="/icons/icon_Moddulo.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden" />
              <Image src="/icons/icons_dark_mode/icon_Moddulo_wd.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block" />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-60 dark:text-[#4791B3]">Moddulo</span>
            </Link>

            <Link
              href="/sefix"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-80 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <Image src="/icons/icon_Sefix.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden" />
              <Image src="/icons/icons_dark_mode/icon_Sefix_wd.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block" />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-60 dark:text-[#4791B3]">Sefix</span>
            </Link>

            <Link
              href="/servicios"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-80 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <Image src="/icons/icon_Consultoria.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden" />
              <Image src="/icons/icons_dark_mode/icon_Consultoría_wd.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block" />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-60 dark:text-[#4791B3]">Servicios</span>
            </Link>

            <Link
              href="/cursos"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-80 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <Image src="/icons/icon_Cursos.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden" />
              <Image src="/icons/icons_dark_mode/icon_Cursos_wd.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block" />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-60 dark:text-[#4791B3]">Cursos</span>
            </Link>

            <Link
              href="/centinela"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-80 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <Image src="/icons/icon_Centinela.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden" />
              <Image src="/icons/icons_dark_mode/icon_Centinela_wd.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block" />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-80 dark:text-[#4791B3]">Centinela</span>
            </Link>

            <Link
              href="/blog"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-60 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <Image src="/icons/icon_Blog.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden" />
              <Image src="/icons/icons_dark_mode/icon_Blog_wd.svg" alt="" aria-hidden="true" width={128} height={128} className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block" />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-60 dark:text-[#4791B3]">El baúl de Fouché</span>
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
