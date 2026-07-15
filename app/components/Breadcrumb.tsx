// app/components/Breadcrumb.tsx
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Ruta de navegación" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-black-eske-60 dark:text-[#9AAEBE]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1 min-w-0">
              {index > 0 && (
                <span aria-hidden="true" className="select-none">/</span>
              )}
              {isLast || !item.href ? (
                <span aria-current="page" className="text-black-eske dark:text-[#EAF2F8] font-medium truncate max-w-[200px] sm:max-w-xs">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-bluegreen-eske dark:hover:text-bluegreen-eske-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske rounded"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
