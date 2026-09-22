// app/newsletter/unsubscribe/page.tsx
import { Suspense } from "react";
import UnsubscribeContent from "./UnsubscribeContent";

export const metadata = {
  title: "Cancelar suscripción - El Baúl de Fouché",
  description: "Cancelar suscripción al newsletter de Eskemma",
};

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div 
        className="min-h-screen bg-gradient-to-br from-white-eske-40 to-gray-eske-10 dark:from-[#0B1620] dark:to-[#112230] flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Cargando página de cancelación de suscripción"
      >
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-bluegreen-eske"></div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
