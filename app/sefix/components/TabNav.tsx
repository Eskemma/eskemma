"use client";

import { SEFIX_TABS, SefixTabId } from "@/types/sefix.types";

interface TabNavProps {
  activeTab: SefixTabId;
  onTabChange: (tab: SefixTabId) => void;
}

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav
      className="w-full bg-white-eske dark:bg-[#0B1620] border-b border-gray-eske-20 dark:border-white/10 overflow-x-auto"
      aria-label="Navegación de módulos Sefix"
    >
      <ul
        className="flex min-w-max px-4 sm:px-6 md:px-8"
        role="tablist"
      >
        {SEFIX_TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <li key={tab.id} role="presentation">
              <button
                role="tab"
                aria-selected={isActive}
                aria-controls={`sefix-panel-${tab.id}`}
                id={`sefix-tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={[
                  "relative px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske",
                  isActive
                    ? "text-blue-eske border-b-2 border-blue-eske"
                    : "text-black-eske-20 dark:text-[#9AAEBE] hover:text-blue-eske border-b-2 border-transparent",
                ].join(" ")}
              >
                {tab.label}
                {!tab.available && (
                  <span
                    className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-gray-eske-40 align-middle mb-0.5"
                    aria-label="Próximamente"
                    title="Próximamente"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
