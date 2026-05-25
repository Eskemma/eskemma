"use client";

import { useState } from "react";
import type { UserRole } from "@/types/subscription.types";
import type { SefixTabId } from "@/types/sefix.types";
import SefixHeroSection from "./SefixHeroSection";
import TabNav from "./components/TabNav";
import LnePanel from "./components/LnePanel";
import EleccionesFedPanel from "./components/EleccionesFedPanel";
import EleccionesLocalesPanel from "./components/EleccionesLocalesPanel";
import GeoElectoralMapPanel from "./components/geo/GeoElectoralMapPanel";
import GeoEcegPanel from "./components/geo/GeoEcegPanel";
import UnderConstructionPage from "@/app/components/UnderConstructionPage";

interface SefixDashboardProps {
  role: UserRole | null;
}

export default function SefixDashboard({ role: _role }: SefixDashboardProps) {
  const [activeTab, setActiveTab] = useState<SefixTabId>("lne");

  return (
    <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      <SefixHeroSection />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Paneles de contenido */}
      {activeTab === "lne" && <LnePanel />}
      {activeTab === "elecciones_fed" && <EleccionesFedPanel />}
      {activeTab === "elecciones_loc" && <EleccionesLocalesPanel />}
      {activeTab === "geo" && <GeoElectoralMapPanel />}
      {activeTab === "geoestadisticos" && <GeoEcegPanel />}
      {activeTab === "otros" && (
        <section
          id="sefix-panel-otros"
          role="tabpanel"
          aria-labelledby="sefix-tab-otros"
        >
          <UnderConstructionPage title="Otros Estadísticos" />
        </section>
      )}
    </main>
  );
}
