// app/components/componentsHome/CompleteRegisterModal.tsx
"use client";
import { useAuth } from "../../../context/AuthContext";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export default function CompleteRegisterModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { isCompleteRegisterModalOpen, setIsRegisterModalOpen } = useAuth();

  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen || isCompleteRegisterModalOpen);
  useEscapeKey(isOpen || isCompleteRegisterModalOpen, onClose);

  // Usar tanto la prop isOpen como el estado del contexto
  if (!isOpen && !isCompleteRegisterModalOpen) return null;

  const handleContinue = () => {
    setIsRegisterModalOpen(true); // Abrir el modal RegisterModal
    onClose(); // Cerrar el modal CompleteRegisterModal
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-register-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative"
      >
        {/* Botón de Cierre */}
        <button
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-black-eske dark:text-[#9AAEBE] hover:text-red-eske transition-colors duration-300 focus-ring-primary rounded"
          onClick={onClose}
          aria-label="Cerrar modal"
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
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Título */}
        <h2 id="complete-register-title" className="text-2xl max-sm:text-xl font-bold text-bluegreen-eske text-center mb-6 max-sm:mb-4">
          Listo
        </h2>

        {/* Mensaje */}
        <p className="text-[18px] max-sm:text-base text-black-eske dark:text-[#C7D6E0] text-center mb-6 max-sm:mb-4">
          Ya estás dentro
        </p>
        <p className="text-[18px] max-sm:text-base text-black-eske dark:text-[#C7D6E0] text-center mb-6 max-sm:mb-4">
          Solo necesitamos un poco más de información para personalizar tu experiencia.
        </p>

        {/* Botón Continuar */}
        <Button
          label="CONTINUAR"
          variant="primary"
          onClick={handleContinue}
        />
      </div>
    </div>
  );
}
