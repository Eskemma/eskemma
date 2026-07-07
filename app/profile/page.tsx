// app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { uploadAvatar } from "../../firebase/storageUtils";
import { saveUserData } from "../../firebase/firestoreUtils";
import Button from "../components/Button";
import ConfirmEditProfileModal from "../components/componentsHome/ConfirmEditProfileModal";
import ConfirmAvatarChange from "../components/componentsHome/ConfirmAvatarChange";
import ConfirmPasswordChange from "../components/componentsHome/ConfirmPasswordChange";
import countries from "../data/countries.json";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "../../firebase/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { isUserNameAvailable } from "../../utils/userUtils";
import { generateAlternativeUserName } from "@/utils/generateAlternativeUserName";

const ProfilePage = () => {
  const router = useRouter();
  const { user, setUser, updateAuthEmail } = useAuth();
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarConfirmationOpen, setIsAvatarConfirmationOpen] =
    useState(false);
  const [isPasswordConfirmationOpen, setIsPasswordConfirmationOpen] =
    useState(false);

  // Redirigir al home si no hay usuario autenticado
  useEffect(() => {
    if (!user) {
      router.push("/");
    }
  }, [user, router]);

  // Tamaño máximo del avatar
  const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

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
  const [isUserNameValid, setIsUserNameValid] = useState(true);
  const [userNameError, setUserNameError] = useState("");
  const [suggestionMessage, setSuggestionMessage] = useState("");

  // Lista de intereses
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

  // Estado para los datos del formulario
  const [formData, setFormData] = useState({
    name: user?.name || "",
    lastName: user?.lastName || "",
    country: user?.country || "",
    avatarUrl: user?.avatarUrl || "",
    userName: user?.userName || "",
    sex: user?.sex || "",
    roles: user?.roles || [],
    interests: user?.interests || [],
    otherRole: "",
    otherInterest: "",
    email: user?.email || "",
  });

  // Estado para cambio de contraseña
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Estado para controlar el proceso de guardado
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Actualizar formData cuando el usuario cambie
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        lastName: user.lastName || "",
        country: user.country || "",
        avatarUrl: user.avatarUrl || "",
        userName: user.userName || "",
        sex: user.sex || "",
        roles: user.roles || [],
        interests: user.interests || [],
        otherRole: "",
        otherInterest: "",
        email: user.email || "",
      });
      setAvatarPreview(user.avatarUrl || null);
    }
  }, [user]);

  // NUEVA FUNCIÓN: Manejar cancelación
  const handleCancel = () => {
    // Confirmar si el usuario desea descartar cambios
    const hasChanges =
      formData.name !== user?.name ||
      formData.lastName !== user?.lastName ||
      formData.userName !== user?.userName ||
      formData.sex !== user?.sex ||
      formData.country !== user?.country ||
      formData.email !== user?.email ||
      JSON.stringify(formData.roles) !== JSON.stringify(user?.roles) ||
      JSON.stringify(formData.interests) !== JSON.stringify(user?.interests);

    if (hasChanges) {
      const confirmDiscard = window.confirm(
        "¿Estás seguro de que deseas descartar los cambios? Todos los cambios no guardados se perderán."
      );

      if (!confirmDiscard) {
        return; // El usuario decidió no descartar los cambios
      }
    }

    // Redirigir al home
    router.push("/");
  };

  const handleInputChange = async (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "userName") {
      const isValidChars = /^[a-zA-ZñÑüÜçÇ\s]*$/.test(value);
      if (!isValidChars) {
        setUserNameError("Solo se permiten letras, espacios, ñ, ü, ç.");
        setIsUserNameValid(false);
        return;
      }

      setFormData((prev) => ({ ...prev, [name]: value.toLowerCase() }));

      if (
        value.trim().length > 0 &&
        value.toLowerCase() !== user?.userName?.toLowerCase()
      ) {
        try {
          const available = await isUserNameAvailable(value.toLowerCase());
          setIsUserNameValid(available);

          if (!available) {
            const alternativeUserName = await generateAlternativeUserName(
              value.toLowerCase()
            );
            setFormData((prev) => ({ ...prev, userName: alternativeUserName }));
            setUserNameError("Este nombre de usuario ya está en uso.");
            setSuggestionMessage(
              `Se ha sugerido "${alternativeUserName}" como alternativa.`
            );
          } else {
            setUserNameError("");
            setSuggestionMessage("");
          }
        } catch (error) {
          console.error("Error al verificar el nombre de usuario:", error);
          setUserNameError(
            "Ocurrió un error al verificar el nombre de usuario."
          );
          setIsUserNameValid(false);
        }
      } else {
        setIsUserNameValid(true);
        setUserNameError("");
        setSuggestionMessage("");
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateUserName = async (userName: string): Promise<boolean> => {
    if (!userName.trim()) {
      setErrors((prev) => ({
        ...prev,
        userName: "El nombre de usuario es obligatorio",
      }));
      return false;
    }

    // Si el userName es el mismo que tiene actualmente, es válido
    if (userName.toLowerCase() === user?.userName?.toLowerCase()) {
      return true;
    }

    try {
      const available = await isUserNameAvailable(userName.toLowerCase());

      if (!available) {
        setErrors((prev) => ({
          ...prev,
          userName: "Este nombre de usuario ya está en uso",
        }));
        return false;
      }

      // Limpiar error si existía
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.userName;
        return newErrors;
      });

      return true;
    } catch (error) {
      console.error("Error al validar userName:", error);
      setErrors((prev) => ({
        ...prev,
        userName: "Error al validar el nombre de usuario",
      }));
      return false;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es obligatorio";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Los apellidos son obligatorios";
    }

    if (!formData.userName.trim()) {
      newErrors.userName = "El nombre de usuario es obligatorio";
    }

    if (!formData.sex) {
      newErrors.sex = "Selecciona tu sexo";
    }

    if (!formData.country) {
      newErrors.country = "Selecciona tu país";
    }

    if (!formData.email.trim()) {
      newErrors.email = "El correo electrónico es obligatorio";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = "Ingresa tu contraseña actual";
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = "Ingresa tu nueva contraseña";
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = "La contraseña debe tener al menos 6 caracteres";
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden";
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      alert("Debes estar autenticado para subir un avatar.");
      return;
    }

    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    if (file.size > MAX_AVATAR_SIZE) {
      alert(
        `El archivo es demasiado grande. El tamaño máximo permitido es ${MAX_AVATAR_SIZE / (1024 * 1024)
        } MB.`
      );
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploadingAvatar(true);
    try {
      const downloadURL = await uploadAvatar(file, user.uid);
      setFormData((prev) => ({ ...prev, avatarUrl: downloadURL }));
      setIsAvatarConfirmationOpen(true);
    } catch (error) {
      console.error("Error al subir el avatar:", error);
      alert("Ocurrió un error al subir tu avatar.");
      setAvatarPreview(formData.avatarUrl || null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      alert("No se pudo autenticar al usuario");
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordData.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      await updatePassword(currentUser, passwordData.newPassword);

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordSection(false);
      setIsPasswordConfirmationOpen(true);
    } catch (error: any) {
      console.error("Error al cambiar contraseña:", error);

      if (error.code === "auth/wrong-password") {
        setErrors((prev) => ({
          ...prev,
          currentPassword: "Contraseña actual incorrecta",
        }));
      } else if (error.code === "auth/too-many-requests") {
        alert("Demasiados intentos. Intenta más tarde.");
      } else {
        alert("Error al cambiar la contraseña. Inténtalo de nuevo.");
      }
    }
  };

  const handleSave = async () => {
    if (!user) {
      alert("Debes estar autenticado para guardar cambios.");
      return;
    }

    if (!validateForm()) {
      alert("Por favor, completa todos los campos obligatorios");
      return;
    }

    const isUserNameValid = await validateUserName(formData.userName);
    if (!isUserNameValid) {
      return;
    }

    setIsSaving(true);
    try {
      const finalRoles: string[] = formData.roles.includes("Otro")
        ? [
          ...formData.roles.filter((role: string) => role !== "Otro"),
          formData.otherRole || "",
        ].filter((role) => role !== "")
        : formData.roles;

      const finalInterests: string[] = formData.interests.includes("Otro")
        ? [
          ...new Set([
            ...formData.interests.filter(
              (interest: string) => interest !== "Otro"
            ),
            formData.otherInterest || "",
          ]),
        ].filter((interest) => interest !== "")
        : [...new Set(formData.interests)];

      const userDataToSave = {
        uid: user.uid,
        email: formData.email,
        name: formData.name,
        lastName: formData.lastName,
        country: formData.country,
        avatarUrl: formData.avatarUrl,
        userName: formData.userName.toLowerCase(),
        sex: formData.sex,
        roles: finalRoles,
        interests: finalInterests,
        role: user.role || "user",
        profileCompleted: true,
        emailVerified: user.emailVerified ?? false,
        showOnboardingModal: user.showOnboardingModal ?? false,
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (formData.email !== user.email) {
        await updateAuthEmail(formData.email);
        alert("Se ha enviado un correo de verificación a tu nueva dirección");
      }

      await saveUserData(userDataToSave);

      setUser({
        ...user,
        ...userDataToSave,
      });

      setIsConfirmationModalOpen(true);
    } catch (error: any) {
      console.error("Error al guardar el perfil:", error.message);
      alert(`Ocurrió un error al guardar tu perfil: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 max-sm:p-4">
      <h1 className="text-3xl max-sm:text-2xl font-bold text-bluegreen-eske dark:text-[#6BA4C6] text-center mb-8 max-sm:mb-6">
        Editar Perfil
      </h1>

      {/* SECCIÓN: Avatar */}
      <section
        className="mb-8 max-sm:mb-6 p-6 max-sm:p-4 bg-white dark:bg-[#18324A] rounded-lg shadow-md"
        aria-labelledby="avatar-section-title"
      >
        <h2
          id="avatar-section-title"
          className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-4 max-sm:mb-3"
        >
          Foto de Perfil
        </h2>
        <div className="flex flex-col sm:flex-row items-center gap-6 max-sm:gap-4">
          <div className="flex-shrink-0">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={`Foto de perfil de ${formData.name || 'usuario'}`}
                className="w-32 h-32 max-sm:w-24 max-sm:h-24 rounded-full object-cover border-4 border-bluegreen-eske"
              />
            ) : (
              <div
                className="w-32 h-32 max-sm:w-24 max-sm:h-24 rounded-full bg-gray-200 dark:bg-[#112230] flex items-center justify-center border-4 border-gray-300 dark:border-white/10"
                role="img"
                aria-label="Sin foto de perfil"
              >
                <span className="text-gray-400 dark:text-[#6D8294] text-sm max-sm:text-xs text-center px-2">
                  Sin foto
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <label
              htmlFor="avatar-upload"
              className="cursor-pointer inline-block bg-bluegreen-eske text-white px-6 max-sm:px-4 py-3 max-sm:py-2 rounded hover:bg-bluegreen-eske-70 transition-colors duration-300 focus-ring-primary text-base max-sm:text-sm"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  document.getElementById('avatar-upload')?.click();
                }
              }}
            >
              {isUploadingAvatar ? "Subiendo..." : "CAMBIAR FOTO"}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={isUploadingAvatar}
              className="hidden"
              aria-label="Seleccionar archivo de imagen para foto de perfil"
            />
            <p className="text-sm max-sm:text-xs text-gray-500 dark:text-[#9AAEBE] mt-2">
              Tamaño máximo: 2 MB. Formatos: JPG, PNG, GIF
            </p>
          </div>
        </div>
      </section>

      {/* SECCIÓN: Información Personal */}
      <section
        className="mb-8 max-sm:mb-6 p-6 max-sm:p-4 bg-white dark:bg-[#18324A] rounded-lg shadow-md"
        aria-labelledby="personal-info-title"
      >
        <h2
          id="personal-info-title"
          className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-4 max-sm:mb-3"
        >
          Información Personal
        </h2>

        <form aria-label="Formulario de información personal" className="space-y-4 max-sm:space-y-3">
          {/* Nombre */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
            >
              Nombre <span className="text-red-500" aria-label="campo requerido">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${errors.name ? "border-red-500" : "border-gray-300"
                } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p
                id="name-error"
                className="text-red-500 text-sm max-sm:text-xs mt-1"
                role="alert"
              >
                {errors.name}
              </p>
            )}
          </div>

          {/* Apellidos */}
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
            >
              Apellidos <span className="text-red-500" aria-label="campo requerido">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${errors.lastName ? "border-red-500" : "border-gray-300"
                } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              aria-required="true"
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? "lastName-error" : undefined}
            />
            {errors.lastName && (
              <p
                id="lastName-error"
                className="text-red-500 text-sm max-sm:text-xs mt-1"
                role="alert"
              >
                {errors.lastName}
              </p>
            )}
          </div>

          {/* Nombre de Usuario */}
          <div>
            <label
              htmlFor="userName"
              className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
            >
              Nombre de Usuario <span className="text-red-500" aria-label="campo requerido">*</span>
            </label>
            <input
              type="text"
              id="userName"
              name="userName"
              value={formData.userName}
              onChange={handleInputChange}
              className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${!isUserNameValid ? "border-red-500" : "border-gray-300"
                } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              aria-required="true"
              aria-invalid={!isUserNameValid}
              aria-describedby={!isUserNameValid || suggestionMessage ? "userName-error userName-suggestion" : undefined}
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
                aria-live="polite"
              >
                {suggestionMessage}
              </p>
            )}
          </div>

          {/* Sexo */}
          <div>
            <label
              htmlFor="sex"
              className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
            >
              Sexo <span className="text-red-500" aria-label="campo requerido">*</span>
            </label>
            <select
              id="sex"
              name="sex"
              value={formData.sex}
              onChange={handleInputChange}
              className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${errors.sex ? "border-red-500" : "border-gray-300"
                } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              aria-required="true"
              aria-invalid={!!errors.sex}
              aria-describedby={errors.sex ? "sex-error" : undefined}
            >
              <option value="">Selecciona una opción</option>
              <option value="hombre">Hombre</option>
              <option value="mujer">Mujer</option>
              <option value="no-binario">No binario</option>
            </select>
            {errors.sex && (
              <p
                id="sex-error"
                className="text-red-500 text-sm max-sm:text-xs mt-1"
                role="alert"
              >
                {errors.sex}
              </p>
            )}
          </div>

          {/* País */}
          <div>
            <label
              htmlFor="country"
              className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
            >
              País <span className="text-red-500" aria-label="campo requerido">*</span>
            </label>
            <select
              id="country"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${errors.country ? "border-red-500" : "border-gray-300"
                } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              aria-required="true"
              aria-invalid={!!errors.country}
              aria-describedby={errors.country ? "country-error" : undefined}
            >
              <option value="">Selecciona una opción</option>
              {sortedCountries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            {errors.country && (
              <p
                id="country-error"
                className="text-red-500 text-sm max-sm:text-xs mt-1"
                role="alert"
              >
                {errors.country}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
            >
              Correo Electrónico <span className="text-red-500" aria-label="campo requerido">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${errors.email ? "border-red-500" : "border-gray-300"
                } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby="email-hint email-error"
            />
            <p
              id="email-hint"
              className="text-xs max-sm:text-[10px] text-gray-500 mt-1"
            >
              ⚠️ Este correo es tu llave de acceso. Si lo cambias, recibirás un enlace de verificación en la nueva dirección antes de que el cambio sea efectivo.
            </p>
            {errors.email && (
              <p
                id="email-error"
                className="text-red-500 text-sm max-sm:text-xs mt-1"
                role="alert"
              >
                {errors.email}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* SECCIÓN: Roles */}
      <section
        className="mb-8 max-sm:mb-6 p-6 max-sm:p-4 bg-white dark:bg-[#18324A] rounded-lg shadow-md"
        aria-labelledby="roles-section-title"
      >
        <h2
          id="roles-section-title"
          className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-4 max-sm:mb-3"
        >
          Roles Profesionales
        </h2>
        <fieldset>
          <legend className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-2 max-sm:mb-1.5">Roles</legend>
          <div
            className="space-y-2 max-sm:space-y-1.5"
            role="group"
            aria-label="Lista de roles profesionales"
          >
            {[
              "Candidatura",
              "Consultoría o Asesoría",
              "Integrante de equipo de campaña",
              "Integrante de partido político",
              "Servicio público",
              "Academia",
              "Otro",
            ].map((role) => (
              <label key={role} className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 p-2 max-sm:p-1.5 rounded transition-colors min-h-[44px] max-sm:min-h-[40px]">
                <input
                  type="checkbox"
                  value={role}
                  checked={formData.roles.includes(role)}
                  onChange={handleRolesChange}
                  className="mr-2 w-4 h-4 accent-bluegreen-eske focus-ring-primary rounded"
                  aria-label={role}
                />
                <span className="text-gray-700 dark:text-[#C7D6E0] text-base max-sm:text-sm">{role}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {formData.roles.includes("Otro") && (
          <div className="mt-4 max-sm:mt-3">
            <label
              htmlFor="otherRole"
              className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
            >
              Especifica tu otro rol
            </label>
            <input
              type="text"
              id="otherRole"
              name="otherRole"
              value={formData.otherRole}
              onChange={handleInputChange}
              placeholder="Especifica tu rol"
              className="w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]"
              aria-describedby="otherRole-hint"
            />
            <p
              id="otherRole-hint"
              className="text-xs max-sm:text-[10px] text-gray-500 mt-1"
            >
              Describe tu rol profesional si no está en la lista
            </p>
          </div>
        )}
      </section>

      {/* SECCIÓN: Intereses */}
      <section
        className="mb-8 max-sm:mb-6 p-6 max-sm:p-4 bg-white dark:bg-[#18324A] rounded-lg shadow-md"
        aria-labelledby="interests-section-title"
      >
        <h2
          id="interests-section-title"
          className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-4 max-sm:mb-3"
        >
          Temas de Interés
        </h2>
        <fieldset>
          <legend className="block text-[16px] max-sm:text-sm font-medium text-black-eske dark:text-[#C7D6E0] mb-2 max-sm:mb-1.5">Temas de interés</legend>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-2 max-sm:gap-1.5"
            role="group"
            aria-label="Lista de temas de interés"
          >
            {interestsList.map((interest) => (
              <label
                key={interest}
                className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 p-2 max-sm:p-1.5 rounded transition-colors min-h-[44px] max-sm:min-h-[40px]"
              >
                <input
                  type="checkbox"
                  value={interest}
                  checked={formData.interests.includes(interest)}
                  onChange={handleInterestsChange}
                  className="mr-2 w-4 h-4 accent-bluegreen-eske focus-ring-primary rounded"
                  aria-label={interest}
                />
                <span className="text-gray-700 dark:text-[#C7D6E0] text-sm max-sm:text-xs">{interest}</span>
              </label>
            ))}
            <label className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 p-2 max-sm:p-1.5 rounded transition-colors min-h-[44px] max-sm:min-h-[40px]">
              <input
                type="checkbox"
                value="Otro"
                checked={formData.interests.includes("Otro")}
                onChange={handleInterestsChange}
                className="mr-2 w-4 h-4 accent-bluegreen-eske focus-ring-primary rounded"
                aria-label="Otro interés"
              />
              <span className="text-gray-700 text-sm max-sm:text-xs">Otro</span>
            </label>
          </div>
        </fieldset>
        {formData.interests.includes("Otro") && (
          <div className="mt-4 max-sm:mt-3">
            <label
              htmlFor="otherInterest"
              className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
            >
              Especifica tu otro interés
            </label>
            <input
              type="text"
              id="otherInterest"
              name="otherInterest"
              value={formData.otherInterest}
              onChange={handleInputChange}
              placeholder="Especifica tu interés"
              className="w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border border-gray-300 dark:border-white/10 rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]"
              aria-describedby="otherInterest-hint"
            />
            <p
              id="otherInterest-hint"
              className="text-xs max-sm:text-[10px] text-gray-500 mt-1"
            >
              Describe tu tema de interés si no está en la lista
            </p>
          </div>
        )}
      </section>

      {/* SECCIÓN: Cambiar Contraseña */}
      <section
        className="mb-8 max-sm:mb-6 p-6 max-sm:p-4 bg-white dark:bg-[#18324A] rounded-lg shadow-md"
        aria-labelledby="security-section-title"
      >
        <h2
          id="security-section-title"
          className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-4 max-sm:mb-3"
        >
          Seguridad
        </h2>

        {!showPasswordSection ? (
          <button
            onClick={() => setShowPasswordSection(true)}
            className="text-bluegreen-eske hover:underline cursor-pointer focus-ring-primary rounded text-base max-sm:text-sm"
            aria-label="Mostrar formulario para cambiar contraseña"
          >
            Cambiar contraseña
          </button>
        ) : (
          <form
            className="space-y-4 max-sm:space-y-3"
            aria-label="Formulario para cambiar contraseña"
            onSubmit={(e) => {
              e.preventDefault();
              handleChangePassword();
            }}
          >
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
              >
                Contraseña Actual <span className="text-red-500" aria-label="campo requerido">*</span>
              </label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${errors.currentPassword ? "border-red-500" : "border-gray-300"
                  } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
                aria-required="true"
                aria-invalid={!!errors.currentPassword}
                aria-describedby={errors.currentPassword ? "currentPassword-error" : undefined}
              />
              {errors.currentPassword && (
                <p
                  id="currentPassword-error"
                  className="text-red-500 text-sm max-sm:text-xs mt-1"
                  role="alert"
                >
                  {errors.currentPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
              >
                Nueva Contraseña <span className="text-red-500" aria-label="campo requerido">*</span>
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${errors.newPassword ? "border-red-500" : "border-gray-300"
                  } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
                aria-required="true"
                aria-invalid={!!errors.newPassword}
                aria-describedby="newPassword-hint newPassword-error"
              />
              <p
                id="newPassword-hint"
                className="text-xs max-sm:text-[10px] text-gray-500 mt-1"
              >
                Mínimo 6 caracteres
              </p>
              {errors.newPassword && (
                <p
                  id="newPassword-error"
                  className="text-red-500 text-sm max-sm:text-xs mt-1"
                  role="alert"
                >
                  {errors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm max-sm:text-xs font-medium text-gray-700 dark:text-[#C7D6E0] mb-1"
              >
                Confirmar Nueva Contraseña{" "}
                <span className="text-red-500" aria-label="campo requerido">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                className={`w-full px-4 max-sm:px-3 py-2 max-sm:py-1.5 border ${errors.confirmPassword ? "border-red-500" : "border-gray-300"
                  } rounded-md focus-ring-primary text-base max-sm:text-sm dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]`}
                aria-required="true"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              />
              {errors.confirmPassword && (
                <p
                  id="confirmPassword-error"
                  className="text-red-500 text-sm max-sm:text-xs mt-1"
                  role="alert"
                >
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="flex gap-4 max-sm:gap-3 flex-wrap">
              <button
                type="submit"
                className="bg-bluegreen-eske text-white px-6 max-sm:px-4 py-2 max-sm:py-1.5 rounded hover:bg-bluegreen-eske-70 transition-colors duration-300 focus-ring-primary text-base max-sm:text-sm"
                aria-label="Confirmar cambio de contraseña"
              >
                Actualizar Contraseña
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(false);
                  setPasswordData({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                  setErrors({});
                }}
                className="bg-gray-300 text-gray-700 px-6 max-sm:px-4 py-2 max-sm:py-1.5 rounded hover:bg-gray-400 transition-colors duration-300 focus-ring-primary text-base max-sm:text-sm dark:bg-[#21425E] dark:text-[#C7D6E0] dark:hover:bg-[#2C5273]"
                aria-label="Cancelar cambio de contraseña"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      {/* BOTONES: Guardar Cambios y Cancelar */}
      <div className="flex justify-center gap-4 max-sm:gap-3 flex-wrap">
        <Button
          label="CANCELAR"
          variant="secondary"
          onClick={handleCancel}
          disabled={isSaving || isUploadingAvatar}
        />
        <Button
          label={isSaving ? "Guardando..." : "GUARDAR CAMBIOS"}
          variant="primary"
          onClick={handleSave}
          disabled={isSaving || isUploadingAvatar}
        />
      </div>

      {/* Modal de Confirmación del Avatar */}
      <ConfirmAvatarChange
        isOpen={isAvatarConfirmationOpen}
        onClose={() => setIsAvatarConfirmationOpen(false)}
      />

      {/* Modal de Confirmación del Cambio de Contraseña */}
      <ConfirmPasswordChange
        isOpen={isPasswordConfirmationOpen}
        onClose={() => setIsPasswordConfirmationOpen(false)}
      />

      {/* Modal de Confirmación del Perfil */}
      <ConfirmEditProfileModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
      />
    </main>
  );
};

export default ProfilePage;

