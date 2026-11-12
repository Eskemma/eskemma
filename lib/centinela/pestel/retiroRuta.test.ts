import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { MENSAJE_RETIRO_EXPORT_TO_MODDULO, camposContador, crearLimitador, cuerpoRetiro, RETIRO_COLECCION, RETIRO_EXPORT_TO_MODDULO } from "./retiroRuta";

const RAIZ = path.resolve(__dirname, "../../..");
const leer = (p: string) => fs.readFileSync(path.join(RAIZ, p), "utf8");

describe("retiroRuta", () => {
  it("nombres del documento del contador", () => {
    expect(`${RETIRO_COLECCION}/${RETIRO_EXPORT_TO_MODDULO}`).toBe("retiros_rutas/export-to-moddulo");
  });
  it("el cuerpo del 410 lleva código estable y el mensaje", () => {
    expect(cuerpoRetiro("x")).toEqual({ error: "ruta_retirada", mensaje: "x" });
  });
  it("los nombres de botón del mensaje existen hoy en la pantalla (no se desfasan en silencio)", () => {
    const centinela = leer("app/components/centinela/pestel/ModduloButton.tsx");
    const f2 = leer("app/moddulo/proyecto/[projectId]/exploracion/page.tsx");
    for (const b of ["Iniciar proyecto en Moddulo", "Vincular a proyecto existente", "Regresar a Moddulo F2 con resultados"]) {
      expect(MENSAJE_RETIRO_EXPORT_TO_MODDULO).toContain(`«${b}»`);
      expect(centinela, b).toContain(b);
    }
    expect(MENSAJE_RETIRO_EXPORT_TO_MODDULO).toContain("«Vincular con análisis independiente»");
    expect(f2).toContain("Vincular con análisis independiente");
  });
  it("campos del contador: solo total, sinSesion y ultimaLlamada", () => {
    const c = camposContador({ total: 3, sinSesion: 1 }, { increment: (n) => ({ n }), ahora: "T" });
    expect(Object.keys(c).sort()).toEqual(["sinSesion", "total", "ultimaLlamada"]);
    expect(c).toEqual({ total: { n: 3 }, sinSesion: { n: 1 }, ultimaLlamada: "T" });
  });
  it("limitador: la primera llamada escribe; dentro de la ventana no; después lleva lo acumulado", () => {
    let t = 0;
    const l = crearLimitador(1000, () => t);
    expect(l.registrar(false)).toEqual({ total: 1, sinSesion: 0 });
    t = 400; expect(l.registrar(true)).toBeNull();
    t = 900; expect(l.registrar(true)).toBeNull();
    t = 1500; expect(l.registrar(false)).toEqual({ total: 3, sinSesion: 2 });
  });
  it("limitador: una escritura fallida devuelve sus cuentas para la siguiente", () => {
    let t = 0;
    const l = crearLimitador(1000, () => t);
    const w = l.registrar(true)!;
    l.devolver(w);
    t = 2000;
    expect(l.registrar(false)).toEqual({ total: 2, sinSesion: 1 });
  });
});
