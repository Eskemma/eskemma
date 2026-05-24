# ==============================================================================
# PIPELINE DE NORMALIZACIÓN ELECTORAL LOCAL (ESKEMMA) - Versión 4.5
# Produce CSVs normalizados compatibles con el dashboard Sefix (Next.js)
#
# Schema de salida:
#   Id, anio, cve_ambito, ambito, cve_tipo, tipo, cve_principio, principio,
#   cve_cargo, cargo, cve_estado, estado, cve_del, cabecera,
#   cve_mun, municipio, seccion, [partidos...], no_reg, vot_nul,
#   total_votos, lne, part_ciud
#
# Estructura de entrada esperada:
#   preparacion/PEL_{anio}/{ESTADO}_PEL_{anio}/{CARGO_csv}/*_SEC*.csv
#   preparacion/PEL_{anio}/{ESTADO}_PEL_{anio}/{ESTADO}_PEL_{anio}/{CARGO_csv}/*_SEC*.csv
#   preparacion/PEL_{anio}/{ESTADO}_PEL_{anio}/{ESTADO}_PEL_EXT_{anio}/{CARGO_csv}/*_SEC*.csv
#
# Cambios v4.10 (2023):
#   - ANIO <- 2017 (4 estados: COAH, MEX, NAY, VER — 11 CSVs)
#   - NAY REGIDURIAS usa ID_DEMARCACION_TERRITORIAL / DEMARCACION_TERRITORIAL
#     en lugar de ID_DISTRITO / CABECERA_DISTRITAL → añadidos a detección
#   - VER CASILLA (singular) → ya manejado desde v4.4 en columnas_partido
#   - VER_PEL_EXT_2018 dentro de PEL_2017 → detectado como ext correctamente
#   - JEFE.*GOBIERNO|JEFATURA.*GOBIERNO pattern (fix v4.5 para CDMX 2018)
#   - Robustez heredada de v4.4/4.5: tab/coma, BOM, SECCIONES, ID_COMUNIDAD,
#     col_mun_id/col_mun_nom fallback, col_no_reg ausente, es_ext dual-detección
# ==============================================================================

library(dplyr)
library(stringr)

# Forzar locale UTF-8 para manejo correcto de acentos y toupper/tolower
Sys.setlocale("LC_ALL", "en_US.UTF-8")

# ------------------------------------------------------------------------------
# 1. CONFIGURACIÓN
# ------------------------------------------------------------------------------

RUTA_PREP   <- "/Users/raul/Documents/development/eskemma/data/results/locals/preparacion"
RUTA_SALIDA <- "/Users/raul/Documents/development/eskemma/data/results/locals/procesados"

# Año a procesar (solo un año por ejecución)
ANIO <- 2023

# Entidades a procesar — NULL = todas; usar clave de carpeta, e.g. c("AGS", "CHIH")
ENTIDADES_FILTRO <- NULL

# ------------------------------------------------------------------------------
# 2. MAPEO DE CARPETAS DE CARGO → cargo_key / cve_cargo / label
# Orden importa: patrones más específicos primero
# ------------------------------------------------------------------------------

CARGO_FOLDERS <- tribble(
  ~patron_carpeta,            ~cargo_key,  ~cve_cargo, ~cargo_label,
  "JEFE_DELEGACIONAL",        "jef_del",   10L,        "JEFATURA DELEGACIONAL",
  "JEFE.*GOBIERNO|JEFATURA.*GOBIERNO", "jef_gob", 8L, "JEFATURA DE GOBIERNO",
  "ALCALDIAS",                "alc",       9L,         "ALCALDIA",
  "JUNTAS_MUNICIPALES",       "junta",     7L,         "JUNTA MUNICIPAL",
  "GUBERNATURA",              "gob",       4L,         "GUBERNATURA",
  # Acepta espacio o guión bajo: "DIPUTACIONES_LOC" y "DIPUTACIONES LOC" (QROO 2022)
  "DIPUTACIONES.LOC",         "dip_loc",   5L,         "DIPUTACION LOCAL",
  "AYUNTAMIENTOS",            "ayun",      6L,         "AYUNTAMIENTO",
  "SINDICATURA",              "sind",      11L,        "SINDICATURA",
  "REGIDURIA",                "reg",       12L,        "REGIDURIA",
  # ASAMB_CONST: Asamblea Constituyente CDMX 2016 (carpeta ASAMB_CONST_csv)
  "ASAMB",                    "asm",       13L,        "ASAMBLEISTA",
  # PRESIDENCIA DE COMUNIDAD (con espacio) y PRESIDENCIA_COMUNIDAD (guión bajo)
  "PRESIDENCIA.*COMUNIDAD",   "pres_com",  14L,        "PRESIDENCIA COMUNITARIA"
)

# ------------------------------------------------------------------------------
# 3. FUNCIONES AUXILIARES
# ------------------------------------------------------------------------------

detectar_cargo_y_principio <- function(ruta_archivo) {
  # Usa el nombre de la carpeta padre inmediata del CSV
  carpeta <- toupper(basename(dirname(ruta_archivo)))

  for (i in seq_len(nrow(CARGO_FOLDERS))) {
    if (str_detect(carpeta, CARGO_FOLDERS$patron_carpeta[i])) {
      cargo_row <- CARGO_FOLDERS[i, ]

      # Detectar principio desde la carpeta (MR / RP) o default MR
      if (str_detect(carpeta, "_RP_|_RP$")) {
        cve_prin <- 2L; label_prin <- "REPRESENTACION PROPORCIONAL"
      } else {
        cve_prin <- 1L; label_prin <- "MAYORIA RELATIVA"
      }

      return(list(
        cargo_key    = cargo_row$cargo_key,
        cve_cargo    = cargo_row$cve_cargo,
        cargo_label  = cargo_row$cargo_label,
        cve_principio = cve_prin,
        principio    = label_prin
      ))
    }
  }
  return(NULL)
}

# Elimina acentos de vocales (Á→A, É→E, Í→I, Ó→O, Ú→U) preservando Ñ y Ü.
# Convención adoptada en Sefix: nombres sin acentos en vocales para compatibilidad
# con selectInput, pero conservando dieresis y Ñ (TINGÜINDIN, ACUÑA, etc.).
norm_texto <- function(x) {
  chartr("ÁÉÍÓÚáéíóú",
         "AEIOUaeiou", x)
}

# Detecta si la fila es de la sección 0 (aún sin aplicar filtros —
# las filas de sec=0 en locales son agregados y se excluyen igual que en federales)
es_fila_agregado <- function(seccion_val) {
  is.na(seccion_val) || seccion_val == 0 || seccion_val == ""
}

# Columnas de partido: entre CASILLAS/CASILLA y la columna de no-registrados.
# Fallback: si no existe NUM_VOTOS_CAN_NREG (e.g. ASAMB_CONST CDMX 2016),
# usa NUM_VOTOS_NULOS como límite derecho.
columnas_partido <- function(cols) {
  cols_up  <- toupper(trimws(cols))
  idx_cas  <- which(cols_up %in% c("CASILLAS", "CASILLA"))
  idx_nreg <- which(cols_up %in% c("NUM_VOTOS_CAN_NREG", "NO_REGISTRADOS"))
  if (length(idx_nreg) == 0) {
    # Fallback para archivos sin columna de no-registrados (ASAMB_CONST)
    idx_nreg <- which(cols_up %in% c("NUM_VOTOS_NULOS", "NUM_VOTOS_VALIDOS"))
  }
  if (length(idx_cas) == 0 || length(idx_nreg) == 0) return(character(0))
  cols[(idx_cas[1] + 1):(idx_nreg[1] - 1)]
}

# Elimina todas las secuencias BOM (EF BB BF) de un vector de bytes crudos.
quitar_bom_raw <- function(raw) {
  bom <- as.raw(c(0xef, 0xbb, 0xbf))
  if (length(raw) < 3L) return(raw)
  n <- length(raw) - 2L
  es_bom <- raw[seq_len(n)] == bom[1] &
            raw[seq_len(n) + 1L] == bom[2] &
            raw[seq_len(n) + 2L] == bom[3]
  if (!any(es_bom)) return(raw)
  excl <- rep(FALSE, length(raw))
  for (i in which(es_bom)) excl[i:(i + 2L)] <- TRUE
  raw[!excl]
}

# Lee un CSV/TSV con manejo robusto de BOM y encoding UTF-8.
# Opera en bytes: lee crudo, quita BOMs, convierte a texto UTF-8 y parsea.
# Auto-detección de separador: tab (ZAC 2016 ordinario) o coma (resto).
# - Elimina columnas duplicadas (conserva primera aparición)
# - Elimina columnas con nombre vacío o NA
leer_csv <- function(ruta) {
  sz <- file.info(ruta)$size
  if (is.na(sz) || sz == 0L) return(NULL)

  raw <- readBin(ruta, "raw", n = sz)
  raw_clean <- quitar_bom_raw(raw)

  if (length(raw_clean) < length(raw)) {
    n_bom <- (length(raw) - length(raw_clean)) %/% 3L
    message("  AVISO: ", n_bom, " BOM(s) eliminado(s) en ", basename(ruta))
  }

  # Convert raw bytes to text.
  # Files WITH a UTF-8 BOM are already UTF-8 — use rawToChar directly.
  # Files WITHOUT a BOM are assumed Latin-1/Windows-1252 (older INE sources);
  # re-encode them from latin1 to UTF-8 so norm_texto() can strip accents.
  had_bom <- length(raw_clean) < length(raw)
  texto_tmp <- rawToChar(raw_clean)
  if (had_bom) {
    texto <- texto_tmp
  } else {
    texto <- tryCatch(
      iconv(paste(rawToChar(raw_clean, multiple = TRUE), collapse = ""),
            from = "latin1", to = "UTF-8", sub = ""),
      error = function(e) texto_tmp
    )
    if (is.na(texto) || nchar(texto, type = "bytes") == 0L) texto <- texto_tmp
  }

  # Auto-detect separator: ZAC 2016 ordinary files use tabs instead of commas
  primera_linea <- strsplit(texto, "\n", fixed = TRUE)[[1]][1]
  sep <- if (grepl("\t", primera_linea, fixed = TRUE)) "\t" else ","
  if (sep == "\t") message("  AVISO: separador TAB detectado en ", basename(ruta))

  df <- tryCatch(
    suppressWarnings(
      read.csv(textConnection(texto), check.names = FALSE,
               stringsAsFactors = FALSE, sep = sep)
    ),
    error = function(e) NULL
  )
  if (is.null(df) || nrow(df) == 0L) return(NULL)

  # Eliminar columnas con nombre vacío o NA
  ok <- !is.na(names(df)) & trimws(names(df)) != ""
  if (any(!ok)) {
    message("  AVISO: ", sum(!ok), " columna(s) sin nombre en ", basename(ruta))
    df <- df[, ok]
  }

  # Eliminar columnas duplicadas
  if (any(duplicated(names(df)))) {
    dups <- names(df)[duplicated(names(df))]
    message("  AVISO: Columnas duplicadas en ", basename(ruta), ": ",
            paste(unique(dups), collapse = ", "))
    df <- df[, !duplicated(names(df))]
  }
  df
}

# Corrige nombres de municipios/distritos con '?' producidos por archivos INE
# cuya codificación original (Windows-1252) fue corrompida antes de llegar al
# pipeline. Los reemplazos están verificados contra el catálogo INEGI.
# Formato: patrón (regex) → corrección definitiva (ya normalizada, sin acentos).
CORRECCIONES_NOMBRES <- c(
  # --- Estado de México --------------------------------------------------
  "ACAMBAY DE RUIZ CASTA\\?EDA"       = "ACAMBAY DE RUIZ CASTANEDA",
  "ALMOLOYA DE JU\\?REZ"              = "ALMOLOYA DE JUAREZ",
  "ALMOLOYA DEL R\\?O"                = "ALMOLOYA DEL RIO",
  "ATIZAP\\?N DE ZARAGOZA"            = "ATIZAPAN DE ZARAGOZA",
  "ATIZAP\\?N"                        = "ATIZAPAN",
  "CHIMALHUAC\\?N"                    = "CHIMALHUACAN",
  "COACALCO DE BERRIOZ\\?BAL"         = "COACALCO DE BERRIOZABAL",
  "COCOTITL\\?N"                      = "COCOTITLAN",
  "CUAUTITL\\?N IZCALLI"              = "CUAUTITLAN IZCALLI",
  "CUAUTITL\\?N"                      = "CUAUTITLAN",
  "JOCOTITL\\?N"                      = "JOCOTITLAN",
  "NAUCALPAN DE JU\\?REZ"             = "NAUCALPAN DE JUAREZ",
  "NEZAHUALC\\?YOTL"                  = "NEZAHUALCOYOTL",
  "NICOL\\?S ROMERO"                  = "NICOLAS ROMERO",
  "POLOTITL\\?N"                      = "POLOTITLAN",
  "RAY\\?N"                           = "RAYON",
  "SAN JOS\\? DEL RINC\\?N"           = "SAN JOSE DEL RINCON",
  "SAN MART\\?N DE LAS PIR\\?MIDES"   = "SAN MARTIN DE LAS PIRAMIDES",
  "SAN SIM\\?N DE GUERRERO"           = "SAN SIMON DE GUERRERO",
  "SANTO TOM\\?S"                     = "SANTO TOMAS",
  "SOYANIQUILPAN DE JU\\?REZ"         = "SOYANIQUILPAN DE JUAREZ",
  "TEC\\?MAC"                         = "TECAMAC",
  "TEOTIHUAC\\?N"                     = "TEOTIHUACAN",
  "TEPOTZOTL\\?N"                     = "TEPOTZOTLAN",
  "TEXCALTITL\\?N"                    = "TEXCALTITLAN",
  "TULTITL\\?N"                       = "TULTITLAN",
  "VILLA DEL CARB\\?N"                = "VILLA DEL CARBON",
  "XONACATL\\?N"                      = "XONACATLAN",
  "ZUMPAHUAC\\?N"                     = "ZUMPAHUACAN"
)

patch_nombres_corruptos <- function(x) {
  for (patron in names(CORRECCIONES_NOMBRES)) {
    x <- gsub(patron, CORRECCIONES_NOMBRES[[patron]], x, perl = TRUE)
  }
  x
}

# ------------------------------------------------------------------------------
# 4. PROCESAMIENTO DE UN ARCHIVO
# ------------------------------------------------------------------------------

procesar_archivo <- function(ruta_archivo, es_ext) {

  info_cargo <- detectar_cargo_y_principio(ruta_archivo)
  if (is.null(info_cargo)) {
    message("  AVISO: Cargo no reconocido en ", dirname(ruta_archivo), " — omitido")
    return(NULL)
  }

  df_raw <- leer_csv(ruta_archivo)
  if (is.null(df_raw)) {
    message("  ERROR leyendo ", basename(ruta_archivo))
    return(NULL)
  }

  # Normalize column names: strip accented vowels and uppercase.
  # Some INE files use SECCIÓN (with accent) instead of SECCION.
  col_nms <- toupper(trimws(names(df_raw)))
  col_nms <- gsub("Á", "A", col_nms, fixed = TRUE)
  col_nms <- gsub("É", "E", col_nms, fixed = TRUE)
  col_nms <- gsub("Í", "I", col_nms, fixed = TRUE)
  col_nms <- gsub("Ó", "O", col_nms, fixed = TRUE)
  col_nms <- gsub("Ú", "U", col_nms, fixed = TRUE)
  names(df_raw) <- col_nms

  cols_partido <- columnas_partido(names(df_raw))
  cve_tipo_val <- if (es_ext) 2L else 1L
  tipo_val     <- if (es_ext) "EXTRAORDINARIA" else "ORDINARIA"

  # Columna de sección: SECCION (2015/2021) o SECCIONES (TLAX PRES_COM 2016)
  col_sec <- names(df_raw)[toupper(trimws(names(df_raw))) %in%
                 c("SECCION", "SECCIONES")][1]
  if (is.na(col_sec)) {
    message("  AVISO: Columna SECCION no encontrada en ", basename(ruta_archivo))
    col_sec <- "SECCION"
  }

  # Normalizar nombre de columna de cabecera
  # Acepta: CABECERA_DISTRITAL (2015/2017), CABECERA_DISTRITAL_LOCAL (2021),
  # COMUNIDAD (TLAX PRES_COM 2016), DEMARCACION_TERRITORIAL (NAY REG 2017)
  col_cab <- names(df_raw)[toupper(trimws(names(df_raw))) %in%
               c("CABECERA_DISTRITAL", "CABECERA DISTRITAL",
                 "CABECERA_DISTRITAL_LOCAL", "COMUNIDAD",
                 "DEMARCACION_TERRITORIAL")][1]
  if (is.na(col_cab)) {
    message("  AVISO: Columna CABECERA_DISTRITAL no encontrada en ", basename(ruta_archivo))
    col_cab <- NA_character_
  }

  # Columna de ID de distrito: ID_DISTRITO (2015/2017), ID_DISTRITO_LOCAL (2021),
  # ID_COMUNIDAD (TLAX PRES_COM 2016), ID_DEMARCACION_TERRITORIAL (NAY REG 2017)
  col_dist_id <- names(df_raw)[toupper(trimws(names(df_raw))) %in%
                   c("ID_DISTRITO", "ID_DISTRITO_LOCAL",
                     "ID_COMUNIDAD", "ID_DEMARCACION_TERRITORIAL")][1]
  if (is.na(col_dist_id)) col_dist_id <- "ID_DISTRITO"

  # Columna de votos no registrados (varía por fuente INE o está ausente)
  col_no_reg <- names(df_raw)[toupper(trimws(names(df_raw))) %in%
                   c("NUM_VOTOS_CAN_NREG", "NO_REGISTRADOS")][1]
  # col_no_reg puede ser NA (ASAMB_CONST no tiene esta columna)

  # Columna de clave de municipio: ID_MUNICIPIO (2015/2021) o ausente (TLAX PRES_COM)
  col_mun_id <- names(df_raw)[toupper(trimws(names(df_raw))) %in%
                   c("ID_MUNICIPIO")][1]
  # col_mun_id puede ser NA (TLAX PRES_COM usa ID_COMUNIDAD para cve_del, sin municipio)

  # Columna de nombre de municipio: MUNICIPIO (2015/2021) o ausente (TLAX PRES_COM)
  col_mun_nom <- names(df_raw)[toupper(trimws(names(df_raw))) %in%
                    c("MUNICIPIO")][1]
  # col_mun_nom puede ser NA (TLAX PRES_COM: usa COMUNIDAD como unidad geográfica base)

  # Construir df de salida fila por fila (mutate)
  df_out <- df_raw %>%
    mutate(
      .seccion_int = suppressWarnings(as.integer(.data[[col_sec]])),
    ) %>%
    filter(!is.na(.seccion_int), .seccion_int > 0) %>%
    mutate(
      anio          = ANIO,
      cve_ambito    = 2L,
      ambito        = "LOCAL",
      cve_tipo      = cve_tipo_val,
      tipo          = tipo_val,
      cve_principio = info_cargo$cve_principio,
      principio     = info_cargo$principio,
      cve_cargo     = info_cargo$cve_cargo,
      cargo         = info_cargo$cargo_label,
      cve_estado    = suppressWarnings(as.integer(.data[["ID_ESTADO"]])),
      estado        = norm_texto(toupper(trimws(.data[["NOMBRE_ESTADO"]]))),
      cve_del       = suppressWarnings(as.integer(.data[[col_dist_id]])),
      cabecera      = if (!is.na(col_cab)) patch_nombres_corruptos(paste0(
        sprintf("%02d", suppressWarnings(as.integer(.data[["ID_ESTADO"]]))),
        sprintf("%02d", suppressWarnings(as.integer(.data[[col_dist_id]]))),
        " ",
        norm_texto(toupper(trimws(.data[[col_cab]])))
      )) else paste0(
        sprintf("%02d", suppressWarnings(as.integer(.data[["ID_ESTADO"]]))),
        sprintf("%02d", suppressWarnings(as.integer(.data[[col_dist_id]])))
      ),
      cve_mun       = if (!is.na(col_mun_id))
                        suppressWarnings(as.integer(.data[[col_mun_id]]))
                      else 0L,
      municipio     = if (!is.na(col_mun_nom))
                        patch_nombres_corruptos(norm_texto(toupper(trimws(.data[[col_mun_nom]]))))
                      else if (!is.na(col_cab))
                        patch_nombres_corruptos(norm_texto(toupper(trimws(.data[[col_cab]]))))
                      else NA_character_,
      seccion       = .seccion_int,
      no_reg        = if (!is.na(col_no_reg))
                        suppressWarnings(as.integer(.data[[col_no_reg]]))
                      else 0L,
      vot_nul       = suppressWarnings(as.integer(.data[["NUM_VOTOS_NULOS"]])),
      total_votos   = suppressWarnings(as.integer(.data[["TOTAL_VOTOS"]])),
      lne           = suppressWarnings(as.integer(.data[["LISTA_NOMINAL"]])),
      part_ciud     = ifelse(
        !is.na(suppressWarnings(as.integer(.data[["LISTA_NOMINAL"]]))) &
        suppressWarnings(as.integer(.data[["LISTA_NOMINAL"]])) > 0,
        round(suppressWarnings(as.integer(.data[["TOTAL_VOTOS"]])) /
              suppressWarnings(as.integer(.data[["LISTA_NOMINAL"]])) * 100, 2),
        0
      )
    ) %>%
    select(
      anio, cve_ambito, ambito, cve_tipo, tipo, cve_principio, principio,
      cve_cargo, cargo, cve_estado, estado, cve_del, cabecera,
      cve_mun, municipio, seccion,
      all_of(cols_partido),
      no_reg, vot_nul, total_votos, lne, part_ciud
    )

  attr(df_out, "cargo_key") <- info_cargo$cargo_key
  df_out
}

# ------------------------------------------------------------------------------
# 5. ESCANEO RECURSIVO Y ACUMULACIÓN
# ------------------------------------------------------------------------------

ruta_pel <- file.path(RUTA_PREP, paste0("PEL_", ANIO))
if (!dir.exists(ruta_pel)) stop("No existe la carpeta: ", ruta_pel)

# Buscar todos los archivos con sufijos reconocidos de forma recursiva.
# TLAX PRES_COM usa _COMUN.csv / _COMUN_EXT.csv (no _SEC.csv).
todos_sec <- list.files(ruta_pel, pattern = "\\.(csv)$",
                        recursive = TRUE, full.names = TRUE, ignore.case = TRUE)

# Filtrar: _SEC.csv, _SEC_EXT.csv, _COMUN.csv, _COMUN_EXT.csv
SUFIJOS_OK <- "_SEC\\.CSV$|_SEC_EXT\\.CSV$|_COMUN\\.CSV$|_COMUN_EXT\\.CSV$"
todos_sec <- todos_sec[str_detect(toupper(basename(todos_sec)), SUFIJOS_OK)]

# Aplicar filtro de entidades si se especificó
if (!is.null(ENTIDADES_FILTRO) && length(ENTIDADES_FILTRO) > 0) {
  patron_entidades <- paste0("/(", paste(toupper(ENTIDADES_FILTRO), collapse = "|"), ")_PEL")
  todos_sec <- todos_sec[str_detect(toupper(todos_sec), patron_entidades)]
}

cat("Archivos _SEC encontrados:", length(todos_sec), "\n")
for (f in todos_sec) cat(" -", str_replace(f, ruta_pel, paste0("PEL_", ANIO)), "\n")

# Acumulador por cargo_key
acum <- list()

for (ruta_archivo in todos_sec) {
  ruta_rel <- str_replace(ruta_archivo, paste0(ruta_pel, "/"), "")

  # Extraordinaria si el nombre del archivo termina _SEC_EXT.csv / _COMUN_EXT.csv
  # O si la ruta contiene _PEL_EXT_ (e.g. COL_PEL_EXT_2016, TLAX_PEL_EXT_2017)
  es_ext <- str_detect(toupper(basename(ruta_archivo)), "_(SEC|COMUN)_EXT\\.CSV$") ||
            str_detect(toupper(ruta_rel), "_PEL_EXT_")

  cat("\nProcesando:", ruta_rel, "(EXT:", es_ext, ")\n")

  df_proc <- tryCatch(
    procesar_archivo(ruta_archivo, es_ext),
    error = function(e) {
      message("  ERROR en ", basename(ruta_archivo), ": ", e$message)
      NULL
    }
  )
  if (is.null(df_proc)) next

  cargo_key    <- attr(df_proc, "cargo_key")
  # Extrae clave del estado desde el primer segmento de la ruta relativa:
  # e.g. "CHIS_PEL_2016/..." → "chis"
  # e.g. "CDMX_ASAMB_CONST_2016/..." → "cdmx"
  estado_clave <- tolower(str_match(ruta_rel, "^([A-Z]+)_(?:PEL|ASAMB)")[, 2])
  llave        <- paste0(estado_clave, "_pel_", cargo_key, "_", ANIO)
  if (is.null(acum[[llave]])) acum[[llave]] <- list()
  acum[[llave]] <- append(acum[[llave]], list(df_proc))
}

# ------------------------------------------------------------------------------
# 6. COMBINAR Y GUARDAR
# ------------------------------------------------------------------------------

if (length(acum) == 0) {
  cat("\nNo se procesó ningún archivo. Revisa la ruta y los filtros.\n")
  quit(status = 1)
}

dir_salida <- file.path(RUTA_SALIDA, paste0("pel_", ANIO))
if (!dir.exists(dir_salida)) dir.create(dir_salida, recursive = TRUE)

cat("\n--- RESULTADOS ---\n")
for (llave in names(acum)) {
  frames <- acum[[llave]]

  # bind_rows rellena con NA columnas que no existen en todos los estados
  df_total <- bind_rows(frames) %>%
    mutate(Id = row_number()) %>%
    select(Id, everything())

  nombre_csv <- paste0(llave, ".csv")
  ruta_dest  <- file.path(dir_salida, nombre_csv)
  write.csv(df_total, ruta_dest, row.names = FALSE, fileEncoding = "UTF-8", na = "")

  cat(nombre_csv, "—", nrow(df_total), "filas,", ncol(df_total), "columnas\n")

  # Mostrar primeras columnas fijas + primeros 3 partidos + últimas 5
  n <- ncol(df_total)
  cols_muestra <- unique(c(names(df_total)[1:min(18, n)], names(df_total)[max(1, n-4):n]))
  cat("  Columnas:", paste(cols_muestra, collapse = ", "), "\n")

  # Verificación rápida: contar tipos
  tabla_tipo <- table(df_total$tipo)
  cat("  Tipos:", paste(names(tabla_tipo), tabla_tipo, sep = "=", collapse = "; "), "\n")
}

cat("\n--- PIPELINE FINALIZADO ---\n")
