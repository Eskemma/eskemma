/**
 * scripts/migrar-municipios-clave.ts
 * Paso 2a de la desambiguación geográfica (26-09-24): completa la `clave` de los municipios ya
 * guardados en `territorio.municipiosPorEstado` (o en la lista plana legada
 * `territorio.municipiosSeleccionados` + `territorio.estado`) de moddulo_projects, pestel_projects
 * y fontana_sesiones. Resolución con el MISMO núcleo que usa el formulario
 * (lib/geo/desambiguar.ts + lib/geo/municipioSeleccionado.ts) contra el catálogo real.
 *
 * DRY-RUN POR DEFECTO: sin flags solo LEE y muestra cada caso (C01, C02…) con lo que escribiría.
 * Solo escribe con --apply y únicamente los casos aprobados, uno por uno:
 *
 *   npx tsx scripts/migrar-municipios-clave.ts
 *   npx tsx scripts/migrar-municipios-clave.ts --apply --aprobar=C01,C02,exactos \
 *       --resolver=C09=14:IXTLAHUACAN\ DE\ LOS\ MEMBRILLOS
 *
 *   --aprobar=  ids de caso separados por coma; la palabra `exactos` aprueba todos los casos de
 *               coincidencia exacta (los de alias/parcial y los ambiguos se aprueban por id).
 *   --resolver= <caso>=<clave>: resuelve un caso AMBIGUO eligiendo una de sus opciones reales
 *               (la entrada pasa a llamarse como el municipio oficial elegido). Nunca se
 *               adivina: un ambiguo sin --resolver se deja intacto aunque esté aprobado.
 *   --simular   con --apply: recorre la ruta de escritura completa pero NO escribe (ni respaldo):
 *               imprime el payload exacto de cada documento. Para revisar antes de aplicar.
 *   --backup=   archivo donde guardar el estado anterior de cada documento (defecto: tmp).
 *
 * Solo toca `territorio.municipiosPorEstado`. NO toca `municipiosSeleccionados`, el `municipio`
 * escalar, ni nada del proyecto; los lectores siguen resolviendo por nombre. Antes de escribir
 * cada documento lo relee y aborta ese documento si cambió desde el dry-run. Idempotente.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { desambiguarReferencia, type CandidatoReferencia, type MunicipioCatalogoRef } from "../lib/geo/desambiguar";
import { resolverEstadoCve } from "../lib/geo/estados";
import {
  municipiosDeTerritorio,
  proponerRelleno,
  type PropuestaRelleno,
} from "../lib/geo/municipioSeleccionado";
import type { MunicipioSeleccionado } from "../types/shared.types";

const COLECCIONES = ["moddulo_projects", "pestel_projects", "fontana_sesiones"] as const;

interface Caso {
  id: string;
  col: string;
  docId: string;
  indice: number;
  propuesta: PropuestaRelleno;
}

interface Documento {
  col: string;
  docId: string;
  /** "por_estado": ya tenía municipiosPorEstado; "desde_lista_plana": se crea a partir de la lista legada. */
  origen: "por_estado" | "desde_lista_plana";
  lista: MunicipioSeleccionado[];
  huella: string;
}

function arg(nombre: string): string | undefined {
  const f = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  return f ? f.slice(nombre.length + 3) : undefined;
}
const tieneFlag = (n: string) => process.argv.includes(`--${n}`);

const huellaTerritorio = (t: Record<string, unknown>) =>
  JSON.stringify({ p: t.municipiosPorEstado ?? null, s: t.municipiosSeleccionados ?? null, e: t.estado ?? null });

function etiquetaCoincidencia(p: PropuestaRelleno): string {
  if (p.clase === "unico") return `único (${p.coincidencia})`;
  return p.clase;
}

// process.exit() truncaba la salida cuando stdout es un pipe (`| grep`); se vacía antes de salir.
const salir = (code: number) =>
  new Promise<never>(() => {
    process.stdout.write("", () => process.exit(code));
  });

async function main() {
  const apply = tieneFlag("apply");
  const simular = tieneFlag("simular");
  const aprobar = new Set((arg("aprobar") ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  const resolver = new Map<string, string>(
    process.argv
      .filter((a) => a.startsWith("--resolver="))
      .map((a) => a.slice("--resolver=".length))
      .map((v) => {
        const i = v.indexOf("=");
        return [v.slice(0, i), v.slice(i + 1)] as [string, string];
      })
  );

  const { adminDb } = await import("../lib/firebase-admin");
  const { getMunicipiosOptionsNacional } = await import("../lib/geo/municipios");
  const catalogo: MunicipioCatalogoRef[] = (await getMunicipiosOptionsNacional()).map((m) => ({
    estadoCve: m.estadoCve,
    nombre: m.nombre,
    cve: m.cve,
  }));

  const documentos: Documento[] = [];
  const casos: Caso[] = [];
  for (const col of COLECCIONES) {
    const snap = await adminDb.collection(col).get();
    for (const d of [...snap.docs].sort((a, b) => a.id.localeCompare(b.id))) {
      const t = d.data().territorio as Record<string, unknown> | undefined;
      if (!t) continue;
      const lista = municipiosDeTerritorio(t as Parameters<typeof municipiosDeTerritorio>[0]);
      if (lista.length === 0) continue;
      const origen = (t.municipiosPorEstado as unknown[] | undefined)?.length ? "por_estado" : "desde_lista_plana";
      documentos.push({ col, docId: d.id, origen, lista, huella: huellaTerritorio(t) });
      lista.forEach((m, indice) => {
        const estadoCve = resolverEstadoCve(m.estado) ?? undefined;
        const resultado = estadoCve
          ? desambiguarReferencia(m.nombre, { estadoCve, municipios: catalogo, tipos: ["municipio"] })
          : null;
        casos.push({ id: "", col, docId: d.id, indice, propuesta: proponerRelleno(m, resultado) });
      });
    }
  }
  casos.forEach((c, i) => (c.id = `C${String(i + 1).padStart(2, "0")}`));

  // ---------- Reporte (dry-run siempre se muestra) ----------
  console.log(`\nDocumentos con municipios: ${documentos.length} | casos (entradas): ${casos.length}\n`);
  for (const doc of documentos) {
    console.log(
      `${doc.col}/${doc.docId}  [${doc.origen === "por_estado" ? "ya tiene municipiosPorEstado: se completan las claves" : "SOLO lista plana legada: se CREA municipiosPorEstado (municipiosSeleccionados no se toca)"}]`
    );
    for (const c of casos.filter((x) => x.col === doc.col && x.docId === doc.docId)) {
      const p = c.propuesta;
      let linea = `   ${c.id}  ${p.entrada.nombre.padEnd(26)} [${p.entrada.estado}]  ${etiquetaCoincidencia(p).padEnd(16)}`;
      if (p.clase === "unico") linea += ` → clave ${p.propuesta?.clave}` + (p.coincidencia === "exacta" ? "" : `   (oficial: ${p.candidatos?.[0]?.nombre})`);
      else if (p.clase === "ambiguo") linea += ` → NO se rellena solo. Opciones: ${p.candidatos?.map((x: CandidatoReferencia) => `${x.clave}`).join(" | ")}`;
      else if (p.clase === "sin_catalogo") linea += " → sin catálogo (fuera de México): se deja sin clave";
      else if (p.clase === "ya_tiene_clave") linea += ` → ya tiene clave ${p.entrada.clave}`;
      else linea += " → se deja sin clave";
      console.log(linea);
    }
  }
  const resumen: Record<string, number> = {};
  for (const c of casos) resumen[etiquetaCoincidencia(c.propuesta)] = (resumen[etiquetaCoincidencia(c.propuesta)] ?? 0) + 1;
  console.log("\nResumen:", JSON.stringify(resumen));

  if (!apply) {
    console.log("\nDRY-RUN: no se escribió nada. Para aplicar: --apply --aprobar=<ids|exactos> [--resolver=<caso>=<clave>]");
    await salir(0);
  }

  // ---------- Aplicación (solo casos aprobados) ----------
  if (aprobar.size === 0 && resolver.size === 0) {
    console.error("--apply requiere --aprobar=<ids|exactos> (y --resolver para ambiguos). No se escribió nada.");
    await salir(1);
  }
  const aprobados = new Set<string>();
  for (const c of casos) {
    const p = c.propuesta;
    if (aprobar.has(c.id)) aprobados.add(c.id);
    if (aprobar.has("exactos") && p.clase === "unico" && p.coincidencia === "exacta") aprobados.add(c.id);
    if (resolver.has(c.id)) aprobados.add(c.id);
  }

  const backupPath = arg("backup") ?? path.join(os.tmpdir(), `migracion-municipios-clave-${Date.now()}.json`);
  const backup: unknown[] = [];
  let escritos = 0;
  for (const doc of documentos) {
    const suyos = casos.filter((c) => c.col === doc.col && c.docId === doc.docId && aprobados.has(c.id));
    if (suyos.length === 0) continue;

    const nuevaLista = doc.lista.map((m) => ({ ...m }));
    let cambios = 0;
    for (const c of suyos) {
      const p = c.propuesta;
      if (p.clase === "unico" && p.propuesta) {
        nuevaLista[c.indice] = { ...nuevaLista[c.indice], clave: p.propuesta.clave };
        cambios++;
      } else if (p.clase === "ambiguo") {
        const elegida = resolver.get(c.id);
        const opcion = p.candidatos?.find((x) => x.clave === elegida);
        if (!opcion) {
          console.error(`${c.id}: ambiguo sin --resolver válido (${elegida ?? "falta"}); se deja intacto.`);
          continue;
        }
        nuevaLista[c.indice] = { nombre: opcion.nombre, estado: p.entrada.estado, clave: opcion.clave };
        cambios++;
      }
    }
    if (cambios === 0) continue;

    const ref = adminDb.collection(doc.col).doc(doc.docId);
    const actual = (await ref.get()).data()?.territorio as Record<string, unknown> | undefined;
    if (!actual || huellaTerritorio(actual) !== doc.huella) {
      console.error(`${doc.col}/${doc.docId}: el documento CAMBIÓ desde el dry-run; no se escribe.`);
      continue;
    }
    if (simular) {
      console.log(`SIMULADO ${doc.col}/${doc.docId}: update({"territorio.municipiosPorEstado": …}) con ${cambios} cambio(s):`);
      console.log(JSON.stringify(nuevaLista, null, 1).replace(/\n\s+/g, " "));
      escritos++;
      continue;
    }
    backup.push({
      col: doc.col,
      id: doc.docId,
      antes: { municipiosPorEstado: actual.municipiosPorEstado ?? null, municipiosSeleccionados: actual.municipiosSeleccionados ?? null },
    });
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    await ref.update({ "territorio.municipiosPorEstado": nuevaLista });
    escritos++;
    console.log(`ESCRITO ${doc.col}/${doc.docId}: ${cambios} entrada(s) con clave.`);
  }
  console.log(
    simular
      ? `\nSIMULACIÓN: ${escritos} documento(s) se escribirían; NO se escribió nada.`
      : `\nDocumentos escritos: ${escritos}. Respaldo previo: ${backupPath}`
  );
  await salir(0);
}

main().catch(async (e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  await salir(1);
});
