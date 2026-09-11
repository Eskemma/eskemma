"use client";

// app/centinela/fontana/FontanaWorkspace.tsx
// Contenedor de las 2 pestañas de Fontana (T10): "Fontana" (Canvas) e
// "Indicadores" (acordeón de 5 familias). Reemplaza el bloque de
// tabs+tabla que vivía inline en FontanaMain.tsx. Hospeda también la
// burbuja del agente conversacional; cuando su panel está abierto en
// desktop, el contenido se desplaza a la izquierda (no queda tapado).

import { useEffect, useState } from "react";
import type { FamiliaFontanaId, FontanaCanvasItem, FontanaSesion } from "@/types/fontana.types";
import Tabs from "@/app/components/shared/Tabs";
import FontanaCanvasTab from "./FontanaCanvasTab";
import FontanaIndicadoresAccordion from "./FontanaIndicadoresAccordion";
import FontanaReportePanel from "./FontanaReportePanel";
import FontanaAgentBubble from "./FontanaAgentBubble";

type FontanaTabId = "fontana" | "indicadores" | "reporte";

interface Props {
  sesion: FontanaSesion;
  onSesionActualizada: (sesion: FontanaSesion) => void;
  retornoUrl?: string;
}

export default function FontanaWorkspace({ sesion, onSesionActualizada, retornoUrl }: Props) {
  const [activeTab, setActiveTab] = useState<FontanaTabId>("fontana");
  const [expandedFamily, setExpandedFamily] = useState<FamiliaFontanaId | null>("F1");
  const [canvasItems, setCanvasItems] = useState<FontanaCanvasItem[]>(sesion.canvasItems ?? []);
  const [chatOpen, setChatOpen] = useState(false);
  // jobId de una generación de reporte disparada desde el chat — se pasa al
  // panel para que arranque el polling aunque la pestaña no estuviera abierta.
  const [reporteJobId, setReporteJobId] = useState<string | null>(null);

  // Auto-open del chat SOLO en desktop (≥1024px): en mobile el panel es un
  // bottom sheet a 75vh que taparía casi toda la pantalla al cargar. Init
  // en false (SSR-safe) y se abre en mount si el viewport es ancho.
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setChatOpen(true);
    }
  }, []);

  return (
    <div>
      {/* Contenido — se desplaza en desktop cuando el panel de chat abre. */}
      <div className={`transition-[margin] duration-300 ease-out ${chatOpen ? "lg:mr-[400px]" : ""}`}>
        <div>
          <Tabs
            aria-label="Vistas de Fontana"
            className="px-4 md:px-8 bg-white-eske dark:bg-[#0F2233]"
            tabs={[
              { id: "fontana", label: "Canvas - Fontana" },
              { id: "indicadores", label: "Indicadores" },
              { id: "reporte", label: "Reporte" },
            ]}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as FontanaTabId)}
          />

          {activeTab === "fontana" ? (
            <FontanaCanvasTab
              items={canvasItems}
              sesion={sesion}
              onEliminarItem={(itemId) => setCanvasItems((prev) => prev.filter((it) => it.id !== itemId))}
            />
          ) : activeTab === "indicadores" ? (
            <FontanaIndicadoresAccordion
              sesion={sesion}
              expandedFamily={expandedFamily}
              onExpandedFamilyChange={setExpandedFamily}
              onSesionActualizada={onSesionActualizada}
              retornoUrl={retornoUrl}
            />
          ) : (
            <FontanaReportePanel
              sesion={sesion}
              canvasItems={canvasItems}
              jobIdInicial={reporteJobId}
              onJobIdConsumido={() => setReporteJobId(null)}
              onSesionActualizada={onSesionActualizada}
            />
          )}
        </div>
      </div>

      <FontanaAgentBubble
        sesionId={sesion.sesionId}
        open={chatOpen}
        onOpenChange={setChatOpen}
        onVerCanvas={() => setActiveTab("fontana")}
        onNav={(pestana, familiaId) => {
          setActiveTab(pestana);
          if (pestana === "indicadores" && familiaId) setExpandedFamily(familiaId);
        }}
        onCanvasItem={(item) => {
          setCanvasItems((prev) => [...prev, item]);
          setActiveTab("fontana");
        }}
        onReporteJobIniciado={(jobId) => {
          setReporteJobId(jobId);
          setActiveTab("reporte");
        }}
      />
    </div>
  );
}
