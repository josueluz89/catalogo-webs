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

const MAX_EMBEDS = 4;
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

function getTmdbAltTitles(id, tipo) {
  // Titulos alternativos (el sitio usa el romaji: "Sen to Chihiro no Kamikakushi"
  // para "El viaje de Chihiro"; TMDB lo trae como alternative_title JP Romaji).
  // TV responde {results:[{title}]} y movie {titles:[{title}]}.
  var url = 'https://api.themoviedb.org/3/' + tipo + '/' + id + '/alternative_titles?api_key=' + TMDB_KEY;
  return fetchText(url, { headers: { 'User-Agent': UA } }, 10000)
    .then(function (raw) {
      var res = JSON.parse(raw);
      var arr = res.titles || res.results || [];
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].title && out.indexOf(arr[i].title) < 0) out.push(arr[i].title);
      }
      return out;
    })
    .catch(function () { return []; });
}

function searchSite(searchTitle) {
  var ns = norm(searchTitle);
  if (!ns) return Promise.resolve(null);
  var url = HOST + '/animes?buscar=' + encodeURIComponent(searchTitle);
  return fetchText(url, { headers: HEADERS }, 15000)
    .then(function (html) {
      var bloques = [];
      var re = /ficha_efecto">([\s\S]*?)<\/li>/gi;
      var m;
      while ((m = re.exec(html)) !== null) bloques.push(m[1]);
      // El primer match por substring gana la ficha equivocada: TMDB llama a la
      // serie "Los Caballeros del Zodiaco" y el primer resultado que contiene
      // ese texto es la PELICULA "Legend of Sanctuary (Los Caballeros del
      // Zodiaco: ...)", cuya lista de episodios no tiene el cap. pedido -> [].
      // Se puntua cada candidato y gana el mas cercano al titulo buscado:
      // exacto = 100; substring = 50 menos la diferencia de largo (la ficha
      // correcta es la mas corta entre las que contienen el titulo).
      var best = null;
      var bestScore = 0;
      for (var i = 0; i < bloques.length; i++) {
        var block = bloques[i];
        var title = (block.match(/title="([^"]*)"/) || [])[1] || '';
        var href = (block.match(/href="([^"]*)"/) || [])[1] || '';
        if (!title || !href) continue;
        var cleanTitle = title.replace('Ver Anime', '').replace('Online Gratis', '').replace(/&quot;|&amp;|&#039;/g, '').replace(/^\s+|\s+$/g, '');
        var nct = norm(cleanTitle);
        if (!nct) continue;
        var score = 0;
        if (nct === ns) score = 100;
        else if (nct.indexOf(ns) !== -1 || ns.indexOf(nct) !== -1) {
          score = 50 - Math.min(20, Math.floor(Math.abs(nct.length - ns.length) / 2));
        }
        if (score > bestScore) {
          bestScore = score;
          best = href.indexOf('http') === 0 ? href : href.replace('./', HOST + '/');
        }
      }
      return best ? { url: best, score: bestScore } : null;
    })
    .catch(function () { return null; });
}

function getEpisodeUrl(seriesUrl, episode) {
  return fetchText(seriesUrl, { headers: HEADERS }, 15000)
    .then(function (html) {
      var dataI = (html.match(/data-i="([^"]+)"/) || [])[1];
      var dataU = (html.match(/data-u="([^"]+)"/) || [])[1];
      if (!dataI || !dataU) return null;
      var targetEp = String(parseInt(episode, 10) || 1);
      // Episodios en orden inverso (el mas nuevo primero), 50 por pagina: el
      // cap. 1 de una serie larga NO esta en p=1 (Saint Seiya, 114 caps, lo
      // tiene en p=3). Se recorren paginas hasta encontrarlo o agotarlas.
      function buscarEnPagina(p) {
        var body = 'acc=episodes&i=' + encodeURIComponent(dataI) + '&u=' + encodeURIComponent(dataU) + '&p=' + p;
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
          var re = /<article>([\s\S]*?)<\/article>/gi;
          var m;
          var count = 0;
          var found = null;
          while ((m = re.exec(ajaxHtml)) !== null) {
            count++;
            var article = m[1];
            var epUrl = (article.match(/href="([^"]+)"/) || [])[1] || '';
            var alt = article.match(/alt="[^"]*episodio\s*(\d+)/i) || article.match(/alt="[^"]*capitulo\s*(\d+)/i);
            var epNum = alt ? alt[1] : '';
            if (epUrl && epNum === targetEp) found = epUrl;
          }
          if (found) return found;
          if (count === 0 || p >= 5) return null;
          return buscarEnPagina(p + 1);
        }).catch(function () { return null; });
      }
      return buscarEnPagina(1);
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

  var candidatosMain = [];
  if (title) candidatosMain.push(title);
  var info = await getTmdbInfo(tmdbId, tipo);
  if (info) {
    if (info.title && candidatosMain.indexOf(info.title) < 0) candidatosMain.push(info.title);
    if (info.originalTitle && candidatosMain.indexOf(info.originalTitle) < 0) candidatosMain.push(info.originalTitle);
  }
  var altTitles = await getTmdbAltTitles(tmdbId, tipo);
  var candidatosAlt = [];
  for (var ai = 0; ai < altTitles.length && candidatosAlt.length < 9; ai++) {
    if (candidatosMain.indexOf(altTitles[ai]) < 0 && candidatosAlt.indexOf(altTitles[ai]) < 0) candidatosAlt.push(altTitles[ai]);
  }
  var candidatos = candidatosMain.concat(candidatosAlt);
  if (!candidatos.length) return [];

  var seriesUrl = null;
  var bestScore = -1;
  for (var ci = 0; ci < candidatos.length; ci++) {
    // Un match de titulo principal basta: los alternativos NO lo desplazan.
    // Sin esto, el alternativo 'Saint Seiya' (100 exacto) reemplazaba la ficha
    // buena 'Saint Seiya (Los Caballeros del Zodiaco)' (45) por la duplicada
    // /anime/saint-seiya, cuyo cap. 1 solo trae embeds muertos (mega,
    // zippyshare, streamtape) y el provider quedaba en 0 streams.
    if (ci >= candidatosMain.length && bestScore > 0) break;
    var hit = await searchSite(candidatos[ci]);
    if (hit && hit.score > bestScore) {
      bestScore = hit.score;
      seriesUrl = hit.url;
    }
    if (bestScore >= 100) break;
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
  } else if (tipo === 'movie') {
    // En el sitio la pelicula vive como "episodio 1" (/ver/<slug>-episodio-1):
    // la ficha /anime/<slug> no trae reproductores. Si no hay lista de
    // episodios, se cae a la ficha como antes.
    var epUrlM = await getEpisodeUrl(seriesUrl, 1);
    if (epUrlM) pageUrl = epUrlM;
  }
  if (/castellano/i.test(pageUrl)) return [];

  var embeds = await getEmbedUrls(pageUrl);
  if (!embeds.length) return [];
  // Priorizar los hosts que resuelven (uqload, mp4upload) y descartar de
  // entrada los que acaban en null (byse/filemoon, mixdrop sin resolver):
  // en el caso anime eran intentos perdidos antes de los que sí resuelven.
  embeds = embeds.filter(function (u) { return !/byse|mixdrop/i.test(u); });
  embeds.sort(function (a, b) {
    var pa = /uqload|mp4upload/i.test(a) ? 0 : 1;
    var pb = /uqload|mp4upload/i.test(b) ? 0 : 1;
    return pa - pb;
  });
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
