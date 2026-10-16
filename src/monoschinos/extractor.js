// monoschinos — MonosChinos (vww.monoschinos2.net).
// Portado a MasterScrap desde latinuvio (providers/monoschinos.js), autor original Latinuvio.
// Adaptado a QuickJS: sin require() de hermanos (resolvers inlineados en ./resolvers.js),
// sin Buffer (base64 propio), sin matchAll (bucles con RegExp.exec) y filtrado a
// latino/subtitulado; jamas se emite un stream de espanol de Espana.
//
// Cadena verificada 2026-10-15:
//   buscar   : GET /animes?buscar=<titulo>          (tarjetas <li class="...ficha_efecto">)
//   serie    : GET /anime/<slug>                    (data-i / data-u)
//   episodio : POST /ajax_pagination acc=episodes&i=&u=&p=1  (articles con alt "... episodio N")
//   embeds   : GET /ver/<slug>  (target=_blank) + POST ajax acc=opt&i=<data-encrypt>
//              (botones data-player en base64 -> URL del host)
//   hosts    : byse/filemoon, uqload, mp4upload, mixdrop, dhcplay/voe/filelions/streamwish...

import { fetchText } from '../shared/http.js';
import { getEmbedResolver } from '../shared/embedResolvers.js';
import { familiaDe, resolverFamilia } from './resolvers.js';

const HOST = 'https://vww.monoschinos2.net';
const TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9',
  'Referer': HOST + '/',
};

const MAX_EMBEDS = 8;
const MAX_STREAMS = 8;

// el resolver compartido de voe devuelve 'Unknown' cuando la URL no dice la calidad:
// en la app queda mejor 'HD' que un literal raro
function calidadDe(q) {
  var s = String(q || '');
  if (!s || s === 'Unknown') return 'HD';
  return s;
}

// ---------------------------------------------------------------------------
// normalizacion de titulos (sin String.normalize)
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

function norm(s) {
  return sinAcentos(s).replace(/[^a-z0-9]/g, '');
}

var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function base64ToBytes(input) {
  var str = String(input || '').replace(/=+$/, '');
  var out = [];
  var bs = 0;
  var bc = 0;
  for (var i = 0; i < str.length; i++) {
    var idx = B64_CHARS.indexOf(str.charAt(i));
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) out.push(255 & (bs >> ((-2 * bc) & 6)));
  }
  return out;
}

function base64ToText(input) {
  var bytes = base64ToBytes(input);
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

// ---------------------------------------------------------------------------
// idioma: DUB -> latino, sin marca -> subtitulado (nunca espanol de Espana)
// ---------------------------------------------------------------------------

var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;

function etiquetaDeTitulo(titulo) {
  var t = String(titulo || '');
  if (RE_ESPANA.test(t)) return null;          // ficha castellana: fuera
  if (/dub|doblaje|latino/i.test(t)) return 'Latino';
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
// TMDB + busqueda
// ---------------------------------------------------------------------------

function getTmdbInfo(id, tipo) {
  var url = 'https://api.themoviedb.org/3/' + tipo + '/' + id + '?api_key=' + TMDB_KEY + '&language=es-MX';
  return fetchText(url, { headers: { 'User-Agent': UA } }, 10000)
    .then(function (raw) {
      var res = JSON.parse(raw);
      return {
        title: tipo === 'movie' ? res.title || res.original_title : res.name || res.original_name,
        originalTitle: tipo === 'movie' ? res.original_title || res.title : res.original_name || res.name,
      };
    })
    .catch(function () { return null; });
}

function searchSite(searchTitle) {
  var url = HOST + '/animes?buscar=' + encodeURIComponent(searchTitle);
  return fetchText(url, { headers: HEADERS }, 15000)
    .then(function (html) {
      var ns = norm(searchTitle);
      if (!ns) return null;
      var bloques = [];
      var re = /ficha_efecto">([\s\S]*?)<\/li>/gi;
      var m;
      while ((m = re.exec(html)) !== null) bloques.push(m[1]);
      for (var i = 0; i < bloques.length; i++) {
        var block = bloques[i];
        var title = (block.match(/title="([^"]*)"/) || [])[1] || '';
        var href = (block.match(/href="([^"]*)"/) || [])[1] || '';
        if (!title || !href) continue;
        var cleanTitle = title.replace('Ver Anime', '').replace('Online Gratis', '').replace(/&quot;|&amp;|&#039;/g, '').replace(/^\s+|\s+$/g, '');
        var nct = norm(cleanTitle);
        if (!nct) continue;
        if (nct.indexOf(ns) !== -1 || ns.indexOf(nct) !== -1) {
          return href.replace('./', HOST + '/');
        }
      }
      return null;
    })
    .catch(function () { return null; });
}

function getEpisodeUrl(seriesUrl, episode) {
  return fetchText(seriesUrl, { headers: HEADERS }, 15000)
    .then(function (html) {
      var dataI = (html.match(/data-i="([^"]+)"/) || [])[1];
      var dataU = (html.match(/data-u="([^"]+)"/) || [])[1];
      if (!dataI || !dataU) return null;
      var body = 'acc=episodes&i=' + encodeURIComponent(dataI) + '&u=' + encodeURIComponent(dataU) + '&p=1';
      return fetchText(HOST + '/ajax_pagination', {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,*/*',
          'Accept-Language': 'es-MX,es;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': seriesUrl,
        },
        body: body,
      }, 15000).then(function (ajaxHtml) {
        var targetEp = String(parseInt(episode, 10) || 1);
        var re = /<article>([\s\S]*?)<\/article>/gi;
        var m;
        while ((m = re.exec(ajaxHtml)) !== null) {
          var article = m[1];
          var epUrl = (article.match(/href="([^"]+)"/) || [])[1] || '';
          var alt = article.match(/alt="[^"]*episodio\s*(\d+)/i) || article.match(/alt="[^"]*capitulo\s*(\d+)/i);
          var epNum = alt ? alt[1] : '';
          if (epUrl && epNum === targetEp) return epUrl;
        }
        return null;
      }).catch(function () { return null; });
    })
    .catch(function () { return null; });
}

function getEmbedUrls(episodeUrl) {
  return fetchText(episodeUrl, { headers: HEADERS }, 15000)
    .then(function (html) {
      var embeds = [];
      var vistos = {};
      function push(u) {
        if (!u || vistos[u]) return;
        vistos[u] = true;
        embeds.push(u);
      }

      // enlaces directos (target="_blank")
      var re = /target="_blank"\s+href="(https?:\/\/[^"]+)"/gi;
      var m;
      while ((m = re.exec(html)) !== null) {
        if (!/rpmplayer\./.test(m[1])) push(m[1]);
      }

      // botones de reproductor (data-encrypt -> POST ajax -> data-player base64)
      var encrypt = (html.match(/data-encrypt="([^"]+)"/) || [])[1];
      if (!encrypt) return embeds;
      return fetchText(HOST + '/ajax_pagination', {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,*/*',
          'Accept-Language': 'es-MX,es;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': episodeUrl,
        },
        body: 'acc=opt&i=' + encodeURIComponent(encrypt),
      }, 15000).then(function (ajaxHtml) {
        var re2 = /data-player="([^"]+)"/gi;
        var m2;
        while ((m2 = re2.exec(ajaxHtml)) !== null) {
          var url = base64ToText(m2[1]);
          if (url.indexOf('http') === 0 && !/rpmplayer\./.test(url)) push(url);
        }
        return embeds;
      }).catch(function () { return embeds; });
    })
    .catch(function () { return []; });
}

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

// resolucion: familia local (vidhide/streamwish) -> resolvers compartidos
function resolverEmbed(embedUrl) {
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

async function extraer(tmdbId, mediaType, season, episode, title) {
  var tipo = mediaType === 'movie' ? 'movie' : 'tv';
  if (!tmdbId && !title) return [];

  var candidatos = [];
  if (title) candidatos.push(title);
  var info = await getTmdbInfo(tmdbId, tipo);
  if (info) {
    if (info.title && candidatos.indexOf(info.title) < 0) candidatos.push(info.title);
    if (info.originalTitle && candidatos.indexOf(info.originalTitle) < 0) candidatos.push(info.originalTitle);
  }
  if (!candidatos.length) return [];

  var seriesUrl = null;
  for (var ci = 0; ci < candidatos.length; ci++) {
    seriesUrl = await searchSite(candidatos[ci]);
    if (seriesUrl) break;
  }
  if (!seriesUrl) return [];

  // la ficha no debe ser una entrada de castellano
  var pageUrl = seriesUrl;
  if (tipo === 'tv' && episode) {
    var epUrl = await getEpisodeUrl(seriesUrl, episode);
    if (!epUrl) return [];
    pageUrl = epUrl;
  } else if (tipo === 'tv') {
    return []; // sin episodio no hay nada que ver
  }
  if (/castellano/i.test(pageUrl)) return [];

  var embeds = await getEmbedUrls(pageUrl);
  if (!embeds.length) return [];
  if (embeds.length > MAX_EMBEDS) embeds = embeds.slice(0, MAX_EMBEDS);

  var etiqueta = etiquetaDeTitulo(pageUrl);
  if (!etiqueta) return [];

  var resueltos = await Promise.all(embeds.map(function (embedUrl) {
    var server = (embedUrl.match(/:\/\/(?:www\.)?([^.]+)\./) || [])[1] || '?';
    return resolverEmbed(embedUrl).then(function (r) {
      if (!r || !r.url) return null;
      return {
        title: server + ' · ' + etiqueta,
        quality: calidadDe(r.quality),
        language: etiqueta,
        url: r.url,
        headers: sanitizePlaybackHeaders(r.url, r.headers || { Referer: embedUrl, 'User-Agent': UA }),
        __embed: embedUrl,
      };
    });
  }));

  var streams = [];
  var vistos = {};
  for (var i = 0; i < resueltos.length; i++) {
    var s = resueltos[i];
    if (!s) continue;
    if (vistos[s.url]) continue;
    vistos[s.url] = true;
    delete s.__embed;
    streams.push(s);
    if (streams.length >= MAX_STREAMS) break;
  }

  return filtrarIdioma(streams);
}

export { extraer };
