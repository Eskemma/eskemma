// app/contact/page.tsx

"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../context/AuthContext";

export default function ContactoPage() {
  const { user, setIsSignInModalOpen, setIsLoginModalOpen } = useAuth();

  // Estado del formulario
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // ✅ Verificar si el usuario está autenticado con roles válidos
  const isAuthenticatedUser =
    user &&
    [
      "visitor",
      "registered",
      "user",
      "basic",
      "premium",
      "grupal",
      "unsubscribed-basic",
      "unsubscribed-premium",
      "unsubscribed-grupal",
      "expired",
      "admin",
    ].includes(user.role || "");

  // ✅ Prellenar datos si el usuario está autenticado (solo la primera vez)
  useEffect(() => {
    if (isAuthenticatedUser && user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
      }));
    } else {
      // Limpiar campos si el usuario cierra sesión
      setFormData((prev) => ({
        ...prev,
        name: "",
        email: "",
      }));
    }
  }, [user?.uid]); // ✅ Solo se ejecuta cuando cambia el usuario (login/logout)

  // Manejar cambios en el formulario
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.message.trim()
    ) {
      setSubmitStatus({
        type: "error",
        message: "Por favor, completa todos los campos.",
      });
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setSubmitStatus({
        type: "error",
        message: "Por favor, ingresa un correo electrónico válido.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      console.log("📤 Enviando mensaje a la API...");

      // ✅ ENVIAR A LA API
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          message: formData.message.trim(),
          userId: user?.uid || null,
          userRole: user?.role || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al enviar el mensaje");
      }

      console.log("✅ Mensaje guardado con ID:", data.messageId);

      setSubmitStatus({
        type: "success",
        message: "¡Mensaje enviado exitosamente! Te responderemos pronto.",
      });

      // Limpiar solo el mensaje (mantener nombre y email)
      setFormData((prev) => ({
        ...prev,
        message: "",
      }));

      // Hacer scroll hacia arriba para que vean el mensaje de éxito
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      console.error("❌ Error al enviar mensaje:", error);
      setSubmitStatus({
        type: "error",
        message:
          error.message ||
          "Ocurrió un error al enviar el mensaje. Inténtalo de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Abrir modal de registro (SignInModal)
  const handleOpenSignUp = () => {
    setIsSignInModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      {/* Hero Section - Responsiva CON IMAGEN EN MOBILE */}
      <section
        className="relative min-h-[250px] sm:h-[200px] md:h-[200px] w-full flex items-center bg-bluegreen-eske overflow-hidden"
        aria-labelledby="hero-title"
      >
        {/* Imagen de Fondo */}
        <Image
          src="/images/yanmin_yang.jpg"
          alt="imagen de fondo"
          fill
          style={{ objectFit: "cover" }}
          className="absolute inset-0 z-0"
          priority
          aria-hidden="true"
        />

        {/* Overlay con opacidad */}
        <div className="absolute inset-0 bg-bluegreen-eske dark:bg-bluegreen-eske-80 opacity-75 z-10" aria-hidden="true"></div>

        <div className="relative z-20 w-full max-w-screen-xl mx-auto flex flex-col md:flex-row items-center md:h-full px-4 sm:px-6 md:px-8 py-6 md:py-0">
          {/* Imagen de Persona Sonriendo - Mobile: arriba (120px), Desktop: izquierda (altura completa) */}
          <div className="w-full md:w-1/2 relative h-[120px] md:h-full max-md:mb-4" aria-hidden="true">
            <Image
              src="/images/womanContact.jpg"
              alt="imagen de mujer atendiendo clientes por teléfono"
              fill
              style={{
                objectFit: "contain",
                objectPosition: "center",
              }}
              priority
            />
          </div>

          {/* Contenido del Hero - Mobile: centrado, Desktop: izquierda */}
          <div className="w-full md:w-1/2 flex flex-col justify-center text-center md:text-left">
            <h1
              id="hero-title"
              className="text-2xl sm:text-[26px] md:text-[28px] max-sm:text-xl leading-tight font-bold text-white-eske"
            >
              Estamos aquí para escucharte
            </h1>
            <p className="mt-2 text-sm sm:text-[15px] md:text-[16px] max-sm:text-xs leading-relaxed font-light text-white-eske">
              Facilitamos tu contacto con nosotros.{" "}
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              Resolvemos tus dudas y construimos juntos.
            </p>
          </div>
        </div>
      </section>

      {/* Sección: ¿Para qué puedes contactarnos? */}
      <section
        className="bg-gray-eske-10 dark:bg-[#112230] py-12 max-sm:py-8 px-4 sm:px-6 md:px-8"
        aria-labelledby="contact-reasons-title"
      >
        <div className="w-[90%] mx-auto max-w-screen-xl">
          <h2
            id="contact-reasons-title"
            className="text-3xl max-sm:text-2xl font-semibold text-center text-bluegreen-eske dark:text-[#6BA4C6] mb-8 max-sm:mb-6"
          >
            ¿Para qué puedes contactarnos?
          </h2>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-sm:gap-6"
            role="list"
            aria-label="Razones para contactarnos"
          >
            {/* Item 1 */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <img
                src="/icons/icon_Consultoria.svg"
                alt=""
                width={60}
                height={60}
                className="mb-4 max-sm:mb-3 max-sm:w-12 max-sm:h-12 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Contratar Servicios
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Si deseas contratar nuestros servicios.
              </p>
            </article>

            {/* Item 2 */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <img
                src="/icons/icon_Info.svg"
                alt=""
                width={60}
                height={60}
                className="mb-4 max-sm:mb-3 max-sm:w-12 max-sm:h-12 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Pedir Información
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Para resolver dudas sobre nuestros productos o servicios.
              </p>
            </article>

            {/* Item 3 */}
            <article className="flex flex-col items-center text-center" role="listitem">
              <img
                src="/icons/icon_Blog.svg"
                alt=""
                width={60}
                height={60}
                className="mb-4 max-sm:mb-3 max-sm:w-12 max-sm:h-12 transition-transform duration-300 ease-in-out hover:scale-130"
                aria-hidden="true"
              />
              <h3 className="text-xl max-sm:text-lg font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-2 max-sm:mb-1">
                Publicar en el Blog
              </h3>
              <p className="text-[16px] max-sm:text-sm font-light text-gray-eske-90 dark:text-[#9AAEBE]">
                Si tienes contenido relevante para nuestro blog.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Sección: ¿Cómo puedes contactarnos? */}
      <section
        className="bg-white-eske dark:bg-[#0B1620] py-12 max-sm:py-8 px-4 sm:px-6 md:px-8"
        aria-labelledby="contact-methods-title"
      >
        <div className="w-[90%] mx-auto max-w-screen-xl">
          <h2
            id="contact-methods-title"
            className="text-3xl max-sm:text-2xl font-semibold text-center text-bluegreen-eske dark:text-[#6BA4C6] mb-8 max-sm:mb-6"
          >
            ¿Cómo puedes contactarnos?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-sm:gap-6">
            {/* Datos de Contacto */}
            <div className="space-y-4 max-sm:space-y-3" role="region" aria-label="Información de contacto">
              <p className="text-lg max-sm:text-base font-light text-black-eske dark:text-[#C7D6E0]">
                <span className="font-bold text-bluegreen-eske">Teléfono:</span>{" "}
                <a
                  href="tel:+525555555555"
                  className="hover:text-bluegreen-eske transition-colors focus-ring-primary rounded"
                  aria-label="Llamar al teléfono +52 55 5555 5555"
                >
                  +52 55 5555 5555
                </a>
              </p>
              <p className="text-lg max-sm:text-base font-light text-black-eske dark:text-[#C7D6E0]">
                <span className="font-bold text-bluegreen-eske">Email:</span>{" "}
                <a
                  href="mailto:contacto@eskemma.com"
                  className="hover:text-bluegreen-eske transition-colors focus-ring-primary rounded"
                  aria-label="Enviar correo a contacto@eskemma.com"
                >
                  contacto@eskemma.com
                </a>
              </p>
              <p className="text-lg max-sm:text-base font-light text-black-eske dark:text-[#C7D6E0]">
                <span className="font-bold text-bluegreen-eske">
                  Dirección:
                </span>{" "}
                Av. Reforma #222, CDMX, México
              </p>
              <p className="text-lg max-sm:text-base font-light text-black-eske dark:text-[#C7D6E0]">
                <span className="font-bold text-bluegreen-eske">
                  Horario de Atención:
                </span>{" "}
                <time>Lunes a Viernes, 9:00 - 18:00</time>
              </p>
              <p className="text-lg max-sm:text-base font-light text-black-eske dark:text-[#C7D6E0]">
                <span className="font-bold text-bluegreen-eske">
                  Tiempo de Respuesta:
                </span>{" "}
                24 horas hábiles
              </p>
            </div>

            {/* Formulario */}
            <div>
              <form
                onSubmit={handleSubmit}
                className="space-y-4 max-sm:space-y-3"
                aria-label="Formulario de contacto"
              >
                <h3 className="text-2xl max-sm:text-xl font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mb-4 max-sm:mb-3">
                  Escríbenos
                </h3>

                {/* ✅ Mensaje de éxito/error global */}
                {submitStatus.type && (
                  <div
                    className={`p-4 max-sm:p-3 rounded-lg mb-4 max-sm:mb-3 ${submitStatus.type === "success"
                        ? "bg-green-eske/10 dark:bg-green-eske/20 border border-green-eske/30 dark:border-green-eske/40 text-green-eske-90 dark:text-green-eske-30"
                        : "bg-red-eske/10 dark:bg-red-eske/20 border border-red-eske/30 dark:border-red-eske/40 text-red-eske-80 dark:text-red-eske-20"
                      }`}
                    role={submitStatus.type === "error" ? "alert" : "status"}
                    aria-live={submitStatus.type === "error" ? "assertive" : "polite"}
                  >
                    <p className="text-sm max-sm:text-xs font-medium">
                      {submitStatus.message}
                    </p>
                  </div>
                )}

                {/* Campo: Nombre */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-black-eske dark:text-[#C7D6E0] font-medium mb-1 text-base max-sm:text-sm"
                  >
                    Nombre <span className="text-red-eske dark:text-red-eske-20" aria-label="campo requerido">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-eske-40 dark:border-white/10 rounded-md shadow-sm focus-ring-primary px-3 py-2 max-sm:py-1.5 transition-colors bg-white dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294] text-base max-sm:text-sm"
                    placeholder="Tu nombre completo"
                    aria-describedby={isAuthenticatedUser && formData.name ? "name-hint" : undefined}
                  />
                  {/* ✅ Mensaje informativo para usuarios autenticados */}
                  {isAuthenticatedUser && formData.name && (
                    <p
                      id="name-hint"
                      className="text-xs max-sm:text-[10px] text-black-eske-10 dark:text-[#6D8294] mt-1"
                      role="status"
                    >
                      ℹ️ Prellenado con tu información de perfil (puedes
                      editarlo)
                    </p>
                  )}
                </div>

                {/* Campo: Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-black-eske dark:text-[#C7D6E0] font-medium mb-1 text-base max-sm:text-sm"
                  >
                    Email <span className="text-red-eske dark:text-red-eske-20" aria-label="campo requerido">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-eske-40 dark:border-white/10 rounded-md shadow-sm focus-ring-primary px-3 py-2 max-sm:py-1.5 transition-colors bg-white dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294] text-base max-sm:text-sm"
                    placeholder="tu@email.com"
                    aria-describedby={isAuthenticatedUser && formData.email ? "email-hint" : undefined}
                  />
                  {/* ✅ Mensaje informativo para usuarios autenticados */}
                  {isAuthenticatedUser && formData.email && (
                    <p
                      id="email-hint"
                      className="text-xs max-sm:text-[10px] text-black-eske-10 dark:text-[#6D8294] mt-1"
                      role="status"
                    >
                      ℹ️ Prellenado con tu información de perfil (puedes
                      editarlo)
                    </p>
                  )}
                </div>

                {/* Campo: Mensaje */}
                <div>
                  <label
                    htmlFor="message"
                    className="block text-black-eske dark:text-[#C7D6E0] font-medium mb-1 text-base max-sm:text-sm"
                  >
                    Mensaje <span className="text-red-eske dark:text-red-eske-20" aria-label="campo requerido">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={4}
                    required
                    className="mt-1 block w-full border border-gray-eske-40 dark:border-white/10 rounded-md shadow-sm focus-ring-primary px-3 py-2 max-sm:py-1.5 dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294] text-base max-sm:text-sm"
                    placeholder="Escribe tu mensaje aquí..."
                  ></textarea>
                </div>

                {/* ✅ Mensaje para usuarios NO autenticados */}
                {!isAuthenticatedUser && (
                  <div
                    className="bg-blue-eske/10 dark:bg-blue-eske/20 border border-blue-eske/30 rounded-lg p-4 max-sm:p-3 mb-4 max-sm:mb-3 text-center"
                    role="note"
                  >
                    <p className="text-sm max-sm:text-xs text-blue-eske-90 dark:text-blue-eske-20">
                      ¿No tienes cuenta?{" "}
                      <button
                        type="button"
                        onClick={handleOpenSignUp}
                        className="text-bluegreen-eske font-semibold underline hover:text-bluegreen-eske-70 transition-colors focus-ring-primary rounded"
                        aria-label="Abrir formulario de registro"
                      >
                        Regístrate aquí
                      </button>
                    </p>
                  </div>
                )}

                {/* Botón de envío */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-orange-eske text-white-eske px-6 py-3 max-sm:py-2.5 rounded-lg font-medium hover:bg-orange-eske-70 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus-ring-primary text-base max-sm:text-sm"
                  aria-label={isSubmitting ? "Enviando mensaje" : "Enviar mensaje"}
                >
                  {isSubmitting ? "ENVIANDO..." : "ENVIAR MENSAJE"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

