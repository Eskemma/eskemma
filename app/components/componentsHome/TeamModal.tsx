"use client"; // Indica que este es un Client Component

// components/TeamModal.tsx
import { useState } from "react";
import Button from "../Button";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  bio: string;
  contact: string;
  image: string;
}

const TeamModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Hooks de accesibilidad
  const modalRef = useFocusTrap(isOpen);
  useEscapeKey(isOpen, () => setIsOpen(false));

  const teamMembers: TeamMember[] = [
    {
      id: 1,
      name: "Raúl Sánchez Salgado",
      role: "Especialista en comunicación política",
      bio: "Raúl es el fundador de Eskemma y tiene más de 20 años de experiencia en el sector público, legislativo y electoral. Politólogo, con especialidad en Opinión Pública, Comunicación Política y Marketing Electoral.",
      image:
        "https://res.cloudinary.com/dngirajdx/image/upload/v1765314318/rss-gmni-4_rebbvk.jpg",
      contact: "raulsanchezs@eskemma.com",
    },
    {
      id: 2,
      name: "Alicia García Cortés",
      role: "Productora Audiovisual",
      bio: "Alicia es el motor creativo de Eskemma. Ha producido eventos y participado en producciones audiovisuales cinematográficas. Tiene amplia experiencia en proyectos públicos y privados.",
      image: "https://i.pravatar.cc/150?img=38",
      contact: "aliciagarciac@eskemma.com",
    },
    {
      id: 3,
      name: "Yolanda Orozco López",
      role: "Administradora",
      bio: "Contadora de profesión y administradora por vocación, Yolanda combina su experiencia y creatividad para hacer posibles los proyectos de los clientes de Eskemma.",
      image: "https://i.pravatar.cc/150?img=10",
      contact: "yolandaorozcol@eskemma.com",
    },
    {
      id: 4,
      name: "David Quezada Mendoza",
      role: "Consultor político",
      bio: "David ha participado en más de 50 proyectos de comunicación política en México y otros países latinoamericanos. Politólogo con especialidad en marketing electoral.",
      image: "https://i.pravatar.cc/150?img=52",
      contact: "davidquezadac@eskemma.com",
    },
  ];

  const nextMember = () =>
    setCurrentIndex((prevIndex) =>
      prevIndex === teamMembers.length - 1 ? 0 : prevIndex + 1
    );

  const prevMember = () =>
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? teamMembers.length - 1 : prevIndex - 1
    );

  const handleKeyDown = (e: React.KeyboardEvent, action: 'prev' | 'next') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (action === 'prev') {
        prevMember();
      } else {
        nextMember();
      }
    }
  };

  const currentMember = teamMembers[currentIndex];

  return (
    <>
      {/* Botón "Conoce al equipo" */}
      <div className="text-center max-w-[250px] mx-auto">
        <Button
          label="CONOCE AL EQUIPO"
          variant="primary"
          onClick={() => setIsOpen(true)}
        />
      </div>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0, 0.6)" }}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div 
            ref={modalRef as React.RefObject<HTMLDivElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-member-name"
            aria-describedby="team-member-bio"
            className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 w-full max-w-md p-6 max-sm:p-4 relative overflow-hidden"
          >
            {/* Botón de Cierre */}
            <button
              className="absolute top-4 max-sm:top-3 right-4 max-sm:right-3 text-black-eske-40 dark:text-[#6D8294] hover:text-red-eske dark:hover:text-[#C7D6E0] transition-colors duration-300 focus-ring-primary rounded"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar modal del equipo"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 max-sm:h-5 max-sm:w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Encabezado */}
            <h3 id="team-member-name" className="text-2xl max-sm:text-xl font-medium text-bluegreen-eske dark:text-[#6BA4C6] mb-1 text-center">
              {currentMember.name}
            </h3>
            <p className="text-xl max-sm:text-lg text-orange-eske mb-8 max-sm:mb-6 text-center">
              {currentMember.role}
            </p>

            {/* Contenido Principal */}
            <div className="flex flex-col items-center gap-6 max-sm:gap-4">
              {/* Imagen Circular */}
              <div className="w-36 h-36 max-sm:w-28 max-sm:h-28 rounded-full bg-bluegreen-eske border-blue-eske p-0.5 overflow-hidden flex items-center justify-center">
                <img
                  src={currentMember.image}
                  alt={`${currentMember.name}, ${currentMember.role}`}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>

              {/* Biografía */}
              <div className="mt-2 max-sm:mt-1 text-center">
                <p id="team-member-bio" className="text-10px max-sm:text-[10px] text-black-eske-40 dark:text-[#C7D6E0]">{currentMember.bio}</p>
              </div>
            </div>

            {/* Navegación entre Miembros */}
            <div className="flex justify-between mt-6 max-sm:mt-4">
              {/* Botón Anterior */}
              <button
                className="text-black-eske-40 dark:text-[#6D8294] hover:text-blue-eske dark:hover:text-[#C7D6E0] transition-colors duration-300 focus-ring-primary rounded p-2 max-sm:p-1"
                onClick={prevMember}
                onKeyDown={(e) => handleKeyDown(e, 'prev')}
                aria-label="Ver miembro anterior del equipo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 max-sm:h-5 max-sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Indicadores de Carrusel */}
              <div className="flex gap-2 max-sm:gap-1.5" role="tablist" aria-label="Miembros del equipo">
                {teamMembers.map((member, index) => (
                  <button
                    key={member.id}
                    role="tab"
                    aria-selected={index === currentIndex}
                    aria-label={`Ver ${member.name}`}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2 w-2 max-sm:h-1.5 max-sm:w-1.5 rounded-full focus-ring-primary ${
                      index === currentIndex ? "bg-orange-eske" : "bg-gray-eske-40 dark:bg-[#6D8294]"
                    }`}
                  />
                ))}
              </div>

              {/* Botón Siguiente */}
              <button
                className="text-black-eske-40 dark:text-[#6D8294] hover:text-blue-eske dark:hover:text-[#C7D6E0] transition-colors duration-300 focus-ring-primary rounded p-2 max-sm:p-1"
                onClick={nextMember}
                onKeyDown={(e) => handleKeyDown(e, 'next')}
                aria-label="Ver siguiente miembro del equipo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 max-sm:h-5 max-sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Información de contacto visualmente oculta pero accesible */}
            <p className="sr-only">
              Contacto: {currentMember.contact}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamModal;

