/**
 * generate-report-data.cjs
 *
 * Genera los 8 data.json + 8 .md de los informes censales de CABA
 * a partir de los XLSX en `1- Poblacion/`.
 *
 * Output:
 *   public/data/poblacion/<slug>.json
 *   public/reports/poblacion/<slug>.md
 *
 * Uso: node scripts/generate-report-data.cjs
 */

const fs = require("fs");
const path = require("path");

const { ReportBuilder, slugify } = require("./lib/report-builder.cjs");
const { buildReportMd } = require("./lib/markdown-builder.cjs");
const { readSheetRows, extractCabaTable } = require("./lib/xlsx-utils.cjs");
const { readCsv } = require("./lib/csv-utils.cjs");
const { COMUNAS_CABA } = require("./lib/geo-comunas.cjs");
const {
  toNumber, formatInteger, formatDecimal, formatPercent, formatCompact,
} = require("./lib/formatters.cjs");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DATA = path.join(ROOT, "public", "data");
const PUBLIC_REPORTS = path.join(ROOT, "public", "reports");
const DATA_DIR = path.join(PUBLIC_DATA, "poblacion");
const REPORTS_DIR = path.join(PUBLIC_REPORTS, "poblacion");
const RAW_DIR = path.join(ROOT, "1- Poblacion");
const SEC_DIR = path.join(ROOT, "2- Seguridad");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const SOURCE = "Censo Nacional de Población, Hogares y Viviendas 2022 (INDEC)";
const PERIOD = "2022";
const SOURCE_SNIC = "SNIC — Sistema Nacional de Información Criminal (Ministerio de Seguridad de la Nación)";

// Para que findChartsForSection (ReportView.tsx) matchee, todos los charts/rankings
// usan sectionId = slugify(sectionTitle), y el markdown produce `## sectionTitle`.

function persist(slug, data, md) {
  fs.writeFileSync(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(data, null, 2));
  fs.writeFileSync(path.join(REPORTS_DIR, `${slug}.md`), md);
  console.log(`  ✅ ${slug}.json (${data.kpis.length} KPIs, ${data.charts.length} charts, ${data.rankings.length} rankings, ${data.mapData.length} map items)`);
}

// ═══════════════════════════════════════════════════════════════
// 1. Estructura por sexo y edad
// ═══════════════════════════════════════════════════════════════
function generateEstructura() {
  const slug = "estructura";
  const folder = path.join(RAW_DIR, "1- Estructura por sexo y edad de la población");
  const file = path.join(folder, "c2022_caba_est_c1_1.xlsx");
  const fileDens = path.join(folder, "c2022_caba_est_c2_1.xlsx");
  const fileEdad = path.join(folder, "c2022_caba_est_c4_1.xlsx");
  const fileMediana = path.join(folder, "c2022_caba_est_c6_1.xlsx");

  const fileSexo = path.join(folder, "c2022_caba_est_c3_1.xlsx");

  const { total, comunas } = extractCabaTable(readSheetRows(file, "Cuadro 1.1"));
  const dens = extractCabaTable(readSheetRows(fileDens, "Cuadro 2.1"));
  const mediana = extractCabaTable(readSheetRows(fileMediana, "Cuadro 6.1"));
  const sexoRows = readSheetRows(fileSexo, "Cuadro 3.1");

  const totalPob2022 = toNumber(total[3]);
  const totalVarAbs = toNumber(total[4]);
  const totalVarPct = toNumber(total[5]);

  // Densidad cols: 0=Código, 1=Comuna, 2=Superficie km², 3=Pob, 4=Densidad hab/km²
  const dTot = dens.total.map(toNumber);
  const densCABA = dTot[4];
  const supCABA = dTot[2];

  // Mediana cols: 0=Código, 1=Comuna, 2=Edad mediana total, 3=Mujeres, 4=Varones
  const mTot = mediana.total.map(toNumber);
  const edadMedianaCABA = mTot[2];

  const builder = new ReportBuilder("poblacion-estructura")
    .setMeta({
      title: "Estructura por Sexo y Edad",
      subcategory: "Estructura",
      source: SOURCE,
      date: PERIOD,
    })
    .addKPI({ id: "pob-total-2022", label: "Población total CABA (2022)", value: totalPob2022, formatted: formatCompact(totalPob2022), unit: "hab." })
    .addKPI({ id: "densidad", label: "Densidad poblacional", value: densCABA, formatted: formatInteger(densCABA), unit: "hab./km²" })
    .addKPI({ id: "edad-mediana", label: "Edad mediana", value: edadMedianaCABA, formatted: formatInteger(edadMedianaCABA), unit: "años" })
    .addKPI({ id: "var-pct", label: "Crecimiento decenal", value: totalVarPct, formatted: formatPercent(totalVarPct), comparison: "respecto a 2010" })
    .addKPI({ id: "superficie", label: "Superficie", value: supCABA, formatted: formatDecimal(supCABA, 1), unit: "km²" })
    .addKPI({ id: "var-abs", label: "Variación absoluta vs 2010", value: totalVarAbs, formatted: formatInteger(totalVarAbs), unit: "hab." });

  // Chart: pob por comuna
  const sectionPob = "Población por Comuna";
  const sidPob = slugify(sectionPob);
  builder.addChart({
    id: "bar-pob-comuna",
    type: "bar",
    title: "Población 2022 por comuna",
    sectionId: sidPob,
    sectionTitle: sectionPob,
    data: comunas.map(({ comuna, row }) => ({
      comuna: comuna.nombre,
      Población: toNumber(row[3]) || 0,
    })),
    config: { xAxis: "comuna", yAxis: "Población", layout: "vertical" },
  });

  // Chart: variación %
  const sectionVar = "Crecimiento Decenal";
  const sidVar = slugify(sectionVar);
  builder.addChart({
    id: "bar-var-comuna",
    type: "bar",
    title: "Variación % de población 2010-2022",
    sectionId: sidVar,
    sectionTitle: sectionVar,
    data: comunas.map(({ comuna, row }) => ({
      comuna: comuna.nombre,
      "Variación %": toNumber(row[5]) || 0,
    })),
    config: { xAxis: "comuna", yAxis: "Variación %", layout: "vertical" },
  });

  // Chart: densidad por comuna
  const sectionDens = "Densidad Poblacional";
  const sidDens = slugify(sectionDens);
  builder.addChart({
    id: "bar-densidad-comuna",
    type: "bar",
    title: "Densidad poblacional por comuna (hab./km²)",
    sectionId: sidDens,
    sectionTitle: sectionDens,
    data: dens.comunas.map(({ comuna, row }) => ({
      comuna: comuna.nombre,
      "Densidad": toNumber(row[4]) || 0,
    })),
    config: { xAxis: "comuna", yAxis: "Densidad" },
  });

  // Chart: pirámide poblacional (de est_c4)
  const sectionPiramide = "Pirámide Poblacional";
  const sidPiramide = slugify(sectionPiramide);
  const rowsEdad = readSheetRows(fileEdad, "Cuadro 4.1");
  // Cols: 0=Edad, 1=Total, 2=Mujeres, 3=Varones, 4=Índice feminidad
  // Tomar grupos quinquenales (filas con "X-Y" pattern)
  const piramideData = [];
  for (const r of rowsEdad) {
    if (!r) continue;
    const c0 = String(r[0] || "").trim();
    if (/^\d+-\d+$/.test(c0) || /^100\s*y\s*m[áa]s$/i.test(c0)) {
      piramideData.push({
        grupo: c0,
        Mujeres: -(toNumber(r[2]) || 0),  // negativo para que aparezca a la izquierda
        Varones: toNumber(r[3]) || 0,
      });
    }
  }
  builder.addChart({
    id: "piramide-poblacional",
    type: "pyramid",
    title: "Pirámide poblacional — CABA",
    sectionId: sidPiramide,
    sectionTitle: sectionPiramide,
    data: piramideData,
    config: { xAxis: "grupo", layout: "horizontal" },
  });

  // Chart: edad mediana por comuna
  const sectionMediana = "Edad Mediana por Comuna";
  const sidMediana = slugify(sectionMediana);
  builder.addChart({
    id: "bar-edad-mediana",
    type: "bar",
    title: "Edad mediana por comuna",
    sectionId: sidMediana,
    sectionTitle: sectionMediana,
    data: mediana.comunas.map(({ comuna, row }) => ({
      comuna: comuna.nombre,
      "Edad mediana": toNumber(row[2]) || 0,
    })),
    config: { xAxis: "comuna", yAxis: "Edad mediana" },
  });

  // Chart: composición vivienda particular vs colectiva (de est_c3, fila Total)
  // Cols: 0=Sexo, 1=Total, 2=Pob viv. particulares, 3=Viv. colectivas, 4=Calle
  const sectionTipoResid = "Tipo de Residencia";
  const sidTipoResid = slugify(sectionTipoResid);
  const sexoTotalRow = sexoRows.find(r => r && typeof r[0] === "string" && /^Total$/i.test(r[0].trim()));
  const sT = (sexoTotalRow || []).map(toNumber);
  builder.addChart({
    id: "pie-tipo-residencia",
    type: "pie",
    title: "Tipo de residencia — CABA",
    sectionId: sidTipoResid,
    sectionTitle: sectionTipoResid,
    data: [
      { id: "Vivienda particular",  label: "Vivienda particular",  value: sT[2] },
      { id: "Vivienda colectiva",   label: "Vivienda colectiva",   value: sT[3] },
      { id: "Situación de calle",   label: "Situación de calle",   value: sT[4] },
    ].filter(d => d.value > 0),
  });

  // Chart: índice de feminidad por edad (de est_c4 col 4)
  const sectionFem = "Índice de Feminidad por Edad";
  const sidFem = slugify(sectionFem);
  const femData = [];
  for (const r of rowsEdad) {
    const c0 = String(r?.[0] || "").trim();
    if (!/^\d+-\d+$/.test(c0) && !/^100\s*y\s*m[áa]s$/i.test(c0)) continue;
    const idx = toNumber(r[4]);
    if (idx != null) femData.push({ edad: c0, "Índice feminidad": idx });
  }
  builder.addChart({
    id: "line-feminidad",
    type: "line",
    title: "Índice de feminidad por grupo de edad — CABA",
    sectionId: sidFem,
    sectionTitle: sectionFem,
    data: femData,
    config: { xAxis: "edad", yAxis: "Mujeres por cada 100 varones" },
  });

  // Rankings
  const sortedByPob = [...comunas].sort((a, b) => (toNumber(b.row[3]) || 0) - (toNumber(a.row[3]) || 0));
  builder.addRanking({
    id: "rank-pob",
    title: "Comunas más pobladas",
    sectionId: sidPob,
    items: sortedByPob.map(({ comuna, row }) => ({
      name: comuna.nombre,
      value: toNumber(row[3]) || 0,
      municipioId: comuna.id,
    })),
    order: "desc",
  });

  const sortedByVar = [...comunas].sort((a, b) => (toNumber(b.row[5]) || 0) - (toNumber(a.row[5]) || 0));
  builder.addRanking({
    id: "rank-var",
    title: "Comunas con mayor crecimiento",
    sectionId: sidVar,
    items: sortedByVar.map(({ comuna, row }) => ({
      name: comuna.nombre,
      value: toNumber(row[5]) || 0,
      municipioId: comuna.id,
    })),
    order: "desc",
  });

  const sortedByDens = [...dens.comunas].sort((a, b) => (toNumber(b.row[4]) || 0) - (toNumber(a.row[4]) || 0));
  builder.addRanking({
    id: "rank-densidad",
    title: "Comunas con mayor densidad",
    sectionId: sidDens,
    items: sortedByDens.map(({ comuna, row }) => ({
      name: comuna.nombre,
      value: toNumber(row[4]) || 0,
      municipioId: comuna.id,
    })),
    order: "desc",
  });

  const sortedByMediana = [...mediana.comunas].sort((a, b) => (toNumber(b.row[2]) || 0) - (toNumber(a.row[2]) || 0));
  builder.addRanking({
    id: "rank-mediana",
    title: "Comunas con población más envejecida",
    sectionId: sidMediana,
    items: sortedByMediana.map(({ comuna, row }) => ({
      name: comuna.nombre,
      value: toNumber(row[2]) || 0,
      municipioId: comuna.id,
    })),
    order: "desc",
  });

  // mapData: pob por comuna
  for (const { comuna, row } of comunas) {
    const v = toNumber(row[3]) || 0;
    builder.addMapItem({
      municipioId: comuna.id,
      municipioNombre: comuna.nombre,
      value: v,
      label: `${formatInteger(v)} hab.`,
    });
  }

  const data = builder.build();
  const md = buildReportMd({
    ...data,
    intro: `La Ciudad Autónoma de Buenos Aires alcanzó **${formatInteger(totalPob2022)} habitantes** en 2022 sobre ${formatDecimal(supCABA, 1)} km², con una densidad de **${formatInteger(densCABA)} hab./km²** y una edad mediana de **${formatInteger(edadMedianaCABA)} años**. El crecimiento del **${formatPercent(totalVarPct)}** vs. 2010 muestra dinámicas heterogéneas entre comunas.`,
    sectionNarratives: {
      [sidPob]: `La población se distribuye en 15 comunas de tamaños diversos. La comuna más poblada concentra ${formatPercent((toNumber(sortedByPob[0].row[3]) || 0) / totalPob2022 * 100)} del total de la Ciudad.`,
      [sidVar]: `Algunas comunas crecieron por encima del promedio de la Ciudad (${formatPercent(totalVarPct)}), mientras otras registraron variaciones negativas, evidenciando dinámicas demográficas locales.`,
      [sidDens]: `La densidad promedio (${formatInteger(densCABA)} hab./km²) oculta una marcada heterogeneidad: las comunas centrales superan los 25.000 hab./km², mientras que las del sur, con superficies más extensas, presentan densidades sensiblemente menores.`,
      [sidPiramide]: `La pirámide poblacional muestra una estructura típica de transición demográfica avanzada: base estrecha por baja fecundidad, ensanchamiento en edades adultas y peso significativo de la población mayor de 60 años, particularmente entre mujeres.`,
      [sidMediana]: `La edad mediana de **${formatInteger(edadMedianaCABA)} años** ubica a CABA entre las jurisdicciones más envejecidas del país. La diferencia entre comunas refleja perfiles distintos: las del norte tienden a poblaciones más adultas, mientras que las del sur concentran familias más jóvenes.`,
      [sidTipoResid]: `La amplísima mayoría reside en viviendas particulares. La población en viviendas colectivas (geriátricos, hogares estudiantiles, hospitales, conventos, hoteles) y en situación de calle constituye una fracción minoritaria pero socialmente relevante.`,
      [sidFem]: `El índice de feminidad muestra cuántas mujeres hay por cada 100 varones. La curva refleja un patrón típico: paridad al nacer y juventud, con creciente predominio femenino a partir de edades medias y especialmente en la población mayor —resultado de la mayor esperanza de vida femenina.`,
    },
  });
  persist(slug, data, md);
}

// ═══════════════════════════════════════════════════════════════
// 2. Habitacional Personas — combustible para cocinar (pob_c4)
// ═══════════════════════════════════════════════════════════════
function generateHabitacionalPersonas() {
  const slug = "habitacional-personas";
  const folder = path.join(RAW_DIR, "2- Condiciones habitacionales de la población");
  const file = path.join(folder, "c2022_caba_pob_c4_1.xlsx");
  const fileMat = path.join(folder, "c2022_caba_pob_c1_1.xlsx");
  const fileAgua = path.join(folder, "c2022_caba_pob_c2_1.xlsx");
  const fileCloaca = path.join(folder, "c2022_caba_pob_c3_1.xlsx");
  const fileHab = path.join(folder, "c2022_caba_pob_c5_1.xlsx");
  const fileTenencia = path.join(folder, "c2022_caba_pob_c6_1.xlsx");
  const fileNet = path.join(folder, "c2022_caba_pob_c7_1.xlsx");

  const { total, comunas } = extractCabaTable(readSheetRows(file, "Cuadro 4.1"));
  const tenencia = extractCabaTable(readSheetRows(fileTenencia, "Cuadro 6"));

  // Lectura helpers para hojas categóricas (sin comunas)
  const matRows = readSheetRows(fileMat, "Cuadro 1.1");
  const aguaRows = readSheetRows(fileAgua, "Cuadro 2.1");
  const cloacaRows = readSheetRows(fileCloaca, "Cuadro 3.1");
  const habRows = readSheetRows(fileHab, "Cuadro 5.1");
  const netRows = readSheetRows(fileNet, "Cuadro 7.1");
  const findTotal = (rows) => rows.find(r => r && typeof r[0] === "string" && /^Total$/i.test(r[0].trim()));
  const matTotal = (findTotal(matRows) || []).map(toNumber);
  const aguaTotal = (findTotal(aguaRows) || []).map(toNumber);
  const cloacaTotal = (findTotal(cloacaRows) || []).map(toNumber);
  const habTotal = (findTotal(habRows) || []).map(toNumber);
  const netTotal = (findTotal(netRows) || []).map(toNumber);

  // Cols: 0=Código, 1=Comuna, 2=Pob, 3=Electricidad, 4=Gas red, 5=Gas zeppelin,
  //       6=Gas garrafa, 7=Leña, 8=Otro
  const tot = total.map(toNumber);
  const pobTot = tot[2];
  const gasRedPct = (tot[4] / pobTot) * 100;
  const gasGarrafaPct = (tot[6] / pobTot) * 100;
  const electricidadPct = (tot[3] / pobTot) * 100;

  // pob_c2 (agua): col 1=Total, 2=Cañería dentro, 3=Fuera vivienda, 4=Fuera terreno
  const aguaPobTot = aguaTotal[1];
  const caneriaDentroPct = (aguaTotal[2] / aguaPobTot) * 100;

  // pob_c7 (internet): col 1=Pob, 2=Internet total, 5=Sin internet total
  const netPobTot = netTotal[1];
  const conInternetPct = (netTotal[2] / netPobTot) * 100;
  const sinInternetPct = (netTotal[5] / netPobTot) * 100;

  // pob_c6 tenencia: 0=Código, 1=Comuna, 2=Pob, 3=Propia Total, 4=Escritura, 5=Boleto,
  //                  6=Otra doc, 7=Sin doc, 8=Alquilada, 9=Cedida trabajo, 10=Prestada, 11=Otra
  const teTot = tenencia.total.map(toNumber);
  const propiaPersPct = (teTot[3] / teTot[2]) * 100;
  const alquilPersPct = (teTot[8] / teTot[2]) * 100;

  const builder = new ReportBuilder("poblacion-habitacional-personas")
    .setMeta({
      title: "Condiciones Habitacionales de la Población",
      subcategory: "Hábitat Personas",
      source: SOURCE,
      date: PERIOD,
    })
    .addKPI({ id: "pob-cubierta", label: "Población en viviendas particulares", value: pobTot, formatted: formatCompact(pobTot), unit: "hab." })
    .addKPI({ id: "gas-red", label: "Cocina con gas de red", value: gasRedPct, formatted: formatPercent(gasRedPct) })
    .addKPI({ id: "gas-garrafa", label: "Cocina con gas en garrafa", value: gasGarrafaPct, formatted: formatPercent(gasGarrafaPct), status: gasGarrafaPct > 10 ? "warning" : undefined })
    .addKPI({ id: "agua-canio", label: "Agua por cañería dentro de la vivienda", value: caneriaDentroPct, formatted: formatPercent(caneriaDentroPct) })
    .addKPI({ id: "internet", label: "Vive en hogar con internet", value: conInternetPct, formatted: formatPercent(conInternetPct) })
    .addKPI({ id: "propia-pers", label: "Vive en vivienda propia", value: propiaPersPct, formatted: formatPercent(propiaPersPct) })
    .addKPI({ id: "alquila-pers", label: "Vive en vivienda alquilada", value: alquilPersPct, formatted: formatPercent(alquilPersPct) })
    .addKPI({ id: "electricidad", label: "Cocina con electricidad", value: electricidadPct, formatted: formatPercent(electricidadPct) });

  // Chart: distribución combustible CABA (pie)
  const sectionDist = "Distribución de Combustibles";
  const sidDist = slugify(sectionDist);
  builder.addChart({
    id: "pie-combustible",
    type: "pie",
    title: "Combustible para cocinar — CABA",
    sectionId: sidDist,
    sectionTitle: sectionDist,
    data: [
      { id: "Gas de red",      label: "Gas de red",      value: tot[4] },
      { id: "Electricidad",    label: "Electricidad",    value: tot[3] },
      { id: "Gas en garrafa",  label: "Gas en garrafa",  value: tot[6] },
      { id: "Gas zeppelin",    label: "Gas zeppelin",    value: tot[5] },
      { id: "Leña o carbón",   label: "Leña o carbón",   value: tot[7] },
      { id: "Otro",            label: "Otro",            value: tot[8] },
    ].filter(d => d.value > 0),
  });

  // Chart: gas de red por comuna
  const sectionAccess = "Acceso al Gas de Red por Comuna";
  const sidAccess = slugify(sectionAccess);
  builder.addChart({
    id: "bar-gas-red-comuna",
    type: "bar",
    title: "% de población con gas de red por comuna",
    sectionId: sidAccess,
    sectionTitle: sectionAccess,
    data: comunas.map(({ comuna, row }) => {
      const r = row.map(toNumber);
      const pct = (r[4] / r[2]) * 100;
      return { comuna: comuna.nombre, "Gas de red %": Math.round(pct * 10) / 10 };
    }),
    config: { xAxis: "comuna", yAxis: "Gas de red %" },
  });

  // Ranking: comunas con mayor gas garrafa (vulnerabilidad)
  const ranked = comunas.map(({ comuna, row }) => {
    const r = row.map(toNumber);
    return { comuna, value: (r[6] / r[2]) * 100 };
  }).sort((a, b) => b.value - a.value);

  builder.addRanking({
    id: "rank-garrafa",
    title: "Comunas con mayor uso de gas en garrafa",
    sectionId: sidAccess,
    items: ranked.map(r => ({
      name: r.comuna.nombre,
      value: Math.round(r.value * 10) / 10,
      municipioId: r.comuna.id,
    })),
    order: "desc",
  });

  // Map: % gas de red por comuna
  for (const { comuna, row } of comunas) {
    const r = row.map(toNumber);
    const pct = (r[4] / r[2]) * 100;
    builder.addMapItem({
      municipioId: comuna.id,
      municipioNombre: comuna.nombre,
      value: Math.round(pct * 10) / 10,
      label: `${formatPercent(pct)} con gas de red`,
    });
  }

  // Chart: materiales de piso (pob_c1) — pie con cols 2..5 fila Total
  const sectionMat = "Materiales de Piso";
  const sidMat = slugify(sectionMat);
  builder.addChart({
    id: "pie-piso",
    type: "pie",
    title: "Material predominante de los pisos — CABA",
    sectionId: sidMat,
    sectionTitle: sectionMat,
    data: [
      { id: "Cerámica/Mosaico/Madera", label: "Cerámica/Mosaico/Madera", value: matTotal[2] },
      { id: "Carpeta/Contrapiso",      label: "Carpeta/Contrapiso",      value: matTotal[3] },
      { id: "Tierra/Ladrillo suelto",  label: "Tierra/Ladrillo suelto",  value: matTotal[4] },
      { id: "Otro material",           label: "Otro material",           value: matTotal[5] },
    ].filter(d => d.value > 0),
  });

  // Chart: procedencia del agua (pob_c2) — primeras 4 filas no-Total
  const sectionAgua = "Procedencia del Agua";
  const sidAgua = slugify(sectionAgua);
  const aguaCategorias = [];
  for (const r of aguaRows) {
    const c0 = String(r?.[0] || "").trim();
    if (!c0 || /^Total$/i.test(c0) || c0.startsWith("(") || c0.startsWith("Cuadro") || c0.startsWith("Censo")) continue;
    if (c0 === "Procedencia del agua") continue;
    const v = toNumber(r[1]);
    if (v != null && v > 0) aguaCategorias.push({ id: c0.slice(0, 38), label: c0.slice(0, 38), value: v });
    if (aguaCategorias.length >= 5) break;
  }
  builder.addChart({
    id: "pie-agua",
    type: "pie",
    title: "Procedencia del agua — CABA",
    sectionId: sidAgua,
    sectionTitle: sectionAgua,
    data: aguaCategorias,
  });

  // Chart: brecha digital (pob_c7) — internet sí/no
  const sectionDigital = "Brecha Digital";
  const sidDigital = slugify(sectionDigital);
  builder.addChart({
    id: "pie-internet",
    type: "pie",
    title: "Acceso a internet en la vivienda — CABA",
    sectionId: sidDigital,
    sectionTitle: sectionDigital,
    data: [
      { id: "Internet + dispositivo",   label: "Internet + dispositivo",   value: netTotal[3] },
      { id: "Internet sin dispositivo", label: "Internet sin dispositivo", value: netTotal[4] },
      { id: "Sin internet",             label: "Sin internet",             value: netTotal[5] },
    ].filter(d => d.value > 0),
  });

  // Chart: tenencia (personas) por comuna
  const sectionTenenciaPers = "Tenencia de la Vivienda (Personas)";
  const sidTenenciaPers = slugify(sectionTenenciaPers);
  builder.addChart({
    id: "bar-tenencia-personas-comuna",
    type: "bar",
    title: "% personas en vivienda propia vs alquilada — por comuna",
    sectionId: sidTenenciaPers,
    sectionTitle: sectionTenenciaPers,
    data: tenencia.comunas.map(({ comuna, row }) => {
      const r = row.map(toNumber);
      return {
        comuna: comuna.nombre,
        "Propia %":     Math.round((r[3] / r[2]) * 1000) / 10,
        "Alquilada %":  Math.round((r[8] / r[2]) * 1000) / 10,
      };
    }),
    config: { xAxis: "comuna", yAxis: "%", grouped: true },
  });

  // Chart: cantidad de habitaciones (pob_c5) — pie con filas 1,2,3,4,5+
  const sectionHabPers = "Cantidad de Habitaciones";
  const sidHabPers = slugify(sectionHabPers);
  const habCategorias = [];
  for (const r of habRows) {
    const c0 = String(r?.[0] || "").trim();
    if (!c0 || /^Total$/i.test(c0) || c0.startsWith("(") || c0.startsWith("Cuadro") || c0.startsWith("Censo") || c0 === "Cantidad de habitaciones") continue;
    const v = toNumber(r[1]);
    if (v != null && v > 0) habCategorias.push({ id: c0.slice(0, 20), label: c0.slice(0, 20), value: v });
    if (habCategorias.length >= 8) break;
  }
  builder.addChart({
    id: "pie-habitaciones",
    type: "pie",
    title: "Cantidad de habitaciones de la vivienda — CABA",
    sectionId: sidHabPers,
    sectionTitle: sectionHabPers,
    data: habCategorias,
  });

  // Chart: desagüe cloacal (pob_c3) — pie ubicación del baño (cols 3,4,5 fila Total)
  const sectionCloacaPers = "Saneamiento";
  const sidCloacaPers = slugify(sectionCloacaPers);
  builder.addChart({
    id: "pie-cloaca-personas",
    type: "pie",
    title: "Ubicación del baño — CABA",
    sectionId: sidCloacaPers,
    sectionTitle: sectionCloacaPers,
    data: [
      { id: "Dentro de la vivienda",   label: "Dentro de la vivienda",   value: cloacaTotal[3] },
      { id: "Fuera de la vivienda",    label: "Fuera de la vivienda",    value: cloacaTotal[4] },
      { id: "No tiene baño",           label: "No tiene baño",           value: cloacaTotal[5] },
    ].filter(d => d.value > 0),
  });

  const data = builder.build();
  const md = buildReportMd({
    ...data,
    intro: `Las condiciones habitacionales de la población se vinculan a la calidad del acceso a servicios básicos. En CABA, **${formatPercent(gasRedPct)}** de la población cocina con gas de red, **${formatPercent(caneriaDentroPct)}** accede al agua por cañería dentro de la vivienda y **${formatPercent(conInternetPct)}** vive en hogares con conexión a internet, con marcadas diferencias entre comunas.`,
    sectionNarratives: {
      [sidDist]: `La matriz energética doméstica muestra el predominio del gas de red, complementado por electricidad y, en menor medida, garrafa.`,
      [sidAccess]: `La cobertura de gas de red varía significativamente entre comunas. Las comunas del sur registran mayor dependencia de combustibles alternativos, indicador asociado a déficits de infraestructura urbana.`,
      [sidMat]: `La calidad de los materiales constructivos —pisos en particular— es un proxy del estado del stock habitacional. La amplísima mayoría reside en viviendas con pisos de cerámica, mosaico o madera; el remanente con pisos de carpeta, tierra o ladrillo suelto identifica situaciones de vulnerabilidad habitacional.`,
      [sidAgua]: `La provisión de agua potable por red pública alcanza prácticamente a la totalidad de la población. Las pequeñas fracciones con perforaciones u otras fuentes se concentran en barrios populares y zonas con infraestructura precaria.`,
      [sidDigital]: `La brecha digital en CABA se ubica en niveles bajos en términos absolutos, pero esconde diferencias relevantes: la combinación "internet sin dispositivo" identifica hogares conectados solo por celular, situación que limita el aprovechamiento educativo y laboral del recurso.`,
      [sidTenenciaPers]: `La tenencia desde la perspectiva de las personas confirma a CABA como una ciudad con alto peso del alquiler, especialmente en las comunas centro-norte; la propiedad concentra mayoría en comunas del sur, con prevalencia de regularización dominial pendiente.`,
      [sidHabPers]: `El tamaño habitacional efectivo de las viviendas se concentra entre 2 y 4 habitaciones. Las viviendas de 1 habitación (incluyendo monoambientes y pensiones) son numerosas y se asocian a hogares unipersonales o de bajos ingresos.`,
      [sidCloacaPers]: `El acceso a servicios sanitarios dentro de la vivienda es prácticamente universal en CABA. La población con baño fuera de la vivienda o sin baño identifica núcleos de déficit sanitario crítico, concentrados en barrios populares.`,
    },
  });
  persist(slug, data, md);
}

// ═══════════════════════════════════════════════════════════════
// 3. Salud y Previsión Social
// ═══════════════════════════════════════════════════════════════
function generateSaludPrevision() {
  const slug = "salud-prevision";
  const folder = path.join(RAW_DIR, "3- Salud y previsión social");
  const fileSalud = path.join(folder, "c2022_caba_salud_c1_1.xlsx");
  const fileSaludEdad = path.join(folder, "c2022_caba_salud_c2_1.xlsx");
  const filePrev = path.join(folder, "c2022_caba_prevision_c3_1.xlsx");

  const salud = extractCabaTable(readSheetRows(fileSalud, "Cuadro 1.1"));
  const prev = extractCabaTable(readSheetRows(filePrev, "Cuadro 3.1"));
  const saludEdadRows = readSheetRows(fileSaludEdad, "Cuadro 2.1");

  // Salud cols: 0=Código, 1=Comuna, 2=Pob total, 3=Obra social/prepaga, 4=Programas estatales, 5=Sin cobertura
  const sTot = salud.total.map(toNumber);
  const pobTot = sTot[2];
  const conObraPct = (sTot[3] / pobTot) * 100;
  const programasPct = (sTot[4] / pobTot) * 100;
  const sinCobPct = (sTot[5] / pobTot) * 100;

  // Previsión cols: 0=Código, 1=Comuna, 2=Pob, 3=Sí Total, 4=Solo jub, 5=Solo pens, 6=Jub+pens, 7=Solo otra, 8=No
  const pTot = prev.total.map(toNumber);
  const conJubPct = (pTot[3] / pTot[2]) * 100;

  const builder = new ReportBuilder("poblacion-salud-prevision")
    .setMeta({
      title: "Salud y Previsión Social",
      subcategory: "Salud",
      source: SOURCE,
      date: PERIOD,
    })
    .addKPI({ id: "obra-prepaga", label: "Con obra social o prepaga", value: conObraPct, formatted: formatPercent(conObraPct) })
    .addKPI({ id: "programas", label: "Programas o planes estatales", value: programasPct, formatted: formatPercent(programasPct) })
    .addKPI({ id: "sin-cobertura", label: "Sin cobertura de salud", value: sinCobPct, formatted: formatPercent(sinCobPct), status: sinCobPct > 15 ? "critical" : "warning" })
    .addKPI({ id: "con-jub", label: "Percibe jubilación o pensión", value: conJubPct, formatted: formatPercent(conJubPct) });

  // Chart: distribución cobertura CABA (pie)
  const sectionCob = "Tipo de Cobertura";
  const sidCob = slugify(sectionCob);
  builder.addChart({
    id: "pie-cobertura",
    type: "pie",
    title: "Tipo de cobertura de salud — CABA",
    sectionId: sidCob,
    sectionTitle: sectionCob,
    data: [
      { id: "Obra social/Prepaga", label: "Obra social/Prepaga", value: sTot[3] },
      { id: "Programas estatales", label: "Programas estatales", value: sTot[4] },
      { id: "Sin cobertura",       label: "Sin cobertura",       value: sTot[5] },
    ],
  });

  // Chart: % sin cobertura por comuna
  const sectionDesigualdad = "Brechas de Cobertura por Comuna";
  const sidDes = slugify(sectionDesigualdad);
  builder.addChart({
    id: "bar-sin-cob-comuna",
    type: "bar",
    title: "% sin cobertura de salud por comuna",
    sectionId: sidDes,
    sectionTitle: sectionDesigualdad,
    data: salud.comunas.map(({ comuna, row }) => {
      const r = row.map(toNumber);
      return { comuna: comuna.nombre, "Sin cobertura %": Math.round((r[5] / r[2]) * 1000) / 10 };
    }),
    config: { xAxis: "comuna", yAxis: "Sin cobertura %" },
  });

  // Ranking: comunas con mayor % sin cobertura
  const ranked = salud.comunas.map(({ comuna, row }) => {
    const r = row.map(toNumber);
    return { comuna, value: (r[5] / r[2]) * 100 };
  }).sort((a, b) => b.value - a.value);

  builder.addRanking({
    id: "rank-sin-cob",
    title: "Comunas con mayor % sin cobertura",
    sectionId: sidDes,
    items: ranked.map(r => ({
      name: r.comuna.nombre,
      value: Math.round(r.value * 10) / 10,
      municipioId: r.comuna.id,
    })),
    order: "desc",
  });

  // Map: % sin cobertura por comuna
  for (const { comuna, row } of salud.comunas) {
    const r = row.map(toNumber);
    const pct = (r[5] / r[2]) * 100;
    builder.addMapItem({
      municipioId: comuna.id,
      municipioNombre: comuna.nombre,
      value: Math.round(pct * 10) / 10,
      label: `${formatPercent(pct)} sin cobertura`,
    });
  }

  // Chart: % sin cobertura por grupo de edad (de salud_c2)
  // Cols: 0=Edad, 1=Pob, 2=Obra/prepaga, 3=Programas, 4=Sin cobertura
  const sectionEdad = "Cobertura por Grupo de Edad";
  const sidEdad = slugify(sectionEdad);
  const ageRe = /^\d+\s*-\s*\d+$|^100\s*y\s*m[áa]s$/i;
  const edadData = [];
  for (const r of saludEdadRows) {
    const c0 = String(r?.[0] || "").trim();
    if (!ageRe.test(c0)) continue;
    const pob = toNumber(r[1]);
    const sin = toNumber(r[4]);
    if (pob && sin != null) {
      edadData.push({
        edad: c0,
        "Sin cobertura %": Math.round((sin / pob) * 1000) / 10,
        "Con obra social/prepaga %": Math.round((toNumber(r[2]) / pob) * 1000) / 10,
      });
    }
  }
  builder.addChart({
    id: "line-cobertura-edad",
    type: "line",
    title: "Cobertura de salud según grupo de edad — CABA",
    sectionId: sidEdad,
    sectionTitle: sectionEdad,
    data: edadData,
    config: { xAxis: "edad", yAxis: "Porcentaje" },
  });

  const data = builder.build();
  const md = buildReportMd({
    ...data,
    intro: `La cobertura de salud y el sistema previsional reflejan dimensiones clave del bienestar. En CABA, **${formatPercent(conObraPct)}** de la población cuenta con obra social o prepaga, mientras **${formatPercent(sinCobPct)}** declara no tener cobertura formal. La cobertura previsional alcanza al **${formatPercent(conJubPct)}** de la población mayor.`,
    sectionNarratives: {
      [sidCob]: `El sistema sanitario de CABA combina cobertura privada/obra social, programas estatales (PAMI y planes provinciales) y atención pública. La heterogeneidad social se refleja en estos accesos diferenciados.`,
      [sidDes]: `Las comunas del sur muestran sistemáticamente mayores porcentajes de población sin cobertura formal, evidenciando desigualdades sanitarias estructurales que coinciden con otros indicadores socioeconómicos.`,
      [sidEdad]: `La cobertura por edad refleja el ciclo vital del sistema: los menores y jóvenes adultos presentan mayor proporción sin cobertura formal (asociada a inserción laboral informal), mientras que la población mayor de 65 años alcanza cobertura prácticamente universal vía PAMI.`,
    },
  });
  persist(slug, data, md);
}

// ═══════════════════════════════════════════════════════════════
// 4. Habitacional Hogares — tenencia (c6) + combustible (c4)
// ═══════════════════════════════════════════════════════════════
function generateHabitacionalHogares() {
  const slug = "habitacional-hogares";
  const folder = path.join(RAW_DIR, "4- Condiciones habitacionales de los hogares");
  const fileTen = path.join(folder, "c2022_caba_hogares_c6_1.xlsx");
  const fileComb = path.join(folder, "c2022_caba_hogares_c4_1.xlsx");
  const fileMat = path.join(folder, "c2022_caba_hogares_c1_1.xlsx");
  const fileAgua = path.join(folder, "c2022_caba_hogares_c2_1.xlsx");
  const fileCloaca = path.join(folder, "c2022_caba_hogares_c3_1.xlsx");
  const fileHab = path.join(folder, "c2022_caba_hogares_c5_1.xlsx");
  const fileNet = path.join(folder, "c2022_caba_hogares_c7_1.xlsx");

  const ten = extractCabaTable(readSheetRows(fileTen, "Cuadro 6.1"));
  const comb = extractCabaTable(readSheetRows(fileComb, "Cuadro 4.1"));
  const matRows = readSheetRows(fileMat, "Cuadro 1.1");
  const aguaRows = readSheetRows(fileAgua, "Cuadro 2.1");
  const cloacaRows = readSheetRows(fileCloaca, "Cuadro 3.1");
  const habRows = readSheetRows(fileHab, "Cuadro 5.1");
  const netRows = readSheetRows(fileNet, "Cuadro 7.1");
  const findTotal = (rows) => rows.find(r => r && typeof r[0] === "string" && /^Total$/i.test(r[0].trim()));
  const matTot = (findTotal(matRows) || []).map(toNumber);
  const aguaTot = (findTotal(aguaRows) || []).map(toNumber);
  const cloacaTot = (findTotal(cloacaRows) || []).map(toNumber);
  const habTot = (findTotal(habRows) || []).map(toNumber);
  const netTot = (findTotal(netRows) || []).map(toNumber);

  // Tenencia cols: 0=Código, 1=Comuna, 2=Total hogares, 3=Propia Total, 4=Escritura, 5=Boleto,
  //                6=Otra doc, 7=Sin doc, 8=Alquilada, 9=Cedida por trabajo, 10..=Otras
  const tTot = ten.total.map(toNumber);
  const totalHogares = tTot[2];
  const propiaPct = (tTot[3] / totalHogares) * 100;
  const alquiladaPct = (tTot[8] / totalHogares) * 100;

  // Combustible cols: 0=Código, 1=Comuna, 2=Total hogares, 3=Electricidad, 4=Gas red, 5=Zeppelin,
  //                   6=Gas garrafa, 7=Leña, 8=Otro
  const cTot = comb.total.map(toNumber);
  const gasRedHogPct = (cTot[4] / cTot[2]) * 100;

  // Internet hogares: col 2 = total con internet en vivienda
  const internetHogPct = (netTot[2] / netTot[1]) * 100;

  // Agua red pública: fila "Red pública (agua corriente)" col 1
  const aguaRedRow = aguaRows.find(r => r && typeof r[0] === "string" && /Red p[uú]blica/i.test(r[0]));
  const aguaRedPct = aguaRedRow ? (toNumber(aguaRedRow[1]) / aguaTot[1]) * 100 : 0;

  const builder = new ReportBuilder("poblacion-habitacional-hogares")
    .setMeta({
      title: "Condiciones Habitacionales de los Hogares",
      subcategory: "Hábitat Hogares",
      source: SOURCE,
      date: PERIOD,
    })
    .addKPI({ id: "total-hogares", label: "Total de hogares", value: totalHogares, formatted: formatCompact(totalHogares) })
    .addKPI({ id: "propia", label: "Hogares en vivienda propia", value: propiaPct, formatted: formatPercent(propiaPct) })
    .addKPI({ id: "alquilada", label: "Hogares en vivienda alquilada", value: alquiladaPct, formatted: formatPercent(alquiladaPct) })
    .addKPI({ id: "gas-red-hog", label: "Hogares con gas de red", value: gasRedHogPct, formatted: formatPercent(gasRedHogPct) })
    .addKPI({ id: "internet-hog", label: "Hogares con internet en la vivienda", value: internetHogPct, formatted: formatPercent(internetHogPct) })
    .addKPI({ id: "agua-red", label: "Hogares con agua de red pública", value: aguaRedPct, formatted: formatPercent(aguaRedPct) });

  // Chart: tenencia CABA (pie)
  const sectionTen = "Régimen de Tenencia";
  const sidTen = slugify(sectionTen);
  builder.addChart({
    id: "pie-tenencia",
    type: "pie",
    title: "Régimen de tenencia de la vivienda — CABA",
    sectionId: sidTen,
    sectionTitle: sectionTen,
    data: [
      { id: "Propia",                label: "Propia",                value: tTot[3] },
      { id: "Alquilada",             label: "Alquilada",             value: tTot[8] },
      { id: "Cedida por trabajo",    label: "Cedida por trabajo",    value: tTot[9] || 0 },
      { id: "Otras situaciones",     label: "Otras situaciones",     value: Math.max(0, totalHogares - (tTot[3] + tTot[8] + (tTot[9] || 0))) },
    ].filter(d => d.value > 0),
  });

  // Chart: % alquiler por comuna
  const sectionAlq = "Alquiler por Comuna";
  const sidAlq = slugify(sectionAlq);
  builder.addChart({
    id: "bar-alquiler-comuna",
    type: "bar",
    title: "% de hogares en vivienda alquilada por comuna",
    sectionId: sidAlq,
    sectionTitle: sectionAlq,
    data: ten.comunas.map(({ comuna, row }) => {
      const r = row.map(toNumber);
      return { comuna: comuna.nombre, "Alquiler %": Math.round((r[8] / r[2]) * 1000) / 10 };
    }),
    config: { xAxis: "comuna", yAxis: "Alquiler %" },
  });

  // Ranking: top alquiler
  const ranked = ten.comunas.map(({ comuna, row }) => {
    const r = row.map(toNumber);
    return { comuna, value: (r[8] / r[2]) * 100 };
  }).sort((a, b) => b.value - a.value);

  builder.addRanking({
    id: "rank-alquiler",
    title: "Comunas con mayor % de alquiler",
    sectionId: sidAlq,
    items: ranked.map(r => ({
      name: r.comuna.nombre,
      value: Math.round(r.value * 10) / 10,
      municipioId: r.comuna.id,
    })),
    order: "desc",
  });

  // Map: % alquiler por comuna
  for (const { comuna, row } of ten.comunas) {
    const r = row.map(toNumber);
    const pct = (r[8] / r[2]) * 100;
    builder.addMapItem({
      municipioId: comuna.id,
      municipioNombre: comuna.nombre,
      value: Math.round(pct * 10) / 10,
      label: `${formatPercent(pct)} alquiler`,
    });
  }

  // Chart: materiales de cubierta (hogares_c1) — usa la fila Total con cols 2..5
  const sectionMatHog = "Materiales del Piso (Hogares)";
  const sidMatHog = slugify(sectionMatHog);
  builder.addChart({
    id: "pie-piso-hogares",
    type: "pie",
    title: "Material predominante de los pisos — Hogares CABA",
    sectionId: sidMatHog,
    sectionTitle: sectionMatHog,
    data: [
      { id: "Cerámica/Mosaico/Madera", label: "Cerámica/Mosaico/Madera", value: matTot[2] },
      { id: "Carpeta/Contrapiso",      label: "Carpeta/Contrapiso",      value: matTot[3] },
      { id: "Tierra/Ladrillo suelto",  label: "Tierra/Ladrillo suelto",  value: matTot[4] },
      { id: "Otro material",           label: "Otro material",           value: matTot[5] },
    ].filter(d => d.value > 0),
  });

  // Chart: provisión del agua de hogares (procedencia) - top 4 categorías
  const sectionAguaHog = "Procedencia del Agua (Hogares)";
  const sidAguaHog = slugify(sectionAguaHog);
  const aguaHogCategorias = [];
  for (const r of aguaRows) {
    const c0 = String(r?.[0] || "").trim();
    if (!c0 || /^Total$/i.test(c0) || c0.startsWith("(") || c0.startsWith("Cuadro") || c0.startsWith("Censo")) continue;
    if (c0 === "Procedencia del agua") continue;
    const v = toNumber(r[1]);
    if (v != null && v > 0) aguaHogCategorias.push({ id: c0.slice(0, 38), label: c0.slice(0, 38), value: v });
    if (aguaHogCategorias.length >= 5) break;
  }
  builder.addChart({
    id: "pie-agua-hogares",
    type: "pie",
    title: "Procedencia del agua — Hogares CABA",
    sectionId: sidAguaHog,
    sectionTitle: sidAguaHog === "procedencia-del-agua-hogares" ? sectionAguaHog : sectionAguaHog,
    data: aguaHogCategorias,
  });

  // Chart: brecha digital hogares (hogares_c7) - internet en vivienda
  const sectionDigHog = "Brecha Digital (Hogares)";
  const sidDigHog = slugify(sectionDigHog);
  builder.addChart({
    id: "pie-internet-hogares",
    type: "pie",
    title: "Acceso a internet en la vivienda — Hogares CABA",
    sectionId: sidDigHog,
    sectionTitle: sectionDigHog,
    data: [
      { id: "Internet + dispositivo",   label: "Internet + dispositivo",   value: netTot[3] },
      { id: "Internet sin dispositivo", label: "Internet sin dispositivo", value: netTot[4] },
      { id: "Sin internet",             label: "Sin internet",             value: netTot[5] },
    ].filter(d => d.value > 0),
  });

  // Chart: saneamiento hogares (hogares_c3) — pie
  const sectionCloacaHog = "Saneamiento (Hogares)";
  const sidCloacaHog = slugify(sectionCloacaHog);
  builder.addChart({
    id: "pie-cloaca-hogares",
    type: "pie",
    title: "Ubicación del baño — Hogares CABA",
    sectionId: sidCloacaHog,
    sectionTitle: sectionCloacaHog,
    data: [
      { id: "Dentro de la vivienda",  label: "Dentro de la vivienda",  value: cloacaTot[3] },
      { id: "Fuera de la vivienda",   label: "Fuera de la vivienda",   value: cloacaTot[4] },
      { id: "No tiene baño",          label: "No tiene baño",          value: cloacaTot[5] },
    ].filter(d => d.value > 0),
  });

  // Chart: cantidad de habitaciones por hogar (hogares_c5) — pie
  const sectionHabHog = "Cantidad de Habitaciones (Hogares)";
  const sidHabHog = slugify(sectionHabHog);
  const habHogCategorias = [];
  for (const r of habRows) {
    const c0 = String(r?.[0] || "").trim();
    if (!c0 || /^Total$/i.test(c0) || c0.startsWith("(") || c0.startsWith("Cuadro") || c0.startsWith("Censo") || c0 === "Cantidad de habitaciones") continue;
    const v = toNumber(r[1]);
    if (v != null && v > 0) habHogCategorias.push({ id: c0.slice(0, 20), label: c0.slice(0, 20), value: v });
    if (habHogCategorias.length >= 8) break;
  }
  builder.addChart({
    id: "pie-habitaciones-hogares",
    type: "pie",
    title: "Cantidad de habitaciones por hogar — CABA",
    sectionId: sidHabHog,
    sectionTitle: sectionHabHog,
    data: habHogCategorias,
  });

  // Chart: cantidad de baños por hogar (hogares_c5 fila Total cols 2..5)
  const sectionBanos = "Cantidad de Baños por Hogar";
  const sidBanos = slugify(sectionBanos);
  builder.addChart({
    id: "pie-banos",
    type: "pie",
    title: "Cantidad de baños por hogar — CABA",
    sectionId: sidBanos,
    sectionTitle: sectionBanos,
    data: [
      { id: "1 baño",        label: "1 baño",        value: habTot[2] },
      { id: "2 baños",       label: "2 baños",       value: habTot[3] },
      { id: "3 o más baños", label: "3 o más baños", value: habTot[4] },
      { id: "No tiene baño", label: "No tiene baño", value: habTot[5] },
    ].filter(d => d.value > 0),
  });

  const data = builder.build();
  const md = buildReportMd({
    ...data,
    intro: `CABA cuenta con **${formatInteger(totalHogares)} hogares**. El **${formatPercent(propiaPct)}** habita en vivienda propia y el **${formatPercent(alquiladaPct)}** en alquiler. La cobertura de servicios básicos es muy alta: **${formatPercent(aguaRedPct)}** accede a agua de red pública, **${formatPercent(gasRedHogPct)}** a gas de red y **${formatPercent(internetHogPct)}** cuenta con internet en la vivienda.`,
    sectionNarratives: {
      [sidTen]: `La estructura de tenencia muestra una significativa proporción de hogares inquilinos, con implicancias directas sobre la accesibilidad habitacional y la planificación urbana.`,
      [sidAlq]: `Las comunas del centro y norte concentran las tasas más altas de alquiler, mientras que en las del sur predomina la tenencia con escritura o boleto, frecuentemente con regularización dominial pendiente.`,
      [sidMatHog]: `La calidad constructiva de los pisos —proxy del estado del stock habitacional— muestra que la enorme mayoría de hogares reside en condiciones adecuadas. La fracción minoritaria con pisos precarios identifica déficits a focalizar.`,
      [sidAguaHog]: `La cobertura de agua corriente por red pública es prácticamente universal a nivel hogar. Las pequeñas fracciones con perforaciones u otras fuentes se concentran en barrios populares.`,
      [sidDigHog]: `La brecha digital a nivel hogar combina dos dimensiones: conexión y dispositivos. Los hogares con "internet sin dispositivo" dependen exclusivamente del celular, escenario que limita el aprovechamiento educativo y laboral.`,
      [sidCloacaHog]: `Prácticamente todos los hogares de CABA cuentan con baño dentro de la vivienda y conexión a la red cloacal pública. La fracción minoritaria con baño fuera o ausente identifica situaciones de déficit sanitario crítico.`,
      [sidHabHog]: `La distribución del tamaño de los hogares según cantidad de habitaciones refleja la diversidad de tipologías habitacionales: monoambientes y departamentos pequeños predominan en comunas centrales, mientras casas y departamentos grandes son más comunes en barrios residenciales.`,
      [sidBanos]: `La gran mayoría de los hogares cuenta con un solo baño. La proporción con 2 o más baños refleja viviendas de mayor tamaño y nivel socioeconómico, concentradas en comunas del norte.`,
    },
  });
  persist(slug, data, md);
}

// ═══════════════════════════════════════════════════════════════
// 5. Viviendas — stock y tipo
// ═══════════════════════════════════════════════════════════════
function generateViviendas() {
  const slug = "viviendas";
  const folder = path.join(RAW_DIR, "5- Viviendas");
  const fileC1 = path.join(folder, "c2022_caba_vivienda_c1_1.xlsx");
  const fileC2 = path.join(folder, "c2022_caba_vivienda_c2_1.xlsx");
  const fileC3 = path.join(folder, "c2022_caba_vivienda_c3_1.xlsx");

  const c1 = extractCabaTable(readSheetRows(fileC1, "Cuadro 1.1"));
  const c2 = extractCabaTable(readSheetRows(fileC2, "Cuadro 2.1"));
  const c3 = extractCabaTable(readSheetRows(fileC3, "Cuadro 3.1"));

  // c1 cols: 0=Código, 1=Comuna, 2=Total viviendas, 3=Particulares, 4=Hay personas, 5=Vacaciones,
  //          6=Oficina, 7=Alquiler/venta, 8=Construcción, 9=Habit.no se censó, 10=Otra, 11=Colectivas
  const t1 = c1.total.map(toNumber);
  const totalViv = t1[2];
  const particulares = t1[3];
  const colectivas = t1[11];
  const conPersonas = t1[4];
  const desocupadas = totalViv - conPersonas - colectivas;
  const desocupadasPct = (desocupadas / totalViv) * 100;
  const colectivasPct = (colectivas / totalViv) * 100;

  // c3 cols: 0=Código, 1=Comuna, 2=Total vivs partic., 3=Casa, 4=Rancho, 5=Casilla,
  //          6=Departamento, 7=Pieza inquilinato, 8=Local no constr., 9=Móvil
  const t3 = c3.total.map(toNumber);
  const deptoPct = (t3[6] / t3[2]) * 100;

  // c2 cols: 0=Código, 1=Comuna, 2=Total viv. ocup., 3=Total hogares, 4=Viv c/1 hogar, 5=Hog en viv c/1,
  //          6=Viv c/2 hogares, 7=Hog en viv c/2, 8=Viv c/3+ hogares, 9=Hog en viv c/3+
  const t2 = c2.total.map(toNumber);
  const vivOcupTot = t2[2];
  const vivCon2Hog = t2[6];
  const vivCon3Mas = t2[8];
  const hacinamientoPct = ((vivCon2Hog + vivCon3Mas) / vivOcupTot) * 100;

  const builder = new ReportBuilder("poblacion-viviendas")
    .setMeta({
      title: "Stock Habitacional y Viviendas",
      subcategory: "Viviendas",
      source: SOURCE,
      date: PERIOD,
    })
    .addKPI({ id: "total-viv", label: "Total de viviendas", value: totalViv, formatted: formatCompact(totalViv) })
    .addKPI({ id: "particulares", label: "Viviendas particulares", value: particulares, formatted: formatCompact(particulares) })
    .addKPI({ id: "depto-pct", label: "Departamentos", value: deptoPct, formatted: formatPercent(deptoPct), comparison: "del stock particular" })
    .addKPI({ id: "desocupadas", label: "Viviendas desocupadas", value: desocupadasPct, formatted: formatPercent(desocupadasPct), status: desocupadasPct > 12 ? "warning" : undefined })
    .addKPI({ id: "hacinamiento-viv", label: "Viviendas con 2+ hogares", value: hacinamientoPct, formatted: formatPercent(hacinamientoPct), status: hacinamientoPct > 2 ? "warning" : undefined, comparison: "hacinamiento residencial" });

  // Chart: tipo vivienda CABA (pie)
  const sectionTipo = "Tipo de Vivienda";
  const sidTipo = slugify(sectionTipo);
  builder.addChart({
    id: "pie-tipo-vivienda",
    type: "pie",
    title: "Tipo de vivienda particular — CABA",
    sectionId: sidTipo,
    sectionTitle: sectionTipo,
    data: [
      { id: "Departamento",   label: "Departamento",   value: t3[6] },
      { id: "Casa",           label: "Casa",           value: t3[3] },
      { id: "Pieza/Inquilinato", label: "Pieza/Inquilinato", value: t3[7] },
      { id: "Rancho/Casilla", label: "Rancho/Casilla", value: t3[4] + t3[5] },
      { id: "Otros",          label: "Otros",          value: t3[8] + t3[9] },
    ].filter(d => d.value > 0),
  });

  // Chart: desocupación por comuna
  const sectionDes = "Desocupación de Viviendas por Comuna";
  const sidDes = slugify(sectionDes);
  builder.addChart({
    id: "bar-desoc-comuna",
    type: "bar",
    title: "% de viviendas desocupadas por comuna",
    sectionId: sidDes,
    sectionTitle: sectionDes,
    data: c1.comunas.map(({ comuna, row }) => {
      const r = row.map(toNumber);
      const tot = r[2];
      const conPers = r[4];
      const col = r[11];
      const desoc = tot - conPers - col;
      return { comuna: comuna.nombre, "Desocupadas %": Math.round((desoc / tot) * 1000) / 10 };
    }),
    config: { xAxis: "comuna", yAxis: "Desocupadas %" },
  });

  // Map: % desocupación por comuna
  for (const { comuna, row } of c1.comunas) {
    const r = row.map(toNumber);
    const desoc = r[2] - r[4] - r[11];
    const pct = (desoc / r[2]) * 100;
    builder.addMapItem({
      municipioId: comuna.id,
      municipioNombre: comuna.nombre,
      value: Math.round(pct * 10) / 10,
      label: `${formatPercent(pct)} desocupadas`,
    });
  }

  // Chart: hogares por vivienda (CABA, pie)
  const sectionHac = "Hogares por Vivienda";
  const sidHac = slugify(sectionHac);
  builder.addChart({
    id: "pie-hogares-vivienda",
    type: "pie",
    title: "Cantidad de hogares por vivienda — CABA",
    sectionId: sidHac,
    sectionTitle: sectionHac,
    data: [
      { id: "1 hogar",        label: "1 hogar",        value: t2[4] },
      { id: "2 hogares",      label: "2 hogares",      value: t2[6] },
      { id: "3 o más hogares", label: "3 o más hogares", value: t2[8] },
    ].filter(d => d.value > 0),
  });

  // Chart: hacinamiento por comuna (% viv con 2+ hogares)
  const sectionHacComuna = "Hacinamiento Residencial por Comuna";
  const sidHacCom = slugify(sectionHacComuna);
  builder.addChart({
    id: "bar-hacinamiento-comuna",
    type: "bar",
    title: "Viviendas con 2 o más hogares por comuna",
    sectionId: sidHacCom,
    sectionTitle: sectionHacComuna,
    data: c2.comunas.map(({ comuna, row }) => {
      const r = row.map(toNumber);
      const tot = r[2];
      const hac = (r[6] || 0) + (r[8] || 0);
      return { comuna: comuna.nombre, "Hacinamiento %": tot ? Math.round((hac / tot) * 1000) / 10 : 0 };
    }),
    config: { xAxis: "comuna", yAxis: "Hacinamiento %" },
  });

  // Ranking: top hacinamiento
  const rankedHac = c2.comunas.map(({ comuna, row }) => {
    const r = row.map(toNumber);
    return { comuna, value: r[2] ? (((r[6] || 0) + (r[8] || 0)) / r[2]) * 100 : 0 };
  }).sort((a, b) => b.value - a.value);

  builder.addRanking({
    id: "rank-hacinamiento",
    title: "Comunas con mayor hacinamiento residencial",
    sectionId: sidHacCom,
    items: rankedHac.map(r => ({
      name: r.comuna.nombre,
      value: Math.round(r.value * 100) / 100,
      municipioId: r.comuna.id,
    })),
    order: "desc",
  });

  const data = builder.build();
  const md = buildReportMd({
    ...data,
    intro: `El stock habitacional de CABA suma **${formatInteger(totalViv)} viviendas**, de las cuales **${formatPercent(deptoPct)}** son departamentos. Una fracción significativa (**${formatPercent(desocupadasPct)}**) figura como desocupada y **${formatPercent(hacinamientoPct)}** alberga 2 o más hogares en una misma vivienda — indicador de hacinamiento residencial.`,
    sectionNarratives: {
      [sidTipo]: `El paisaje urbano porteño está dominado por la vivienda en altura. La heterogeneidad de tipologías incluye también casas, pensiones, inquilinatos y formas precarias minoritarias.`,
      [sidDes]: `La desocupación de viviendas es relevante en términos de política habitacional: combina vivienda en stock para alquiler/venta, segundas residencias y bienes inmuebles potencialmente subutilizados.`,
      [sidHac]: `La gran mayoría de las viviendas particulares aloja un único hogar. La fracción con 2 o 3+ hogares —si bien minoritaria— concentra situaciones de hacinamiento residencial y subdivisión informal del stock.`,
      [sidHacCom]: `El hacinamiento residencial muestra una geografía clara: las comunas del sur registran tasas significativamente mayores de viviendas multihogar, en línea con otros indicadores de vulnerabilidad habitacional.`,
    },
  });
  persist(slug, data, md);
}

// ═══════════════════════════════════════════════════════════════
// 6. Educación Censal — sin granularidad por comuna
// ═══════════════════════════════════════════════════════════════
function generateEducacionCensal() {
  const slug = "educacion-censal";
  const folder = path.join(RAW_DIR, "6- Educación");
  const fileC1 = path.join(folder, "c2022_caba_educacion_c1_1.xlsx");
  const fileC2 = path.join(folder, "c2022_caba_educacion_c2_1.xlsx");
  const fileC3 = path.join(folder, "c2022_caba_educacion_c3_1.xlsx");

  // c1 Cuadro 1.1: filas Total y por edad, cols 0=Sexo, 1=Edad, 2=Pob, 3=Asiste, 4=No asiste, 5=Nunca
  const rowsC1 = readSheetRows(fileC1, "Cuadro 1.1");
  const totalRowC1 = rowsC1.find(r => r && typeof r[0] === "string" && /^Total$/i.test(r[0].trim()));
  const tC1 = totalRowC1.map(toNumber);
  const pobTot = tC1[2];
  const asistePct = (tC1[3] / pobTot) * 100;
  const noAsistePct = (tC1[4] / pobTot) * 100;
  const nuncaPct = (tC1[5] / pobTot) * 100;

  // c2 Cuadro 2.1: nivel educativo al que asiste (cols 4..9)
  const rowsC2 = readSheetRows(fileC2, "Cuadro 2.1");
  const totalRowC2 = rowsC2.find(r => r && typeof r[0] === "string" && /^Total$/i.test(r[0].trim()));
  const tC2 = totalRowC2.map(toNumber);
  const universitarioGrado = tC2[9];

  // c3 Cuadro 3.1: máximo nivel educativo alcanzado
  // Cols (fila Total): 2=Pob viv. partic., 3=Pob 5+ que asistió,
  //   4=Sin instrucción, 5=Primario T, 8=EGB T, 11=Secundario T, 14=Polimodal T,
  //   17=Terciario no univ T, 20=Universitario grado T, 23=Posgrado T, 26=Ignorado
  const rowsC3 = readSheetRows(fileC3, "Cuadro 3.1");
  const totalRowC3 = rowsC3.find(r => r && typeof r[0] === "string" && /^Total$/i.test(r[0].trim()));
  const tC3 = totalRowC3.map(toNumber);
  const pob5Mas = tC3[3];
  const sinInstr = tC3[4];
  const primarioT = (tC3[5] || 0) + (tC3[8] || 0);
  const secundarioT = (tC3[11] || 0) + (tC3[14] || 0);
  const terciarioT = tC3[17];
  const universitarioT = tC3[20];
  const posgradoT = tC3[23];
  const superiorPct = ((terciarioT + universitarioT + posgradoT) / pob5Mas) * 100;

  const builder = new ReportBuilder("poblacion-educacion-censal")
    .setMeta({
      title: "Asistencia Educativa de la Población",
      subcategory: "Educación",
      source: SOURCE,
      date: PERIOD,
    })
    .addKPI({ id: "asiste", label: "Asiste a un establecimiento", value: asistePct, formatted: formatPercent(asistePct) })
    .addKPI({ id: "superior", label: "Con nivel superior alcanzado", value: superiorPct, formatted: formatPercent(superiorPct), comparison: "terciario, universitario o posgrado" })
    .addKPI({ id: "no-asiste", label: "No asiste pero asistió", value: noAsistePct, formatted: formatPercent(noAsistePct) })
    .addKPI({ id: "nunca", label: "Nunca asistió", value: nuncaPct, formatted: formatPercent(nuncaPct), status: "warning" })
    .addKPI({ id: "universitarios", label: "Asisten a universitario de grado", value: universitarioGrado, formatted: formatCompact(universitarioGrado) })
    .addKPI({ id: "posgrado-pop", label: "Con posgrado alcanzado", value: posgradoT, formatted: formatCompact(posgradoT) });

  // Chart: condición de asistencia (pie)
  const sectionAsist = "Condición de Asistencia";
  const sidAsist = slugify(sectionAsist);
  builder.addChart({
    id: "pie-asistencia",
    type: "pie",
    title: "Condición de asistencia escolar — CABA",
    sectionId: sidAsist,
    sectionTitle: sectionAsist,
    data: [
      { id: "Asiste",            label: "Asiste",            value: tC1[3] },
      { id: "Asistió (no asiste)", label: "Asistió (no asiste)", value: tC1[4] },
      { id: "Nunca asistió",     label: "Nunca asistió",     value: tC1[5] },
    ],
  });

  // Chart: distribución por nivel
  const sectionNivel = "Nivel Educativo en Curso";
  const sidNivel = slugify(sectionNivel);
  const niveles = [
    { label: "Jardín maternal/centro primera infancia", v: tC2[4] },
    { label: "Sala de 4 o 5 (jardín)", v: tC2[5] },
    { label: "Primario", v: tC2[6] },
    { label: "Secundario", v: tC2[7] },
    { label: "Terciario no universitario", v: tC2[8] },
    { label: "Universitario de grado", v: tC2[9] },
    { label: "Posgrado", v: tC2[10] },
  ].filter(n => n.v != null && n.v > 0);

  builder.addChart({
    id: "bar-niveles",
    type: "bar",
    title: "Población por nivel educativo en curso",
    sectionId: sidNivel,
    sectionTitle: sectionNivel,
    data: niveles.map(n => ({ nivel: n.label, "Población": n.v })),
    config: { xAxis: "nivel", yAxis: "Población" },
  });

  // Chart: máximo nivel educativo alcanzado (de educacion_c3)
  const sectionMax = "Máximo Nivel Educativo Alcanzado";
  const sidMax = slugify(sectionMax);
  builder.addChart({
    id: "pie-max-nivel",
    type: "pie",
    title: "Máximo nivel educativo alcanzado — CABA (5 años y más que asistió)",
    sectionId: sidMax,
    sectionTitle: sectionMax,
    data: [
      { id: "Sin instrucción",       label: "Sin instrucción",       value: sinInstr },
      { id: "Primario/EGB",          label: "Primario/EGB",          value: primarioT },
      { id: "Secundario/Polimodal",  label: "Secundario/Polimodal",  value: secundarioT },
      { id: "Terciario no univ.",    label: "Terciario no univ.",    value: terciarioT },
      { id: "Universitario grado",   label: "Universitario grado",   value: universitarioT },
      { id: "Posgrado",              label: "Posgrado",              value: posgradoT },
    ].filter(d => d.value > 0),
  });

  // No mapData (educación no tiene granularidad comunal en estos cuadros)

  const data = builder.build();
  const md = buildReportMd({
    ...data,
    intro: `La estructura educativa de CABA es uno de los rasgos más distintivos del país: **${formatPercent(asistePct)}** de la población asiste actualmente a un establecimiento y **${formatPercent(superiorPct)}** alcanzó nivel superior (terciario, universitario o posgrado). Solo el **${formatPercent(nuncaPct)}** nunca asistió a un establecimiento educativo formal.`,
    sectionNarratives: {
      [sidAsist]: `La cobertura escolar formal alcanza niveles muy altos en CABA. El bajo porcentaje de personas que nunca asistieron concentra principalmente niños en edad preescolar y población muy mayor.`,
      [sidNivel]: `La distribución por nivel evidencia el peso de los estudios superiores en la matrícula porteña: universitario y posgrado representan una proporción inusualmente alta en el contexto nacional.`,
      [sidMax]: `El stock educativo de CABA refleja décadas de inversión en capital humano: la fracción con educación superior alcanzada (terciario, universitario y posgrado) es la más alta del país y supera ampliamente al promedio nacional, en línea con la estructura productiva basada en servicios profesionales.`,
    },
  });
  persist(slug, data, md);
}

// ═══════════════════════════════════════════════════════════════
// 7. Características económicas — actividad por comuna
// ═══════════════════════════════════════════════════════════════
function generateEconomia() {
  const slug = "economia";
  const folder = path.join(RAW_DIR, "7- Características económicas");
  const file = path.join(folder, "c2022_caba_actividad_economica_c1_1.xlsx");
  const fileRamas = path.join(folder, "c2022_caba_actividad_economica_c6_1.xlsx");
  const fileCatEdad = path.join(folder, "c2022_caba_actividad_economica_c3_1.xlsx");
  const fileActEdu = path.join(folder, "c2022_caba_actividad_economica_c8_1.xlsx");

  const { total, comunas } = extractCabaTable(readSheetRows(file, "Cuadro 1.1"));

  // Ramas de actividad: filas son ramas (col 1 luego de Total)
  // Cols del cuadro c6 fila Total: 0=Total, 1='', 2=Ocupada total, 3=Servicio dom., 4=Empleado/obrero, 5=Cuenta propia, 6=Patrón, 7=Trab. familiar, 8=Ignorado
  const ramasRows = readSheetRows(fileRamas, "Cuadro 6.1");
  const totalRamas = ramasRows.find(r => r && typeof r[0] === "string" && /^Total$/i.test(r[0].trim()));
  const tRamas = (totalRamas || []).map(toNumber);

  // c3: cat ocupacional por edad — col 1=Edad (cuando col 0 vacío), col 2=Pob ocupada,
  //     cols 3..8=Servicio dom, Empleado, Cuenta propia, Patrón, Trab familiar, Ignorado
  const catEdadRows = readSheetRows(fileCatEdad, "Cuadro 3.1");

  // c8: actividad económica por máximo nivel educativo
  // col 1=Nivel educativo, col 2=Pob 14+, 3=PEA total, 4=Ocupada, 5=Desocupada, 6=No PEA
  const actEduRows = readSheetRows(fileActEdu, "Cuadro 8.1");

  // Cols: 0=Código, 1=Comuna, 2=Pob 14+, 3=PEA total, 4=Ocupada, 5=Desocupada, 6=No PEA
  const t = total.map(toNumber);
  const pob14 = t[2];
  const pea = t[3];
  const ocupada = t[4];
  const desocupada = t[5];
  const noPea = t[6];

  const tasaActividad = (pea / pob14) * 100;
  const tasaEmpleo = (ocupada / pob14) * 100;
  const tasaDesocupacion = (desocupada / pea) * 100;

  const builder = new ReportBuilder("poblacion-economia")
    .setMeta({
      title: "Características Económicas de la Población",
      subcategory: "Economía",
      source: SOURCE,
      date: PERIOD,
    })
    .addKPI({ id: "tasa-actividad", label: "Tasa de actividad", value: tasaActividad, formatted: formatPercent(tasaActividad), comparison: "PEA / Población 14+" })
    .addKPI({ id: "tasa-empleo", label: "Tasa de empleo", value: tasaEmpleo, formatted: formatPercent(tasaEmpleo), comparison: "Ocupados / Población 14+" })
    .addKPI({ id: "tasa-desoc", label: "Tasa de desocupación", value: tasaDesocupacion, formatted: formatPercent(tasaDesocupacion), comparison: "Desocupados / PEA", status: tasaDesocupacion > 8 ? "warning" : undefined })
    .addKPI({ id: "no-pea", label: "Población no económicamente activa", value: noPea, formatted: formatCompact(noPea) });

  // Chart: composición CABA (pie)
  const sectionComp = "Condición de Actividad";
  const sidComp = slugify(sectionComp);
  builder.addChart({
    id: "pie-actividad",
    type: "pie",
    title: "Condición de actividad económica — CABA (14+)",
    sectionId: sidComp,
    sectionTitle: sectionComp,
    data: [
      { id: "Ocupada",    label: "Ocupada",    value: ocupada },
      { id: "Desocupada", label: "Desocupada", value: desocupada },
      { id: "No PEA",     label: "No PEA",     value: noPea },
    ],
  });

  // Chart: tasa actividad por comuna
  const sectionTAct = "Tasa de Actividad por Comuna";
  const sidTAct = slugify(sectionTAct);
  builder.addChart({
    id: "bar-tasa-act-comuna",
    type: "bar",
    title: "Tasa de actividad por comuna",
    sectionId: sidTAct,
    sectionTitle: sectionTAct,
    data: comunas.map(({ comuna, row }) => {
      const r = row.map(toNumber);
      return { comuna: comuna.nombre, "Tasa actividad %": Math.round((r[3] / r[2]) * 1000) / 10 };
    }),
    config: { xAxis: "comuna", yAxis: "Tasa actividad %" },
  });

  // Chart: tasa desocupación por comuna
  const sectionTDes = "Tasa de Desocupación por Comuna";
  const sidTDes = slugify(sectionTDes);
  builder.addChart({
    id: "bar-tasa-desoc-comuna",
    type: "bar",
    title: "Tasa de desocupación por comuna",
    sectionId: sidTDes,
    sectionTitle: sectionTDes,
    data: comunas.map(({ comuna, row }) => {
      const r = row.map(toNumber);
      return { comuna: comuna.nombre, "Desocupación %": Math.round((r[5] / r[3]) * 1000) / 10 };
    }),
    config: { xAxis: "comuna", yAxis: "Desocupación %" },
  });

  // Rankings
  const rankedAct = comunas.map(({ comuna, row }) => {
    const r = row.map(toNumber);
    return { comuna, value: (r[3] / r[2]) * 100 };
  }).sort((a, b) => b.value - a.value);

  builder.addRanking({
    id: "rank-actividad",
    title: "Comunas con mayor tasa de actividad",
    sectionId: sidTAct,
    items: rankedAct.map(r => ({
      name: r.comuna.nombre,
      value: Math.round(r.value * 10) / 10,
      municipioId: r.comuna.id,
    })),
    order: "desc",
  });

  const rankedDes = comunas.map(({ comuna, row }) => {
    const r = row.map(toNumber);
    return { comuna, value: (r[5] / r[3]) * 100 };
  }).sort((a, b) => b.value - a.value);

  builder.addRanking({
    id: "rank-desocupacion",
    title: "Comunas con mayor tasa de desocupación",
    sectionId: sidTDes,
    items: rankedDes.map(r => ({
      name: r.comuna.nombre,
      value: Math.round(r.value * 10) / 10,
      municipioId: r.comuna.id,
    })),
    order: "desc",
  });

  // Map: tasa desocupación
  for (const { comuna, row } of comunas) {
    const r = row.map(toNumber);
    const pct = (r[5] / r[3]) * 100;
    builder.addMapItem({
      municipioId: comuna.id,
      municipioNombre: comuna.nombre,
      value: Math.round(pct * 10) / 10,
      label: `${formatPercent(pct)} desocupación`,
    });
  }

  // Chart: rama de actividad económica (de actividad_c6, filas con rama en col 1)
  const sectionRama = "Ramas de Actividad Económica";
  const sidRama = slugify(sectionRama);
  const ramasData = [];
  for (const r of ramasRows) {
    const c0 = String(r?.[0] || "").trim();
    const c1 = String(r?.[1] || "").trim();
    if (c0 || !c1) continue; // saltar filas que tengan algo en col 0 (incluye "Total" y ramas agregadas)
    if (/^\(/.test(c1) || c1.length < 4) continue;
    const ocup = toNumber(r[2]);
    if (ocup != null && ocup > 0) {
      ramasData.push({
        rama: c1.length > 38 ? c1.slice(0, 36) + "…" : c1,
        Ocupados: ocup,
      });
    }
  }
  // Top 10 ramas
  ramasData.sort((a, b) => b.Ocupados - a.Ocupados);
  const ramasTop = ramasData.slice(0, 10);
  builder.addChart({
    id: "bar-ramas",
    type: "bar",
    title: "Población ocupada por rama de actividad económica",
    sectionId: sidRama,
    sectionTitle: sectionRama,
    data: ramasTop,
    config: { xAxis: "rama", yAxis: "Ocupados", layout: "horizontal" },
  });

  // Ranking ramas
  builder.addRanking({
    id: "rank-ramas",
    title: "Ramas con mayor ocupación",
    sectionId: sidRama,
    items: ramasTop.map(r => ({
      name: r.rama,
      value: r.Ocupados,
    })),
    order: "desc",
  });

  // Chart: cat. ocupacional por edad (de actividad_c3) — solo grupos quinquenales
  const sectionCatEdad = "Categoría Ocupacional por Edad";
  const sidCatEdad = slugify(sectionCatEdad);
  const catEdadData = [];
  for (const r of catEdadRows) {
    const c0 = String(r?.[0] || "").trim();
    const c1 = String(r?.[1] || "").trim();
    if (c0 || !c1) continue; // saltar Total y filas con sexo
    if (!/^\d+(-\d+)?$/.test(c1) && !/^65\s*y\s*m[áa]s$/i.test(c1)) continue;
    const ocupada = toNumber(r[2]);
    if (!ocupada) continue;
    catEdadData.push({
      edad: c1,
      "Servicio doméstico %":  Math.round(((toNumber(r[3]) || 0) / ocupada) * 1000) / 10,
      "Empleado/obrero %":     Math.round(((toNumber(r[4]) || 0) / ocupada) * 1000) / 10,
      "Cuenta propia %":       Math.round(((toNumber(r[5]) || 0) / ocupada) * 1000) / 10,
      "Patrón/Empleador %":    Math.round(((toNumber(r[6]) || 0) / ocupada) * 1000) / 10,
    });
  }
  builder.addChart({
    id: "line-cat-ocupacional-edad",
    type: "line",
    title: "Distribución de la categoría ocupacional según edad",
    sectionId: sidCatEdad,
    sectionTitle: sectionCatEdad,
    data: catEdadData,
    config: { xAxis: "edad", yAxis: "%" },
  });

  // Chart: actividad por nivel educativo (de actividad_c8)
  const sectionActEdu = "Actividad y Nivel Educativo";
  const sidActEdu = slugify(sectionActEdu);
  const actEduData = [];
  for (const r of actEduRows) {
    const c0 = String(r?.[0] || "").trim();
    const c1 = String(r?.[1] || "").trim();
    if (c0 || !c1) continue;
    if (c1.length < 5) continue;
    const pob = toNumber(r[2]);
    if (!pob) continue;
    actEduData.push({
      nivel: c1.length > 30 ? c1.slice(0, 28) + "…" : c1,
      "Tasa actividad %":     Math.round(((toNumber(r[3]) || 0) / pob) * 1000) / 10,
      "Tasa empleo %":        Math.round(((toNumber(r[4]) || 0) / pob) * 1000) / 10,
      "Tasa desocupación %":  toNumber(r[3]) ? Math.round(((toNumber(r[5]) || 0) / toNumber(r[3])) * 1000) / 10 : 0,
    });
  }
  builder.addChart({
    id: "bar-actividad-nivel-edu",
    type: "bar",
    title: "Tasas de actividad y empleo según máximo nivel educativo",
    sectionId: sidActEdu,
    sectionTitle: sectionActEdu,
    data: actEduData.slice(0, 10),
    config: { xAxis: "nivel", yAxis: "%", grouped: true },
  });

  const data = builder.build();
  const md = buildReportMd({
    ...data,
    intro: `La población de **14 años y más** en CABA es de ${formatInteger(pob14)} personas. La tasa de actividad alcanza el **${formatPercent(tasaActividad)}**, con una tasa de empleo del **${formatPercent(tasaEmpleo)}** y una desocupación del **${formatPercent(tasaDesocupacion)}** sobre la PEA.`,
    sectionNarratives: {
      [sidComp]: `La PEA porteña concentra ocupados con alta calificación profesional, en consonancia con la estructura productiva de servicios financieros, gobierno, educación y tecnología.`,
      [sidTAct]: `La tasa de actividad varía según la composición etaria y socioeconómica de cada comuna; las comunas con mayor proporción de adultos jóvenes registran los valores más altos.`,
      [sidTDes]: `Las brechas de desocupación entre comunas reflejan diferencias estructurales de oportunidades laborales, capital humano y acceso al mercado de trabajo formal.`,
      [sidRama]: `La estructura productiva porteña refleja una economía dominada por servicios: comercio, servicios profesionales, enseñanza, salud, administración pública e industria manufacturera concentran la mayor parte de la ocupación. La distribución exhibe el carácter terciarizado de la economía de la Ciudad.`,
      [sidCatEdad]: `La categoría ocupacional muestra patrones marcados por edad: la juventud predomina en relación de dependencia (empleado/obrero), mientras que cuenta propia y patrón ganan peso en edades intermedias y maduras. El servicio doméstico, aunque minoritario, presenta concentración en mujeres adultas.`,
      [sidActEdu]: `La participación en el mercado de trabajo crece consistentemente con el nivel educativo alcanzado. La tasa de empleo es máxima en quienes completaron estudios universitarios y de posgrado, mientras que la desocupación afecta más fuertemente a quienes sólo alcanzaron primario o secundario incompleto.`,
    },
  });
  persist(slug, data, md);
}

// ═══════════════════════════════════════════════════════════════
// 8. Fecundidad
// ═══════════════════════════════════════════════════════════════
function generateFecundidad() {
  const slug = "fecundidad";
  const folder = path.join(RAW_DIR, "8- Fecundidad");
  const file = path.join(folder, "c2022_caba_fecundidad_c1_1.xlsx");
  const fileEdu = path.join(folder, "c2022_caba_fecundidad_c6_1.xlsx");
  const fileEdad = path.join(folder, "c2022_caba_fecundidad_c2_1.xlsx");
  const fileCob = path.join(folder, "c2022_caba_fecundidad_c3_1.xlsx");
  const fileAct = path.join(folder, "c2022_caba_fecundidad_c4_1.xlsx");

  const { total, comunas } = extractCabaTable(readSheetRows(file, "Cuadro 1.1"));
  const eduRows = readSheetRows(fileEdu, "Cuadro 6.1");
  const edadRows = readSheetRows(fileEdad, "Cuadro 2.1");
  const cobRows = readSheetRows(fileCob, "Cuadro 3.1");
  const actRows = readSheetRows(fileAct, "Cuadro 4.1");

  // Cols: 0=Código, 1=Comuna, 2=Mujeres 14-49, 3=Ninguno, 4=1, 5=2, 6=3, 7=4, 8=5+, 9=Promedio
  const t = total.map(toNumber);
  const mujeres = t[2];
  const sinHijos = t[3];
  const sinHijosPct = (sinHijos / mujeres) * 100;
  const tresOMas = (t[6] || 0) + (t[7] || 0) + (t[8] || 0);
  const tresOMasPct = (tresOMas / mujeres) * 100;
  const promedioCABA = t[9];

  const builder = new ReportBuilder("poblacion-fecundidad")
    .setMeta({
      title: "Fecundidad",
      subcategory: "Fecundidad",
      source: SOURCE,
      date: PERIOD,
    })
    .addKPI({ id: "mujeres-14-49", label: "Mujeres de 14 a 49 años", value: mujeres, formatted: formatCompact(mujeres) })
    .addKPI({ id: "promedio-hijos", label: "Promedio de hijos por mujer", value: promedioCABA, formatted: formatDecimal(promedioCABA, 1) })
    .addKPI({ id: "sin-hijos", label: "Mujeres sin hijos", value: sinHijosPct, formatted: formatPercent(sinHijosPct) })
    .addKPI({ id: "tres-o-mas", label: "Mujeres con 3 o más hijos", value: tresOMasPct, formatted: formatPercent(tresOMasPct) });

  // Chart: distribución cantidad hijos CABA (pie)
  const sectionDist = "Distribución por Cantidad de Hijos";
  const sidDist = slugify(sectionDist);
  builder.addChart({
    id: "pie-cant-hijos",
    type: "pie",
    title: "Cantidad de hijas e hijos nacidos vivos — CABA",
    sectionId: sidDist,
    sectionTitle: sectionDist,
    data: [
      { id: "Ninguno",  label: "Ninguno",  value: t[3] },
      { id: "1",        label: "1",        value: t[4] },
      { id: "2",        label: "2",        value: t[5] },
      { id: "3",        label: "3",        value: t[6] },
      { id: "4",        label: "4",        value: t[7] },
      { id: "5 y más",  label: "5 y más",  value: t[8] },
    ].filter(d => d.value > 0),
  });

  // Chart: promedio hijos por comuna
  const sectionProm = "Promedio de Hijos por Comuna";
  const sidProm = slugify(sectionProm);
  builder.addChart({
    id: "bar-prom-hijos-comuna",
    type: "bar",
    title: "Promedio de hijos por mujer — por comuna",
    sectionId: sidProm,
    sectionTitle: sectionProm,
    data: comunas.map(({ comuna, row }) => ({
      comuna: comuna.nombre,
      "Promedio hijos": toNumber(row[9]) || 0,
    })),
    config: { xAxis: "comuna", yAxis: "Promedio hijos" },
  });

  // Ranking
  const rankedProm = [...comunas].sort((a, b) => (toNumber(b.row[9]) || 0) - (toNumber(a.row[9]) || 0));
  builder.addRanking({
    id: "rank-prom-hijos",
    title: "Comunas con mayor promedio de hijos",
    sectionId: sidProm,
    items: rankedProm.map(({ comuna, row }) => ({
      name: comuna.nombre,
      value: toNumber(row[9]) || 0,
      municipioId: comuna.id,
    })),
    order: "desc",
  });

  // Map: promedio hijos por comuna
  for (const { comuna, row } of comunas) {
    const v = toNumber(row[9]) || 0;
    builder.addMapItem({
      municipioId: comuna.id,
      municipioNombre: comuna.nombre,
      value: v,
      label: `${formatDecimal(v, 1)} hijos/mujer`,
    });
  }

  // Chart: hijos por nivel educativo (de fecundidad_c6, agregando niveles)
  // Cols: 1=Mujeres, 2=Ninguno, 3=1, 4=2, 5=3, 6=4, 7=5+
  const sectionEdu = "Fecundidad y Educación";
  const sidEdu = slugify(sectionEdu);
  const groupBy = (matchers) => {
    const out = { mujeres: 0, ninguno: 0, total_hijos: 0, con_hijos: 0 };
    for (const r of eduRows) {
      const c0 = String(r?.[0] || "").trim();
      if (!matchers.some(m => m.test(c0))) continue;
      const m = toNumber(r[1]) || 0;
      const n = toNumber(r[2]) || 0;
      const h1 = toNumber(r[3]) || 0;
      const h2 = toNumber(r[4]) || 0;
      const h3 = toNumber(r[5]) || 0;
      const h4 = toNumber(r[6]) || 0;
      const h5 = toNumber(r[7]) || 0;
      out.mujeres += m;
      out.ninguno += n;
      out.con_hijos += h1 + h2 + h3 + h4 + h5;
      out.total_hijos += h1 + 2 * h2 + 3 * h3 + 4 * h4 + 5.5 * h5;
    }
    return out;
  };
  const grupos = [
    { label: "Sin instrucción / Primario", g: groupBy([/^Sin instrucci/i, /^Primario/i, /^EGB/i]) },
    { label: "Secundario / Polimodal",     g: groupBy([/^Secundario/i, /^Polimodal/i]) },
    { label: "Terciario no univ.",         g: groupBy([/^Terciario/i]) },
    { label: "Universitario",              g: groupBy([/^Universitario/i]) },
    { label: "Posgrado",                   g: groupBy([/^Posgrado/i]) },
  ];
  const eduData = grupos.map(({ label, g }) => ({
    nivel: label,
    "Promedio hijos": g.mujeres ? Math.round((g.total_hijos / g.mujeres) * 100) / 100 : 0,
    "% sin hijos": g.mujeres ? Math.round((g.ninguno / g.mujeres) * 1000) / 10 : 0,
  }));
  builder.addChart({
    id: "bar-fecundidad-educacion",
    type: "bar",
    title: "Promedio de hijos según máximo nivel educativo alcanzado",
    sectionId: sidEdu,
    sectionTitle: sectionEdu,
    data: eduData,
    config: { xAxis: "nivel", yAxis: "Promedio hijos" },
  });

  // Chart: promedio de hijos por grupo de edad (de fecundidad_c2)
  // Cols: 0=Edad, 1=Mujeres, 2=Ninguno, 3=1, 4=2, 5=3, 6=4, 7=5+, 8=Promedio
  const sectionFecEdad = "Fecundidad por Edad";
  const sidFecEdad = slugify(sectionFecEdad);
  const fecEdadData = [];
  for (const r of edadRows) {
    const c0 = String(r?.[0] || "").trim();
    if (!/^\d+(-\d+)?$/.test(c0)) continue;
    const prom = toNumber(r[8]);
    const muj = toNumber(r[1]);
    const ninguno = toNumber(r[2]);
    if (muj == null) continue;
    fecEdadData.push({
      edad: c0,
      "Promedio hijos": prom != null ? prom : 0,
      "% sin hijos":    muj ? Math.round((ninguno / muj) * 1000) / 10 : 0,
    });
  }
  builder.addChart({
    id: "line-fec-edad",
    type: "line",
    title: "Promedio de hijos y % sin hijos según edad — CABA",
    sectionId: sidFecEdad,
    sectionTitle: sectionFecEdad,
    data: fecEdadData,
    config: { xAxis: "edad", yAxis: "Valor" },
  });

  // Chart: hijos por cobertura de salud (de fecundidad_c3)
  // Cols: 0=Cobertura, 1=Mujeres, 2=Ninguno, 3=1, 4=2, 5=3, 6=4, 7=5+
  const sectionFecCob = "Fecundidad y Cobertura de Salud";
  const sidFecCob = slugify(sectionFecCob);
  const fecCobData = [];
  for (const r of cobRows) {
    const c0 = String(r?.[0] || "").trim();
    if (!c0 || /^Total$/i.test(c0) || c0.startsWith("(") || c0.startsWith("Cuadro") || c0.startsWith("Censo") || c0 === "Tipo de cobertura de salud") continue;
    const muj = toNumber(r[1]);
    if (!muj) continue;
    const total_hijos =
      (toNumber(r[3]) || 0) * 1 +
      (toNumber(r[4]) || 0) * 2 +
      (toNumber(r[5]) || 0) * 3 +
      (toNumber(r[6]) || 0) * 4 +
      (toNumber(r[7]) || 0) * 5.5;
    fecCobData.push({
      cobertura: c0.length > 32 ? c0.slice(0, 30) + "…" : c0,
      "Promedio hijos": Math.round((total_hijos / muj) * 100) / 100,
      "% sin hijos":    Math.round(((toNumber(r[2]) || 0) / muj) * 1000) / 10,
    });
    if (fecCobData.length >= 5) break;
  }
  builder.addChart({
    id: "bar-fec-cobertura",
    type: "bar",
    title: "Hijos según tipo de cobertura de salud",
    sectionId: sidFecCob,
    sectionTitle: sectionFecCob,
    data: fecCobData,
    config: { xAxis: "cobertura", yAxis: "Valor", grouped: true },
  });

  // Chart: hijos por condición de actividad (de fecundidad_c4)
  const sectionFecAct = "Fecundidad y Condición de Actividad";
  const sidFecAct = slugify(sectionFecAct);
  const fecActData = [];
  for (const r of actRows) {
    const c0 = String(r?.[0] || "").trim();
    if (!c0 || /^Total$/i.test(c0) || c0.startsWith("(") || c0.startsWith("Cuadro") || c0.startsWith("Censo") || c0 === "Condición de actividad") continue;
    const muj = toNumber(r[1]);
    if (!muj) continue;
    const total_hijos =
      (toNumber(r[3]) || 0) * 1 +
      (toNumber(r[4]) || 0) * 2 +
      (toNumber(r[5]) || 0) * 3 +
      (toNumber(r[6]) || 0) * 4 +
      (toNumber(r[7]) || 0) * 5.5;
    fecActData.push({
      condicion: c0.length > 32 ? c0.slice(0, 30) + "…" : c0,
      "Promedio hijos": Math.round((total_hijos / muj) * 100) / 100,
      "% sin hijos":    Math.round(((toNumber(r[2]) || 0) / muj) * 1000) / 10,
    });
    if (fecActData.length >= 6) break;
  }
  builder.addChart({
    id: "bar-fec-actividad",
    type: "bar",
    title: "Hijos según condición de actividad económica",
    sectionId: sidFecAct,
    sectionTitle: sectionFecAct,
    data: fecActData,
    config: { xAxis: "condicion", yAxis: "Valor", grouped: true },
  });

  const data = builder.build();
  const md = buildReportMd({
    ...data,
    intro: `Las mujeres de **14 a 49 años** en CABA suman ${formatInteger(mujeres)}, con un promedio de **${formatDecimal(promedioCABA, 1)} hijos por mujer**. El **${formatPercent(sinHijosPct)}** no tiene hijos, mientras el **${formatPercent(tresOMasPct)}** tiene 3 o más, evidenciando un patrón reproductivo más bien tardío y de baja fecundidad propio de áreas urbanas con alta escolarización.`,
    sectionNarratives: {
      [sidDist]: `La fecundidad porteña se ubica entre las más bajas del país, con una concentración en mujeres sin hijos o con uno o dos. Esto se asocia a la postergación de la maternidad y a niveles educativos elevados.`,
      [sidProm]: `Las comunas del sur registran promedios más altos de hijos por mujer, mientras las del norte y centro presentan los valores más bajos, en línea con perfiles socioeconómicos diferenciados.`,
      [sidEdu]: `Existe una correlación inversa marcada entre nivel educativo y fecundidad: las mujeres con educación superior tienen, en promedio, menor cantidad de hijas e hijos. Este patrón refleja la postergación reproductiva asociada a trayectorias educativas largas y al ingreso al mercado laboral calificado.`,
      [sidFecEdad]: `El número promedio de hijos por mujer crece con la edad y se estabiliza hacia el final del período fértil (45-49 años). El "% sin hijos" cae monótonamente: muy alto en adolescencia y juventud, mínimo al cierre del período fértil. La curva ilustra el patrón típico de fecundidad acumulada por cohortes.`,
      [sidFecCob]: `Las mujeres con obra social o prepaga muestran patrones de fecundidad más bajos que aquellas con cobertura estatal exclusiva o sin cobertura. La diferencia refleja perfiles socioeconómicos y educativos asociados a cada tipo de aseguramiento.`,
      [sidFecAct]: `Las mujeres ocupadas tienen menor promedio de hijos que las inactivas o desocupadas, evidenciando la tensión entre trayectoria laboral y maternidad. Las amas de casa y mujeres no económicamente activas registran las tasas más altas de fecundidad.`,
    },
  });
  persist(slug, data, md);
}

// ═══════════════════════════════════════════════════════════════
// 9. Seguridad — SNIC (Sistema Nacional de Información Criminal)
// ═══════════════════════════════════════════════════════════════
function generateSeguridad() {
  const slug = "seguridad";
  const fileDept = path.join(SEC_DIR, "snic-caba-departamental.csv");
  const fileProv = path.join(SEC_DIR, "snic-provincial.csv");

  if (!fs.existsSync(fileDept)) {
    console.log(`  ⏭️  Seguridad: ${path.relative(ROOT, fileDept)} no existe. Skip.`);
    return;
  }

  const rowsDept = readCsv(fileDept);     // CABA por comuna
  const rowsProv = readCsv(fileProv);     // Argentina por provincia

  // Año más reciente disponible
  const yearsAvail = [...new Set(rowsDept.map(r => parseInt(r.anio, 10)).filter(n => Number.isFinite(n)))].sort((a, b) => b - a);
  const latest = yearsAvail[0];
  const prev = yearsAvail[1];

  // Subset año actual y previo, solo CABA por comuna (excluyendo "Departamento sin determinar")
  const isComuna = (name) => /^Comuna\s+\d+$/i.test(String(name || "").trim());
  const dCurrent = rowsDept.filter(r => +r.anio === latest && isComuna(r.departamento_nombre));
  const dPrev    = rowsDept.filter(r => +r.anio === prev    && isComuna(r.departamento_nombre));

  // Categorías clave para KPI/charts (los nombres deben coincidir EXACTAMENTE con el CSV)
  const KEY = {
    homDol:   "Homicidios dolosos",
    robos:    "Robos (excluye los agravados por el resultado de lesiones y/o muertes)",
    hurtos:   "Hurtos",
    lesiones: "Lesiones dolosas",
    muertesViales: "Muertes en accidentes viales",
    suicidios: "Suicidios (consumados)",
    abusosCarnal: "Abusos sexuales con acceso carnal (violaciones)",
    estafas:  "Estafas y defraudaciones (no incluye virtuales) y usura",
    estafasVirt: "Estafas y defraudaciones asistidas virtualmente",
    estupef:  "Ley 23.737 (estupefacientes)",
    amenazas: "Amenazas",
    robosAgr: "Robos agravados por el resultado de lesiones y/o muertes",
  };

  // Sumar `cantidad_hechos` para una categoría en un set de filas
  const sumHechos = (rows, categoria) => rows
    .filter(r => r.codigo_delito_snic_nombre === categoria)
    .reduce((s, r) => s + (parseInt(r.cantidad_hechos, 10) || 0), 0);

  const sumVictimas = (rows, categoria) => rows
    .filter(r => r.codigo_delito_snic_nombre === categoria)
    .reduce((s, r) => s + (parseInt(r.cantidad_victimas, 10) || 0), 0);

  // Totales CABA año actual
  const homDol = sumHechos(dCurrent, KEY.homDol);
  const homDolPrev = sumHechos(dPrev, KEY.homDol);
  const robos = sumHechos(dCurrent, KEY.robos);
  const robosAgr = sumHechos(dCurrent, KEY.robosAgr);
  const hurtos = sumHechos(dCurrent, KEY.hurtos);
  const lesiones = sumHechos(dCurrent, KEY.lesiones);
  const muertesViales = sumHechos(dCurrent, KEY.muertesViales);
  const suicidios = sumHechos(dCurrent, KEY.suicidios);
  const totalHechos = dCurrent.reduce((s, r) => s + (parseInt(r.cantidad_hechos, 10) || 0), 0);
  const variacionHomDol = homDolPrev ? ((homDol - homDolPrev) / homDolPrev) * 100 : 0;

  const builder = new ReportBuilder("seguridad")
    .setMeta({
      title: "Seguridad y Estadísticas Criminales",
      category: "Seguridad",
      subcategory: "Estadísticas Criminales",
      source: SOURCE_SNIC,
      date: String(latest),
    })
    .addKPI({ id: "homicidios-dolosos", label: "Homicidios dolosos", value: homDol, formatted: formatInteger(homDol), unit: "casos", comparison: prev ? `${variacionHomDol >= 0 ? "+" : ""}${formatDecimal(variacionHomDol, 1)}% vs ${prev}` : undefined, status: homDol > 100 ? "warning" : undefined })
    .addKPI({ id: "robos", label: "Robos", value: robos + robosAgr, formatted: formatCompact(robos + robosAgr), unit: "casos", comparison: "incluye agravados" })
    .addKPI({ id: "hurtos", label: "Hurtos", value: hurtos, formatted: formatCompact(hurtos), unit: "casos" })
    .addKPI({ id: "lesiones-dolosas", label: "Lesiones dolosas", value: lesiones, formatted: formatCompact(lesiones), unit: "casos" })
    .addKPI({ id: "muertes-viales", label: "Muertes en accidentes viales", value: muertesViales, formatted: formatInteger(muertesViales), unit: "casos" })
    .addKPI({ id: "suicidios", label: "Suicidios", value: suicidios, formatted: formatInteger(suicidios), unit: "casos" })
    .addKPI({ id: "total-hechos", label: "Total de hechos delictivos registrados", value: totalHechos, formatted: formatCompact(totalHechos) });

  // Chart: top categorías de delito en CABA (último año)
  const sectionTop = "Principales Tipos de Delito";
  const sidTop = slugify(sectionTop);
  const topCategorias = [
    { label: "Hurtos",                          v: hurtos },
    { label: "Robos",                           v: robos },
    { label: "Robos agravados",                 v: robosAgr },
    { label: "Lesiones dolosas",                v: lesiones },
    { label: "Amenazas",                        v: sumHechos(dCurrent, KEY.amenazas) },
    { label: "Estupefacientes (Ley 23.737)",    v: sumHechos(dCurrent, KEY.estupef) },
    { label: "Estafas",                         v: sumHechos(dCurrent, KEY.estafas) + sumHechos(dCurrent, KEY.estafasVirt) },
    { label: "Abusos sexuales (con acceso carnal)", v: sumHechos(dCurrent, KEY.abusosCarnal) },
    { label: "Muertes viales",                  v: muertesViales },
    { label: "Homicidios dolosos",              v: homDol },
  ].filter(d => d.v > 0).sort((a, b) => b.v - a.v);
  builder.addChart({
    id: "bar-top-delitos",
    type: "bar",
    title: `Principales tipos de delito — CABA, ${latest}`,
    sectionId: sidTop,
    sectionTitle: sectionTop,
    data: topCategorias.map(d => ({ delito: d.label, Hechos: d.v })),
    config: { xAxis: "delito", yAxis: "Hechos", layout: "horizontal" },
  });

  // Chart: serie temporal — homicidios, robos, hurtos por año
  const sectionSerie = "Evolución Temporal";
  const sidSerie = slugify(sectionSerie);
  const yearsSeries = [...new Set(rowsDept.map(r => parseInt(r.anio, 10)).filter(n => Number.isFinite(n) && n >= 2017 && n <= latest))].sort();
  const sumByYear = (categoria) => yearsSeries.map(y => {
    const sum = rowsDept
      .filter(r => +r.anio === y && isComuna(r.departamento_nombre) && r.codigo_delito_snic_nombre === categoria)
      .reduce((s, r) => s + (parseInt(r.cantidad_hechos, 10) || 0), 0);
    return { anio: String(y), valor: sum };
  });
  const serieData = yearsSeries.map(y => {
    const filt = rowsDept.filter(r => +r.anio === y && isComuna(r.departamento_nombre));
    const hd = filt.filter(r => r.codigo_delito_snic_nombre === KEY.homDol).reduce((s, r) => s + (parseInt(r.cantidad_hechos, 10) || 0), 0);
    const hu = filt.filter(r => r.codigo_delito_snic_nombre === KEY.hurtos).reduce((s, r) => s + (parseInt(r.cantidad_hechos, 10) || 0), 0);
    const ro = filt.filter(r => r.codigo_delito_snic_nombre === KEY.robos).reduce((s, r) => s + (parseInt(r.cantidad_hechos, 10) || 0), 0);
    return { anio: String(y), "Homicidios dolosos": hd, "Hurtos": hu, "Robos": ro };
  });
  builder.addChart({
    id: "line-serie-temporal",
    type: "line",
    title: `Evolución 2017-${latest} de delitos clave — CABA`,
    sectionId: sidSerie,
    sectionTitle: sectionSerie,
    data: serieData,
    config: { xAxis: "anio", yAxis: "Hechos" },
  });

  // Chart: tasa de hechos por comuna (último año, todas las categorías sumadas)
  const sectionComuna = "Hechos Delictivos por Comuna";
  const sidComuna = slugify(sectionComuna);
  // Agrupar por comuna sumando todos los delitos, y tasa promedio de las filas con tasa > 0
  const byComuna = new Map();
  for (const r of dCurrent) {
    const nm = String(r.departamento_nombre || "").trim();
    if (!isComuna(nm)) continue;
    const slot = byComuna.get(nm) || { hechos: 0, tasaSum: 0, tasaCount: 0 };
    slot.hechos += parseInt(r.cantidad_hechos, 10) || 0;
    const t = parseFloat(r.tasa_hechos);
    if (Number.isFinite(t) && t > 0) { slot.tasaSum += t; slot.tasaCount++; }
    byComuna.set(nm, slot);
  }

  const dataComuna = COMUNAS_CABA.map(c => {
    const slot = byComuna.get(c.nombre) || { hechos: 0, tasaSum: 0, tasaCount: 0 };
    return {
      comuna: c.nombre,
      municipioId: c.id,
      hechos: slot.hechos,
      tasa: slot.tasaCount ? Math.round((slot.tasaSum / slot.tasaCount) * 10) / 10 : 0,
    };
  });

  builder.addChart({
    id: "bar-hechos-comuna",
    type: "bar",
    title: `Hechos delictivos totales por comuna — ${latest}`,
    sectionId: sidComuna,
    sectionTitle: sectionComuna,
    data: dataComuna.map(d => ({ comuna: d.comuna, Hechos: d.hechos })),
    config: { xAxis: "comuna", yAxis: "Hechos" },
  });

  // Ranking por hechos absolutos por comuna
  builder.addRanking({
    id: "rank-hechos-comuna",
    title: "Comunas con más hechos delictivos",
    sectionId: sidComuna,
    items: [...dataComuna].sort((a, b) => b.hechos - a.hechos).map(d => ({
      name: d.comuna,
      value: d.hechos,
      municipioId: d.municipioId,
    })),
    order: "desc",
  });

  // Chart: víctimas por sexo (acumulado año actual, top 4 categorías violentas)
  const sectionVic = "Víctimas por Sexo";
  const sidVic = slugify(sectionVic);
  const violentas = [KEY.homDol, KEY.robos, KEY.lesiones, KEY.abusosCarnal];
  const vicData = violentas.map(cat => {
    const filt = dCurrent.filter(r => r.codigo_delito_snic_nombre === cat);
    const masc = filt.reduce((s, r) => s + (parseInt(r.cantidad_victimas_masc, 10) || 0), 0);
    const fem = filt.reduce((s, r) => s + (parseInt(r.cantidad_victimas_fem, 10) || 0), 0);
    return { delito: cat.length > 30 ? cat.slice(0, 28) + "…" : cat, Mujeres: fem, Varones: masc };
  });
  builder.addChart({
    id: "bar-victimas-sexo",
    type: "bar",
    title: "Víctimas por sexo según delito (categorías violentas)",
    sectionId: sidVic,
    sectionTitle: sectionVic,
    data: vicData,
    config: { xAxis: "delito", yAxis: "Víctimas", grouped: true },
  });

  // Comparativo provincial: tasa de homicidios por jurisdicción (top 12)
  const sectionProv = "Comparativo Nacional";
  const sidProv = slugify(sectionProv);
  const provYear = rowsProv.filter(r => +r.anio === latest && r.codigo_delito_snic_nombre === KEY.homDol);
  const provData = provYear
    .map(r => ({
      provincia: String(r.provincia_nombre || ""),
      "Tasa homicidios": parseFloat(r.tasa_hechos) || 0,
    }))
    .filter(d => d.provincia && d["Tasa homicidios"] >= 0)
    .sort((a, b) => b["Tasa homicidios"] - a["Tasa homicidios"])
    .slice(0, 15);
  builder.addChart({
    id: "bar-homicidios-provincias",
    type: "bar",
    title: `Tasa de homicidios dolosos por provincia — ${latest}`,
    sectionId: sidProv,
    sectionTitle: sectionProv,
    data: provData,
    config: { xAxis: "provincia", yAxis: "Tasa (cada 100.000 hab.)", layout: "horizontal" },
  });

  // mapData: hechos por comuna
  for (const d of dataComuna) {
    builder.addMapItem({
      municipioId: d.municipioId,
      municipioNombre: d.comuna,
      value: d.hechos,
      label: `${formatInteger(d.hechos)} hechos`,
    });
  }

  const data = builder.build();

  // CABA homicidios → posición en ranking provincial
  const cabaHomEntry = provData.find(d => /Ciudad Aut/i.test(d.provincia));
  const posCABA = cabaHomEntry ? provData.indexOf(cabaHomEntry) + 1 : null;

  const md = buildReportMd({
    ...data,
    intro: `En **${latest}**, CABA registró **${formatInteger(homDol)} homicidios dolosos** (${variacionHomDol >= 0 ? "↑" : "↓"} ${formatDecimal(Math.abs(variacionHomDol), 1)}% vs ${prev}), **${formatInteger(robos + robosAgr)} robos** y **${formatInteger(hurtos)} hurtos**. La tasa de homicidios la ubica${posCABA ? ` en el puesto ${posCABA} de 24 jurisdicciones del país` : ""}, evidenciando un perfil delictivo dominado por delitos contra la propiedad antes que por violencia letal.`,
    sectionNarratives: {
      [sidTop]: `La estructura del delito en CABA muestra el predominio absoluto de hurtos y robos, característico de grandes centros urbanos. Las categorías violentas (homicidios dolosos, lesiones graves) son comparativamente bajas en términos absolutos pero representan el mayor impacto social.`,
      [sidSerie]: `La evolución 2017-${latest} permite identificar tendencias estructurales. La pandemia de 2020 marcó un quiebre con caídas históricas en hurtos y robos por la reducción de la circulación, seguido de una recomposición gradual.`,
      [sidComuna]: `La distribución territorial del delito refleja patrones de concentración urbana, flujo de trabajadores, comercios y nodos de transporte. Las comunas céntricas suelen liderar los rankings absolutos por concentración de actividad económica.`,
      [sidVic]: `La distribución por sexo de las víctimas varía según el delito: en homicidios dolosos las víctimas son predominantemente varones, mientras que los abusos sexuales con acceso carnal afectan en su gran mayoría a mujeres. Estos patrones son consistentes con la literatura criminológica internacional.`,
      [sidProv]: `Comparada con el resto del país, CABA presenta una tasa de homicidios dolosos por debajo del promedio nacional, ubicándose habitualmente entre las jurisdicciones más seguras del país en este indicador, contrastando con su mayor incidencia de delitos contra la propiedad.`,
    },
  });

  fs.writeFileSync(path.join(PUBLIC_DATA, "seguridad.json"), JSON.stringify(data, null, 2));
  fs.writeFileSync(path.join(PUBLIC_REPORTS, "seguridad.md"), md);
  console.log(`  ✅ seguridad.json (${data.kpis.length} KPIs, ${data.charts.length} charts, ${data.rankings.length} rankings, ${data.mapData.length} map items) — año ${latest}`);
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   CABA — Census + Security Report Data Generator       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const generators = [
    generateEstructura,
    generateHabitacionalPersonas,
    generateSaludPrevision,
    generateHabitacionalHogares,
    generateViviendas,
    generateEducacionCensal,
    generateEconomia,
    generateFecundidad,
    generateSeguridad,
  ];

  let failed = 0;
  for (const gen of generators) {
    try {
      gen();
    } catch (err) {
      console.error(`  ❌ Error in ${gen.name}: ${err.message}`);
      console.error(err.stack);
      failed++;
    }
  }

  console.log(failed === 0
    ? `\n  ✅ ${generators.length} informes generados\n`
    : `\n  ⚠️  ${failed}/${generators.length} fallaron\n`);

  if (failed > 0) process.exit(1);
}

main();
