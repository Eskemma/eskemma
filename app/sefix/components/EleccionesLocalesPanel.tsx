"use client";

import EleccionesLocalesPanelContent from "./elecciones-locales/EleccionesLocalesPanelContent";

export default function EleccionesLocalesPanel() {
  return (
    <section
      id="sefix-panel-elecciones_loc"
      role="tabpanel"
      aria-labelledby="sefix-tab-elecciones_loc"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
        <EleccionesLocalesPanelContent />
      </div>
    </section>
  );
}
