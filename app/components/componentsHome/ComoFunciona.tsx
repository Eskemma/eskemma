// app/components/componentsHome/ComoFunciona.tsx
import { ReactNode } from "react";

const steps: { label: ReactNode }[] = [
  { label: "Regístrate" },
  { label: "Explora el ecosistema" },
  {
    label: (
      <>
        Diseña tu proyecto
        <br />
        con estrategia y datos
      </>
    ),
  },
  {
    label: (
      <>
        Dirige y monitorea
        <br />
        tu estrategia con IA
      </>
    ),
  },
];

export default function ComoFunciona() {
  return (
    <section
      className="bg-white-eske py-16 max-sm:py-10 px-4 sm:px-6 md:px-8 dark:bg-[#0B1620]"
      aria-labelledby="como-funciona-heading"
    >
      <div className="w-[90%] mx-auto max-w-7xl">
        <h2
          id="como-funciona-heading"
          className="text-3xl max-sm:text-xl font-semibold text-center text-bluegreen-eske mb-14 max-sm:mb-10 dark:text-[#6BA4C6]"
        >
          Cómo funciona
        </h2>

        <div className="relative mb-16 max-sm:mb-10">
          {/* Connector line — desktop only */}
          <div
            className="hidden sm:block absolute top-7 left-[12.5%] right-[12.5%] h-px bg-gray-eske-40 dark:bg-white/10 z-0"
            aria-hidden="true"
          />

          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-y-10 sm:gap-y-0">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex flex-col items-center text-center px-2 sm:px-3"
              >
                <div
                  className="relative z-10 w-14 h-14 max-sm:w-11 max-sm:h-11 rounded-full bg-bluegreen-eske text-white-eske flex items-center justify-center text-xl max-sm:text-base font-bold mb-4 max-sm:mb-3 flex-shrink-0"
                  aria-hidden="true"
                >
                  {i + 1}
                </div>
                <p className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] leading-snug">
                  {step.label}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Video placeholder — replace with VideoPresentation when ready */}
        <div className="relative w-full max-w-170 mx-auto overflow-hidden shadow-lg rounded-lg bg-gray-eske-20 dark:bg-[#18324A]">
          <div className="relative aspect-video w-full flex items-center justify-center">
            <p className="text-gray-eske-60 dark:text-[#9AAEBE] text-sm font-light text-center px-4">
              Video de demostración — próximamente
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
