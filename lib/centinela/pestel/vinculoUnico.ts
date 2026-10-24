// lib/centinela/pestel/vinculoUnico.ts
// SERVER-ONLY (recibe una transacción de Admin SDK). Unicidad del vínculo Moddulo ↔ PESTEL.
//
// El vínculo vive en DOS lugares: `moddulo_projects/{id}.phases.exploracion.linkedSource` (lado Moddulo) y
// `pestel_projects/{id}.modduloProjectId` (el back-link, lado PESTEL). Un PESTEL solo puede apuntar a UN
// Moddulo. Antes, `import-pestel` escribía el lado Moddulo sin leer ni escribir el back-link: «Vincular de
// nuevo» tras desvincular dejaba el Moddulo apuntando a un PESTEL que no lo reconocía, y nada impedía
// importar un PESTEL que ya estaba vinculado a otro Moddulo.
//
// `prepararVinculoUnico` LEE (dentro de la transacción que escribe) y decide; `aplicarVinculoUnico` ESCRIBE
// con `tx.update`. El llamador debe invocar la primera antes de cualquier escritura de la transacción (las
// lecturas van antes de las escrituras) y la segunda solo si todo lo demás también permite escribir. El
// callback de la transacción puede reintentarse: ninguna de las dos tiene efectos fuera de `tx`.

import type { FieldValue, Firestore, Transaction } from "firebase-admin/firestore";

const PESTEL = "pestel_projects";
const MODDULO = "moddulo_projects";

export type CodigoVinculoUnico = "pestel_no_encontrado" | "pestel_already_linked";

export type PlanVinculoUnico =
  | {
      ok: true;
      /** El back-link del PESTEL aún no apunta a este Moddulo: hay que escribirlo. */
      escribirBacklink: boolean;
      /** PESTEL anterior de este Moddulo que todavía apunta a él: su back-link se limpia. */
      limpiarAnteriorId: string | null;
    }
  | { ok: false; codigo: CodigoVinculoUnico };

export async function prepararVinculoUnico(
  tx: Transaction,
  db: Firestore,
  p: {
    uid: string;
    pestelProjectId: string;
    modduloProjectId: string;
    /** PESTEL (T22) al que el Moddulo estaba vinculado antes, si se está reemplazando. */
    pestelAnteriorId?: string | null;
  }
): Promise<PlanVinculoUnico> {
  const pestelSnap = await tx.get(db.collection(PESTEL).doc(p.pestelProjectId));
  if (!pestelSnap.exists || pestelSnap.data()?.userId !== p.uid) {
    return { ok: false, codigo: "pestel_no_encontrado" };
  }

  const vinculado = pestelSnap.data()?.modduloProjectId;
  let escribirBacklink = true;
  if (typeof vinculado === "string" && vinculado) {
    if (vinculado === p.modduloProjectId) {
      escribirBacklink = false;
    } else {
      // Con o sin `deletedAt`: la papelera no libera el vínculo (solo la purga lo hace). Un back-link a un
      // documento que ya no existe (legado) no bloquea.
      const otro = await tx.get(db.collection(MODDULO).doc(vinculado));
      if (otro.exists) return { ok: false, codigo: "pestel_already_linked" };
    }
  }

  let limpiarAnteriorId: string | null = null;
  const anterior = p.pestelAnteriorId;
  if (anterior && anterior !== p.pestelProjectId) {
    const anteriorSnap = await tx.get(db.collection(PESTEL).doc(anterior));
    if (
      anteriorSnap.exists &&
      anteriorSnap.data()?.userId === p.uid &&
      anteriorSnap.data()?.modduloProjectId === p.modduloProjectId
    ) {
      limpiarAnteriorId = anterior;
    }
  }

  return { ok: true, escribirBacklink, limpiarAnteriorId };
}

export function aplicarVinculoUnico(
  tx: Transaction,
  db: Firestore,
  fv: Pick<typeof FieldValue, "serverTimestamp" | "delete">,
  p: { pestelProjectId: string; modduloProjectId: string },
  plan: Extract<PlanVinculoUnico, { ok: true }>
): void {
  if (plan.escribirBacklink) {
    tx.update(db.collection(PESTEL).doc(p.pestelProjectId), {
      modduloProjectId: p.modduloProjectId,
      updatedAt: fv.serverTimestamp(),
    });
  }
  if (plan.limpiarAnteriorId) {
    tx.update(db.collection(PESTEL).doc(plan.limpiarAnteriorId), {
      modduloProjectId: fv.delete(),
      updatedAt: fv.serverTimestamp(),
    });
  }
}

/**
 * ¿El `linkedSource` de un Moddulo ya reclama un análisis de Centinela DISTINTO del que se va a vincular?
 * El M1 de origen Express también tiene `sourceId`, pero es el id del propio Moddulo (`generate-m1-express`):
 * no es un vínculo con ningún PESTEL, así que no cuenta (antes bloqueaba el paso de Express a Centinela con
 * `moddulo_already_linked`, antes de llegar a la rama de «upgrade»; lo que se pierde al reemplazarlo lo
 * confirma el candado H15).
 */
export function vinculoT22Ajeno(
  linked: { kind?: string; sourceId?: string } | null | undefined,
  p: { pestelProjectId: string; modduloProjectId: string }
): boolean {
  if (!linked?.sourceId) return false;
  if (linked.kind === "express") return false;
  if (linked.sourceId === p.modduloProjectId) return false;
  return linked.sourceId !== p.pestelProjectId;
}
