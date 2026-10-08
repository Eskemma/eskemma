// context/AuthContext.tsx
// ✅ FASE 0: Todas las llamadas a /api/setUserRole ahora incluyen
// el token de Firebase en el header Authorization.
// Cambios marcados con: // ← FASE 0

"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updateEmail as firebaseUpdateEmail,
  getIdTokenResult,
  User,
  getAuth,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { auth, db, providerGoogle } from "../firebase/firebaseConfig";
import { isUserNameAvailable } from "../utils/userUtils";
import { crearCargadorSesion, type CargadorSesion } from "../lib/auth/cargadorSesion";
import { conLimite } from "../lib/auth/decidirSesionTrasError";
import { crearPerfilSiNoExiste } from "../lib/auth/crearPerfilSiNoExiste";
import { EsperaSesionPendiente } from "../app/components/shared/SesionPendiente";

import type {
  UserRole,
  SubscriptionPlan,
  SubscriptionStatus,
} from "../types/subscription.types";

// ─────────────────────────────────────────────────────────────────────────────
// FASE 0 — NUEVO: Helper para obtener el token del usuario actual y llamar
// a /api/setUserRole con el header Authorization correctamente.
// Centraliza todas las llamadas para no repetir lógica en cada función.
// ─────────────────────────────────────────────────────────────────────────────
async function callSetUserRole(uid: string, role: string): Promise<void> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    console.error("❌ [callSetUserRole] No hay usuario autenticado para obtener token");
    throw new Error("No hay usuario autenticado");
  }

  // Obtener token fresco (forceRefresh=false está bien aquí;
  // Firebase lo renueva automáticamente si está por vencer)
  const idToken = await currentUser.getIdToken();

  const response = await fetch("/api/setUserRole", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`, // ← FASE 0: token incluido
    },
    body: JSON.stringify({ uid, role }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("❌ [callSetUserRole] Error en respuesta:", errorData);
    throw new Error(errorData.error || `Error ${response.status} al asignar rol`);
  }

  console.log("✅ [callSetUserRole] Rol asignado:", { uid, role });
}
// ─────────────────────────────────────────────────────────────────────────────
// FIN helper FASE 0
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// FASE 4 — Helper para crear/refrescar la cookie de sesión HTTP-only.
// Se llama tras cada login y en cada carga de página (onAuthStateChanged).
// El error se captura silenciosamente para no bloquear el flujo de auth.
// ─────────────────────────────────────────────────────────────────────────────
async function syncSessionCookie(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  try {
    const idToken = await currentUser.getIdToken(true); // force-refresh para obtener claims actualizados
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    console.log("✅ [syncSessionCookie] Cookie de sesión sincronizada");
  } catch (error) {
    console.warn("⚠️ [syncSessionCookie] No se pudo sincronizar cookie:", error);
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// FIN helper FASE 4
// ─────────────────────────────────────────────────────────────────────────────

// ✅ Interfaz para los datos de Firestore
interface FirestoreUserData {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  lastName?: string;
  country?: string;
  avatarUrl?: string;
  userName?: string;
  sex?: "hombre" | "mujer" | "no-binario" | string;
  roles?: string[];
  interests?: string[];
  profileCompleted: boolean;
  emailVerified: boolean;
  showOnboardingModal: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;

  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartDate?: Date | string | null;
  subscriptionEndDate?: Date | string | null;
  previousSubscription?: SubscriptionPlan;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

// ✅ Tipo extendido que combina User de Firebase con datos de Firestore
interface ExtendedUser extends User {
  role: UserRole;
  name?: string;
  lastName?: string;
  country?: string;
  avatarUrl?: string;
  userName?: string;
  sex?: "hombre" | "mujer" | "no-binario" | string;
  roles?: string[];
  interests?: string[];
  profileCompleted?: boolean;
  showOnboardingModal?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;

  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartDate?: Date | string | null;
  subscriptionEndDate?: Date | string | null;
  previousSubscription?: SubscriptionPlan;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

// ✅ AuthContextType
interface AuthContextType {
  user: ExtendedUser | null;
  setUser: Dispatch<SetStateAction<ExtendedUser | null>>;
  loading: boolean;
  /**
   * true while the session could not be verified due to a transient error
   * (spinner, retrying) or after the retries were exhausted (loading=false,
   * user=null): pages must NOT treat that as "signed out".
   */
  sesionSinVerificar: boolean;
  reintentarSesion: () => void;
  isSignInModalOpen: boolean;
  setIsSignInModalOpen: Dispatch<SetStateAction<boolean>>;
  isVerifyEmailModalOpen: boolean;
  setIsVerifyEmailModalOpen: Dispatch<SetStateAction<boolean>>;
  isCompleteRegisterModalOpen: boolean;
  setIsCompleteRegisterModalOpen: Dispatch<SetStateAction<boolean>>;
  isRegisterModalOpen: boolean;
  setIsRegisterModalOpen: Dispatch<SetStateAction<boolean>>;
  isRegistrationSuccessModalOpen: boolean;
  setIsRegistrationSuccessModalOpen: Dispatch<SetStateAction<boolean>>;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: Dispatch<SetStateAction<boolean>>;
  isOnboardingModalOpen: boolean;
  setIsOnboardingModalOpen: Dispatch<SetStateAction<boolean>>;
  closeOnboardingModal: (showOnLogin?: boolean) => Promise<void>;
  registerUser: (email: string, password: string) => Promise<void>;
  loginUser: (identifier: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<string>;
  updateAuthEmail: (newEmail: string) => Promise<void>;
  debugUserToken: () => Promise<void>;
  updateUserRole: (uid: string, newRole: UserRole) => Promise<void>;

  activateSubscription: (
    plan: SubscriptionPlan,
    stripeSubscriptionId?: string
  ) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  checkAndUpdateExpiredSubscriptions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sesionSinVerificar, setSesionSinVerificar] = useState(false);
  const cargadorRef = useRef<CargadorSesion<User> | null>(null);

  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isVerifyEmailModalOpen, setIsVerifyEmailModalOpen] = useState(false);
  const [isCompleteRegisterModalOpen, setIsCompleteRegisterModalOpen] =
    useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isRegistrationSuccessModalOpen, setIsRegistrationSuccessModalOpen] =
    useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const { calculateUserRole } = require("../utils/roleUtils");

  useEffect(() => {
    // Writes issued without network never reject, they stay queued and the
    // awaiting promise hangs: every write of the session load is bounded.
    const LIMITE_ESCRITURA_MS = 10000;

    type DatosSesion = {
      updatedUser: User;
      userDocRef: ReturnType<typeof doc>;
      userData: FirestoreUserData;
      creado: boolean;
    };

    // Warn-only, bounded write: a failure here never retries the load nor
    // un-arms the user (the READ phase is the only thing that is retried).
    const escribir = async (etiqueta: string, fn: () => Promise<unknown>) => {
      try {
        await conLimite(fn(), LIMITE_ESCRITURA_MS);
      } catch (error) {
        console.warn(`⚠️ [auth] No se pudo ${etiqueta}:`, error);
      }
    };

    // READ phase (idempotent, the only part that is retried): reload, forced
    // token refresh, profile read and — only for a brand-new user — a
    // "create if absent" transaction, so two simultaneous loads (or two tabs)
    // never overwrite createdAt / profileCompleted / showOnboardingModal.
    const leerSesion = async (currentUser: User): Promise<DatosSesion | null> => {
      await currentUser.reload();
      const updatedUser = auth.currentUser;

      if (!updatedUser) {
        console.error("Usuario no encontrado después de reload.");
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await updatedUser.getIdTokenResult(true);

      const userDocRef = doc(db, "users", updatedUser.uid);
      const userDocSnapshot = await getDoc(userDocRef);

      if (userDocSnapshot.exists()) {
        return {
          updatedUser,
          userDocRef,
          userData: userDocSnapshot.data() as FirestoreUserData,
          creado: false,
        };
      }

      const initialRole: UserRole = "visitor";
      const perfilInicial = {
        uid: updatedUser.uid,
        email: updatedUser.email,
        userName: generateDefaultUserName(updatedUser.email || ""),
        role: initialRole,
        profileCompleted: false,
        emailVerified: updatedUser.emailVerified,
        showOnboardingModal: true,
        createdAt: new Date(),
        subscriptionPlan: null,
        subscriptionStatus: null,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        previousSubscription: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };
      const resultado = await conLimite(
        runTransaction(db, (tx) => crearPerfilSiNoExiste(tx, userDocRef, perfilInicial)),
        LIMITE_ESCRITURA_MS * 1.5
      );
      return {
        updatedUser,
        userDocRef,
        userData: resultado.data as FirestoreUserData,
        creado: resultado.creado,
      };
    };

    // WRITE phase: runs once per load, only after the READ phase succeeded.
    // The user is armed first (role computed locally from verified data);
    // later steps are bounded and warn-only.
    const verificarYEscribir = async (
      datos: DatosSesion,
      _usuario: User,
      vigente: () => boolean
    ) => {
      const { updatedUser, userDocRef, userData, creado } = datos;
      try {
        if (creado) {
          const initialRole: UserRole = "visitor";
          const newExtendedUser: ExtendedUser = {
            ...updatedUser,
            role: initialRole,
            profileCompleted: false,
            showOnboardingModal: true,
          };
          setUser(newExtendedUser);
          setSesionSinVerificar(false);

          // ← FASE 0: reemplazado fetch directo por callSetUserRole
          // No bloqueamos el login si falla la sincronización de claims
          await escribir("sincronizar el custom claim", () =>
            callSetUserRole(updatedUser.uid, initialRole)
          );
          if (!vigente()) return;
          await syncSessionCookie(); // ← FASE 4
        } else if (userData.role === "admin") {
          console.log("🔒 Usuario es admin, manteniendo rol");

          const extendedUser: ExtendedUser = {
            ...updatedUser,
            ...userData,
            role: "admin",
          };
          setUser(extendedUser);
          setSesionSinVerificar(false);
          await syncSessionCookie(); // ← FASE 4
        } else {
          const rolDesde = () =>
            calculateUserRole({
              emailVerified: updatedUser.emailVerified,
              profileCompleted: userData.profileCompleted,
              subscriptionPlan: userData.subscriptionPlan,
              subscriptionStatus: userData.subscriptionStatus,
              subscriptionEndDate: userData.subscriptionEndDate,
              previousSubscription: userData.previousSubscription,
            });
          const calculatedRole = rolDesde();

          const extendedUser: ExtendedUser = {
            ...updatedUser,
            ...userData,
            role: calculatedRole,
          };
          setUser(extendedUser);
          setSesionSinVerificar(false);

          if (userData.role !== calculatedRole) {
            await escribir("actualizar el rol", () =>
              updateDoc(userDocRef, { role: calculatedRole, updatedAt: new Date() })
            );
            if (!vigente()) return;
            // ← FASE 0: reemplazado fetch directo por callSetUserRole
            await escribir("sincronizar el custom claim", () =>
              callSetUserRole(updatedUser.uid, calculatedRole)
            );
          }
          if (!vigente()) return;

          if (userData.emailVerified !== updatedUser.emailVerified) {
            const newRole = rolDesde();
            await escribir("actualizar emailVerified", () =>
              updateDoc(userDocRef, {
                emailVerified: updatedUser.emailVerified,
                role: newRole,
                updatedAt: new Date(),
              })
            );
          }
          if (!vigente()) return;
          await syncSessionCookie(); // ← FASE 4
        }

        if (!vigente()) return;
        if (updatedUser.emailVerified) {
          setIsVerifyEmailModalOpen(false);
          try {
            const snap = await conLimite(getDoc(userDocRef), LIMITE_ESCRITURA_MS);
            const data = snap.data() as FirestoreUserData | undefined;
            if (!vigente()) return;
            if (!data?.profileCompleted) {
              setIsCompleteRegisterModalOpen(true);
            } else if (data.showOnboardingModal) {
              setIsOnboardingModalOpen(true);
            }
          } catch (error) {
            console.warn("⚠️ [auth] No se pudo evaluar los modales de registro:", error);
          }
        }
      } finally {
        if (vigente()) {
          setLoading(false);
          setSesionSinVerificar(false);
        }
      }
    };

    // Network outages are not invalid sessions (4b): see lib/auth/.
    const cargador = crearCargadorSesion<User, DatosSesion>({
      leer: leerSesion,
      alVerificar: verificarYEscribir,
      alCerrar: async () => {
        try {
          await signOut(auth);
        } catch {
          // already signed out by the SDK
        }
        setUser(null);
        setSesionSinVerificar(false);
        setLoading(false);
      },
      alUsuarioAusente: () => {
        setUser(null);
        setSesionSinVerificar(false);
        setLoading(false);
      },
      alPendiente: () => {
        setSesionSinVerificar(true);
        setLoading(true);
      },
      alAgotar: () => {
        setUser(null);
        setSesionSinVerificar(true);
        setLoading(false);
      },
      alErrorDesconocido: () => {
        setSesionSinVerificar(false);
        setLoading(false);
      },
      obtenerUsuarioActual: () => auth.currentUser,
      programar: (fn, ms) => setTimeout(fn, ms),
      cancelarTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      log: console,
    });
    cargadorRef.current = cargador;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        void cargador.cargar(currentUser);
      } else {
        cargador.cancelar();
        setUser(null);
        setSesionSinVerificar(false);
        setLoading(false);
      }
    });

    // The backoff timer recovers the session on its own; this just makes it
    // immediate when the browser reports connectivity (DevTools "Offline"
    // does not always fire it).
    const alVolverOnline = () => {
      void cargador.reintentarAhora();
    };
    window.addEventListener("online", alVolverOnline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", alVolverOnline);
      cargador.cancelar();
      cargadorRef.current = null;
    };
  }, []);

  const reintentarSesion = () => {
    void cargadorRef.current?.reintentarAhora();
  };

  const generateDefaultUserName = (email: string): string => {
    const [username] = email.split("@");
    return username;
  };

  const closeOnboardingModal = async (showOnLogin?: boolean) => {
    try {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          showOnboardingModal: showOnLogin || false,
        });
      }
    } catch (error) {
      console.error("Error al actualizar la preferencia del modal:", error);
    } finally {
      setIsOnboardingModalOpen(false);
    }
  };

  const registerUser = async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await new Promise((resolve) => setTimeout(resolve, 500));

      let defaultUserName = generateDefaultUserName(user.email || "");
      let isAvailable = await isUserNameAvailable(defaultUserName);

      if (!isAvailable) {
        let counter = 1;
        let alternativeUserName = `${defaultUserName}${counter}`;

        while (!(await isUserNameAvailable(alternativeUserName))) {
          counter++;
          alternativeUserName = `${defaultUserName}${counter}`;
        }

        defaultUserName = alternativeUserName;
      }

      await sendEmailVerification(user);

      const initialRole: UserRole = "visitor";

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        userName: defaultUserName,
        role: initialRole,
        profileCompleted: false,
        emailVerified: false,
        showOnboardingModal: true,
        createdAt: new Date(),
        subscriptionPlan: null,
        subscriptionStatus: null,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        previousSubscription: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });

      // ← FASE 0: reemplazado fetch directo por callSetUserRole
      try {
        await callSetUserRole(user.uid, initialRole);
      } catch (roleError) {
        console.warn("⚠️ No se pudo sincronizar custom claim en registro:", roleError);
      }

      console.log(`✅ Usuario registrado con role: ${initialRole}`);

      setIsVerifyEmailModalOpen(true);
      setIsSignInModalOpen(false);
    } catch (error: any) {
      console.error("Error al registrar usuario:", error.message);

      if (error.code === "auth/email-already-in-use") {
        alert(
          "Este correo electrónico ya está registrado. Intenta iniciar sesión."
        );
        setIsSignInModalOpen(false);
        setIsLoginModalOpen(true);
      } else if (error.code === "auth/weak-password") {
        alert("La contraseña debe tener al menos 6 caracteres.");
      } else if (error.code === "permission-denied") {
        alert("Error de configuración. Contacta al administrador.");
      } else {
        alert("Ocurrió un error inesperado. Inténtalo de nuevo más tarde.");
      }
    }
  };

  const loginUser = async (identifier: string, password: string) => {
    try {
      let email: string;
      let userUid: string | null = null;

      console.log("🔐 Iniciando proceso de login con:", identifier);

      if (identifier.includes("@")) {
        email = identifier.toLowerCase().trim();
        console.log("📧 Login con email:", email);

        console.log("🔍 Verificando métodos de autenticación para email...");
        const authInstance = getAuth();
        try {
          const authMethods = await fetchSignInMethodsForEmail(
            authInstance,
            email
          );
          console.log("📋 Métodos disponibles:", authMethods);

          if (authMethods.length > 0) {
            if (authMethods.length === 1 && authMethods[0] === "google.com") {
              throw new Error(
                "Este usuario se registró con Google. Por favor, usa 'Iniciar sesión con Google'."
              );
            }

            if (!authMethods.includes("password") && authMethods.length > 0) {
              throw new Error(
                "Este usuario no tiene contraseña configurada. Si te registraste con tu cuenta de Google, intenta usa 'Iniciar sesión con Google'."
              );
            }
          } else {
            console.log(
              "⚠️ No se pudieron obtener los métodos de autenticación. Continuando con el login..."
            );
          }
        } catch (authError: any) {
          console.error("Error al verificar métodos:", authError);
          if (
            authError.message?.includes("Google") ||
            authError.message?.includes("contraseña configurada")
          ) {
            throw authError;
          }
          console.log(
            "⚠️ Error al verificar métodos, pero continuando con autenticación..."
          );
        }
      } else {
        console.log("👤 Buscando usuario por userName:", identifier);

        const response = await fetch("/api/auth/find-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userName: identifier }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Error del servidor: ${response.status}`
          );
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Usuario no encontrado");
        }

        if (!result.data?.email || !result.data?.uid) {
          throw new Error("Datos de usuario incompletos");
        }

        email = result.data.email;
        userUid = result.data.uid;

        if (!result.data.canUsePassword) {
          const methods = result.data.authMethods || [];
          if (methods.includes("google.com")) {
            throw new Error(
              "Este usuario se registró con Google. Por favor, usa 'Iniciar sesión con Google'."
            );
          }
          throw new Error(
            "Este usuario no tiene contraseña configurada. Por favor, usa 'Iniciar sesión con Google'."
          );
        }

        console.log("✅ Usuario encontrado via API:", { email, uid: userUid });
      }

      console.log("🔥 Autenticando con Firebase Auth...");
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      const finalUid = userUid || user.uid;
      console.log("📄 Obteniendo datos de Firestore para UID:", finalUid);

      const userDocRef = doc(db, "users", finalUid);
      const userDocSnapshot = await getDoc(userDocRef);

      if (!userDocSnapshot.exists()) {
        console.error(
          "❌ Documento no encontrado en Firestore para UID:",
          finalUid
        );
        throw new Error("Datos de usuario no encontrados en Firestore.");
      }

      const userData = userDocSnapshot.data() as FirestoreUserData;
      console.log("✅ Datos de Firestore obtenidos:", userData);

      if (!userData.emailVerified && !user.emailVerified) {
        throw new Error(
          "Por favor, verifica tu correo electrónico antes de iniciar sesión."
        );
      }

      if (userData.role === "admin") {
        console.log("🔒 Usuario es admin, manteniendo rol");

        const extendedUser: ExtendedUser = {
          ...user,
          ...userData,
          role: "admin",
        };
        setUser(extendedUser);
        await syncSessionCookie(); // ← FASE 4

        console.log("✅ Login completado exitosamente con role: admin");

        setIsLoginModalOpen(false);

        if (!extendedUser.profileCompleted) {
          console.log("📝 Mostrando modal de completar registro");
          setIsCompleteRegisterModalOpen(true);
        } else if (extendedUser.showOnboardingModal) {
          console.log("🎯 Mostrando modal de onboarding");
          setIsOnboardingModalOpen(true);
        }

        return extendedUser;
      }

      const calculatedRole = calculateUserRole({
        emailVerified: user.emailVerified,
        profileCompleted: userData.profileCompleted,
        subscriptionPlan: userData.subscriptionPlan,
        subscriptionStatus: userData.subscriptionStatus,
        subscriptionEndDate: userData.subscriptionEndDate,
        previousSubscription: userData.previousSubscription,
      });

      if (userData.role !== calculatedRole) {
        console.log(
          `🔄 Actualizando role de "${userData.role}" a "${calculatedRole}"`
        );
        await updateDoc(userDocRef, {
          role: calculatedRole,
          updatedAt: new Date(),
        });

        // ← FASE 0: reemplazado fetch directo por callSetUserRole
        try {
          await callSetUserRole(finalUid, calculatedRole);
        } catch (roleError) {
          console.warn("⚠️ No se pudo sincronizar custom claim en login:", roleError);
        }
      }

      const extendedUser: ExtendedUser = {
        ...user,
        ...userData,
        role: calculatedRole,
      };
      setUser(extendedUser);
      await syncSessionCookie(); // ← FASE 4

      console.log("✅ Login completado exitosamente con role:", calculatedRole);

      setIsLoginModalOpen(false);

      if (!extendedUser.profileCompleted) {
        console.log("📝 Mostrando modal de completar registro");
        setIsCompleteRegisterModalOpen(true);
      } else if (extendedUser.showOnboardingModal) {
        console.log("🎯 Mostrando modal de onboarding");
        setIsOnboardingModalOpen(true);
      }

      return extendedUser;
    } catch (error: any) {
      console.error("❌ Error en login:", error);

      if (
        error.message?.includes("Google") ||
        error.message?.includes("contraseña configurada")
      ) {
        throw error;
      }

      switch (error.code) {
        case "auth/wrong-password":
        case "auth/invalid-credential":
          throw new Error(
            "Contraseña incorrecta. Por favor, verifica tus credenciales."
          );
        case "auth/user-not-found":
          throw new Error(
            "Usuario no encontrado. Verifica tu email o nombre de usuario."
          );
        case "auth/too-many-requests":
          throw new Error("Demasiados intentos fallidos. Intenta más tarde.");
        case "auth/invalid-email":
          throw new Error("Formato de correo electrónico inválido.");
        default:
          throw new Error(
            error.message || "Error al iniciar sesión. Inténtalo de nuevo."
          );
      }
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log("🔐 Iniciando login con Google...");
      const result = await signInWithPopup(auth, providerGoogle);
      await processGoogleSignIn(result.user);
    } catch (error: any) {
      console.error("Error al iniciar sesión con Google:", error);

      switch (error.code) {
        case "auth/popup-blocked":
          alert(
            "⚠️ Los popups están bloqueados\n\n" +
              "Solución:\n" +
              "1. Permite popups en la configuración de tu navegador\n" +
              "2. O prueba en Chrome/Safari (no en apps de redes sociales)"
          );
          break;

        case "auth/popup-closed-by-user":
          console.log("Usuario canceló el inicio de sesión");
          break;

        case "auth/cancelled-popup-request":
          console.log("Solicitud de popup cancelada");
          break;

        case "auth/unauthorized-domain":
          alert(
            "Error de configuración: dominio no autorizado.\n\n" +
              "Si eres el administrador, agrega este dominio en Firebase Console."
          );
          break;

        case "auth/network-request-failed":
          alert("Error de red. Verifica tu conexión a internet.");
          break;

        default:
          console.error("Error inesperado:", error);
          alert(
            "Error al iniciar sesión con Google.\n\n" +
              "Intenta de nuevo o usa email y contraseña."
          );
      }
    }
  };

  const processGoogleSignIn = async (user: User) => {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnapshot = await getDoc(userDocRef);

      if (!userDocSnapshot.exists()) {
        const initialRole: UserRole = "registered";

        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || "Usuario",
          userName: generateDefaultUserName(user.email || ""),
          role: initialRole,
          profileCompleted: false,
          emailVerified: true,
          showOnboardingModal: true,
          createdAt: new Date(),
          lastName: "",
          sex: "",
          country: "",
          roles: [],
          interests: [],
          subscriptionPlan: null,
          subscriptionStatus: null,
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          previousSubscription: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
        });

        // ← FASE 0: reemplazado fetch directo por callSetUserRole
        try {
          await callSetUserRole(user.uid, initialRole);
        } catch (roleError) {
          console.warn("⚠️ No se pudo sincronizar custom claim (Google, nuevo usuario):", roleError);
        }

        console.log(`✅ Nuevo usuario Google creado con role: ${initialRole}`);
      }

      const userData = (await getDoc(userDocRef)).data() as FirestoreUserData;

      if (userData.role === "admin") {
        console.log("🔒 Usuario es admin, manteniendo rol");

        const extendedUser: ExtendedUser = {
          ...user,
          ...userData,
          role: "admin",
        };

        setUser(extendedUser);
        await syncSessionCookie(); // ← FASE 4
        setIsLoginModalOpen(false);

        if (!userData.profileCompleted) {
          setIsCompleteRegisterModalOpen(true);
        } else if (userData.showOnboardingModal) {
          setIsOnboardingModalOpen(true);
        }

        return;
      }

      const calculatedRole = calculateUserRole({
        emailVerified: true,
        profileCompleted: userData.profileCompleted,
        subscriptionPlan: userData.subscriptionPlan,
        subscriptionStatus: userData.subscriptionStatus,
        subscriptionEndDate: userData.subscriptionEndDate,
        previousSubscription: userData.previousSubscription,
      });

      if (userData.role !== calculatedRole) {
        await updateDoc(userDocRef, {
          role: calculatedRole,
          updatedAt: new Date(),
        });

        // ← FASE 0: reemplazado fetch directo por callSetUserRole
        try {
          await callSetUserRole(user.uid, calculatedRole);
        } catch (roleError) {
          console.warn("⚠️ No se pudo sincronizar custom claim (Google, usuario existente):", roleError);
        }
      }

      const extendedUser: ExtendedUser = {
        ...user,
        ...userData,
        role: calculatedRole,
      };

      setUser(extendedUser);
      await syncSessionCookie(); // ← FASE 4
      setIsLoginModalOpen(false);

      if (!userData.profileCompleted) {
        setIsCompleteRegisterModalOpen(true);
      } else if (userData.showOnboardingModal) {
        setIsOnboardingModalOpen(true);
      }
    } catch (error) {
      console.error("Error al procesar login de Google:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // ← FASE 4: destruir cookie de sesión antes de cerrar sesión en Firebase
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
      await signOut(auth);
      setUser(null);
      setIsOnboardingModalOpen(false);

      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("Ocurrió un error al cerrar sesión.");
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return "Correo de recuperación enviado correctamente.";
    } catch (error: any) {
      console.error("Error al recuperar la contraseña:", error.message);
      if (error.code === "auth/user-not-found") {
        throw new Error(
          "No se encontró ningún usuario con este correo electrónico."
        );
      } else {
        throw new Error(
          "Ocurrió un error al intentar recuperar la contraseña."
        );
      }
    }
  };

  const updateAuthEmail = async (newEmail: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Usuario no autenticado");
      await firebaseUpdateEmail(currentUser, newEmail);
      await sendEmailVerification(currentUser);

      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        email: newEmail,
        updatedAt: new Date().toISOString(),
      });

      setUser((prevUser) => {
        if (!prevUser) return null;
        return { ...prevUser, email: newEmail };
      });

      alert(
        "Correo electrónico actualizado. Por favor, verifica tu nueva dirección."
      );
    } catch (error: any) {
      console.error(
        "Error al actualizar el correo electrónico:",
        error.message
      );
      alert(`Ocurrió un error al actualizar el correo: ${error.message}`);
    }
  };

  const debugUserToken = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const idTokenResult = await user.getIdTokenResult(true);
        console.log("Token del usuario:", idTokenResult.claims);
        alert("Revisa la consola para ver los claims del token.");
      } catch (error) {
        console.error("Error al obtener el token del usuario:", error);
        alert("Ocurrió un error al depurar el token del usuario.");
      }
    } else {
      console.log("No hay usuario autenticado.");
      alert("No hay usuario autenticado.");
    }
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    try {
      const userDocRef = doc(db, "users", uid);
      await updateDoc(userDocRef, {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });

      // ← FASE 0: reemplazado fetch directo por callSetUserRole
      await callSetUserRole(uid, newRole);

      setUser((prevUser) => {
        if (!prevUser) return null;
        return { ...prevUser, role: newRole };
      });

      console.log(`✅ Rol actualizado a: ${newRole}`);
    } catch (error) {
      console.error("Error al actualizar el rol del usuario:", error);
      alert("Ocurrió un error al actualizar el rol del usuario.");
    }
  };

  const activateSubscription = async (
    plan: SubscriptionPlan,
    stripeSubscriptionId?: string
  ) => {
    if (!user) {
      throw new Error("Usuario no autenticado");
    }

    if (!plan) {
      throw new Error("Plan de suscripción no especificado");
    }

    if (user.role === "admin") {
      console.log("🔒 Usuario admin detectado, no se modificará el rol");
      return;
    }

    try {
      console.log(`🎯 Activando suscripción ${plan} para usuario ${user.uid}`);

      const userDocRef = doc(db, "users", user.uid);
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const updateData: any = {
        subscriptionPlan: plan,
        subscriptionStatus: "active" as SubscriptionStatus,
        subscriptionStartDate: startDate.toISOString(),
        subscriptionEndDate: endDate.toISOString(),
        previousSubscription: null,
        updatedAt: new Date().toISOString(),
      };

      if (stripeSubscriptionId) {
        updateData.stripeSubscriptionId = stripeSubscriptionId;
      }

      await updateDoc(userDocRef, updateData);

      const newRole = calculateUserRole({
        emailVerified: user.emailVerified ?? true,
        profileCompleted: user.profileCompleted ?? true,
        subscriptionPlan: plan,
        subscriptionStatus: "active",
        subscriptionEndDate: endDate.toISOString(),
        previousSubscription: null,
      });

      await updateDoc(userDocRef, {
        role: newRole,
      });

      // ← FASE 0: reemplazado fetch directo por callSetUserRole
      await callSetUserRole(user.uid, newRole);

      setUser((prevUser) => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          subscriptionPlan: plan,
          subscriptionStatus: "active",
          subscriptionStartDate: startDate.toISOString(),
          subscriptionEndDate: endDate.toISOString(),
          stripeSubscriptionId: stripeSubscriptionId || null,
          role: newRole,
        };
      });

      console.log(`✅ Suscripción ${plan} activada. Nuevo role: ${newRole}`);
      alert(`¡Suscripción ${plan} activada exitosamente!`);
    } catch (error: any) {
      console.error("Error al activar suscripción:", error);
      throw new Error(`Error al activar suscripción: ${error.message}`);
    }
  };

  const cancelSubscription = async () => {
    if (!user) {
      throw new Error("Usuario no autenticado");
    }

    if (!user.subscriptionPlan || user.subscriptionStatus !== "active") {
      throw new Error("No hay suscripción activa para cancelar");
    }

    if (user.role === "admin") {
      console.log("🔒 Usuario admin detectado, no se modificará el rol");
      return;
    }

    try {
      console.log(`🚫 Cancelando suscripción para usuario ${user.uid}`);

      const userDocRef = doc(db, "users", user.uid);
      const previousPlan = user.subscriptionPlan;

      await updateDoc(userDocRef, {
        subscriptionStatus: "cancelled" as SubscriptionStatus,
        previousSubscription: previousPlan,
        updatedAt: new Date().toISOString(),
      });

      const newRole = calculateUserRole({
        emailVerified: user.emailVerified ?? true,
        profileCompleted: user.profileCompleted ?? true,
        subscriptionPlan: previousPlan,
        subscriptionStatus: "cancelled",
        subscriptionEndDate: user.subscriptionEndDate,
        previousSubscription: previousPlan,
      });

      await updateDoc(userDocRef, {
        role: newRole,
      });

      // ← FASE 0: reemplazado fetch directo por callSetUserRole
      await callSetUserRole(user.uid, newRole);

      setUser((prevUser) => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          subscriptionStatus: "cancelled",
          previousSubscription: previousPlan,
          role: newRole,
        };
      });

      console.log(`✅ Suscripción cancelada. Nuevo role: ${newRole}`);
      alert("Suscripción cancelada exitosamente.");
    } catch (error: any) {
      console.error("Error al cancelar suscripción:", error);
      throw new Error(`Error al cancelar suscripción: ${error.message}`);
    }
  };

  const checkAndUpdateExpiredSubscriptions = async () => {
    if (!user) return;

    if (user.role === "admin") {
      console.log(
        "🔒 Usuario admin detectado, omitiendo verificación de expiración"
      );
      return;
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnapshot = await getDoc(userDocRef);

      if (!userDocSnapshot.exists()) return;

      const userData = userDocSnapshot.data() as FirestoreUserData;

      if (
        userData.subscriptionEndDate &&
        new Date(userData.subscriptionEndDate) < new Date() &&
        userData.subscriptionStatus === "active"
      ) {
        console.log("⏰ Suscripción expirada detectada");

        await updateDoc(userDocRef, {
          subscriptionStatus: "expired" as SubscriptionStatus,
          updatedAt: new Date().toISOString(),
        });

        const newRole: UserRole = "expired";

        await updateDoc(userDocRef, {
          role: newRole,
        });

        // ← FASE 0: reemplazado fetch directo por callSetUserRole
        try {
          await callSetUserRole(user.uid, newRole);
        } catch (roleError) {
          console.warn("⚠️ No se pudo sincronizar custom claim (expiración):", roleError);
        }

        setUser((prevUser) => {
          if (!prevUser) return null;
          return {
            ...prevUser,
            subscriptionStatus: "expired",
            role: newRole,
          };
        });

        console.log(
          `✅ Suscripción marcada como expirada. Nuevo role: ${newRole}`
        );
      }
    } catch (error) {
      console.error("Error al verificar suscripciones expiradas:", error);
    }
  };

  useEffect(() => {
    if (user) {
      checkAndUpdateExpiredSubscriptions();
    }
  }, [user?.uid]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        sesionSinVerificar,
        reintentarSesion,
        isSignInModalOpen,
        setIsSignInModalOpen,
        isVerifyEmailModalOpen,
        setIsVerifyEmailModalOpen,
        isCompleteRegisterModalOpen,
        setIsCompleteRegisterModalOpen,
        isRegisterModalOpen,
        setIsRegisterModalOpen,
        isRegistrationSuccessModalOpen,
        setIsRegistrationSuccessModalOpen,
        isLoginModalOpen,
        setIsLoginModalOpen,
        isOnboardingModalOpen,
        setIsOnboardingModalOpen,
        closeOnboardingModal,
        registerUser,
        loginUser,
        signInWithGoogle,
        logout,
        resetPassword,
        updateAuthEmail,
        debugUserToken,
        updateUserRole,
        activateSubscription,
        cancelSubscription,
        checkAndUpdateExpiredSubscriptions,
      }}
    >
      {loading ? (sesionSinVerificar ? <EsperaSesionPendiente /> : null) : children}
    </AuthContext.Provider>
  );
};
