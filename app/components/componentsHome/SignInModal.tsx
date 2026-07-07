// app/components/componentsHome/SignInModal.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import { getAuth, fetchSignInMethodsForEmail } from "firebase/auth";
import VerifyEmailModal from "./VerifyEmailModal";
import AcceptTermsModal from "./AcceptTermsModal";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLoginModal: () => void;
}

export default function SignInModal({ isOpen, onClose, onOpenLoginModal }: SignInModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isAcceptTermsModalOpen, setIsAcceptTermsModalOpen] = useState(false);

  const {
    registerUser,
    signInWithGoogle,
    isVerifyEmailModalOpen,
    setIsVerifyEmailModalOpen,
    setIsSignInModalOpen,
  } = useAuth();

  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, onClose);

  const isEmailAlreadyRegistered = async (email: string): Promise<boolean> => {
    const auth = getAuth();
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      return methods.length > 0;
    } catch (error) {
      console.error("Error al verificar el correo:", error);
      return false;
    }
  };

  const validateForm = async () => {
    if (!email.includes("@")) {
      alert("Por favor, ingresa un correo electrónico válido.");
      return false;
    }

    if (password.length < 8) {
      alert("La contraseña debe tener al menos 8 caracteres.");
      return false;
    }

    if (!acceptedTerms) {
      setIsAcceptTermsModalOpen(true);
      return false;
    }

    const isRegistered = await isEmailAlreadyRegistered(email);
    if (isRegistered) {
      alert("Este correo ya está registrado. Intenta iniciar sesión.");
      return false;
    }

    return true;
  };

  const handleRegisterWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(await validateForm())) return;

    try {
      await registerUser(email, password);
      onClose();
    } catch (error: any) {
      console.error("Error al registrar usuario:", error.message);

      if (error.code === "auth/weak-password") {
        alert("La contraseña es demasiado débil. Usa al menos 6 caracteres.");
      } else {
        alert("Error al registrar usuario. Inténtalo de nuevo.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    if (!acceptedTerms) {
      setIsAcceptTermsModalOpen(true);
      return;
    }

    try {
      setIsSignInModalOpen(false);
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Error al registrar con Google:", error.message);
      alert("Error al registrar con Google. Inténtalo de nuevo.");
    }
  };

  const handleLoginClick = () => {
    onClose();
    onOpenLoginModal();
  };

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setPassword("");
      setAcceptedTerms(false);
    }
  }, [isOpen]);

  if (!isOpen && !isVerifyEmailModalOpen) return null;

  return (
    <>
      {/* Modal de Registro */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center px-4 ${isOpen ? "" : "hidden"
          }`}
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
          aria-labelledby="signin-modal-title"
          className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative overflow-y-auto max-h-[80vh] max-sm:max-h-[85vh]"
          style={{ marginTop: "20px" }}
        >
          {/* Botón de Cierre */}
          <button
            className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-black-eske hover:text-red-eske transition-colors duration-300 focus-ring-primary rounded"
            onClick={onClose}
            aria-label="Cerrar modal de registro"
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
          <h2 id="signin-modal-title" className="text-2xl max-sm:text-xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] text-center mb-6 max-sm:mb-4">
            Acceder al ecosistema
          </h2>

          {/* Contenedor con scroll */}
          <div className="max-h-[calc(80vh-120px)] max-sm:max-h-[calc(85vh-120px)] overflow-y-auto">
            {/* Botón de Google */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full bg-red-500 text-white py-2 max-sm:py-1.5 rounded mb-4 max-sm:mb-3 hover:bg-red-600 transition-colors duration-300 focus-ring-primary text-base max-sm:text-sm"
            >
              REGISTRARME CON GOOGLE
            </button>

            {/* Separador */}
            <div className="flex items-center my-4 max-sm:my-3">
              <hr className="flex-grow border-gray-300 dark:border-white/10" />
              <span className="mx-4 max-sm:mx-3 text-gray-500 dark:text-[#9AAEBE] text-sm max-sm:text-xs">🔹</span>
              <hr className="flex-grow border-gray-300 dark:border-white/10" />
            </div>

            <form onSubmit={handleRegisterWithEmail} className="space-y-4 max-sm:space-y-3">
              {/* Correo Electrónico */}
              <div>
                <label htmlFor="register-email" className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  id="register-email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus:outline-none focus:border-blue-eske focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]"
                />
              </div>

              {/* Contraseña */}
              <div>
                <label htmlFor="register-password" className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  id="register-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus:outline-none focus:border-blue-eske focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]"
                />
              </div>

              {/* Checkbox de aceptación de términos */}
              <div className="flex items-start gap-2 mt-4 max-sm:mt-3">
                <input
                  type="checkbox"
                  id="acceptTermsSignIn"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-bluegreen-eske focus-ring-primary"
                  required
                />
                <label htmlFor="acceptTermsSignIn" className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] cursor-pointer">
                  Acepto las{" "}
                  <Link
                    href="/condiciones-de-uso"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    Condiciones de Uso
                    <span className="sr-only"> (se abre en nueva ventana)</span>
                  </Link>
                  {" "}y la{" "}
                  <Link
                    href="/politica-de-privacidad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    Política de Privacidad
                    <span className="sr-only"> (se abre en nueva ventana)</span>
                  </Link>
                </label>
              </div>

              {/* Botón Registrar */}
              <Button
                label="REGISTRARME"
                variant="primary"
                type="submit"
                disabled={!acceptedTerms}
              />

              {/* Separador */}
              <hr className="border-gray-300 dark:border-white/10 my-4 max-sm:my-3" />

              {/* Iniciar Sesión */}
              <p className="text-[16px] max-sm:text-sm text-black-eske dark:text-[#C7D6E0] text-center">
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={handleLoginClick}
                  className="text-bluegreen-eske-60 underline cursor-pointer bg-transparent border-none p-0 hover:text-bluegreen-eske focus-ring-primary rounded"
                >
                  Inicia sesión
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Modal de Verificación de Correo */}
      <VerifyEmailModal
        isOpen={isVerifyEmailModalOpen}
        onClose={() => setIsVerifyEmailModalOpen(false)}
      />

      {/* Modal de Aceptación de Términos */}
      <AcceptTermsModal
        isOpen={isAcceptTermsModalOpen}
        onClose={() => setIsAcceptTermsModalOpen(false)}
      />
    </>
  );
}

