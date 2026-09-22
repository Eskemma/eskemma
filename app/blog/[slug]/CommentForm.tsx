// app/blog/[slug]/CommentForm.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/firebase/firebaseConfig";
import { Comment } from "@/types/post.types";

interface CommentFormProps {
  postId: string;
  onCommentAdded: (comment: Comment) => void;
}

export default function CommentForm({
  postId,
  onCommentAdded,
}: CommentFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const maxLength = 500;
  const remainingChars = maxLength - content.length;

  // ✅ FUNCIÓN PARA OBTENER INICIALES
  const getInitials = (name?: string, lastName?: string): string => {
    if (name && lastName) {
      return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (name) {
      const nameParts = name.split(" ");
      if (nameParts.length >= 2) {
        return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
      }
      return name.charAt(0).toUpperCase();
    }
    return "U";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError("El comentario no puede estar vacío");
      return;
    }

    if (content.length > maxLength) {
      setError(`El comentario no puede exceder ${maxLength} caracteres`);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("Sesión expirada. Por favor, inicia sesión nuevamente.");
        return;
      }

      const token = await currentUser.getIdToken();

      const response = await fetch("/api/posts/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId,
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al publicar comentario");
      }

      const data = await response.json();

      const newComment: Comment = {
        ...data.comment,
        createdAt: new Date(data.comment.createdAt),
      };

      onCommentAdded(newComment);
      setContent("");
    } catch (error: any) {
      console.error("Error al publicar comentario:", error);
      setError(error.message || "Error al publicar comentario");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8"
      aria-label="Formulario para añadir un comentario"
    >
      <div className="bg-white-eske dark:bg-[#18324A] border border-gray-eske-30 dark:border-white/10 rounded-lg p-6">
        <div className="flex items-start gap-4">
          {/* Avatar del usuario */}
          <div className="flex-shrink-0" aria-hidden="true">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-bluegreen-eske flex items-center justify-center text-white font-semibold text-sm">
                {getInitials(user?.name, user?.lastName)}
              </div>
            )}
          </div>

          {/* Formulario */}
          <div className="flex-1">
            <label htmlFor="comment-textarea" className="sr-only">
              Escribe tu comentario
            </label>
            <textarea
              id="comment-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu comentario..."
              className="w-full p-3 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder:text-[#6D8294] rounded-lg focus-ring-primary resize-none"
              rows={4}
              maxLength={maxLength}
              disabled={isSubmitting}
              aria-label="Contenido del comentario"
              aria-describedby="char-count"
            />

            <div className="flex items-center justify-between mt-2">
              <span
                id="char-count"
                className={`text-sm ${
                  remainingChars < 50
                    ? "text-red-eske font-semibold"
                    : "text-black-eske-20 dark:text-[#9AAEBE]"
                }`}
                role="status"
                aria-live="polite"
              >
                {remainingChars} caracteres restantes
              </span>

              <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 focus-ring-primary ${
                  isSubmitting || !content.trim()
                    ? "bg-gray-eske-40 dark:bg-[#21425E] text-black-eske-10 dark:text-[#6D8294] cursor-not-allowed"
                    : "bg-bluegreen-eske text-white hover:bg-bluegreen-eske-70"
                }`}
                aria-label={
                  isSubmitting ? "Publicando comentario" : "Publicar comentario"
                }
              >
                {isSubmitting ? "Publicando..." : "Publicar comentario"}
              </button>
            </div>

            {error && (
              <p
                className="mt-2 text-sm text-red-eske"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
