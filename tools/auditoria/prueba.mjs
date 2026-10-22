// prueba.mjs — corre cada provider de terceros y mira QUÉ devuelve: cuántos streams,
// con qué etiqueta de idioma (latino / sub / castellano / inglés) y si la URL es reproducible.
//
// Uso:  node prueba.mjs            → todos los candidatos vivos
//       node prueba.mjs vimeus areshd
import fs from 'node:fs';
import path from 'node:path';
import { cargar } from './cargar.mjs';

const D = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const CASOS_BASE = [
  { tipo: 'movie', tmdb: '693134', titulo: 'Dune: Part Two', year: '2024' },
  { tipo: 'tv', tmdb: '76479', titulo: 'The Boys', season: 3, episode: 1 },
];
const CASOS_ANIME = [
  { tipo: 'tv', tmdb: '95479', titulo: 'Jujutsu Kaisen', season: 1, episode: 1 },
  { tipo: 'movie', tmdb: '129', titulo: 'Spirited Away', year: '2001' },
];
const CASOS_DORAMA = [
  { tipo: 'tv', tmdb: '117376', titulo: 'Vincenzo', season: 1, episode: 1 },
  { tipo: 'tv', tmdb: '99966', titulo: 'Estamos Muertos', season: 1, episode: 1 },
];
const CASOS_SERIE = [
  { tipo: 'tv', tmdb: '1396', titulo: 'Breaking Bad', season: 1, episode: 1 },
  { tipo: 'tv', tmdb: '94605', titulo: 'Arcane', season: 1, episode: 1 },
  { tipo: 'tv', tmdb: '76479', titulo: 'The Boys', season: 3, episode: 1 },
];
const CASOS_TODOS = [
  ...CASOS_SERIE,
  { tipo: 'tv', tmdb: '95479', titulo: 'Jujutsu Kaisen', season: 1, episode: 1 },
  { tipo: 'tv', tmdb: '117376', titulo: 'Vincenzo', season: 1, episode: 1 },
  { tipo: 'movie', tmdb: '693134', titulo: 'Dune: Part Two', year: '2024' },
];

// id → {file, casos}
const OBJETIVOS = {
  sololatino:            { origen: 'adrian',    file: 'sololatino.js' },
  pelisgo:               { origen: 'adrian',    file: 'pelisgo.js' },
  pelispanda:            { origen: 'adrian+latinuvio', file: 'pelispanda.js', fileAlt: 'latinuvio' },
  hackstore:             { origen: 'adrian+latinuvio', file: 'hackstore2.js' },
  cinemacity:            { origen: 'adrian',    file: 'cinemacity.js' },
  videasy:               { origen: 'adrian',    file: 'videasy.js' },
  vimeus:                { origen: 'latinuvio', file: 'vimeus.js' },
  areshd:                { origen: 'latinuvio', file: 'areshd.js' },
  doramasflix:           { origen: 'latinuvio', file: 'doramasflix.js', casos: CASOS_DORAMA },
  verpelis:              { origen: 'latinuvio', file: 'verpelis.js' },
  allpeliculasse:        { origen: 'latinuvio', file: 'allpeliculasse.js' },
  elifilms:              { origen: 'latinuvio', file: 'elifilms.js' },
  megadedeoficial:       { origen: 'latinuvio', file: 'megadedeoficial.js' },
  pelis182:              { origen: 'latinuvio', file: 'pelis182.js' },
  pelisyseries:          { origen: 'latinuvio', file: 'pelisyseries.js' },
  animeav1:              { origen: 'latinuvio', file: 'animeav1.js', casos: CASOS_ANIME },
  henaojara:             { origen: 'latinuvio', file: 'henaojara.js', casos: CASOS_ANIME },
  monoschinos:           { origen: 'latinuvio', file: 'monoschinos.js', casos: CASOS_ANIME },
};

const RX = {
  latino: /latino|latin[ -]?a|lat\b|\[lat\]/i,
  castellano: /castellano|espa(ñ|n)ol de espa(ñ|n)a/i,
  sub: /\bsub\b|subtitulad|\bvos[ei]\b|\bsubs?\b|\[sub\]/i,
  spa: /\bspa\b|\besp\b|\bes\b|espa(ñ|n)ol/i,
  ingles: /ingl|\benglish\b|\beng\b/i,
  dual: /dual/i,
};

function idiomas(streams) {
  const set = new Set();
  for (const s of streams || []) {
    const t = [s.title, s.name, s.language, s.quality, s.description].filter(Boolean).join(' | ');
    for (const [k, rx] of Object.entries(RX)) if (rx.test(t)) set.add(k);
  }
  return [...set];
}

function hostDe(url) {
  try { return new URL(url).host; } catch { return '?'; }
}

async function conTimeout(promesa, ms) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout ' + ms + 'ms')), ms); });
  try { return await Promise.race([promesa, timeout]); } finally { clearTimeout(t); }
}

async function correrPrueba(id, cfg) {
  const dir = cfg.origen.startsWith('latinuvio') ? 'latinuvio' : 'adrian';
  const ruta = path.join(D, dir, cfg.file);
  const salida = { id, origen: cfg.origen, archivo: ruta, casos: [], veredicto: 'SIN STREAMS' };
  const logs = [];
  let exp;
  try {
    const r = cargar(ruta, { log: (nivel, abs, args) => logs.push(nivel + ' ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').slice(0, 300)) });
    exp = r.exp;
  } catch (e) {
    salida.error = 'carga: ' + e.message; salida.veredicto = 'NO CARGA';
    salida.logs = logs.slice(0, 40);
    return salida;
  }
  if (typeof exp.getStreams !== 'function') {
    salida.error = 'no exporta getStreams (' + Object.keys(exp || {}).join(',') + ')';
    salida.veredicto = 'NO CARGA';
    return salida;
  }
  const casos = cfg.casos || CASOS_BASE;
  let total = 0;
  const idiomasTodos = new Set();
  for (const c of casos) {
    const t0 = Date.now();
    const detalle = { caso: `${c.tipo} ${c.tmdb}${c.season ? ` S${c.season}E${c.episode}` : ''} (${c.titulo})`, streams: 0 };
    const marcas = [];
    try {
      const args4 = c.tipo === 'movie'
        ? [c.tmdb, 'movie', null, null]
        : [c.tmdb, 'tv', c.season, c.episode];
      let streams = await conTimeout(Promise.resolve(exp.getStreams(...args4)), 75000);
      if ((!streams || !streams.length) && (c.titulo)) {
        marcas.push('reintento con title/year');
        const args6 = c.tipo === 'movie'
          ? [c.tmdb, 'movie', null, null, c.titulo, c.year]
          : [c.tmdb, 'tv', c.season, c.episode, c.titulo];
        streams = await conTimeout(Promise.resolve(exp.getStreams(...args6)), 75000);
      }
      streams = Array.isArray(streams) ? streams : [];
      detalle.streams = streams.length;
      detalle.muestras = streams.slice(0, 8).map(s => ({
        title: String(s.title || s.name || '').slice(0, 90),
        quality: s.quality || '',
        language: s.language || '',
        host: hostDe(s.url || ''),
        url: String(s.url || '').slice(0, 300),
        headers: s.headers ? Object.keys(s.headers).join(',') : '',
      }));
      // sondeo: ¿el enlace responde de verdad (m3u8 o video) con los headers del stream?
      detalle.sondeos = [];
      for (const s of streams.slice(0, 3)) {
        const sondeo = { host: hostDe(s.url || ''), resultado: '?' };
        try {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 20000);
          const r = await fetch(s.url, {
            method: 'GET',
            redirect: 'follow',
            headers: { ...(s.headers || {}), Range: 'bytes=0-4096' },
            signal: c.signal,
          });
          clearTimeout(t);
          const cuerpo = await r.text();
          const ctype = r.headers.get('content-type') || '';
          sondeo.status = r.status;
          sondeo.ctype = ctype.slice(0, 40);
          sondeo.m3u8 = /#EXTM3U/i.test(cuerpo);
          sondeo.bytes = cuerpo.length;
          sondeo.resultado = (r.status === 200 || r.status === 206) ? (sondeo.m3u8 ? 'm3u8 OK' : 'responde OK') : 'HTTP ' + r.status;
        } catch (e) {
          sondeo.resultado = 'falla: ' + e.message.slice(0, 60);
        }
        detalle.sondeos.push(sondeo);
      }
      detalle.idiomas = idiomas(streams);
      detalle.marcas = marcas;
      detalle.ms = Date.now() - t0;
      detalle.urls_validas = streams.filter(s => /^https?:\/\//.test(s.url || '')).length;
      total += streams.length;
      detalle.idiomas.forEach(x => idiomasTodos.add(x));
    } catch (e) {
      detalle.error = e.message;
      detalle.ms = Date.now() - t0;
    }
    salida.casos.push(detalle);
  }
  salida.total_streams = total;
  salida.idiomas = [...idiomasTodos];
  const tieneLatino = idiomasTodos.has('latino');
  const tieneSub = idiomasTodos.has('sub');
  const soloCastellano = idiomasTodos.has('castellano') || (salida.idiomas.includes('spa') && !tieneLatino && !tieneSub);
  salida.veredicto = total === 0 ? 'SIN STREAMS'
    : (tieneLatino || tieneSub) ? 'SIRVE (latino/sub)'
    : soloCastellano ? 'SOLO CASTELLANO'
    : 'SIRVE (revisar idioma)';
  salida.logs = logs.slice(0, 60);
  return salida;
}

const args = process.argv.slice(2);
const flagCasos = args.find(a => a.startsWith('--casos='));
const modo = flagCasos ? flagCasos.split('=')[1] : null;
const MAPA_CASOS = { base: CASOS_BASE, anime: CASOS_ANIME, dorama: CASOS_DORAMA, serie: CASOS_SERIE, todos: CASOS_TODOS };
if (modo && MAPA_CASOS[modo]) for (const k of Object.keys(OBJETIVOS)) OBJETIVOS[k].casos = MAPA_CASOS[modo];
const pedidos = args.filter(a => !a.startsWith('--'));
const ids = pedidos.length ? pedidos : Object.keys(OBJETIVOS);
const resultados = [];
let i = 0;
async function worker() {
  while (i < ids.length) {
    const id = ids[i++];
    const cfg = OBJETIVOS[id];
    if (!cfg) { console.error('objetivo desconocido:', id); continue; }
    const r = await correrPrueba(id, cfg);
    resultados.push(r);
    console.log(`${r.veredicto.padEnd(22)} ${id.padEnd(22)} streams=${r.total_streams ?? 0} idiomas=[${(r.idiomas || []).join(',')}] ${r.error ? 'ERR ' + r.error : ''}`);
  }
}
await Promise.all(Array.from({ length: Number(process.env.WORKERS || 4) }, worker));
const salidaJson = path.join(D, modo ? `resultados-${modo}.json` : 'resultados.json');
fs.writeFileSync(salidaJson, JSON.stringify(resultados, null, 1));
console.log('\n-> ' + salidaJson);
