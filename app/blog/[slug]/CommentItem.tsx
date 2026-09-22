// app/blog/[slug]/CommentItem.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/firebase/firebaseConfig";
import { CommentWithReplies } from "@/types/post.types";

interface CommentItemProps {
  comment: CommentWithReplies;
  postId: string;
  currentUserId?: string;
  onDeleted: (commentId: string) => void;
  onReply?: (parentId: string, content: string) => void;
  isReply?: boolean;
}

export default function CommentItem({
  comment,
  postId,
  currentUserId,
  onDeleted,
  onReply,
  isReply = false,
}: CommentItemProps) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");

  const isOwner = currentUserId === comment.author.uid;
  const isAdmin = user?.role === "admin";
  const canDelete = isOwner || isAdmin;

  const getInitials = (displayName: string): string => {
    const nameParts = displayName.trim().split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
    }
    return displayName.charAt(0).toUpperCase();
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "hace un momento";
    if (diffInSeconds < 3600)
      return `hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400)
      return `hace ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 604800)
      return `hace ${Math.floor(diffInSeconds / 86400)} días`;
    if (diffInSeconds < 2592000)
      return `hace ${Math.floor(diffInSeconds / 604800)} semanas`;

    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("Sesión expirada. Por favor, inicia sesión nuevamente.");
        return;
      }

      const token = await currentUser.getIdToken();

      const response = await fetch(
        `/api/posts/comments/${comment.id}?postId=${postId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar comentario");
      }

      onDeleted(comment.id);
    } catch (error: any) {
      console.error("Error al eliminar comentario:", error);
      alert(error.message || "Error al eliminar comentario");
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const handleReply = () => {
    if (!replyContent.trim()) return;
    if (onReply) {
      onReply(comment.id, replyContent);
      setReplyContent("");
      setShowReplyForm(false);
    }
  };

  return (
    <article
      className={`bg-white-eske dark:bg-[#18324A] border border-gray-eske-30 dark:border-white/10 rounded-lg p-6 hover:shadow-md transition-shadow duration-300 ${
        isReply ? "ml-12 mt-4" : ""
      }`}
      aria-label={`Comentario de ${comment.author.displayName}`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0" aria-hidden="true">
          {comment.author.photoURL ? (
            <img
              src={comment.author.photoURL}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-bluegreen-eske flex items-center justify-center text-white font-semibold text-sm">
              {getInitials(comment.author.displayName)}
            </div>
          )}
        </div>

        {/* Contenido del comentario */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-semibold text-black-eske dark:text-[#EAF2F8]">
                {comment.author.displayName}
              </span>
              <time
                className="text-sm text-black-eske-20 dark:text-[#9AAEBE] ml-2"
                dateTime={comment.createdAt.toISOString()}
              >
                {getTimeAgo(comment.createdAt)}
              </time>
            </div>

            <div className="flex items-center gap-2">
              {/* Botón responder */}
              {!isReply && user && (
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="text-bluegreen-eske hover:text-bluegreen-eske-70 text-sm font-medium transition-colors focus-ring-primary rounded"
                  aria-label={`Responder al comentario de ${comment.author.displayName}`}
                  aria-expanded={showReplyForm}
                >
                  Responder
                </button>
              )}

              {canDelete && !showConfirmDelete && (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-red-eske hover:text-red-eske-70 text-sm font-medium transition-colors focus-ring-primary rounded"
                  disabled={isDeleting}
                  aria-label={`Eliminar comentario de ${comment.author.displayName}`}
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>

          <p className="text-black-eske-40 dark:text-[#C7D6E0] whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Formulario de respuesta */}
          {showReplyForm && (
            <div
              className="mt-4 p-3 bg-gray-eske-10 dark:bg-[#112230] rounded-lg"
              role="form"
              aria-label="Formulario de respuesta"
            >
              <label htmlFor={`reply-${comment.id}`} className="sr-only">
                Escribe tu respuesta a {comment.author.displayName}
              </label>
              <textarea
                id={`reply-${comment.id}`}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Escribe tu respuesta..."
                className="w-full p-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#18324A] dark:text-[#EAF2F8] dark:placeholder:text-[#6D8294] rounded focus-ring-primary resize-none"
                rows={3}
                maxLength={500}
                aria-label="Contenido de la respuesta"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent("");
                  }}
                  className="px-4 py-2 text-sm text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] focus-ring-primary rounded"
                  aria-label="Cancelar respuesta"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReply}
                  disabled={!replyContent.trim()}
                  className="px-4 py-2 bg-bluegreen-eske text-white text-sm rounded hover:bg-bluegreen-eske-70 disabled:opacity-50 disabled:cursor-not-allowed focus-ring-primary"
                  aria-label="Publicar respuesta"
                >
                  Responder
                </button>
              </div>
            </div>
          )}

          {showConfirmDelete && (
            <div
              className="mt-4 p-3 bg-red-eske/10 dark:bg-red-eske/20 border border-red-eske/30 dark:border-red-eske/40 rounded-lg"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-sm text-red-eske-80 dark:text-red-eske-20 mb-3">
                ¿Estás seguro de que deseas eliminar este comentario?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-eske text-white rounded-lg hover:bg-red-eske-60 transition-colors text-sm font-semibold disabled:opacity-50 focus-ring-primary"
                  aria-label={
                    isDeleting
                      ? "Eliminando comentario"
                      : "Confirmar eliminar comentario"
                  }
                >
                  {isDeleting ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-gray-eske-20 dark:bg-[#21425E] text-black-eske-40 dark:text-[#C7D6E0] rounded-lg hover:bg-gray-eske-40 dark:hover:bg-[#2C5273] transition-colors text-sm font-semibold focus-ring-primary"
                  aria-label="Cancelar eliminación"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Mostrar respuestas anidadas */}
          {comment.replies && comment.replies.length > 0 && (
            <div
              className="mt-4 space-y-4"
              role="list"
              aria-label={`${comment.replies.length} respuesta${comment.replies.length !== 1 ? "s" : ""} a este comentario`}
            >
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  currentUserId={currentUserId}
                  onDeleted={onDeleted}
                  onReply={onReply}
                  isReply={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
