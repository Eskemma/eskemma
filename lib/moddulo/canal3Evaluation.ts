// lib/moddulo/canal3Evaluation.ts
// Evaluación de compatibilidad de Canal 3 (fuente externa real) — única
// implementación usada tanto por /canal3/evaluar como por /canal3/vincular,
// para no calcular la misma evaluación dos veces con lógica separada.

import { checkTerritoryMatch, esTipoCompatible } from "@/lib/moddulo/linkCompatibility";
import { esTerritorioParcial } from "@/lib/moddulo/territorioPlural";
import type { ModduloProject } from "@/types/moddulo.types";
import type { Territorio, EvaluacionCompatibilidad } from "@/types/shared.types";
import type { MetadatosFuenteExterna } from "@/types/f3.types";

type ProjectForEvaluation = Pick<ModduloProject, "type" | "territorio" | "xpcto">;

export function evaluarCompatibilidad(
  project: ProjectForEvaluation,
  metadatos: MetadatosFuenteExterna
): EvaluacionCompatibilidad {
  const tipoCumple = esTipoCompatible(metadatos.tipoProyectoDeclarado, project.type);

  const territoryMatch = checkTerritoryMatch(metadatos.territorioDeclarado, project.territorio);
  const territorioRequiereConfirmacion = territoryMatch !== "exact";

  const pertinencia = {
    cumple: tipoCumple,
    detalle: tipoCumple
      ? `Tipo de proyecto compatible ("${project.type}").`
      : `La herramienta declara ser para proyectos de tipo "${metadatos.tipoProyectoDeclarado}" pero este proyecto es de tipo "${project.type}". No son compatibles.`,
    ...(territorioRequiereConfirmacion
      ? {
          territorioRequiereConfirmacion: true as const,
          territorioDetalle: describirTerritoryMismatch(territoryMatch, metadatos.territorioDeclarado, project.territorio),
        }
      : {}),
  };

  const fechaLimite = project.xpcto?.tiempo?.fechaLimite;
  const vigenciaCumple = !fechaLimite || metadatos.fechaObtencion <= fechaLimite;
  const vigencia = {
    cumple: vigenciaCumple,
    detalle: !fechaLimite
      ? "El proyecto no tiene fechaLimite definida — no se pudo evaluar vigencia."
      : vigenciaCumple
        ? `Dato obtenido (${metadatos.fechaObtencion}) dentro del horizonte del proyecto (hito: ${fechaLimite}).`
        : `El dato se obtuvo (${metadatos.fechaObtencion}) después de que el hito del proyecto ya venció (${fechaLimite}).`,
  };

  const compatibilidadMetodologica = {
    cumple: true,
    detalle: `Declarado por el usuario (${metadatos.metodoDeclarado}), no verificado automáticamente.`,
  };

  return { pertinencia, vigencia, compatibilidadMetodologica };
}

function describirTerritoryMismatch(
  match: "approximate" | "mismatch",
  declarado: Territorio,
  proyecto: Territorio | undefined
): string {
  const base = match === "approximate"
    ? "Los territorios parecen coincidir pero no se pudo verificar con un identificador confiable. Revisa que sea el mismo territorio antes de vincular."
    : `La herramienta declara cubrir "${declarado.nombre}" pero el proyecto cubre "${proyecto?.nombre ?? "territorio no especificado"}".`;

  if (esTerritorioParcial(proyecto)) {
    return `${base} Además, este proyecto tiene más de una unidad territorial seleccionada — esta comparación solo consideró la primera; verifica manualmente que la fuente cubra también a las demás.`;
  }
  return base;
}
