// lib/moddulo/territorioLabel.ts
// Extractor compartido de la ciudad cabecera a partir del texto
// descriptivo que el wizard de territorio guarda para niveles
// distrito_federal/distrito_local — formato por diseño en todo el
// ecosistema: "Distrito Electoral Federal/Local {num} con cabecera en
// {ciudad}, ...". Mismo regex ya usado en lib/sefix/districtMatching.ts
// (matchDistrito, Strategy 3) y en el fallback de
// app/moddulo/proyecto/[projectId]/exploracion/page.tsx (buildPadronLabel)
// — extraído aquí para que un tercer consumidor (Fontana) no triplique el
// patrón sin nombre compartido.

export function extraerCiudadCabecera(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const match = texto.toLowerCase().match(/con cabecera en ([^,]+)/);
  return match ? match[1].trim() : null;
}
