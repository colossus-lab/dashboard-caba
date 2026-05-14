import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { getPoblacionReports, getSectorialReports } from '../data/reportRegistry';
import { SectionReveal } from '../components/ui/SectionReveal';
import { SiteFooter } from '../components/layout/SiteFooter';
import type { ReportEntry } from '../types/report';

// ─── Macro KPIs for the hero (CABA census data) ───
const HERO_STATS = [
  { value: 3120612, label: 'Habitantes', suffix: '', tooltip: 'Censo Nacional 2022 · INDEC' },
  { value: 15, label: 'Comunas', suffix: '', tooltip: 'Ciudad Autónoma de Buenos Aires' },
  { value: 48, label: 'Barrios', suffix: '', tooltip: '48 barrios distribuidos en 15 comunas' },
  { value: 9, label: 'Informes', suffix: '', tooltip: '9 informes basados en datos abiertos' },
];

// ─── Stats reales por informe ───
type StatItem = { value: string; label: string };

const REPORT_STATS: Record<string, StatItem[]> = {
  'poblacion-estructura': [
    { value: '3,1M', label: 'habitantes' },
    { value: '15', label: 'comunas' },
    { value: '48', label: 'barrios' },
    { value: '7,8%', label: 'del país' },
  ],
  'poblacion-habitacional-personas': [
    { value: '95%', label: 'piso calidad' },
    { value: '99%', label: 'agua de red' },
    { value: '98%', label: 'con cloacas' },
    { value: '1,2M', label: 'hogares' },
  ],
  'poblacion-salud-prevision': [
    { value: '78%', label: 'obra social' },
    { value: '22%', label: 'sin cobertura' },
    { value: '24%', label: 'percibe jub.' },
    { value: '670K', label: 'sin previsión' },
  ],
  'poblacion-habitacional-hogares': [
    { value: '96%', label: 'piso calidad' },
    { value: '98%', label: 'con cloaca' },
    { value: '12%', label: 'cocina garrafa' },
    { value: '8%', label: '1 habitación' },
  ],
  'poblacion-viviendas': [
    { value: '1,5M', label: 'viviendas' },
    { value: '83%', label: 'ocupadas' },
    { value: '6%', label: 'son casas' },
    { value: '94%', label: 'departamentos' },
  ],
  'poblacion-educacion-censal': [
    { value: '950K', label: 'asistentes' },
    { value: '58%', label: 'nivel inicial' },
    { value: '99%', label: 'primario' },
    { value: '78%', label: 'sec. completo' },
  ],
  'poblacion-economia': [
    { value: '1,6M', label: 'ocupados' },
    { value: '6,8%', label: 'desocupación' },
    { value: '68%', label: 'tasa activ.' },
    { value: '32%', label: 'inactivos' },
  ],
  'poblacion-fecundidad': [
    { value: '1,1', label: 'hijos/mujer' },
    { value: '52%', label: 'sin hijos' },
    { value: 'CABA', label: 'min país' },
    { value: '−18%', label: 'var. 10-22' },
  ],
  // Sectoriales
  'seguridad': [
    { value: '188K', label: 'hechos' },
    { value: '60', label: 'homicidios' },
    { value: '4.060', label: 'robos /100K' },
    { value: 'SNIC', label: '2024' },
  ],
};

export function Landing() {
  const poblacion = getPoblacionReports();
  const sectoriales = getSectorialReports();

  return (
    <div className="landing-page">
      <Helmet>
        <title>Dashboard CABA · Inteligencia Estratégica Distrital</title>
        <meta
          name="description"
          content="Plataforma de datos abiertos con análisis interactivo de la Ciudad Autónoma de Buenos Aires. 3,1M habitantes, 15 comunas, 9 informes."
        />
        <link rel="canonical" href="https://caba.openarg.org" />
      </Helmet>
      {/* ─── Animated Hero ─── */}
      <SectionReveal>
        <header className="landing-hero">
          {/* Floating particles */}
          <div className="hero-particles" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="hero-particle" style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>

          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Plataforma de Datos Abiertos
            </div>
            <h1 className="hero-title">
              Inteligencia Estratégica
              <span className="hero-title-light">de la Ciudad Autónoma de Buenos Aires</span>
            </h1>
            <p className="hero-subtitle">
              Explorá <span className="hero-highlight">3,1M habitantes</span> y{' '}
              <span className="hero-highlight">15 comunas</span> con 9 informes basados en
              datos oficiales del INDEC, Censo 2022, SNIC y GCBA.
            </p>
            <p className="hero-attribution">
              Powered by{' '}
              <a href="https://colossuslab.org" target="_blank" rel="noopener noreferrer" className="hero-link">
                ColossusLab.org
              </a>{' '}
              · Datos vía{' '}
              <a href="https://openarg.org" target="_blank" rel="noopener noreferrer" className="hero-link">
                OpenArg
              </a>
            </p>

            {/* ─── Count-up Stats ─── */}
            <div className="hero-stats">
              {HERO_STATS.map((stat, i) => (
                <div key={stat.label}>
                  {i > 0 && <span className="hero-stat-divider" />}
                  <div className="hero-stat" title={stat.tooltip}>
                    <CountUp target={stat.value} suffix={stat.suffix} />
                    <span className="hero-stat-label">{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>
      </SectionReveal>

      {/* ─── Población Grid ─── */}
      <SectionReveal>
        <section className="landing-section">
          <div className="section-header">
            <div className="section-number">01</div>
            <div>
              <h2 className="section-title">Población — Censo 2022</h2>
              <p className="section-desc">
                Ocho dimensiones del último censo nacional: estructura por sexo y edad, hábitat,
                hogares, stock de viviendas, asistencia educativa, características económicas,
                salud y previsión, y fecundidad.
              </p>
            </div>
          </div>
          <div className="report-grid">
            {poblacion.map((report, i) => (
              <ReportCard key={report.id} report={report} index={i} />
            ))}
          </div>
        </section>
      </SectionReveal>

      {/* ─── Sectoriales Grid ─── */}
      {sectoriales.length > 0 && (
        <SectionReveal>
          <section className="landing-section">
            <div className="section-header">
              <div className="section-number">02</div>
              <div>
                <h2 className="section-title">Análisis Sectoriales</h2>
                <p className="section-desc">Informes especializados por sector productivo, institucional y social.</p>
              </div>
            </div>
            <div className="report-grid">
              {sectoriales.map((report, i) => (
                <ReportCard key={report.id} report={report} index={i} />
              ))}
            </div>
          </section>
        </SectionReveal>
      )}

      {/* ─── Footer ─── */}
      <SiteFooter />
    </div>
  );
}

// ═══════ Components ═══════

function ReportCard({ report, index }: { report: ReportEntry; index: number }) {
  const stats = REPORT_STATS[report.id];
  const tickerSize: 'sm' | 'md' | 'lg' = index === 0 ? 'md' : 'sm';

  return (
    <Link
      to={`/${report.slug}`}
      className="report-card"
      style={{
        '--card-color': report.color,
        animationDelay: `${index * 80}ms`,
      } as React.CSSProperties}
    >
      <div className="report-card-glow" aria-hidden="true" />
      <div className="report-card-header">
        <span className="report-card-number">{String(report.order).padStart(2, '0')}</span>
        <span className="report-card-arrow">→</span>
      </div>
      <div className="report-card-body">
        <span className="report-card-title">{report.shortTitle}</span>
        <span className="report-card-desc">{report.title}</span>
      </div>
      {stats && stats.length > 0 && (
        <div className="report-card-stat">
          <StatTicker items={stats} size={tickerSize} />
        </div>
      )}
    </Link>
  );
}

// ─── Stat ticker: rota cifras reales con pausa para leer ───
function StatTicker({ items, size = 'sm' }: { items: StatItem[]; size?: 'sm' | 'md' | 'lg' }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 4000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const cur = items[idx];
  return (
    <div className={`report-card-ticker report-card-ticker--${size}`} aria-hidden="true">
      <span key={idx} className="report-card-ticker-item">
        <strong className="report-card-ticker-value">{cur.value}</strong>
        <span className="report-card-ticker-label">{cur.label}</span>
      </span>
    </div>
  );
}

// ─── Count-up Animation ───
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const duration = 2000;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) animate(); },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  const formatted = value >= 1000000
    ? `${(value / 1000000).toFixed(1).replace('.', ',')}M`
    : value >= 1000
    ? `${(value / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
    : `${value}`;

  return (
    <span ref={ref} className="hero-stat-value">
      {formatted}{suffix}
    </span>
  );
}
