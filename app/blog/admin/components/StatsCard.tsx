// app/blog/admin/components/StatsCard.tsx
interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

export default function StatsCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: StatsCardProps) {
  return (
    <article className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md border border-gray-eske-30 dark:border-white/10 overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-black-eske-20 dark:text-[#9AAEBE] uppercase tracking-wide">
            {title}
          </h3>
          <div 
            className={`${color} text-white p-3 rounded-lg`}
            aria-hidden="true"
          >
            {icon}
          </div>
        </div>
        
        <div className="space-y-1">
          <p 
            className="text-4xl font-bold text-black-eske dark:text-[#EAF2F8]"
            aria-label={`${value.toLocaleString()} ${title.toLowerCase()}`}
          >
            {value.toLocaleString()}
          </p>
          {subtitle && (
            <p className="text-sm text-black-eske-20 dark:text-[#9AAEBE]">{subtitle}</p>
          )}
        </div>
      </div>
      
      {/* Decorative bottom bar */}
      <div className={`h-1 ${color}`} aria-hidden="true"></div>
    </article>
  );
}

