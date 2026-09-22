// app/blog/admin/components/CommentModal.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  comment: {
    id: string;
    postId: string;
    postTitle: string;
    content: string;
    author: {
      uid: string;
      displayName: string;
      photoURL?: string | null;
    };
    createdAt: string;
    moderationStatus: "pending" | "approved" | "rejected";
  };
  onStatusChange: (commentId: string, postId: string, action: "approve" | "reject" | "pending") => void;
  onDelete: (commentId: string, postId: string) => void;
}

export default function CommentModal({
  isOpen,
  onClose,
  comment,
  onStatusChange,
  onDelete,
}: CommentModalProps) {
  // Cerrar modal con tecla ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getStatusBadge = (status: "pending" | "approved" | "rejected") => {
    const styles = {
      pending: "bg-yellow-eske-20 text-yellow-eske-90",
      approved: "bg-green-eske-20 text-green-eske-90",
      rejected: "bg-red-eske-20 text-red-eske-90",
    };

    const labels = {
      pending: "Pendiente",
      approved: "Aprobado",
      rejected: "Rechazado",
    };

    return (
      <span 
        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}
        aria-label={`Estado del comentario: ${labels[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comment-modal-title"
      aria-describedby="comment-modal-description"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal */}
      <div className="relative bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-modal-appear">
        {/* Header */}
        <header className="bg-gradient-to-r from-bluegreen-eske to-blue-eske text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="flex-shrink-0"
              role="img"
              aria-label={`Foto de perfil de ${comment.author.displayName}`}
            >
              {comment.author.photoURL ? (
                <img
                  src={comment.author.photoURL}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover border-2 border-white"
                />
              ) : (
                <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-2 border-white">
                  <span className="text-white font-bold text-xl" aria-hidden="true">
                    {comment.author.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h2 
                id="comment-modal-title"
                className="text-xl font-bold"
              >
                {comment.author.displayName}
              </h2>
              <p 
                className="text-sm text-blue-eske-10"
                id="comment-modal-description"
              >
                <time dateTime={new Date(comment.createdAt).toISOString()}>
                  {new Date(comment.createdAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-eske-70 hover:bg-opacity-20 rounded-lg transition-colors focus-ring-primary"
            aria-label="Cerrar modal de comentario"
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          {/* Status Badge */}
          <div className="mb-4 flex items-center justify-between">
            {getStatusBadge(comment.moderationStatus)}
            <Link
              href={`/blog/admin/blog/edit/${comment.postId}`}
              className="text-sm text-bluegreen-eske hover:text-bluegreen-eske-70 font-medium flex items-center gap-1 focus-ring-primary rounded"
              aria-label={`Editar post: ${comment.postTitle}`}
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {comment.postTitle}
            </Link>
          </div>

          {/* Comment Content */}
          <section aria-labelledby="comment-content-label">
            <h3 id="comment-content-label" className="sr-only">
              Contenido del comentario
            </h3>
            <div className="bg-gray-eske-10 dark:bg-[#112230] rounded-xl p-6 border border-gray-eske-30 dark:border-white/10">
              <p className="text-black-eske dark:text-[#C7D6E0] leading-relaxed whitespace-pre-wrap text-base">
                {comment.content}
              </p>
            </div>
          </section>
        </div>

        {/* Actions Footer */}
        <footer className="border-t border-gray-eske-30 dark:border-white/10 p-6 bg-white-eske dark:bg-[#18324A]">
          <div 
            className="flex items-center gap-3"
            role="group"
            aria-label="Acciones de moderación del comentario"
          >
            {comment.moderationStatus !== "approved" && (
              <button
                onClick={() => {
                  onStatusChange(comment.id, comment.postId, "approve");
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-eske text-white rounded-lg hover:bg-green-eske-70 transition-colors font-semibold shadow-md focus-ring-primary"
                aria-label="Aprobar comentario"
              >
                <svg 
                  className="w-5 h-5" 
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
                Aprobar
              </button>
            )}
            {comment.moderationStatus !== "rejected" && (
              <button
                onClick={() => {
                  onStatusChange(comment.id, comment.postId, "reject");
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-eske text-white rounded-lg hover:bg-red-eske-70 transition-colors font-semibold shadow-md focus-ring-primary"
                aria-label="Rechazar comentario"
              >
                <svg 
                  className="w-5 h-5" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                Rechazar
              </button>
            )}
            <button
              onClick={() => {
                onDelete(comment.id, comment.postId);
                onClose();
              }}
              className="px-6 py-3 bg-gray-eske-40 dark:bg-white/10 text-black-eske dark:text-[#C7D6E0] rounded-lg hover:bg-red-eske-20 dark:hover:bg-red-eske/30 hover:text-red-eske dark:hover:text-red-eske-20 transition-colors font-semibold shadow-md focus-ring-primary"
              aria-label="Eliminar comentario permanentemente"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

