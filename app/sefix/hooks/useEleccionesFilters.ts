"use client";
// app/sefix/hooks/useEleccionesFilters.ts
// Estado y lógica de filtros para Elecciones Federales.
// Patrón pending vs committed (igual que GeoFilter.tsx en Lista Nominal).
import { useState, useRef, useCallback, useEffect } from "react";
import {
  VALID_COMBINATIONS,
  AVAILABLE_YEARS,
  SPECIAL_CASES,
  PARTIDOS_MAPPING,
  ELECCIONES_DEFAULTS,
} from "@/lib/sefix/eleccionesConstants";
import { EleccionesFilterParams, GeoEleccionesOpcion } from "@/types/sefix.types";

// ============================================================
// HOOK DE GEO CASCADE — distritos
// ============================================================

export function useEleccionesDistritos(
  anio: number,
  cargo: string,
  estado: string
): { opciones: GeoEleccionesOpcion[]; isLoading: boolean } {
  const [opciones, setOpciones] = useState<GeoEleccionesOpcion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!estado) { setOpciones([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const params = new URLSearchParams({ nivel: "distritos", anio: String(anio), cargo, estado });
    fetch(`/api/sefix/elecciones-geo?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelRef.current) setOpciones(d.opciones ?? []); })
      .catch(() => { if (!cancelRef.current) setOpciones([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado]);

  return { opciones, isLoading };
}

// ============================================================
// HOOK DE GEO CASCADE — municipios
// ============================================================

export function useEleccionesMunicipios(
  anio: number,
  cargo: string,
  estado: string,
  cabecera: string
): { opciones: GeoEleccionesOpcion[]; isLoading: boolean } {
  const [opciones, setOpciones] = useState<GeoEleccionesOpcion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!estado || !cabecera) { setOpciones([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const params = new URLSearchParams({ nivel: "municipios", anio: String(anio), cargo, estado, cabecera });
    fetch(`/api/sefix/elecciones-geo?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelRef.current) setOpciones(d.opciones ?? []); })
      .catch(() => { if (!cancelRef.current) setOpciones([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado, cabecera]);

  return { opciones, isLoading };
}

// ============================================================
// HOOK DE GEO CASCADE — secciones
// ============================================================

export function useEleccionesSecciones(
  anio: number,
  cargo: string,
  estado: string,
  cabecera: string,
  municipio: string
): { secciones: string[]; isLoading: boolean } {
  const [secciones, setSecciones] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!estado || !municipio) { setSecciones([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const params = new URLSearchParams({ nivel: "secciones", anio: String(anio), cargo, estado, municipio });
    if (cabecera) params.set("cabecera", cabecera);
    fetch(`/api/sefix/elecciones-geo?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current) {
          setSecciones((d.opciones ?? []).map((o: GeoEleccionesOpcion) => o.cve));
        }
      })
      .catch(() => { if (!cancelRef.current) setSecciones([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado, cabecera, municipio]);

  return { secciones, isLoading };
}

// ============================================================
// HOOK DE METADATA (tipos y principios disponibles)
// ============================================================

export function useEleccionesMetadata(
  anio: number,
  cargo: string,
  estado: string,
  cabecera?: string
): { tipos: string[]; principios: string[]; hasExtranjero: boolean; isLoading: boolean } {
  const [tipos, setTipos] = useState<string[]>(["ORDINARIA"]);
  const [principios, setPrincipios] = useState<string[]>(["MAYORIA RELATIVA"]);
  const [hasExtranjero, setHasExtranjero] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    setIsLoading(true);
    const params = new URLSearchParams({ nivel: "metadata", anio: String(anio), cargo });
    if (estado) params.set("estado", estado);
    if (cabecera) params.set("cabecera", cabecera);
    fetch(`/api/sefix/elecciones-geo?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current && d.metadata) {
          setTipos(d.metadata.tipos?.length ? d.metadata.tipos : ["ORDINARIA"]);
          setPrincipios(d.metadata.principios?.length ? d.metadata.principios : ["MAYORIA RELATIVA"]);
          setHasExtranjero(d.metadata.hasExtranjero ?? false);
        }
      })
      .catch(() => {
        if (!cancelRef.current) {
          setTipos(["ORDINARIA"]);
          setPrincipios(["MAYORIA RELATIVA"]);
          setHasExtranjero(false);
        }
      })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado, cabecera]);

  return { tipos, principios, hasExtranjero, isLoading };
}

// ============================================================
// HOOK PRINCIPAL DE FILTROS
// ============================================================

interface UseEleccionesFiltersResult {
  // Estado pending (UI)
  pendingAnio: number;
  pendingCargo: string;
  pendingEstado: string;
  pendingPartidos: string[];
  pendingTipo: string;
  pendingPrincipio: string;
  pendingCabecera: string;
  pendingMunicipio: string;
  pendingSecciones: string[];
  pendingIncluirExtranjero: boolean;
  // Estado committed (última consulta ejecutada)
  committed: EleccionesFilterParams;
  queryVersion: number;
  hasPending: boolean;
  // Acciones
  setAnio: (v: number) => void;
  setCargo: (v: string) => void;
  setEstado: (v: string) => void;
  setPartidos: (v: string[]) => void;
  setTipo: (v: string) => void;
  setPrincipio: (v: string) => void;
  setCabecera: (v: string) => void;
  setMunicipio: (v: string) => void;
  setSecciones: (v: string[]) => void;
  setIncluirExtranjero: (v: boolean) => void;
  handleConsultar: () => void;
  handleRestablecer: () => void;
  // Cargos disponibles para el año seleccionado
  cargosDisponibles: string[];
  // Lista de partidos para el año+cargo seleccionados (para el multiselect)
  partidosDisponibles: string[];
  // Tipos y principios disponibles (desde metadata del CSV)
  tiposDisponibles: string[];
  principiosDisponibles: string[];
  // Extranjero
  hasExtranjero: boolean;
}

const DEFAULT = ELECCIONES_DEFAULTS;

export function useEleccionesFilters(): UseEleccionesFiltersResult {
  const [pendingAnio, setPendingAnio] = useState(DEFAULT.anio);
  const [pendingCargo, setPendingCargo] = useState<string>(DEFAULT.cargo);
  const [pendingEstado, setPendingEstado] = useState(DEFAULT.estado);
  const [pendingPartidos, setPendingPartidos] = useState<string[]>(DEFAULT.partidos);
  const [pendingTipo, setPendingTipo] = useState<string>(DEFAULT.tipo);
  const [pendingPrincipio, setPendingPrincipio] = useState<string>(DEFAULT.principio);
  const [pendingCabecera, setPendingCabecera] = useState(DEFAULT.cabecera);
  const [pendingMunicipio, setPendingMunicipio] = useState(DEFAULT.municipio);
  const [pendingSecciones, setPendingSecciones] = useState<string[]>(DEFAULT.secciones);
  const [pendingIncluirExtranjero, setPendingIncluirExtranjero] = useState(DEFAULT.incluirExtranjero);
  const [queryVersion, setQueryVersion] = useState(0);

  const committedRef = useRef<EleccionesFilterParams>({
    anio: DEFAULT.anio,
    cargo: DEFAULT.cargo,
    estado: DEFAULT.estado,
    partidos: [...DEFAULT.partidos],
    tipo: DEFAULT.tipo,
    principio: DEFAULT.principio,
    cabecera: DEFAULT.cabecera,
    municipio: DEFAULT.municipio,
    secciones: [...DEFAULT.secciones],
    incluirExtranjero: DEFAULT.incluirExtranjero,
  });
  const [committed, setCommitted] = useState<EleccionesFilterParams>(committedRef.current);

  const hasPending =
    pendingAnio !== committed.anio ||
    pendingCargo !== committed.cargo ||
    pendingEstado !== committed.estado ||
    JSON.stringify(pendingPartidos) !== JSON.stringify(committed.partidos) ||
    pendingTipo !== committed.tipo ||
    pendingPrincipio !== committed.principio ||
    pendingCabecera !== committed.cabecera ||
    pendingMunicipio !== committed.municipio ||
    JSON.stringify(pendingSecciones) !== JSON.stringify(committed.secciones) ||
    pendingIncluirExtranjero !== committed.incluirExtranjero;

  const cargosDisponibles = VALID_COMBINATIONS[String(pendingAnio)] ?? [];

  const mapKey = `${pendingAnio}_${pendingCargo}`;
  const partidosDisponibles = PARTIDOS_MAPPING[mapKey] ?? [];

  // Metadata: tipos, principios y hasExtranjero para año+cargo+estado+distrito actual
  const { tipos: rawTipos, principios: rawPrincipios, hasExtranjero } = useEleccionesMetadata(
    pendingAnio,
    pendingCargo,
    pendingEstado,
    pendingCabecera || undefined,
  );

  // Calcular choices de tipo: si existen ORDINARIA y EXTRAORDINARIA → añadir AMBAS
  const tieneOrdinaria = rawTipos.includes("ORDINARIA");
  const tieneExtraordinaria = rawTipos.includes("EXTRAORDINARIA");
  const tiposDisponibles =
    tieneOrdinaria && tieneExtraordinaria
      ? ["ORDINARIA", "EXTRAORDINARIA", "AMBAS"]
      : rawTipos;
  const principiosDisponibles = rawPrincipios;

  // Auto-ajustar pendingTipo cuando cambia metadata.
  // Fuerza "AMBAS" cuando existen ambos tipos (es el default correcto).
  // Solo ajusta al disponible cuando el tipo actual queda inválido.
  useEffect(() => {
    if (tieneOrdinaria && tieneExtraordinaria) {
      setPendingTipo("AMBAS");
      return;
    }
    if (tiposDisponibles.includes(pendingTipo)) return;
    setPendingTipo(tiposDisponibles[0] ?? "ORDINARIA");
  }, [tieneOrdinaria, tieneExtraordinaria]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ajustar pendingPrincipio cuando cambia metadata
  useEffect(() => {
    if (principiosDisponibles.length === 0) return;
    if (principiosDisponibles.includes(pendingPrincipio)) return;
    setPendingPrincipio(principiosDisponibles[0]);
  }, [principiosDisponibles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ajustar cargo si el año cambia y el cargo ya no es válido
  const setAnio = useCallback((anio: number) => {
    setPendingAnio(anio);
    const validos = VALID_COMBINATIONS[String(anio)] ?? [];
    // Caso especial 2023: forzar sen + TAMAULIPAS
    if (anio === 2023) {
      setPendingCargo("sen");
      setPendingEstado(SPECIAL_CASES.CASE_2023.estado);
      setPendingTipo(SPECIAL_CASES.CASE_2023.tipo);
    } else if (!validos.includes(pendingCargo)) {
      setPendingCargo(validos[0] ?? "dip");
    }
    // Resetear filtros geográficos y de partidos al cambiar año
    setPendingCabecera("");
    setPendingMunicipio("");
    setPendingSecciones([]);
    setPendingPartidos(["Todos"]);
  }, [pendingCargo]);

  const setCargo = useCallback((cargo: string) => {
    setPendingCargo(cargo);
    // Caso especial 2021 SENADURIA: forzar NAYARIT
    if (pendingAnio === 2021 && cargo === "sen") {
      setPendingEstado(SPECIAL_CASES.CASE_2021_SEN.estado);
      setPendingTipo(SPECIAL_CASES.CASE_2021_SEN.tipo);
    }
    // Resetear partidos al cambiar cargo
    setPendingPartidos(["Todos"]);
    setPendingCabecera("");
    setPendingMunicipio("");
    setPendingSecciones([]);
  }, [pendingAnio]);

  const setEstado = useCallback((estado: string) => {
    setPendingEstado(estado);
    // Reset cascade
    setPendingCabecera("");
    setPendingMunicipio("");
    setPendingSecciones([]);
  }, []);

  const setCabecera = useCallback((cab: string) => {
    setPendingCabecera(cab);
    setPendingMunicipio("");
    setPendingSecciones([]);
  }, []);

  const setMunicipio = useCallback((mun: string) => {
    setPendingMunicipio(mun);
    setPendingSecciones([]);
  }, []);

  const handleConsultar = useCallback(() => {
    const next: EleccionesFilterParams = {
      anio: pendingAnio,
      cargo: pendingCargo,
      estado: pendingEstado,
      partidos: [...pendingPartidos],
      tipo: pendingTipo,
      principio: pendingPrincipio,
      cabecera: pendingCabecera,
      municipio: pendingMunicipio,
      secciones: [...pendingSecciones],
      incluirExtranjero: pendingIncluirExtranjero,
    };
    committedRef.current = next;
    setCommitted(next);
    setQueryVersion((v) => v + 1);
  }, [
    pendingAnio, pendingCargo, pendingEstado, pendingPartidos,
    pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
    pendingIncluirExtranjero,
  ]);

  const handleRestablecer = useCallback(() => {
    const next: EleccionesFilterParams = {
      anio: DEFAULT.anio,
      cargo: DEFAULT.cargo,
      estado: DEFAULT.estado,
      partidos: [...DEFAULT.partidos],
      tipo: DEFAULT.tipo,
      principio: DEFAULT.principio,
      cabecera: DEFAULT.cabecera,
      municipio: DEFAULT.municipio,
      secciones: [...DEFAULT.secciones],
      incluirExtranjero: DEFAULT.incluirExtranjero,
    };
    setPendingAnio(DEFAULT.anio);
    setPendingCargo(DEFAULT.cargo);
    setPendingEstado(DEFAULT.estado);
    setPendingPartidos([...DEFAULT.partidos]);
    setPendingTipo(DEFAULT.tipo);
    setPendingPrincipio(DEFAULT.principio);
    setPendingCabecera(DEFAULT.cabecera);
    setPendingMunicipio(DEFAULT.municipio);
    setPendingSecciones([...DEFAULT.secciones]);
    setPendingIncluirExtranjero(DEFAULT.incluirExtranjero);
    committedRef.current = next;
    setCommitted(next);
    setQueryVersion((v) => v + 1);
  }, []);

  // Trigger inicial para cargar con defaults
  useEffect(() => {
    handleConsultar();
  // Solo al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    pendingAnio, pendingCargo, pendingEstado, pendingPartidos,
    pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
    pendingIncluirExtranjero,
    committed, queryVersion, hasPending,
    setAnio, setCargo, setEstado,
    setPartidos: setPendingPartidos,
    setTipo: setPendingTipo,
    setPrincipio: setPendingPrincipio,
    setCabecera, setMunicipio,
    setSecciones: setPendingSecciones,
    setIncluirExtranjero: setPendingIncluirExtranjero,
    handleConsultar, handleRestablecer,
    cargosDisponibles, partidosDisponibles,
    tiposDisponibles, principiosDisponibles,
    hasExtranjero,
  };
}

// ============================================================
// HOOK DE RESULTADOS — consulta con todos los filtros
// ============================================================

export interface UseResultadosEleccionesResult {
  data: import("@/types/sefix.types").ResultadosEleccionesData | null;
  isLoading: boolean;
  error: string | null;
}

export function useResultadosElecciones(
  params: EleccionesFilterParams,
  queryVersion: number
): UseResultadosEleccionesResult {
  const [data, setData] = useState<import("@/types/sefix.types").ResultadosEleccionesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const lastVersion = useRef(-1);

  useEffect(() => {
    if (queryVersion === 0) return;
    if (queryVersion === lastVersion.current) return;
    lastVersion.current = queryVersion;
    cancelRef.current = false;
    setIsLoading(true);
    setError(null);

    const sp = new URLSearchParams({
      cargo: params.cargo,
      anio: String(params.anio),
    });
    if (params.estado) sp.set("estado", params.estado);
    if (params.tipo && params.tipo !== "AMBAS") sp.set("tipo", params.tipo);
    if (params.principio) sp.set("principio", params.principio);
    if (params.cabecera) sp.set("cabecera", params.cabecera);
    if (params.municipio) sp.set("municipio", params.municipio);
    if (params.secciones.length) sp.set("secciones", params.secciones.join(","));
    if (!params.partidos.includes("Todos") && params.partidos.length) {
      sp.set("partidos", params.partidos.join(","));
    }
    if (!params.incluirExtranjero) sp.set("incluirExtranjero", "false");

    fetch(`/api/sefix/resultados?${sp}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current) {
          if (d.error) setError(d.error);
          else setData(d.resultados ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelRef.current) {
          setError("Error al cargar los resultados");
          setIsLoading(false);
        }
      });

    return () => { cancelRef.current = true; };
  }, [queryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading, error };
}

// ============================================================
// AÑOS DISPONIBLES (para el selector de año)
// ============================================================

export function useEleccionesAvailableYears(): number[] {
  return AVAILABLE_YEARS;
}
