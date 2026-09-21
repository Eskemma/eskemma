"use client";
// Multi-select con tags para partidos/coaliciones y secciones electorales.
// Patrón idéntico al de secciones en SemanalView.tsx (LNE).
import { useState, useRef, useEffect, useId } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
  color?: string; // hex para cuadradito de color
}

interface Props {
  id?: string;
  label: React.ReactNode;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  todosLabel?: string;
}

export default function PartidosMultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  disabled = false,
  placeholder = "Buscar...",
  todosLabel = "Todos",
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isTodos = selected.includes(todosLabel) || selected.length === 0;

  const filteredOptions = options.filter((o) => {
    if (selected.includes(o.value)) return false;
    return o.label.toLowerCase().includes(search.toLowerCase());
  });

  function add(value: string) {
    if (value === todosLabel) {
      onChange([todosLabel]);
    } else {
      const next = selected.filter((s) => s !== todosLabel).concat(value);
      onChange(next);
    }
    setSearch("");
    inputRef.current?.focus();
  }

  function remove(value: string) {
    const next = selected.filter((s) => s !== value);
    onChange(next.length === 0 ? [todosLabel] : next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && search === "" && !isTodos) {
      remove(selected[selected.length - 1]);
    }
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && filteredOptions.length > 0) {
      e.preventDefault();
      add(filteredOptions[0].value);
    }
  }

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedCount = isTodos ? null : selected.length;

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label
        htmlFor={inputId}
        className="text-xs font-medium text-black-eske-20 dark:text-[#9AAEBE]"
      >
        {label}
        {selectedCount !== null && (
          <span className="ml-1 text-blue-eske dark:text-[#4791B3]">({selectedCount} sel.)</span>
        )}
      </label>

      {/* Caja de tags + input */}
      <div
        className={[
          "flex flex-wrap items-center gap-1 min-h-[34px] px-2 py-1",
          "border rounded-md cursor-text",
          "bg-white-eske dark:bg-[#112230]",
          disabled
            ? "border-gray-eske-20 dark:border-white/5 opacity-50 pointer-events-none"
            : "border-gray-eske-30 dark:border-white/10",
          open ? "ring-2 ring-blue-eske" : "",
        ].join(" ")}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
        role="group"
        aria-labelledby={inputId}
      >
        {isTodos ? (
          <span className="text-sm text-black-eske-10 dark:text-[#6D8294] select-none">
            {todosLabel}
          </span>
        ) : (
          selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <span
                key={val}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-eske text-white-eske"
              >
                {opt?.color && (
                  <span
                    className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: opt.color }}
                    aria-hidden="true"
                  />
                )}
                {opt?.label ?? val}
                <button
                  type="button"
                  aria-label={`Quitar ${opt?.label ?? val}`}
                  onClick={(e) => { e.stopPropagation(); remove(val); }}
                  className="ml-0.5 hover:text-red-eske focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-eske rounded"
                >
                  ×
                </button>
              </span>
            );
          })
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={isTodos ? placeholder : ""}
          className="flex-1 min-w-[80px] text-sm bg-transparent outline-none text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-90 dark:placeholder:text-[#6D8294]"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
        />
      </div>

      {/* Popover */}
      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md shadow-lg
                     bg-white-eske dark:bg-[#18324A]
                     border border-gray-eske-20 dark:border-white/10"
          role="listbox"
          aria-label={typeof label === "string" ? label : "opciones"}
          style={{ position: "relative" }}
        >
          {/* Opción "Todos" siempre primera */}
          {!isTodos && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => { onChange([todosLabel]); setSearch(""); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-black-eske-20 dark:text-[#9AAEBE] hover:bg-blue-eske-10 dark:hover:bg-white/5 italic"
            >
              {todosLabel} (limpiar selección)
            </button>
          )}
          {filteredOptions.length === 0 && (
            <p className="px-3 py-2 text-xs text-black-eske-10 dark:text-[#6D8294]">Sin resultados</p>
          )}
          {filteredOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => add(o.value)}
              className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2
                         hover:bg-blue-eske-10 dark:hover:bg-white/5
                         text-black-eske dark:text-[#EAF2F8]
                         focus-visible:outline-none focus-visible:bg-blue-eske-10 dark:focus-visible:bg-white/5"
            >
              {o.color && (
                <span
                  className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: o.color }}
                  aria-hidden="true"
                />
              )}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
