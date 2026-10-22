import { fetchText, fetchWithTimeout } from '../shared/http.js';
import { getEmbedResolver, mapDomain } from '../shared/embedResolvers.js';

var TMDB_KEY = '1f54bd990f1cdfb230adb312546d765d';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var BASE = 'https://wv3.cuevana3.eu';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

var ACCENT_MAP = { 'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e', 'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i', 'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o', 'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u', 'ñ': 'n', 'ç': 'c' };
function stripAccents(s) {
  return (s || '').replace(/[^\x00-\x7F]/g, function(c) { return ACCENT_MAP[c] || ''; });
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
function langToCode(l) {
  var s = (l || '').toLowerCase();
  if (s.indexOf('castellano') !== -1 || s.indexOf('espa') !== -1) return 'es_ES';
  if (s.indexOf('ingl') !== -1 || s.indexOf('english') !== -1 || s.indexOf('sub') !== -1) return 'en_US';
  return 'es_MX';
}
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
function isAllowed(name) {
  var n = (name || '').toLowerCase();
  return n.indexOf('streamwish') !== -1 || n.indexOf('vidhide') !== -1 || n.indexOf('filelions') !== -1 || n.indexOf('vidhidepro') !== -1 || n.indexOf('voe') !== -1 || n.indexOf('uqload') !== -1 || n.indexOf('dood') !== -1 || n.indexOf('filemoon') !== -1 || n.indexOf('lulu') !== -1 || n.indexOf('netu') !== -1;
}

function fetchTmdb(tmdbId, type) {
  function lang(l) {
    return fetchText(TMDB_BASE + '/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=' + l, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      .then(function(raw) { try { return JSON.parse(raw); } catch (e) { return null; } })
      .catch(function() { return null; });
  }
  return Promise.all([lang('es-MX'), lang('es-ES'), lang('en-US')]).then(function(rs) {
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

function fetchPage(url) {
  return fetchText(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' } }).catch(function() { return null; });
}

// Como fetchPage pero devolviendo también la cookie de sesión que mande la
// ficha (best-effort: el arnés QuickJS solo expone content-type en headers,
// así que ahí la cookie será null y solo se mandará el Referer).
// Fetch de una página devolviendo su HTML y su cookie de sesión (si el
// motor la expone; en el arnés QuickJS solo se expone content-type, así
// que ahí la cookie es null y solo se usa el Referer). null si no es 200.
function fetchPagina(url) {
  var headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' };
  return fetchWithTimeout(url, { headers: headers }).then(function(res) {
    if (!res.ok) return null;
    var cookie = null;
    try { cookie = res.headers && res.headers.get ? res.headers.get('set-cookie') : null; } catch (e) { cookie = null; }
    return res.text().then(function(html) { return { html: html, cookie: cookie }; });
  }).catch(function() { return null; });
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

function groupsFromVideos(videos) {
  var langMap = { latino: 'Latino', spanish: 'Castellano', english: 'English', japanese: 'Japones' };
  var out = [];
  for (var k in langMap) {
    if (!videos.hasOwnProperty(k)) continue;
    var list = videos[k];
    if (!Array.isArray(list) || !list.length) continue;
    var vids = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v || !v.result) continue;
      vids.push({ cyberlocker: v.cyberlocker || '', url: v.result, quality: v.quality || 'HD' });
    }
    if (vids.length) out.push({ language: langMap[k], videos: vids });
  }
  return out;
}

// Resolución del player de Cuevana, reescrita en limpio: una sola función
// que pide el player con el Referer de la ficha y su cookie de sesión,
// exige un 200 explícito y extrae la URL del vídeo en orden
// (var url -> m3u8 en claro -> iframe). Si player.php responde 500 (lo que
// hace hoy desde este entorno), devuelve null sin inventar nada.
function resolvePlayer(playerUrl, pagina) {
  var headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' };
  if (pagina && pagina.url) headers.Referer = pagina.url;
  if (pagina && pagina.cookie) headers.Cookie = pagina.cookie;
  return fetchWithTimeout(playerUrl, { headers: headers }).then(function(res) {
    if (!res.ok) return null;
    return res.text();
  }).then(function(html) {
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
  }).catch(function() { return null; });
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
  return out.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function buildEpisodeCandidates(tmdb, season, episode) {
  var names = [tmdb.latino, tmdb.castellano, tmdb.ingles].filter(function(x) { return x && x.trim(); });
  var out = [];
  for (var i = 0; i < names.length; i++) {
    var slug = slugify(names[i]);
    if (!slug) continue;
    out.push(BASE + '/episodio/' + slug + '-temporada-' + season + '-episodio-' + episode);
  }
  return out;
}

export function extractStreams(tmdbId, mediaType, season, episode) {
  var tmdbType = toTmdbType(mediaType);
  var isMovie = tmdbType !== 'tv';
  var s = parseInt(season, 10) || 1;
  var e = parseInt(episode, 10) || 1;
  return fetchTmdb(tmdbId, tmdbType).then(function(tmdb) {
    tmdb.id = tmdbId;
    if (!tmdb.latino && !tmdb.ingles && !tmdb.castellano) return [];
    var candidates = isMovie ? buildMovieCandidates(tmdb) : buildEpisodeCandidates(tmdb, s, e);
    var needle = isMovie ? '"thisMovie"' : '"episode"';
    function tryNext(i) {
      if (i >= candidates.length) return searchFallback();
      return fetchPagina(candidates[i]).then(function(found) {
        if (found && found.html && found.html.indexOf('__NEXT_DATA__') !== -1 && found.html.indexOf(needle) !== -1) {
          return { html: found.html, url: candidates[i], cookie: found.cookie || null };
        }
        return tryNext(i + 1);
      });
    }
    function searchFallback() {
      var queries = [tmdb.latino, tmdb.ingles, tmdb.castellano].filter(function(x) { return x && x.trim(); }).slice(0, 3);
      function sq(i) {
        if (i >= queries.length) return Promise.resolve(null);
        return fetchPage(BASE + '/search?q=' + encodeURIComponent(queries[i])).then(function(html) {
          if (!html) return sq(i + 1);
          var props = extractNextData(html);
          var list = (props && (props.movies || props.series || props.results)) || [];
          if (!Array.isArray(list)) list = [];
          for (var k = 0; k < list.length; k++) {
            var item = list[k] || {};
            if ((item.TMDbId || '').toString() === tmdbId.toString()) {
              var slugName = item.slug && item.slug.name;
              if (slugName) {
                var url = isMovie ? BASE + '/ver-pelicula/' + slugName : BASE + '/ver-serie/' + slugName;
                return fetchPagina(url).then(function(found2) {
                  if (found2 && found2.html && found2.html.indexOf('__NEXT_DATA__') !== -1 && found2.html.indexOf(needle) !== -1) return { html: found2.html, url: url, cookie: found2.cookie || null };
                  return sq(i + 1);
                });
              }
            }
          }
          return sq(i + 1);
        }).catch(function() { return sq(i + 1); });
      }
      return sq(0);
    }
    return tryNext(0).then(function(found) {
      if (!found) return [];
      var props = extractNextData(found.html);
      if (!props) return [];
      var node = isMovie ? props.thisMovie : (props.episode || props.thisEpisode);
      if (!node || !node.videos) return [];
      var groups = groupsFromVideos(node.videos);
      var jobs = [];
      for (var g = 0; g < groups.length; g++) {
        for (var v = 0; v < groups[g].videos.length; v++) {
          (function(gr, vid) {
            if (!isAllowed(vid.cyberlocker)) return;
            jobs.push(
              resolvePlayer(vid.url, found).then(function(resolved) {
                if (!resolved) return null;
                var fixed = mapDomain(resolved);
                var resolver = getEmbedResolver(fixed);
                if (!resolver) return null;
                return resolver(fixed).then(function(r) {
                  if (!r || !r.url) return null;
                  return {
                    name: 'Cuevana (' + vid.cyberlocker + ')',
                    title: (r.quality || vid.quality || 'HD') + ' · ' + langToCode(gr.language) + ' · ' + vid.cyberlocker,
                    url: r.url,
                    quality: r.quality || vid.quality || 'HD',
                    headers: r.headers
                  };
                }).catch(function() { return null; });
              })
            );
          })(groups[g], groups[g].videos[v]);
        }
      }
      if (!jobs.length) return [];
      return Promise.all(jobs).then(function(rs) {
        return rs.filter(function(x) { return x && x.url; });
      });
    });
  }).catch(function(err) {
    console.error('[Cuevana] Error: ' + (err && err.message ? err.message : err));
    return [];
  });
}
