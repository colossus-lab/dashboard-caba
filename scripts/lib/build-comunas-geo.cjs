/**
 * build-comunas-geo.cjs — descarga el GeoJSON oficial de Comunas de CABA
 * desde el portal de datos abiertos GCBA, lo simplifica (reduce precisión
 * de coordenadas) y lo guarda en `public/data/caba-comunas.geojson`.
 *
 * El componente MapaCABA carga este archivo directamente (sin TopoJSON).
 * Solo se ejecuta si el archivo destino no existe o es más viejo de 30 días.
 *
 * Uso: node scripts/lib/build-comunas-geo.cjs
 */

const fs = require("fs");
const https = require("https");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DEST = path.join(ROOT, "public", "data", "caba-comunas.geojson");
const SEED = path.join(__dirname, "..", "assets", "caba-comunas.geojson");
const URL = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-educacion/comunas/comunas.geojson";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

function roundCoords(coords, digits = 5) {
  const factor = 10 ** digits;
  if (typeof coords[0] === "number") {
    return [Math.round(coords[0] * factor) / factor, Math.round(coords[1] * factor) / factor];
  }
  return coords.map((c) => roundCoords(c, digits));
}

function pickComunaProperty(props) {
  // GCBA dataset usually has "COMUNAS" (number) or "comuna" (string) property
  const keys = Object.keys(props || {});
  const k = keys.find((x) => /^comunas?$/i.test(x));
  if (!k) return null;
  const v = props[k];
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n)) return null;
  return String(n).padStart(2, "0");
}

function normalize(geo) {
  // Keep only Polygon/MultiPolygon features with a recognizable comuna ID,
  // and reduce to minimal properties: { comuna: "01"..."15", nombre: "Comuna N" }
  const features = [];
  for (const f of geo.features || []) {
    if (!f.geometry || !["Polygon", "MultiPolygon"].includes(f.geometry.type)) continue;
    const id = pickComunaProperty(f.properties);
    if (!id) continue;
    features.push({
      type: "Feature",
      properties: {
        comuna: id,
        nombre: `Comuna ${parseInt(id, 10)}`,
      },
      geometry: {
        type: f.geometry.type,
        coordinates: roundCoords(f.geometry.coordinates),
      },
    });
  }
  features.sort((a, b) => a.properties.comuna.localeCompare(b.properties.comuna));
  return { type: "FeatureCollection", features };
}

async function main() {
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.mkdirSync(path.dirname(SEED), { recursive: true });

  if (fs.existsSync(DEST)) {
    const ageMs = Date.now() - fs.statSync(DEST).mtimeMs;
    if (ageMs < 30 * 24 * 3600 * 1000) {
      console.log(`  ✅ ${path.relative(ROOT, DEST)} ya existe (${(ageMs / 86400000).toFixed(0)}d). Skip.`);
      return;
    }
  }

  let raw = null;
  try {
    console.log(`  ⬇️  Descargando comunas de GCBA...`);
    raw = await fetchText(URL);
    console.log(`     ${raw.length} bytes`);
  } catch (err) {
    console.warn(`  ⚠️  Descarga falló (${err.message}). Probando seed local...`);
    if (fs.existsSync(SEED)) {
      raw = fs.readFileSync(SEED, "utf8");
    } else {
      throw new Error("Sin GeoJSON: descarga falló y no hay seed en scripts/assets/");
    }
  }

  const geo = JSON.parse(raw);
  const norm = normalize(geo);
  if (norm.features.length !== 15) {
    console.warn(`  ⚠️  ${norm.features.length} features (se esperaban 15)`);
  }

  fs.writeFileSync(DEST, JSON.stringify(norm));
  console.log(`  ✅ ${path.relative(ROOT, DEST)} (${norm.features.length} comunas, ${fs.statSync(DEST).size} bytes)`);

  // Cache seed for offline rebuilds
  if (!fs.existsSync(SEED)) {
    fs.writeFileSync(SEED, raw);
    console.log(`  💾 Seed cacheado en ${path.relative(ROOT, SEED)}`);
  }
}

main().catch((err) => {
  console.error(`  ❌ ${err.message}`);
  process.exit(1);
});
