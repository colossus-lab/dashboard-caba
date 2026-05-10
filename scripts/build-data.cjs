/**
 * build-data.cjs
 *
 * Orquestador del pipeline de datos.
 *
 * Skipea automáticamente cuando los XLSX fuente no están disponibles
 * (caso típico: build en Vercel/CI donde `1- Poblacion/` está
 * gitignoreado y los JSON/MD ya vienen committeados en `public/`).
 *
 * Uso: node scripts/build-data.cjs
 */

const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const SCRIPTS_DIR = __dirname;
const ROOT = path.resolve(SCRIPTS_DIR, "..");
const RAW_DIR = path.join(ROOT, "1- Poblacion");
const PUBLIC_DATA = path.join(ROOT, "public", "data", "poblacion");

// Skip si no hay XLSX fuente. Solo abortamos si tampoco existen los outputs:
// significa que es un build sin fuente y sin datos pre-generados.
if (!fs.existsSync(RAW_DIR)) {
  const hasOutputs = fs.existsSync(PUBLIC_DATA) && fs.readdirSync(PUBLIC_DATA).some(f => f.endsWith(".json"));
  if (hasOutputs) {
    console.log("ℹ️  build-data: fuentes XLSX no disponibles, usando JSON/MD pre-generados en public/. Skip.");
    process.exit(0);
  }
  console.error("❌ build-data: fuentes XLSX no encontradas y tampoco hay outputs en public/data/poblacion/.");
  console.error("   Para generar localmente: clonar XLSX a `1- Poblacion/` y ejecutar `npm run build-data`.");
  process.exit(1);
}

const PIPELINE = [
  // Generate / refresh CABA comunas GeoJSON for the choropleth map
  "lib/build-comunas-geo.cjs",
  // Census data processing — generates 8 JSON + 8 MD
  "generate-report-data.cjs",
];

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║       Dashboard CABA — Census Data Build Pipeline       ║");
console.log("╚══════════════════════════════════════════════════════════╝");

const start = Date.now();
let failed = 0;

for (const script of PIPELINE) {
  const scriptPath = path.join(SCRIPTS_DIR, script);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Running: ${script}`);
  console.log("═".repeat(60));
  try {
    execSync(`node "${scriptPath}"`, { stdio: "inherit" });
  } catch (err) {
    console.error(`  ❌ FAILED: ${script}`);
    failed++;
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n${"═".repeat(60)}`);
if (failed === 0) {
  console.log(`  ✅ All ${PIPELINE.length} scripts completed in ${elapsed}s`);
} else {
  console.log(`  ⚠️  ${failed} script(s) failed out of ${PIPELINE.length} — ${elapsed}s`);
  process.exit(1);
}
console.log("═".repeat(60));
