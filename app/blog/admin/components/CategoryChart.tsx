// app/blog/admin/components/CategoryChart.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/firebase/firebaseConfig";
import { getCategoryColor, getCategoryLabel } from "@/lib/constants/categories";

interface CategoryData {
  category: string;
  count: number;
}

export default function CategoryChart() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategoryData();
  }, []);

  const loadCategoryData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      const response = await fetch("/api/admin/stats/categories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Error al cargar categorías:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section 
        className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md border border-gray-eske-30 dark:border-white/10 p-6"
        role="status"
        aria-live="polite"
        aria-label="Cargando estadísticas de categorías"
      >
        <h3 className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4">Posts por Categoría</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-gray-eske-20 rounded" aria-hidden="true"></div>
          ))}
        </div>
      </section>
    );
  }

  const total = categories.reduce((sum, cat) => sum + cat.count, 0);

  return (
    <section 
      className="bg-white-eske rounded-xl shadow-md border border-gray-eske-30 p-6"
      aria-labelledby="category-chart-title"
    >
      <h3 
        id="category-chart-title"
        className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-6"
      >
        Posts por Categoría
      </h3>

      {categories.length === 0 ? (
        <div 
          className="text-center py-8 text-black-eske-20 dark:text-[#9AAEBE]"
          role="status"
        >
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-eske-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <p>No hay categorías aún</p>
        </div>
      ) : (
        <div 
          className="space-y-4"
          role="list"
          aria-label={`${categories.length} categorías de posts`}
        >
          {categories.map((cat) => {
            const percentage = total > 0 ? (cat.count / total) * 100 : 0;
            const color = getCategoryColor(cat.category);
            const label = getCategoryLabel(cat.category);

            return (
              <div 
                key={cat.category}
                role="listitem"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    ></div>
                    <span className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
                      {label}
                    </span>
                  </div>
                  <span 
                    className="text-sm text-black-eske-20 dark:text-[#9AAEBE]"
                    aria-label={`${cat.count} posts, ${Math.round(percentage)} por ciento del total`}
                  >
                    {cat.count} ({Math.round(percentage)}%)
                  </span>
                </div>
                <div 
                  className="w-full bg-gray-eske-20 dark:bg-white/10 rounded-full h-2 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label}: ${Math.round(percentage)}% del total`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color,
                    }}
                  ></div>
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div 
            className="pt-4 border-t border-gray-eske-30 dark:border-white/10"
            role="listitem"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-black-eske dark:text-[#EAF2F8]">Total</span>
              <span 
                className="font-bold text-bluegreen-eske"
                aria-label={`Total de ${total} posts`}
              >
                {total} post{total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

