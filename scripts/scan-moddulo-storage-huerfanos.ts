/**
 * scripts/scan-moddulo-storage-huerfanos.ts
 * Papelera de proyectos de Moddulo — fase (c), Punto 5 del plan (26-09-29).
 * Los 4 `projectId` de abajo son un leak real de borrados FÍSICOS
 * anteriores a esta ronda (deleteProject ya no borra físicamente desde la
 * fase b) — confirmado por Raúl (26-09-29) que el único uid involucrado
 * (TDkdebtXdrVQujKriTkNe1cqtBf2, raoulsalgado@yahoo.com.mx) es su propia
 * cuenta de pruebas, no un cliente real.
 *
 * DRY-RUN POR DEFECTO (sin flags): solo LEE y muestra cada archivo, tamaño,
 * fecha y uid, más el cruce contra users/{uid}. Nada se borra.
 *
 *   npx tsx scripts/scan-moddulo-storage-huerfanos.ts
 *   npx tsx scripts/scan-moddulo-storage-huerfanos.ts --apply --simular \
 *       --aprobar=GBcQNQ9t3hIBVaexGoT8,ZRp97GdIyFPcUipBCezB,rfDKymiEnJ5bP7NlDqUd,xU9YuWPFZBQnuiYj0K4F
 *   npx tsx scripts/scan-moddulo-storage-huerfanos.ts --apply \
 *       --aprobar=GBcQNQ9t3hIBVaexGoT8,ZRp97GdIyFPcUipBCezB,rfDKymiEnJ5bP7NlDqUd,xU9YuWPFZBQnuiYj0K4F
 *
 *   --aprobar=  projectId separados por coma. SOLO acepta ids de
 *               PROJECT_IDS_HUERFANOS (lista fija abajo) — cualquier otro id
 *               se rechaza sin tocar nada, para que este script nunca pueda
 *               usarse como borrador genérico de Storage.
 *   --simular   con --apply: relee los archivos en vivo (frescura,
 *               concurrencia) e imprime el payload EXACTO que se borraría
 *               (ruta, tamaño, proyecto) — no llama a ningún .delete().
 *   --backup=   archivo donde guardar los METADATOS (ruta/tamaño/uid/fecha)
 *               de cada archivo ANTES de borrarlo (defecto: tmp). Nota
 *               honesta: esto NO es una copia del contenido — Cloud Storage
 *               no tiene "papelera" salvo que el bucket tenga versionado de
 *               objetos activado (no verificado aquí); el borrado real es
 *               irreversible salvo por ese mecanismo externo. El backup solo
 *               sirve para saber QUÉ se borró, no para restaurarlo.
 *
 * Antes de borrar cada archivo se relee su existencia (guarda de
 * concurrencia — si alguien ya lo borró entre el dry-run y esta corrida, se
 * omite sin error). Nunca toca una ruta que no empiece con
 * `moddulo/{cualquier-uid}/{projectId-aprobado}/` — verificado por archivo,
 * no solo por prefijo de listado.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// projectId huérfanos ya detectados en scan-moddulo-orphans.ts (fase a,
// 26-09-28) — 4 projectId, 25 archivos en total (1+19+2+3), confirmados por
// el dry-run de este mismo script (26-09-29). Lista FIJA a propósito: es el
// único allow-list de --aprobar, nunca se acepta un id fuera de aquí.
const PROJECT_IDS_HUERFANOS = [
  "GBcQNQ9t3hIBVaexGoT8",
  "ZRp97GdIyFPcUipBCezB",
  "rfDKymiEnJ5bP7NlDqUd",
  "xU9YuWPFZBQnuiYj0K4F",
];

function arg(nombre: string): string | undefined {
  const f = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  return f ? f.slice(nombre.length + 3) : undefined;
}
const tieneFlag = (n: string) => process.argv.includes(`--${n}`);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Confirma que una ruta de Storage pertenece EXACTAMENTE a
// moddulo/{cualquier-uid}/{projectId}/... — nunca se borra nada cuya forma
// no calce esto, aunque el listado de Storage lo haya devuelto.
function perteneceAlProyecto(nombre: string, projectId: string): boolean {
  const partes = nombre.split("/");
  return partes.length >= 3 && partes[0] === "moddulo" && partes[2] === projectId;
}

// process.exit() truncaba salida cuando stdout es un pipe — se vacía antes.
const salir = (code: number) =>
  new Promise<never>(() => {
    process.stdout.write("", () => process.exit(code));
  });

async function main() {
  const { adminDb, adminStorage } = await import("../lib/firebase-admin");
  const bucket = adminStorage.bucket();

  const apply = tieneFlag("apply");
  const simular = tieneFlag("simular");
  const aprobarRaw = arg("aprobar");
  const aprobar = new Set((aprobarRaw ?? "").split(",").map((s) => s.trim()).filter(Boolean));

  // ── Reporte de solo lectura (siempre corre, incluso con --apply) ─────
  const [todosLosArchivos] = await bucket.getFiles({ prefix: "moddulo/" });
  const uidsVistos = new Set<string>();
  let totalArchivos = 0;
  let totalBytes = 0;

  console.log(`=== Escaneo — ${PROJECT_IDS_HUERFANOS.length} projectId huérfanos ===\n`);

  const porProyecto: Record<string, { name: string; size: number; updated: string; uid: string }[]> = {};
  for (const projectId of PROJECT_IDS_HUERFANOS) {
    const archivosDeEste = todosLosArchivos.filter((f) => perteneceAlProyecto(f.name, projectId));
    porProyecto[projectId] = archivosDeEste.map((f) => ({
      name: f.name,
      size: Number(f.metadata.size ?? 0),
      updated: String(f.metadata.updated ?? f.metadata.timeCreated ?? "(sin fecha)"),
      uid: f.name.split("/")[1],
    }));
    console.log(`--- ${projectId} (${archivosDeEste.length} archivo(s)) ---`);
    for (const f of porProyecto[projectId]) {
      uidsVistos.add(f.uid);
      totalBytes += f.size;
      totalArchivos++;
      console.log(`  ${f.name}`);
      console.log(`    uid: ${f.uid} · tamaño: ${formatBytes(f.size)} · última modificación: ${f.updated}`);
    }
    console.log("");
  }

  console.log(`=== Cruce de uids contra users/{uid} ===`);
  for (const uid of uidsVistos) {
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      console.log(`  ${uid} → NO existe en users/ (cuenta ya eliminada, o uid inválido)`);
      continue;
    }
    const u = userSnap.data() ?? {};
    console.log(`  ${uid} → email: ${u.email ?? "(sin email)"} · role: ${u.role ?? "(sin role)"}`);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Total de archivos huérfanos: ${totalArchivos}`);
  console.log(`Espacio total ocupado: ${formatBytes(totalBytes)}`);
  console.log(`uids distintos involucrados: ${uidsVistos.size}`);

  if (!apply) {
    console.log(`\nDRY-RUN: no se borró nada. Para aplicar: --apply --aprobar=<projectId,...> [--simular]`);
    await salir(0);
  }

  // ── Aplicación (solo projectId aprobados y dentro de la lista fija) ──
  if (aprobar.size === 0) {
    console.error("--apply requiere --aprobar=<projectId,...>. No se borró nada.");
    await salir(1);
  }
  const noValidos = [...aprobar].filter((id) => !PROJECT_IDS_HUERFANOS.includes(id));
  if (noValidos.length > 0) {
    console.error(
      `--aprobar incluye id(s) fuera de la lista fija de huérfanos conocidos: ${noValidos.join(", ")}. ` +
      `No se borró nada (ninguno de los ids aprobados se procesa).`
    );
    await salir(1);
  }

  const backupPath = arg("backup") ?? path.join(os.tmpdir(), `purga-storage-huerfanos-${Date.now()}.json`);
  const backup: unknown[] = [];
  let borrados = 0;
  let omitidosPorConcurrencia = 0;
  let bytesBorrados = 0;

  for (const projectId of PROJECT_IDS_HUERFANOS) {
    if (!aprobar.has(projectId)) continue;

    console.log(`\n${simular ? "SIMULANDO" : "PROCESANDO"} ${projectId}:`);
    // Relectura de concurrencia: se vuelve a listar EN VIVO (no se confía en
    // porProyecto[] calculado arriba, por si algo cambió mientras corría el
    // reporte) y se filtra de nuevo por pertenencia exacta.
    const [archivosFrescos] = await bucket.getFiles({ prefix: `moddulo/` });
    const vigentes = archivosFrescos.filter((f) => perteneceAlProyecto(f.name, projectId));

    for (const f of vigentes) {
      const size = Number(f.metadata.size ?? 0);
      const updated = String(f.metadata.updated ?? f.metadata.timeCreated ?? "(sin fecha)");
      const uid = f.name.split("/")[1];

      if (simular) {
        console.log(`  SIMULADO borrar: ${f.name} (${formatBytes(size)})`);
        borrados++;
        bytesBorrados += size;
        continue;
      }

      // Guarda de concurrencia: confirma que el archivo AÚN existe justo
      // antes de borrarlo (pudo haberse borrado entre el listado de arriba
      // y este punto, aunque la ventana es de milisegundos).
      const [existeAhora] = await f.exists();
      if (!existeAhora) {
        console.log(`  OMITIDO (ya no existe, borrado por otra vía): ${f.name}`);
        omitidosPorConcurrencia++;
        continue;
      }

      backup.push({ projectId, name: f.name, size, updated, uid, borradoEn: new Date().toISOString() });
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

      await f.delete();
      borrados++;
      bytesBorrados += size;
      console.log(`  BORRADO: ${f.name} (${formatBytes(size)})`);
    }
  }

  console.log(
    simular
      ? `\nSIMULACIÓN: ${borrados} archivo(s) se borrarían (${formatBytes(bytesBorrados)}); NO se borró nada.`
      : `\nArchivos borrados: ${borrados} (${formatBytes(bytesBorrados)}). ` +
        `Omitidos por concurrencia: ${omitidosPorConcurrencia}. Metadatos respaldados en: ${backupPath}`
  );
  await salir(0);
}

main().catch(async (e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  await salir(1);
});
