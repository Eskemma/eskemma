import { describe, expect, it } from "vitest";
import { decidirEnter, filtrarOpciones, LIMITE_OPCIONES_VISIBLES, plegarBusqueda } from "./multiSelectFiltro";

const OPC = [
  { value: "a", label: "Tonalá" },
  { value: "b", label: "Tlaquepaque" },
  { value: "c", label: "Tlajomulco de Zúñiga" },
  { value: "d", label: "México" },
];

describe("filtrarOpciones", () => {
  it("ignora acentos y mayúsculas: «tonala» → Tonalá, «mexico» → México, «zuniga» → Zúñiga", () => {
    expect(filtrarOpciones(OPC, [], "tonala").visibles.map((o) => o.value)).toEqual(["a"]);
    expect(filtrarOpciones(OPC, [], "MEXICO").visibles.map((o) => o.value)).toEqual(["d"]);
    expect(filtrarOpciones(OPC, [], "zuniga").visibles.map((o) => o.value)).toEqual(["c"]);
    expect(plegarBusqueda("Ñandú")).toBe("nandu");
  });
  it("excluye las ya seleccionadas y sin búsqueda devuelve todas las restantes", () => {
    expect(filtrarOpciones(OPC, ["a"], "").visibles.map((o) => o.value)).toEqual(["b", "c", "d"]);
  });
  it("catálogo de 570 (Oaxaca): dibuja solo el tope y reporta el total", () => {
    const muchas = Array.from({ length: 570 }, (_, i) => ({ value: `k${i}`, label: `Municipio ${i}` }));
    const r = filtrarOpciones(muchas, [], "");
    expect(r.visibles).toHaveLength(LIMITE_OPCIONES_VISIBLES);
    expect(r.total).toBe(570);
    expect(filtrarOpciones(muchas, [], "Municipio 56").total).toBe(11); // 56, 560–569
  });
});

describe("decidirEnter", () => {
  const coincidencias = [OPC[1], OPC[2]];
  it("búsqueda VACÍA: no agrega nada (antes agregaba la primera opción), pero evita enviar el formulario", () => {
    expect(decidirEnter({ abierto: true, busqueda: "", coincidencias: OPC, componiendo: false })).toEqual({ evitarEnvio: true, agregar: null });
    expect(decidirEnter({ abierto: true, busqueda: "   ", coincidencias: OPC, componiendo: false }).agregar).toBeNull();
  });
  it("desplegable CERRADO: no agrega aunque haya texto", () => {
    expect(decidirEnter({ abierto: false, busqueda: "tl", coincidencias, componiendo: false }).agregar).toBeNull();
  });
  it("SIN coincidencias: no agrega y evita el envío", () => {
    expect(decidirEnter({ abierto: true, busqueda: "zzz", coincidencias: [], componiendo: false })).toEqual({ evitarEnvio: true, agregar: null });
  });
  it("CON coincidencia: agrega la primera", () => {
    expect(decidirEnter({ abierto: true, busqueda: "tl", coincidencias, componiendo: false })).toEqual({ evitarEnvio: true, agregar: "b" });
  });
  it("durante composición IME no selecciona ni intercepta el Enter", () => {
    expect(decidirEnter({ abierto: true, busqueda: "tl", coincidencias, componiendo: true })).toEqual({ evitarEnvio: false, agregar: null });
  });
});
