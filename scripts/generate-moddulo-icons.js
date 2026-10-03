// scripts/generate-moddulo-icons.js
const fs = require("fs");
const path = require("path");

const iconsDir = path.join(process.cwd(), "public", "icons", "moddulo");

// Crear directorio si no existe
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log("📁 Directorio creado:", iconsDir);
}

// Paleta de colores Eskemma
const colors = {
  bluegreen: "#026988",
  blue: "#248cc1",
  orange: "#db6015",
  green: "#649941",
  red: "#d10f3f",
};

// Definición de todos los íconos (25 SVGs)
const icons = {
  // ========== TIER BASIC (8 apps) ==========

  "crm.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <circle cx="32" cy="24" r="6" stroke="${colors.bluegreen}" stroke-width="2.5"/>
  <path d="M20 44c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="${colors.bluegreen}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="48" cy="20" r="4" fill="${colors.orange}"/>
</svg>`,

  "dashboard.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <rect x="18" y="18" width="12" height="12" rx="2" fill="${colors.bluegreen}"/>
  <rect x="34" y="18" width="12" height="12" rx="2" fill="${colors.blue}" opacity="0.6"/>
  <rect x="18" y="34" width="12" height="12" rx="2" fill="${colors.blue}" opacity="0.6"/>
  <rect x="34" y="34" width="12" height="12" rx="2" fill="${colors.bluegreen}"/>
</svg>`,

  "calendario.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <rect x="16" y="20" width="32" height="28" rx="3" stroke="${colors.bluegreen}" stroke-width="2.5"/>
  <line x1="16" y1="28" x2="48" y2="28" stroke="${colors.bluegreen}" stroke-width="2.5"/>
  <line x1="24" y1="16" x2="24" y2="24" stroke="${colors.bluegreen}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="40" y1="16" x2="40" y2="24" stroke="${colors.bluegreen}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="24" cy="36" r="2" fill="${colors.orange}"/>
  <circle cx="32" cy="36" r="2" fill="${colors.bluegreen}"/>
  <circle cx="40" cy="36" r="2" fill="${colors.bluegreen}"/>
</svg>`,

  "presupuesto.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.green}" opacity="0.1"/>
  <circle cx="32" cy="32" r="14" stroke="${colors.green}" stroke-width="2.5"/>
  <path d="M32 22v20M26 28h12M26 36h12" stroke="${colors.green}" stroke-width="2.5" stroke-linecap="round"/>
</svg>`,

  "foda.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <rect x="18" y="18" width="13" height="13" fill="${colors.bluegreen}"/>
  <rect x="33" y="18" width="13" height="13" fill="${colors.blue}" opacity="0.6"/>
  <rect x="18" y="33" width="13" height="13" fill="${colors.orange}" opacity="0.6"/>
  <rect x="33" y="33" width="13" height="13" fill="${colors.green}" opacity="0.6"/>
  <text x="24.5" y="26" fill="white" font-size="10" font-weight="bold" text-anchor="middle">F</text>
  <text x="39.5" y="26" fill="white" font-size="10" font-weight="bold" text-anchor="middle">O</text>
  <text x="24.5" y="41" fill="white" font-size="10" font-weight="bold" text-anchor="middle">D</text>
  <text x="39.5" y="41" fill="white" font-size="10" font-weight="bold" text-anchor="middle">A</text>
</svg>`,

  "metricas.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.blue}" opacity="0.1"/>
  <path d="M16 44L24 32L32 38L40 24L48 32" stroke="${colors.blue}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="24" cy="32" r="3" fill="${colors.blue}"/>
  <circle cx="32" cy="38" r="3" fill="${colors.bluegreen}"/>
  <circle cx="40" cy="24" r="3" fill="${colors.orange}"/>
</svg>`,

  "informe-diario.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <rect x="20" y="16" width="24" height="32" rx="2" stroke="${colors.bluegreen}" stroke-width="2.5"/>
  <line x1="26" y1="24" x2="38" y2="24" stroke="${colors.bluegreen}" stroke-width="2"/>
  <line x1="26" y1="30" x2="38" y2="30" stroke="${colors.blue}" stroke-width="2" opacity="0.6"/>
  <line x1="26" y1="36" x2="34" y2="36" stroke="${colors.blue}" stroke-width="2" opacity="0.6"/>
</svg>`,

  // ========== TIER PREMIUM (8 apps exclusivas) ==========
  "centro-escucha.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.orange}" opacity="0.1"/>
  <path d="M32 16v32M24 24l8-8 8 8M24 40l8 8 8-8" stroke="${colors.orange}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="32" r="6" stroke="${colors.orange}" stroke-width="2.5"/>
</svg>`,

  "email-marketing.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.blue}" opacity="0.1"/>
  <rect x="14" y="22" width="36" height="24" rx="2" stroke="${colors.blue}" stroke-width="2.5"/>
  <path d="M14 24l18 12 18-12" stroke="${colors.blue}" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`,

  "estratega.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.orange}" opacity="0.1"/>
  <path d="M32 16L40 28H24L32 16Z" fill="${colors.orange}"/>
  <circle cx="22" cy="40" r="4" stroke="${colors.orange}" stroke-width="2"/>
  <circle cx="42" cy="40" r="4" stroke="${colors.orange}" stroke-width="2"/>
  <path d="M28 28L22 36M36 28L42 36" stroke="${colors.orange}" stroke-width="2"/>
</svg>`,

  "sintesis.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <rect x="18" y="20" width="28" height="6" rx="1" fill="${colors.bluegreen}"/>
  <rect x="18" y="29" width="28" height="6" rx="1" fill="${colors.blue}" opacity="0.6"/>
  <rect x="18" y="38" width="20" height="6" rx="1" fill="${colors.blue}" opacity="0.4"/>
  <circle cx="44" cy="41" r="6" fill="${colors.orange}"/>
  <text x="44" y="44" fill="white" font-size="8" font-weight="bold" text-anchor="middle">AI</text>
</svg>`,


  "crm-premium.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.orange}" opacity="0.1"/>
  <circle cx="32" cy="24" r="6" stroke="${colors.orange}" stroke-width="2.5"/>
  <path d="M20 44c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="${colors.orange}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="48" cy="20" r="6" fill="${colors.orange}"/>
  <text x="48" y="23" fill="white" font-size="7" font-weight="bold" text-anchor="middle">ML</text>
</svg>`,

  "dashboard-premium.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.orange}" opacity="0.1"/>
  <rect x="18" y="18" width="12" height="12" rx="2" fill="${colors.orange}"/>
  <rect x="34" y="18" width="12" height="12" rx="2" fill="${colors.orange}" opacity="0.6"/>
  <rect x="18" y="34" width="12" height="12" rx="2" fill="${colors.orange}" opacity="0.6"/>
  <rect x="34" y="34" width="12" height="12" rx="2" fill="${colors.orange}"/>
  <circle cx="46" cy="18" r="4" fill="${colors.orange}"/>
  <text x="46" y="20" fill="white" font-size="5" font-weight="bold" text-anchor="middle">AI</text>
</svg>`,

  "calendario-premium.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.orange}" opacity="0.1"/>
  <rect x="16" y="20" width="32" height="28" rx="3" stroke="${colors.orange}" stroke-width="2.5"/>
  <line x1="16" y1="28" x2="48" y2="28" stroke="${colors.orange}" stroke-width="2.5"/>
  <line x1="24" y1="16" x2="24" y2="24" stroke="${colors.orange}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="40" y1="16" x2="40" y2="24" stroke="${colors.orange}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="32" cy="38" r="6" fill="${colors.orange}"/>
  <path d="M30 38l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`,

  // ========== TIER PROFESSIONAL (9 apps exclusivas) ==========
  "monitor-redes.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.green}" opacity="0.1"/>
  <circle cx="32" cy="32" r="12" stroke="${colors.green}" stroke-width="2"/>
  <circle cx="18" cy="22" r="4" fill="${colors.green}"/>
  <circle cx="46" cy="22" r="4" fill="${colors.green}"/>
  <circle cx="18" cy="42" r="4" fill="${colors.green}"/>
  <circle cx="46" cy="42" r="4" fill="${colors.green}"/>
  <path d="M22 24l8 6M42 24l-8 6M22 40l8-6M42 40l-8-6" stroke="${colors.green}" stroke-width="2"/>
</svg>`,

  "sala-crisis.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.red}" opacity="0.1"/>
  <circle cx="32" cy="32" r="14" stroke="${colors.red}" stroke-width="2.5"/>
  <path d="M32 24v10M32 38v2" stroke="${colors.red}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="20" stroke="${colors.red}" stroke-width="1" stroke-dasharray="4 4"/>
</svg>`,

  "territorio.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.green}" opacity="0.1"/>
  <path d="M32 16C26 16 22 20 22 26c0 8 10 22 10 22s10-14 10-22c0-6-4-10-10-10z" stroke="${colors.green}" stroke-width="2.5"/>
  <circle cx="32" cy="26" r="4" fill="${colors.green}"/>
</svg>`,

  "chatbot.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <rect x="18" y="20" width="28" height="24" rx="4" stroke="${colors.bluegreen}" stroke-width="2.5"/>
  <circle cx="26" cy="32" r="2" fill="${colors.bluegreen}"/>
  <circle cx="32" cy="32" r="2" fill="${colors.bluegreen}"/>
  <circle cx="38" cy="32" r="2" fill="${colors.bluegreen}"/>
  <path d="M28 44l4-4 4 4" stroke="${colors.bluegreen}" stroke-width="2" stroke-linecap="round"/>
</svg>`,

  "brigada-app.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.green}" opacity="0.1"/>
  <rect x="20" y="16" width="24" height="32" rx="3" stroke="${colors.green}" stroke-width="2.5"/>
  <circle cx="32" cy="26" r="4" stroke="${colors.green}" stroke-width="2"/>
  <path d="M24 38c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="${colors.green}" stroke-width="2"/>
  <circle cx="44" cy="20" r="4" fill="${colors.orange}"/>
</svg>`,

  "rival.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.orange}" opacity="0.1"/>
  <circle cx="24" cy="28" r="6" stroke="${colors.orange}" stroke-width="2"/>
  <circle cx="40" cy="28" r="6" stroke="${colors.bluegreen}" stroke-width="2"/>
  <path d="M16 44c0-4.4 3.6-8 8-8s8 3.6 8 8M32 44c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="${colors.bluegreen}" stroke-width="2"/>
</svg>`,

  "retrospectiva.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.blue}" opacity="0.1"/>
  <circle cx="32" cy="32" r="14" stroke="${colors.blue}" stroke-width="2.5"/>
  <path d="M32 20v12l8 4" stroke="${colors.blue}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M20 32h-4M48 32h4M32 20v-4M32 48v-4" stroke="${colors.blue}" stroke-width="2" stroke-linecap="round"/>
</svg>`,

  "prensa.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <rect x="16" y="20" width="32" height="28" rx="2" stroke="${colors.bluegreen}" stroke-width="2.5"/>
  <rect x="20" y="24" width="12" height="8" fill="${colors.blue}" opacity="0.4"/>
  <line x1="34" y1="26" x2="44" y2="26" stroke="${colors.bluegreen}" stroke-width="2"/>
  <line x1="34" y1="30" x2="44" y2="30" stroke="${colors.blue}" stroke-width="1.5" opacity="0.6"/>
  <line x1="20" y1="36" x2="44" y2="36" stroke="${colors.blue}" stroke-width="1.5" opacity="0.4"/>
  <line x1="20" y1="40" x2="38" y2="40" stroke="${colors.blue}" stroke-width="1.5" opacity="0.4"/>
</svg>`,

  "roi.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.green}" opacity="0.1"/>
  <path d="M16 40L28 28L36 34L48 20" stroke="${colors.green}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M40 20h8v8" stroke="${colors.green}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="28" cy="28" r="3" fill="${colors.green}"/>
  <circle cx="36" cy="34" r="3" fill="${colors.bluegreen}"/>
</svg>`,

  // ========== DEFAULT ==========
  "default.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="28" fill="${colors.bluegreen}" opacity="0.1"/>
  <rect x="20" y="20" width="24" height="24" rx="4" stroke="${colors.bluegreen}" stroke-width="2.5"/>
  <path d="M28 32l4 4 8-8" stroke="${colors.bluegreen}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
};

// Generar todos los archivos SVG
let successCount = 0;
let errorCount = 0;

console.log("\n🎨 Generando íconos SVG para Moddulo...\n");

Object.entries(icons).forEach(([filename, svgContent]) => {
  try {
    const filePath = path.join(iconsDir, filename);
    const cleanSVG = svgContent.trim();

    fs.writeFileSync(filePath, cleanSVG, "utf8");
    console.log(`✅ ${filename}`);
    successCount++;
  } catch (err) {
    // ✅ CORRECCIÓN: Tipar el error explícitamente
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`❌ Error creando ${filename}:`, errorMessage);
    errorCount++;
  }
});

console.log(`\n${"=".repeat(50)}`);
console.log(`🎉 Generación completada!`);
console.log(`✅ Exitosos: ${successCount}`);
if (errorCount > 0) {
  console.log(`❌ Errores: ${errorCount}`);
}
console.log(`📁 Ubicación: ${iconsDir}`);
console.log(`${"=".repeat(50)}\n`);
