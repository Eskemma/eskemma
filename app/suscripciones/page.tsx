// app/suscripciones/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import Button from "../components/Button";
import SubscriptionBadge from "../components/SubscriptionBadge";
import {
  SUBSCRIPTION_PRICES,
  PLAN_FEATURES,
  getPlanName,
  hasPremiumAccess,
  getDaysRemaining,
  formatExpirationDate,
} from "../../utils/subscriptionUtils";

// ✅ CAMBIADO: Usar "professional" en lugar de "grupal"
type SubscriptionPlan = "basic" | "premium" | "professional";

export default function SuscripcionesPage() {
  const router = useRouter();
  const { user, activateSubscription, cancelSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Redirigir si no hay usuario autenticado
  if (!user) {
    router.push("/");
    return null;
  }

  const hasActiveSubscription = hasPremiumAccess(user.role || "");
  const daysRemaining = getDaysRemaining(user.subscriptionEndDate || null);
  const expirationDate = formatExpirationDate(user.subscriptionEndDate || null);

  // Manejar selección de plan
  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (hasActiveSubscription && user.subscriptionPlan === plan) {
      alert("Ya tienes este plan activo");
      return;
    }
    setSelectedPlan(plan);
  };

  // Procesar suscripción (preparado para Stripe)
  const handleSubscribe = async () => {
    if (!selectedPlan) {
      alert("Por favor, selecciona un plan");
      return;
    }

    setIsProcessing(true);

    try {
      console.log(`🎯 Procesando suscripción al plan: ${selectedPlan}`);

      await activateSubscription(selectedPlan);

      alert(`¡Suscripción al ${getPlanName(selectedPlan)} activada exitosamente!`);
      setSelectedPlan(null);
    } catch (error: any) {
      console.error("Error al procesar suscripción:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancelar suscripción
  const handleCancelSubscription = async () => {
    const confirm = window.confirm(
      "¿Estás seguro de que deseas cancelar tu suscripción? Perderás el acceso a las funciones premium al finalizar el período actual."
    );

    if (!confirm) return;

    setIsProcessing(true);

    try {
      await cancelSubscription();
      alert("Suscripción cancelada exitosamente");
    } catch (error: any) {
      console.error("Error al cancelar suscripción:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-white-eske-40 dark:bg-[#0B1620] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-bluegreen-eske mb-4">
            Planes de Suscripción
          </h1>
          <p className="text-lg text-black-eske-20 dark:text-[#9AAEBE] max-w-2xl mx-auto">
            Elige el plan que mejor se adapte a tus necesidades y lleva tu
            aprendizaje al siguiente nivel
          </p>

          {/* Mostrar estado actual */}
          {user && (
            <div className="mt-6 flex justify-center">
              <SubscriptionBadge />
            </div>
          )}

          {hasActiveSubscription && (
            <div 
              className="mt-4 bg-blue-eske/10 dark:bg-[#112230] border border-blue-eske/30 dark:border-white/10 rounded-lg p-4 max-w-md mx-auto"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm text-blue-eske-90 dark:text-[#6BA4C6]">
                <strong>Plan actual:</strong> {getPlanName(user.subscriptionPlan || null)}
              </p>
              {daysRemaining > 0 && (
                <p className="text-sm text-blue-eske-60 dark:text-[#4791B3] mt-1">
                  Expira el {expirationDate} ({daysRemaining} día{daysRemaining !== 1 ? 's' : ''} restante{daysRemaining !== 1 ? 's' : ''})
                </p>
              )}
            </div>
          )}
        </header>

        {/* Planes */}
        <section aria-labelledby="plans-title">
          <h2 id="plans-title" className="sr-only">Planes disponibles</h2>
          <div 
            className="grid md:grid-cols-3 gap-8 mb-12"
            role="list"
            aria-label="3 planes de suscripción disponibles"
          >
            {/* Plan Básico */}
            <article
              className={`bg-white dark:bg-[#18324A] rounded-lg shadow-lg p-8 border-2 transition-all duration-300 ${
                selectedPlan === "basic"
                  ? "border-blue-eske dark:border-blue-eske-30 transform scale-105"
                  : "border-gray-eske-20 dark:border-white/10 hover:border-blue-eske/40 dark:hover:border-white/20"
              }`}
              role="listitem"
            >
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-2">
                  Plan Básico
                </h3>
                <div className="text-4xl font-bold text-blue-eske-60 mb-2">
                  ${SUBSCRIPTION_PRICES.basic}
                  <span className="text-lg text-black-eske-20 dark:text-[#9AAEBE]">/mes</span>
                </div>
                <p className="text-black-eske-20 dark:text-[#9AAEBE]">Ideal para comenzar</p>
              </div>

              <ul 
                className="space-y-3 mb-8"
                role="list"
                aria-label="Características del plan básico"
              >
                {PLAN_FEATURES.basic.map((feature, index) => (
                  <li key={index} className="flex items-start" role="listitem">
                    <svg
                      className="w-5 h-5 text-green-eske mr-2 mt-0.5 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-black-eske-40 dark:text-[#C7D6E0] text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                label={
                  user.subscriptionPlan === "basic"
                    ? "Plan Actual"
                    : selectedPlan === "basic"
                    ? "Seleccionado"
                    : "Seleccionar"
                }
                variant={selectedPlan === "basic" ? "primary" : "secondary"}
                onClick={() => handleSelectPlan("basic")}
                disabled={user.subscriptionPlan === "basic"}
              />
            </article>

            {/* Plan Premium */}
            <article
              className={`bg-white dark:bg-[#18324A] rounded-lg shadow-lg p-8 border-2 transition-all duration-300 relative ${
                selectedPlan === "premium"
                  ? "border-premium-eske dark:border-premium-eske-20 transform scale-105"
                  : "border-premium-eske/40 dark:border-premium-eske/30 hover:border-premium-eske dark:hover:border-premium-eske-20"
              }`}
              role="listitem"
            >
              {/* Badge "Más Popular" */}
              <div 
                className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                aria-label="Plan más popular"
              >
                <span className="bg-premium-eske text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Más Popular
                </span>
              </div>

              <div className="text-center mb-6 mt-4">
                <h3 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-2">
                  Plan Premium
                </h3>
                <div className="text-4xl font-bold text-premium-eske mb-2">
                  ${SUBSCRIPTION_PRICES.premium}
                  <span className="text-lg text-black-eske-20 dark:text-[#9AAEBE]">/mes</span>
                </div>
                <p className="text-black-eske-20 dark:text-[#9AAEBE]">Para profesionales</p>
              </div>

              <ul 
                className="space-y-3 mb-8"
                role="list"
                aria-label="Características del plan premium"
              >
                {PLAN_FEATURES.premium.map((feature, index) => (
                  <li key={index} className="flex items-start" role="listitem">
                    <svg
                      className="w-5 h-5 text-green-eske mr-2 mt-0.5 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-black-eske-40 dark:text-[#C7D6E0] text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                label={
                  user.subscriptionPlan === "premium"
                    ? "Plan Actual"
                    : selectedPlan === "premium"
                    ? "Seleccionado"
                    : "Seleccionar"
                }
                variant={selectedPlan === "premium" ? "primary" : "secondary"}
                onClick={() => handleSelectPlan("premium")}
                disabled={user.subscriptionPlan === "premium"}
              />
            </article>

            {/* Plan Professional (antes Grupal) */}
            <article
              className={`bg-white dark:bg-[#18324A] rounded-lg shadow-lg p-8 border-2 transition-all duration-300 ${
                selectedPlan === "professional"
                  ? "border-green-eske dark:border-green-eske-30 transform scale-105"
                  : "border-gray-eske-20 dark:border-white/10 hover:border-green-eske/40 dark:hover:border-white/20"
              }`}
              role="listitem"
            >
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-2">
                  Plan Professional
                </h3>
                <div className="text-4xl font-bold text-green-eske-60 mb-2">
                  ${SUBSCRIPTION_PRICES.professional}
                  <span className="text-lg text-black-eske-20 dark:text-[#9AAEBE]">/mes</span>
                </div>
                <p className="text-black-eske-20 dark:text-[#9AAEBE]">Para equipos y empresas</p>
              </div>

              <ul 
                className="space-y-3 mb-8"
                role="list"
                aria-label="Características del plan professional"
              >
                {PLAN_FEATURES.professional.map((feature, index) => (
                  <li key={index} className="flex items-start" role="listitem">
                    <svg
                      className="w-5 h-5 text-green-eske mr-2 mt-0.5 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-black-eske-40 dark:text-[#C7D6E0] text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                label={
                  user.subscriptionPlan === "professional"
                    ? "Plan Actual"
                    : selectedPlan === "professional"
                    ? "Seleccionado"
                    : "Seleccionar"
                }
                variant={selectedPlan === "professional" ? "primary" : "secondary"}
                onClick={() => handleSelectPlan("professional")}
                disabled={user.subscriptionPlan === "professional"}
              />
            </article>
          </div>
        </section>

        {/* Botones de acción */}
        <div className="flex justify-center gap-4" role="group" aria-label="Acciones de suscripción">
          {selectedPlan && !hasActiveSubscription && (
            <Button
              label={isProcessing ? "Procesando..." : "Confirmar Suscripción"}
              variant="primary"
              onClick={handleSubscribe}
              disabled={isProcessing}
            />
          )}

          {hasActiveSubscription && user.subscriptionStatus === "active" && (
            <Button
              label={isProcessing ? "Cancelando..." : "Cancelar Suscripción"}
              variant="secondary"
              onClick={handleCancelSubscription}
              disabled={isProcessing}
            />
          )}
        </div>

        {/* Nota sobre integración futura */}
        <aside 
          className="mt-12 bg-yellow-eske/10 border border-yellow-eske/30 dark:border-yellow-eske/40 rounded-lg p-6 max-w-3xl mx-auto"
          role="note"
          aria-labelledby="integration-note-title"
        >
          <h4 
            id="integration-note-title"
            className="font-semibold text-brown-eske-60 dark:text-yellow-eske mb-2 flex items-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            Integración de pagos pendiente
          </h4>
          <p className="text-sm text-brown-eske-60 dark:text-yellow-eske/80">
            Actualmente, la funcionalidad de suscripción está en modo de prueba.
            La integración con Stripe para procesar pagos reales se implementará
            próximamente. Por ahora, puedes activar cualquier plan para probar
            las funcionalidades.
          </p>
        </aside>
      </div>
    </main>
  );
}
