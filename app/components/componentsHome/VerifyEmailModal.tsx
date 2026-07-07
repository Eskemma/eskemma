// app/components/VerifyEmailModal.tsx
"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export default function VerifyEmailModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    user,
    isVerifyEmailModalOpen,
    setIsVerifyEmailModalOpen,
    setIsCompleteRegisterModalOpen
  } = useAuth();
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen || isVerifyEmailModalOpen);
  useEscapeKey(isOpen || isVerifyEmailModalOpen, onClose);

  // Función para actualizar emailVerified en Firestore
  const updateEmailVerifiedInFirestore = async (uid: string) => {
    try {
      const userDocRef = doc(db, "users", uid);
      await updateDoc(userDocRef, {
        emailVerified: true,
        updatedAt: new Date(),
      });
      console.log("Campo emailVerified actualizado en Firestore.");
    } catch (error) {
      console.error("Error al actualizar emailVerified en Firestore:", error);
    }
  };

  // Polling para verificar si el correo fue verificado
  useEffect(() => {
    if (!isOpen && !isVerifyEmailModalOpen) return;

    const checkEmailVerification = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        await currentUser.reload();

        if (currentUser.emailVerified) {
          await updateEmailVerifiedInFirestore(currentUser.uid);
          setIsVerifyEmailModalOpen(false);
          onClose();
          setIsCompleteRegisterModalOpen(true);
        }
      } catch (error) {
        console.error("Error al verificar el estado del correo:", error);
      }
    };

    const intervalId = setInterval(checkEmailVerification, 3000);
    return () => clearInterval(intervalId);
  }, [isOpen, isVerifyEmailModalOpen, onClose, setIsVerifyEmailModalOpen, setIsCompleteRegisterModalOpen]);

  // Función para verificar manualmente
  const handleCheckVerification = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("No se pudo encontrar tu cuenta. Intenta iniciar sesión nuevamente.");
      return;
    }

    try {
      setIsCheckingVerification(true);
      await currentUser.reload();

      if (currentUser.emailVerified) {
        await updateEmailVerifiedInFirestore(currentUser.uid);
        setIsVerifyEmailModalOpen(false);
        onClose();
        setIsCompleteRegisterModalOpen(true);
      } else {
        alert("Aún no hemos detectado la verificación. Por favor, revisa tu correo y haz clic en el enlace.");
      }
    } catch (error) {
      console.error("Error al verificar el correo:", error);
      alert("Error al verificar. Intenta de nuevo.");
    } finally {
      setIsCheckingVerification(false);
    }
  };

  // Función para reenviar el correo de verificación
  const handleResendVerificationEmail = async () => {
    if (!user || !user.email) {
      alert("No se pudo encontrar tu cuenta. Intenta iniciar sesión nuevamente.");
      onClose();
      return;
    }

    try {
      setIsResendingEmail(true);
      await sendEmailVerification(user);
      alert("Correo de verificación reenviado. Por favor, revisa tu bandeja de entrada.");
    } catch (error: any) {
      console.error("Error al reenviar el correo de verificación:", error.message);

      if (error.code === "auth/too-many-requests") {
        alert("Demasiados intentos recientes. Inténtalo de nuevo más tarde.");
      } else {
        alert("Error al reenviar el correo de verificación. Inténtalo de nuevo.");
      }
    } finally {
      setIsResendingEmail(false);
    }
  };

  if (!isOpen && !isVerifyEmailModalOpen) return null;

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
        aria-labelledby="verify-email-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative"
      >
        {/* Botón de Cierre */}
        <button
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-black-eske dark:text-[#9AAEBE] hover:text-red-eske transition-colors duration-300 focus-ring-primary rounded"
          onClick={onClose}
          aria-label="Cerrar modal de verificación de email"
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
        <h2 id="verify-email-title" className="text-2xl max-sm:text-xl font-bold text-bluegreen-eske text-center mb-6 max-sm:mb-4">
          Revisa tu bandeja de entrada
        </h2>

        {/* Mensaje */}
        <p className="text-[18px] max-sm:text-base text-black-eske dark:text-[#C7D6E0] text-center mb-6 max-sm:mb-4">
          Te enviamos un enlace de confirmación a tu dirección de correo.
        </p>
        <p className="text-[16px] max-sm:text-sm text-black-eske dark:text-[#C7D6E0] text-center mb-6 max-sm:mb-4">
          Abre el enlace de confirmación para continuar. (Si no lo encuentras en los próximos minutos, revisa la carpeta de spam.)
        </p>

        {/* Indicador de verificación automática */}
        <div
          className="bg-blue-100 dark:bg-blue-900/20 border-l-4 border-blue-eske p-3 max-sm:p-2 mb-4 max-sm:mb-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm max-sm:text-xs text-blue-800 dark:text-blue-300">
            <span role="img" aria-label="Cargando">🔄</span> Verificando automáticamente cada 3 segundos...
          </p>
        </div>

        {/* Botón para verificar manualmente */}
        <Button
          label={isCheckingVerification ? "VERIFICANDO..." : "YA VERIFIQUÉ MI CORREO"}
          variant="primary"
          onClick={handleCheckVerification}
          disabled={isCheckingVerification}
          className="mb-3 max-sm:mb-2"
        />

        {/* Botón para Reenviar Correo */}
        <Button
          label={isResendingEmail ? "REENVIANDO..." : "REENVIAR CORREO"}
          variant="secondary"
          onClick={handleResendVerificationEmail}
          disabled={isResendingEmail}
          className="mb-3 max-sm:mb-2"
        />

        {/* Botón Cerrar - Mantener gris */}
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-gray-300 dark:bg-[#21425E] text-black-eske dark:text-[#C7D6E0] py-2 max-sm:py-1.5 rounded hover:bg-gray-400 dark:hover:bg-[#2C5273] transition-colors duration-300 focus-ring-primary text-base max-sm:text-sm"
        >
          CERRAR
        </button>
      </div>
    </div>
  );
}

