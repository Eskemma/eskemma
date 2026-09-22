// app/newsletter/unsubscribe/UnsubscribeContent.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const UNSUBSCRIBE_REASONS = [
  "Recibo demasiados emails.",
  "El contenido no es lo que esperaba.",
  "Nunca me suscribí a esta lista.",
  "Prefiero seguirlos en redes sociales.",
  "El diseño de los emails no me convence.",
];

export default function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<
    "form" | "loading" | "success" | "already-unsubscribed"
  >("form");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [otherReason, setOtherReason] = useState("");
  const [error, setError] = useState("");
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [countdown, setCountdown] = useState(20);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      const decodedEmail = decodeURIComponent(emailParam);
      setEmail(decodedEmail);
      fetchUserData(decodedEmail);
    } else {
      setLoadingUserData(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === "success" || status === "already-unsubscribed") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            window.close();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status]);

  const fetchUserData = async (userEmail: string) => {
    try {
      const response = await fetch(
        `/api/newsletter/get-subscriber?email=${encodeURIComponent(userEmail)}`
      );
      const data = await response.json();

      if (data.success && data.subscriber) {
        setName(data.subscriber.name || "");

        if (data.subscriber.status === "unsubscribed") {
          setStatus("already-unsubscribed");
          setMessage("Ya te habías desuscrito anteriormente.");
        }
      }
    } catch (error) {
      console.error("Error al obtener datos del usuario:", error);
    } finally {
      setLoadingUserData(false);
    }
  };

  const handleReasonToggle = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Por favor, ingresa tu email");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          reasons: selectedReasons,
          otherReason: otherReason.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage(data.message);
        setCountdown(20);
      } else if (data.alreadyUnsubscribed) {
        setStatus("already-unsubscribed");
        setMessage(data.message);
        setName(data.subscriberName || name);
        setCountdown(20);
      } else {
        setStatus("form");
        setError(data.message || "Algo no salió bien. ¿Intentas de nuevo?");
      }
    } catch (error) {
      setStatus("form");
      setError("Hubo un problema al procesar tu solicitud");
    }
  };

  const firstName = name ? name.split(" ")[0] : "";

  if (loadingUserData) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white-eske-40 to-gray-eske-10 dark:from-[#0B1620] dark:to-[#112230] flex items-center justify-center px-4 py-12">
        <div
          className="bg-white dark:bg-[#18324A] rounded-2xl shadow-xl p-12 text-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="animate-spin rounded-full h-16 w-16 border-b-4 border-bluegreen-eske mx-auto mb-6"
            aria-hidden="true"
          ></div>
          <h2 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-2">Cargando...</h2>
          <p className="text-black-eske-20 dark:text-[#9AAEBE]">Un momento por favor</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white-eske-40 to-gray-eske-10 dark:from-[#0B1620] dark:to-[#112230] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* FORMULARIO */}
        {status === "form" && (
          <div className="bg-white dark:bg-[#18324A] rounded-2xl shadow-xl p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="inline-block bg-gradient-to-br from-bluegreen-eske to-bluegreen-eske-70 text-white px-6 py-2 rounded-full text-sm font-semibold mb-4">
                El Baúl de Fouché
              </div>
              <h1 className="text-2xl md:text-4xl font-bold text-black-eske dark:text-[#EAF2F8] mb-3">
                {firstName && (
                  <span className="block text-bluegreen-eske mb-2">
                    {firstName},
                  </span>
                )}
                <span className="italic">¡Sentimos mucho que te vayas!</span> 😢
              </h1>
              <p className="text-xl text-black-eske-20 dark:text-[#9AAEBE] font-medium mb-2">
                ¿Podemos pedirte que lo consideres?
              </p>
            </div>

            <div className="bg-blue-eske/10 dark:bg-[#112230] border-l-4 border-bluegreen-eske rounded-lg p-6 mb-8">
              <p className="text-black-eske-40 dark:text-[#C7D6E0] leading-relaxed mb-4">
                Sentimos que quieras dejarnos{firstName && `, ${firstName}`}.
                Ojalá podamos hacer algo para evitarlo. Si no es así, gracias
                por el tiempo que nos dedicaste.
              </p>
              <p className="text-black-eske-40 dark:text-[#C7D6E0] leading-relaxed">
                Queremos pedirte un último favor: si nos cuentas{" "}
                <strong>por qué te vas</strong>, será más fácil para nosotros
                ofrecer un mejor producto a nuestros suscriptores. Y quién
                sabe... tal vez podamos hacer que te quedes con nosotros. 🤔
              </p>
            </div>

            <form
              onSubmit={handleUnsubscribe}
              className="space-y-6"
              aria-label="Formulario para cancelar suscripción al newsletter"
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Confirma tu email{" "}
                  <span className="text-red-eske" aria-label="campo requerido">
                    *
                  </span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full px-4 py-3 border border-gray-eske-40 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder:text-[#6D8294] rounded-lg focus-ring-primary transition-all"
                  aria-required="true"
                />
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-3">
                  ¿Por qué decides desuscribirte? (opcional, pero muy valioso
                  para nosotros)
                </legend>
                <div
                  className="space-y-2"
                  role="group"
                  aria-label="Razones para cancelar la suscripción"
                >
                  {UNSUBSCRIBE_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className="flex items-start p-4 border border-gray-eske-20 dark:border-white/10 rounded-lg hover:bg-white-eske-40 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedReasons.includes(reason)}
                        onChange={() => handleReasonToggle(reason)}
                        className="mt-0.5 h-5 w-5 text-bluegreen-eske border-gray-eske-40 rounded focus-ring-primary cursor-pointer"
                        aria-label={reason}
                      />
                      <span className="ml-3 text-black-eske-40 dark:text-[#C7D6E0] group-hover:text-black-eske dark:group-hover:text-[#EAF2F8] transition-colors">
                        {reason}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label
                  htmlFor="otherReason"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  ¿Hay algo más que quieras decirnos?
                </label>
                <textarea
                  id="otherReason"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Cuéntanos lo que piensas... Toda opinión es bienvenida"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-eske-40 rounded-lg focus-ring-primary transition-all resize-none"
                  aria-describedby="other-reason-hint"
                />
                <p
                  id="other-reason-hint"
                  className="text-xs text-black-eske-10 dark:text-[#6D8294] mt-2"
                >
                  Tu feedback nos ayuda a mejorar. No te llevará más de un
                  minuto. 🙏
                </p>
              </div>

              {error && (
                <div
                  className="bg-red-eske/10 dark:bg-red-eske/20 border border-red-eske/30 dark:border-red-eske/40 rounded-lg p-4"
                  role="alert"
                  aria-live="assertive"
                >
                  <p className="text-sm text-red-eske-80">{error}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-red-eske-40 to-red-eske-70 text-white font-semibold py-3 px-6 rounded-lg hover:from-red-eske-30 hover:to-red-eske transition-all shadow-md hover:shadow-lg focus-ring-primary"
                  aria-label="Confirmar cancelación de suscripción"
                >
                  Confirmar cancelación
                </button>
                <Link
                  href="/blog"
                  className="flex-1 text-center border-2 border-bluegreen-eske text-bluegreen-eske font-semibold py-3 px-6 rounded-lg hover:bg-bluegreen-eske hover:text-white transition-all focus-ring-primary"
                  aria-label="No cancelar, volver al blog"
                >
                  ¡Me quedo!
                </Link>
              </div>

              <div className="text-center pt-4">
                <p className="text-sm text-black-eske-10 dark:text-[#6D8294]">
                  Recuerda{firstName && `, ${firstName}`}: siempre puedes volver
                  cuando quieras. Te estaremos esperando. ❤️
                </p>
              </div>
            </form>
          </div>
        )}

        {/* LOADING */}
        {status === "loading" && (
          <div
            className="bg-white dark:bg-[#18324A] rounded-2xl shadow-xl p-12 text-center"
            role="status"
            aria-live="polite"
          >
            <div
              className="animate-spin rounded-full h-16 w-16 border-b-4 border-bluegreen-eske mx-auto mb-6"
              aria-hidden="true"
            ></div>
            <h2 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-2">
              Procesando tu solicitud...
            </h2>
            <p className="text-black-eske-20 dark:text-[#9AAEBE]">Un momento por favor</p>
          </div>
        )}

        {/* YA DESUSCRITO */}
        {status === "already-unsubscribed" && (
          <div
            className="bg-white dark:bg-[#18324A] rounded-2xl shadow-xl p-8 md:p-12"
            role="status"
            aria-live="polite"
          >
            <div className="text-center">
              <div className="mb-6" aria-hidden="true">
                <svg
                  className="w-20 h-20 text-yellow-eske mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <h2 className="text-3xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4">
                {firstName && `${firstName}, `}Ya te habías desuscrito
              </h2>

              <p className="text-lg text-black-eske-40 dark:text-[#C7D6E0] mb-6 leading-relaxed">
                No te preocupes, tu desuscripción ya estaba registrada desde
                antes.
              </p>

              <div className="bg-gradient-to-br from-blue-eske/10 to-white-eske-40 dark:from-[#112230] dark:to-[#18324A] border border-blue-eske/30 dark:border-white/10 rounded-xl p-6 mb-8">
                <p className="text-black-eske dark:text-[#EAF2F8] font-medium mb-3">
                  💙 <strong>¿Cambiaste de opinión?</strong>
                </p>
                <p className="text-black-eske-40 dark:text-[#C7D6E0] text-sm leading-relaxed mb-4">
                  Si deseas volver a recibir nuestro newsletter, siempre puedes
                  suscribirte de nuevo. Las puertas del Baúl están abiertas para
                  ti.
                </p>
                <Link
                  href="/blog"
                  className="inline-block bg-gradient-to-r from-bluegreen-eske to-bluegreen-eske-70 text-white font-semibold py-3 px-8 rounded-lg hover:from-bluegreen-eske-70 hover:to-bluegreen-eske transition-all shadow-md hover:shadow-lg focus-ring-primary"
                  aria-label="Suscribirme de nuevo al newsletter"
                >
                  Suscribirme de nuevo
                </Link>
              </div>

              <div className="space-y-3 mb-6">
                <p
                  className="text-sm text-black-eske-10 dark:text-[#6D8294]"
                  role="timer"
                  aria-live="polite"
                >
                  Esta ventana se cerrará automáticamente en{" "}
                  <strong>{countdown}</strong> segundo
                  {countdown !== 1 ? "s" : ""}...
                </p>
                <button
                  onClick={() => window.close()}
                  className="text-bluegreen-eske hover:text-bluegreen-eske-70 font-medium text-sm underline transition-colors focus-ring-primary rounded"
                  aria-label="Cerrar ventana ahora"
                >
                  Cerrar ahora
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {status === "success" && (
          <div
            className="bg-white dark:bg-[#18324A] rounded-2xl shadow-xl p-8 md:p-12"
            role="status"
            aria-live="polite"
          >
            <div className="text-center">
              <div className="mb-6" aria-hidden="true">
                <svg
                  className="w-20 h-20 text-orange-eske mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <h2 className="text-3xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4">
                {firstName
                  ? `${firstName}, tu suscripción ha sido `
                  : "Suscripción "}
                cancelada
              </h2>

              <p className="text-lg text-black-eske-40 dark:text-[#C7D6E0] mb-6 leading-relaxed">
                {message}
              </p>

              <div className="bg-gradient-to-br from-bluegreen-eske-10 to-blue-eske/10 dark:from-[#112230] dark:to-[#18324A] border border-bluegreen-eske-30 dark:border-white/10 rounded-xl p-6 mb-8">
                <p className="text-black-eske dark:text-[#EAF2F8] font-medium mb-3">
                  💙 <strong>Gracias por tu contribución</strong>
                </p>
                <p className="text-black-eske-40 dark:text-[#C7D6E0] text-sm leading-relaxed mb-3">
                  {firstName && `${firstName}, `}tu opinión nos ayuda a crear
                  mejores contenidos para quienes se quedan. Si alguna vez
                  cambias de opinión, las puertas del Baúl siempre están
                  abiertas para ti.
                </p>
                <p className="text-black-eske-20 dark:text-[#9AAEBE] text-sm italic">
                  &quot;Un político sabio aprende más de sus críticos que de sus
                  aduladores.&quot;
                  <span className="text-xs block mt-1">
                    - Adaptado de Fouché
                  </span>
                </p>
              </div>

              <div
                className="bg-blue-eske/10 dark:bg-[#112230] border border-blue-eske/30 dark:border-white/10 rounded-lg p-4 mb-6"
                role="note"
              >
                <p className="text-sm text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  <strong>¿Cambiaste de opinión?</strong>
                </p>
                <Link
                  href="/blog"
                  className="inline-block text-bluegreen-eske hover:text-bluegreen-eske-70 font-medium text-sm underline transition-colors focus-ring-primary rounded"
                  aria-label="Volver a suscribirme al newsletter"
                >
                  Volver a suscribirme →
                </Link>
              </div>

              <div className="space-y-3">
                <p
                  className="text-sm text-black-eske-10 dark:text-[#6D8294]"
                  role="timer"
                  aria-live="polite"
                >
                  Esta ventana se cerrará automáticamente en{" "}
                  <strong>{countdown}</strong> segundo
                  {countdown !== 1 ? "s" : ""}...
                </p>
                <button
                  onClick={() => window.close()}
                  className="text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#C7D6E0] font-medium text-sm underline transition-colors focus-ring-primary rounded"
                  aria-label="Cerrar ventana ahora"
                >
                  Cerrar ahora
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
