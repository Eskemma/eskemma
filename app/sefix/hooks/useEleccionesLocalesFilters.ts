"use client";
// app/sefix/hooks/useEleccionesLocalesFilters.ts
// Estado y lógica de filtros para Elecciones Locales.
// Cascada: estado (primario) → año → cargo → geo.
import { useState, useRef, useCallback, useEffect } from "react";
import {
  ELECCIONES_LOCALES_DEFAULTS,
  CARGO_DISPLAY_LABELS_LOC,
  CDMX_ONLY_CARGOS,
} from "@/lib/sefix/eleccionesLocalesConstants";
import { EleccionesLocalesFilterParams, GeoEleccionesOpcion } from "@/types/sefix.types";

const BASE = "/api/sefix/elecciones-locales-geo";

// ============================================================
// HOOKS DE CASCADA — años y cargos disponibles por estado
// ============================================================

export function useLocalesAvailableYears(
  estado: string
): { years: number[]; isLoading: boolean } {
  const [years, setYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!estado) { setYears([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const p = new URLSearchParams({ nivel: "available_years", estado });
    fetch(`${BASE}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelRef.current) setYears(d.availableYears ?? []); })
      .catch(() => { if (!cancelRef.current) setYears([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [estado]);

  return { years, isLoading };
}

export function useLocalesAvailableCargos(
  estado: string,
  anio: number
): { cargos: string[]; isLoading: boolean } {
  const [cargos, setCargos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!estado || !anio) { setCargos([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const p = new URLSearchParams({ nivel: "available_cargos", estado, anio: String(anio) });
    fetch(`${BASE}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelRef.current) setCargos(d.cargos ?? []); })
      .catch(() => { if (!cancelRef.current) setCargos([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [estado, anio]);

  return { cargos, isLoading };
}

// ============================================================
// HOOKS DE GEO CASCADE
// ============================================================

export function useLocalesDistritos(
  anio: number,
  cargo: string,
  estado: string
): { opciones: GeoEleccionesOpcion[]; isLoading: boolean } {
  const [opciones, setOpciones] = useState<GeoEleccionesOpcion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!estado || !cargo) { setOpciones([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const p = new URLSearchParams({ nivel: "distritos", anio: String(anio), cargo, estado });
    fetch(`${BASE}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelRef.current) setOpciones(d.opciones ?? []); })
      .catch(() => { if (!cancelRef.current) setOpciones([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado]);

  return { opciones, isLoading };
}

export function useLocalesMunicipios(
  anio: number,
  cargo: string,
  estado: string,
  cabecera: string
): { opciones: GeoEleccionesOpcion[]; isLoading: boolean } {
  const [opciones, setOpciones] = useState<GeoEleccionesOpcion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!estado || !cargo || !cabecera) { setOpciones([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const p = new URLSearchParams({ nivel: "municipios", anio: String(anio), cargo, estado, cabecera });
    fetch(`${BASE}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelRef.current) setOpciones(d.opciones ?? []); })
      .catch(() => { if (!cancelRef.current) setOpciones([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado, cabecera]);

  return { opciones, isLoading };
}

export function useLocalesSecciones(
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
    if (!estado || !cargo || !municipio) { setSecciones([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const p = new URLSearchParams({ nivel: "secciones", anio: String(anio), cargo, estado, municipio });
    if (cabecera) p.set("cabecera", cabecera);
    fetch(`${BASE}?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current)
          setSecciones((d.opciones ?? []).map((o: GeoEleccionesOpcion) => o.cve));
      })
      .catch(() => { if (!cancelRef.current) setSecciones([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado, cabecera, municipio]);

  return { secciones, isLoading };
}

// ============================================================
// HOOK DE PARTIDOS DISPONIBLES (dinámico por estado+año+cargo)
// ============================================================

export function useLocalesAvailablePartidos(
  anio: number,
  cargo: string,
  estado: string
): { partidos: string[]; isLoading: boolean } {
  const [partidos, setPartidos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!cargo || !estado) { setPartidos([]); return; }
    cancelRef.current = false;
    setIsLoading(true);
    const p = new URLSearchParams({ nivel: "partidos", anio: String(anio), cargo, estado });
    fetch(`${BASE}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelRef.current) setPartidos(d.partidos ?? []); })
      .catch(() => { if (!cancelRef.current) setPartidos([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado]);

  return { partidos, isLoading };
}

// ============================================================
// HOOK DE METADATA
// ============================================================

export function useLocalesMetadata(
  anio: number,
  cargo: string,
  estado: string,
  cabecera?: string
): { tipos: string[]; principios: string[]; isLoading: boolean } {
  const [tipos, setTipos] = useState<string[]>(["ORDINARIA"]);
  const [principios, setPrincipios] = useState<string[]>(["MAYORIA RELATIVA"]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!estado || !cargo) return;
    cancelRef.current = false;
    setIsLoading(true);
    const p = new URLSearchParams({ nivel: "metadata", anio: String(anio), cargo, estado });
    if (cabecera) p.set("cabecera", cabecera);
    fetch(`${BASE}?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current && d.metadata) {
          setTipos(d.metadata.tipos?.length ? d.metadata.tipos : ["ORDINARIA"]);
          setPrincipios(d.metadata.principios?.length ? d.metadata.principios : ["MAYORIA RELATIVA"]);
        }
      })
      .catch(() => {
        if (!cancelRef.current) {
          setTipos(["ORDINARIA"]);
          setPrincipios(["MAYORIA RELATIVA"]);
        }
      })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  }, [anio, cargo, estado, cabecera]);

  return { tipos, principios, isLoading };
}

// ============================================================
// HOOK PRINCIPAL DE FILTROS LOCALES
// ============================================================

interface UseEleccionesLocalesFiltersResult {
  pendingEstado: string;
  pendingAnio: number;
  pendingCargo: string;
  pendingPartidos: string[];
  pendingTipo: string;
  pendingPrincipio: string;
  pendingCabecera: string;
  pendingMunicipio: string;
  pendingSecciones: string[];
  committed: EleccionesLocalesFilterParams;
  queryVersion: number;
  hasPending: boolean;
  setEstado: (v: string) => void;
  setAnio: (v: number) => void;
  setCargo: (v: string) => void;
  setPartidos: (v: string[]) => void;
  setTipo: (v: string) => void;
  setPrincipio: (v: string) => void;
  setCabecera: (v: string) => void;
  setMunicipio: (v: string) => void;
  setSecciones: (v: string[]) => void;
  handleConsultar: () => void;
  handleRestablecer: () => void;
  availableYears: number[];
  loadingYears: boolean;
  cargosDisponibles: string[];
  loadingCargos: boolean;
  partidosDisponibles: string[];
  loadingPartidos: boolean;
  tiposDisponibles: string[];
  principiosDisponibles: string[];
}

const DEFAULT = ELECCIONES_LOCALES_DEFAULTS;

export function useEleccionesLocalesFilters(): UseEleccionesLocalesFiltersResult {
  const [pendingEstado, setPendingEstado] = useState(DEFAULT.estado);
  const [pendingAnio, setPendingAnio] = useState(DEFAULT.anio);
  const [pendingCargo, setPendingCargo] = useState(DEFAULT.cargo);
  const [pendingPartidos, setPendingPartidos] = useState<string[]>(DEFAULT.partidos);
  const [pendingTipo, setPendingTipo] = useState<string>(DEFAULT.tipo);
  const [pendingPrincipio, setPendingPrincipio] = useState<string>(DEFAULT.principio);
  const [pendingCabecera, setPendingCabecera] = useState(DEFAULT.cabecera);
  const [pendingMunicipio, setPendingMunicipio] = useState(DEFAULT.municipio);
  const [pendingSecciones, setPendingSecciones] = useState<string[]>(DEFAULT.secciones);
  const [queryVersion, setQueryVersion] = useState(0);

  const committedRef = useRef<EleccionesLocalesFilterParams>({
    estado: DEFAULT.estado,
    anio: DEFAULT.anio,
    cargo: DEFAULT.cargo,
    partidos: [...DEFAULT.partidos],
    tipo: DEFAULT.tipo,
    principio: DEFAULT.principio,
    cabecera: DEFAULT.cabecera,
    municipio: DEFAULT.municipio,
    secciones: [...DEFAULT.secciones],
  });
  const [committed, setCommitted] = useState<EleccionesLocalesFilterParams>(committedRef.current);

  const hasPending =
    pendingEstado !== committed.estado ||
    pendingAnio !== committed.anio ||
    pendingCargo !== committed.cargo ||
    JSON.stringify(pendingPartidos) !== JSON.stringify(committed.partidos) ||
    pendingTipo !== committed.tipo ||
    pendingPrincipio !== committed.principio ||
    pendingCabecera !== committed.cabecera ||
    pendingMunicipio !== committed.municipio ||
    JSON.stringify(pendingSecciones) !== JSON.stringify(committed.secciones);

  // Dynamic cascade data
  const { years: availableYears, isLoading: loadingYears } = useLocalesAvailableYears(pendingEstado);
  const { cargos: rawCargos, isLoading: loadingCargos } = useLocalesAvailableCargos(pendingEstado, pendingAnio);

  // Filter CDMX-only cargos based on the selected estado
  const isCdmx =
    pendingEstado === "CIUDAD DE MEXICO" ||
    pendingEstado === "DISTRITO FEDERAL";
  const cargosDisponibles = rawCargos.filter(
    (c) => !CDMX_ONLY_CARGOS.has(c) || isCdmx
  );

  // Partidos disponibles para el estado+año+cargo seleccionados (dinámico desde CSV)
  const { partidos: partidosDisponibles, isLoading: loadingPartidos } =
    useLocalesAvailablePartidos(pendingAnio, pendingCargo, pendingEstado);

  // Metadata
  const { tipos: rawTipos, principios: rawPrincipios } = useLocalesMetadata(
    pendingAnio,
    pendingCargo,
    pendingEstado,
    pendingCabecera || undefined
  );

  const tieneOrdinaria = rawTipos.includes("ORDINARIA");
  const tieneExtraordinaria = rawTipos.includes("EXTRAORDINARIA");
  const tiposDisponibles =
    tieneOrdinaria && tieneExtraordinaria
      ? ["ORDINARIA", "EXTRAORDINARIA", "AMBAS"]
      : rawTipos;
  const principiosDisponibles = rawPrincipios;

  // Auto-ajustar tipo
  useEffect(() => {
    if (tieneOrdinaria && tieneExtraordinaria) { setPendingTipo("AMBAS"); return; }
    if (tiposDisponibles.includes(pendingTipo)) return;
    setPendingTipo(tiposDisponibles[0] ?? "ORDINARIA");
  }, [tiposDisponibles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ajustar principio
  useEffect(() => {
    if (principiosDisponibles.length === 0) return;
    if (principiosDisponibles.includes(pendingPrincipio)) return;
    setPendingPrincipio(principiosDisponibles[0]);
  }, [principiosDisponibles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ajustar año cuando cambia la lista de años disponibles
  useEffect(() => {
    if (availableYears.length === 0) return;
    if (availableYears.includes(pendingAnio)) return;
    setPendingAnio(availableYears[availableYears.length - 1]);
    setPendingCabecera(""); setPendingMunicipio(""); setPendingSecciones([]);
  }, [availableYears]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ajustar cargo cuando cambia la lista de cargos disponibles
  useEffect(() => {
    if (cargosDisponibles.length === 0) return;
    if (cargosDisponibles.includes(pendingCargo)) return;
    setPendingCargo(cargosDisponibles[0]);
    setPendingPartidos(["Todos"]);
    setPendingCabecera(""); setPendingMunicipio(""); setPendingSecciones([]);
  }, [cargosDisponibles]); // eslint-disable-line react-hooks/exhaustive-deps

  const setEstado = useCallback((estado: string) => {
    setPendingEstado(estado);
    setPendingCabecera(""); setPendingMunicipio(""); setPendingSecciones([]);
    setPendingPartidos(["Todos"]);
  }, []);

  const setAnio = useCallback((anio: number) => {
    setPendingAnio(anio);
    setPendingCabecera(""); setPendingMunicipio(""); setPendingSecciones([]);
    setPendingPartidos(["Todos"]);
  }, []);

  const setCargo = useCallback((cargo: string) => {
    setPendingCargo(cargo);
    setPendingPartidos(["Todos"]);
    setPendingCabecera(""); setPendingMunicipio(""); setPendingSecciones([]);
  }, []);

  const setCabecera = useCallback((cab: string) => {
    setPendingCabecera(cab);
    setPendingMunicipio(""); setPendingSecciones([]);
  }, []);

  const setMunicipio = useCallback((mun: string) => {
    setPendingMunicipio(mun);
    setPendingSecciones([]);
  }, []);

  const handleConsultar = useCallback(() => {
    const next: EleccionesLocalesFilterParams = {
      estado: pendingEstado,
      anio: pendingAnio,
      cargo: pendingCargo,
      partidos: [...pendingPartidos],
      tipo: pendingTipo,
      principio: pendingPrincipio,
      cabecera: pendingCabecera,
      municipio: pendingMunicipio,
      secciones: [...pendingSecciones],
    };
    committedRef.current = next;
    setCommitted(next);
    setQueryVersion((v) => v + 1);
  }, [
    pendingEstado, pendingAnio, pendingCargo, pendingPartidos,
    pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
  ]);

  const handleRestablecer = useCallback(() => {
    const next: EleccionesLocalesFilterParams = {
      estado: DEFAULT.estado,
      anio: DEFAULT.anio,
      cargo: DEFAULT.cargo,
      partidos: [...DEFAULT.partidos],
      tipo: DEFAULT.tipo,
      principio: DEFAULT.principio,
      cabecera: DEFAULT.cabecera,
      municipio: DEFAULT.municipio,
      secciones: [...DEFAULT.secciones],
    };
    setPendingEstado(DEFAULT.estado);
    setPendingAnio(DEFAULT.anio);
    setPendingCargo(DEFAULT.cargo);
    setPendingPartidos([...DEFAULT.partidos]);
    setPendingTipo(DEFAULT.tipo);
    setPendingPrincipio(DEFAULT.principio);
    setPendingCabecera(DEFAULT.cabecera);
    setPendingMunicipio(DEFAULT.municipio);
    setPendingSecciones([...DEFAULT.secciones]);
    committedRef.current = next;
    setCommitted(next);
    setQueryVersion((v) => v + 1);
  }, []);

  // Trigger inicial
  useEffect(() => {
    handleConsultar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  void CARGO_DISPLAY_LABELS_LOC;

  return {
    pendingEstado, pendingAnio, pendingCargo, pendingPartidos,
    pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
    committed, queryVersion, hasPending,
    setEstado, setAnio, setCargo,
    setPartidos: setPendingPartidos,
    setTipo: setPendingTipo,
    setPrincipio: setPendingPrincipio,
    setCabecera, setMunicipio,
    setSecciones: setPendingSecciones,
    handleConsultar, handleRestablecer,
    availableYears, loadingYears,
    cargosDisponibles, loadingCargos,
    partidosDisponibles, loadingPartidos, tiposDisponibles, principiosDisponibles,
  };
}
