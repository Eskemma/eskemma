// lib/centinela/pestel/asimetriasVinculo.ts
// T5: asimetrías entre los DOS lados del vínculo Moddulo ↔ PESTEL (el `linkedSource` del Moddulo y los back-links
// `pestel_projects.modduloProjectId`). Pura. `find-linked-pestel` las deja en el log (solo tipo e ids, sin contenido)
// desde que dejó de reparar: antes el repair escribía el `linkedSource` y las tapaba; ahora se ven.
//
// NO son asimetrías: un back-link sin `linkedSource`, o con un `linkedSource` express (es el vínculo PENDIENTE de T5),
// ni un back-link cuyo PESTEL coincide con el `sourceId` del `linkedSource`.

export type TipoAsimetria =
  | "varios_pendientes"
  | "t22_sin_backlink"
  | "backlink_con_t22_de_otro"
  | "pendiente_antiguo_distinto";

export interface Asimetria {
  tipo: TipoAsimetria;
  modduloId: string;
  pestelIds: string[];
}

export function clasificarAsimetrias(i: {
  modduloId: string;
  linkedSource: { kind?: string; sourceId?: string; sourceAnalysisId?: string } | null | undefined;
  /** Ids de los PESTEL DEL USUARIO cuyo back-link apunta a este Moddulo. */
  backlinks: string[];
}): Asimetria[] {
  const out: Asimetria[] = [];
  const { modduloId, linkedSource: ls, backlinks } = i;
  if (backlinks.length > 1) out.push({ tipo: "varios_pendientes", modduloId, pestelIds: [...backlinks] });
  if (ls?.kind === "T22" && ls.sourceId) {
    const coincide = backlinks.includes(ls.sourceId);
    if (ls.sourceAnalysisId) {
      if (backlinks.length === 0) out.push({ tipo: "t22_sin_backlink", modduloId, pestelIds: [ls.sourceId] });
      else if (!coincide) out.push({ tipo: "backlink_con_t22_de_otro", modduloId, pestelIds: [...backlinks, ls.sourceId] });
    } else if (backlinks.length > 0 && !coincide) {
      out.push({ tipo: "pendiente_antiguo_distinto", modduloId, pestelIds: [...backlinks, ls.sourceId] });
    }
  }
  return out;
}
