"use client";

import { useState, useEffect } from "react";
import { getPreset } from "@/lib/centinela/pestel/presets";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import type {
  TipoProyecto,
  PestlDimensionConfig,
  PestlVariable,
  DimensionCode,
} from "@/types/pestel.types";
import { DIMENSION_META, DIMENSION_ORDER } from "@/types/pestel.types";

interface Props {
  tipo: TipoProyecto;
  initialDimensions: PestlDimensionConfig[];
  saving: boolean;
  onBack: () => void;
  onFinish: (dimensions: PestlDimensionConfig[]) => void;
}

export default function WizardStep3Variables({
  tipo,
  initialDimensions,
  saving,
  onBack,
  onFinish,
}: Props) {
  const [dimensions, setDimensions] = useState<PestlDimensionConfig[]>(() =>
    initialDimensions.length > 0 ? initialDimensions : getPreset(tipo)
  );
  const [openDimension, setOpenDimension] = useState<DimensionCode>("P");
  const [newVarInputs, setNewVarInputs] = useState<Record<DimensionCode, string>>({
    P: "", E: "", S: "", T: "", L: "", Ec: "",
  });

  // Reset preset when tipo changes
  useEffect(() => {
    if (initialDimensions.length === 0) {
      setDimensions(getPreset(tipo));
    }
  }, [tipo, initialDimensions.length]);

  const totalVars = dimensions.reduce((sum, d) => sum + d.variables.length, 0);

  function updateVariable(
    code: DimensionCode,
    varId: string,
    updates: Partial<PestlVariable>
  ) {
    setDimensions((dims) =>
      dims.map((d) =>
        d.code !== code
          ? d
          : {
              ...d,
              variables: d.variables.map((v) =>
                v.id !== varId ? v : { ...v, ...updates }
              ),
            }
      )
    );
  }

  function removeVariable(code: DimensionCode, varId: string) {
    setDimensions((dims) =>
      dims.map((d) =>
        d.code !== code
          ? d
          : { ...d, variables: d.variables.filter((v) => v.id !== varId) }
      )
    );
  }

  function addVariable(code: DimensionCode) {
    const name = newVarInputs[code].trim();
    if (!name) return;
    if (totalVars >= 30) return;

    const newVar: PestlVariable = {
      id: `${code.toLowerCase()}-custom-${Date.now()}`,
      name,
      weight: 3,
      isPriority: false,
      isDefault: false,
      indicators: [],
    };

    setDimensions((dims) =>
      dims.map((d) =>
        d.code !== code ? d : { ...d, variables: [...d.variables, newVar] }
      )
    );
    setNewVarInputs((prev) => ({ ...prev, [code]: "" }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
          Variables PESTEL
        </h2>
        <p className="text-sm text-gray-eske-70 dark:text-[#9AAEBE]">
          Cargamos las variables por defecto para un proyecto{" "}
          <span className="font-medium capitalize">{tipo}</span>. Personaliza
          según el contexto específico de tu proyecto.
        </p>
      </div>

      {/* Total counter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-eske-70 dark:text-[#9AAEBE]">Total de variables:</span>
        <span
          className={[
            "text-sm font-semibold",
            totalVars >= 30 ? "text-red-eske" : "text-bluegreen-eske",
          ].join(" ")}
        >
          {totalVars} / 30
        </span>
        {totalVars >= 30 && (
          <span className="text-xs text-red-eske dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
            Límite alcanzado
          </span>
        )}
      </div>

      {/* Dimensions accordion */}
      <div className="flex flex-col gap-2">
        {[...dimensions]
          .sort((a, b) => DIMENSION_ORDER.indexOf(a.code) - DIMENSION_ORDER.indexOf(b.code))
          .map((dim) => {
          const isOpen = openDimension === dim.code;
          const hasWarning = dim.variables.length < 3;

          return (
            <div
              key={dim.code}
              className="border border-gray-eske-20 dark:border-white/10 rounded-xl overflow-hidden"
            >
              {/* Accordion header — wrapper div prevents nested <button> */}
              <div className="flex items-center justify-between px-4 py-3
                bg-white-eske dark:bg-[#18324A] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDimension(isOpen ? ("" as DimensionCode) : dim.code)
                  }
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="w-7 h-7 rounded-full bg-bluegreen-eske/10
                    text-bluegreen-eske text-xs font-bold flex items-center
                    justify-center shrink-0">
                    {dim.code}
                  </span>
                  <span className="font-medium text-black-eske dark:text-[#EAF2F8] text-sm">
                    {DIMENSION_META[dim.code].label}
                  </span>
                  <span className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
                    {dim.variables.length} variable{dim.variables.length !== 1 ? "s" : ""}
                  </span>
                  {hasWarning && (
                    <span className="text-xs text-yellow-eske bg-yellow-eske/10
                      px-2 py-0.5 rounded" aria-label="Cobertura limitada">
                      ⚠ Cobertura limitada
                    </span>
                  )}
                </button>
                {/* InfoTooltip and chevron sit outside the button to avoid nesting */}
                <div className="flex items-center gap-2 shrink-0 pl-2">
                  <InfoTooltip
                    content="Agrupa los factores que el análisis PESTEL monitoreará para esta dimensión. Se recomienda mínimo 3 variables para un análisis robusto."
                  />
                  <span
                    className="text-gray-eske-60 transition-transform"
                    aria-hidden="true"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    ▾
                  </span>
                </div>
              </div>

              {/* Accordion body */}
              {isOpen && (
                <div className="px-4 pb-4 pt-2 bg-white-eske dark:bg-[#18324A] border-t border-gray-eske-10 dark:border-white/10">
                  {hasWarning && (
                    <p className="text-xs text-yellow-eske-70 bg-yellow-eske/5
                      border border-yellow-eske/20 px-3 py-2 rounded-lg mb-3">
                      Esta dimensión tiene cobertura limitada. Considera agregar
                      más variables para un análisis robusto.
                    </p>
                  )}

                  <div className="flex flex-col gap-2 mb-4">
                    {dim.variables.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-2 p-3 rounded-lg
                          bg-gray-eske-10 dark:bg-[#21425E] group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-black-eske dark:text-[#EAF2F8] wrap-break-words">
                            {v.name}
                            {!v.isDefault && (
                              <span className="ml-2 text-xs text-blue-eske bg-blue-eske/10
                                px-1.5 py-0.5 rounded">
                                Personalizada
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Weight selector */}
                        <div className="flex items-center gap-1 shrink-0">
                          <label
                            htmlFor={`weight-${v.id}`}
                            className="text-xs text-gray-eske-60 sr-only"
                          >
                            Peso
                          </label>
                          <InfoTooltip
                            content="Qué tan determinante es esta variable para el proyecto. Peso 5 = crítico para la estrategia; Peso 1 = referencial."
                            example="Seguridad pública → Peso 5 en campaña con alta incidencia delictiva"
                            placement="left"
                          />
                          <select
                            id={`weight-${v.id}`}
                            value={v.weight}
                            onChange={(e) =>
                              updateVariable(dim.code, v.id, {
                                weight: Number(e.target.value) as PestlVariable["weight"],
                              })
                            }
                            className="text-xs border border-gray-eske-20 dark:border-white/10 rounded px-1.5 py-1
                              bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
                              focus:outline-none focus-visible:ring-1
                              focus-visible:ring-bluegreen-eske"
                            aria-label={`Peso de ${v.name}`}
                          >
                            {[1, 2, 3, 4, 5].map((w) => (
                              <option key={w} value={w}>
                                Peso {w}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Priority toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            updateVariable(dim.code, v.id, {
                              isPriority: !v.isPriority,
                            })
                          }
                          className={[
                            "text-xs px-2 py-1 rounded transition-colors shrink-0",
                            v.isPriority
                              ? "bg-orange-eske/10 text-orange-eske"
                              : "bg-gray-eske-20 dark:bg-[#112230] text-gray-eske-60 dark:text-[#9AAEBE] hover:bg-gray-eske-30 dark:hover:bg-white/5",
                          ].join(" ")}
                          aria-label={v.isPriority ? "Quitar prioridad" : "Marcar como prioritaria"}
                          title={v.isPriority ? "Prioritaria" : "Sin prioridad"}
                        >
                          {v.isPriority ? "⭐ Prioritaria" : "Prioridad"}
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeVariable(dim.code, v.id)}
                          className="text-gray-eske-40 hover:text-red-eske transition-colors
                            opacity-0 group-hover:opacity-100 shrink-0"
                          aria-label={`Quitar ${v.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add variable */}
                  {totalVars < 30 && (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={newVarInputs[dim.code]}
                        onChange={(e) =>
                          setNewVarInputs((prev) => ({
                            ...prev,
                            [dim.code]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addVariable(dim.code);
                          }
                        }}
                        placeholder="Nombre de la nueva variable"
                        className="flex-1 px-3 py-1.5 border border-gray-eske-30 dark:border-white/10 rounded-lg
                          text-xs focus:outline-none focus-visible:ring-2
                          focus-visible:ring-bluegreen-eske placeholder:text-gray-eske-50 dark:placeholder-[#6D8294]
                          bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
                        aria-label={`Agregar variable a ${DIMENSION_META[dim.code].label}`}
                      />
                      <InfoTooltip
                        content="Variables personalizadas no incluidas en el preset base. Úsalas para factores locales o específicos de tu proyecto."
                        example="Conflicto por agua en Cuautla"
                        placement="left"
                      />
                      <button
                        type="button"
                        onClick={() => addVariable(dim.code)}
                        disabled={!newVarInputs[dim.code].trim()}
                        className="px-3 py-1.5 bg-bluegreen-eske/10 text-bluegreen-eske
                          rounded-lg text-xs font-medium hover:bg-bluegreen-eske/20
                          disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        + Agregar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="px-5 py-2.5 border border-gray-eske-30 dark:border-white/10 text-gray-eske-80 dark:text-[#C7D6E0]
            rounded-lg text-sm font-medium hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors
            disabled:opacity-50"
        >
          ← Atrás
        </button>
        <button
          type="button"
          onClick={() => onFinish(dimensions)}
          disabled={saving}
          className="px-6 py-2.5 bg-bluegreen-eske text-white rounded-lg text-sm
            font-medium transition-colors hover:bg-bluegreen-eske-60
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando…" : "Crear proyecto →"}
        </button>
      </div>
    </div>
  );
}
