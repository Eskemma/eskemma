// app/components/componentsHome/ComoFunciona.tsx

const steps = [
  {
    title: "Regístrate gratis",
    description:
      "Tu primera fase de Moddulo está disponible desde el primer día, sin tarjeta de crédito.",
  },
  {
    title: "Define tu proyecto",
    description:
      "Moddulo te hace las preguntas correctas y construye contigo la estrategia desde la evidencia.",
  },
  {
    title: "Conoce tu territorio",
    description:
      "Sefix y Centinela te dan los datos electorales y el contexto político que tu proyecto necesita.",
  },
  {
    title: "Ejecuta, monitorea y mejora",
    description:
      "Diseña tu estrategia, decide tácticas concretas, y monitorea el avance en tiempo real. El equipo y los recursos de Eskemma están disponibles en cada etapa.",
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

          <ol className="grid grid-cols-1 sm:grid-cols-4 gap-y-8 sm:gap-y-0">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex flex-col items-center text-center px-2 sm:px-4"
              >
                <div
                  className="relative z-10 w-14 h-14 max-sm:w-11 max-sm:h-11 rounded-full bg-bluegreen-eske text-white-eske flex items-center justify-center text-xl max-sm:text-base font-bold mb-4 max-sm:mb-3 flex-shrink-0"
                  aria-hidden="true"
                >
                  {i + 1}
                </div>
                <p className="text-sm font-semibold text-black-eske dark:text-[#C7D6E0] leading-snug mb-2">
                  {step.title}
                </p>
                <p className="text-xs font-light text-black-eske/70 dark:text-[#9AAEBE] leading-relaxed max-w-xs sm:max-w-none">
                  {step.description}
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
