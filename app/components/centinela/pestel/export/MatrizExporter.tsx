// app/components/centinela/pestel/export/MatrizExporter.tsx
"use client";

import type { PESTELFeed } from "@/types/pestel.types";

interface MatrizExporterProps {
  feed: PESTELFeed;
}

export default function MatrizExporter({ feed }: MatrizExporterProps) {
  void feed;
  return (
    <div className="p-4 bg-white-eske dark:bg-[#18324A] rounded-lg border border-gray-eske-10 dark:border-white/10 text-gray-eske-90 dark:text-[#6D8294] text-sm">
      [ MatrizExporter — pendiente ]
    </div>
  );
}
