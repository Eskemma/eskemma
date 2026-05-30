"use client";
import { useState, useCallback, useEffect } from "react";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { useGeoOptions } from "@/app/components/geo/hooks/useGeoOptions";
import type { GeoOption } from "@/types/geo.types";

export type EcegFilterMode = "municipio" | "distrito";

// "TODOS" is a sentinel for "all districts of the state" within distrito mode.
export const DISTRITO_TODOS = "TODOS";

interface EcegState {
  estado: string;
  municipioNombre: string; // NOMGEO display name — used by filterByScope NOMGEO matching
  municipioCve: string;    // CVE_MUN 3-digit — used to load sección options
  cabeceraCve: string;     // DISTRITO_FED 3-digit, or DISTRITO_TODOS sentinel, or ""
  cabeceraLabel: string;   // District name for display
  secciones: string[];     // CVE_SECCION values, empty = Todas
  filterMode: EcegFilterMode;
}

export type EcegCommitted = EcegState;

const INITIAL: EcegState = {
  estado: "",
  municipioNombre: "",
  municipioCve: "",
  cabeceraCve: "",
  cabeceraLabel: "",
  secciones: [],
  filterMode: "municipio",
};

export interface UseGeoEcegFiltersResult {
  // Pending (UI state, before Consultar)
  pendingEstado: string;
  pendingMunicipioNombre: string;
  pendingMunicipioCve: string;
  pendingCabeceraCve: string;
  pendingCabeceraLabel: string;
  pendingSecciones: string[];
  pendingFilterMode: EcegFilterMode;
  // Committed (what the map renders)
  committed: EcegCommitted;
  // Dropdown options
  municipioOptions: GeoOption[];
  distritoOptions: GeoOption[];
  seccionOptions: GeoOption[];
  municipioLoading: boolean;
  distritoLoading: boolean;
  seccionLoading: boolean;
  // Setters — mutual exclusion enforced here
  setEstado: (v: string) => void;
  setMunicipio: (cve: string, nombre: string) => void;
  setCabecera: (cve: string, label: string) => void;
  setSecciones: (v: string[]) => void;
  handleConsultar: () => void;
  handleRestablecer: () => void;
  queryVersion: number;
  hasPending: boolean;
}

export function useGeoEcegFilters(): UseGeoEcegFiltersResult {
  const [pending, setPending] = useState<EcegState>(INITIAL);
  const [committed, setCommitted] = useState<EcegCommitted>(INITIAL);
  const [queryVersion, setQueryVersion] = useState(0);

  const pendingEstadoId = ESTADO_CVE_MAP[pending.estado] ?? "";

  // Municipio options for the pending state
  const { options: municipioOptions, isLoading: municipioLoading } = useGeoOptions({
    tipo: "municipios",
    estadoId: pendingEstadoId,
  });

  // Distrito options for the pending state
  const { options: distritoOptions, isLoading: distritoLoading } = useGeoOptions({
    tipo: "distritos_fed",
    estadoId: pendingEstadoId,
  });

  // Sección options via municipio path — only fetch when a specific municipio is selected
  const seccionMunEnabled =
    pending.filterMode === "municipio" && Boolean(pending.municipioCve);
  const { options: seccionesByMun, isLoading: seccionMunLoading } = useGeoOptions({
    tipo: "secciones",
    estadoId: seccionMunEnabled ? pendingEstadoId : "",
    municipio: seccionMunEnabled ? pending.municipioCve : undefined,
  });

  // Sección options via distrito path — only fetch when a specific district (not TODOS) is selected
  const seccionDistEnabled =
    pending.filterMode === "distrito" &&
    Boolean(pending.cabeceraCve) &&
    pending.cabeceraCve !== DISTRITO_TODOS;
  const { options: seccionesByDist, isLoading: seccionDistLoading } = useGeoOptions({
    tipo: "secciones",
    estadoId: seccionDistEnabled ? pendingEstadoId : "",
    distrito_fed: seccionDistEnabled ? pending.cabeceraCve : undefined,
  });

  const seccionOptions =
    pending.filterMode === "municipio" ? seccionesByMun : seccionesByDist;
  const seccionLoading =
    pending.filterMode === "municipio" ? seccionMunLoading : seccionDistLoading;

  // ── Setters ──────────────────────────────────────────────────────────────────

  const setEstado = useCallback((v: string) => {
    setPending({ ...INITIAL, estado: v });
  }, []);

  // Selecting a municipio switches to municipio mode and clears district fields.
  const setMunicipio = useCallback((cve: string, nombre: string) => {
    setPending((p) => ({
      ...p,
      municipioNombre: nombre,
      municipioCve: cve,
      cabeceraCve: "",
      cabeceraLabel: "",
      secciones: [],
      filterMode: "municipio",
    }));
  }, []);

  // Selecting a district (or TODOS sentinel) switches to distrito mode and clears municipio fields.
  const setCabecera = useCallback((cve: string, label: string) => {
    setPending((p) => ({
      ...p,
      cabeceraCve: cve,
      cabeceraLabel: label,
      municipioNombre: "",
      municipioCve: "",
      secciones: [],
      filterMode: "distrito",
    }));
  }, []);

  const setSecciones = useCallback((v: string[]) => {
    setPending((p) => ({ ...p, secciones: v }));
  }, []);

  const handleConsultar = useCallback(() => {
    setCommitted(pending);
    setQueryVersion((v) => v + 1);
  }, [pending]);

  const handleRestablecer = useCallback(() => {
    setPending(INITIAL);
    setCommitted(INITIAL);
    setQueryVersion((v) => v + 1);
  }, []);

  // Trigger inicial: carga con valores por defecto (Nacional, filterMode="municipio")
  // Mismo patrón que useEleccionesFilters.ts
  useEffect(() => {
    handleConsultar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPending =
    pending.estado !== committed.estado ||
    pending.municipioNombre !== committed.municipioNombre ||
    pending.cabeceraCve !== committed.cabeceraCve ||
    pending.filterMode !== committed.filterMode ||
    pending.secciones.join(",") !== committed.secciones.join(",");

  return {
    pendingEstado: pending.estado,
    pendingMunicipioNombre: pending.municipioNombre,
    pendingMunicipioCve: pending.municipioCve,
    pendingCabeceraCve: pending.cabeceraCve,
    pendingCabeceraLabel: pending.cabeceraLabel,
    pendingSecciones: pending.secciones,
    pendingFilterMode: pending.filterMode,
    committed,
    municipioOptions,
    distritoOptions,
    seccionOptions,
    municipioLoading,
    distritoLoading,
    seccionLoading,
    setEstado,
    setMunicipio,
    setCabecera,
    setSecciones,
    handleConsultar,
    handleRestablecer,
    queryVersion,
    hasPending,
  };
}
