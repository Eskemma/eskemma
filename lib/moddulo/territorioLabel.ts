// lib/moddulo/territorioLabel.ts
// Extractor compartido de la ciudad cabecera a partir del texto
// descriptivo que el wizard de territorio guarda para niveles
// distrito_federal/distrito_local — formato legado por diseño en todo el
// ecosistema: "Distrito Electoral Federal/Local {num} con cabecera en
// {ciudad}, ...". Mismo regex ya usado en lib/sefix/districtMatching.ts
// (matchDistrito, Strategy 3) y en el fallback de
// app/moddulo/proyecto/[projectId]/exploracion/page.tsx (buildPadronLabel)
// — extraído aquí para que un tercer consumidor (Fontana) no triplique el
// patrón sin nombre compartido.
//
// Fallback agregado 26-08-13 (Fase 1 del rediseño de territorio) — bug
// real encontrado en verificación en vivo contra el proyecto que originó
// este trabajo: TerritorySelector.tsx ya no produce la frase "con cabecera
// en X" — desde Fase 1, territorio.municipio para niveles distritales de
// México YA ES el nombre limpio de la cabecera (ej. "IZTAPALAPA"), resuelto
// del catálogo real del INE. Sin este fallback, extraerCiudadCabecera
// devolvía null para cualquier proyecto creado/editado con el selector
// nuevo — Fontana seguía mostrando "sin municipio definido" pese a que el
// dato correcto ya estaba en Firestore. Los 9 consumidores de Fontana
// llaman esta función SOLO para nivel distrito_federal/distrito_local
// (nunca para "municipal", que usa territorio.municipio directo sin pasar
// por aquí) — el fallback es seguro para ambos formatos: si el texto trae
// la frase legada, se sigue extrayendo igual que antes; si no la trae (caso
// nuevo), se asume que el texto YA es el nombre limpio y se devuelve tal
// cual, en vez de descartarlo.
export function extraerCiudadCabecera(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const match = texto.toLowerCase().match(/con cabecera en ([^,]+)/);
  if (match) return match[1].trim();
  return texto.trim() || null;
}
