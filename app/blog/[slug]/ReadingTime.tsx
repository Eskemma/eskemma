// app/blog/[slug]/ReadingTime.tsx
"use client";

interface ReadingTimeProps {
  minutes: number;
}

export default function ReadingTime({ minutes }: ReadingTimeProps) {
  return (
    <div 
      className="flex items-center gap-2 text-sm text-black-eske-20 dark:text-[#9AAEBE]"
      role="text"
      aria-label={`Tiempo estimado de lectura: ${minutes} minuto${minutes !== 1 ? 's' : ''}`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{minutes} min de lectura</span>
    </div>
  );
}