// henaojara — HenaoJara (ww1.henaojara.net).
// Portado a MasterScrap desde latinuvio (providers/henaojara.js), autor original Latinuvio.
// Adaptado a QuickJS: fuera cheerio (parseo por regex), fuera String.normalize (tabla de
// acentos propia) y filtrado a latino/subtitulado: nunca se emite espanol de Espana.
//
// Cadena verificada 2026-10-15:
//   buscar   : GET /animes?buscar=<titulo>       (<article class="li"> con ./anime/<slug>)
//   episodio : GET /ver/<slug>-<episodio>  (o /ver/<slug>): div.dwn data-dwn + .opt data-encrypt
//   servidores: POST /hj acc=opt&i=<data-encrypt>  ->  <li encrypt="<url en hex>">
//   hosts    : byse/filemoon, uqload, mp4upload, mixdrop, streamwish/vidhide (dhcplay...)
//
// Idioma: la ficha del episodio dice "Sub Español y Latino" (nunca castellano). Se marca
// 'Latino' cuando el titulo menciona latino/doblaje y 'Subtitulado' cuando solo menciona
// sub/subtitulado; una ficha con 'castellano' se descarta entera.

import { fetchText } from '../shared/http.js';
import { getEmbedResolver } from '../shared/embedResolvers.js';
import { familiaDe, resolverFamilia } from './resolvers.js';

const BASE_URL = 'https://ww1.henaojara.net';
const TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  'Referer': BASE_URL + '/',
};

// hosts que no se pueden resolver en el motor (necesitan descarga o JS pesado)
const SKIP_HOSTS = [
  'luluvdo.com', 'lulustream.com',
  'embedsb.com', 'streamsb.net',
  'hqq.tv', 'my.mail.ru',
  'terabox.com', '1fichier.com',
  'mega.nz', 'mega.co',
];

const MAX_CANDIDATOS = 8;
const MAX_STREAMS = 8;

// el resolver compartido de voe devuelve 'Unknown' cuando la URL no dice la calidad:
// en la app queda mejor 'HD' que un literal raro
function calidadDe(q) {
  var s = String(q || '');
  if (!s || s === 'Unknown') return 'HD';
  return s;
}

// ---------------------------------------------------------------------------
// normalizacion (sin String.normalize: QuickJS no trae ICU)
// ---------------------------------------------------------------------------

const ACCENTS = {
  'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
  'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
  'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
  'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
  'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
  'ñ': 'n', 'ç': 'c', 'ß': 'ss',
};

function sinAcentos(s) {
  var out = '';
  var str = String(s == null ? '' : s).toLowerCase();
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    out += ACCENTS[c] != null ? ACCENTS[c] : c;
  }
  return out;
}

function cleanTitle(s) {
  return sinAcentos(s).replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

// ---------------------------------------------------------------------------
// idioma
// ---------------------------------------------------------------------------

var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;

// devuelve 'Latino' | 'Subtitulado' | null (null = ficha de Espana, se descarta)
function etiquetaDeTitulo(titulo) {
  var t = String(titulo || '');
  if (RE_ESPANA.test(t)) return null;
  if (/latino|doblaje|\bdub\b/i.test(t)) return 'Latino';
  return 'Subtitulado';
}

function filtrarIdioma(streams) {
  var out = [];
  for (var i = 0; i < streams.length; i++) {
    var s = streams[i];
    if (!s || !s.url) continue;
    var t = String(s.title || '') + ' ' + String(s.language || '');
    if (RE_ESPANA.test(t)) continue;
    if (!RE_LATINO.test(t) && !RE_SUB.test(t)) continue;
    s.language = RE_SUB.test(t) && !RE_LATINO.test(t) ? 'Subtitulado' : 'Latino';
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

function tmdbJson(path) {
  var url = 'https://api.themoviedb.org/3/' + path + (path.indexOf('?') === -1 ? '?' : '&') + 'api_key=' + TMDB_KEY;
  return fetchText(url, { headers: { 'User-Agent': UA } }, 10000)
    .then(function (raw) { return JSON.parse(raw); })
    .catch(function () { return null; });
}

function getTmdbInfo(id, tipo) {
  return Promise.all([
    tmdbJson(tipo + '/' + id + '?language=es-MX'),
    tmdbJson(tipo + '/' + id + '?language=es-ES'),
    tmdbJson(tipo + '/' + id + '?language=en-US'),
  ]).then(function (rs) {
    var titles = [];
    function add(t) {
      if (t && titles.indexOf(t) < 0) titles.push(t);
    }
    for (var i = 0; i < rs.length; i++) {
      var res = rs[i];
      if (!res) continue;
      add(tipo === 'movie' ? res.title : res.name);
      add(tipo === 'movie' ? res.original_title : res.original_name);
    }
    return titles.length ? { titles: titles } : null;
  }).catch(function () { return null; });
}

function generateQueries(titles) {
  var queries = [];
  function addQuery(q) {
    if (!q) return;
    var cleanQ = String(q).replace(/[,;.:!?]/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (!cleanQ) return;
    if (queries.indexOf(cleanQ) < 0) queries.push(cleanQ);
    var stripped = cleanQ.replace(/^(the|los|las|el|la|lo|un|una|unos|unas)\s+/i, '');
    if (stripped !== cleanQ && queries.indexOf(stripped) < 0) queries.push(stripped);
  }
  for (var i = 0; i < titles.length; i++) addQuery(titles[i]);
  return queries;
}

// ---------------------------------------------------------------------------
// busqueda (regex en vez de cheerio)
// ---------------------------------------------------------------------------

function searchOnSite(query) {
  var url = BASE_URL + '/animes?buscar=' + encodeURIComponent(query).split('%20').join('+');
  return fetchText(url, { headers: HEADERS }, 15000)
    .then(function (html) {
      var results = [];
      var re = /<article[\s\S]*?<\/article>/gi;
      var m;
      while ((m = re.exec(html)) !== null) {
        var art = m[0];
        var hrefM = art.match(/href="\.?\/anime\/([^"\/]+)"/i);
        if (!hrefM) continue;
        var slug = hrefM[1];
        var titleM = art.match(/<h3[^>]*>\s*<a[^>]*>([^<]*)<\/a>/i) || art.match(/<h3[^>]*>([^<]*)<\/h3>/i) || art.match(/alt="([^"]*)"/i);
        var typeM = art.match(/<b[^>]*class="t"[^>]*>([^<]*)<\/b>/i) || art.match(/<b[^>]*>([^<]*)<\/b>/i);
        results.push({
          slug: slug,
          title: titleM ? titleM[1] : '',
          type: typeM ? typeM[1] : '',
        });
      }
      return results;
    })
    .catch(function () { return []; });
}

// ---------------------------------------------------------------------------
// pagina del episodio: data-dwn + servidores cifrados en hex
// ---------------------------------------------------------------------------

function hex2a(hex) {
  var str = '';
  for (var i = 0; i + 1 < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

function getServerTitle(hostname) {
  var cleanDom = String(hostname || '')
    .replace('bysesukior', 'Filemoon').replace('movearnpre', 'Vidhide')
    .replace('luluvdo', 'Lulustream').replace('dhcplay', 'Streamwish')
    .replace('listeamed', 'Vidguard').replace('rpmvip', 'RPMshare')
    .replace('yourupload', 'YourUpload').replace('mp4upload', 'MP4Upload')
    .replace('pdrain', 'PDrain').replace('hls', 'HLS')
    .replace('.com', '').replace('.net', '').replace('.org', '').replace('.top', '')
    .replace('.to', '').replace('.ac', '').replace('.sx', '').replace('.ps', '');
  return cleanDom.charAt(0).toUpperCase() + cleanDom.slice(1);
}

function hostDe(url) {
  var m = String(url || '').match(/^https?:\/\/([^\/]+)/i);
  return m ? m[1] : '';
}

function episodioHtml(slug, epNum) {
  var intentos = [
    BASE_URL + '/ver/' + slug + '-' + epNum,
    BASE_URL + '/ver/' + slug,
  ];
  function probar(i) {
    if (i >= intentos.length) return Promise.resolve(null);
    return fetchText(intentos[i], { headers: HEADERS }, 15000)
      .then(function (html) {
        if (html && html.length > 500) return { html: html, url: intentos[i] };
        return probar(i + 1);
      })
      .catch(function () { return probar(i + 1); });
  }
  return probar(0);
}

function candidatosDePagina(html, pageUrl) {
  var candidatos = [];
  var vistos = {};

  function push(url, server) {
    if (!url || url.indexOf('http') !== 0 || vistos[url]) return;
    vistos[url] = true;
    candidatos.push({ url: url, server: server || getServerTitle(hostDe(url)) });
  }

  // servidores del reproductor: <li encrypt="<url en hex>">
  var re = /<div class="dwn"[^>]*data-dwn="([^"]*)"/i;
  var dwnM = html.match(re);
  if (dwnM) {
    var json = decodeHtmlEntities(dwnM[1]).replace(/\\\//g, '/');
    try {
      var arr = JSON.parse(json);
      if (arr && arr.length) {
        for (var i = 0; i < arr.length; i++) push(arr[i], null);
      }
    } catch (e) {}
  }

  var encrypt = (html.match(/class="opt"[^>]*data-encrypt="([^"]*)"/i) || html.match(/data-encrypt="([^"]*)"/i) || [])[1];
  if (!encrypt) return Promise.resolve(candidatos);

  return fetchText(BASE_URL + '/hj', {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'accept-language': 'es-MX,es;q=0.9,en;q=0.8',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      'User-Agent': UA,
      'Referer': pageUrl,
    },
    body: 'acc=opt&i=' + encrypt,
  }, 15000).then(function (serverHtml) {
    var re2 = /<li[^>]*encrypt="([0-9a-fA-F]+)"/gi;
    var m2;
    while ((m2 = re2.exec(serverHtml)) !== null) {
      var dec = hex2a(m2[1]);
      push(dec, null);
    }
    return candidatos;
  }).catch(function () { return candidatos; });
}

// ---------------------------------------------------------------------------
// resolucion
// ---------------------------------------------------------------------------

//  - vimeos.* / vms.sh : cualquier Referer/Origin da 403; sin cabeceras responde el HLS.
//  - mp4upload.com     : solo acepta como Referer su propia URL directa.
function sanitizePlaybackHeaders(url, headers) {
  var h = {};
  var src = headers || {};
  for (var k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k)) h[k] = src[k];
  }
  var u = String(url || '').toLowerCase();
  if (/vimeos\.|vms\.sh/.test(u)) {
    delete h.Referer; delete h.referer; delete h.Origin; delete h.origin;
  } else if (/mp4upload\.com/.test(u)) {
    h.Referer = String(url || '');
  }
  return h;
}

function resolverEmbed(embedUrl) {
  if (/\.(m3u8|mp4)(\?|#|$)/i.test(embedUrl)) {
    return Promise.resolve({ url: embedUrl, quality: 'HD', headers: { 'User-Agent': UA, Referer: BASE_URL + '/' } });
  }
  var familia = familiaDe(embedUrl);
  var promesa = familia ? resolverFamilia(embedUrl, familia) : Promise.resolve(null);
  return promesa
    .then(function (r) {
      if (r && r.url) return r;
      var fn = null;
      try { fn = getEmbedResolver(embedUrl); } catch (e) { fn = null; }
      if (typeof fn !== 'function') return null;
      return Promise.resolve()
        .then(function () { return fn(embedUrl); })
        .then(function (r2) { return r2 && r2.url ? r2 : null; })
        .catch(function () { return null; });
    })
    .catch(function () { return null; });
}

// ---------------------------------------------------------------------------
// flujo principal
// ---------------------------------------------------------------------------

async function extraer(tmdbId, mediaType, season, episode) {
  var tipo = mediaType === 'movie' ? 'movie' : 'tv';
  var info = await getTmdbInfo(tmdbId, tipo);
  if (!info) return [];
  console.log('[Henaojara] Titulos TMDB: ' + info.titles.join(' | '));

  var queries = generateQueries(info.titles);
  var best = null;
  var bestScore = -1;
  var bestAny = null;
  var bestAnyScore = 4; // solo candidatos con bonus de tipo (pelicula/especial/anime)
  var vistos = {};

  for (var qi = 0; qi < queries.length; qi++) {
    var results = await searchOnSite(queries[qi]);
    console.log('[Henaojara] Busqueda "' + queries[qi] + '": ' + results.length + ' fichas');
    for (var ri = 0; ri < results.length; ri++) {
      var res = results[ri];
      if (vistos[res.slug]) continue;
      vistos[res.slug] = true;

      var score = 0;
      var cleanedResult = cleanTitle(res.title);
      for (var ti = 0; ti < info.titles.length; ti++) {
        var cleanedT = cleanTitle(info.titles[ti]);
        if (!cleanedT) continue;
        if (cleanedResult === cleanedT) score = Math.max(score, 100);
        else if (cleanedResult.indexOf(cleanedT) !== -1 || cleanedT.indexOf(cleanedResult) !== -1) score = Math.max(score, 50);
      }

      var normType = sinAcentos(res.type);
      var isPelicula = normType.indexOf('pelicula') !== -1;
      var isEspecial = normType.indexOf('especial') !== -1;
      var isMovieType = isPelicula || isEspecial;
      if (tipo === 'movie' && isPelicula) score += 15;
      else if (tipo === 'movie' && isEspecial) score += 5;
      else if (tipo === 'movie' && !isMovieType) score = Math.max(score - 20, 0);
      else if (tipo === 'tv' && !isMovieType) score += 10;

      // en temporada 1, los arcos con sufijo ("-hen", "-part", "season 2") son temporadas
      // posteriores: el slug raiz limpio recibe un empujon
      if (tipo === 'tv' && parseInt(season, 10) === 1) {
        var sufijos = [/-(arc|hen|kai|part|temporada|season)(-|$)/i, /season[\s-]\d+/i];
        var tieneSufijo = false;
        for (var si = 0; si < sufijos.length; si++) if (sufijos[si].test(res.slug)) tieneSufijo = true;
        if (!tieneSufijo) score += 8;
      }

      if (score > bestScore && score >= 40) {
        bestScore = score;
        best = res;
      }
      // el sitio traduce los titulos (p. ej. "El viaje de Chihiro" -> "Sen to Chihiro no
      // Kamikakushi"): si el buscador devolvio una ficha con el tipo pedido, vale como
      // match aunque el titulo no coincida palabra por palabra
      if (score > bestAnyScore) {
        bestAnyScore = score;
        bestAny = res;
      }
    }
    if (bestScore >= 100) break;
  }

  if (!best && bestAnyScore >= 5) {
    best = bestAny;
    bestScore = bestAnyScore;
  }

  if (!best) {
    console.log('[Henaojara] Sin coincidencia en el sitio');
    return [];
  }
  console.log('[Henaojara] Ficha: "' + best.title + '" (' + bestScore + ') -> ' + best.slug);

  var epNum = tipo === 'movie' ? 1 : (parseInt(episode, 10) || 1);
  var pagina = await episodioHtml(best.slug, epNum);
  if (!pagina) {
    console.log('[Henaojara] Pagina del episodio no encontrada');
    return [];
  }
  console.log('[Henaojara] Pagina: ' + pagina.url);

  var tituloPagina = (pagina.html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  var etiqueta = etiquetaDeTitulo(tituloPagina);   // null = castellano: fuera
  if (!etiqueta) return [];

  var candidatos = await candidatosDePagina(pagina.html, pagina.url);
  console.log('[Henaojara] Servidores: ' + candidatos.length);

  // filtra hosts sin resolver y limita el trabajo
  var tareas = [];
  for (var ci = 0; ci < candidatos.length && tareas.length < MAX_CANDIDATOS; ci++) {
    var c = candidatos[ci];
    var host = hostDe(c.url);
    var skip = false;
    for (var hi = 0; hi < SKIP_HOSTS.length; hi++) {
      if (host.indexOf(SKIP_HOSTS[hi]) !== -1) skip = true;
    }
    if (skip) continue;
    tareas.push(c);
  }
  if (!tareas.length) return [];

  var resueltos = await Promise.all(tareas.map(function (t) {
    return resolverEmbed(t.url).then(function (r) {
      if (!r || !r.url) return null;
      return {
        title: t.server + ' · ' + etiqueta,
        quality: calidadDe(r.quality),
        language: etiqueta,
        url: r.url,
        headers: sanitizePlaybackHeaders(r.url, r.headers || { 'User-Agent': UA, Referer: BASE_URL + '/' }),
      };
    });
  }));

  var streams = [];
  var vistosUrl = {};
  for (var i = 0; i < resueltos.length; i++) {
    var st = resueltos[i];
    if (!st) continue;
    if (vistosUrl[st.url]) continue;
    vistosUrl[st.url] = true;
    streams.push(st);
    if (streams.length >= MAX_STREAMS) break;
  }

  return filtrarIdioma(streams);
}

export { extraer };
