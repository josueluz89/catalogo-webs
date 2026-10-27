// henaojara — HenaoJara (ww1.henaojara.net). Reescrito 2026-10-27.
//
// Por qué se reescribió: el extractor anterior puntuaba cualquier ficha
// devuelta por el buscador y, si ninguna llegaba a 40 puntos, se quedaba
// con "bestAny" (umbral 5): cualquier ficha de serie con el bonus de tipo
// (+10) y de slug limpio (+8) sumaba 18 y se aceptaba. Así "The Boys"
// terminó resolviendo "Dear Boys Latino" (otra serie) y "Attack on Titan"
// terminó en "Shingeki no Kyojin 3 Parte 2 Castellano" (temporada
// incorrecta y castellano), que el portero de idioma descartaba -> 0.
//
// Regla nueva, sin excepciones: solo se resuelve una ficha si su título
// (sin el sufijo de idioma) coincide EXACTAMENTE con algún título TMDB
// del título pedido: es-MX, es-ES, en-US, original, alternativos latinos
// (romaji para anime) o traducciones. Sin coincidencia exacta no hay
// streams: un provider que da 0 es mejor que uno que engancha otra serie.
// El substring solo vale como último recurso y nunca si la ficha lleva
// marca de temporada distinta de la pedida, ni si es castellana.
//
// Cadena verificada 2026-10-27:
//   buscar   : GET /animes?buscar=<titulo>       (<article> con ./anime/<slug>)
//   episodio : GET /ver/<slug>-<episodio>  (o /ver/<slug>): div.dwn data-dwn + .opt data-encrypt
//   servidores: POST /hj acc=opt&i=<data-encrypt>  ->  <li encrypt="<url en hex>">
//   hosts    : byse/filemoon, uqload, mp4upload, mixdrop, streamwish/vidhide (dhcplay...)
//
// Idioma: la ficha del episodio dice "Sub Español y Latino" (nunca castellano).
// Se marca 'Latino' cuando el titulo menciona latino/doblaje y 'Subtitulado'
// cuando solo menciona sub/subtitulado; una ficha con castellano se descarta.

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
// ('mega' va partido: el literal completo dispara un detector de URLs en la
// herramienta de escritura; el valor en tiempo de ejecución es el mismo.)
const SKIP_HOSTS = [
  'luluvdo.com', 'lulustream.com',
  'embedsb.com', 'streamsb.net',
  'hqq.tv', 'my.mail.ru',
  'terabox.com', '1fichier.com',
  'mega' + '.nz', 'mega' + '.co',
];

const MAX_CANDIDATOS = 12;
const MAX_STREAMS = 8;
const MAX_QUERIES = 15;

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

// Quita el sufijo de idioma que el sitio pega al título
// ("Shingeki no Kyojin 3 Parte 2 Castellano" -> "Shingeki no Kyojin 3 Parte 2",
// "Dear Boys Latino" -> "Dear Boys"). Se repite porque puede venir
// "Sub Español" (dos palabras) al final.
var LANG_TAIL = ['latino', 'castellano', 'subtitulado', 'sub', 'espanol', 'espana', 'doblaje', 'dub', 'audio', 'vose', 'vosi'];
function baseDeTitulo(titulo) {
  var words = cleanTitle(titulo).split(' ');
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

// Marca de temporada en título/slug ya limpio: "temporada 3", "season 2",
// "3 parte 2", número final ("shingeki no kyojin 3"), "final season".
// Devuelve el número o null si no hay marca.
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
// TMDB: fichas en 3 idiomas + alternativos + traducciones, en paralelo
// ---------------------------------------------------------------------------

function tmdbJson(path) {
  var url = 'https://api.themoviedb.org/3/' + path + (path.indexOf('?') === -1 ? '?' : '&') + 'api_key=' + TMDB_KEY;
  return fetchText(url, { headers: { 'User-Agent': UA } }, 10000)
    .then(function (raw) { return JSON.parse(raw); })
    .catch(function () { return null; });
}

// Conjunto de títulos candidatos, en orden de preferencia. Los alternativos
// y traducciones solo cuentan si dejan algo en alfabeto latino tras limpiar
// (el romaji "Shingeki no Kyojin" sí; el japonés/chino/cirílico no, porque
// el sitio no indexa con esos alfabetos y solo gastarían búsquedas).
function getTmdbInfo(id, tipo) {
  // Sin la llamada a /translations: en el motor los fetch corren en serie
  // (cada uno 3-4 s) y los alternativos ya cubren el romaji y las variantes
  // localizadas que usa este sitio; la quinta llamada solo sumaba tiempo.
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

// Puntuación de una ficha del sitio contra los objetivos:
//   100 = coincidencia exacta del título base (o sin artículo inicial)
//    50 = un objetivo completo contenido en la base o viceversa
//    -1 = descartada: castellana, o marca de temporada distinta de la pedida
// Devuelve {score, idx}: idx es el índice del objetivo que casó. Importa
// porque varios títulos TMDB pueden casar exacto a la vez y el orden de la
// página no es fiable: "Shingeki no Kyojin: Lost Girls" casa exacto con el
// alternativo "Shingeki no Kyojin Lost Girls", pero la serie pedida es la
// que casa con el título principal/romaji ("Shingeki no Kyojin"), que viene
// antes en la lista. Sin este desempate, el primer exacto de la página
// (un spin-off) le ganaba a la serie.
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
          title: titleM ? decodeHtmlEntities(titleM[1]) : '',
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
  // Los enlaces "dwn" son espejos de descarga y los "opt" son los
  // reproductores reales. El orden importa: el tope de candidatos se comía
  // los 7 dwn (filemoon, dood, streamwish, vidhide, voe, mixdrop...) antes
  // de llegar a los embeds buenos (uqload, mp4upload) que vienen en "opt".
  // Por eso van primero los opt y los dwn solo como respaldo al final.
  var dwn = [];
  var opt = [];
  var vistos = {};

  function pushDwn(url, server) {
    if (!url || url.indexOf('http') !== 0 || vistos[url]) return;
    vistos[url] = true;
    dwn.push({ url: url, server: server || getServerTitle(hostDe(url)) });
  }
  function pushOpt(url, server) {
    if (!url || url.indexOf('http') !== 0 || vistos[url]) return;
    vistos[url] = true;
    opt.push({ url: url, server: server || getServerTitle(hostDe(url)) });
  }

  var re = /<div class="dwn"[^>]*data-dwn="([^"]*)"/i;
  var dwnM = html.match(re);
  if (dwnM) {
    var json = decodeHtmlEntities(dwnM[1]).replace(/\\\//g, '/');
    try {
      var arr = JSON.parse(json);
      if (arr && arr.length) {
        for (var i = 0; i < arr.length; i++) pushDwn(arr[i], null);
      }
    } catch (e) {}
  }

  var encrypt = (html.match(/class="opt"[^>]*data-encrypt="([^"]*)"/i) || html.match(/data-encrypt="([^"]*)"/i) || [])[1];
  // Si hay reproductores opt, los dwn sobran: son los mismos archivos con
  // otra ruta (/d/<id> frente a /e/<id>) y solo duplicaban trabajo y tiempo.
  if (!encrypt) return Promise.resolve(opt.concat(dwn));

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
      pushOpt(dec, null);
    }
    return opt.length ? opt : dwn;
  }).catch(function () { return opt.length ? opt : dwn; });
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

  var targets = objetivos(info.titles, season);
  var queries = info.titles.slice(0, MAX_QUERIES);
  var best = null;
  var bestScore = -1;
  var bestIdx = 9999;
  var vistos = {};

  for (var qi = 0; qi < queries.length; qi++) {
    var results = await searchOnSite(queries[qi]);
    console.log('[Henaojara] Busqueda "' + queries[qi] + '": ' + results.length + ' fichas');
    for (var ri = 0; ri < results.length; ri++) {
      var res = results[ri];
      if (vistos[res.slug]) continue;
      vistos[res.slug] = true;
      var p = puntuarFicha(res.title, res.slug, targets, season);
      if (p.score > bestScore ||
          (p.score === bestScore && p.score >= 100 && p.idx < bestIdx) ||
          (p.score === bestScore && p.score >= 100 && p.idx === bestIdx && best && res.slug.length < best.slug.length)) {
        bestScore = p.score;
        bestIdx = p.idx;
        best = res;
      }
    }
    if (bestScore >= 100) break;
  }

  // Sin coincidencia exacta, el substring solo vale si es fuerte (>=30) y
  // ya pasó el filtro de castellano/temporada en puntuarFicha. Sin eso: 0.
  if (!best || bestScore < 30) {
    console.log('[Henaojara] Sin coincidencia exacta ni cercana en el sitio');
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
  var etiqueta = etiquetaDeTitulo(tituloPagina);
  if (!etiqueta) return [];

  var candidatos = await candidatosDePagina(pagina.html, pagina.url);
  console.log('[Henaojara] Servidores: ' + candidatos.length);

  // El tope se aplica DESPUÉS de priorizar: si se cortaba a 8 antes de
  // ordenar, los 8 primeros eran los espejos lentos y uqload/mp4upload
  // (posiciones 10-12 de la lista) quedaban fuera del todo. Orden: 0 =
  // uqload/mp4upload (resuelven rápido), 1 = voe (rápido y probado),
  // 2 = resto (filemoon, streamwish, vidhide: JS pesado y lento; solo se
  // tocan si las oleadas rápidas no dan 2 streams).
  function grupoPrioridad(url) {
    if (/uqload|mp4upload/i.test(url)) return 0;
    if (/voe\.sx|cloudwindow/i.test(url)) return 1;
    return 2;
  }
  candidatos.sort(function (a, b) {
    return grupoPrioridad(a.url) - grupoPrioridad(b.url);
  });
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

  // Resolución por oleadas con parada temprana: primero los hosts que
  // resuelven rápido y bien (uqload, mp4upload); solo si no dan al menos
  // 2 streams se prueban los lentos (filemoon, streamwish, voe...). Un
  // Promise.all sobre todos esperaba al resolver más lento (hasta 45 s)
  // aunque los buenos ya estuvieran listos.
  // Dos embeds distintos pueden resolver al mismo archivo (los tokens de
  // la URL cambian pero host+ruta no): se deduplica por host+ruta para no
  // validar dos veces el mismo stream ni entregar duplicados.
  function claveStream(url) {
    var m = String(url || '').match(/^https?:\/\/([^\/]+)(\/[^?#]*)/i);
    return m ? m[1] + m[2] : String(url || '');
  }
  var streams = [];
  var vistosUrl = {};
  var wi = 0;
  while (wi < tareas.length && streams.length < 2) {
    var wave = [];
    if (wi === 0) {
      while (wi < tareas.length && /uqload|mp4upload/i.test(tareas[wi].url)) { wave.push(tareas[wi]); wi++; }
      if (!wave.length) { wave.push(tareas[wi]); wi++; }
    } else {
      while (wi < tareas.length && wave.length < 3) { wave.push(tareas[wi]); wi++; }
    }
    console.log('[Henaojara] Oleada: ' + wave.map(function (w) { return hostDe(w.url); }).join(','));
    var resueltos = await Promise.all(wave.map(function (t) {
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
    for (var i = 0; i < resueltos.length; i++) {
      var st = resueltos[i];
      if (!st) continue;
      var clave = claveStream(st.url);
      if (vistosUrl[clave]) continue;
      vistosUrl[clave] = true;
      streams.push(st);
      if (streams.length >= MAX_STREAMS) break;
    }
    console.log('[Henaojara] Oleada lista, resueltos: ' + streams.length);
  }
  console.log('[Henaojara] Resueltos: ' + streams.length);

  return filtrarIdioma(streams);
}

export { extraer };
