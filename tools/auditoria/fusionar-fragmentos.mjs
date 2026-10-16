#!/usr/bin/env node
/**
 * tools/auditoria/fusionar-fragmentos.mjs — mete los `tools/fragmentos/*.json` en manifest.json.
 *
 *   node tools/auditoria/fusionar-fragmentos.mjs --dry   → sólo dice qué haría (no escribe)
 *   node tools/auditoria/fusionar-fragmentos.mjs         → fusiona y sube la versión (1.15.x → 1.16.0)
 *
 * Reglas: activos ordenados alfabéticamente, apagados al final (como está hoy), 2 espacios de
 * sangría y saltos CRLF (el formato del archivo). Valida que cada `filename` exista de verdad y
 * que `supportedTypes` sólo traiga movie/tv. No hace git: eso es del humano.
 */
import fs from 'node:fs';
import path from 'node:path';

// raíz del repo: subir desde el script hasta la carpeta que tiene manifest.json
function raizRepo() {
  let d = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
  while (!fs.existsSync(path.join(d, 'manifest.json'))) {
    const padre = path.dirname(d);
    if (padre === d) throw new Error('no encontré manifest.json subiendo desde ' + d);
    d = padre;
  }
  return d;
}
const REPO = raizRepo();
const MANIFEST = path.join(REPO, 'manifest.json');
const FRAGMENTOS = path.join(REPO, 'tools', 'fragmentos');
const DRY = process.argv.includes('--dry');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

if (!fs.existsSync(FRAGMENTOS)) {
  console.error('no existe tools/fragmentos/ — nada que fusionar');
  process.exit(1);
}
const archivos = fs.readdirSync(FRAGMENTOS).filter((f) => f.endsWith('.json'));
if (!archivos.length) { console.error('tools/fragmentos/ está vacío'); process.exit(1); }

const nuevas = [];
const errores = [];
for (const f of archivos) {
  let entradas;
  try { entradas = JSON.parse(fs.readFileSync(path.join(FRAGMENTOS, f), 'utf8')); }
  catch (e) { errores.push(`${f}: JSON inválido (${e.message})`); continue; }
  if (!Array.isArray(entradas)) entradas = [entradas];
  for (const e of entradas) {
    for (const campo of ['id', 'name', 'filename', 'supportedTypes', 'enabled']) {
      if (e[campo] === undefined) errores.push(`${f}: entrada sin «${campo}»`);
    }
    if (e.supportedTypes && e.supportedTypes.some((t) => !['movie', 'tv'].includes(t))) {
      errores.push(`${f}: supportedTypes raros en ${e.id}: ${e.supportedTypes.join(',')}`);
    }
    if (e.filename && !fs.existsSync(path.join(REPO, e.filename))) {
      errores.push(`${f}: ${e.id} apunta a ${e.filename}, que no existe`);
    }
    if (e.id) nuevas.push(e);
  }
}
const idsNuevos = nuevas.map((e) => e.id);
const repetidos = idsNuevos.filter((id, i) => idsNuevos.indexOf(id) !== i);
if (repetidos.length) errores.push('ids repetidos entre fragmentos: ' + [...new Set(repetidos)].join(', '));

if (errores.length) {
  console.error('NO se fusiona, hay errores:');
  for (const e of errores) console.error('  -', e);
  process.exit(2);
}

const previos = new Map(manifest.scrapers.map((s) => [s.id, s]));
const agregados = nuevas.filter((e) => !previos.has(e.id)).map((e) => e.id);
const reemplazados = nuevas.filter((e) => previos.has(e.id)).map((e) => e.id);

for (const e of nuevas) previos.set(e.id, { ...(previos.get(e.id) || {}), ...e });
const todos = [...previos.values()];
const activos = todos.filter((s) => s.enabled).sort((a, b) => a.id.localeCompare(b.id));
const apagados = todos.filter((s) => !s.enabled);
manifest.scrapers = [...activos, ...apagados];
if (!DRY && agregados.length) manifest.version = subirVersion(manifest.version);

function subirVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '1.0.0'));
  if (!m) return '1.16.0';
  return `${m[1]}.${Number(m[2]) + 1}.0`;
}

console.log(`fragmentos leídos: ${archivos.length} archivo(s), ${nuevas.length} entrada(s)`);
console.log('  nuevos:', agregados.join(', ') || '—');
console.log('  actualizados:', reemplazados.join(', ') || '—');
console.log(`  manifest: ${manifest.scrapers.length} entradas (${activos.length} activas, ${apagados.length} apagadas), versión ${manifest.version}`);

if (DRY) { console.log('\n(--dry: no se escribió nada)'); process.exit(0); }

const texto = JSON.stringify(manifest, null, 2).replace(/\n/g, '\r\n') + '\r\n';
fs.writeFileSync(MANIFEST, texto);
console.log('\nescrito manifest.json. Ahora: node validar.js');
