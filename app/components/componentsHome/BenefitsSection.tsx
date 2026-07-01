// components/Home/BenefitsSection.tsx

"use client";

import { useState, useEffect, useRef } from "react";

const BenefitsSection = () => {
  const [flippedCards, setFlippedCards] = useState<boolean[]>(
    Array(9).fill(false)
  );
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  const cards = [
    {
      front: "Contexto",
      back: "Antes de proponer cualquier solución, Eskemma entiende el escenario específico del proyecto. No hay receta universal que funcione en política. Lo que hay es un diagnóstico honesto para una estrategia real.",
      bg: "bg-blue-eske-60",
      text: "text-white-eske",
    },
    {
      front: "Certeza",
      back: "No prometemos victorias. Prometemos que cada decisión tiene mejor información. En política, es la diferencia entre reaccionar y anticipar.",
      bg: "bg-white-eske",
      text: "text-bluegreen-eske",
    },
    {
      front: "Rendimiento",
      back: "Lo que antes costaba contratar un equipo de análisis ahora está disponible en la suscripción. La información existe. La diferencia es cuánto tiempo y dinero inviertes en tenerla.",
      bg: "bg-bluegreen-eske-60",
      text: "text-white-eske",
    },
    {
      front: "Escala",
      back: "Eskemma no es una plantilla. Es un ecosistema que se adapta al tamaño, al momento y al tipo de proyecto político. Desde el inicio hasta donde quieras llegar.",
      bg: "bg-bluegreen-eske-60",
      text: "text-white-eske",
    },
    {
      front: "Anticipación",
      back: "Centinela monitorea el entorno político en tiempo real. Lo que se mueve en la arena política, Eskemma lo registra antes de que se convierta en un problema sin solución.",
      bg: "bg-white-eske",
      text: "text-bluegreen-eske",
    },
    {
      front: "Datos",
      back: "Con Sefix, los datos electorales históricos de México están disponibles en segundos. Información que antes requería horas de trabajo técnico, ahora es parte del proceso estratégico desde el primer día.",
      bg: "bg-blue-eske-60",
      text: "text-white-eske",
    },
    {
      front: "Honestidad",
      back: "Eskemma dice lo que el proyecto necesita escuchar, no lo que es más cómodo oír. El diagnóstico honesto a veces incomoda, pero es el que te permite tomar decisiones reales.",
      bg: "bg-blue-eske-60",
      text: "text-white-eske",
    },
    {
      front: "Inmediatez",
      back: "En cuanto se activa la cuenta, Moddulo guía la primera fase de la estrategia. Sin configuraciones complejas ni manuales interminables. El método empieza a funcionar de inmediato.",
      bg: "bg-white-eske",
      text: "text-bluegreen-eske",
    },
    {
      front: "Continuidad",
      back: "El newsletter semanal mantiene el panorama claro. Centinela monitorea en tiempo real. Y cuando se necesita hablar con alguien, el equipo está disponible para agendar. Eskemma trabaja aunque no estés mirando.",
      bg: "bg-bluegreen-eske-60",
      text: "text-white-eske",
    },
  ];

  const toggleCard = (
    index: number,
    e: React.MouseEvent | React.KeyboardEvent
  ) => {
    e.stopPropagation();
    setFlippedCards((prev) => {
      const newState = prev.map((_, i) => (i === index ? !prev[i] : false));
      return newState;
    });
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCard(index, e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        cardsContainerRef.current &&
        !cardsContainerRef.current.contains(e.target as Node)
      ) {
        setFlippedCards(Array(9).fill(false));
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <section
      className="bg-bluegreen-eske min-h-[800px] max-sm:min-h-[500px] py-20 max-sm:py-12 px-4 sm:px-6 md:px-8"
      onClick={() => setFlippedCards(Array(9).fill(false))}
    >
      <h2 className="text-3xl max-sm:text-xl font-bold text-white-eske mb-6 max-sm:mb-4 text-center">
        Lo que cambia cuando trabajas con método
      </h2>

      <p className="text-center text-white-eske/80 text-lg max-sm:text-sm font-light max-w-2xl mx-auto mb-16 max-sm:mb-8">
        La política sin método es adivinar. Con Eskemma, cada decisión tiene datos, contexto y una estrategia detrás.
      </p>

      <div className="w-[90%] mx-auto max-w-screen-xl" ref={cardsContainerRef}>
        {/* Grid optimizado: 3 columnas en mobile, 2 en tablet, 3 en desktop */}
        <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
          {cards.map((card, index) => (
            <button
              key={index}
              className="flip-card h-28 sm:h-48 w-full perspective-1000"
              onClick={(e) => toggleCard(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              aria-label={`${card.front}. Presiona Enter para ver más detalles.`}
              aria-pressed={flippedCards[index]}
            >
              <div
                className={`flip-card-inner relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${flippedCards[index] ? "rotate-y-180" : ""
                  }`}
              >
                {/* Frente de la tarjeta */}
                <div
                  className={`flip-card-front absolute w-full h-full rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex items-center justify-center ${card.bg} ${card.text} backface-hidden${card.bg === "bg-white-eske" ? " dark:!bg-[#21425E] dark:!text-[#EAF2F8]" : ""}`}
                  aria-hidden={flippedCards[index]}
                >
                  <p className="text-[20px] sm:text-[20px] max-sm:text-[12px] max-sm:leading-tight font-light text-center p-4 max-sm:p-2">
                    {card.front}
                  </p>
                </div>

                {/* Reverso de la tarjeta */}
                <div
                  className="flip-card-back absolute w-full h-full rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex items-center justify-center bg-orange-eske text-white-eske backface-hidden rotate-y-180 overflow-hidden"
                  aria-hidden={!flippedCards[index]}
                >
                  <p className="text-[18px] sm:text-[18px] max-sm:text-[7px] max-sm:leading-tight font-light text-center p-4 max-sm:p-1.5">
                    {card.back}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .flip-card {
          cursor: pointer;
          border: none;
          background: transparent;
          padding: 0;
          outline: none;
        }
        /* Solo mostrar borde cuando se navega con teclado, NO con mouse */
        .flip-card:focus {
          outline: none;
        }
        .flip-card:focus-visible {
          outline: 2px solid white;
          outline-offset: 4px;
          border-radius: 0.5rem;
        }
        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s;
        }
        .flip-card-front,
        .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .flip-card-back {
          transform: rotateY(180deg);
        }
      `}</style>
    </section>
  );
};

export default BenefitsSection;
