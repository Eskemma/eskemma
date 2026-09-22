// app/blog/[slug]/CommentSection.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/firebase/firebaseConfig";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";
import { CommentWithReplies } from "@/types/post.types";

interface CommentSectionProps {
  postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const { user, setIsLoginModalOpen } = useAuth();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      const response = await fetch(`/api/posts/comments?postId=${postId}`);

      if (!response.ok) {
        throw new Error("Error al cargar comentarios");
      }

      const data = await response.json();
      const formattedComments = data.comments.map((comment: any) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
        replies:
          comment.replies?.map((reply: any) => ({
            ...reply,
            createdAt: new Date(reply.createdAt),
          })) || [],
      }));

      setComments(formattedComments);
    } catch (error) {
      console.error("Error al cargar comentarios:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommentAdded = (newComment: CommentWithReplies) => {
    setComments([newComment, ...comments]);
  };

  const handleCommentDeleted = (commentId: string) => {
    // Filtrar tanto comentarios principales como respuestas
    const filterComments = (
      comments: CommentWithReplies[]
    ): CommentWithReplies[] => {
      return comments
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          replies: c.replies ? filterComments(c.replies) : [],
        }));
    };

    setComments(filterComments(comments));
  };

  const handleReply = async (parentId: string, content: string) => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("Sesión expirada. Por favor, inicia sesión nuevamente.");
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
          parentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al publicar respuesta");
      }

      const data = await response.json();
      const newReply: CommentWithReplies = {
        ...data.comment,
        createdAt: new Date(data.comment.createdAt),
      };

      // Agregar respuesta al comentario padre
      const addReplyToComment = (
        comments: CommentWithReplies[]
      ): CommentWithReplies[] => {
        return comments.map((comment) => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newReply],
            };
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: addReplyToComment(comment.replies),
            };
          }
          return comment;
        });
      };

      setComments(addReplyToComment(comments));
    } catch (error: any) {
      console.error("Error al publicar respuesta:", error);
      alert(error.message || "Error al publicar respuesta");
    }
  };

  // Contar total de comentarios (incluyendo respuestas)
  const countComments = (comments: CommentWithReplies[]): number => {
    return comments.reduce((total, comment) => {
      return total + 1 + (comment.replies ? countComments(comment.replies) : 0);
    }, 0);
  };

  const totalComments = countComments(comments);

  return (
    <section
      className="mt-16 pt-8 border-t border-gray-eske-30"
      aria-labelledby="comments-title"
    >
      <h2 id="comments-title" className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-6">
        Comentarios ({totalComments})
      </h2>

      {/* Formulario para comentar */}
      {user ? (
        <CommentForm postId={postId} onCommentAdded={handleCommentAdded} />
      ) : (
        <div
          className="bg-gray-eske-10 dark:bg-[#18324A] border border-gray-eske-30 dark:border-white/10 rounded-lg p-6 mb-8 text-center"
          role="status"
        >
          <p className="text-black-eske-40 dark:text-[#C7D6E0] mb-4">
            Inicia sesión para dejar un comentario
          </p>
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="px-6 py-2 bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske-70 transition-colors font-semibold focus-ring-primary"
            aria-label="Iniciar sesión para comentar"
          >
            Iniciar sesión
          </button>
        </div>
      )}

      {/* Lista de comentarios */}
      {isLoading ? (
        <div className="text-center py-8" role="status" aria-live="polite">
          <p className="text-black-eske-20 dark:text-[#9AAEBE]">Cargando comentarios...</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-black-eske-20 dark:text-[#9AAEBE]" role="status">
          <p>Sé el primero en comentar</p>
        </div>
      ) : (
        <CommentList
          comments={comments}
          postId={postId}
          currentUserId={user?.uid}
          onCommentDeleted={handleCommentDeleted}
          onReply={handleReply}
        />
      )}
    </section>
  );
}
