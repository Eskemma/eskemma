// app/components/Header.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { Bars3Icon } from "@heroicons/react/24/solid";
import SignInModal from "./componentsHome/SignInModal";
import LoginModal from "./componentsHome/LoginModal";
import OnboardingModal from "./componentsHome/OnboardingModal";
import NotificationBell from "./NotificationBell";
import { useEscapeKey } from "../hooks/useEscapeKey";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("eskemma:theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("eskemma:theme", "light");
    }
    setIsDark(next);
    setIsAvatarMenuOpen(false);
  };

  const {
    isSignInModalOpen,
    setIsSignInModalOpen,
    isLoginModalOpen,
    setIsLoginModalOpen,
    isOnboardingModalOpen,
    setIsOnboardingModalOpen,
    closeOnboardingModal,
    user,
    logout,
  } = useAuth();

  // Cerrar menús con Escape
  useEscapeKey(isMenuOpen, () => setIsMenuOpen(false));
  useEscapeKey(isAvatarMenuOpen, () => setIsAvatarMenuOpen(false));

  // Cerrar el menú de hamburguesa al hacer clic fuera
  useEffect(() => {
    const handleClickOutsideMenu = (event: MouseEvent) => {
      const menuButton = document.querySelector(".menu-button");
      const menuDropdown = document.querySelector(".menu-dropdown");

      if (
        !menuButton?.contains(event.target as Node) &&
        !menuDropdown?.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutsideMenu);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideMenu);
    };
  }, []);

  // Cerrar el menú del avatar al hacer clic fuera
  useEffect(() => {
    const handleClickOutsideAvatarMenu = (event: MouseEvent) => {
      const avatarButton = document.querySelector(".avatar-button");
      const avatarDropdown = document.querySelector(".avatar-dropdown");

      if (
        isAvatarMenuOpen &&
        !avatarButton?.contains(event.target as Node) &&
        !avatarDropdown?.contains(event.target as Node)
      ) {
        setIsAvatarMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutsideAvatarMenu);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideAvatarMenu);
    };
  }, [isAvatarMenuOpen]);

  // Función para generar las iniciales del usuario
  const getUserInitials = (name?: string, lastName?: string): string => {
    if (!name && !lastName) return "JD";
    const firstNameInitial = name ? name.charAt(0).toUpperCase() : "";
    const lastNameInitial = lastName ? lastName.charAt(0).toUpperCase() : "";
    return `${firstNameInitial}${lastNameInitial}`;
  };

  // Función para manejar la redirección al perfil
  const handleProfileClick = () => {
    setIsAvatarMenuOpen(false);
    router.push("/profile");
  };

  const handleAvatarClick = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lastVisitedPage", window.location.pathname);
    }
    setIsAvatarMenuOpen((prev) => !prev);
  };

  return (
    <>
      {/* Modal de Registro */}
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* Modal de Inicio de Sesión */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onOpenRegisterModal={() => setIsSignInModalOpen(true)}
      />

      {/* OnboardingModal de Bienvenida */}
      {user?.profileCompleted && (
        <OnboardingModal
          isOpen={isOnboardingModalOpen}
          onClose={closeOnboardingModal}
          userName={user.name || "Usuario"}
        />
      )}

      {/* Encabezado */}
      <header className="bg-white-eske text-black-eske py-5 px-6 sm:px-10 md:px-14 sticky top-0 z-[100] dark:bg-[#112230] dark:text-[#EAF2F8]">
        <div className="w-full flex justify-between items-center">
          {/* Contenedor Izquierdo (Logo) */}
          <div>
            <a href="/" aria-label="Eskemma - Ir a la página de inicio" className="focus-ring-primary rounded">
              <img
                src="/images/esk_log_csm.svg"
                alt="Eskemma - Consultoría política"
                className="h-4 w-auto sm:h-8 md:h-10 dark:hidden"
              />
              <img
                src="/images/esk_log_wsm.svg"
                alt="Eskemma - Consultoría política"
                className="h-4 w-auto sm:h-8 md:h-10 hidden dark:block"
                aria-hidden="true"
              />
            </a>
          </div>

          {/* Contenedor Derecho (Links, Ícono de Hamburguesa y Avatar) */}
          <div className="flex items-center space-x-4 max-sm:space-x-2">

            {/* Ícono de Hamburguesa */}
            <button
              className="cursor-pointer p-2 text-black-eske hover:text-blue-eske-80 dark:text-[#EAF2F8] dark:hover:text-[#6FC3EC] focus-ring-primary rounded menu-button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
              aria-expanded={isMenuOpen}
              aria-controls="main-navigation"
            >
              <Bars3Icon className="h-6 w-6 max-sm:h-6 max-sm:w-6 text-black-eske hover:text-blue-eske-80 dark:text-[#EAF2F8]" aria-hidden="true" />
            </button>                     
          
            {/* Avatar (Visible después de iniciar sesión) */}
            {user && (
              <div className="relative">
                <button
                  className="w-10 h-10 max-sm:w-8 max-sm:h-8 bg-orange-400 rounded-full flex items-center justify-center cursor-pointer focus-ring-primary avatar-button"
                  onClick={handleAvatarClick}
                  aria-label={`Menú de ${user.name || 'usuario'}`}
                  aria-expanded={isAvatarMenuOpen}
                  aria-haspopup="menu"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={`Avatar de ${user.name || 'usuario'}`}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xs max-sm:text-[10px] font-bold text-gray-600">
                      {getUserInitials(user.name, user.lastName)}
                    </span>
                  )}
                </button>

                {/* Menú Desplegable del Avatar */}
                {isAvatarMenuOpen && (
                  <div 
                    className="absolute top-full right-0 mt-2 w-48 bg-white shadow-md rounded-lg overflow-hidden z-[110] avatar-dropdown dark:bg-[#18324A] dark:border dark:border-white/10 dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
                    role="menu"
                    aria-label="Menú de usuario"
                  >
                    <ul className="text-sm">
                      <li role="none">
                        <button
                          role="menuitem"
                          className="w-full text-left px-4 py-2 hover:bg-gray-eske-10 cursor-pointer hover:text-bluegreen-eske hover:font-semibold focus-ring-primary dark:text-[#C7D6E0] dark:hover:bg-white/5 dark:hover:text-[#6FC3EC]"
                          onClick={handleProfileClick}
                        >
                          Perfil
                        </button>
                      </li>
                      <li role="none">
                        <button
                          role="menuitem"
                          className="w-full text-left px-4 py-2 hover:bg-gray-eske-10 cursor-pointer hover:text-bluegreen-eske hover:font-semibold focus-ring-primary dark:text-[#C7D6E0] dark:hover:bg-white/5 dark:hover:text-[#6FC3EC]"
                          onClick={toggleTheme}
                        >
                          {mounted && isDark ? "Modo Claro" : "Modo Oscuro"}
                        </button>
                      </li>
                      <li role="none">
                        <button
                          role="menuitem"
                          className="w-full text-left px-4 py-2 hover:bg-gray-eske-10 cursor-pointer hover:text-bluegreen-eske hover:font-semibold focus-ring-primary dark:text-[#C7D6E0] dark:hover:bg-white/5 dark:hover:text-[#6FC3EC]"
                          onClick={logout}
                        >
                          Cerrar Sesión
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Notificaciones (solo para usuarios autenticados) */}
            {user && <NotificationBell />}

          </div>

          {/* Menú Desplegable (Hamburguesa) */}
          <div
            id="main-navigation"
            className={`absolute top-full right-0 bg-white-eske shadow-md mt-2 py-4 z-[110] text-base max-sm:text-sm transition-all duration-300 menu-dropdown dark:bg-[#18324A] dark:text-[#C7D6E0] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] ${
              isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
            }`}
            role="menu"
            aria-label="Menú principal de navegación"
          >
            <nav>
              <ul className="flex flex-col space-y-2 px-4 max-sm:px-3">
                <li role="none">
                  <a
                    href="/"
                    role="menuitem"
                    className="block px-4 max-sm:px-3 py-2 rounded hover:bg-blue-eske hover:text-white hover:font-bold transition-colors duration-300 focus-ring-primary dark:hover:bg-[#4791B3] dark:hover:text-[#EAF2F8]"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    INICIO
                  </a>
                </li>
                <li role="none">
                  <a
                    href="/sefix"
                    role="menuitem"
                    className="block px-4 max-sm:px-3 py-2 rounded hover:bg-blue-eske hover:text-white hover:font-bold transition-colors duration-300 focus-ring-primary dark:hover:bg-[#4791B3] dark:hover:text-[#EAF2F8]"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    SEFIX
                  </a>
                </li>
                <li role="none">
                  <a
                    href="/servicios"
                    role="menuitem"
                    className="block px-4 max-sm:px-3 py-2 rounded hover:bg-blue-eske hover:text-white hover:font-bold transition-colors duration-300 focus-ring-primary dark:hover:bg-[#4791B3] dark:hover:text-[#EAF2F8]"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    SERVICIOS
                  </a>
                </li>
                <li role="none">
                  <a
                    href="/blog"
                    role="menuitem"
                    className="block px-4 max-sm:px-3 py-2 rounded hover:bg-blue-eske hover:text-white hover:font-bold transition-colors duration-300 focus-ring-primary dark:hover:bg-[#4791B3] dark:hover:text-[#EAF2F8]"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    EL BAÚL DE FOUCHÉ
                  </a>
                </li>
                <li role="none">
                  <a
                    href="/contacto"
                    role="menuitem"
                    className="block px-4 max-sm:px-3 py-2 rounded hover:bg-blue-eske hover:text-white hover:font-bold transition-colors duration-300 focus-ring-primary dark:hover:bg-[#4791B3] dark:hover:text-[#EAF2F8]"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    CONTACTO
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
