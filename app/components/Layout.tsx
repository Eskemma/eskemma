// app/components/layout.tsx
"use client"; // Indica que es un Client Component

import { AuthProvider } from "../../context/AuthContext"; // Importa el contexto de autenticación
import Header from "./Header";
import Footer from "./Footer";
import CompleteRegisterModal from "./componentsHome/CompleteRegisterModal";
import RegisterModal from "./componentsHome/RegisterModal"; // Importa el modal de registro
import RegistrationSuccessModal from "./componentsHome/RegistrationSuccessModal"; // Importa el modal de éxito
import { useAuth } from "../../context/AuthContext"; // Importa el hook useAuth

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {" "}
      {/* Envuelve toda la aplicación */}
      <InnerLayout>{children}</InnerLayout>
    </AuthProvider>
  );
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const {
    isCompleteRegisterModalOpen,
    setIsCompleteRegisterModalOpen,
    isRegisterModalOpen,
    setIsRegisterModalOpen,
    isRegistrationSuccessModalOpen,
    setIsRegistrationSuccessModalOpen,
  } = useAuth();

  return (
    <div>
      {/* Encabezado Fixed */}
      <header data-cubre-dialogo className="fixed top-0 left-0 right-0 z-50 bg-white-eske dark:bg-[#112230]">
        <Header />
      </header>

      {/* Contenido Principal con Padding */}
      <main id="main-content" className="pt-20" tabIndex={-1}>
        {children}
      </main>

      {/* Pie de Página */}
      <div data-cubre-dialogo>
        <Footer />
      </div>

      {/* Modal de Correo Verificado */}
      {isCompleteRegisterModalOpen && (
        <CompleteRegisterModal
          isOpen={isCompleteRegisterModalOpen}
          onClose={() => setIsCompleteRegisterModalOpen(false)}
        />
      )}

      {/* Modal de Registro */}
      {isRegisterModalOpen && (
        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
        />
      )}

      {/* Modal de Éxito */}
      {isRegistrationSuccessModalOpen && (
        <RegistrationSuccessModal
          isOpen={isRegistrationSuccessModalOpen}
          onClose={() => setIsRegistrationSuccessModalOpen(false)}
        />
      )}
    </div>
  );
}
