//app/components/componentsHome/SuscriptionGrupalModal.tsx

 import Link from "next/link";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface SuscriptionProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export default function SuscriptionGrupalModal({
  isOpen,
  onClose,
  onPaymentSuccess,
}: SuscriptionProfessionalModalProps) {
  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center px-4"
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
        aria-labelledby="subscription-grupal-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative overflow-y-auto max-h-[85vh] max-sm:max-h-[90vh]"
        style={{ marginTop: "20px" }}
      >
        {/* Botón de Cierre */}
        <button
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-gray-700 dark:text-[#6D8294] hover:text-red-eske dark:hover:text-[#C7D6E0] transition-colors duration-300 focus-ring-primary rounded"
          onClick={onClose}
          aria-label="Cerrar modal de suscripción grupal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 max-sm:h-5 max-sm:w-5"
            fill="blue-eske"
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

        <div className="space-y-6 max-sm:space-y-4 text-left">
          {/* Título del Modal */}
          <h2 id="subscription-grupal-title" className="text-3xl max-sm:text-2xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] text-center">
            Suscripción
          </h2>

          {/* Imagen */}
          <div className="flex justify-center">
            <img
              src="https://plus.unsplash.com/premium_photo-1683120730432-b5ea74bd9047?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt="Plan Grupal - Equipo trabajando en colaboración"
              className="w-150 max-sm:w-full h-70 max-sm:h-auto object-cover rounded"
            />
          </div>

          {/* Nombre del Plan */}
          <p className="text-2xl max-sm:text-xl font-semibold text-bluegreen-eske dark:text-[#6BA4C6]">
            Plan Profesional
          </p>

          {/* Precio */}
          <p className="text-[16px] max-sm:text-sm font-bold text-black-eske dark:text-[#C7D6E0]">
            $9,899 (MX) / mes
          </p>

          {/* Descripción */}
          <div className="space-y-2 max-sm:space-y-1.5">
            <p className="text-[16px] max-sm:text-sm font-normal text-black-eske">
              Tu suscripción mensual incluye:
            </p>
            <ul className="list-disc pl-6 max-sm:pl-5 text-10px max-sm:text-[9px] text-gray-700 space-y-1 max-sm:space-y-0.5">
              <li>Todo Plan Premium</li>
              <li>Versión Profesional de Cursos online, Sefix y Centinela</li>
              <li>Acceso a 25 apps avanzadas con IA de Moddulo</li>
              <li>Soporte 24/7 por teléfono, email y chat</li>
              <li>Capacitación personalizada</li>
              <li>Consultoría estratégica (4 hrs/mes)</li>
              <li>Almacenamiento ilimitado</li>
              <li>Acceso total a eBooks y plantillas</li>
            </ul>
          </div>

          {/* Método de pago */}
          <p className="text-[16px] max-sm:text-sm font-semibold text-bluegreen-eske">
            Método de pago
          </p>
          <div className="flex items-center justify-between">
            {/* Ícono de tarjeta de crédito y texto */}
            <div className="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 max-sm:h-5 max-sm:w-5 text-gray-700 dark:text-[#C7D6E0]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <p className="text-[16px] max-sm:text-sm font-normal text-black-eske">
                **** **** **** 1234
              </p>
            </div>
            {/* Botón CAMBIAR - Mantener personalizado */}
            <button
              type="button"
              className="text-10px max-sm:text-[9px] font-medium text-gray-700 px-4 max-sm:px-3 py-2 max-sm:py-1.5 border border-gray-90 rounded hover:bg-blue-eske hover:text-white-eske cursor-pointer transition-colors duration-300 focus-ring-primary"
              aria-label="Cambiar método de pago"
            >
              CAMBIAR
            </button>
          </div>

          {/* Botón PAGAR */}
          <Button
            label="PAGAR $9,899.ºº"
            variant="primary"
            onClick={onPaymentSuccess}
          />

          {/* Línea horizontal */}
          <hr className="border-gray-300 my-4 max-sm:my-3" />

          {/* Links adicionales */}
          <p className="text-[14px] max-sm:text-xs text-black-eske text-center">
            Consultar{" "}
            <Link
              href="/terminos-y-condiciones-suscripciones"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-eske underline focus-ring-primary rounded"
            >
              términos y condiciones de suscripciones
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </Link>
          </p>
          <p className="text-[14px] max-sm:text-xs text-black-eske text-center">
            Acepto las{" "}
            <Link
              href="/condiciones-de-uso"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-eske-60 underline focus-ring-primary rounded"
            >
              condiciones de uso
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

