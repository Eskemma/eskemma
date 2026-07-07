// app/components/componentsHome/RegisterModal.tsx
"use client";
import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { saveUserData } from "../../../firebase/firestoreUtils";
import { auth } from "../../../firebase/firebaseConfig";
import countries from "../../../app/data/countries.json";
import { isUserNameAvailable } from "../../../utils/userUtils";
import { generateAlternativeUserName } from "../../../utils/generateAlternativeUserName";
import { calculateUserRole } from "../../../utils/roleUtils";
import Button from "../Button";
import Link from "next/link";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface RegisterFormData {
  name: string;
  lastName: string;
  sex: string;
  country: string;
  roles: string[];
  otherRole?: string;
  interests: string[];
  otherInterest?: string;
  userName: string;
}

export default function RegisterModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    lastName: "",
    sex: "",
    country: "",
    roles: [],
    otherRole: "",
    interests: [],
    otherInterest: "",
    userName: "",
  });
  const [userNameEdited, setUserNameEdited] = useState(false);
  const [isUserNameValid, setIsUserNameValid] = useState(true);
  const [userNameError, setUserNameError] = useState("");
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    user,
    setUser,
    setIsRegisterModalOpen,
    setIsCompleteRegisterModalOpen,
    setIsRegistrationSuccessModalOpen,
    setIsLoginModalOpen,
    setIsOnboardingModalOpen,
  } = useAuth();

  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, onClose);

  // Definir los países preferenciales
  const preferredCountries = [
    "México",
    "Estados Unidos",
    "España",
    "Argentina",
    "Perú",
  ];
  const allCountries = countries.filter(
    (country) => !preferredCountries.includes(country)
  );
  const sortedCountries = [...preferredCountries, ...allCountries];
  // Lista normalizada de intereses
  const interestsList = [
    "Análisis de Datos",
    "Campañas Institucionales",
    "Comunicación de Gobierno",
    "Comunicación Política",
    "Encuestas y Muestreo",
    "Estrategia Electoral",
    "Estrategia Política",
    "Gerencia Electoral",
    "Gobierno Municipal",
    "Investigación Cualitativa",
    "Liderazgo y Negociación",
    "Marca Política",
    "Marco Jurídico-Electoral",
    "Marketing Electoral",
    "Marketing Político Digital",
    "Opinión Pública",
    "Participación Ciudadana",
    "Poder Legislativo",
    "Políticas Públicas",
    "Sociedad Civil",
    "Storytelling",
    "Técnicas de Análisis Político",
  ];

  const handleChange = async (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "name" || name === "lastName") {
      const isValid = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜçÇ\s´]*$/.test(value);
      if (!isValid) {
        return;
      }
      if (name === "name") {
        const baseUserName = value.toLowerCase().replace(/\s+/g, "");
        const available = await isUserNameAvailable(baseUserName);
        const finalUserName = available
          ? baseUserName
          : await generateAlternativeUserName(baseUserName);
        setFormData((prev) => ({
          ...prev,
          name: value,
          userName: finalUserName,
        }));
        if (!available) {
          setSuggestionMessage(
            `El nombre de usuario "${baseUserName}" no está disponible. Se ha sugerido "${finalUserName}".`
          );
        } else {
          setSuggestionMessage("");
        }
        setUserNameEdited(!available);
        return;
      }
      setFormData((prev) => ({ ...prev, lastName: value }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUserNameChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { value } = e.target;
    const isValid = /^[a-zA-ZñÑüÜçÇ\s]*$/.test(value);
    if (!isValid) {
      setUserNameError("Solo se permiten letras, espacios, ñ, ü, ç.");
      setIsUserNameValid(false);
      return;
    }
    setFormData((prev) => ({ ...prev, userName: value.toLowerCase() }));
    setUserNameEdited(true);
    if (value.trim().length > 0) {
      try {
        const available = await isUserNameAvailable(value.toLowerCase());
        setIsUserNameValid(available);
        if (!available) {
          const alternativeUserName = await generateAlternativeUserName(
            value.toLowerCase()
          );
          setFormData((prev) => ({ ...prev, userName: alternativeUserName }));
          setUserNameError(
            "Este nombre de usuario ya está en uso. Se ha sugerido una alternativa."
          );
        } else {
          setUserNameError("");
        }
      } catch (error) {
        console.error("Error al verificar el nombre de usuario:", error);
        setUserNameError("Ocurrió un error al verificar el nombre de usuario.");
        setIsUserNameValid(false);
      }
    } else {
      setIsUserNameValid(true);
      setUserNameError("");
    }
  };

  const handleRolesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      roles: checked
        ? [...prev.roles, value]
        : prev.roles.filter((item) => item !== value),
    }));
  };

  const handleInterestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      interests: checked
        ? [...new Set([...prev.interests, value])]
        : prev.interests.filter((item) => item !== value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUserNameValid) {
      alert("Por favor, corrige el nombre de usuario antes de continuar.");
      return;
    }
    if (!user) {
      alert("No se detectó un usuario autenticado. Por favor, inicia sesión.");
      return;
    }
    setIsSubmitting(true);
    try {
      console.log("📝 Iniciando proceso de completar registro...");
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Usuario no autenticado");
      await currentUser.reload();
      const emailVerified = currentUser.emailVerified;
      // Filtrar roles e intereses
      const finalRoles: string[] = formData.roles.includes("Otro")
        ? [
          ...formData.roles.filter((role) => role !== "Otro"),
          formData.otherRole || "",
        ].filter((role) => role !== "")
        : formData.roles;
      const finalInterests: string[] = formData.interests.includes("Otro")
        ? [
          ...new Set([
            ...formData.interests.filter((interest) => interest !== "Otro"),
            formData.otherInterest || "",
          ]),
        ].filter((interest) => interest !== "")
        : [...new Set(formData.interests)];
      const calculatedRole = calculateUserRole({
        emailVerified: emailVerified,
        profileCompleted: true,
        subscriptionPlan: user.subscriptionPlan || null,
        subscriptionStatus: user.subscriptionStatus || null,
        subscriptionEndDate: user.subscriptionEndDate || null,
        previousSubscription: user.previousSubscription || null,
      });
      console.log(
        `✅ Rol calculado después de completar registro: ${calculatedRole}`
      );
      const userData = {
        uid: user.uid,
        email: user.email,
        name: formData.name,
        lastName: formData.lastName,
        sex: formData.sex,
        country: formData.country,
        roles: finalRoles,
        interests: finalInterests,
        userName: formData.userName.toLowerCase(),
        profileCompleted: true,
        role: calculatedRole,
        emailVerified,
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscriptionPlan: user.subscriptionPlan || null,
        subscriptionStatus: user.subscriptionStatus || null,
        subscriptionStartDate: user.subscriptionStartDate || null,
        subscriptionEndDate: user.subscriptionEndDate || null,
        previousSubscription: user.previousSubscription || null,
        stripeCustomerId: user.stripeCustomerId || null,
        stripeSubscriptionId: user.stripeSubscriptionId || null,
      };
      console.log("📦 Datos preparados para guardar:", userData);
      await saveUserData(userData);
      console.log("✅ Datos guardados correctamente en Firestore");
      await fetch("/api/setUserRole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          role: calculatedRole,
        }),
      });
      console.log("✅ Custom claim actualizado");
      setUser({
        ...user,
        name: formData.name,
        lastName: formData.lastName,
        sex: formData.sex,
        country: formData.country,
        roles: finalRoles,
        interests: finalInterests,
        userName: formData.userName.toLowerCase(),
        profileCompleted: true,
        role: calculatedRole,
        updatedAt: new Date().toISOString(),
      });
      console.log("✅ Usuario actualizado en el contexto");
      setIsRegisterModalOpen(false);
      setIsCompleteRegisterModalOpen(false);
      if (user.showOnboardingModal) {
        console.log("🎯 Mostrando modal de onboarding");
        setIsOnboardingModalOpen(true);
      } else {
        console.log("✅ Registro completado - No se requiere onboarding");
        alert("¡Registro completado exitosamente!");
      }
      console.log(
        `✅ Registro completado con éxito. Role final: ${calculatedRole}`
      );
    } catch (error: any) {
      console.error("❌ Error durante el registro:", error);
      alert(
        `Ocurrió un error al completar tu perfil: ${error.message || "Inténtalo de nuevo."
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginClick = () => {
    console.log("🔄 Cerrando registro y abriendo login...");
    setIsRegisterModalOpen(false);
    setTimeout(() => {
      setIsLoginModalOpen(true);
      console.log("✅ Modal de login abierto");
    }, 50);
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
        aria-labelledby="register-modal-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative overflow-y-auto max-h-[85vh] max-sm:max-h-[90vh]"
        style={{ marginTop: "20px" }}
      >
        <button
          className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-gray-700 dark:text-[#9AAEBE] hover:text-red-eske transition-colors duration-300 focus-ring-primary rounded"
          onClick={onClose}
          disabled={isSubmitting}
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
        <h2
          id="register-modal-title"
          className="text-2xl max-sm:text-xl font-bold text-bluegreen-eske text-center mb-6 max-sm:mb-4"
        >
          Un paso más antes de empezar.
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-sm:space-y-3">
          <div>
            <label
              htmlFor="register-name"
              className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1"
            >
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="register-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus-ring-primary disabled:bg-gray-100 dark:disabled:bg-[#21425E] bg-white dark:bg-[#112230] dark:text-[#EAF2F8] text-base max-sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="register-lastName"
              className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1"
            >
              Apellidos <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="register-lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus-ring-primary disabled:bg-gray-100 dark:disabled:bg-[#21425E] bg-white dark:bg-[#112230] dark:text-[#EAF2F8] text-base max-sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="register-userName"
              className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1"
            >
              Nombre de usuario <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="register-userName"
              name="userName"
              value={formData.userName}
              onChange={handleUserNameChange}
              required
              disabled={isSubmitting}
              aria-invalid={!isUserNameValid}
              aria-describedby={
                !isUserNameValid
                  ? "userName-error"
                  : suggestionMessage
                    ? "userName-suggestion"
                    : undefined
              }
              className={`w-full px-3 py-2 max-sm:py-1.5 border ${!isUserNameValid ? "border-red-500" : "border-gray-300 dark:border-white/10"
                } rounded focus-ring-primary disabled:bg-gray-100 dark:disabled:bg-[#21425E] bg-white dark:bg-[#112230] dark:text-[#EAF2F8] text-base max-sm:text-sm`}
            />
            {!isUserNameValid && (
              <p
                id="userName-error"
                className="text-red-500 text-sm max-sm:text-xs mt-1"
                role="alert"
              >
                {userNameError}
              </p>
            )}
            {suggestionMessage && (
              <p
                id="userName-suggestion"
                className="text-blue-500 text-sm max-sm:text-xs mt-1"
                role="status"
              >
                {suggestionMessage}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="register-sex"
              className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1"
            >
              Sexo <span className="text-red-500">*</span>
            </label>
            <select
              id="register-sex"
              name="sex"
              value={formData.sex}
              onChange={handleChange}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus-ring-primary disabled:bg-gray-100 dark:disabled:bg-[#21425E] bg-white dark:bg-[#112230] dark:text-[#EAF2F8] text-base max-sm:text-sm"
            >
              <option value="">Selecciona una opción</option>
              <option value="hombre">Hombre</option>
              <option value="mujer">Mujer</option>
              <option value="no-binario">No binario</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="register-country"
              className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-1"
            >
              País <span className="text-red-500">*</span>
            </label>
            <select
              id="register-country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded focus-ring-primary disabled:bg-gray-100 dark:disabled:bg-[#21425E] bg-white dark:bg-[#112230] dark:text-[#EAF2F8] text-base max-sm:text-sm"
            >
              <option value="">Selecciona una opción</option>
              {sortedCountries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
          <div>
            <hr className="border-bluegreen-eske my-4 max-sm:my-3" />
            <p className="text-[16px] max-sm:text-sm font-medium text-bluegreen-eske text-center mb-6 max-sm:mb-4">
              La siguiente información nos ayuda a mostrarte los recursos y herramientas más relevantes para tu trabajo.
            </p>
          </div>
          <div>
            <fieldset>
              <legend className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-2 max-sm:mb-1.5">
                Roles
              </legend>
              <div className="space-y-2 max-sm:space-y-1.5">
                {[
                  "Candidatura",
                  "Consultoría o Asesoría",
                  "Integrante de equipo de campaña",
                  "Integrante de partido político",
                  "Servicio público",
                  "Academia",
                  "Otro",
                ].map((role) => (
                  <label key={role} className="flex items-center min-h-[44px] max-sm:min-h-[40px] cursor-pointer dark:text-[#C7D6E0]">
                    <input
                      type="checkbox"
                      name="roles"
                      value={role}
                      checked={formData.roles.includes(role)}
                      onChange={handleRolesChange}
                      disabled={isSubmitting}
                      className="mr-2 w-4 h-4 accent-blue-eske disabled:opacity-50 focus-ring-primary"
                    />
                    <span className="text-base max-sm:text-sm">{role}</span>
                  </label>
                ))}
                {formData.roles.includes("Otro") && (
                  <input
                    type="text"
                    id="register-otherRole"
                    name="otherRole"
                    value={formData.otherRole}
                    onChange={handleChange}
                    placeholder="Especifica tu rol"
                    disabled={isSubmitting}
                    aria-label="Especifica otro rol"
                    className="mt-2 w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 rounded focus-ring-primary disabled:bg-gray-100 text-base max-sm:text-sm"
                  />
                )}
              </div>
            </fieldset>
          </div>
          <div>
            <hr className="border-bluegreen-eske my-4 max-sm:my-3" />
            <fieldset>
              <legend className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-2 max-sm:mb-1.5">
                Temas de interés
              </legend>
              <div className="space-y-2 max-sm:space-y-1.5">
                {interestsList.map((interest) => (
                  <label key={interest} className="flex items-center min-h-[44px] max-sm:min-h-[40px] cursor-pointer dark:text-[#C7D6E0]">
                    <input
                      type="checkbox"
                      name="interests"
                      value={interest}
                      checked={formData.interests.includes(interest)}
                      onChange={handleInterestsChange}
                      disabled={isSubmitting}
                      className="mr-2 w-4 h-4 accent-blue-eske disabled:opacity-50 focus-ring-primary"
                    />
                    <span className="text-base max-sm:text-sm">{interest}</span>
                  </label>
                ))}
                <label className="flex items-center min-h-[44px] max-sm:min-h-[40px] cursor-pointer">
                  <input
                    type="checkbox"
                    name="interests"
                    value="Otro"
                    checked={formData.interests.includes("Otro")}
                    onChange={handleInterestsChange}
                    disabled={isSubmitting}
                    className="mr-2 w-4 h-4 accent-blue-eske disabled:opacity-50 focus-ring-primary"
                  />
                  <span className="text-base max-sm:text-sm">Otro</span>
                </label>
                {formData.interests.includes("Otro") && (
                  <input
                    type="text"
                    id="register-otherInterest"
                    name="otherInterest"
                    value={formData.otherInterest}
                    onChange={handleChange}
                    placeholder="Especifica tu interés"
                    disabled={isSubmitting}
                    aria-label="Especifica otro interés"
                    className="mt-2 w-full px-3 py-2 max-sm:py-1.5 border border-gray-300 rounded focus-ring-primary disabled:bg-gray-100 text-base max-sm:text-sm"
                  />
                )}
              </div>
            </fieldset>
          </div>

          <Button
            label={
              isSubmitting ? "COMPLETANDO REGISTRO..." : "COMPLETAR MI PERFIL"
            }
            variant="primary"
            disabled={isSubmitting}
            type="submit"
          />
          <p className="mt-4 max-sm:mt-3 text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] text-center">
            Al registrarme acepto las{" "}
            <Link
              href="/condiciones-de-uso"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline cursor-pointer focus-ring-primary rounded"
            >
              condiciones de uso
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </Link>{" "}
            y la{" "}
            <Link
              href="/politica-de-privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline cursor-pointer focus-ring-primary rounded"
            >
              política de privacidad
              <span className="sr-only"> (se abre en nueva ventana)</span>
            </Link>{" "}
            de Eskemma.
          </p>

          <hr className="border-gray-300 my-4 max-sm:my-3" />
          <p className="text-[14px] max-sm:text-xs text-black-eske dark:text-[#C7D6E0] text-center">
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              onClick={handleLoginClick}
              disabled={isSubmitting}
              className="text-bluegreen-eske-60 underline cursor-pointer bg-transparent border-none p-0 hover:text-bluegreen-eske disabled:opacity-50 focus-ring-primary rounded"
            >
              Inicia sesión
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
