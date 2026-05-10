/**
 * markdown-builder.cjs — Genera Markdown plantilla a partir del ReportData.
 *
 * Estructura:
 *   - intro corto (sin H1: el título lo pinta el hero del ReportView)
 *   - una `## <título>` por chart, con su `sectionId` slug-equivalente
 *     (para que findChartsForSection en ReportView matchee)
 *   - tabla markdown con top-5 de cada ranking
 *   - footer con fuente
 */

const { slugify } = require("./report-builder.cjs");
const { formatInteger } = require("./formatters.cjs");

function formatNumber(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  // Use AR formatting in markdown tables too
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);
}

function buildReportMd({ meta, kpis, charts, rankings, intro, sectionNarratives = {} }) {
  const lines = [];

  // Intro paragraph (no H1 — hero handles title)
  lines.push(intro || `Análisis de **${meta.title}** sobre la base del **${meta.source}**.`);
  lines.push("");

  // KPI summary block (markdown bullets) — appears above the first section
  if (kpis.length > 0) {
    lines.push("**Indicadores destacados:**");
    lines.push("");
    for (const k of kpis.slice(0, 6)) {
      lines.push(`- **${k.label}:** ${k.formatted}${k.unit ? ` ${k.unit}` : ""}${k.comparison ? ` — _${k.comparison}_` : ""}`);
    }
    lines.push("");
  }

  // One section per unique chart sectionId
  const seenSections = new Set();
  for (const chart of charts) {
    if (!chart.sectionId || seenSections.has(chart.sectionId)) continue;
    seenSections.add(chart.sectionId);

    // Heading whose slugify(text) === chart.sectionId is what enables matching
    const heading = chart.sectionTitle || titleFromSlug(chart.sectionId);
    lines.push(`## ${heading}`);
    lines.push("");

    const narrative = sectionNarratives[chart.sectionId];
    if (narrative) {
      lines.push(narrative);
      lines.push("");
    } else {
      lines.push(`Distribución y comparación según ${heading.toLowerCase()}. Los gráficos a continuación detallan los valores observados en el Censo 2022 para el conjunto de la Ciudad y por comuna.`);
      lines.push("");
    }

    // Append matching ranking, if present
    const matching = rankings.filter(r => r.sectionId === chart.sectionId);
    for (const r of matching) {
      const top = (r.items || []).slice(0, 5);
      if (top.length === 0) continue;
      lines.push(`**${r.title}** (top ${top.length}):`);
      lines.push("");
      lines.push("| # | Comuna | Valor |");
      lines.push("|---|---|---:|");
      top.forEach((item, i) => {
        lines.push(`| ${i + 1} | ${item.name} | ${formatNumber(item.value)} |`);
      });
      lines.push("");
    }
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`> **Fuente:** ${meta.source} · **Período:** ${meta.date}`);
  lines.push("");

  return lines.join("\n");
}

function titleFromSlug(slug) {
  return String(slug)
    .split("-")
    .map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w)
    .join(" ");
}

module.exports = { buildReportMd, slugify };
