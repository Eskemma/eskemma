// app/blog/admin/components/TagInput.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { getAllTagsWithCount, TagSuggestion } from "@/lib/client/tags.client";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ value, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allTags, setAllTags] = useState<TagSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Cargar todos los tags al montar
  useEffect(() => {
    loadAllTags();
  }, []);

  // Manejar clics fuera para cerrar sugerencias
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadAllTags = async () => {
    const tags = await getAllTagsWithCount();
    setAllTags(tags);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setActiveSuggestionIndex(-1);

    if (value.trim()) {
      const filtered = allTags.filter((tag) =>
        tag.tag.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 8));
      setShowSuggestions(true);
    } else {
      setSuggestions(allTags.slice(0, 8));
      setShowSuggestions(true);
    }
  };

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !value.includes(normalizedTag)) {
      onChange([...value, normalizedTag]);
      setInputValue("");
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        addTag(suggestions[activeSuggestionIndex].tag);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  return (
    <div className="space-y-3">
      {/* Tags actuales */}
      {value.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label={`${value.length} tag${value.length !== 1 ? "s" : ""} seleccionado${value.length !== 1 ? "s" : ""}`}
        >
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 bg-bluegreen-eske text-white rounded-full text-sm font-medium"
              role="listitem"
            >
              <span aria-label={`Tag: ${tag}`}>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:bg-white hover:bg-opacity-20 rounded-full p-0.5 transition-colors focus-ring-primary"
                aria-label={`Eliminar tag ${tag}`}
              >
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input con autocompletado */}
      <div className="relative">
        <label htmlFor="tag-input" className="sr-only">
          Agregar tags (separados por Enter o coma)
        </label>
        <input
          ref={inputRef}
          id="tag-input"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setSuggestions(allTags.slice(0, 8));
            setShowSuggestions(true);
          }}
          placeholder="Escribe un tag y presiona Enter o coma..."
          className="w-full px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294] rounded-lg focus-ring-primary"
          aria-describedby="tag-input-hint"
          aria-autocomplete="list"
          aria-controls="tag-suggestions"
          aria-expanded={showSuggestions}
          aria-activedescendant={
            activeSuggestionIndex >= 0
              ? `tag-suggestion-${activeSuggestionIndex}`
              : undefined
          }
          role="combobox"
        />

        {/* Sugerencias */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            id="tag-suggestions"
            className="absolute z-10 w-full mt-1 bg-white-eske dark:bg-[#18324A] border border-gray-eske-30 dark:border-white/10 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            role="listbox"
            aria-label="Sugerencias de tags"
          >
            <div className="p-2">
              <p
                className="text-xs text-black-eske-20 dark:text-[#9AAEBE] px-2 py-1 font-semibold"
                role="presentation"
              >
                Tags sugeridos
              </p>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.tag}
                  id={`tag-suggestion-${index}`}
                  type="button"
                  onClick={() => addTag(suggestion.tag)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between group focus-ring-primary ${
                    index === activeSuggestionIndex
                      ? "bg-bluegreen-eske-10 dark:bg-white/10"
                      : "hover:bg-bluegreen-eske-10 dark:hover:bg-white/5"
                  }`}
                  role="option"
                  aria-selected={index === activeSuggestionIndex}
                >
                  <span className="text-black-eske dark:text-[#C7D6E0] group-hover:text-bluegreen-eske dark:group-hover:text-[#6BA4C6] font-medium">
                    {suggestion.tag}
                  </span>
                  <span
                    className="text-xs text-black-eske-10 dark:text-[#9AAEBE] bg-gray-eske-20 dark:bg-white/10 px-2 py-0.5 rounded-full"
                    aria-label={`${suggestion.count} uso${suggestion.count !== 1 ? "s" : ""}`}
                  >
                    {suggestion.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p id="tag-input-hint" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
        💡 Tip: Presiona Enter o coma para agregar. Usa tags existentes para
        mejor organización.
      </p>
    </div>
  );
}
