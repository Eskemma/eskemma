/**
 * scripts/verify-fontana-municipios-familia-fix.ts
 * Verificación en vivo del fix del bug "indicador_no_en_sesion" —
 * confirma que familiaDeIndicador() deriva la familia real del
 * indicadorId (F2-13/F2-11 -> F2), la validación pasa contra el set
 * correcto de la sesión, y el desglose municipal real se resuelve.
 * Regresión: F1-3 sigue funcionando igual que antes.
 *
 * Usage: npx tsx scripts/verify-fontana-municipios-familia-fix.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");
  const { resolverMunicipiosDeDistrito } = await import("../lib/fontana/ingesta/eceg");
  const { familiaDeIndicador } = await import("../types/fontana.types");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const sesionId = "yzjwy19fWW42Wv9l007h";
  const snap = await adminDb.collection("fontana_sesiones").doc(sesionId).get();
  const sesion = snap.data()!;
  const territorio = sesion.territorio;

  // Simula exactamente la validación de cargarSesionValidada (post-fix).
  function validar(indicadorId: string) {
    const familiaId = familiaDeIndicador(indicadorId);
    if (familiaId !== "F1" && familiaId !== "F2") return { ok: false, motivo: "familia_no_disponible" };
    const familia = sesion.indicadoresPorFamilia[familiaId];
    const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
    if (!idsEnSesion.has(indicadorId)) return { ok: false, motivo: "indicador_no_en_sesion" };
    return { ok: true };
  }

  for (const id of ["F2-13", "F2-11", "F1-3"]) {
    const v = validar(id);
    console.log(`\n${id}: validación =`, v);
    if (!v.ok) continue;
    const municipios = await resolverMunicipiosDeDistrito(id, "14", "005", "federal");
    console.log(`  municipios resueltos: ${municipios?.length ?? "null (sin mecanismo)"}`);
    if (municipios) {
      for (const m of municipios.slice(0, 3)) {
        const c = m.celda;
        console.log(`   - ${m.municipioCve}: ${esValorDisponible(c) ? `${c.valor}${c.unidad ? " " + c.unidad : ""}` : `SIN DATO (${c.motivo})`}`);
      }
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
