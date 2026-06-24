"use client";

import { useState } from "react";
import Image from "next/image";
import Button from "@/app/components/Button";
import SuscriptionBasicModal from "./SuscriptionBasicModal";
import SuscriptionPremiumModal from "./SuscriptionPremiumModal";
import SuscriptionProfessionalModal from "./SuscriptionProfessioinalModal";
import SuscriptionResponseModal from "./SucriptionResponseModal";

export default function PlanesInteractivos() {
  const [isBasicSuscriptionModalOpen, setIsBasicSuscriptionModalOpen] =
    useState(false);
  const [isPremiumSuscriptionModalOpen, setIsPremiumSuscriptionModalOpen] =
    useState(false);
  const [
    isProfessionalSuscriptionModalOpen,
    setIsProfessionalSuscriptionModalOpen,
  ] = useState(false);
  const [isResponseSuscriptionModalOpen, setIsResponseSuscriptionModalOpen] =
    useState(false);

  const userName = "Usuario";

  return (
    <section
      id="suscripciones"
      className="bg-white-eske min-h-200 py-18 max-sm:py-12 px-4 sm:px-6 md:px-8 dark:bg-[#0B1620]"
      aria-labelledby="subscriptions-heading"
    >
      <div className="w-[90%] mx-auto max-w-7xl">
        <h2
          id="subscriptions-heading"
          className="text-3xl max-sm:text-xl font-bold text-center text-bluegreen-eske mb-6 max-sm:mb-4 dark:text-[#6BA4C6]"
        >
          Selecciona el mejor plan para tu proyecto político
        </h2>

        <p className="mt-12 max-sm:mt-6 text-2xl max-sm:text-lg font-light text-center text-black-eske mb-24 max-sm:mb-12 max-w-150 mx-auto dark:text-[#C7D6E0]">
          <span>Suscríbete y accede al</span>
          <br />
          <span>ecosistema digital de Eskemma</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-sm:gap-6">
          {/* Card 1 — Plan Básico */}
          <article className="bg-white-eske rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-6 max-sm:p-4 text-center relative overflow-visible w-full max-w-87.5 mx-auto flex flex-col dark:bg-[#18324A] dark:border dark:border-white/10 order-2 sm:order-1">
            <div
              className="absolute -top-3.75 left-1/2 transform -translate-x-1/2 bg-white-eske px-6 max-sm:px-4 py-2 max-sm:py-1 border border-bluegreen-eske text-black-eske text-[14px] max-sm:text-xs font-medium z-10 whitespace-nowrap dark:bg-[#21425E] dark:text-[#EAF2F8] dark:border-white/20"
              style={{ boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)" }}
              aria-hidden="true"
            >
              Suite IA Básica
            </div>

            <div className="flex flex-col grow">
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske mt-6 max-sm:mt-4 mb-4 max-sm:mb-3 dark:text-[#6BA4C6]">
                Plan Básico
              </h3>
              <div className="text-left text-[16px] max-sm:text-sm text-black-eske space-y-2 max-sm:space-y-1 grow dark:text-[#C7D6E0]">
                <p className="text-center">Mensual | Para 1 persona</p>
                <p className="mt-4 max-sm:mt-2 text-[16px] text-center max-sm:text-[9px]">
                  <strong>Ideal para candidatos locales y equipos pequeños.</strong>
                </p>
                <p className="mt-4 max-sm:mt-2 text-[16px] max-sm:text-[9px]">
                  <strong>Obtienes:</strong>
                </p>
                <p>Acceso a versiones básicas de cursos online, Sefix y Monitor</p>
                <p>Moddulo con 8 Apps Estándar</p>
                <p>Soporte por email</p>
                <p>Almacenamiento de 5 GB</p>
              </div>

              <div className="flex items-center justify-start mt-6 max-sm:mt-4 mb-6 max-sm:mb-4">
                <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 rounded-full bg-gray-20 flex items-center justify-center mr-4 max-sm:mr-2">
                  <Image
                    src="/icons/mx.webp"
                    alt="México"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <p className="text-[16px] max-sm:text-sm font-bold text-black-eske dark:text-[#C7D6E0]">
                  $ 2,899 MX / mes
                </p>
              </div>

              <div className="mt-auto">
                <Button
                  label="SUSCRIBIRME"
                  variant="primary"
                  onClick={() => setIsBasicSuscriptionModalOpen(true)}
                />
              </div>
            </div>
          </article>

          {/* Card 2 — Plan Premium */}
          <article className="bg-white-eske rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-6 max-sm:p-4 text-center relative overflow-visible w-full max-w-87.5 mx-auto flex flex-col dark:bg-[#18324A] dark:border dark:border-white/10 order-1 sm:order-2">
            <div
              className="absolute -top-3.75 left-1/2 transform -translate-x-1/2 bg-black-eske px-6 max-sm:px-4 py-2 max-sm:py-1 border border-bluegreen-eske text-white-eske text-[14px] max-sm:text-xs font-medium z-10 whitespace-nowrap"
              style={{ boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)" }}
              aria-hidden="true"
            >
              Suite Avanzada con IA
            </div>

            <div className="flex flex-col grow">
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske mt-6 max-sm:mt-4 mb-4 max-sm:mb-3 dark:text-[#6BA4C6]">
                Plan Premium
              </h3>
              <div className="text-left text-[16px] max-sm:text-sm text-black-eske space-y-2 max-sm:space-y-1 grow dark:text-[#C7D6E0]">
                <p className="text-center">Mensual | Hasta 5 personas</p>
                <p className="mt-4 max-sm:mt-2 text-[16px] text-center max-sm:text-[9px]">
                  <strong>Ideal para equipos de 5-15 personas</strong>
                </p>
                <p className="mt-4 max-sm:mt-2 text-[16px] max-sm:text-sm">
                  <strong>Obtienes Plan Básico +</strong>
                </p>
                <p>Acceso a versiones Premium de cursos online, Sefix y Monitor</p>
                <p>Moddulo con 16 Apps Avanzadas</p>
                <p>Soporte por email / chat</p>
                <p>Capacitación grupal online (1 sesión)</p>
                <p>Almacenamiento de 50 GB</p>
              </div>

              <div className="flex items-center justify-start mt-6 max-sm:mt-4 mb-6 max-sm:mb-4">
                <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 rounded-full bg-gray-20 flex items-center justify-center mr-4 max-sm:mr-2">
                  <Image
                    src="/icons/mx.webp"
                    alt="México"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <p className="text-[16px] max-sm:text-sm font-bold text-black-eske dark:text-[#C7D6E0]">
                  $ 5,899 MX / mes
                </p>
              </div>

              <div className="mt-auto">
                <Button
                  label="SUSCRIBIRME"
                  variant="secondary"
                  onClick={() => setIsPremiumSuscriptionModalOpen(true)}
                />
              </div>
            </div>
          </article>

          {/* Card 3 — Plan Profesional */}
          <article className="bg-white-eske rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-6 max-sm:p-4 text-center relative overflow-visible w-full max-w-87.5 mx-auto flex flex-col dark:bg-[#18324A] dark:border dark:border-white/10 order-3 sm:order-3">
            <div
              className="absolute -top-3.75 left-1/2 transform -translate-x-1/2 bg-white-eske px-6 max-sm:px-4 py-2 max-sm:py-1 border border-bluegreen-eske text-black text-[14px] max-sm:text-xs font-medium z-10 whitespace-nowrap dark:bg-[#21425E] dark:text-[#EAF2F8] dark:border-white/20"
              style={{ boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)" }}
              aria-hidden="true"
            >
              Suite Completa con IA
            </div>

            <div className="flex flex-col grow">
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske mt-6 max-sm:mt-4 mb-4 max-sm:mb-3 dark:text-[#6BA4C6]">
                Plan Profesional
              </h3>
              <div className="text-left text-[16px] max-sm:text-sm text-black-eske space-y-2 max-sm:space-y-1 grow dark:text-[#C7D6E0]">
                <p className="text-center">Mensual | Usuarios ilimitados</p>
                <p className="mt-4 max-sm:mt-2 text-center text-[16px] max-sm:text-sm">
                  <strong>Ideal para equipos de 15-50+ personas</strong>
                </p>
                <p className="mt-4 max-sm:mt-2 text-[16px] max-sm:text-sm">
                  <strong>Obtienes Plan Premium +</strong>
                </p>
                <p>Acceso a versiones profesionales de cursos online, Sefix y Monitor</p>
                <p>Moddulo con 25 Apps Avanzadas</p>
                <p>Soporte por teléfono, email y chat</p>
                <p>Capacitación personalizada</p>
                <p>Consultoría estratégica (4 hrs/mes incluidas)</p>
                <p>Almacenamiento ilimitado</p>
              </div>

              <div className="flex items-center justify-start mt-6 max-sm:mt-4 mb-6 max-sm:mb-4">
                <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 rounded-full bg-gray-20 flex items-center justify-center mr-4 max-sm:mr-2">
                  <Image
                    src="/icons/mx.webp"
                    alt="México"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <p className="text-[16px] max-sm:text-sm font-bold text-black-eske dark:text-[#C7D6E0]">
                  $ 9,899 MX / mes
                </p>
              </div>

              <div className="mt-auto">
                <Button
                  label="SUSCRIBIRME"
                  variant="primary"
                  onClick={() => setIsProfessionalSuscriptionModalOpen(true)}
                />
              </div>
            </div>
          </article>
        </div>
      </div>

      <SuscriptionBasicModal
        isOpen={isBasicSuscriptionModalOpen}
        onClose={() => setIsBasicSuscriptionModalOpen(false)}
        onPaymentSuccess={() => {
          setIsBasicSuscriptionModalOpen(false);
          setIsResponseSuscriptionModalOpen(true);
        }}
      />
      <SuscriptionPremiumModal
        isOpen={isPremiumSuscriptionModalOpen}
        onClose={() => setIsPremiumSuscriptionModalOpen(false)}
        onPaymentSuccess={() => {
          setIsPremiumSuscriptionModalOpen(false);
          setIsResponseSuscriptionModalOpen(true);
        }}
      />
      <SuscriptionProfessionalModal
        isOpen={isProfessionalSuscriptionModalOpen}
        onClose={() => setIsProfessionalSuscriptionModalOpen(false)}
        onPaymentSuccess={() => {
          setIsProfessionalSuscriptionModalOpen(false);
          setIsResponseSuscriptionModalOpen(true);
        }}
      />
      <SuscriptionResponseModal
        isOpen={isResponseSuscriptionModalOpen}
        onClose={() => setIsResponseSuscriptionModalOpen(false)}
        userName={userName}
      />
    </section>
  );
}
