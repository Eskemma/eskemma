// lib/sefix/districtMatching.ts
// Pure function shared between the widget (page.tsx) and server-side
// context builders (sefixContext, generate-m1-express/route.ts).
// No async — callers are responsible for pre-fetching GeoEleccionesOpcion[].

import type { GeoEleccionesOpcion } from "./storage";
import { normalizeGeoName, plegarDiacriticosGeo } from "@/lib/geo/municipioCanonico";

// Comparación por CLAVE INTERNA (MAYÚSCULAS, sin acentos; Ñ/Ü plegadas para
// tolerar "Zuniga"/"Zuñiga"): los nombres de cabecera de Sefix vienen sin
// acentos ("1407 TONALA"), pero el texto del wizard trae los del usuario
// ("Tonalá"). El nombre que se DEVUELVE es el de la opción (formato de display
// de distrito: prefijo + cabecera en MAYÚSCULAS sin acento).
const clave = (s: string) => plegarDiacriticosGeo(normalizeGeoName(s)).trim();

export function matchDistrito(
  opciones: GeoEleccionesOpcion[],
  territorio: { nombre?: string | null; cve_distrito?: string | null }
): string | null {
  const nombreClave = territorio.nombre ? clave(territorio.nombre) : "";

  // Strategy 1: exact name match
  if (nombreClave) {
    const byName = opciones.find(
      (o) => o.nombre && clave(o.nombre) === nombreClave
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
  if (nombreClave) {
    const cabeceraMatch = nombreClave.match(/CON CABECERA EN ([^,]+)/);
    if (cabeceraMatch) {
      const extractedCity = cabeceraMatch[1].trim();
      const byCity = opciones.find((o) => {
        const cityPart = clave(o.nombre.replace(/^\d+\s+/, ""));
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
