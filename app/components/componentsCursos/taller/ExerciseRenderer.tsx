// app/components/componentsCursos/taller/ExerciseRenderer.tsx
// ============================================================
// RENDERIZADOR DE EJERCICIOS
// Muestra diferentes tipos de ejercicios según su configuración
// ============================================================

"use client";

import { useState } from "react";
import type { SessionExercise } from "@/types/course.types";
import { useAuth } from "@/context/AuthContext";
import { updateSessionProgress } from "@/lib/cursos/taller/firebaseWorkshop";

interface ExerciseRendererProps {
  exercise: SessionExercise;
  sessionId: string;
  onComplete?: () => void;
}

export default function ExerciseRenderer({ 
  exercise, 
  sessionId,
  onComplete 
}: ExerciseRendererProps) {
  const { user } = useAuth();
  const [answer, setAnswer] = useState("");
  const [showSolution, setShowSolution] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleComplete = async () => {
    if (!user) return;
    
    try {
      await updateSessionProgress(user.uid, sessionId, exercise.id);
      setIsCompleted(true);
      setFeedback({ type: "success", message: "¡Ejercicio completado!" });
      onComplete?.();
    } catch (error) {
      setFeedback({ type: "error", message: "Error al guardar el progreso" });
    }
  };

  // Renderizar según tipo de ejercicio
  const renderExerciseByType = () => {
    switch (exercise.type) {
      case "analysis":
        return (
          <div className="space-y-4">
            <p className="text-black-eske dark:text-[#C7D6E0] font-normal">{exercise.description}</p>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full p-3 border border-gray-eske-30 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-bluegreen-eske focus:border-transparent bg-white dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]"
              rows={4}
              placeholder="Escribe tu análisis aquí..."
              aria-label="Respuesta del ejercicio"
            />
          </div>
        );

      case "code":
        return (
          <div className="space-y-4">
            <p className="text-black-eske dark:text-[#C7D6E0] font-normal">{exercise.description}</p>
            <div className="bg-gray-eske-10 dark:bg-[#112230] p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto dark:text-[#C7D6E0]">
                <code>{exercise.codeConfig?.initialCode || "# Escribe tu código aquí"}</code>
              </pre>
            </div>
            {exercise.codeConfig?.solution && showSolution && (
              <div className="mt-4 p-4 bg-green-eske-10 dark:bg-green-eske/20 border border-green-eske dark:border-green-eske/40 rounded-lg">
                <h4 className="font-semibold text-green-eske-90 dark:text-green-eske-30 mb-2">Solución:</h4>
                <pre className="text-sm overflow-x-auto">
                  <code>{exercise.codeConfig.solution}</code>
                </pre>
              </div>
            )}
          </div>
        );

      case "quiz":
        return (
          <div className="space-y-4">
            <p className="text-black-eske dark:text-[#C7D6E0] font-normal">{exercise.description}</p>
            {exercise.quizConfig?.questions.map((q, idx) => (
              <div key={idx} className="p-4 border border-gray-eske-30 dark:border-white/10 rounded-lg dark:bg-[#112230]">
                <p className="mb-3 text-black-eske dark:text-[#C7D6E0] font-normal">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((option, optIdx) => (
                    <label key={optIdx} className="flex items-center gap-2 dark:text-[#C7D6E0]">
                      <input
                        type="radio"
                        name={`question-${idx}`}
                        value={optIdx}
                        className="focus:ring-bluegreen-eske"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="p-4 bg-yellow-eske-10 rounded-lg">
            <p>Tipo de ejercicio no soportado: {exercise.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="border border-gray-eske-30 dark:border-white/10 rounded-lg p-6 bg-white-eske dark:bg-[#18324A]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold dark:text-[#EAF2F8]">{exercise.title}</h3>
        {exercise.isRequired && (
          <span className="bg-red-eske-10 text-red-eske-80 text-xs px-2 py-1 rounded-full">
            Requerido
          </span>
        )}
      </div>

      {renderExerciseByType()}

      {/* Feedback */}
      {feedback && (
        <div className={`mt-4 p-3 rounded-lg ${
          feedback.type === "success" ? "bg-green-eske-10 text-green-eske-80" : "bg-red-eske-10 text-red-eske-80"
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={handleComplete}
          disabled={isCompleted}
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors
            ${isCompleted 
              ? 'bg-green-eske text-white cursor-not-allowed' 
              : 'bg-bluegreen-eske hover:bg-bluegreen-eske-70 text-white'
            }
            focus-ring-primary
          `}
          aria-label={isCompleted ? "Ejercicio completado" : "Marcar como completado"}
        >
          {isCompleted ? "Completado ✓" : "Marcar como completado"}
        </button>

        {exercise.type === "code" && exercise.codeConfig?.solution && (
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="px-4 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg hover:bg-gray-eske-10 dark:hover:bg-white/5 dark:text-[#C7D6E0] transition-colors focus-ring-primary"
          >
            {showSolution ? "Ocultar solución" : "Ver solución"}
          </button>
        )}
      </div>
    </div>
  );
}