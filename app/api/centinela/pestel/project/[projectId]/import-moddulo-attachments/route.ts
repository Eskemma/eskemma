// app/api/centinela/pestel/project/[projectId]/import-moddulo-attachments/route.ts
// POST — Importa adjuntos de F2 (Moddulo) como fuentes de datos PESTEL.
// Clasifica cada documento en una dimensión P/E/S/T/Ec/L mediante Claude.
// Se llama una sola vez; marca el proyecto con modduloAttachmentsImported: true.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic } from "@/lib/ai/claude";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import type { DimensionCode } from "@/types/pestel.types";
import { DIMENSION_ORDER } from "@/types/pestel.types";
import type { ChatAttachment } from "@/types/moddulo.types";

const CLAUDE_MODEL = "claude-sonnet-4-6";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

interface StoredAttachment {
  nombre: string;
  url: string;
  tipo: string;
  cargadoEn: string;
  textoExtraido?: string;
}

interface ClassificationResult {
  nombre: string;
  dimension: DimensionCode;
  resumen: string;
}

async function classifyDocuments(
  docs: { nombre: string; texto: string }[]
): Promise<ClassificationResult[]> {
  const prompt = `Clasifica cada documento en la dimensión PESTEL más relevante.

Dimensiones:
P = Político (electoral, gobierno, partidos, poder, campañas)
E = Económico (presupuesto, PIB, empleo, mercados, finanzas, precios)
S = Social (demografía, opinión pública, cultura, medios, comunidades)
T = Tecnológico (infraestructura digital, innovación, redes sociales, datos)
Ec = Ecológico (medio ambiente, clima, agua, territorio, riesgos naturales)
L = Legal (leyes, reglamentos, LGIPE, INE, tribunales, derechos)

Documentos a clasificar:
${docs.map((d, i) => `--- Documento ${i + 1}: ${d.nombre} ---\n${d.texto.substring(0, 1500)}`).join("\n\n")}

Responde ÚNICAMENTE con un JSON array, sin texto adicional:
[{"nombre": "<nombre exacto del archivo>", "dimension": "<código>", "resumen": "<1 oración describiendo el contenido>"}]`;

  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const block = msg.content[0];
  if (block.type !== "text") return [];

  try {
    const raw = block.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(raw) as ClassificationResult[];
    return parsed.filter(
      (r) => r.nombre && DIMENSION_ORDER.includes(r.dimension as DimensionCode)
    );
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;

  // Verificar propiedad del proyecto PESTEL
  const pestSnap = await adminDb.collection("pestel_projects").doc(projectId).get();
  if (!pestSnap.exists || pestSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const pestData = pestSnap.data()!;
  const modduloProjectId = pestData.modduloProjectId as string | undefined;

  if (!modduloProjectId) {
    return NextResponse.json({ error: "Este proyecto no tiene un proyecto Moddulo asociado" }, { status: 400 });
  }

  if (pestData.modduloAttachmentsImported === true) {
    return NextResponse.json({ imported: 0, message: "Ya importado" });
  }

  // Leer adjuntos del proyecto Moddulo y verificar acceso
  const modSnap = await adminDb.collection("moddulo_projects").doc(modduloProjectId).get();
  if (!modSnap.exists) {
    return NextResponse.json({ error: "Proyecto Moddulo no encontrado" }, { status: 404 });
  }

  const modData = modSnap.data()!;
  const hasAccess = (modData.collaborators as { uid: string; role: string }[] | undefined)
    ?.some((c) => c.uid === session.uid && (c.role === "owner" || c.role === "editor"));
  if (!hasAccess) {
    return NextResponse.json({ error: "Sin acceso al proyecto Moddulo" }, { status: 403 });
  }
  const adjuntos: StoredAttachment[] = modData.phases?.exploracion?.archivosAdjuntos ?? [];

  if (adjuntos.length === 0) {
    await adminDb.collection("pestel_projects").doc(projectId).update({
      modduloAttachmentsImported: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ imported: 0, message: "Sin adjuntos en F2" });
  }

  // Obtener texto por adjunto (usar textoExtraido si existe; si no, re-extraer)
  const docsWithText: { adjunto: StoredAttachment; texto: string }[] = await Promise.all(
    adjuntos.map(async (a) => {
      if (a.textoExtraido && a.textoExtraido.length > 50) {
        return { adjunto: a, texto: a.textoExtraido };
      }
      // Re-extraer si no hay texto almacenado (adjuntos anteriores al cambio)
      try {
        const chatAttachment: ChatAttachment = { nombre: a.nombre, url: a.url, tipo: a.tipo };
        const texto = await extractTextPerFile(chatAttachment);
        return { adjunto: a, texto };
      } catch {
        return { adjunto: a, texto: a.nombre };
      }
    })
  );

  // Clasificar todos los documentos en una llamada a Claude
  const classifications = await classifyDocuments(
    docsWithText.map((d) => ({ nombre: d.adjunto.nombre, texto: d.texto }))
  );

  // Crear pestel_data_sources para cada adjunto clasificado
  const batch = adminDb.batch();
  let importedCount = 0;

  for (const { adjunto, texto } of docsWithText) {
    const cls = classifications.find((c) => c.nombre === adjunto.nombre);
    const dimensionCode: DimensionCode = cls?.dimension ?? "P";
    const resumen = cls?.resumen ?? adjunto.nombre;

    const ref = adminDb.collection("pestel_data_sources").doc();
    batch.set(ref, {
      projectId,
      userId: session.uid,
      content: resumen + (texto.length > 100 ? `\n\n${texto.substring(0, 2000)}` : ""),
      dimensionCode,
      source: `F2 Moddulo — ${adjunto.nombre}`,
      capturedAt: FieldValue.serverTimestamp(),
      reliabilityLevel: "MEDIUM",
      isManual: true,
      modduloAttachment: {
        nombre: adjunto.nombre,
        url: adjunto.url,
        tipo: adjunto.tipo,
        cargadoEn: adjunto.cargadoEn,
      },
    });
    importedCount++;
  }

  // Marcar el proyecto como importado
  const pestRef = adminDb.collection("pestel_projects").doc(projectId);
  batch.update(pestRef, {
    modduloAttachmentsImported: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return NextResponse.json({ imported: importedCount });
}
