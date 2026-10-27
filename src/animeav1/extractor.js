// animeav1 — AnimeAV1 (animeav1.com).
// Portado a MasterScrap desde latinuvio (providers/animeav1.js), autor original Latinuvio.
// Adaptado a QuickJS: fuera cheerio (parseo por regex), fuera String.normalize (tabla de
// acentos propia) y filtrado a latino/subtitulado: los embeds con marca DUB son doblaje
// latino y los que no la llevan son subtitulados; nunca se emite espanol de Espana.
//
// Cadena verificada 2026-10-15:
//   search   : GET /catalogo?search=<titulo>        (tarjetas <article> con /media/<slug>)
//   datos    : GET /media/<slug>/<ep>/__data.json   (SvelteKit devalue: schema + refs)
//   embeds   : SUB/DUB -> [{server, url}]; HLS (zilla-networks /play/ -> /m3u8/), Voe,
//              MP4Upload, Byse, UPNShare (descartado)

import { fetchText } from '../shared/http.js';
import {
  getEmbedResolver,
  resolveFilemoonStream,
  resolveHLSWishStream,
  resolveMp4uploadStream,
  resolveOkRuStream,
} from '../shared/embedResolvers.js';

const BASE_URL = 'https://animeav1.com';
const TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  'Referer': BASE_URL + '/',
};

// hosts muertos o imposibles de resolver en el motor (mega/1fichier necesitan descarga)
const SKIP_HOSTS = [
  'embedsb.com', 'streamsb.net', 'sbplay.org',
  'hqq.tv', 'my.mail.ru',
  'animeav1.uns.bio',
  'terabox.com', '1fichier.com',
  'luluvdo.com', 'lulustream.com',
  'mega.nz', 'mega.co',
];

// el resolver compartido de voe devuelve 'Unknown' cuando la URL no dice la calidad:
// en la app queda mejor '720p' (calidad base del sitio) que un literal raro
function calidadDe(q) {
  var s = String(q || '');
  if (!s || s === 'Unknown') return '720p';
  return s;
}

// ---------------------------------------------------------------------------
// normalizacion de titulos (sin String.normalize: QuickJS no trae ICU)
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

function cleanTitle(title) {
  return sinAcentos(title).replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
}

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

// TMDB recortado (2026-10-27, velocidad): 2 llamadas en vez de 3.
// La ficha es-MX trae titulo + original en un JSON; los alternativos
// traen el romaji que el sitio usa como titulo (p. ej. "Shingeki no
// Kyojin" para Attack on Titan, cuyo original TMDB es kanji y no casa
// con nada del sitio). Se cae la llamada en-US (duplicaba es-MX) y la
// ficha sin idioma (su original kanji generaba una busqueda inutil).
function tmdbFichaEsMX(id, tipo) {
  var url = 'https://api.themoviedb.org/3/' + tipo + '/' + id + '?api_key=' + TMDB_KEY + '&language=es-MX';
  return fetchText(url, { headers: { 'User-Agent': UA } }, 10000)
    .then(function (raw) {
      var res = JSON.parse(raw);
      return {
        titleEsMX: tipo === 'movie' ? res.title : res.name,
        titleOriginal: tipo === 'movie' ? res.original_title : res.original_name,
      };
    })
    .catch(function () { return {}; });
}

function tmdbAltLatinos(id, tipo) {
  var url = 'https://api.themoviedb.org/3/' + tipo + '/' + id + '/alternative_titles?api_key=' + TMDB_KEY;
  return fetchText(url, { headers: { 'User-Agent': UA } }, 10000)
    .then(function (raw) {
      var res = JSON.parse(raw);
      var list = res.results || res.titles || [];
      var romaji = [];
      var otros = [];
      for (var i = 0; i < list.length; i++) {
        var t = list[i] && list[i].title;
        if (!t || /[a-zA-Z]/.test(t) === false) continue;
        var esRomaji = list[i].type && String(list[i].type).toLowerCase().indexOf('romaji') !== -1;
        if (esRomaji && romaji.indexOf(t) === -1) romaji.push(t);
        else if (!esRomaji && otros.indexOf(t) === -1) otros.push(t);
      }
      return romaji.concat(otros).slice(0, 5);
    })
    .catch(function () { return []; });
}

function getTmdbTitles(tmdbId, tipo) {
  return Promise.all([
    tmdbFichaEsMX(tmdbId, tipo),
    tmdbAltLatinos(tmdbId, tipo),
  ]).then(function (r) {
    return { titleEsMX: r[0].titleEsMX, titleOriginal: r[0].titleOriginal, altTitles: r[1] };
  }).catch(function () {
    return {};
  });
}

function generateQueries(info) {
  var queries = [];
  function addQuery(q) {
    if (!q || /[a-zA-Z]/.test(q) === false) return;
    var cleanQ = String(q).replace(/[,;.:!?]/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (!cleanQ) return;
    if (queries.indexOf(cleanQ) < 0) queries.push(cleanQ);
    var stripped = cleanQ.replace(/^(the|los|las|el|la|lo|un|una|unos|unas)\s+/i, '');
    if (stripped !== cleanQ && queries.indexOf(stripped) < 0) queries.push(stripped);
  }
  addQuery(info.titleEsMX);
  (info.altTitles || []).forEach(addQuery);
  addQuery(info.titleOriginal);
  return queries.slice(0, 5);
}

// ---------------------------------------------------------------------------
// busqueda en el catalogo (regex en vez de cheerio)
// ---------------------------------------------------------------------------

function searchOnSite(query) {
  var url = BASE_URL + '/catalogo?search=' + encodeURIComponent(query);
  return fetchText(url, { headers: HEADERS }, 15000)
    .then(function (html) {
      var results = [];
      var re = /<article[\s\S]*?<\/article>/gi;
      var m;
      while ((m = re.exec(html)) !== null) {
        var art = m[0];
        var hrefM = art.match(/href="(\/media\/[^"]+)"/i);
        if (!hrefM) continue;
        var slug = hrefM[1].replace('/media/', '').replace(/\/+$/, '');
        if (!slug) continue;
        var titleM = art.match(/<h3[^>]*>([^<]*)<\/h3>/i) || art.match(/alt="(?:Portada de )?([^"]*)"/i);
        var typeM = art.match(/text-xs font-bold[^>]*>([^<]*)</i);
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
// datos SvelteKit (devalue): schema + referencias numericas
// ---------------------------------------------------------------------------

function parseDevalueData(dataArray) {
  var servers = [];
  if (!dataArray || dataArray.length < 2) return servers;
  var schema = dataArray[0];
  if (!schema || typeof schema !== 'object') return servers;

  function resolve(idx) {
    if (typeof idx !== 'number' || idx >= dataArray.length) return null;
    return dataArray[idx];
  }

  function extractLang(langKey) {
    var langIdx = schema[langKey];
    if (typeof langIdx !== 'number') return;
    var langObj = resolve(langIdx);
    if (!langObj || typeof langObj !== 'object') return;
    var langs = Object.keys(langObj);
    for (var li = 0; li < langs.length; li++) {
      var lang = langs[li];
      var arrIdx = langObj[lang];
      if (typeof arrIdx !== 'number') continue;
      var arr = resolve(arrIdx);
      if (!Array.isArray(arr)) continue;
      var isDub = String(lang).toUpperCase() === 'DUB';
      for (var ai = 0; ai < arr.length; ai++) {
        var serverObj = resolve(arr[ai]);
        if (!serverObj || typeof serverObj !== 'object') continue;
        var name = String(resolve(serverObj.server) || '');
        var url = String(resolve(serverObj.url) || '');
        if (url && url.indexOf('http') === 0) {
          servers.push({ title: name, url: url, dub: isDub });
        }
      }
    }
  }

  // Solo embeds: los downloads duplican los mismos mp4upload/streamtape
  // (y mega/1fichier, ya descartados) y solo anadian candidatos muertos.
  extractLang('embeds');
  return servers;
}

// ---------------------------------------------------------------------------
// resolucion de los embeds
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

function resolverEmbed(serverName, embedUrl) {
  var u = String(embedUrl || '').toLowerCase();
  var name = String(serverName || '').toLowerCase();

  // HLS propio del sitio (zilla-networks): la pagina /play/<id> tiene su m3u8 en /m3u8/<id>
  if ((name === 'hls' || u.indexOf('zilla-networks') !== -1) && u.indexOf('/play/') !== -1) {
    return Promise.resolve({
      url: embedUrl.replace('/play/', '/m3u8/'),
      quality: '720p',
      headers: { 'Referer': BASE_URL + '/', 'User-Agent': UA },
    });
  }

  var fn = null;
  try { fn = getEmbedResolver(embedUrl); } catch (e) { fn = null; }
  var promesa = typeof fn === 'function' ? Promise.resolve().then(function () { return fn(embedUrl); }) : Promise.resolve(null);

  return promesa
    .then(function (r) {
      if (r && r.url) return r;
      // byse/filemoon (byse*), mp4upload y ok.ru tambien por nombre de servidor
      if (name.indexOf('byse') !== -1 || name.indexOf('filemoon') !== -1 || u.indexOf('byse') !== -1) {
        return resolveFilemoonStream(embedUrl);
      }
      if (name.indexOf('mp4upload') !== -1 || u.indexOf('mp4upload') !== -1) {
        return resolveMp4uploadStream(embedUrl);
      }
      if (name.indexOf('okru') !== -1 || name.indexOf('ok.ru') !== -1 || u.indexOf('ok.ru') !== -1) {
        return resolveOkRuStream(embedUrl);
      }
      if (name.indexOf('streamwish') !== -1 || u.indexOf('streamwish') !== -1 || u.indexOf('hlswish') !== -1) {
        return resolveHLSWishStream(embedUrl);
      }
      return null;
    })
    .then(function (r) {
      if (!r || !r.url) return null;
      return {
        url: r.url,
        quality: r.quality || '720p',
        headers: sanitizePlaybackHeaders(r.url, Object.assign({ 'Referer': BASE_URL + '/', 'User-Agent': UA }, r.headers || {})),
      };
    })
    .catch(function () { return null; });
}

// ---------------------------------------------------------------------------
// idioma: DUB = latino, sin marca = subtitulado (nunca espanol de Espana)
// ---------------------------------------------------------------------------

var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;

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
// flujo principal
// ---------------------------------------------------------------------------

const MAX_STREAMS = 8;

async function extraer(tmdbId, mediaType, season, episode) {
  var tipo = mediaType === 'movie' ? 'movie' : 'tv';
  var info = await getTmdbTitles(tmdbId, tipo);
  if (!info.titleEsMX && !info.titleOriginal && !info.titleEn) return [];

  var queries = generateQueries(info);
  var matchTitles = [info.titleEsMX].concat(info.altTitles || []).concat([info.titleOriginal]);

  var best = null;
  var bestScore = -1;
  var bestAny = null;
  var bestAnyScore = 4; // solo candidatos con bonus de tipo (pelicula/especial/anime)
  var vistos = {};

  for (var qi = 0; qi < queries.length; qi++) {
    var results = await searchOnSite(queries[qi]);
    for (var ri = 0; ri < results.length; ri++) {
      var res = results[ri];
      if (vistos[res.slug]) continue;
      vistos[res.slug] = true;

      var score = 0;
      var cleanedResult = cleanTitle(res.title);
      var slugResult = cleanedResult.replace(/\s+/g, '-');
      for (var ti = 0; ti < matchTitles.length; ti++) {
        if (!matchTitles[ti]) continue;
        var cleanedT = cleanTitle(matchTitles[ti]);
        if (!cleanedT) continue;
        // Coincidencia exacta por titulo o por slug: el slug del sitio
        // es el titulo romaji con guiones ("shingeki-no-kyojin"), y con
        // el romaji ya en matchTitles la primera busqueda ("Attack on
        // Titan", que lista esa ficha) cierra sin mas busquedas.
        // El orden del candidato pesa (20 por puesto): sin eso, un alt
        // como "Shingeki no Kyojin The Final Season" casa exacto con la
        // temporada y le gana a la serie base, que aparece despues en
        // la lista. Exacto = 1000 - 20*ti, parcial = 500 - 20*ti; el
        // bonus de tipo (<=15) nunca invierte el orden de candidatos.
        if (cleanedResult === cleanedT || slugResult === cleanedT.replace(/\s+/g, '-')) score = Math.max(score, 1000 - ti * 20);
        else if (cleanedResult.indexOf(cleanedT) !== -1 || cleanedT.indexOf(cleanedResult) !== -1) score = Math.max(score, 500 - ti * 20);
      }

      var normType = sinAcentos(res.type);
      var isPelicula = normType.indexOf('pelicula') !== -1;
      var isEspecial = normType.indexOf('especial') !== -1;
      var isMovieType = isPelicula || isEspecial;
      if (tipo === 'movie' && isPelicula) score += 15;
      else if (tipo === 'movie' && isEspecial) score += 5;
      else if (tipo === 'movie' && !isMovieType) score = Math.max(score - 20, 0);
      else if (tipo === 'tv' && !isMovieType) score += 10;

      if (score > bestScore && score >= 40) {
        bestScore = score;
        best = res;
      }
      // AnimeAV1 traduce los titulos (p. ej. "El viaje de Chihiro" ->
      // "Sen to Chihiro no Kamikakushi"): si el buscador del sitio ya devolvio
      // la ficha con el tipo correcto, vale como match aunque el titulo no
      // coincida palabra por palabra (el propio buscador las ordena por relevancia).
      if (score > bestAnyScore) {
        bestAnyScore = score;
        bestAny = res;
      }
    }
    if (bestScore >= 700) break; // exacto (>=860) si, parcial (<=515) no
  }

  var matched = best || (bestAnyScore >= 5 ? bestAny : null);
  if (!matched) return [];

  var epNum = tipo === 'movie' ? 1 : (parseInt(episode, 10) || 1);
  var dataUrl = BASE_URL + '/media/' + matched.slug + '/' + epNum + '/__data.json';
  var servers = [];
  try {
    var raw = await fetchText(dataUrl, {
      headers: Object.assign({}, HEADERS, { 'Accept': 'application/json' }),
    }, 15000);
    var json = JSON.parse(raw);
    var nodes = (json && json.nodes) || [];
    var dataNode = null;
    for (var ni = 0; ni < nodes.length; ni++) {
      var n = nodes[ni];
      if (n && n.data && n.data[0] && (n.data[0].embeds !== undefined || n.data[0].downloads !== undefined)) {
        dataNode = n;
      }
    }
    if (dataNode) servers = parseDevalueData(dataNode.data);
  } catch (e) {
    servers = [];
  }

  if (!servers.length) return [];

  // Resolucion en SECUENCIA, por coste del resolver, con parada temprana
  // (2026-10-27): antes eran hasta 8 resolvers en Promise.all (Byse con
  // 4 llamadas, Voe con validacion, VidHide/StreamTape nulos) y luego
  // withWorkingStreams re-bajaba cada stream para validarlo (~20-30 s
  // mas). En el arnes el fetch es curl sincrono, asi que el paralelo
  // sumaba igual. Orden: HLS propio (sin fetch) > YourUpload/MP4Upload
  // (1 pagina) > Voe > resto > Byse/Filemoon (el mas caro, al final).
  // Parada: 1 Latino + 1 Subtitulado; si no hay SUB en la ficha, 2
  // Latinos bastan. Solo se sondea el HLS propio (URL construida, no
  // extraida de pagina viva); el resto trae su prueba en la resolucion
  // (pagina del embed viva) y no se re-baja (fail-open, AGENTS §5).
  var candidatos = [];
  for (var si = 0; si < servers.length; si++) {
    var s = servers[si];
    if (!s.url) continue;
    var host = '';
    try {
      host = (s.url.match(/^https?:\/\/([^\/]+)/i) || [])[1] || '';
    } catch (e) { host = ''; }
    var skip = false;
    for (var hi = 0; hi < SKIP_HOSTS.length; hi++) {
      if (host.indexOf(SKIP_HOSTS[hi]) !== -1) skip = true;
    }
    if (skip) continue;
    candidatos.push(s);
  }
  function rangoServidor(s) {
    var n = String(s.title || '').toLowerCase();
    var u = String(s.url || '').toLowerCase();
    if (n === 'hls' || u.indexOf('zilla-networks') !== -1) return 0;
    if (n.indexOf('yourupload') !== -1 || n.indexOf('mp4upload') !== -1) return 1;
    if (n.indexOf('voe') !== -1) return 2;
    if (n.indexOf('byse') !== -1 || n.indexOf('filemoon') !== -1) return 4;
    return 3;
  }
  var ordenados = candidatos.map(function (s, idx) { return { s: s, idx: idx }; });
  ordenados.sort(function (a, b) {
    var d = rangoServidor(a.s) - rangoServidor(b.s);
    return d !== 0 ? d : a.idx - b.idx;
  });
  var haySub = false;
  var totalSub = 0;
  var totalLat = 0;
  for (var ci = 0; ci < candidatos.length; ci++) {
    if (candidatos[ci].dub) totalLat++;
    else { haySub = true; totalSub++; }
  }
  var streams = [];
  var vistosUrl = {};
  var tieneLat = false;
  var tieneSub = false;
  var probadosLat = 0;
  var probadosSub = 0;
  for (var oi = 0; oi < ordenados.length; oi++) {
    if (tieneLat && tieneSub) break;
    if (!haySub && tieneLat && streams.length >= 2) break;
    if (streams.length >= MAX_STREAMS) break;
    var t = ordenados[oi].s;
    // Si ya hay Latino y aun queda SUB por probar, no gastar un
    // resolver caro en otro Latino (y viceversa).
    if (t.dub && tieneLat && haySub && !tieneSub && probadosSub < totalSub) continue;
    if (!t.dub && tieneSub && !tieneLat && probadosLat < totalLat) continue;
    if (t.dub) probadosLat++; else probadosSub++;
    var r = await resolverEmbed(t.title, t.url);
    if (!r || !r.url) continue;
    var esHLSPropio = String(t.title || '').toLowerCase() === 'hls' || String(t.url || '').indexOf('zilla-networks') !== -1;
    if (esHLSPropio) {
      var vivo = await fetchText(r.url, { headers: { 'Referer': BASE_URL + '/', 'User-Agent': UA } }, 10000)
        .then(function (body) { return !!body && body.indexOf('#EXTM3U') !== -1; })
        .catch(function () { return false; });
      if (!vivo) continue;
    }
    if (vistosUrl[r.url]) continue;
    vistosUrl[r.url] = true;
    var idioma = t.dub ? 'Latino' : 'Subtitulado';
    if (idioma === 'Latino') tieneLat = true; else tieneSub = true;
    streams.push({
      title: String(t.title || 'Server') + ' · ' + idioma,
      quality: calidadDe(r.quality),
      language: idioma,
      url: r.url,
      headers: r.headers,
    });
  }

  return filtrarIdioma(streams);
}

export { extraer };
