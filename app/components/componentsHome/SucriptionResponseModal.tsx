//app/components/componentsHome/SuscriptionResponseModal.tsx

import Link from "next/link";
import { useState } from "react";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface SuscriptionResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export default function SuscriptionResponseModal({
  isOpen,
  onClose,
  userName,
}: SuscriptionResponseModalProps) {
  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-response-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative overflow-y-auto max-h-[80vh] max-sm:max-h-[85vh]"
        style={{ marginTop: "20px" }}
      >
        {/* Botón de Cierre */}
        <button
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-black-eske-40 dark:text-[#9AAEBE] hover:text-red-eske transition-colors duration-300 focus-ring-primary rounded"
          onClick={onClose}
          aria-label="Cerrar confirmación de suscripción"
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

        {/* Contenido del Modal */}
        <div className="space-y-6 max-sm:space-y-4 text-center">
          {/* Espacio para el logotipo */}
          <div className="flex justify-center mb-4 max-sm:mb-3">
            <img
              src="/images/esk_log_csm.svg"
              alt="Eskemma - Logotipo"
              className="w-60 max-sm:w-48 h-24 max-sm:h-20 object-contain"
            />
          </div>

          {/* Saludo personalizado */}
          <p id="subscription-response-title" className="text-xl max-sm:text-lg font-bold text-bluegreen-eske">
            Hola, {userName}
          </p>

          {/* Mensaje de felicitaciones */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            ¡Felicidades por suscribirte a Eskemma!
          </p>

          {/* Mensaje destacado */}
          <p className="text-[16px] max-sm:text-sm font-bold text-black-eske dark:text-[#EAF2F8]">
            Ahora cuentas con el respaldo de profesionales para tu proyecto político.
          </p>

          {/* Información sobre el correo */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            Hemos enviado un email a tu cuenta de correo con la información de tu compra y las indicaciones para la facturación.
          </p>

          {/* Contacto */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            Para cualquier información sobre tu compra contacta con nosotros al correo:{" "}
            <a 
              href="mailto:clientes@eskemma.com"
              className="font-bold text-bluegreen-eske focus-ring-primary rounded"
            >
              clientes@eskemma.com
            </a>
          </p>

          {/* Invitación a explorar recursos */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            Te invitamos a iniciar explorando los materiales disponibles para tu proyecto en la{" "}
            <Link
              href="/recursos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-eske-60 underline focus-ring-primary rounded"
            >
              sección de recursos
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </Link>
            .
          </p>

          {/* Agradecimiento final */}
          <p className="text-[16px] max-sm:text-sm font-bold text-black-eske dark:text-[#EAF2F8]">
            Agradecemos tu confianza.
          </p>

          {/* Botón CERRAR */}
          <Button
            label="CERRAR"
            variant="primary"
            onClick={onClose}
          />

          {/* Línea horizontal */}
          <hr className="border-gray-eske-40 my-4 max-sm:my-3" />

          {/* Links adicionales */}
          <p className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0]">
            Consultar{" "}
            <Link
              href="/terminos-y-condiciones-uso"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-eske-60 underline focus-ring-primary rounded"
            >
              términos y condiciones de uso
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </Link>{" "}
            y{" "}
            <Link
              href="/politica-de-privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-eske-60 underline focus-ring-primary rounded"
            >
              política de privacidad
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </Link>{" "}
            de Eskemma.
          </p>
        </div>
      </div>
    </div>
  );
}

