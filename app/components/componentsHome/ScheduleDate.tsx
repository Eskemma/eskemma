// app/components/componentsHome/ScheduleDate.tsx
"use client";
import { useState } from "react";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

type Errors = {
  [key: string]: string | undefined;
};

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  topic: string;
  dateTime: string;
  file?: File | null;
}

interface ScheduleDateProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (data: { fullName: string; email: string; dateTime: string }) => void;
}

export default function ScheduleDate({ isOpen, onClose, onSubmitSuccess }: ScheduleDateProps) {
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    topic: "",
    dateTime: "",
    file: null,
  });
  const [errors, setErrors] = useState<Errors>({});

  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, onClose);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (errors[name]) {
      setErrors({ ...errors, [name]: undefined });
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFormData((prev) => ({ ...prev, file }));
  };

  const validateForm = () => {
    const newErrors: Errors = {};
    if (!formData.fullName.trim()) {
      newErrors.fullName = "El nombre completo es requerido.";
    }
    if (!formData.email.trim()) {
      newErrors.email = "El correo electrónico es requerido.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Introduce un correo electrónico válido.";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "El teléfono de contacto es requerido.";
    } else if (!/^\+?[0-9]{7,15}$/.test(formData.phone)) {
      newErrors.phone =
        "Introduce un número de teléfono válido (mínimo 7 dígitos).";
    }
    if (!formData.topic.trim()) {
      newErrors.topic = "El tema de interés es requerido.";
    }
    if (!formData.dateTime.trim()) {
      newErrors.dateTime = "La fecha y hora son requeridas.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      console.log("Datos del formulario:", formData);
      onSubmitSuccess({
        fullName: formData.fullName,
        email: formData.email,
        dateTime: formData.dateTime,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

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
        aria-labelledby="schedule-date-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative overflow-y-auto max-h-[85vh] max-sm:max-h-[90vh]"
        style={{ marginTop: "20px" }}
      >
        {/* Botón de Cierre */}
        <button
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-gray-700 dark:text-[#6D8294] hover:text-red-eske dark:hover:text-[#C7D6E0] transition-colors duration-300 focus-ring-primary rounded"
          onClick={onClose}
          aria-label="Cerrar formulario de agendamiento"
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
        <h2 id="schedule-date-title" className="text-[24px] max-sm:text-xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] text-center mb-6 max-sm:mb-4">
          Agendar sesión de diagnóstico
        </h2>
        {/* Descripción */}
        <p className="text-[16px] max-sm:text-sm text-gray-700 dark:text-[#C7D6E0] font-semibold text-center mb-4 max-sm:mb-3">
          Sesión de diagnóstico gratuita de 30 minutos en línea.
        </p>
        <p className="text-[16px] max-sm:text-sm text-gray-700 dark:text-[#C7D6E0] text-center mb-6 max-sm:mb-4">
          Para agendar, favor de llenar el siguiente formulario:
        </p>
        {/* Contenedor con scroll */}
        <div className="max-h-[calc(85vh-120px)] max-sm:max-h-[calc(90vh-120px)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4 max-sm:space-y-3">
            {/* Nombre completo */}
            <div>
              <label
                className="block text-left text-[16px] max-sm:text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
                htmlFor="schedule-fullName"
              >
                Nombre completo
              </label>
              <input
                type="text"
                id="schedule-fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? "fullName-error" : undefined}
                className={`w-full px-3 py-2 max-sm:py-1.5 border ${
                  errors.fullName ? "border-red-60" : "border-gray-300 dark:border-white/10"
                } rounded focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              />
              {errors.fullName && (
                <p id="fullName-error" className="text-[8px] max-sm:text-[7px] text-red-60 mt-1" role="alert">{errors.fullName}</p>
              )}
            </div>
            {/* Email */}
            <div>
              <label
                className="block text-left text-[16px] max-sm:text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
                htmlFor="schedule-email"
              >
                Email
              </label>
              <input
                type="email"
                id="schedule-email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={`w-full px-3 py-2 max-sm:py-1.5 border ${
                  errors.email ? "border-red-60" : "border-gray-300 dark:border-white/10"
                } rounded focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              />
              {errors.email && (
                <p id="email-error" className="text-[8px] max-sm:text-[7px] text-red-60 mt-1" role="alert">{errors.email}</p>
              )}
            </div>
            {/* Teléfono de contacto */}
            <div>
              <label
                className="block text-left text-[16px] max-sm:text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
                htmlFor="schedule-phone"
              >
                Teléfono de contacto
              </label>
              <input
                type="tel"
                id="schedule-phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                pattern="^\+?[0-9]{7,15}$"
                title="Introduce un número de teléfono válido (mínimo 7 dígitos)."
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                className={`w-full px-3 py-2 max-sm:py-1.5 border ${
                  errors.phone ? "border-red-60" : "border-gray-300 dark:border-white/10"
                } rounded focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              />
              {errors.phone && (
                <p id="phone-error" className="text-[8px] max-sm:text-[7px] text-red-60 mt-1" role="alert">{errors.phone}</p>
              )}
            </div>
            {/* Tema de interés */}
            <div>
              <label
                className="block text-left text-[16px] max-sm:text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
                htmlFor="schedule-topic"
              >
                Tema de interés
              </label>
              <textarea
                id="schedule-topic"
                name="topic"
                value={formData.topic}
                onChange={handleChange}
                rows={4}
                required
                aria-invalid={!!errors.topic}
                aria-describedby={errors.topic ? "topic-error" : undefined}
                className={`w-full px-3 py-2 max-sm:py-1.5 border ${
                  errors.topic ? "border-red-60" : "border-gray-300 dark:border-white/10"
                } rounded focus-ring-primary resize-none text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              />
              {errors.topic && (
                <p id="topic-error" className="text-[8px] max-sm:text-[7px] text-red-60 mt-1" role="alert">{errors.topic}</p>
              )}
            </div>
            {/* Fecha y hora */}
            <div>
              <label
                className="block text-left text-[16px] max-sm:text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
                htmlFor="schedule-dateTime"
              >
                Seleccionar fecha y hora
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="datetime-local"
                  id="schedule-dateTime"
                  name="dateTime"
                  value={formData.dateTime}
                  onChange={handleChange}
                  required
                  aria-invalid={!!errors.dateTime}
                  aria-describedby={errors.dateTime ? "dateTime-error" : undefined}
                  className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8]"
                />
              </div>
              {errors.dateTime && (
                <p id="dateTime-error" className="text-[8px] max-sm:text-[7px] text-red-60 mt-1" role="alert">{errors.dateTime}</p>
              )}
            </div>
            {/* Adjuntar documento (opcional) */}
            <div>
              <label
                className="block text-left text-[16px] max-sm:text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
                htmlFor="schedule-file"
              >
                Adjuntar documento (opcional)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  id="schedule-file"
                  name="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="schedule-file"
                  className="flex items-center space-x-2 cursor-pointer bg-gray-100 dark:bg-[#112230] px-3 py-2 max-sm:py-1.5 rounded border border-gray-300 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-[#18324A] transition-colors duration-300 focus-ring-primary"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      document.getElementById('schedule-file')?.click();
                    }
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 max-sm:h-4 max-sm:w-4 text-gray-700 dark:text-[#C7D6E0]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L19 15"
                    />
                  </svg>
                  <span className="text-[10px] max-sm:text-[9px] text-gray-700 dark:text-[#C7D6E0]">
                    {formData.file ? formData.file.name : "Seleccionar archivo"}
                  </span>
                </label>
              </div>
            </div>
            {/* Botón AGENDAR */}
            <Button
              label="AGENDAR"
              variant="primary"
              type="submit"
            />
            {/* Términos y condiciones */}
            <p className="text-[14px] max-sm:text-xs text-gray-700 text-center mt-4 max-sm:mt-3">
              Consultar{" "}
              <a
                href="/condiciones-sesiones-diagnostico-gratuitas"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-eske underline focus-ring-primary rounded"
              >
                Condiciones de Uso para las Sesiones de Diagnóstico Gratuitas
                <span className="sr-only"> (se abre en nueva ventana)</span>
              </a>
              .
            </p>
            {/* Condiciones de uso y política de privacidad */}
            <p className="text-[14px] max-sm:text-xs text-gray-700 text-center mt-2 max-sm:mt-1.5">
              Al agendar la cita acepto las{" "}
              <a
                href="/condiciones-de-uso"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-eske underline focus-ring-primary rounded"
              >
                condiciones de uso
                <span className="sr-only"> (se abre en nueva ventana)</span>
              </a>{" "}
              y{" "}
              <a
                href="/politica-de-privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-eske underline focus-ring-primary rounded"
              >
                política de privacidad
                <span className="sr-only"> (se abre en nueva ventana)</span>
              </a>{" "}
              de Eskemma.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

