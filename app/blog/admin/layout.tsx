// app/blog/admin/layout.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/");
      } else if (user.role !== "admin") {
        alert("No tienes permisos para acceder al panel de administración.");
        router.push("/");
      } else {
        setIsChecking(false);
      }
    }
  }, [user, loading, router]);

  // Cerrar menú mobile al cambiar de ruta
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevenir scroll del body cuando el menú mobile está abierto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  // Escape key para cerrar modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileMenuOpen]);

  if (loading || isChecking) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-white-eske dark:bg-[#0B1620]"
        role="status"
        aria-live="polite"
        aria-label="Verificando permisos de administrador"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bluegreen-eske mx-auto" aria-hidden="true"></div>
          <p className="mt-4 text-black-eske-20 dark:text-[#9AAEBE]">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  const navigation = [
    {
      name: "Dashboard",
      href: "/blog/admin",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      name: "Posts",
      href: "/blog/admin/blog",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      name: "Comentarios",
      href: "/blog/admin/comments",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      name: "Tags",
      href: "/blog/admin/tags",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      ),
    },
    {
      name: "Medios",
      href: "/blog/admin/media",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      badge: "Próximamente",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex flex-col">
      {/* Top Bar - Mobile & Desktop */}
      <header className="bg-white-eske dark:bg-[#112230] border-b border-gray-eske-30 dark:border-white/10 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Botón Hamburguesa - Solo Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-black-eske-40 dark:text-[#9AAEBE] hover:bg-gray-eske-10 dark:hover:bg-white/5 rounded-lg transition-colors focus-ring-primary"
              aria-label="Abrir menú de navegación"
              aria-expanded={isMobileMenuOpen}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Logo & Título */}
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 lg:w-10 lg:h-10 bg-bluegreen-eske rounded-lg flex items-center justify-center"
                aria-hidden="true"
              >
                <span className="text-white font-bold text-lg lg:text-xl">
                  E
                </span>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-black-eske dark:text-[#EAF2F8] text-sm lg:text-base">
                  Admin Panel
                </h1>
                <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">El Baúl de Fouché</p>
              </div>
            </div>
          </div>

          {/* Actions - Desktop */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/blog"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske-70 transition-colors text-sm focus-ring-primary"
              aria-label="Ver blog público"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="hidden sm:inline">Ver Blog</span>
            </Link>

            {/* User Avatar - Mobile */}
            <div 
              className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-eske rounded-full flex items-center justify-center lg:hidden"
              role="img"
              aria-label={`Avatar de ${user?.name || 'administrador'}`}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-xs sm:text-sm" aria-hidden="true">
                  {user?.name?.charAt(0) || "A"}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside 
          className="hidden lg:block w-64 bg-white-eske dark:bg-[#112230] border-r border-gray-eske-30 dark:border-white/10 shadow-sm"
          aria-label="Navegación principal del panel de administración"
        >
          <nav className="p-4 space-y-2" aria-label="Menú principal">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 focus-ring-primary ${
                    isActive
                      ? "bg-bluegreen-eske text-white shadow-md"
                      : "text-black-eske-40 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.badge ? `${item.name} (${item.badge})` : item.name}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span 
                      className="text-xs px-2 py-1 bg-yellow-eske-20 text-black-eske rounded-full"
                      aria-label={item.badge}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Info - Desktop */}
          <div 
            className="absolute bottom-0 left-0 w-64 p-4 border-t border-gray-eske-30 dark:border-white/10 bg-white-eske dark:bg-[#112230]"
            role="region"
            aria-label="Información del usuario administrador"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 bg-orange-eske rounded-full flex items-center justify-center flex-shrink-0"
                role="img"
                aria-label={`Avatar de ${user?.name || 'administrador'}`}
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-sm" aria-hidden="true">
                    {user?.name?.charAt(0) || "A"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] truncate">
                  {user?.name || "Admin"}
                </p>
                <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE] truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Continúa en parte 2... */}
        {/* Sidebar Mobile - Overlay */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            ></div>

            {/* Sidebar Mobile */}
            <aside 
              className="fixed top-0 left-0 h-full w-64 bg-white-eske dark:bg-[#112230] shadow-2xl z-50 lg:hidden transform transition-transform duration-300"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-menu-title"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-eske-30 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 bg-bluegreen-eske rounded-lg flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="text-white font-bold text-xl">E</span>
                  </div>
                  <div>
                    <h2 
                      id="mobile-menu-title"
                      className="font-bold text-black-eske dark:text-[#EAF2F8]"
                    >
                      Admin Panel
                    </h2>
                    <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">El Baúl de Fouché</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-black-eske-20 dark:text-[#9AAEBE] hover:bg-gray-eske-10 dark:hover:bg-white/5 rounded-lg transition-colors focus-ring-primary"
                  aria-label="Cerrar menú de navegación"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Navigation */}
              <nav className="p-4 space-y-2" aria-label="Menú principal mobile">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 focus-ring-primary ${
                        isActive
                          ? "bg-bluegreen-eske text-white shadow-md"
                          : "text-black-eske-40 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.badge ? `${item.name} (${item.badge})` : item.name}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span className="font-medium">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span 
                          className="text-xs px-2 py-1 bg-yellow-eske-20 text-black-eske rounded-full"
                          aria-label={item.badge}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* User Info Mobile */}
              <div 
                className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-eske-30 dark:border-white/10 bg-white-eske dark:bg-[#112230]"
                role="region"
                aria-label="Información del usuario administrador"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 bg-orange-eske rounded-full flex items-center justify-center flex-shrink-0"
                    role="img"
                    aria-label={`Avatar de ${user?.name || 'administrador'}`}
                  >
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-sm" aria-hidden="true">
                        {user?.name?.charAt(0) || "A"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] truncate">
                      {user?.name || "Admin"}
                    </p>
                    <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE] truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

