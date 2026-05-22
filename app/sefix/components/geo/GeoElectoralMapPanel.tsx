// app/sefix/components/geo/GeoElectoralMapPanel.tsx
import GeoElectoralMapContent from "./GeoElectoralMapContent";

export default function GeoElectoralMapPanel() {
  return (
    <section
      id="sefix-panel-geo"
      role="tabpanel"
      aria-labelledby="sefix-tab-geo"
    >
      <GeoElectoralMapContent />
    </section>
  );
}
