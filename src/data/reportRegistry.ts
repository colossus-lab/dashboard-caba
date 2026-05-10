import type { ReportEntry } from '../types/report';

// ═══════════════════════════════════════════════════════════════
// Report Registry — 8 informes censales del Dashboard CABA
// ═══════════════════════════════════════════════════════════════

export const REPORTS: ReportEntry[] = [
  // ─── Grupo 1: Población (8 subgrupos del Censo 2022) ───
  {
    id: 'poblacion-estructura',
    slug: 'poblacion/estructura',
    title: 'Estructura por Sexo y Edad',
    shortTitle: 'Estructura Poblacional',
    category: 'Población',
    subcategory: 'Estructura',
    icon: '👥',
    color: '#f59e0b',
    mdPath: '/reports/poblacion/estructura.md',
    dataPath: '/data/poblacion/estructura.json',
    order: 1,
  },
  {
    id: 'poblacion-habitacional-personas',
    slug: 'poblacion/habitacional-personas',
    title: 'Condiciones Habitacionales de la Población',
    shortTitle: 'Hábitat Personas',
    category: 'Población',
    subcategory: 'Hábitat Personas',
    icon: '🏠',
    color: '#fb923c',
    mdPath: '/reports/poblacion/habitacional-personas.md',
    dataPath: '/data/poblacion/habitacional-personas.json',
    order: 2,
  },
  {
    id: 'poblacion-salud-prevision',
    slug: 'poblacion/salud-prevision',
    title: 'Salud y Previsión Social',
    shortTitle: 'Salud & Previsión',
    category: 'Población',
    subcategory: 'Salud',
    icon: '🏥',
    color: '#10b981',
    mdPath: '/reports/poblacion/salud-prevision.md',
    dataPath: '/data/poblacion/salud-prevision.json',
    order: 3,
  },
  {
    id: 'poblacion-habitacional-hogares',
    slug: 'poblacion/habitacional-hogares',
    title: 'Condiciones Habitacionales de los Hogares',
    shortTitle: 'Hábitat Hogares',
    category: 'Población',
    subcategory: 'Hábitat Hogares',
    icon: '🏗️',
    color: '#f97316',
    mdPath: '/reports/poblacion/habitacional-hogares.md',
    dataPath: '/data/poblacion/habitacional-hogares.json',
    order: 4,
  },
  {
    id: 'poblacion-viviendas',
    slug: 'poblacion/viviendas',
    title: 'Stock Habitacional y Viviendas',
    shortTitle: 'Viviendas',
    category: 'Población',
    subcategory: 'Viviendas',
    icon: '🏘️',
    color: '#8b5cf6',
    mdPath: '/reports/poblacion/viviendas.md',
    dataPath: '/data/poblacion/viviendas.json',
    order: 5,
  },
  {
    id: 'poblacion-educacion-censal',
    slug: 'poblacion/educacion-censal',
    title: 'Asistencia Educativa de la Población',
    shortTitle: 'Educación Censal',
    category: 'Población',
    subcategory: 'Educación',
    icon: '📚',
    color: '#06b6d4',
    mdPath: '/reports/poblacion/educacion-censal.md',
    dataPath: '/data/poblacion/educacion-censal.json',
    order: 6,
  },
  {
    id: 'poblacion-economia',
    slug: 'poblacion/economia',
    title: 'Características Económicas de la Población',
    shortTitle: 'Economía Poblacional',
    category: 'Población',
    subcategory: 'Economía',
    icon: '💼',
    color: '#eab308',
    mdPath: '/reports/poblacion/economia.md',
    dataPath: '/data/poblacion/economia.json',
    order: 7,
  },
  {
    id: 'poblacion-fecundidad',
    slug: 'poblacion/fecundidad',
    title: 'Fecundidad',
    shortTitle: 'Fecundidad',
    category: 'Población',
    subcategory: 'Fecundidad',
    icon: '👶',
    color: '#ec4899',
    mdPath: '/reports/poblacion/fecundidad.md',
    dataPath: '/data/poblacion/fecundidad.json',
    order: 8,
  },

  // ─── Grupo 2: Sectoriales ───
  {
    id: 'seguridad',
    slug: 'seguridad',
    title: 'Seguridad y Estadísticas Criminales',
    shortTitle: 'Seguridad',
    category: 'Seguridad',
    subcategory: 'Estadísticas Criminales',
    icon: '🛡️',
    color: '#dc2626',
    mdPath: '/reports/seguridad.md',
    dataPath: '/data/seguridad.json',
    order: 9,
  },
];

export function getReportBySlug(slug: string): ReportEntry | undefined {
  return REPORTS.find(r => r.slug === slug);
}

export function getReportsByCategory(category: string): ReportEntry[] {
  return REPORTS.filter(r => r.category === category);
}

export function getPoblacionReports(): ReportEntry[] {
  return REPORTS.filter(r => r.category === 'Población');
}

export function getSectorialReports(): ReportEntry[] {
  return REPORTS.filter(r => r.category !== 'Población');
}
