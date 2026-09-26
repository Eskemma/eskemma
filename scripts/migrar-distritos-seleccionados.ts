/**
 * scripts/migrar-distritos-seleccionados.ts
 * Paso 4b (26-09-26): backfill de `territorio.distritosSeleccionados` y `territorio.cve_distrito` en los
 * documentos LEGADOS de nivel distrito (moddulo_projects, pestel_projects, fontana_sesiones) que se
 * crearon con el formulario de texto libre, antes del selector estructurado: guardan solo la frase
 * «Distrito Electoral Federal V, con cabecera en Puerto Vallarta, …» y los lectores compensan parseándola.
 *
 * Resolución con el catálogo vigente de cabeceras (lib/geo/candidatosGeo.ts): número del texto +
 * estado → código de 4 dígitos; se confirma contra la cabecera del texto (`nombresCabeceraCompatibles`)
 * o, si el texto no la trae, contra el proyecto Moddulo vinculado. Sin evidencia adicional al número, el
 * caso se marca `solo_numero` y NO se aprueba con la palabra `confirmados`.
 *
 * DRY-RUN POR DEFECTO (mismo patrón que migrar-municipios-clave.ts):
 *   npx tsx scripts/migrar-distritos-seleccionados.ts
 *   npx tsx scripts/migrar-distritos-seleccionados.ts --apply --aprobar=D01,D02   (o `confirmados`)
 *   --simular  con --apply: imprime el payload exacto sin escribir (ni respaldo)
 *   --backup=  archivo del estado anterior (defecto: tmp)
 *
 * Solo escribe `territorio.cve_distrito` (si falta) y `territorio.distritosSeleccionados`. NO toca
 * `nombre`, `municipio` (la frase legada), `estado` ni nada del documento. Relee cada documento antes de
 * escribir y aborta ese documento si cambió desde el dry-run. Idempotente (un documento que ya tiene
 * `distritosSeleccionados` no es candidato).
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { resolverEstadoCve } from "../lib/geo/estados";
import { cabeceraDeDistrito } from "../lib/geo/candidatosGeo";
import { nombresCabeceraCompatibles } from "../lib/geo/cabeceraNombres";
import { normalizeGeoName } from "../lib/geo/municipioCanonico";
import { extraerNumeroDistrito } from "../lib/moddulo/distritoElectoral";
import { compararTerritorios } from "../lib/moddulo/linkCompatibility";
import type { DistritoSeleccionado, Territorio } from "../types/shared.types";

const COLECCIONES = ["moddulo_projects", "pestel_projects", "fontana_sesiones"] as const;
type Evidencia = "confirmado_por_cabecera" | "confirmado_por_vinculo" | "solo_numero" | "sin_resolver";

interface Caso {
  id: string;
  col: string;
  docId: string;
  territorio: Territorio;
  modduloProjectId?: string;
  evidencia: Evidencia;
  detalle: string;
  cveDistrito?: string; // 3 dígitos
  seleccion?: DistritoSeleccionado;
  huella: string;
}

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const tieneFlag = (n: string) => process.argv.includes(`--${n}`);
const huella = (t: Record<string, unknown>) =>
  JSON.stringify({ n: t.nivel, s: t.distritosSeleccionados ?? null, c: t.cve_distrito ?? null, e: t.estado ?? null, nom: t.nombre ?? null, m: t.municipio ?? null });
const salir = (code: number) => new Promise<never>(() => process.stdout.write("", () => process.exit(code)));

/** Cabecera de la frase legada «… con cabecera en X, …», o null. */
function cabeceraDelTexto(texto: string | undefined): string | null {
  const m = texto ? normalizeGeoName(texto).match(/CON CABECERA EN ([^,]+)/) : null;
  return m ? m[1].trim() : null;
}

async function main() {
  const apply = tieneFlag("apply");
  const simular = tieneFlag("simular");
  const aprobar = new Set((arg("aprobar") ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  const { adminDb } = await import("../lib/firebase-admin");

  // Territorios de los proyectos Moddulo (para confirmar por vínculo).
  const proyectos = new Map<string, Territorio>();
  for (const d of (await adminDb.collection("moddulo_projects").get()).docs) {
    const t = d.data().territorio as Territorio | undefined;
    if (t) proyectos.set(d.id, t);
  }

  const casos: Caso[] = [];
  for (const col of COLECCIONES) {
    for (const d of [...(await adminDb.collection(col).get()).docs].sort((a, b) => a.id.localeCompare(b.id))) {
      const data = d.data();
      const t = data.territorio as Territorio | undefined;
      if (!t || !["distrito_federal", "distrito_local", "distrito"].includes(t.nivel)) continue;
      if (t.distritosSeleccionados && t.distritosSeleccionados.length > 0) continue; // ya estructurado
      const tipo = t.nivel === "distrito_local" ? "distrito_local" : "distrito_federal";
      const estadoCve = resolverEstadoCve(t.estado);
      const numero = extraerNumeroDistrito(t.municipio ?? t.nombre, t.cve_distrito ?? null);
      const base = { col, docId: d.id, territorio: t, modduloProjectId: data.modduloProjectId as string | undefined, huella: huella(t as unknown as Record<string, unknown>) };
      if (!estadoCve || !numero) {
        casos.push({ ...base, id: "", evidencia: "sin_resolver", detalle: `sin estado (${t.estado ?? "-"}) o sin número de distrito en el texto` });
        continue;
      }
      const codigo = `${estadoCve}${String(parseInt(numero, 10)).padStart(2, "0")}`;
      const cabecera = cabeceraDeDistrito(tipo, codigo);
      if (!cabecera) {
        casos.push({ ...base, id: "", evidencia: "sin_resolver", detalle: `el catálogo vigente no tiene ${tipo} ${codigo}` });
        continue;
      }
      const seleccion: DistritoSeleccionado = { cve: numero, nombre: cabecera, estado: t.estado };
      const cabTexto = cabeceraDelTexto(t.municipio ?? t.nombre);
      const proyecto = base.modduloProjectId ? proyectos.get(base.modduloProjectId) : undefined;
      const proyectoCve = proyecto?.distritosSeleccionados?.[0]?.cve ?? proyecto?.cve_distrito;
      let evidencia: Evidencia = "solo_numero";
      let detalle = `número ${numero} + estado ${t.estado} → ${codigo} = ${cabecera}`;
      if (cabTexto && nombresCabeceraCompatibles(cabecera, cabTexto)) {
        evidencia = "confirmado_por_cabecera";
        detalle += `; el texto dice «con cabecera en ${cabTexto}» (compatible)`;
      } else if (cabTexto) {
        detalle += `; ¡el texto dice «${cabTexto}», que NO coincide con la cabecera del catálogo!`;
      } else if (proyectoCve && proyectoCve.padStart(3, "0") === numero && proyecto?.estado === t.estado) {
        evidencia = "confirmado_por_vinculo";
        detalle += `; el proyecto Moddulo vinculado (${base.modduloProjectId}) trae el mismo distrito ${proyectoCve}`;
      }
      casos.push({ ...base, id: "", evidencia, detalle, cveDistrito: numero, seleccion });
    }
  }
  casos.forEach((c, i) => (c.id = `D${String(i + 1).padStart(2, "0")}`));

  // ---------- Reporte ----------
  console.log(`\nDocumentos de nivel distrito SIN distritosSeleccionados: ${casos.length}\n`);
  for (const c of casos) {
    console.log(`${c.id}  ${c.col}/${c.docId}  [${c.territorio.nivel}]  ${c.evidencia}`);
    console.log(`      nombre: «${c.territorio.nombre}»`);
    console.log(`      ${c.detalle}`);
    if (c.seleccion) {
      console.log(`      ESCRIBIRÍA: territorio.cve_distrito ${c.territorio.cve_distrito ? `(ya es "${c.territorio.cve_distrito}", no cambia)` : `= "${c.cveDistrito}"`}; territorio.distritosSeleccionados = ${JSON.stringify([c.seleccion])}`);
    } else console.log("      → se deja intacto");
  }

  // Efecto en la compuerta de vinculación (sesión Fontana ↔ proyecto Moddulo vinculado).
  console.log("\nEfecto sobre checkTerritoryMatch en los pares vinculados (antes → después de aplicar TODOS los casos resolubles):");
  const nuevoDe = (col: string, id: string, t: Territorio): Territorio => {
    const c = casos.find((x) => x.col === col && x.docId === id && x.seleccion);
    return c ? { ...t, cve_distrito: t.cve_distrito ?? c.cveDistrito, distritosSeleccionados: [c.seleccion!] } : t;
  };
  for (const c of casos.filter((x) => x.modduloProjectId && proyectos.has(x.modduloProjectId!))) {
    const tp = proyectos.get(c.modduloProjectId!)!;
    const antes = compararTerritorios(c.territorio, tp);
    const despues = compararTerritorios(nuevoDe(c.col, c.docId, c.territorio), nuevoDe("moddulo_projects", c.modduloProjectId!, tp));
    console.log(`   ${c.col}/${c.docId} ↔ moddulo_projects/${c.modduloProjectId}: ${antes.match}/${antes.relacion} → ${despues.match}/${despues.relacion}`);
  }
  const resumen: Record<string, number> = {};
  for (const c of casos) resumen[c.evidencia] = (resumen[c.evidencia] ?? 0) + 1;
  console.log("\nResumen:", JSON.stringify(resumen));

  if (!apply) {
    console.log("\nDRY-RUN: no se escribió nada. Para aplicar: --apply --aprobar=<ids|confirmados> [--simular]");
    await salir(0);
  }
  if (aprobar.size === 0) {
    console.error("--apply requiere --aprobar=<ids|confirmados>. No se escribió nada.");
    await salir(1);
  }

  // ---------- Aplicación ----------
  const backupPath = arg("backup") ?? path.join(os.tmpdir(), `migracion-distritos-seleccionados-${Date.now()}.json`);
  const backup: unknown[] = [];
  let escritos = 0;
  for (const c of casos) {
    const aprobado = aprobar.has(c.id) || (aprobar.has("confirmados") && c.evidencia.startsWith("confirmado"));
    if (!aprobado || !c.seleccion) continue;
    const ref = adminDb.collection(c.col).doc(c.docId);
    const actual = (await ref.get()).data()?.territorio as Record<string, unknown> | undefined;
    if (!actual || huella(actual) !== c.huella) {
      console.error(`${c.col}/${c.docId}: el documento CAMBIÓ desde el dry-run; no se escribe.`);
      continue;
    }
    const payload: Record<string, unknown> = { "territorio.distritosSeleccionados": [c.seleccion] };
    if (!actual.cve_distrito) payload["territorio.cve_distrito"] = c.cveDistrito;
    if (simular) {
      console.log(`SIMULADO ${c.col}/${c.docId}: update(${JSON.stringify(payload)})`);
      escritos++;
      continue;
    }
    backup.push({ col: c.col, id: c.docId, antes: { cve_distrito: actual.cve_distrito ?? null, distritosSeleccionados: actual.distritosSeleccionados ?? null } });
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    await ref.update(payload);
    escritos++;
    console.log(`ESCRITO ${c.col}/${c.docId}`);
  }
  console.log(simular ? `\nSIMULACIÓN: ${escritos} documento(s) se escribirían; NO se escribió nada.` : `\nDocumentos escritos: ${escritos}. Respaldo previo: ${backupPath}`);
  await salir(0);
}

main().catch(async (e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  await salir(1);
});
