"use client";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function CloseModalsOnMount() {
  const {
    setIsSignInModalOpen,
    setIsRegisterModalOpen,
    setIsLoginModalOpen,
    setIsCompleteRegisterModalOpen,
    setIsVerifyEmailModalOpen,
    setIsOnboardingModalOpen,
    setIsRegistrationSuccessModalOpen,
  } = useAuth();

  useEffect(() => {
    setIsSignInModalOpen(false);
    setIsRegisterModalOpen(false);
    setIsLoginModalOpen(false);
    setIsCompleteRegisterModalOpen(false);
    setIsVerifyEmailModalOpen(false);
    setIsOnboardingModalOpen(false);
    setIsRegistrationSuccessModalOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
