#!/usr/bin/env node
/**
 * tools/verificar-lote.mjs — pasa el arnés QuickJS real a los providers del manifest y resume.
 *
 *   node tools/verificar-lote.mjs                      → todos los del manifest.json
 *   node tools/verificar-lote.mjs embed69 vimeus       → sólo esos ids
 *   CASOS=1 node tools/verificar-lote.mjs vimeus       → sólo película (más rápido)
 *
 * Criterio de OK por provider: en algún caso devuelve ≥1 stream, y NINGÚN stream trae etiqueta de
 * español de España (Esp/ESP/SPA/Castellano/dual). Escribe el resultado en
 * tools/auditoria/verificacion-<fecha-hora>.json y sale con código 1 si algo queda en rojo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

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
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, 'manifest.json'), 'utf8'));
const POOL = Number(process.env.WORKERS || 4);
const SOLO_PELICULA = process.env.CASOS === '1';

const CASOS = [
  { args: ['693134', 'movie'], etiqueta: 'movie Dune 2' },
  { args: ['76479', 'tv', '3', '1'], etiqueta: 'tv The Boys S3E1' },
];
const CASOS_ANIME = [
  { args: ['95479', 'tv', '1', '1'], etiqueta: 'tv Jujutsu Kaisen S1E1' },
  { args: ['129', 'movie'], etiqueta: 'movie Spirited Away' },
];
const IDS_ANIME = new Set(['latanime', 'animeav1', 'monoschinos', 'henaojara', 'animejara']);

const RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;
const RE_LATSUB = /latino|\blat\b|\[lat\]|\bsubs?\b|subtitulad|\bvose\b|\[sub\]/i;

const pedidos = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const entradas = (pedidos.length ? pedidos.map((id) => MANIFEST.scrapers.find((s) => s.id === id) || { id, filename: `providers/${id}.js` }) : MANIFEST.scrapers);

function correr(archivo, args) {
  return new Promise((resolve) => {
    const hijo = spawn('node', [path.join(REPO, 'tools', 'qjs-correr.mjs'), archivo, ...args], { cwd: REPO, env: { ...process.env, LIMITE_MS: process.env.LIMITE_MS || '90000' } });
    let out = '', err = '';
    hijo.stdout.on('data', (d) => { out += d; });
    hijo.stderr.on('data', (d) => { err += d; });
    hijo.on('close', (code) => {
      let json = null;
      if (out.trim().startsWith('{')) { try { json = JSON.parse(out); } catch { json = null; } }
      resolve({ code, json, err: err.slice(-400), out: out.slice(-400) });
    });
    setTimeout(() => { try { hijo.kill(); } catch {} }, Number(process.env.LIMITE_MS || 90000) + 20000);
  });
}

async function revisar(entrada) {
  const resultado = { id: entrada.id, archivo: entrada.filename, casos: [], veredicto: 'ROJO' };
  const casos = SOLO_PELICULA ? [CASOS[0]] : (IDS_ANIME.has(entrada.id) ? [...CASOS, ...CASOS_ANIME] : CASOS);
  let streamsOk = 0;
  let espanas = 0;
  for (const caso of casos) {
    const r = await correr(entrada.filename, caso.args);
    const detalle = { caso: caso.etiqueta, ok: false, streams: 0, idiomas: [], espanas: 0, nota: '' };
    if (!r.json) { detalle.nota = `sin JSON (code ${r.code}): ${(r.err || r.out).split('\n')[0].slice(0, 120)}`; }
    else if (!r.json.ok) { detalle.nota = 'error: ' + String(r.json.error || '').slice(0, 120); }
    else {
      const streams = r.json.streams || [];
      detalle.streams = streams.length;
      const texto = streams.map((s) => `${s.title} ${s.language}`).join(' | ');
      detalle.idiomas = [...new Set((texto.match(/latino|subtitulad|\bsub\b|\besp\b|castellano|\bspa\b/gi) || []).map((x) => x.toLowerCase()))];
      detalle.espanas = streams.filter((s) => RE_ESPANA.test(`${s.title} ${s.language}`)).length;
      detalle.latinoSub = streams.filter((s) => RE_LATSUB.test(`${s.title} ${s.language}`)).length;
      detalle.ok = detalle.streams > 0;
      detalle.nota = `lat/sub: ${detalle.latinoSub}`;
    }
    streamsOk += detalle.streams;
    espanas += detalle.espanas;
    resultado.casos.push(detalle);
  }
  resultado.espanas = espanas;
  resultado.veredicto = espanas > 0 ? 'ROJO (trae España)' : streamsOk > 0 ? 'VERDE' : 'SIN STREAMS';
  return resultado;
}

const resultados = [];
let i = 0;
async function worker() {
  while (i < entradas.length) {
    const e = entradas[i++];
    const r = await revisar(e);
    resultados.push(r);
    const resumenCasos = r.casos.map((c) => `${c.caso.split(' ')[0]}:${c.streams}${c.espanas ? `(ESPAÑA ${c.espanas})` : ''}`).join('  ');
    console.log(`${r.veredicto.padEnd(18)} ${r.id.padEnd(22)} ${resumenCasos}${r.casos.some((c) => c.nota && !c.ok) ? '  <- ' + (r.casos.find((c) => c.nota && !c.ok).nota || '') : ''}`);
  }
}
await Promise.all(Array.from({ length: POOL }, worker));

const sello = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const salida = path.join(REPO, 'tools', 'auditoria', `verificacion-${sello}.json`);
fs.writeFileSync(salida, JSON.stringify(resultados, null, 1));

const rojos = resultados.filter((r) => r.veredicto !== 'VERDE');
console.log(`\n${resultados.length - rojos.length}/${resultados.length} en verde  →  ${salida}`);
if (rojos.length) {
  console.log('revisar: ' + rojos.map((r) => `${r.id} (${r.veredicto})`).join(', '));
  process.exit(1);
}
