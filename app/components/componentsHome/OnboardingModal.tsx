// app/components/componentsHome/OnboardingModal.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export default function OnboardingModal({
  isOpen,
  onClose,
  userName,
}: {
  isOpen: boolean;
  onClose: (showOnLogin?: boolean) => void;
  userName: string;
}) {
  const [showOnLogin, setShowOnLogin] = useState(true);
  const router = useRouter();

  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, () => onClose(showOnLogin));

  if (!isOpen) return null;

  // Funciones para manejar las acciones de los botones
  const handleExploreResources = () => {
    console.log("Navegando a recursos...");
    onClose(showOnLogin);
    router.push("/recursos");
  };

  const handleScheduleConsultationSefix = () => {
    console.log("Navegando a Sefix...");
    onClose(showOnLogin);
    router.push("/sefix");
  };

  const handleConfigureProfile = () => {
    console.log("Configurando perfil...");
    onClose(showOnLogin);
    router.push("/profile");
  };

  // Manejar el cierre del modal con el botón de cierre
  const handleClose = () => {
    onClose(showOnLogin);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-modal-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative"
      >
        {/* Botón de Cierre */}
        <button
          onClick={handleClose}
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-black-eske hover:text-red-eske transition-colors duration-300 focus-ring-primary rounded"
          aria-label="Cerrar modal de bienvenida"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 max-sm:h-5 max-sm:w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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

        {/* Título Personalizado */}
        <h2 id="onboarding-modal-title" className="text-2xl max-sm:text-xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] text-center mb-6 max-sm:mb-4">
          Hola, {userName}
        </h2>

        {/* Mensaje de Introducción */}
        <p className="text-[18px] max-sm:text-base text-black-eske dark:text-[#C7D6E0] text-center mb-6 max-sm:mb-4">
          Te damos la bienvenida a{" "}<br></br>
          <span className="text-blue-eske font-bold">Eskemma</span> <br></br>{" "}
          <span className="text-center text-[13px] max-sm:text-xs text-bluegreen-eske dark:text-[#6BA4C6] font-semibold">
            Este es tu ecosistema político.
          </span>
        </p>

        <p className="text-[16px] max-sm:text-sm text-black-eske dark:text-[#C7D6E0] text-center mb-6 max-sm:mb-4">
          Por dónde quieres empezar:
        </p>

        {/* Botones de Acción */}
        <div className="space-y-4 max-sm:space-y-3">
          <Button
            label="EXPLORAR RECURSOS"
            variant="primary"
            onClick={handleExploreResources}
          />
          <Button
            label="VER DATOS ELECTORALES EN SEFIX"
            variant="primary"
            onClick={handleScheduleConsultationSefix}
          />
          <Button
            label="CONFIGURAR PERFIL"
            variant="primary"
            onClick={handleConfigureProfile}
          />
        </div>

        {/* Casilla de Verificación con descripción mejorada */}
        <div className="mt-4 max-sm:mt-3 flex items-center justify-center">
          <input
            type="checkbox"
            id="showOnLogin"
            checked={showOnLogin}
            onChange={(e) => setShowOnLogin(e.target.checked)}
            className="mr-2 w-4 h-4 focus-ring-primary"
            aria-describedby="show-onboarding-description"
          />
          <label htmlFor="showOnLogin" className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] cursor-pointer">
            Mostrar esto cada vez que inicio sesión.
          </label>
        </div>
        <p id="show-onboarding-description" className="sr-only">
          Si está marcado, este mensaje de bienvenida se mostrará cada vez que inicies sesión
        </p>
      </div>
    </div>
  );
}

