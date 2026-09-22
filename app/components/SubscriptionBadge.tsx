// app/components/SubscriptionBadge.tsx
"use client";
import { useAuth } from "@/context/AuthContext";
import { getRoleName } from "@/utils/roleUtils";
import {
  getDaysRemaining,
  formatExpirationDate,
} from "@/utils/subscriptionUtils";
import type { SubscriptionPlan } from "@/types/subscription.types";

interface SubscriptionBadgeProps {
  plan?: SubscriptionPlan | null; // Prop opcional para pasar plan manualmente
}

export default function SubscriptionBadge({ plan: externalPlan }: SubscriptionBadgeProps = {}) {
  const { user } = useAuth();

  if (!user) return null;

  // Usar plan externo si se provee, sino usar el del usuario
  const plan = externalPlan !== undefined ? externalPlan : user.subscriptionPlan;

  const daysRemaining = getDaysRemaining(user.subscriptionEndDate || null);
  const expirationDate = formatExpirationDate(user.subscriptionEndDate || null);

  const getBadgeColor = (): string => {
    switch (user.role) {
      case "admin":
        return "bg-red-eske-60 text-white";
      case "basic":
        return "bg-blue-eske text-white";
      case "premium":
        return "bg-premium-eske text-white";
      case "professional":
        return "bg-green-eske-60 text-white";
      case "expired":
        return "bg-red-eske text-white";
      case "unsubscribed-basic":
      case "unsubscribed-premium":
      case "unsubscribed-professional":
        return "bg-orange-eske text-white";
      case "user":
        return "bg-bluegreen-eske text-white";
      case "registered":
        return "bg-gray-eske-60 text-black-eske";
      case "visitor":
        return "bg-gray-eske-40 text-black-eske-40";
      default:
        return "bg-gray-eske-70 text-black-eske";
    }
  };

  const showExtraInfo = () => {
    if (user.role === "admin") return null;

    if (["basic", "premium", "professional"].includes(user.role) && daysRemaining > 0) {
      return (
        <span className="ml-2 max-sm:ml-1.5 text-xs max-sm:text-[10px] opacity-90">
          ({daysRemaining} día{daysRemaining !== 1 ? "s" : ""} restante{daysRemaining !== 1 ? "s" : ""})
        </span>
      );
    }

    if (user.role === "expired") {
      return (
        <span className="ml-2 max-sm:ml-1.5 text-xs max-sm:text-[10px] opacity-90">
          (Expiró {expirationDate})
        </span>
      );
    }

    if (["unsubscribed-basic", "unsubscribed-premium", "unsubscribed-professional"].includes(user.role)) {
      return (
        <span className="ml-2 max-sm:ml-1.5 text-xs max-sm:text-[10px] opacity-90">
          (Cancelado)
        </span>
      );
    }

    return null;
  };

  const getAriaLabel = (): string => {
    const roleName = getRoleName(user.role);

    if (user.role === "admin") {
      return "Rol de administrador del sistema";
    }

    if (["basic", "premium", "professional"].includes(user.role) && daysRemaining > 0) {
      return `Suscripción ${roleName}, ${daysRemaining} día${daysRemaining !== 1 ? "s" : ""} restante${daysRemaining !== 1 ? "s" : ""}`;
    }

    if (user.role === "expired") {
      return `Suscripción expirada el ${expirationDate}`;
    }

    if (["unsubscribed-basic", "unsubscribed-premium", "unsubscribed-professional"].includes(user.role)) {
      return `Suscripción ${roleName} cancelada`;
    }

    return `Estado de cuenta: ${roleName}`;
  };

  return (
    <div
      className={`inline-flex items-center px-3 max-sm:px-2 py-1.5 max-sm:py-1 rounded-full text-sm max-sm:text-xs font-medium ${getBadgeColor()} shadow-sm`}
      role="status"
      aria-label={getAriaLabel()}
    >
      <span aria-hidden="true">{getRoleName(user.role)}</span>
      <span aria-hidden="true">{showExtraInfo()}</span>
    </div>
  );
}
