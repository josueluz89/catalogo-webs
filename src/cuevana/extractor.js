import { fetchText, fetchWithTimeout } from '../shared/http.js';
import { getEmbedResolver, mapDomain } from '../shared/embedResolvers.js';

// Reescritura limpia (2026-10-27). Causa del 0 silencioso anterior:
// el sitio NO estaba muerto (la ficha da 200 y player.php ya no da el 500
// de octubre), sino que el extractor viejo lanzaba los 8 videos de los 3
// idiomas en Promise.all (latino + castellano + inglés) y luego
// withWorkingStreams volvía a sondear cada m3u8: la suma superaba el
// tope del arnés (90 s) y de la app (60 s), así que nunca devolvía nada.
// Esta versión resuelve por idioma, en orden, con parada temprana:
// 1 Latino + 1 Subtitulado y se corta; el castellano ni se resuelve.
// Además streamwish.to hoy es una cáscara "Loading..." de 452 bytes:
// el remapeo a hgplaycdn.com (que sí sirve la página real) es obligatorio.

var TMDB_KEY = '1f54bd990f1cdfb230adb312546d765d';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var BASE = 'https://wv3.cuevana3.eu';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

var ACCENT_MAP = { 'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e', 'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i', 'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o', 'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u', 'ñ': 'n', 'ç': 'c' };
function stripAccents(s) {
  return (s || '').replace(/[^\x00-\x7F]/g, function (c) { return ACCENT_MAP[c] || ''; });
}
function slugify(t) {
  var s = stripAccents((t || '').trim().toLowerCase());
  s = s.replace(/[^a-z0-9\s-]/g, '');
  s = s.replace(/[\s-]+/g, '-');
  return s.replace(/^-+|-+$/g, '');
}
function toTmdbType(t) {
  return (t === 'tv' || t === 'series' || t === 'anime') ? 'tv' : 'movie';
}

// Portero de idioma (al final, sobre la etiqueta): solo salen Latino,
// Subtitulado, Inglés y Japonés. El castellano se descarta desde la
// ficha, antes de resolver, para no gastar tiempo en él.
var LANGS = [
  { key: 'latino', label: 'Latino' },
  { key: 'english', label: 'Subtitulado' },
  { key: 'japanese', label: 'Japonés' },
];

function fetchTmdb(tmdbId, type) {
  function lang(l) {
    return fetchText(TMDB_BASE + '/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=' + l, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      .then(function (raw) { try { return JSON.parse(raw); } catch (e) { return null; } })
      .catch(function () { return null; });
  }
  return Promise.all([lang('es-MX'), lang('es-ES'), lang('en-US')]).then(function (rs) {
    var es = rs[0], eses = rs[1], en = rs[2];
    var latino = (es && (es.title || es.name)) || '';
    var cast = (eses && (eses.title || eses.name)) || '';
    var ingles = (en && (en.title || en.name)) || '';
    var dateStr = type === 'movie'
      ? ((es && es.release_date) || (en && en.release_date) || '')
      : ((es && es.first_air_date) || (en && en.first_air_date) || '');
    var year = dateStr && dateStr.length >= 4 ? dateStr.substring(0, 4) : null;
    return { latino: latino, castellano: cast, ingles: ingles, year: year };
  });
}

function extractNextData(html) {
  var m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    var data = JSON.parse(m[1]);
    if (data && data.props && data.props.pageProps) return data.props.pageProps;
  } catch (e) {}
  return null;
}

function fetchFicha(url, needle) {
  var headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' };
  return fetchWithTimeout(url, { headers: headers }).then(function (res) {
    if (!res.ok) return null;
    return res.text();
  }).then(function (html) {
    if (!html || html.indexOf('__NEXT_DATA__') === -1 || html.indexOf(needle) === -1) return null;
    return { html: html, url: url };
  }).catch(function () { return null; });
}

function buildMovieCandidates(tmdb) {
  var prefix = BASE + '/ver-pelicula/';
  var titles = [tmdb.latino, tmdb.castellano, tmdb.ingles];
  var out = [];
  for (var i = 0; i < titles.length; i++) {
    var slug = slugify(titles[i]);
    if (!slug) continue;
    out.push(prefix + slug);
    if (tmdb.year) out.push(prefix + slug + '-' + tmdb.year);
  }
  return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
}

function buildEpisodeCandidates(tmdb, season, episode) {
  var names = [tmdb.latino, tmdb.castellano, tmdb.ingles].filter(function (x) { return x && x.trim(); });
  var out = [];
  for (var i = 0; i < names.length; i++) {
    var slug = slugify(names[i]);
    if (!slug) continue;
    out.push(BASE + '/episodio/' + slug + '-temporada-' + season + '-episodio-' + episode);
  }
  return out;
}

// Busca la ficha por slugs, en orden, parando en la primera válida.
// Si ningún slug casa, respaldo por búsqueda del sitio filtrando por
// TMDbId exacto (nunca el primer resultado del tipo).
function findFicha(tmdb, isMovie, season, episode) {
  var needle = isMovie ? '"thisMovie"' : '"episode"';
  var candidates = isMovie ? buildMovieCandidates(tmdb) : buildEpisodeCandidates(tmdb, season, episode);
  function tryNext(i) {
    if (i >= candidates.length) return searchFallback();
    return fetchFicha(candidates[i], needle).then(function (found) {
      if (found) return found;
      return tryNext(i + 1);
    });
  }
  function searchFallback() {
    var queries = [tmdb.latino, tmdb.ingles].filter(function (x) { return x && x.trim(); });
    function sq(i) {
      if (i >= queries.length) return Promise.resolve(null);
      return fetchText(BASE + '/search?q=' + encodeURIComponent(queries[i]), { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } }).then(function (html) {
        var props = extractNextData(html || '');
        var list = (props && (props.movies || props.series || props.results)) || [];
        if (!Array.isArray(list)) list = [];
        for (var k = 0; k < list.length; k++) {
          var item = list[k] || {};
          if ((item.TMDbId || '').toString() === tmdb.id.toString()) {
            var slugName = item.slug && item.slug.name;
            if (slugName) {
              var url = isMovie ? BASE + '/ver-pelicula/' + slugName : BASE + '/ver-serie/' + slugName;
              return fetchFicha(url, needle).then(function (found2) {
                if (found2) return found2;
                return sq(i + 1);
              });
            }
          }
        }
        return sq(i + 1);
      }).catch(function () { return sq(i + 1); });
    }
    return sq(0);
  }
  return tryNext(0);
}

// El player de Cuevana (player.cuevana3.eu/player.php) hoy responde 200
// con `var url = '<embed>'` (en octubre daba 500 desde este entorno).
// Se pide con el Referer de la ficha y se exige un 200 explícito.
function resolvePlayer(playerUrl, fichaUrl) {
  var headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8', Referer: fichaUrl };
  return fetchWithTimeout(playerUrl, { headers: headers }).then(function (res) {
    if (!res.ok) return null;
    return res.text();
  }).then(function (html) {
    if (!html) return null;
    var m = html.match(/var url = '([^']+)'/) || html.match(/var url = "([^"]+)"/);
    var videoUrl = m ? m[1] : null;
    if (!videoUrl) {
      var m3 = html.match(/(?:file|src|source)\s*[:=]\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (m3) videoUrl = m3[1];
    }
    if (!videoUrl) {
      var ifr = html.match(/<iframe[^>]+src="([^"]+)"/i);
      if (ifr) videoUrl = ifr[1];
    }
    if (!videoUrl) return null;
    return mapPlayerDomain(videoUrl);
  }).catch(function () { return null; });
}

// Remapeo de espejos verificado 2026-10-27: streamwish.to sirve una
// cáscara "Loading..." de 452 bytes y hgplaycdn.com sirve la página
// real; filelions/vidhidepro se sirven vía callistanise.com.
function mapPlayerDomain(url) {
  try {
    var m = url.match(/^(https?:\/\/)([^\/]+)(.*)$/);
    if (!m) return url;
    var host = m[2].toLowerCase();
    var nh = null;
    if (host.indexOf('streamwish.to') !== -1) nh = host.replace('streamwish.to', 'hgplaycdn.com');
    else if (host.indexOf('vidhidepro.com') !== -1) nh = host.replace('vidhidepro.com', 'callistanise.com');
    else if (host.indexOf('filelions.to') !== -1) nh = host.replace('filelions.to', 'callistanise.com');
    if (!nh) return url;
    return m[1] + nh + m[3];
  } catch (e) { return url; }
}

// Solo hosts con resolver que responde desde aquí: voe tiene gate ALTCHA
// y dood hace tar-pit a IPs bloqueadas (regla del repo: descartar de
// entrada hosts muertos conocidos). streamtape no tiene resolver.
var HOST_ORDER = ['streamwish', 'filemoon', 'netu', 'vidhide'];

function hostRank(name) {
  var n = (name || '').toLowerCase();
  for (var i = 0; i < HOST_ORDER.length; i++) {
    if (n.indexOf(HOST_ORDER[i]) !== -1) return i;
  }
  return HOST_ORDER.length;
}

// Resuelve un idioma: hosts en orden de prioridad, en secuencia, y
// para en el primer stream real. Un solo stream por idioma.
function resolveLanguage(videos, label, fichaUrl) {
  var list = (videos || []).filter(function (v) {
    // v.result es la URL de player.php, no del embed: el filtro es por
    // nombre de host conocido, no por resolver del player.
    return v && v.result && hostRank(v.cyberlocker) < HOST_ORDER.length;
  }).sort(function (a, b) {
    return hostRank(a.cyberlocker) - hostRank(b.cyberlocker);
  });
  function tryNext(i) {
    if (i >= list.length) return Promise.resolve(null);
    var vid = list[i];
    return resolvePlayer(vid.result, fichaUrl).then(function (embed) {
      if (!embed) return tryNext(i + 1);
      var fixed = mapDomain(embed);
      var resolver = getEmbedResolver(fixed);
      if (!resolver) return tryNext(i + 1);
      return resolver(fixed).then(function (r) {
        if (!r || !r.url) return tryNext(i + 1);
        var host = '';
        try { host = fixed.split('/')[2]; } catch (e) {}
        return {
          name: 'Cuevana (' + (vid.cyberlocker || host) + ')',
          title: (r.quality || vid.quality || 'HD') + ' · ' + label + ' · ' + (vid.cyberlocker || host),
          url: r.url,
          quality: r.quality || vid.quality || 'HD',
          headers: r.headers,
        };
      }).catch(function () { return tryNext(i + 1); });
    }).catch(function () { return tryNext(i + 1); });
  }
  return tryNext(0);
}

export function extractStreams(tmdbId, mediaType, season, episode) {
  var tmdbType = toTmdbType(mediaType);
  var isMovie = tmdbType !== 'tv';
  var s = parseInt(season, 10) || 1;
  var e = parseInt(episode, 10) || 1;
  return fetchTmdb(tmdbId, tmdbType).then(function (tmdb) {
    tmdb.id = tmdbId;
    if (!tmdb.latino && !tmdb.ingles && !tmdb.castellano) return [];
    return findFicha(tmdb, isMovie, s, e).then(function (found) {
      if (!found) return [];
      var props = extractNextData(found.html);
      if (!props) return [];
      var node = isMovie ? props.thisMovie : (props.episode || props.thisEpisode);
      if (!node || !node.videos) return [];
      // Idiomas en orden de prioridad; parar con 1 Latino + 1 Subtitulado.
      // El castellano ('spanish') no se resuelve nunca.
      var streams = [];
      function tryLang(i) {
        if (i >= LANGS.length) return Promise.resolve(streams);
        if (streams.length >= 2) return Promise.resolve(streams);
        var lang = LANGS[i];
        var list = node.videos[lang.key];
        if (!Array.isArray(list) || !list.length) return tryLang(i + 1);
        return resolveLanguage(list, lang.label, found.url).then(function (st) {
          if (st) streams.push(st);
          return tryLang(i + 1);
        });
      }
      return tryLang(0);
    });
  }).catch(function (err) {
    console.error('[Cuevana] Error: ' + (err && err.message ? err.message : err));
    return [];
  });
}
