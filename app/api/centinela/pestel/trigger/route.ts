// app/api/centinela/pestel/trigger/route.ts
// POST /api/centinela/pestel/trigger
// Body: { projectId: string }
// Creates a job in Firestore and calls the CF without waiting (fire-and-forget).
// Returns { jobId } immediately.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  getResultadosByEstado,
  getPadronByEstado,
  getResultadosLocalesFiltered,
} from "@/lib/sefix/storage";

// ── Sefix priority system ──────────────────────────────────────
// Always 4 Sefix calls ordered by relevance to the project's electoral cargo.
// Federal cargos (dip_fed, sen, pdte) use getResultadosByEstado.
// Local cargos (ayun, dip_loc, gob) use getResultadosLocalesFiltered.

type LocalCargoKey = "ayun" | "dip_loc" | "gob" | "junta" | "alc" | "jef_gob";
type FederalCargoKey = "dip_fed" | "sen" | "pdte";
type SefixCargoKey = LocalCargoKey | FederalCargoKey;

const FEDERAL_CARGO_MAP: Partial<Record<SefixCargoKey, string>> = {
  dip_fed: "diputados",
  sen: "senadores",
  pdte: "presidente",
};

const CARGO_DISPLAY: Partial<Record<SefixCargoKey, string>> = {
  ayun: "AYUNTAMIENTOS",
  dip_loc: "DIPUTADOS LOCALES",
  gob: "GOBERNADOR",
  junta: "JUNTA MUNICIPAL",
  alc: "ALCALDÍAS",
  jef_gob: "JEFE DE GOBIERNO",
};

// Returns the 4-cargo priority list aligned to the project's electoral objective.
function getSefixPriority(tipo: string, nivel: string): SefixCargoKey[] {
  if (tipo === "electoral") {
    if (nivel === "municipal") return ["ayun", "dip_loc", "dip_fed", "gob"];
    if (nivel === "distrital") return ["dip_loc", "ayun", "gob", "dip_fed"];
    if (nivel === "estatal") return ["gob", "dip_loc", "ayun", "dip_fed"];
    if (nivel === "federal") return ["dip_fed", "dip_loc", "pdte", "sen"];
    if (nivel === "nacional") return ["pdte", "dip_fed", "sen", "gob"];
    return ["ayun", "dip_loc", "gob", "dip_fed"];
  }
  if (tipo === "legislativo") {
    if (nivel === "federal" || nivel === "nacional") return ["dip_fed", "dip_loc", "pdte", "sen"];
    return ["dip_loc", "ayun", "gob", "dip_fed"];
  }
  if (tipo === "gubernamental") return ["gob", "dip_loc", "ayun", "dip_fed"];
  // ciudadano / default
  return ["ayun", "dip_loc", "gob", "dip_fed"];
}

export interface SefixResultadoNorm {
  estado: string;
  cargo: string;
  anio: number;
  totalVotos: number;
  participacion: number;
  partidos: { partido: string; votos: number; porcentaje: number }[];
  fuente: string;
}

const LOCAL_YEARS_DESC = [2025, 2024, 2021, 2015];

async function fetchCargoPESTEL(
  estadoNombre: string,
  cargoKey: SefixCargoKey
): Promise<SefixResultadoNorm | null> {
  const federalCargo = FEDERAL_CARGO_MAP[cargoKey];
  if (federalCargo) {
    const r = await getResultadosByEstado(estadoNombre, federalCargo);
    if (!r || r.totalVotos === 0) return null;
    return {
      estado: r.estado,
      cargo: r.cargo,
      anio: r.anio,
      totalVotos: r.totalVotos,
      participacion: r.participacion,
      partidos: r.partidos.slice(0, 5),
      fuente: r.fuente,
    };
  }

  // Local cargo — try years descending until data is found
  for (const year of LOCAL_YEARS_DESC) {
    const r = await getResultadosLocalesFiltered({
      estadoNombre,
      cargoKey,
      anioInput: year,
    });
    if (r && r.totalVotos > 0) {
      return {
        estado: r.estado,
        cargo: CARGO_DISPLAY[cargoKey] ?? r.cargo,
        anio: r.anio,
        totalVotos: r.totalVotos,
        participacion: r.participacion,
        partidos: r.partidos.slice(0, 5),
        fuente: r.fuente,
      };
    }
  }
  return null;
}

// ── Route handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as { projectId?: string };
  const { projectId } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const functionsUrl = process.env.FIREBASE_FUNCTIONS_URL;
  if (!functionsUrl) {
    return NextResponse.json(
      { error: "FIREBASE_FUNCTIONS_URL no configurado" },
      { status: 500 }
    );
  }

  // 1. Fetch 4-priority Sefix electoral datasets for the P dimension (best-effort)
  const projectData = projectSnap.data();
  const territorio = projectData?.territorio as
    | { estado?: string; nivel?: string }
    | undefined;
  const tipoProyecto = (projectData?.tipo as string) ?? "ciudadano";
  const estadoNombre = territorio?.estado ?? null;
  const nivelTerritorial = territorio?.nivel ?? "estatal";
  const isNacional = !estadoNombre || nivelTerritorial === "nacional";

  let sefixData: {
    resultadosList: SefixResultadoNorm[];
    padron: unknown;
  } | null = null;

  if (!isNacional && estadoNombre) {
    const priorityCargos = getSefixPriority(tipoProyecto, nivelTerritorial);
    const resultadosList: SefixResultadoNorm[] = [];

    for (const cargoKey of priorityCargos) {
      if (resultadosList.length >= 4) break;
      try {
        const r = await fetchCargoPESTEL(estadoNombre, cargoKey);
        if (r) resultadosList.push(r);
      } catch (e) {
        console.warn(`[trigger] Sefix fetch failed for ${cargoKey}:`, e);
      }
    }

    const padronResult = await getPadronByEstado(estadoNombre).catch(() => null);

    sefixData = { resultadosList, padron: padronResult };
    console.log(
      `[trigger] Sefix: ${resultadosList.length} cargos fetched for ` +
        `${estadoNombre} (tipo=${tipoProyecto}, nivel=${nivelTerritorial}) — ` +
        resultadosList.map((r) => `${r.cargo} ${r.anio}`).join(", ")
    );
  }

  // 2. Pre-create job document
  const jobRef = adminDb.collection("pestel_jobs").doc();
  const jobId = jobRef.id;
  await jobRef.set({
    projectId,
    userId: session.uid,
    status: "pending",
    startedAt: FieldValue.serverTimestamp(),
  });

  // 3. Fire-and-forget: CF updates job asynchronously
  const cfUrl = `${functionsUrl}/scrapeAndAnalyze`;
  console.log(`[trigger] Calling CF: ${cfUrl} — jobId: ${jobId}`);

  fetch(cfUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      userId: session.uid,
      jobId,
      sefixData,
    }),
  })
    .then(async (cfRes) => {
      const text = await cfRes.text().catch(() => "(no body)");
      console.log(`[trigger] CF responded ${cfRes.status}: ${text.slice(0, 200)}`);
    })
    .catch((err) => {
      console.error("[trigger] CF call failed:", err);
    });

  // 4. Return immediately
  return NextResponse.json({ jobId });
}
