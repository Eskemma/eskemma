// app/HomeClient.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Button from "./components/Button";
import PropAnimation from "./components/componentsHome/PropAnimation";
import TeamModal from "./components/componentsHome/TeamModal";
import ScheduleDate from "./components/componentsHome/ScheduleDate";
import ResponseDate from "./components/componentsHome/ReponseDate";
import BenefitsSection from "./components/componentsHome/BenefitsSection";
import FaqSection from "./components/componentsHome/FaqSection";
import { BlogPost } from "@/types/post.types";

interface HomeClientProps {
  blogPosts: BlogPost[];
}

export default function HomeClient({ blogPosts }: HomeClientProps) {
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    dateTime: "",
  });

  // Estado para controlar carga del video
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const userName = "Usuario";

  // ✅ NUEVO: Timeout de seguridad - Si el video no carga en 10s, oculta spinner
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isVideoLoading) {
        setIsVideoLoading(false);
      }
    }, 10000); // 10 segundos

    return () => clearTimeout(timeout);
  }, [isVideoLoading]);

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
          <h1 className="text-[48px] max-sm:text-2xl leading-tight font-bold">
            Consultoría política
          </h1>
          <p className="mt-8 max-sm:mt-4 text-[32px] max-sm:text-xl leading-tight font-light">
            <span>El ecosistema digital</span>
            <br />
            <span>para tu proyecto político</span>
          </p>
          <div className="mt-[10vh] max-sm:mt-6 space-y-4 max-sm:space-y-1 text-[18px] max-sm:text-base leading-[1.15] font-normal">
            <p>Descubre tus ventajas competitivas.</p>
            <p>Te acompañamos con tecnología y datos.</p>
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
                  {/* Imagen */}
                  {post.featureImage && (
                    <img
                      src={post.featureImage}
                      alt={`Imagen destacada: ${post.title}`}
                      className="w-full h-48 max-sm:h-32 object-cover rounded-lg mb-4 max-sm:mb-2"
                    />
                  )}

                  {/* Título - con flex-grow para ocupar espacio variable */}
                  <h3 className="text-xl max-sm:text-base text-bluegreen-eske-60 font-semibold mb-2 max-sm:mb-1 hover:text-bluegreen-eske transition-colors duration-300 grow-0 dark:text-[#6BA4C6] dark:hover:text-[#EAF2F8]">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="focus-ring-primary rounded"
                    >
                      {post.title}
                    </Link>
                  </h3>

                  {/* Contenido - con flex-grow para ocupar espacio variable */}
                  <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 mb-4 max-sm:mb-2 line-clamp-3 grow dark:text-[#9AAEBE]">
                    {post.content.substring(0, 160)}...
                  </p>

                  {/* Fecha y autor */}
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

                  {/* Botón - con mt-auto para empujarlo al fondo */}
                  <div className="mt-auto w-full max-w-50">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="block text-center w-full bg-bluegreen-eske text-white-eske py-2 max-sm:py-1.5 rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-all duration-300 text-[14px] max-sm:text-xs focus-ring-light"
                    >
                      Leer completo →
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
            {/* Card 1 */}
            <div className="flex flex-col items-center text-center min-h-full">
              <Image
                src="/images/part_comparativa_circuns.gif"
                alt="Gráfica animada de participación electoral por circunscripción en México 2006-2021"
                width={600}
                height={338}
                className="w-full h-auto object-contain rounded-lg mb-4 max-sm:mb-2"
                unoptimized={true}
              />
              <p className="text-[16px] max-sm:text-sm text-gray mb-4 max-sm:mb-2 grow dark:text-[#9AAEBE]">
                Participación electoral por circunscripción{" "}
                <br className="max-sm:hidden" />
                en las elecciones federales de México 2006-2021
              </p>

            </div>

            {/* Card 2 */}
            <div className="flex flex-col items-center text-center min-h-full">
              <Image
                src="/images/part_tipo_eleccion.gif"
                alt="Gráfica animada de participación electoral por tipo de elección en México"
                width={600}
                height={338}
                className="w-full h-auto object-contain rounded-lg mb-4 max-sm:mb-2"
                unoptimized={true}
              />
              <p className="text-[16px] max-sm:text-sm text-gray mb-4 max-sm:mb-2 grow dark:text-[#9AAEBE]">
                ¿Por qué la participación electoral aumenta en las{" "}
                <br className="max-sm:hidden" />
                elecciones presidenciales en México?
              </p>

            </div>
          </div>
        </div>
      </section>

      {/* Propuesta Section */}
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
              <span className="block">asesoría gratuita de 30 minutos.</span>
            </p>

            {/* Modal de Agendar Asesoría */}
            <ScheduleDate
              isOpen={isScheduleModalOpen}
              onClose={() => setIsScheduleModalOpen(false)}
              onSubmitSuccess={(data) => {
                setFormData(data);
                setIsScheduleModalOpen(false);
                setIsResponseModalOpen(true);
              }}
            />

            {/* Modal de Confirmación */}
            {isResponseModalOpen && (
              <ResponseDate
                isOpen={isResponseModalOpen}
                onClose={() => setIsResponseModalOpen(false)}
                fullName={formData.fullName}
                email={formData.email}
                dateTime={formData.dateTime}
              />
            )}
          </div>
        </div>
      </section>

      {/* Sobre Nosotros Section - CON SPINNER DE CARGA */}
      <section
        className="bg-white-eske py-12 max-sm:py-8 px-4 sm:px-6 md:px-8 dark:bg-[#0B1620]"
        aria-labelledby="about-heading"
      >
        <div className="w-[90%] mx-auto max-w-7xl text-center">
          {/* Subtítulo */}
          <h2
            id="about-heading"
            className="text-3xl max-sm:text-xl font-bold text-bluegreen-eske mb-6 max-sm:mb-4 dark:text-[#6BA4C6]"
          >
            Sobre nosotros
          </h2>

          {/* Párrafo Principal */}
          <p className="text-xl max-sm:text-base font-normal text-black-eske mb-6 max-sm:mb-4 dark:text-[#C7D6E0]">
            Nuestro propósito es profesionalizar la vida pública.
          </p>

          {/* Recuadro para el Video - CON SPINNER */}
          <div className="relative w-full max-w-170 mx-auto overflow-hidden shadow-lg mb-8 max-sm:mb-6 rounded-lg bg-black">
            {isVideoLoading && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black"
                aria-live="polite"
              >
                {/* Spinner animado */}
                <div className="w-12 h-12 max-sm:w-10 max-sm:h-10 border-4 border-bluegreen-eske/30 border-t-bluegreen-eske rounded-full animate-spin"></div>

                {/* Texto de carga (oculto para lectores de pantalla) */}
                <span className="sr-only">Cargando video de presentación</span>

                {/* Texto visible (opcional) */}
                <p className="mt-4 text-white-eske text-sm max-sm:text-xs font-light">
                  Cargando video...
                </p>
              </div>
            )}

            <div className="relative aspect-video w-full overflow-hidden">
              <iframe
                src="https://drive.google.com/file/d/1b8qZHWHYyID5Q-PN26pEbhCUySrilivE/preview"
                title="Video de presentación de Eskemma - Sobre nosotros"
                className="absolute left-0 w-full video-iframe"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                // ✅ Cuando el iframe carga, oculta el spinner
                onLoad={() => setIsVideoLoading(false)}
              ></iframe>

              <style jsx>{`
                /* Desktop: Sin cambios (valores originales) */
                .video-iframe {
                  top: 0;
                  height: 100%;
                  border: none;
                  /* Fade-in suave del video */
                  opacity: ${isVideoLoading ? 0 : 1};
                  transition: opacity 0.5s ease;
                }

                /* Mobile: Valores adaptativos con clamp() */
                @media (max-width: 640px) {
                  .video-iframe {
                    height: clamp(130%, 135%, 140%);
                    top: clamp(-20%, -17.5%, -15%);
                  }
                }
              `}</style>
            </div>
          </div>

          {/* Modal de Equipo */}
          <TeamModal />
        </div>
      </section>

      {/* Sección - Beneficios */}
      <BenefitsSection />

      {/* Sección - Testimonios - OPTIMIZADA CON ALTERNANCIA MOBILE */}
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

          {/* Contenedor de Testimonios */}
          <div className="space-y-12 max-sm:space-y-8">           

            {/* Testimonio 1 - MOBILE: IZQUIERDA */}
            <figure className="flex flex-col sm:flex-row items-center max-sm:items-start sm:items-start sm:space-x-8 space-y-4 sm:space-y-0">
              {/* Avatar + Datos - Desktop: columna centrada, Mobile: fila alineada izquierda */}
              <div className="flex flex-row max-sm:flex-row sm:flex-col items-center sm:items-center gap-3 max-sm:gap-3 sm:gap-2 shrink-0">
                {/* Avatar */}
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-60 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="https://untitledui.com/images/avatars/brianna-ware"
                    alt=""
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>

                {/* Datos de la persona */}
                <div className="text-center sm:text-center max-sm:text-left">
                  <p className="text-[12px] max-sm:text-[12px] font-semibold text-bluegreen-eske leading-tight dark:text-[#4791B3]">
                    Carmen Arriaga
                  </p>
                  <p className="text-[12px] max-sm:text-[11px] text-gray-eske-90 leading-tight mt-0.5 dark:text-[#9AAEBE]">
                    Regidora
                  </p>
                  <p className="text-[11px] max-sm:text-[10px] text-gray-eske-80 leading-tight mt-0.5 dark:text-[#6D8294]">
                    @carriaganl
                  </p>
                </div>
              </div>

              {/* Texto del testimonio - Mobile: izquierda, Desktop: izquierda */}
              <blockquote className="text-[16px] max-sm:text-sm text-black-eske font-light max-sm:text-left sm:text-left w-full sm:max-w-[70%] dark:text-[#C7D6E0]">
                <p>
                  "Cuando pensé que no había nada más que hacer en mi
                  candidatura decidí utilizar el <em>Moddulo</em> de Eskemma.
                  Descubrí que había muchas opciones para competir con fuerza."
                </p>
              </blockquote>
            </figure>

            {/* Testimonio 2 - MOBILE: DERECHA */}
            <figure className="flex flex-col sm:flex-row-reverse items-center max-sm:items-end sm:items-start sm:space-x-reverse sm:space-x-8 space-y-4 sm:space-y-0">
              {/* Avatar + Datos - Desktop: columna centrada, Mobile: fila alineada derecha */}
              <div className="flex flex-row max-sm:flex-row sm:flex-col items-center sm:items-center gap-3 max-sm:gap-3 sm:gap-2 shrink-0">
                {/* Avatar */}
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-orange-60 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="https://untitledui.com/images/avatars/drew-cano"
                    alt=""
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>

                {/* Datos de la persona */}
                <div className="text-center sm:text-center max-sm:text-left">
                  <p className="text-[12px] max-sm:text-[12px] font-semibold text-bluegreen-eske leading-tight dark:text-[#4791B3]">
                    Sergio Hernández
                  </p>
                  <p className="text-[12px] max-sm:text-[11px] text-gray-eske-90 leading-tight mt-0.5 dark:text-[#9AAEBE]">
                    Analista
                  </p>
                  <p className="text-[11px] max-sm:text-[10px] text-gray-eske-80 leading-tight mt-0.5 dark:text-[#6D8294]">
                    @sergehernan33
                  </p>
                </div>
              </div>

              {/* Texto del testimonio - Mobile: derecha, Desktop: derecha */}
              <blockquote className="text-[16px] max-sm:text-sm text-black-eske font-light max-sm:text-right sm:text-right w-full sm:max-w-[70%] dark:text-[#C7D6E0]">
                <p>
                  "En los cursos de comunicación política siempre hablan de
                  estrategia, pero hasta ahora sé cómo hacerlo en territorio, no
                  sólo en teoría."
                </p>
              </blockquote>
            </figure>

            {/* Testimonio 3 - MOBILE: IZQUIERDA */}
            <figure className="flex flex-col sm:flex-row items-center max-sm:items-start sm:items-start sm:space-x-8 space-y-4 sm:space-y-0">
              {/* Avatar + Datos - Desktop: columna centrada, Mobile: fila alineada izquierda */}
              <div className="flex flex-row max-sm:flex-row sm:flex-col items-center sm:items-center gap-3 max-sm:gap-3 sm:gap-2 shrink-0">
                {/* Avatar */}
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-60 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="https://untitledui.com/images/avatars/ethan-valdez"
                    alt=""
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>

                {/* Datos de la persona */}
                <div className="text-center sm:text-center max-sm:text-left">
                  <p className="text-[12px] max-sm:text-[12px] font-semibold text-bluegreen-eske leading-tight dark:text-[#4791B3]">
                    Juan Carlos Montañez L.
                  </p>
                  <p className="text-[12px] max-sm:text-[11px] text-gray-eske-90 leading-tight mt-0.5 dark:text-[#9AAEBE]">
                    Candidato diputado local
                  </p>
                  <p className="text-[11px] max-sm:text-[10px] text-gray-eske-80 leading-tight mt-0.5 dark:text-[#6D8294]">
                    @JCMontañez
                  </p>
                </div>
              </div>

              {/* Texto del testimonio - Mobile: izquierda, Desktop: izquierda */}
              <blockquote className="text-[16px] max-sm:text-sm text-black-eske font-light max-sm:text-left sm:text-left w-full sm:max-w-[70%] dark:text-[#C7D6E0]">
                <p>
                  "Con su ayuda logré analizar mejor la información y saber cómo
                  aventajar a los otros partidos. Lo mejor es que lo hice yo
                  mismo y me ahorré una lana."
                </p>
              </blockquote>
            </figure>

            {/* Testimonio 4 - MOBILE: DERECHA */}
            <figure className="flex flex-col sm:flex-row-reverse items-center max-sm:items-end sm:items-start sm:space-x-reverse sm:space-x-8 space-y-4 sm:space-y-0">
              {/* Avatar + Datos - Desktop: columna centrada, Mobile: fila alineada derecha */}
              <div className="flex flex-row max-sm:flex-row sm:flex-col items-center sm:items-center gap-3 max-sm:gap-3 sm:gap-2 shrink-0">
                {/* Avatar */}
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-red-60 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="https://untitledui.com/images/avatars/ava-bentley"
                    alt=""
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>

                {/* Datos de la persona */}
                <div className="text-center sm:text-center max-sm:text-left">
                  <p className="text-[12px] max-sm:text-[12px] font-semibold text-bluegreen-eske leading-tight dark:text-[#4791B3]">
                    Martha T. Sepúlveda
                  </p>
                  <p className="text-[12px] max-sm:text-[11px] text-gray-eske-90 leading-tight mt-0.5 dark:text-[#9AAEBE]">
                    Concejal
                  </p>
                  <p className="text-[11px] max-sm:text-[10px] text-gray-eske-80 leading-tight mt-0.5 dark:text-[#6D8294]">
                    @mtsepulvedaCDMX
                  </p>
                </div>
              </div>

              {/* Texto del testimonio - Mobile: derecha, Desktop: derecha */}
              <blockquote className="text-[16px] max-sm:text-sm text-black-eske font-light max-sm:text-right sm:text-right w-full sm:max-w-[70%] dark:text-[#C7D6E0]">
                <p>
                  "Pensé que estos servicios sólo eran para grandes campañas.
                  Participé en una elección local en 2024 y pude utilizar mucha
                  de la ayuda que me brindaron."
                </p>
              </blockquote>
            </figure>
          </div>
        </div>
      </section>

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
              href="/sefix"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-80 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <img
                src="/icons/icon_Sefix.svg"
                alt=""
                aria-hidden="true"
                className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden"
              />
              <img
                src="/icons/icons_dark_mode/icon_Sefix_wd.svg"
                alt=""
                aria-hidden="true"
                className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block"
              />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-60 dark:text-[#4791B3]">
                Sefix
              </span>
            </Link>

            <Link
              href="/servicios"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-80 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <img
                src="/icons/icon_Consultoria.svg"
                alt=""
                aria-hidden="true"
                className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden"
              />
              <img
                src="/icons/icons_dark_mode/icon_Consultoría_wd.svg"
                alt=""
                aria-hidden="true"
                className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block"
              />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-60 dark:text-[#4791B3]">
                Servicios
              </span>
            </Link>

            <Link
              href="/blog"
              className="flex flex-col items-center justify-center text-center text-bluegreen-eske hover:text-bluegreen-60 transition-all duration-300 ease-in-out h-full focus-ring-primary rounded"
            >
              <img
                src="/icons/icon_Blog.svg"
                alt=""
                aria-hidden="true"
                className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 dark:hidden"
              />
              <img
                src="/icons/icons_dark_mode/icon_Blog_wd.svg"
                alt=""
                aria-hidden="true"
                className="w-32 h-32 max-sm:w-20 max-sm:h-20 mb-4 max-sm:mb-2 transition-transform duration-300 ease-in-out hover:scale-110 hidden dark:block"
              />
              <span className="text-xl max-sm:text-sm text-bluegreen-eske font-medium hover:text-bluegreen-60 dark:text-[#4791B3]">
                El baúl de Fouché
              </span>
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
