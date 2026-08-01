/**
 * scripts/verify-fontana-compendio-parse.ts
 * Verificación puntual: confirma que pdf-parse (v2, API PDFParse.getText)
 * extrae correctamente el porcentaje de superficie estatal de los 2 PDFs
 * reales ya descargados del Compendio de Información Geográfica
 * Municipal 2010 (INEGI). Script temporal de verificación, no parte del
 * producto — mismo regex que usa lib/fontana/ingesta/compendio.ts.
 */

import fs from "fs";

async function main() {
  const { PDFParse } = await import("pdf-parse");
  const files = [
    "info_geo_eske/inegi_compendio_geografico_municipal/compendio_14039_guadalajara_2010.pdf",
    "info_geo_eske/inegi_compendio_geografico_municipal/compendio_14120_zapopan_2010.pdf",
  ];
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    const match = result.text.match(/Ocupa\s+el\s+([\d.]+)%\s+de\s+la\s+superficie\s+del\s+estado/i);
    console.log(f.split("/").pop(), "->", match ? match[0].replace(/\s+/g, " ") : "NO MATCH", "| longitud texto:", result.text.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
