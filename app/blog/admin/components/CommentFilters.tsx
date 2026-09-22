// app/blog/admin/components/CommentFilters.tsx
"use client";

interface CommentFiltersProps {
  statusFilter: "all" | "pending" | "approved" | "rejected";
  onStatusChange: (status: "all" | "pending" | "approved" | "rejected") => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  counts: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export default function CommentFilters({
  statusFilter,
  onStatusChange,
  searchTerm,
  onSearchChange,
  counts,
}: CommentFiltersProps) {
  const filters = [
    { id: "all", label: "Todos", count: counts.all, color: "bg-gray-eske-60" },
    { id: "pending", label: "Pendientes", count: counts.pending, color: "bg-yellow-eske" },
    { id: "approved", label: "Aprobados", count: counts.approved, color: "bg-green-eske" },
    { id: "rejected", label: "Rechazados", count: counts.rejected, color: "bg-red-eske" },
  ];

  return (
    <section 
      className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md border border-gray-eske-30 dark:border-white/10 p-6"
      aria-labelledby="comment-filters-title"
    >
      <h2 id="comment-filters-title" className="sr-only">
        Filtros de comentarios
      </h2>
      <div className="space-y-4">
        {/* Búsqueda */}
        <div className="relative">
          <label htmlFor="comment-search" className="sr-only">
            Buscar comentarios por contenido o autor
          </label>
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-black-eske-20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            id="comment-search"
            placeholder="Buscar por contenido o autor..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294] rounded-lg focus-ring-primary"
            aria-describedby="search-hint"
          />
          <p id="search-hint" className="sr-only">
            Filtra los comentarios por contenido o nombre del autor
          </p>
        </div>

        {/* Filtros de Estado */}
        <div 
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          role="radiogroup"
          aria-label="Filtrar comentarios por estado"
        >
          {filters.map((filter) => {
            const isActive = statusFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => onStatusChange(filter.id as any)}
                role="radio"
                aria-checked={isActive}
                aria-label={`${filter.label}: ${filter.count} comentario${filter.count !== 1 ? 's' : ''}`}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200 focus-ring-primary ${
                  isActive
                    ? `${filter.color} text-white border-transparent shadow-md`
                    : "bg-white dark:bg-[#112230] border-gray-eske-30 dark:border-white/10 text-black-eske-40 dark:text-[#C7D6E0] hover:border-gray-eske-60 dark:hover:border-white/20"
                }`}
              >
                <div className="text-left">
                  <p className={`text-sm font-semibold ${isActive ? "text-white" : "text-black-eske-20 dark:text-[#9AAEBE]"}`}>
                    {filter.label}
                  </p>
                  <p 
                    className={`text-2xl font-bold ${isActive ? "text-white" : "text-black-eske dark:text-[#EAF2F8]"}`}
                    aria-hidden="true"
                  >
                    {filter.count}
                  </p>
                </div>
                {isActive && (
                  <svg 
                    className="w-6 h-6" 
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
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

