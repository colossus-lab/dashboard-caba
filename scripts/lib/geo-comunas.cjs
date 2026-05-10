/**
 * geo-comunas.cjs — catálogo de las 15 comunas de CABA.
 *
 * Códigos INDEC (departamento dentro de CABA): "02007" a "02105", paso de 7.
 * El total CABA usa el código "02".
 */

const COMUNAS_CABA = [
  { id: "01", codigoIndec: "02007", nombre: "Comuna 1",  barrios: ["Constitución", "Monserrat", "Puerto Madero", "Retiro", "San Nicolás", "San Telmo"] },
  { id: "02", codigoIndec: "02014", nombre: "Comuna 2",  barrios: ["Recoleta"] },
  { id: "03", codigoIndec: "02021", nombre: "Comuna 3",  barrios: ["Balvanera", "San Cristóbal"] },
  { id: "04", codigoIndec: "02028", nombre: "Comuna 4",  barrios: ["Barracas", "Boca", "Nueva Pompeya", "Parque Patricios"] },
  { id: "05", codigoIndec: "02035", nombre: "Comuna 5",  barrios: ["Almagro", "Boedo"] },
  { id: "06", codigoIndec: "02042", nombre: "Comuna 6",  barrios: ["Caballito"] },
  { id: "07", codigoIndec: "02049", nombre: "Comuna 7",  barrios: ["Flores", "Parque Chacabuco"] },
  { id: "08", codigoIndec: "02056", nombre: "Comuna 8",  barrios: ["Villa Lugano", "Villa Riachuelo", "Villa Soldati"] },
  { id: "09", codigoIndec: "02063", nombre: "Comuna 9",  barrios: ["Liniers", "Mataderos", "Parque Avellaneda"] },
  { id: "10", codigoIndec: "02070", nombre: "Comuna 10", barrios: ["Floresta", "Monte Castro", "Vélez Sarsfield", "Versalles", "Villa Luro", "Villa Real"] },
  { id: "11", codigoIndec: "02077", nombre: "Comuna 11", barrios: ["Villa Devoto", "Villa del Parque", "Villa General Mitre", "Villa Santa Rita"] },
  { id: "12", codigoIndec: "02084", nombre: "Comuna 12", barrios: ["Coghlan", "Saavedra", "Villa Pueyrredón", "Villa Urquiza"] },
  { id: "13", codigoIndec: "02091", nombre: "Comuna 13", barrios: ["Belgrano", "Colegiales", "Núñez"] },
  { id: "14", codigoIndec: "02098", nombre: "Comuna 14", barrios: ["Palermo"] },
  { id: "15", codigoIndec: "02105", nombre: "Comuna 15", barrios: ["Agronomía", "Chacarita", "Parque Chas", "Paternal", "Villa Crespo", "Villa Ortúzar"] },
];

const TOTAL_CABA_CODIGO = "02";

const byCodigoIndec = new Map(COMUNAS_CABA.map(c => [c.codigoIndec, c]));
const byId = new Map(COMUNAS_CABA.map(c => [c.id, c]));

function getComunaByCodigo(code) {
  if (code == null) return null;
  // Normalize: pad to 5 digits if numeric (XLSX often loses leading zero)
  let s = String(code).trim();
  if (/^\d+$/.test(s)) s = s.padStart(5, "0");
  return byCodigoIndec.get(s) || null;
}

function isTotalCaba(code) {
  if (code == null) return false;
  const s = String(code).trim();
  return s === "02" || s === "2";
}

function normalizeComunaName(name) {
  return String(name || "")
    .toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  COMUNAS_CABA,
  TOTAL_CABA_CODIGO,
  getComunaByCodigo,
  isTotalCaba,
  normalizeComunaName,
  byId,
};
