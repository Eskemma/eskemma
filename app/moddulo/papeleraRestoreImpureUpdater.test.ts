// app/moddulo/papeleraRestoreImpureUpdater.test.ts
// Regresión documental del bug real de la fase (b) de la papelera de Moddulo
// (26-09-28): handleRestored (app/moddulo/page.tsx) llamaba setProjects() DESDE
// DENTRO del updater de setPapeleraProjects — un updater de setState debe ser
// puro. En desarrollo, React Strict Mode invoca cada updater DOS VECES a
// propósito para detectar justo este tipo de impureza (no confía en que solo
// se llame una vez); la llamada anidada a setProjects se disparaba en ambas
// invocaciones, duplicando el proyecto restaurado en "Mis proyectos" (warning
// real de React: "Encountered two children with the same key").
//
// Este repo no tiene entorno de pruebas de DOM/React (vitest.config.ts usa
// environment:"node", sin @testing-library/react — ver CLAUDE.md, "sin prueba
// de DOM: el cableado va en la guía de navegador"), así que este test no
// renderiza el componente. En su lugar reproduce el patrón EXACTO del bug (un
// updater que llama a otro setState) contra un simulador mínimo del
// doble-invocado de Strict Mode, y el patrón corregido (2 updaters
// independientes, ninguno llama al otro) — probando la CLASE de bug, no solo
// el caso puntual, para que no se repita en otro handler de este componente.

import { describe, expect, it } from "vitest";

type Setter<T> = (updater: (prev: T) => T) => void;

/**
 * Simula cómo React Strict Mode invoca un updater de setState: lo llama DOS
 * VECES (para detectar impurezas) pero solo el resultado de la ÚLTIMA
 * invocación se "confirma" como el nuevo estado — exactamente el
 * comportamiento real de React 18/19 en desarrollo.
 */
function makeStrictModeSetter<T>(getState: () => T, setState: (v: T) => void): Setter<T> {
  return (updater) => {
    updater(getState()); // 1ª invocación (descartada, solo para detectar efectos)
    setState(updater(getState())); // 2ª invocación (la que React realmente confirma)
  };
}

interface ProyectoFake {
  id: string;
}

describe("papelera — handleRestored no debe llamar a otro setState desde dentro de un updater", () => {
  it("patrón VIEJO (bug real): un updater impuro duplica el proyecto restaurado bajo Strict Mode", () => {
    let projects: ProyectoFake[] = [];
    let papelera: ProyectoFake[] = [{ id: "p1" }];

    const setProjects = makeStrictModeSetter(() => projects, (v) => (projects = v));
    const setPapelera = makeStrictModeSetter(() => papelera, (v) => (papelera = v));

    // Reproduce EXACTAMENTE el patrón buggy: setProjects llamado DENTRO del
    // updater de setPapelera.
    function handleRestoredViejo(id: string) {
      setPapelera((prev) => {
        const found = prev.find((p) => p.id === id);
        if (found) {
          setProjects((p) => [found, ...p]); // ← efecto secundario dentro de un updater
        }
        return prev.filter((p) => p.id !== id);
      });
    }

    handleRestoredViejo("p1");

    // El bug real: el proyecto aparece DOS veces en "Mis proyectos".
    expect(projects.filter((p) => p.id === "p1")).toHaveLength(2);
  });

  it("patrón NUEVO (fix): 2 updaters independientes y puros, sin duplicado bajo Strict Mode", () => {
    let projects: ProyectoFake[] = [];
    let papelera: ProyectoFake[] = [{ id: "p1" }];

    const setProjects = makeStrictModeSetter(() => projects, (v) => (projects = v));
    const setPapelera = makeStrictModeSetter(() => papelera, (v) => (papelera = v));

    // Reproduce el fix: `found` se lee del closure (estado ya renderizado),
    // nunca dentro de un updater; los 2 setState son independientes.
    function handleRestoredNuevo(id: string) {
      const found = papelera.find((p) => p.id === id);
      setPapelera((prev) => prev.filter((p) => p.id !== id));
      if (found) {
        setProjects((prev) => [found, ...prev]);
      }
    }

    handleRestoredNuevo("p1");

    expect(projects.filter((p) => p.id === "p1")).toHaveLength(1);
    expect(papelera.find((p) => p.id === "p1")).toBeUndefined();
  });

  it("handleMovedToPapelera (dirección inversa) ya era puro — sin el mismo riesgo (punto 3)", () => {
    let projects: ProyectoFake[] = [{ id: "p1" }];
    let papelera: ProyectoFake[] = [];

    const setProjects = makeStrictModeSetter(() => projects, (v) => (projects = v));
    const setPapelera = makeStrictModeSetter(() => papelera, (v) => (papelera = v));

    // Mismo patrón que el código real: `project` viene de un argumento, no de
    // leer `prev` de la otra lista dentro de un updater — ningún setState
    // llama al otro.
    function handleMovedToPapelera(project: ProyectoFake) {
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setPapelera((prev) => [project, ...prev]);
    }

    handleMovedToPapelera({ id: "p1" });

    expect(projects.find((p) => p.id === "p1")).toBeUndefined();
    expect(papelera.filter((p) => p.id === "p1")).toHaveLength(1);
  });
});
