// app/components/componentsHome/ResponseDate.tsx
'use client';
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface ResponseDateProps {
  isOpen: boolean;
  onClose: () => void;
  fullName: string;
  email: string;
  dateTime: string;
}

export default function ResponseDate({
  isOpen,
  onClose,
  fullName,
  email,
  dateTime,
}: ResponseDateProps) {
  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="response-date-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative overflow-y-auto max-h-[80vh] max-sm:max-h-[85vh]"
        style={{ marginTop: '20px' }}
      >
        {/* Botón de Cierre */}
        <button
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-black-eske hover:text-red-eske transition-colors duration-300 focus-ring-primary rounded"
          onClick={onClose}
          aria-label="Cerrar confirmación de sesión de diagnóstico"
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
        <div className="space-y-6 max-sm:space-y-4 text-left">
          {/* Saludo personalizado */}
          <h2 id="response-date-title" className="mt-10 max-sm:mt-8 text-[24px] max-sm:text-xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] text-left mb-6 max-sm:mb-4">
            Hola, {fullName}:
          </h2>
          {/* Mensaje de agradecimiento */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            Gracias por agendar tu sesión de diagnóstico gratuita.
          </p>
          {/* Detalles de la cita */}
          <div>
            <p className="text-[16px] max-sm:text-sm font-bold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1.5">
              Fecha y hora agendadas:
            </p>
            <p className="text-[14px] max-sm:text-xs font-normal text-black-eske dark:text-[#C7D6E0]">{dateTime}</p>
          </div>
          {/* Confirmación de correo */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            <span className="font-bold text-[10px] max-sm:text-[9px] text-bluegreen-eske dark:text-[#6BA4C6]">
              Importante:
            </span>{' '}
            Hemos enviado un email de confirmación a tu cuenta de correo:{' '}
            <span className="font-bold">{email}</span>. En ese email hay
            indicaciones importantes para concluir la agenda de la sesión
            de diagnóstico.
          </p>
          {/* Información del asesor */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            Para cualquier información sobre la reunión, favor de dirigirte con
            el asesor asignado para tu sesión de 30 minutos:
          </p>
          <div className="flex space-x-6 max-sm:space-x-4">
            {/* Avatar del asesor */}
            <div className="mt-4 max-sm:mt-3 w-12 h-12 max-sm:w-10 max-sm:h-10 rounded-full bg-gray-200 dark:bg-[#112230] flex-shrink-0 overflow-hidden">
              <img
                src="images/rss_px.jpg"
                alt="Raúl Sánchez Salgado, asesor"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Datos del asesor */}
            <div className="space-y-1 max-sm:space-y-0.5">
              <p className="text-[10px] max-sm:text-[9px] font-bold text-black-eske dark:text-[#C7D6E0]">Asesor:</p>
              <p className="text-[10px] max-sm:text-[9px] font-normal text-black-eske dark:text-[#C7D6E0]">
                Raúl Sánchez Salgado
              </p>
              <p className="text-[10px] max-sm:text-[9px] font-normal text-black-eske dark:text-[#C7D6E0]">
                <a 
                  href="mailto:raul.sanchezs@eskemma.com"
                  className="text-blue-eske underline focus-ring-primary rounded"
                >
                  raul.sanchezs@eskemma.com
                </a>
              </p>
            </div>
          </div>
          {/* Instrucciones previas a la reunión */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            El día y hora acordados, favor de conectarte 5 minutos antes de la
            hora agendada.
          </p>
          {/* Enlaces con íconos */}
          <div className="space-y-2 max-sm:space-y-1.5">
            {/* Enviar documentación */}
            <div className="flex items-center space-x-2">
              <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
                Si deseas enviar con anterioridad algún documento que consideres
                útil para la sesión de diagnóstico, favor de hacer clic{' '}
                <a href="#" className="text-blue-eske underline focus-ring-primary rounded">
                  aquí (enviar documento)
                </a>
                .
              </p>
            </div>
            {/* Cancelar asesoría */}
            <div className="mt-6 max-sm:mt-4 flex items-center space-x-2">
              <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
                Si deseas cancelar la sesión de diagnóstico, haz clic{' '}
                <a href="#" className="text-blue-eske underline focus-ring-primary rounded">
                  aquí (cancelar sesión)
                </a>
                .
              </p>
            </div>
          </div>
          {/* Agradecimiento final */}
          <p className="text-[16px] max-sm:text-sm font-normal text-black-eske dark:text-[#C7D6E0]">
            Nuevamente, agradecemos tu interés.
          </p>
          {/* Botón CERRAR */}
          <Button
            label="CERRAR"
            variant="primary"
            onClick={onClose}
          />
          {/* Línea horizontal */}
          <hr className="border-gray-300 dark:border-white/10 my-4 max-sm:my-3" />
          {/* Links adicionales */}
          <p className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] text-center">
            Consultar{' '}
            <a 
              href="/terminos-y-condiciones" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-eske underline focus-ring-primary rounded"
            >
              términos y condiciones de las sesiones de diagnóstico
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </a>
            .
          </p>
          <p className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] text-center">
            Al agendar la cita acepto las{' '}
            <a 
              href="/condiciones-de-uso" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-eske underline focus-ring-primary rounded"
            >
              condiciones de uso
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </a>{' '}
            y{' '}
            <a 
              href="/politica-de-privacidad" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-eske underline focus-ring-primary rounded"
            >
              política de privacidad
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </a>{' '}
            de Eskemma.
          </p>
        </div>
      </div>
    </div>
  );
}

