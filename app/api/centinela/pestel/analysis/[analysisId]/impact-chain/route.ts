// app/api/centinela/pestel/analysis/[analysisId]/impact-chain/route.ts
// POST  — Add an analyst-created impact chain to pestel_analyses.impactChains
// DELETE — Remove an analyst-created impact chain, by its `chainId` (7a, H25). The index is
//          kept only as a fallback for chains WITHOUT an id (see the DELETE handler).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { DimensionCode, RiskLevel, ImpactChain } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

async function verifyOwnership(analysisId: string, uid: string) {
  const snap = await adminDb.collection("pestel_analyses").doc(analysisId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(data.projectId as string)
    .get();
  if (!projectSnap.exists || projectSnap.data()?.userId !== uid) return null;
  return { snap, data };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;
  const ownership = await verifyOwnership(analysisId, session.uid);
  if (!ownership) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = (await request.json()) as {
    dimensions?: DimensionCode[];
    description?: string;
    riskLevel?: RiskLevel;
    recommendation?: string;
  };

  const { dimensions, description, riskLevel, recommendation } = body;

  if (!dimensions || dimensions.length === 0 || !description?.trim() || !riskLevel) {
    return NextResponse.json(
      { error: "dimensions, description y riskLevel son requeridos" },
      { status: 400 }
    );
  }

  const newChain: ImpactChain = {
    // 7a (H25): stable identity. NOTE: before 7a this object was fully deterministic (no
    // timestamp, no variable field), so `arrayUnion` de-duplicated an identical retry after
    // an ambiguous network failure; with a per-request UUID a retry adds a second card
    // (visible, and now deletable by id). The screen keeps what the user typed and asks them
    // to check the list before retrying.
    id: crypto.randomUUID(),
    dimensions,
    description: description.slice(0, 200),
    riskLevel,
    recommendation: (recommendation ?? "").slice(0, 100),
    source: "analyst",
    addedByUserId: session.uid,
  };

  await adminDb.collection("pestel_analyses").doc(analysisId).update({
    impactChains: FieldValue.arrayUnion(newChain),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, chain: newChain });
}

// Result of the delete decision. The transaction callback may be RETRIED by Firestore, so it
// builds no response and has no side effect other than the single `tx.update` of the
// success branch; the HTTP response is built from this value, outside.
type ResultadoBorrado =
  | { tipo: "borrada" }
  | { tipo: "no_encontrada" }
  | { tipo: "duplicada" }
  | { tipo: "no_analista" }
  | { tipo: "requiere_id" };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;
  const ownership = await verifyOwnership(analysisId, session.uid);
  if (!ownership) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  let body: { chainId?: unknown; index?: unknown };
  try {
    body = (await request.json()) as { chainId?: unknown; index?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // `chainId` wins. If the property is present it must be a non-empty string: anything else
  // (number, object, null, "") is a 400 and NEVER falls back to the index. Only an ABSENT
  // `chainId` (undefined) uses `index`, which must be an integer >= 0.
  let chainId: string | undefined;
  let index: number | undefined;
  if (body.chainId !== undefined) {
    if (typeof body.chainId !== "string" || body.chainId.trim().length === 0) {
      return NextResponse.json({ error: "chainId debe ser un texto no vacío" }, { status: 400 });
    }
    chainId = body.chainId;
  } else if (body.index !== undefined) {
    if (typeof body.index !== "number" || !Number.isInteger(body.index) || body.index < 0) {
      return NextResponse.json({ error: "index debe ser un entero mayor o igual a 0" }, { status: 400 });
    }
    index = body.index;
  } else {
    return NextResponse.json({ error: "chainId o index es requerido" }, { status: 400 });
  }

  const ref = adminDb.collection("pestel_analyses").doc(analysisId);
  const resultado = await adminDb.runTransaction(async (tx): Promise<ResultadoBorrado> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { tipo: "no_encontrada" };
    // Copy: the snapshot's own array is never mutated.
    const chains = [...((snap.data()?.impactChains ?? []) as ImpactChain[])];

    let posicion: number;
    if (chainId !== undefined) {
      const coincidencias: number[] = [];
      chains.forEach((c, i) => {
        if (c.id === chainId) coincidencias.push(i);
      });
      if (coincidencias.length === 0) return { tipo: "no_encontrada" };
      if (coincidencias.length > 1) return { tipo: "duplicada" };
      posicion = coincidencias[0];
    } else {
      // ── Fallback by index (ONLY for chains WITHOUT an id) ─────────────────────────────
      // Kept for chains created before 7a and for a tab still running the previous client.
      // A tab opened before the deploy keeps its old JavaScript until it is reloaded, so it
      // can reload the list, see chains WITH id and try to delete them by position from a
      // stale list: that is exactly what this fallback must NOT do, hence `requiere_id`.
      // It can be retired when (1) no analyst chain without id remains — a read-only count
      // of `pestel_analyses[].impactChains` with `source:"analyst"` and no `id` must give 0
      // (it was 0 of 519 chains on 26-10-11) — and (2) the log label
      // `[impact-chain][respaldo-indice]` below no longer appears in the production logs
      // for a period longer than the life of a session (5 days; 30 to be safe).
      const candidata = chains[index as number];
      if (!candidata) return { tipo: "no_encontrada" };
      if (typeof candidata.id === "string" && candidata.id.length > 0) return { tipo: "requiere_id" };
      posicion = index as number;
    }

    // Only analyst-created chains can be deleted (AI chains have no `source`).
    if (chains[posicion].source !== "analyst") return { tipo: "no_analista" };

    chains.splice(posicion, 1);
    tx.update(ref, { impactChains: chains, updatedAt: FieldValue.serverTimestamp() });
    return { tipo: "borrada" };
  });

  if (index !== undefined) {
    console.warn("[impact-chain][respaldo-indice] borrado por índice (cliente anterior o cadena sin id):", resultado.tipo);
  }

  switch (resultado.tipo) {
    case "borrada":
      return NextResponse.json({ ok: true });
    case "no_encontrada":
      return NextResponse.json({ error: "Cadena no encontrada" }, { status: 404 });
    case "duplicada":
      // Valid request, but two chains share the id: nothing is deleted. 409 (state conflict).
      return NextResponse.json({ error: "cadena_id_duplicado" }, { status: 409 });
    case "requiere_id":
      return NextResponse.json({ error: "requiere_chain_id" }, { status: 409 });
    case "no_analista":
      return NextResponse.json(
        { error: "Solo se pueden eliminar cadenas creadas por el analista" },
        { status: 403 }
      );
  }
}
