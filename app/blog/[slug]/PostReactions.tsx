// app/blog/[slug]/PostReactions.tsx
"use client";

import { useState, useEffect } from "react";

interface PostReactionsProps {
  postId: string;
  initialLikes: number;
}

export default function PostReactions({
  postId,
  initialLikes,
}: PostReactionsProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [hasLiked, setHasLiked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Verificar si el usuario ya dio like a este post
    const likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "[]");
    setHasLiked(likedPosts.includes(postId));
  }, [postId]);

  const handleLike = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setIsAnimating(true);

    try {
      const action = hasLiked ? "unlike" : "like";

      const response = await fetch("/api/posts/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      });

      if (!response.ok) {
        throw new Error("Error al procesar like");
      }

      const data = await response.json();
      setLikes(data.likes);

      // Actualizar localStorage
      const likedPosts = JSON.parse(
        localStorage.getItem("likedPosts") || "[]"
      );

      if (action === "like") {
        likedPosts.push(postId);
        setHasLiked(true);
      } else {
        const index = likedPosts.indexOf(postId);
        if (index > -1) {
          likedPosts.splice(index, 1);
        }
        setHasLiked(false);
      }

      localStorage.setItem("likedPosts", JSON.stringify(likedPosts));
    } catch (error) {
      console.error("Error al dar like:", error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  return (
    <div className="flex items-center justify-center py-6">
      <button
        onClick={handleLike}
        disabled={isLoading}
        className={`flex items-center gap-3 px-6 py-3 rounded-full border-2 transition-all duration-300 focus-ring-primary ${
          hasLiked
            ? "bg-red-eske/10 border-red-eske text-red-eske-60 hover:bg-red-eske/20"
            : "bg-white-eske dark:bg-[#18324A] border-gray-eske-30 dark:border-white/10 text-black-eske-40 dark:text-[#C7D6E0] hover:border-red-eske hover:text-red-eske-60"
        } ${isAnimating ? "scale-110" : "scale-100"} ${
          isLoading ? "opacity-50 cursor-not-allowed" : ""
        }`}
        aria-label={hasLiked ? `Quitar me gusta. ${likes} personas dieron me gusta` : `Dar me gusta. ${likes} personas dieron me gusta`}
        aria-pressed={hasLiked}
      >
        <svg
          className={`w-6 h-6 transition-transform duration-300 ${
            isAnimating ? "scale-125" : "scale-100"
          }`}
          fill={hasLiked ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        <span className="font-semibold text-lg">
          {hasLiked ? "Te gusta" : "Me gusta"}
        </span>
        <span 
          className="font-bold text-xl"
          role="status"
          aria-live="polite"
        >
          {likes}
        </span>
      </button>
    </div>
  );
}