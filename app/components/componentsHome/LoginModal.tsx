// app/components/componentsHome/LoginModal.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface LoginFormData {
  username: string;
  password: string;
}

export default function LoginModal({
  isOpen,
  onClose,
  onOpenRegisterModal,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegisterModal: () => void;
}) {
  const { loginUser, signInWithGoogle, setIsLoginModalOpen } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setFormData({ username: "", password: "" });
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.username.trim()) {
        throw new Error("El nombre de usuario o correo es obligatorio.");
      }

      await loginUser(formData.username, formData.password);
      onClose();
    } catch (error: any) {
      console.error("Error al iniciar sesión:", error.message);

      if (error.message.includes("registrado con Google") ||
        error.message.includes("contraseña configurada")) {
        setError(
          "Este usuario se registró con Google. Por favor, usa el botón de 'Iniciar sesión con Google' a continuación."
        );
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError(null);

    signInWithGoogle()
      .then(() => {
        onClose();
      })
      .catch((error: any) => {
        console.error("Error al iniciar sesión con Google:", error.message);
        setError(
          "Ocurrió un error al iniciar sesión con Google. Inténtalo de nuevo."
        );
      });
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
        aria-labelledby="login-modal-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative overflow-y-auto max-h-[80vh] max-sm:max-h-[85vh]"
      >
        {/* Botón de Cierre */}
        <button
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-black-eske hover:text-red-eske transition-colors duration-300 focus-ring-primary rounded"
          onClick={() => {
            onClose();
            setError(null);
            setFormData({ username: "", password: "" });
          }}
          aria-label="Cerrar modal de inicio de sesión"
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
        <h2 id="login-modal-title" className="text-2xl max-sm:text-xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] text-center mb-6 max-sm:mb-4">
          Iniciar sesión
        </h2>

        {/* Formulario de inicio de sesión */}
        <form onSubmit={handleSubmit} className="space-y-4 max-sm:space-y-3">
          <div>
            <label htmlFor="login-username" className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1">
              Correo electrónico o nombre de usuario
            </label>
            <input
              type="text"
              id="login-username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="---"
              className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus:outline-none focus:border-blue-eske focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1">
              Contraseña
            </label>
            <input
              type="password"
              id="login-password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Contraseña"
              className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus:outline-none focus:border-blue-eske focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]"
            />
          </div>

          {/* Mensaje de error con role="alert" */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="text-red-500 text-sm max-sm:text-xs p-3 max-sm:p-2 bg-red-50 border border-red-200 rounded"
            >
              <p>{error}</p>
            </div>
          )}

          {/* Botón de inicio de sesión */}
          <Button
            label={loading ? "CARGANDO..." : "INICIAR SESIÓN"}
            variant="primary"
            disabled={loading}
            type="submit"
          />
        </form>

        {/* Separador */}
        <div className="flex items-center my-4 max-sm:my-3">
          <hr className="flex-grow border-gray-300 dark:border-white/10" />
          <span className="mx-4 max-sm:mx-3 text-gray-500 dark:text-[#9AAEBE] text-sm max-sm:text-xs">🔹</span>
          <hr className="flex-grow border-gray-300 dark:border-white/10" />
        </div>

        {/* Mensaje informativo */}
        <p className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] text-center mb-3 max-sm:mb-2 px-2 max-sm:px-1">
          <span className="font-medium text-bluegreen-eske dark:text-[#6BA4C6]">
            O continua con Google
          </span>
        </p>

        {/* Botón de inicio de sesión con Google */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full text-[16px] max-sm:text-sm bg-red-500 text-white py-2 max-sm:py-1.5 rounded-lg font-medium hover:bg-red-600 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring-primary"
        >
          INICIAR SESIÓN CON GOOGLE
        </button>

        {/* Enlaces adicionales */}
        <p className="text-[14px] max-sm:text-xs mt-4 max-sm:mt-3 text-black-eske dark:text-[#C7D6E0] text-center">
          Al iniciar sesión acepto las{" "}
          <Link
            href="/condiciones-de-uso"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
          >
            condiciones de uso
            <span className="sr-only"> (se abre en nueva ventana)</span>
          </Link>{" "}
          y{" "}
          <Link
            href="/politica-de-privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
          >
            política de privacidad
            <span className="sr-only"> (se abre en nueva ventana)</span>
          </Link>{" "}
          de Eskemma.
        </p>

        {/* Enlace para registrarse */}
        <hr className="border-gray-300 dark:border-white/10 my-4 max-sm:my-3" />

        <p className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] text-center">
          ¿Aún no tienes cuenta?{" "}
          <button
            type="button"
            className="text-bluegreen-eske underline cursor-pointer hover:text-bluegreen-eske-70 bg-transparent border-none p-0 focus-ring-primary rounded"
            onClick={() => {
              onClose();
              onOpenRegisterModal();
              setError(null);
              setFormData({ username: "", password: "" });
            }}
          >
            Registrarme
          </button>
        </p>

        {/* Enlace para recuperar contraseña */}
        <p className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] text-center mt-2 max-sm:mt-1.5">
          ¿No recuerdas tu contraseña?{" "}
          <button
            onClick={() => {
              onClose();
              window.location.href = "/recover-password";
            }}
            className="text-bluegreen-eske underline cursor-pointer hover:text-bluegreen-eske-70 bg-transparent border-none p-0 focus-ring-primary rounded"
          >
            Recuperar contraseña
          </button>
        </p>
      </div>
    </div>
  );
}
