// monoschinos — MonosChinos (vww.monoschinos2.net). Reescrito 2026-10-27.
//
// Por qué se reescribió:
//  1. Attack on Titan daba 0 en silencio: el código solo pedía TMDB en
//     es-MX ("Attack on Titan") y los 9 primeros alternativos (todos en
//     alfabetos no latinos: bengalí, búlgaro, ruso, chino...). El romaji
//     "Shingeki no Kyojin", que es como el sitio indexa la serie, es el
//     alternativo nº 26 y nunca se probaba; además, si un título principal
//     daba cualquier substring, el bucle de alternativos se cortaba.
//  2. Dragon Ball Super tardaba 85 s: búsquedas en serie, paginación de
//     episodios en serie (el cap. 1 de una serie larga está en la última
//     página) y resolución de todos los embeds en un solo Promise.all
//     esperando al resolver más lento.
//
// Reglas nuevas:
//  - TMDB en paralelo (es-MX, es-ES, en-US + alternativos latinos) y cada
//    ficha del sitio se puntúa contra TODOS los títulos: así la búsqueda
//    "Attack on Titan" ya casa exacto con la ficha "Shingeki no Kyojin".
//  - Solo se resuelve una ficha con coincidencia exacta (o substring
//    fuerte) y nunca castellana ni de temporada distinta; si la ficha
//    elegida no da episodio/streams, se prueba la siguiente candidata
//    (la duplicada "Saint Seiya" sin episodios no puede dejar al provider
//    en 0 si existe la ficha buena).
//  - El episodio se toma directo de /ver/<slug>-episodio-<N> (verificado
//    2026-10-27 para DBS y AoT); la paginación ajax queda solo de respaldo.
//  - Resolución por oleadas con parada temprana (uqload/mp4upload, luego
//    voe, luego resto) y tope de 2 streams.
//
// Cadena verificada 2026-10-27:
//   buscar   : GET /animes?buscar=<titulo>          (tarjetas <li class="...ficha_efecto">)
//   episodio : GET /ver/<slug>-episodio-<N>         (target=_blank + data-encrypt)
//   embeds   : POST ajax_pagination acc=opt&i=<data-encrypt> (data-player en base64)
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
const MAX_CANDIDATOS = 3;
const MAX_QUERIES = 15;

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
  'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a', 'ā': 'a',
  'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e', 'ē': 'e',
  'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i', 'ī': 'i',
  'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o', 'ō': 'o',
  'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u', 'ū': 'u',
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

function norm(s) {
  return cleanTitle(s).replace(/\s+/g, '');
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

// Título del sitio limpio: sin "Ver Anime ... Online Gratis" y sin sufijo
// de idioma ("Shingeki no Kyojin 3 Parte 2 Castellano" -> base con "3 Parte 2").
var LANG_TAIL = ['latino', 'castellano', 'subtitulado', 'sub', 'espanol', 'espana', 'doblaje', 'dub', 'audio', 'vose', 'vosi'];
function baseDeTitulo(titulo) {
  var t = cleanTitle(titulo)
    .replace(/^ver anime\s+/i, '')
    .replace(/\s+online gratis$/i, '');
  var words = t.split(' ');
  while (words.length > 1 && LANG_TAIL.indexOf(words[words.length - 1]) !== -1) words.pop();
  return words.join(' ');
}

function sinArticulo(t) {
  return String(t || '').replace(/^(the|los|las|el|la|lo|un|una|unos|unas)\s+/i, '');
}

function esCastellano(titulo, slug) {
  var t = sinAcentos(titulo) + ' ' + sinAcentos(slug);
  return t.indexOf('castellano') !== -1;
}

// Marca de temporada: "temporada 3", "season 2", "3 parte 2", número final,
// "final season". Devuelve el número o null.
function marcaTemporada(base, slug) {
  var t = ' ' + cleanTitle(base) + ' ' + cleanTitle(slug) + ' ';
  var m = t.match(/\btemporada\s+(\d+)\b/) || t.match(/\bseason\s+(\d+)\b/);
  if (m) return parseInt(m[1], 10);
  if (t.indexOf(' final season ') !== -1) return 99;
  m = t.match(/\s(\d+)\s+parte\s/) || t.match(/\s(\d+)\s+part\s/);
  if (m) return parseInt(m[1], 10);
  m = cleanTitle(base).match(/\s(\d+)$/);
  if (m) return parseInt(m[1], 10);
  return null;
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
// TMDB + busqueda + puntuacion
// ---------------------------------------------------------------------------

function tmdbJson(path) {
  var url = 'https://api.themoviedb.org/3/' + path + (path.indexOf('?') === -1 ? '?' : '&') + 'api_key=' + TMDB_KEY;
  return fetchText(url, { headers: { 'User-Agent': UA } }, 10000)
    .then(function (raw) { return JSON.parse(raw); })
    .catch(function () { return null; });
}

// Títulos candidatos en orden de preferencia. Los alternativos solo cuentan
// si dejan algo en alfabeto latino tras limpiar (el romaji sí; el japonés,
// chino o cirílico no, porque el sitio no indexa con esos alfabetos).
// Sin el filtro latino, los 9 primeros alternativos de AoT eran todos no
// latinos y el romaji (nº 26) nunca se probaba.
function getTmdbInfo(id, tipo) {
  return Promise.all([
    tmdbJson(tipo + '/' + id + '?language=es-MX'),
    tmdbJson(tipo + '/' + id + '?language=es-ES'),
    tmdbJson(tipo + '/' + id + '?language=en-US'),
    tmdbJson(tipo + '/' + id + '/alternative_titles'),
  ]).then(function (rs) {
    var titles = [];
    function add(t) {
      if (!t) return;
      if (titles.indexOf(t) < 0) titles.push(t);
    }
    for (var i = 0; i < 3; i++) {
      var res = rs[i];
      if (!res) continue;
      add(tipo === 'movie' ? res.title : res.name);
      add(tipo === 'movie' ? res.original_title : res.original_name);
    }
    var alts = rs[3];
    if (alts) {
      var arr = alts.titles || alts.results || [];
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && arr[j].title && cleanTitle(arr[j].title)) add(arr[j].title);
      }
    }
    return titles.length ? { titles: titles } : null;
  }).catch(function () { return null; });
}

// Objetivos de coincidencia para la temporada pedida. En temporada 1 el
// título pelado basta; en temporada N solo valen las variantes con marca
// de esa temporada (una ficha pelada es la temporada 1, no la N).
function objetivos(titles, season) {
  var s = parseInt(season, 10) || 1;
  var out = [];
  function add(t) {
    var c = cleanTitle(t);
    if (c && out.indexOf(c) < 0) out.push(c);
  }
  for (var i = 0; i < titles.length; i++) {
    if (s === 1) {
      add(titles[i]);
      add(titles[i] + ' temporada 1');
      add(titles[i] + ' season 1');
    } else {
      add(titles[i] + ' temporada ' + s);
      add(titles[i] + ' season ' + s);
      add(titles[i] + ' ' + s);
    }
  }
  return out;
}

// Puntuación de una ficha contra los objetivos:
//   100 = coincidencia exacta del título base (o sin artículo inicial)
//    50 = un objetivo completo contenido en la base o viceversa
//    -1 = descartada: castellana, o marca de temporada distinta de la pedida
// idx = índice del objetivo que casó: si dos fichas casan exacto, gana la
// que casa con el título más principal (la serie antes que un spin-off
// cuyo título también está en los alternativos de TMDB).
function puntuarFicha(siteTitle, slug, targets, season) {
  if (esCastellano(siteTitle, slug)) return { score: -1, idx: 9999 };
  var base = baseDeTitulo(siteTitle);
  var s = parseInt(season, 10) || 1;
  var marca = marcaTemporada(base, slug);
  if (marca !== null && marca !== s) return { score: -1, idx: 9999 };
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    if (base === t || sinArticulo(base) === sinArticulo(t)) return { score: 100, idx: i };
  }
  var best = -1;
  var bestIdx = 9999;
  for (var j = 0; j < targets.length; j++) {
    var tj = targets[j];
    if (base.indexOf(tj) !== -1 || tj.indexOf(base) !== -1) {
      var sc = 50 - Math.min(20, Math.floor(Math.abs(base.length - tj.length) / 2));
      if (sc > best) { best = sc; bestIdx = j; }
    }
  }
  return { score: best, idx: bestIdx };
}

function searchSite(searchTitle) {
  var url = HOST + '/animes?buscar=' + encodeURIComponent(searchTitle);
  return fetchText(url, { headers: HEADERS }, 15000)
    .then(function (html) {
      var bloques = [];
      var re = /ficha_efecto">([\s\S]*?)<\/li>/gi;
      var m;
      while ((m = re.exec(html)) !== null) bloques.push(m[1]);
      var out = [];
      for (var i = 0; i < bloques.length; i++) {
        var block = bloques[i];
        var title = (block.match(/title="([^"]*)"/) || [])[1] || '';
        var href = (block.match(/href="([^"]*)"/) || [])[1] || '';
        if (!title || !href) continue;
        var slugM = href.match(/\/anime\/([^"\/\?]+)/i);
        out.push({
          title: title.replace(/&quot;|&amp;|&#039;/g, ''),
          href: href.indexOf('http') === 0 ? href : href.replace('./', HOST + '/'),
          slug: slugM ? slugM[1] : '',
        });
      }
      return out;
    })
    .catch(function () { return []; });
}

// ---------------------------------------------------------------------------
// episodio: URL directa primero, paginacion ajax solo de respaldo
// ---------------------------------------------------------------------------

function tieneReproductores(html) {
  if (!html || html.length <= 500) return false;
  return html.indexOf('data-encrypt') !== -1 || html.indexOf('target="_blank"') !== -1;
}

function episodioDirecto(slug, episode) {
  var url = HOST + '/ver/' + slug + '-episodio-' + (parseInt(episode, 10) || 1);
  return fetchText(url, { headers: HEADERS }, 15000)
    .then(function (html) {
      return tieneReproductores(html) ? url : null;
    })
    .catch(function () { return null; });
}

function episodioPorPaginacion(seriesUrl, episode) {
  return fetchText(seriesUrl, { headers: HEADERS }, 15000)
    .then(function (html) {
      var dataI = (html.match(/data-i="([^"]+)"/) || [])[1];
      var dataU = (html.match(/data-u="([^"]+)"/) || [])[1];
      if (!dataI || !dataU) return null;
      var targetEp = String(parseInt(episode, 10) || 1);
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

function getEpisodeUrl(cand, episode) {
  return episodioDirecto(cand.slug, episode).then(function (directo) {
    if (directo) return directo;
    return episodioPorPaginacion(cand.href, episode);
  });
}

function getEmbedUrls(episodeUrl) {
  return fetchText(episodeUrl, { headers: HEADERS }, 15000)
    .then(function (html) {
      // Los target="_blank" son los mismos archivos que los reproductores
      // opt con otra ruta (/d/<id> frente a /e/<id>): si hay opt, los
      // directos solo duplican trabajo y tiempo. Solo valen si no hay opt.
      var directos = [];
      var opt = [];
      var vistos = {};
      function pushDirecto(u) {
        if (!u || vistos[u]) return;
        vistos[u] = true;
        directos.push(u);
      }
      function pushOpt(u) {
        if (!u || vistos[u]) return;
        vistos[u] = true;
        opt.push(u);
      }

      var re = /target="_blank"\s+href="(https?:\/\/[^"]+)"/gi;
      var m;
      while ((m = re.exec(html)) !== null) {
        if (!/rpmplayer\./.test(m[1])) pushDirecto(m[1]);
      }

      var encrypt = (html.match(/data-encrypt="([^"]+)"/) || [])[1];
      if (!encrypt) return directos;
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
          if (url.indexOf('http') === 0 && !/rpmplayer\./.test(url)) pushOpt(url);
        }
        return opt.length ? opt : directos;
      }).catch(function () { return opt.length ? opt : directos; });
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

function hostDe(url) {
  var m = String(url || '').match(/^https?:\/\/([^\/]+)/i);
  return m ? m[1] : '';
}

// Dos embeds distintos pueden resolver al mismo archivo (los tokens de la
// URL cambian pero host+ruta no): se deduplica por host+ruta.
function claveStream(url) {
  var m = String(url || '').match(/^https?:\/\/([^\/]+)(\/[^?#]*)/i);
  return m ? m[1] + m[2] : String(url || '');
}

function grupoPrioridad(url) {
  if (/uqload|mp4upload/i.test(url)) return 0;
  if (/voe\.sx|cloudwindow/i.test(url)) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// flujo principal
// ---------------------------------------------------------------------------

async function extraer(tmdbId, mediaType, season, episode, title) {
  var tipo = mediaType === 'movie' ? 'movie' : 'tv';
  if (!tmdbId && !title) return [];

  var info = await getTmdbInfo(tmdbId, tipo);
  var titles = [];
  if (title) titles.push(title);
  if (info) {
    for (var ti = 0; ti < info.titles.length; ti++) {
      if (titles.indexOf(info.titles[ti]) < 0) titles.push(info.titles[ti]);
    }
  }
  if (!titles.length) return [];
  console.log('[Monoschinos] Titulos TMDB: ' + titles.join(' | '));

  var targets = objetivos(titles, season);
  var queries = titles.slice(0, MAX_QUERIES);
  var candidatos = [];
  var vistosSlug = {};

  for (var qi = 0; qi < queries.length; qi++) {
    var results = await searchSite(queries[qi]);
    console.log('[Monoschinos] Busqueda "' + queries[qi] + '": ' + results.length + ' fichas');
    for (var ri = 0; ri < results.length; ri++) {
      var res = results[ri];
      if (!res.slug || vistosSlug[res.slug]) continue;
      vistosSlug[res.slug] = true;
      var p = puntuarFicha(res.title, res.slug, targets, season);
      if (p.score < 30) continue;
      candidatos.push({ slug: res.slug, href: res.href, title: res.title, score: p.score, idx: p.idx });
    }
    // Una página con coincidencia exacta basta: la búsqueda del sitio ya
    // trae toda la familia (serie, temporadas, spin-offs) y el desempate
    // por índice de objetivo elige la serie antes que el spin-off.
    var hayExacto = false;
    for (var ci = 0; ci < candidatos.length; ci++) if (candidatos[ci].score >= 100) hayExacto = true;
    if (hayExacto) break;
  }

  // Desempate: a igual puntuación e índice de objetivo, gana el slug más
  // corto: la ficha pelada ("dragon-ball-super") antes que la variante con
  // sufijo de idioma ("dragon-ball-super-latino"), que es la misma serie
  // pero con menos embeds en este caso.
  candidatos.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.idx !== b.idx) return a.idx - b.idx;
    return a.slug.length - b.slug.length;
  });
  if (!candidatos.length) {
    console.log('[Monoschinos] Sin coincidencia en el sitio');
    return [];
  }

  var epNum = tipo === 'movie' ? 1 : (parseInt(episode, 10) || 1);
  if (tipo === 'tv' && !episode) return [];

  for (var ai = 0; ai < candidatos.length && ai < MAX_CANDIDATOS; ai++) {
    var cand = candidatos[ai];
    console.log('[Monoschinos] Ficha: "' + cand.title + '" (' + cand.score + ') -> ' + cand.slug);
    if (/castellano/i.test(cand.href)) continue;
    var epUrl = await getEpisodeUrl(cand, epNum);
    if (!epUrl) {
      console.log('[Monoschinos] Sin episodio ' + epNum + ' en ' + cand.slug);
      continue;
    }
    console.log('[Monoschinos] Episodio: ' + epUrl);

    var embeds = await getEmbedUrls(epUrl);
    console.log('[Monoschinos] Embeds: ' + embeds.length);
    // Priorizar los hosts que resuelven (uqload, mp4upload, voe) y descartar
    // de entrada los que acaban en null (byse/filemoon, mixdrop sin resolver).
    embeds = embeds.filter(function (u) { return !/byse|mixdrop/i.test(u); });
    embeds.sort(function (a, b) { return grupoPrioridad(a) - grupoPrioridad(b); });
    if (embeds.length > MAX_EMBEDS) embeds = embeds.slice(0, MAX_EMBEDS);
    if (!embeds.length) continue;

    var etiqueta = etiquetaDeTitulo(epUrl);
    if (!etiqueta) continue;

    // Resolución por oleadas con parada temprana: primero los hosts que
    // resuelven rápido y bien; solo si no dan 2 streams se prueban los
    // lentos. Un Promise.all sobre todos esperaba al resolver más lento
    // aunque los buenos ya estuvieran listos (el caso DBS: 85 s).
    var streams = [];
    var vistosUrl = {};
    var wi = 0;
    while (wi < embeds.length && streams.length < 2) {
      var wave = [];
      if (wi === 0) {
        while (wi < embeds.length && grupoPrioridad(embeds[wi]) === 0) { wave.push(embeds[wi]); wi++; }
        if (!wave.length) { wave.push(embeds[wi]); wi++; }
      } else {
        while (wi < embeds.length && wave.length < 3) { wave.push(embeds[wi]); wi++; }
      }
      console.log('[Monoschinos] Oleada: ' + wave.map(function (w) { return hostDe(w); }).join(','));
      var resueltos = await Promise.all(wave.map(function (embedUrl) {
        var server = (embedUrl.match(/:\/\/(?:www\.)?([^.]+)\./) || [])[1] || '?';
        return resolverEmbed(embedUrl).then(function (r) {
          if (!r || !r.url) return null;
          return {
            title: server + ' · ' + etiqueta,
            quality: calidadDe(r.quality),
            language: etiqueta,
            url: r.url,
            headers: sanitizePlaybackHeaders(r.url, r.headers || { Referer: embedUrl, 'User-Agent': UA }),
          };
        });
      }));
      for (var i = 0; i < resueltos.length; i++) {
        var st = resueltos[i];
        if (!st) continue;
        var clave = claveStream(st.url);
        if (vistosUrl[clave]) continue;
        vistosUrl[clave] = true;
        streams.push(st);
        if (streams.length >= MAX_STREAMS) break;
      }
      console.log('[Monoschinos] Oleada lista, resueltos: ' + streams.length);
    }

    var finales = filtrarIdioma(streams);
    if (finales.length) return finales;
    console.log('[Monoschinos] Ficha sin streams, se prueba la siguiente candidata');
  }

  return [];
}

export { extraer };
