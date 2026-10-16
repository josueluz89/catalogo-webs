// sitio.js — capa de megadede.mobi y de TMDB, portada a QuickJS.
// Sin new URL / matchAll: los barridos de <article> y <script> van con RegExp.exec en bucle.

import { fetchJson, fetchText } from '../shared/http.js';

export var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
export var HOST = 'https://megadede.mobi';
export var USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export var CABECERAS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'es-MX,es;q=0.9',
  'Referer': HOST + '/'
};

export function limpiarTitulo(title) {
  if (!title) return '';
  return String(title)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/:\s*.*$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9\sáéíóúñ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function consultaDe(title) {
  if (!title) return '';
  var q = String(title).split(':')[0];
  q = q.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '');
  q = q.replace(/[^a-zA-Z0-9\s\-áéíóúÁÉÍÓÚñÑ]/g, '');
  return q.replace(/\s+/g, ' ').trim();
}

export function decodificarEntidades(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–').replace(/&#8217;/g, "'").replace(/&nbsp;/g, ' ');
}

export async function pedirPagina(url, extra) {
  try {
    var cabeceras = Object.assign({}, CABECERAS, extra || {});
    var html = await fetchText(url, { headers: cabeceras });
    return html || '';
  } catch (e) {
    console.log('[Megadede] Error de fetch ' + url + ': ' + (e && e.message));
    return '';
  }
}

// Títulos (es-MX/es-ES/en-US) + año + imdb_id (para la vía rápida /vidurl/<imdb>/).
export async function datosTMDB(id, tipo) {
  var titulos = [];
  var year = '';
  var imdbId = '';
  var idiomas = ['es-MX', 'es-ES', 'en-US'];
  for (var i = 0; i < idiomas.length; i++) {
    try {
      var url = 'https://api.themoviedb.org/3/' + tipo + '/' + id + '?api_key=' + TMDB_API_KEY + '&language=' + idiomas[i];
      var res = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });
      var t = tipo === 'movie' ? res.title : res.name;
      var o = tipo === 'movie' ? res.original_title : res.original_name;
      if (t && titulos.indexOf(t) === -1) titulos.push(t);
      if (o && titulos.indexOf(o) === -1) titulos.push(o);
      if (!year) year = String(res.release_date || res.first_air_date || '').substring(0, 4);
    } catch (e) {}
  }
  try {
    var extUrl = 'https://api.themoviedb.org/3/' + tipo + '/' + id + '/external_ids?api_key=' + TMDB_API_KEY;
    var ext = await fetchJson(extUrl, { headers: { 'User-Agent': USER_AGENT } });
    imdbId = ext && ext.imdb_id ? ext.imdb_id : '';
  } catch (e) {}
  return titulos.length ? { titles: titulos, year: year, imdbId: imdbId } : null;
}

// Ruta /vidurl/... a partir del imdb_id (vía rápida del sitio).
export function rutaVidurl(imdbId, tipo, season, episode) {
  if (!imdbId) return null;
  if (tipo !== 'tv') return '/vidurl/' + imdbId + '/';
  var ep = String(episode);
  if (ep.length < 2) ep = '0' + ep; // el sitio usa 2 dígitos: 3x01
  return '/vidurl/' + imdbId + '-' + season + 'x' + ep + '/';
}

// Búsqueda en el HTML de /search?s= : cada <article> trae el href /pelicula/… o /serie/…
export async function buscarEnSitio(query, tipo) {
  var url = HOST + '/search?s=' + encodeURIComponent(query);
  console.log('[Megadede] Buscando: ' + url);
  var html = await pedirPagina(url);
  if (!html) return [];
  var limpio = html.replace(/\n|\r|\t|\s{2}/g, '');

  var resultados = [];
  var rx = /<article[^>]*>([\s\S]*?)<\/article>/g;
  var art;
  while ((art = rx.exec(limpio)) !== null) {
    var contenido = art[1];
    var hrefM = contenido.match(/href="([^"]+\/(?:pelicula|serie)\/[^"]+)"/);
    if (!hrefM) continue;
    var itemUrl = hrefM[1];
    if (itemUrl.charAt(0) === '/') itemUrl = HOST + itemUrl;
    var esPelicula = itemUrl.indexOf('/pelicula/') !== -1;
    var esSerie = itemUrl.indexOf('/serie/') !== -1;
    if (!esPelicula && !esSerie) continue;
    if (tipo === 'movie' && !esPelicula) continue;
    if (tipo !== 'movie' && !esSerie) continue;

    var altM = contenido.match(/alt="([^"]+)"/);
    var h3M = contenido.match(/<h3[^>]*>([^<]+)<\/h3>/);
    var titulo = altM ? altM[1] : (h3M ? h3M[1] : '');
    titulo = decodificarEntidades(titulo)
      .replace(/Ver\s+/, '')
      .replace(/online en HD/i, '')
      .replace(/- Película completa/i, '')
      .replace(/- Serie completa/i, '')
      .replace(/\(\d{4}\)/g, '')
      .trim();
    if (!titulo && h3M) titulo = decodificarEntidades(h3M[1]).trim();

    var yearM = contenido.match(/<span class="op6 db fz6">(\d{4})<\/span>/);
    var partes = itemUrl.split('/').filter(Boolean);
    resultados.push({
      title: titulo,
      url: itemUrl,
      slug: partes[partes.length - 1],
      year: yearM ? yearM[1] : '',
      type: esPelicula ? 'movie' : 'tv'
    });
  }
  return resultados;
}

// Saca la ruta /vidurl/... del src del iframe (puede venir absoluto). Sustituye a new URL().
export function rutaVidurlDeHtml(html) {
  var limpio = String(html || '').replace(/\n|\r|\t|\s{2}/g, '');
  var m = limpio.match(/src="([^"]*\/vidurl\/[^"]+)"/i);
  if (!m) return null;
  var valor = m[1];
  if (valor.indexOf('http') === 0) {
    var p = valor.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\/?#]+([^?#]*)/);
    return p ? p[1] : null;
  }
  return valor;
}

// Página /vidurl/…: parámetros del PoW + dataLink cifrado.
export async function paginaVidurl(ruta) {
  var url = HOST + ruta;
  console.log('[Megadede] Vidurl: ' + url);
  var html = await pedirPagina(url, { 'Referer': HOST + '/' });
  if (!html) return null;

  // El script bueno es el grande (el original buscaba scripts inline con matchAll).
  var scripts = [];
  var rx = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  var m;
  while ((m = rx.exec(html)) !== null) scripts.push(m[1]);
  var grande = null;
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].length > 5000) { grande = scripts[i]; break; }
  }
  if (!grande) {
    console.log('[Megadede] No se encontró el script del PoW.');
    return null;
  }

  var challengeM = grande.match(/const POW_CHALLENGE\s*=\s*'([^']+)'/);
  var difficultyM = grande.match(/const POW_DIFFICULTY\s*=\s*(\d+)/);
  var saltM = grande.match(/const POW_SALT\s*=\s*'([^']+)'/);
  if (!challengeM || !difficultyM || !saltM) {
    console.log('[Megadede] Sin parámetros de PoW.');
    return null;
  }
  var dataLinkM = grande.match(/(?:const|let)\s+dataLink\s*=\s*(\[[\s\S]*?\]);/);
  if (!dataLinkM) {
    console.log('[Megadede] Sin dataLink.');
    return null;
  }
  var dataLink;
  try {
    dataLink = JSON.parse(dataLinkM[1]);
  } catch (e) {
    console.log('[Megadede] dataLink ilegible: ' + (e && e.message));
    return null;
  }
  if (!Array.isArray(dataLink)) return null;

  return {
    challenge: challengeM[1],
    difficulty: parseInt(difficultyM[1], 10),
    salt: saltM[1],
    dataLink: dataLink
  };
}
