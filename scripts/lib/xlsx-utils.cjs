/**
 * xlsx-utils.cjs — helpers de lectura de XLSX del Censo INDEC
 *
 * Patrón típico de los Cuadros N.1 del Censo (CABA + 15 comunas):
 *   filas 0-1 : títulos
 *   filas 2-4 : encabezados multinivel (merged)
 *   fila ~4-5 : Total CABA (código "02")
 *   filas siguientes (15) : una por comuna (códigos "02007"..."02105")
 */

const path = require("path");
const XLSX = require("xlsx");
const { toNumber } = require("./formatters.cjs");
const { COMUNAS_CABA, isTotalCaba, getComunaByCodigo } = require("./geo-comunas.cjs");

function readWorkbook(filePath) {
  return XLSX.readFile(filePath, { cellDates: false });
}

// Normalize sheet name for matching: collapse NBSP and other Unicode whitespace
// to a regular space, then trim.
function normalizeSheetName(s) {
  return String(s).replace(/[\s ]+/g, " ").trim();
}

function readSheetRows(filePath, sheetName) {
  const wb = readWorkbook(filePath);
  let ws = null;
  if (sheetName) {
    ws = wb.Sheets[sheetName];
    if (!ws) {
      // Tolerant lookup: match by normalized name (handles NBSP and case)
      const target = normalizeSheetName(sheetName).toLowerCase();
      const found = wb.SheetNames.find(n => normalizeSheetName(n).toLowerCase() === target);
      if (found) ws = wb.Sheets[found];
    }
  } else {
    ws = wb.Sheets[wb.SheetNames[0]];
  }
  if (!ws) {
    throw new Error(
      `Sheet not found: "${sheetName}" in ${path.basename(filePath)} (available: ${wb.SheetNames.map(n => `"${n}"`).join(", ")})`
    );
  }
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });
}

/**
 * Extrae la fila Total CABA y las 15 filas por comuna de un Cuadro N.1.
 * Detecta automáticamente la fila "Total CABA" buscando la primera fila
 * cuya celda 0 sea "02" o cuya celda 1 contenga "Ciudad Autónoma" o "Total".
 *
 * Devuelve: { total: row, comunas: [{ comuna, row }, ...] }
 */
function extractCabaTable(rows) {
  let totalRow = null;
  const comunaRows = [];

  for (const r of rows) {
    if (!r || r.length === 0) continue;
    const c0 = r[0];
    const c1 = r[1];

    // Total CABA: code "02" (sin sufijo) o "Ciudad Autónoma..." en c1
    if (totalRow == null) {
      if (isTotalCaba(c0)) { totalRow = r; continue; }
      if (typeof c1 === "string" && /Ciudad Aut/i.test(c1)) { totalRow = r; continue; }
      if (typeof c0 === "string" && /^Total$/i.test(c0.trim())) { totalRow = r; continue; }
    }

    // Comuna: código que matchea (con o sin leading zero)
    const comuna = getComunaByCodigo(c0);
    if (comuna) {
      comunaRows.push({ comuna, row: r });
    }
  }

  return { total: totalRow, comunas: comunaRows };
}

/**
 * Para hojas tabuladas por edad (Cuadro 2.1 de salud, prevision_c4, fecundidad por edad, etc).
 * Detecta la fila "Total" y luego filas con grupos quinquenales o edades simples.
 * Devuelve: { total: row, byAge: [{ ageLabel, row }, ...] }
 */
function extractAgeTable(rows) {
  let totalRow = null;
  const byAge = [];
  const ageRe = /^\d+(\s*-\s*\d+)?$|^100\s*y\s*m[áa]s$|^100\+$/i;

  for (const r of rows) {
    if (!r || r.length === 0) continue;
    const c0 = r[0];
    if (typeof c0 === "string") {
      const s = c0.trim();
      if (totalRow == null && /^Total$/i.test(s)) { totalRow = r; continue; }
      if (ageRe.test(s)) byAge.push({ ageLabel: s, row: r });
    }
  }

  return { total: totalRow, byAge };
}

/**
 * Lee el Cuadro 1.1 de un archivo (CABA + 15 comunas).
 */
function readCabaCuadro(filePath, sheetName = "Cuadro 1.1") {
  const rows = readSheetRows(filePath, sheetName);
  return extractCabaTable(rows);
}

/**
 * Suma "verticalmente" — toma una columna y devuelve el total numérico
 * de las filas indicadas (descarta nulos / "///").
 */
function sumColumn(rows, colIdx) {
  let s = 0;
  for (const r of rows) {
    const v = toNumber(r?.[colIdx]);
    if (v != null) s += v;
  }
  return s;
}

module.exports = {
  readWorkbook,
  readSheetRows,
  readCabaCuadro,
  extractCabaTable,
  extractAgeTable,
  sumColumn,
  COMUNAS_CABA,
};
