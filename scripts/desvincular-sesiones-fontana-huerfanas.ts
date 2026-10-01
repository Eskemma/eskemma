/**
 * scripts/desvincular-sesiones-fontana-huerfanas.ts
 * Papelera de proyectos de Moddulo — fase (c), §11.3 del plan (26-09-29).
 * Sesiones de Fontana cuyo `modduloProjectId` apunta a un proyecto que ya NO
 * existe en Firestore (leak de borrados FÍSICOS anteriores a la fase b —
 * `deleteProject` ya no borra físicamente desde esa fase, así que esto no
 * puede volver a ocurrir desde ahí; esto es limpieza de lo ya huérfano).
 *
 * Caso conocido (confirmado de nuevo en esta ronda — escaneo fresco, sigue
 * siendo el único): `1g2BpNMF5PqZq6sSTZkP` → `dFUSiVXEvRIan54C6x2A`, con
 * `tareaPipIds:["3"]` (Escenario A) — la ruta normal de desvincular
 * (`PATCH .../sesion/[id]` con `desvincular:true`) RECHAZA toda sesión de
 * Escenario A con 409 `escenario_a_no_desvinculable`, a propósito (protege
 * al usuario de desvincularse de su propia tarea PIP activa) — por eso este
 * caso necesita este script puntual en vez de la ruta normal.
 *
 * Solo limpia `modduloProjectId` y `tareaPipIds` — NUNCA toca `mensajes`,
 * `adjuntos`, `canvasItems`, `indicadoresPorFamilia`, `territorio` ni
 * ningún otro campo. La sesión queda como una sesión suelta (Escenario
 * b/c), con todo su contenido intacto.
 *
 * DRY-RUN POR DEFECTO (sin flags): escanea TODAS las fontana_sesiones en
 * vivo (no una lista fija — a diferencia del script de Storage, aquí el
 * universo de "huérfanas" puede crecer con el tiempo si aparece un caso
 * nuevo) y muestra cada caso con lo que escribiría. Nada se borra/escribe.
 *
 *   npx tsx scripts/desvincular-sesiones-fontana-huerfanas.ts
 *   npx tsx scripts/desvincular-sesiones-fontana-huerfanas.ts --apply --simular --aprobar=1g2BpNMF5PqZq6sSTZkP
 *   npx tsx scripts/desvincular-sesiones-fontana-huerfanas.ts --apply --aprobar=1g2BpNMF5PqZq6sSTZkP
 *
 *   --aprobar=  ids de sesión separados por coma, aprobados uno por uno
 *               tras revisar el dry-run — nunca "todas" en bloque.
 *   --simular   con --apply: relee en vivo e imprime el payload exacto que
 *               escribiría, sin llamar a `.update()`.
 *   --backup=   archivo donde guardar el estado ANTERIOR de los 2 campos de
 *               cada sesión tocada (defecto: tmp) — sí es restaurable (a
 *               diferencia del script de Storage): basta reescribir esos 2
 *               campos desde el backup.
 *
 * Antes de escribir cada sesión se relee y se aborta esa sesión si cambió
 * desde el dry-run (modduloProjectId distinto, o ya no apunta a un
 * proyecto inexistente — alguien restauró o re-vinculó el proyecto).
 * Idempotente: una sesión ya sin modduloProjectId no vuelve a tocarse.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function arg(nombre: string): string | undefined {
  const f = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  return f ? f.slice(nombre.length + 3) : undefined;
}
const tieneFlag = (n: string) => process.argv.includes(`--${n}`);

const salir = (code: number) =>
  new Promise<never>(() => {
    process.stdout.write("", () => process.exit(code));
  });

interface SesionHuerfana {
  id: string;
  modduloProjectId: string;
  tareaPipIds: string[];
}

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");

  const apply = tieneFlag("apply");
  const simular = tieneFlag("simular");
  const aprobarRaw = arg("aprobar");
  const aprobar = new Set((aprobarRaw ?? "").split(",").map((s) => s.trim()).filter(Boolean));

  // ── Escaneo fresco (siempre corre, incluso con --apply) ───────────────
  const proyectosSnap = await adminDb.collection("moddulo_projects").get();
  const idsExistentes = new Set(proyectosSnap.docs.map((d) => d.id));

  const sesionesSnap = await adminDb.collection("fontana_sesiones").get();
  const huerfanas: SesionHuerfana[] = [];
  for (const doc of sesionesSnap.docs) {
    const s = doc.data();
    const mpid = s.modduloProjectId as string | undefined;
    if (mpid && !idsExistentes.has(mpid)) {
      huerfanas.push({ id: doc.id, modduloProjectId: mpid, tareaPipIds: s.tareaPipIds ?? [] });
    }
  }

  console.log(`=== Sesiones de Fontana huérfanas (escaneo en vivo): ${huerfanas.length} ===\n`);
  for (const h of huerfanas) {
    console.log(`  ${h.id} → modduloProjectId:${h.modduloProjectId} (inexistente)`);
    console.log(`    tareaPipIds actuales: ${JSON.stringify(h.tareaPipIds)}`);
    console.log(`    escribiría: modduloProjectId → (borrado), tareaPipIds → []`);
  }

  if (!apply) {
    console.log(`\nDRY-RUN: no se escribió nada. Para aplicar: --apply --aprobar=<id,...> [--simular]`);
    await salir(0);
  }

  if (aprobar.size === 0) {
    console.error("--apply requiere --aprobar=<id,...>. No se escribió nada.");
    await salir(1);
  }
  const huerfanaPorId = new Map(huerfanas.map((h) => [h.id, h]));
  const noValidos = [...aprobar].filter((id) => !huerfanaPorId.has(id));
  if (noValidos.length > 0) {
    console.error(
      `--aprobar incluye id(s) que NO son huérfanas en este escaneo: ${noValidos.join(", ")}. ` +
      `No se escribió nada (ninguna de las aprobadas se procesa).`
    );
    await salir(1);
  }

  const backupPath = arg("backup") ?? path.join(os.tmpdir(), `desvincular-fontana-huerfanas-${Date.now()}.json`);
  const backup: unknown[] = [];
  let procesadas = 0;

  for (const id of aprobar) {
    const esperada = huerfanaPorId.get(id)!;
    console.log(`\n${simular ? "SIMULANDO" : "PROCESANDO"} ${id}:`);

    // Relectura de concurrencia: aborta si modduloProjectId cambió (ya no
    // es el mismo, o el proyecto ahora SÍ existe — alguien lo restauró).
    const ref = adminDb.collection("fontana_sesiones").doc(id);
    const snapActual = await ref.get();
    if (!snapActual.exists) {
      console.log(`  OMITIDA (la sesión ya no existe): ${id}`);
      continue;
    }
    const actual = snapActual.data()!;
    const actualProyectoExiste = actual.modduloProjectId
      ? (await adminDb.collection("moddulo_projects").doc(actual.modduloProjectId).get()).exists
      : true;
    if (actual.modduloProjectId !== esperada.modduloProjectId || actualProyectoExiste) {
      console.log(
        `  OMITIDA (cambió desde el dry-run — modduloProjectId:${actual.modduloProjectId}, ` +
        `proyecto existe:${actualProyectoExiste}): ${id}`
      );
      continue;
    }

    if (simular) {
      console.log(`  SIMULADO: modduloProjectId → (borrado), tareaPipIds → []`);
      procesadas++;
      continue;
    }

    backup.push({
      id,
      antes: { modduloProjectId: actual.modduloProjectId, tareaPipIds: actual.tareaPipIds ?? [] },
    });
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

    await ref.update({
      modduloProjectId: FieldValue.delete(),
      tareaPipIds: [],
      fechaUltimoGuardado: new Date().toISOString(),
    });
    procesadas++;
    console.log(`  DESVINCULADA: ${id}`);
  }

  console.log(
    simular
      ? `\nSIMULACIÓN: ${procesadas} sesión(es) se desvincularían; NO se escribió nada.`
      : `\nSesiones desvinculadas: ${procesadas}. Respaldo previo: ${backupPath}`
  );
  await salir(0);
}

main().catch(async (e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  await salir(1);
});
