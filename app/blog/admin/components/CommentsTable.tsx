// app/blog/admin/components/CommentsTable.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import CommentModal from "./CommentModal";

interface CommentData {
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
  isApproved: boolean;
  parentId?: string | null;
}

interface CommentsTableProps {
  comments: CommentData[];
  onStatusChange: (
    commentId: string,
    postId: string,
    action: "approve" | "reject" | "pending"
  ) => void;
  onDelete: (commentId: string, postId: string) => void;
}

export default function CommentsTable({
  comments,
  onStatusChange,
  onDelete,
}: CommentsTableProps) {
  const [selectedComment, setSelectedComment] = useState<CommentData | null>(
    null
  );

  if (comments.length === 0) {
    return (
      <section
        className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md border border-gray-eske-30 dark:border-white/10 p-12 text-center"
        role="status"
      >
        <svg
          className="w-20 h-20 mx-auto mb-4 text-gray-eske-40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h3 className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-2">
          No hay comentarios
        </h3>
        <p className="text-black-eske-20 dark:text-[#9AAEBE]">
          No se encontraron comentarios con los filtros seleccionados
        </p>
      </section>
    );
  }

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
        aria-label={`Estado: ${labels[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  return (
    <>
      <section
        className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md border border-gray-eske-30 dark:border-white/10 overflow-hidden"
        aria-labelledby="comments-table-title"
      >
        <h2 id="comments-table-title" className="sr-only">
          Tabla de comentarios del blog
        </h2>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full" role="table">
            <thead className="bg-gray-eske-20 dark:bg-[#112230] border-b border-gray-eske-30 dark:border-white/10">
              <tr role="row">
                <th
                  className="px-6 py-4 text-left text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] uppercase tracking-wider"
                  scope="col"
                >
                  Autor
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] uppercase tracking-wider"
                  scope="col"
                >
                  Comentario
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] uppercase tracking-wider"
                  scope="col"
                >
                  Post
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] uppercase tracking-wider"
                  scope="col"
                >
                  Estado
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] uppercase tracking-wider"
                  scope="col"
                >
                  Fecha
                </th>
                <th
                  className="px-6 py-4 text-right text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] uppercase tracking-wider"
                  scope="col"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-eske-30 dark:divide-white/10">
              {comments.map((comment) => (
                <tr
                  key={comment.id}
                  className="hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
                  role="row"
                >
                  <td className="px-6 py-4 whitespace-nowrap" role="cell">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex-shrink-0"
                        role="img"
                        aria-label={`Foto de perfil de ${comment.author.displayName}`}
                      >
                        {comment.author.photoURL ? (
                          <img
                            src={comment.author.photoURL}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-bluegreen-eske rounded-full flex items-center justify-center">
                            <span
                              className="text-white font-bold text-sm"
                              aria-hidden="true"
                            >
                              {comment.author.displayName
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
                          {comment.author.displayName}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4" role="cell">
                    {/* Clickeable para abrir modal */}
                    <button
                      onClick={() => setSelectedComment(comment)}
                      className="text-sm text-black-eske-40 dark:text-[#C7D6E0] line-clamp-2 max-w-md text-left hover:text-bluegreen-eske dark:hover:text-[#6BA4C6] hover:underline transition-colors focus-ring-primary rounded"
                      aria-label={`Ver comentario completo de ${comment.author.displayName}`}
                    >
                      {comment.content}
                    </button>
                    <p
                      className="text-xs text-bluegreen-eske mt-1 font-medium"
                      aria-hidden="true"
                    >
                      Clic para ver completo
                    </p>
                  </td>
                  <td className="px-6 py-4" role="cell">
                    <Link
                      href={`/blog/admin/blog/edit/${comment.postId}`}
                      className="text-sm text-bluegreen-eske hover:text-bluegreen-eske-70 font-medium line-clamp-1 max-w-xs block focus-ring-primary rounded"
                      aria-label={`Editar post: ${comment.postTitle}`}
                    >
                      {comment.postTitle}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" role="cell">
                    {getStatusBadge(comment.moderationStatus)}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-black-eske-20 dark:text-[#9AAEBE]"
                    role="cell"
                  >
                    <time dateTime={new Date(comment.createdAt).toISOString()}>
                      {new Date(comment.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-right"
                    role="cell"
                  >
                    <div
                      className="flex items-center justify-end gap-2"
                      role="group"
                      aria-label={`Acciones para comentario de ${comment.author.displayName}`}
                    >
                      {comment.moderationStatus !== "approved" && (
                        <button
                          onClick={() =>
                            onStatusChange(
                              comment.id,
                              comment.postId,
                              "approve"
                            )
                          }
                          className="p-2 text-green-eske hover:bg-green-eske-20 rounded-lg transition-colors focus-ring-primary"
                          aria-label="Aprobar comentario"
                          title="Aprobar"
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
                        </button>
                      )}
                      {comment.moderationStatus !== "rejected" && (
                        <button
                          onClick={() =>
                            onStatusChange(comment.id, comment.postId, "reject")
                          }
                          className="p-2 text-red-eske hover:bg-red-eske-20 rounded-lg transition-colors focus-ring-primary"
                          aria-label="Rechazar comentario"
                          title="Rechazar"
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
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(comment.id, comment.postId)}
                        className="p-2 text-black-eske-20 dark:text-[#9AAEBE] hover:bg-red-eske-20 dark:hover:bg-red-eske/30 hover:text-red-eske dark:hover:text-red-eske-20 rounded-lg transition-colors focus-ring-primary"
                        aria-label="Eliminar comentario"
                        title="Eliminar"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div
          className="lg:hidden divide-y divide-gray-eske-30 dark:divide-white/10"
          role="list"
          aria-label={`${comments.length} comentario${comments.length !== 1 ? "s" : ""} del blog`}
        >
          {comments.map((comment) => (
            <article key={comment.id} className="p-4 space-y-3" role="listitem">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex-shrink-0"
                    role="img"
                    aria-label={`Foto de perfil de ${comment.author.displayName}`}
                  >
                    {comment.author.photoURL ? (
                      <img
                        src={comment.author.photoURL}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-bluegreen-eske rounded-full flex items-center justify-center">
                        <span
                          className="text-white font-bold text-sm"
                          aria-hidden="true"
                        >
                          {comment.author.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-black-eske">
                      {comment.author.displayName}
                    </p>
                    <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
                      <time
                        dateTime={new Date(comment.createdAt).toISOString()}
                      >
                        {new Date(comment.createdAt).toLocaleDateString(
                          "es-ES",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </time>
                    </p>
                  </div>
                </div>
                {getStatusBadge(comment.moderationStatus)}
              </div>

              {/* Content - Clickeable */}
              <button
                onClick={() => setSelectedComment(comment)}
                className="text-sm text-black-eske-40 dark:text-[#C7D6E0] text-left w-full hover:text-bluegreen-eske dark:hover:text-[#6BA4C6] transition-colors focus-ring-primary rounded"
                aria-label={`Ver comentario completo de ${comment.author.displayName}`}
              >
                <p className="line-clamp-3">{comment.content}</p>
                <p
                  className="text-xs text-bluegreen-eske mt-1 font-medium"
                  aria-hidden="true"
                >
                  Toca para ver completo
                </p>
              </button>

              {/* Post Link */}
              <Link
                href={`/blog/admin/blog/edit/${comment.postId}`}
                className="text-sm text-bluegreen-eske hover:text-bluegreen-eske-70 font-medium block focus-ring-primary rounded"
                aria-label={`Editar post: ${comment.postTitle}`}
              >
                📄 {comment.postTitle}
              </Link>

              {/* Actions */}
              <div
                className="flex items-center gap-2 pt-2"
                role="group"
                aria-label={`Acciones para comentario de ${comment.author.displayName}`}
              >
                {comment.moderationStatus !== "approved" && (
                  <button
                    onClick={() =>
                      onStatusChange(comment.id, comment.postId, "approve")
                    }
                    className="flex-1 px-4 py-2 bg-green-eske text-white rounded-lg hover:bg-green-eske-70 transition-colors text-sm font-semibold focus-ring-primary"
                    aria-label="Aprobar comentario"
                  >
                    ✓ Aprobar
                  </button>
                )}
                {comment.moderationStatus !== "rejected" && (
                  <button
                    onClick={() =>
                      onStatusChange(comment.id, comment.postId, "reject")
                    }
                    className="flex-1 px-4 py-2 bg-red-eske text-white rounded-lg hover:bg-red-eske-70 transition-colors text-sm font-semibold focus-ring-primary"
                    aria-label="Rechazar comentario"
                  >
                    ✗ Rechazar
                  </button>
                )}
                <button
                  onClick={() => onDelete(comment.id, comment.postId)}
                  className="px-4 py-2 bg-gray-eske-40 dark:bg-white/10 text-black-eske dark:text-[#C7D6E0] rounded-lg hover:bg-red-eske-20 dark:hover:bg-red-eske/30 hover:text-red-eske dark:hover:text-red-eske-20 transition-colors text-sm font-semibold focus-ring-primary"
                  aria-label="Eliminar comentario"
                >
                  🗑️
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Modal */}
      {selectedComment && (
        <CommentModal
          isOpen={true}
          onClose={() => setSelectedComment(null)}
          comment={selectedComment}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
