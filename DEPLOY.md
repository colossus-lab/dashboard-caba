# Deploy a Vercel

Esta guía cubre el despliegue del Dashboard CABA en Vercel. Es un sitio
**100% estático** (Vite + React); no hay funciones serverless ni variables
de entorno requeridas.

## Pre-requisitos

1. Cuenta de Vercel (`vercel.com`)
2. CLI de Vercel instalada (opcional, para deploys directos):
   ```bash
   npm i -g vercel
   ```
3. Datos pre-generados committeados (los `.json` en `public/data/poblacion/`,
   los `.md` en `public/reports/poblacion/` y el `caba-comunas.geojson` en
   `public/data/`). Ya están listos en este repo.

## Cómo está configurado el build

- `vercel.json` declara `framework: vite`, `buildCommand: npm run build` y
  `outputDirectory: dist`.
- El `prebuild` (`npm run build-data`) **se saltea automáticamente** cuando
  los XLSX fuente (`1- Poblacion/`) no están disponibles — caso típico
  en Vercel, ya que esa carpeta está en `.gitignore` y `.vercelignore`.
  El build usa los JSON/MD pre-generados que están committeados en `public/`.
- Si necesitás regenerar los datos, hay que tener los XLSX localmente y correr
  `npm run build-data` antes de commitear.

## Variables de entorno

Ninguna requerida — el sitio es estático.

## Deploy

### Vía CLI (deploy directo, sin Git)

Desde la raíz del proyecto:

```bash
vercel              # primer deploy: pregunta proyecto/scope, crea preview
vercel --prod       # promueve a producción
```

La primera vez el CLI guarda la config en `.vercel/` (gitignoreada).

### Vía GitHub/GitLab (recomendado)

1. Inicializar git si no está:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Dashboard CABA"
   ```
2. Crear repo remoto en GitHub/GitLab y empujar:
   ```bash
   git remote add origin <url>
   git push -u origin main
   ```
3. En Vercel: **Add New → Project → Import Git Repository**.
4. Vercel detecta `vercel.json` y configura framework Vite + build automático.
5. Cada push a `main` despliega producción; cada PR genera preview.

## Archivos relevantes

| Archivo | Qué hace |
|---|---|
| `vercel.json` | Build, rewrites SPA, cache headers (`/data/*`, `/reports/*`, `/assets/*`) |
| `.vercelignore` | Excluye `1- Poblacion/`, `scripts/`, `node_modules/`, etc. del bundle |
| `.gitignore` | Excluye XLSX, `node_modules/`, `dist/`, `.discovery.json`, etc. |
| `scripts/build-data.cjs` | Pipeline local; skipea automáticamente en Vercel |

## Checklist antes de deploy

- [ ] `npm run build-data` corre limpio localmente (8/8 informes)
- [ ] `npx tsc -b` compila sin errores
- [ ] Los archivos `public/data/poblacion/*.json`, `public/reports/poblacion/*.md`
      y `public/data/caba-comunas.geojson` están committeados

## Verificación post-deploy

1. Abrir el dominio asignado por Vercel.
2. Navegar a `/poblacion/estructura` — debe mostrar hero, KPIs animados, mapa coroplético de las 15 comunas, charts y secciones markdown.
3. Probar las 8 rutas de informes:
   - `/poblacion/estructura`, `/poblacion/habitacional-personas`,
     `/poblacion/salud-prevision`, `/poblacion/habitacional-hogares`,
     `/poblacion/viviendas`, `/poblacion/educacion-censal`,
     `/poblacion/economia`, `/poblacion/fecundidad`
4. Probar `/explorar` y `/explorar/:datasetId`.
5. Verificar en DevTools → Network que `/data/*.json`, `/reports/*.md` y
   `/data/caba-comunas.geojson` cargan correctamente con `Cache-Control` apropiado.

## Troubleshooting

**Build falla con "Cannot find module @rollup/rollup-..."**
- Bug conocido de npm con dependencias opcionales nativas. Solución: en Vercel
  agregar `npm: { force: true }` en build settings, o forzar `pnpm`/`yarn`.
  No suele ocurrir en Vercel (Linux x64), solo afecta Windows ARM64 local.

**Mapas no cargan**
- Verificar que `/data/caba-comunas.geojson` retorna 200 (no 404).
- Si está faltante: regenerarlo con `node scripts/lib/build-comunas-geo.cjs`
  y commitear.
