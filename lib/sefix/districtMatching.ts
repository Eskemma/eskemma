// lib/sefix/districtMatching.ts
// Pure function shared between the widget (page.tsx) and server-side
// context builders (sefixContext, generate-m1-express/route.ts).
// No async — callers are responsible for pre-fetching GeoEleccionesOpcion[].

import type { GeoEleccionesOpcion } from "./storage";

export function matchDistrito(
  opciones: GeoEleccionesOpcion[],
  territorio: { nombre?: string | null; cve_distrito?: string | null }
): string | null {
  const nombreLower = territorio.nombre?.trim().toLowerCase();

  // Strategy 1: exact name match
  if (nombreLower) {
    const byName = opciones.find(
      (o) => o.nombre?.trim().toLowerCase() === nombreLower
    );
    if (byName) return byName.nombre;
  }

  // Strategy 2: cve_distrito match (when wizard sets this field)
  if (territorio.cve_distrito) {
    const byCve = opciones.find((o) => o.cve === territorio.cve_distrito);
    if (byCve) return byCve.nombre;
  }

  // Strategy 3: wizard descriptor "... con cabecera en {ciudad}, ..."
  // territorio.nombre from the wizard is a full descriptive string like:
  // "Jalisco › Distrito Electoral Federal V con cabecera en Puerto Vallarta, ..."
  // opcion.nombre from the CSV is "{nationalCode} {CITY}" e.g. "1405 PUERTO VALLARTA"
  if (nombreLower) {
    const cabeceraMatch = nombreLower.match(/con cabecera en ([^,]+)/);
    if (cabeceraMatch) {
      const extractedCity = cabeceraMatch[1].trim();
      const byCity = opciones.find((o) => {
        const cityPart = o.nombre.replace(/^\d+\s+/, "").trim().toLowerCase();
        return cityPart === extractedCity;
      });
      if (byCity) return byCity.nombre;
    }
  }

  return null;
}

/**
 * Formats a raw CSV cabecera value into a human-readable district label.
 * Raw format: "{2-digit-state-code}{2-digit-district-padded} {CITY_IN_CAPS}"
 * e.g. "1405 PUERTO VALLARTA" → "Dtto. Elect. Federal 05 - Puerto Vallarta"
 */
export function formatDistritoCabecera(
  raw: string,
  tipo: "federal" | "local"
): string {
  const m = raw.match(/^(\d{2})(\d{2})\s+(.+)$/);
  if (!m) return raw;
  const num = m[2]; // Already zero-padded from source (e.g. "05")
  const city = m[3]
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const tipoLabel = tipo === "federal" ? "Federal" : "Local";
  return `Dtto. Elect. ${tipoLabel} ${num} - ${city}`;
}
