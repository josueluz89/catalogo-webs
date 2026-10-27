import { fetchJson, fetchText } from '../shared/http.js';
import { getEmbedResolver, mapDomain } from '../shared/embedResolvers.js';

// Reescritura limpia (2026-10-27). El provider viejo raspaba HTML de
// cinecalidad.ec/.to, que hoy redirigen (301 de Cloudflare) a
// cinecalidad.org, y esa web ya no sirve catálogo en HTML: home y
// búsqueda devuelven el mismo shell SPA de 30.538 bytes, sin <article>.
// El sitio NO está muerto: su API nueva, declarada en el propio shell
// (fastApi: cinecalidad.org/wp-api/v1) y verificada contra el sitio real,
// busca, lista episodios y sirve players:
//   GET /search?postType=any&q=<palabra>&postsPerPage=16
//   GET /single/episodes/list?_id=<serie>&season=<S>&page=1&postsPerPage=100
//   GET /player?postId=<id>&demo=0   (postId con I mayúscula; post_id da
//                                     "Invalid ID" con un embed basura)
// Los embeds traen url, server, lang y quality. El castellano se descarta
// desde la lista, antes de resolver; el orden es Latino primero y luego
// Subtitulado/Inglés/Japonés, con parada en 2 streams (1 por idioma).

var TMDB_KEY = '1f54bd990f1cdfb230adb312546d765d';
var API_URL = 'https://cinecalidad.org/wp-api/v1/';

var ACCENT_MAP = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n', 'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u', 'Ñ': 'n', 'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u', 'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u', 'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ç': 'c', 'ã': 'a', 'õ': 'o' };
function stripAccents(s) {
  return (s || '').replace(/[^\x00-\x7F]/g, function (c) { return ACCENT_MAP[c] || ''; });
}
function normalizeText(text) {
  if (!text) return '';
  return stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function stripYear(title) {
  return (title || '').replace(/\s*\(\d{4}\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}
function toTmdbType(t) {
  return (t === 'tv' || t === 'series' || t === 'anime') ? 'tv' : 'movie';
}

function fetchTmdb(tmdbId, type) {
  function lang(l) {
    return fetchText('https://api.themoviedb.org/3/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=' + l, { headers: { Accept: 'application/json' } })
      .then(function (raw) { try { return JSON.parse(raw); } catch (e) { return null; } })
      .catch(function () { return null; });
  }
  return Promise.all([lang('es-MX'), lang('es-ES'), lang('en-US')]).then(function (rs) {
    var es = rs[0], eses = rs[1], en = rs[2];
    var isMovie = type === 'movie';
    var dateStr = (es && (isMovie ? es.release_date : es.first_air_date)) ||
      (en && (isMovie ? en.release_date : en.first_air_date)) || '';
    return {
      titles: [
        es && (isMovie ? es.title : es.name),
        eses && (isMovie ? eses.title : eses.name),
        en && (isMovie ? en.title : en.name),
        es && (isMovie ? es.original_title : es.original_name),
      ].filter(function (x) { return x; }),
      year: dateStr && dateStr.length >= 4 ? dateStr.slice(0, 4) : null,
    };
  });
}

var STOPWORDS = { y: 1, de: 1, la: 1, el: 1, los: 1, las: 1, un: 1, una: 1, del: 1, al: 1, e: 1, u: 1, o: 1, en: 1, con: 1, por: 1, para: 1, the: 1, a: 1, an: 1, of: 1, and: 1, to: 1, in: 1, on: 1, vs: 1 };

function searchWords(titles) {
  var out = [];
  var seen = {};
  for (var t = 0; t < titles.length; t++) {
    var words = normalizeText(titles[t]).split(' ').filter(Boolean);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length < 3 || STOPWORDS[w] || seen[w]) continue;
      seen[w] = true;
      out.push(w);
    }
  }
  return out.slice(0, 4);
}

function api(path) {
  return fetchJson(API_URL + path).then(function (res) {
    if (!res || res.error) throw new Error('CineCalidad API error');
    return res.data;
  });
}

function searchPosts(word) {
  return api('search?postType=any&q=' + encodeURIComponent(word) + '&postsPerPage=16')
    .then(function (data) { return (data && data.posts) || []; })
    .catch(function () { return []; });
}

function pickPost(posts, media, wantTv) {
  var want = wantTv ? ['tvshows', 'animes'] : ['movies'];
  var candTitles = media.titles.map(function (t) { return normalizeText(t); });
  var best = null, bestScore = -1;
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    if (want.indexOf(p.type) === -1) continue;
    var pt = normalizeText(stripYear(p.title || ''));
    var score = 0;
    for (var c = 0; c < candTitles.length; c++) {
      if (pt === candTitles[c]) { score = 100; break; }
      if (pt.indexOf(candTitles[c]) !== -1 || candTitles[c].indexOf(pt) !== -1) score = Math.max(score, 80);
    }
    if (score === 0) {
      var ptWords = pt.split(' ').filter(Boolean);
      var qWords = [];
      for (var t = 0; t < candTitles.length; t++) {
        var ws = candTitles[t].split(' ').filter(Boolean);
        for (var w = 0; w < ws.length; w++) {
          if (qWords.indexOf(ws[w]) === -1) qWords.push(ws[w]);
        }
      }
      var qm = 0;
      for (var q = 0; q < qWords.length; q++) {
        if (pt.indexOf(qWords[q]) !== -1) qm++;
      }
      if (qm === 0) continue;
      score = qm * 10;
    }
    if (media.year && (p.title || '').indexOf(media.year) !== -1) score += 5;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

function findPost(media, wantTv) {
  var words = searchWords(media.titles);
  if (!words.length) return Promise.resolve(null);
  var posts = [];
  var seen = {};
  function tryWord(i) {
    if (i >= words.length) return Promise.resolve();
    return searchPosts(words[i]).then(function (list) {
      for (var j = 0; j < list.length; j++) {
        if (!seen[list[j]._id]) { seen[list[j]._id] = true; posts.push(list[j]); }
      }
    }).then(function () {
      var best = pickPost(posts, media, wantTv);
      if (best) {
        var pb = normalizeText(stripYear(best.title || ''));
        for (var c = 0; c < media.titles.length; c++) {
          if (pb === normalizeText(media.titles[c])) return;
        }
      }
      return tryWord(i + 1);
    });
  }
  return tryWord(0).then(function () {
    return pickPost(posts, media, wantTv);
  });
}

// Portero de idioma: la etiqueta lang del embed manda. Pasan Latino,
// Subtitulado, Inglés y Japonés; se botan castellano, es_ES y «Español»
// a secas; sin etiqueta, pasa.
function langLabel(lang) {
  var s = stripAccents((lang || '').toLowerCase());
  if (s.indexOf('castellano') !== -1 || s.indexOf('espa') !== -1) return null;
  if (s.indexOf('latino') !== -1 || s.indexOf('lat') !== -1 || s.indexOf('mexic') !== -1) return 'Latino';
  if (s.indexOf('subtitulado') !== -1 || s.indexOf('sub') !== -1) return 'Subtitulado';
  if (s.indexOf('ingles') !== -1 || s.indexOf('english') !== -1) return 'Inglés';
  if (s.indexOf('japones') !== -1 || s.indexOf('japan') !== -1) return 'Japonés';
  if (!lang) return 'Latino';
  return null;
}

var LANG_ORDER = ['Latino', 'Subtitulado', 'Inglés', 'Japonés'];
var HOST_PRIORITY = ['vimeos', 'filemoon', 'streamwish', 'vidhide', 'uqload', 'dood'];

function hostRank(url) {
  for (var i = 0; i < HOST_PRIORITY.length; i++) {
    if (url.indexOf(HOST_PRIORITY[i]) !== -1) return i;
  }
  return HOST_PRIORITY.length;
}

function playerEmbeds(postId) {
  return api('player?postId=' + postId + '&demo=0').then(function (data) {
    // data.error (Invalid ID / Invalid post type) viene con un embed
    // basura (la.movie): sin embeds válidos no hay nada que resolver.
    if (!data || data.error) return [];
    return data.embeds || [];
  }).catch(function () { return []; });
}

function resolveEmbeds(embeds) {
  var list = [];
  for (var i = 0; i < embeds.length; i++) {
    var e = embeds[i] || {};
    var url = e.url || '';
    if (!url || url.indexOf('http') !== 0) continue;
    var label = langLabel(e.lang);
    if (!label) continue;
    var fixed = mapDomain(url);
    if (!getEmbedResolver(fixed)) continue;
    list.push({ url: fixed, label: label, lang: e.lang || '', quality: e.quality || 'HD', server: e.server || '' });
  }
  list.sort(function (a, b) {
    var la = LANG_ORDER.indexOf(a.label), lb = LANG_ORDER.indexOf(b.label);
    if (la !== lb) return la - lb;
    return hostRank(a.url) - hostRank(b.url);
  });
  // Un stream por idioma, en orden, parando con 1 Latino + 1 Subtitulado
  // (o el segundo idioma que pase). Nunca se resuelve castellano.
  var streams = [];
  var langsDone = {};
  function tryNext(i) {
    if (i >= list.length) return Promise.resolve(streams);
    if (streams.length >= 2) return Promise.resolve(streams);
    var e = list[i];
    if (langsDone[e.label]) return tryNext(i + 1);
    var resolver = getEmbedResolver(e.url);
    return resolver(e.url).then(function (r) {
      if (r && r.url) {
        langsDone[e.label] = true;
        var host = '';
        try { host = e.url.split('/')[2]; } catch (err) {}
        streams.push({
          name: 'CineCalidad (' + (e.server || host) + ')',
          title: (r.quality || e.quality) + ' · ' + e.label + ' · ' + host,
          url: r.url,
          quality: r.quality || e.quality,
          headers: r.headers,
        });
      }
      return tryNext(i + 1);
    }).catch(function () { return tryNext(i + 1); });
  }
  return tryNext(0);
}

function episodeStreams(serieId, season, episode) {
  return api('single/episodes/list?_id=' + serieId + '&season=' + season + '&page=1&postsPerPage=100')
    .then(function (data) {
      var eps = (data && data.posts) || [];
      for (var i = 0; i < eps.length; i++) {
        if (eps[i].season_number === season && eps[i].episode_number === episode) {
          return playerEmbeds(eps[i]._id).then(resolveEmbeds);
        }
      }
      return [];
    })
    .catch(function () { return []; });
}

export function extractStreams(tmdbId, mediaType, season, episode) {
  var tmdbType = toTmdbType(mediaType);
  var wantTv = tmdbType === 'tv';
  return fetchTmdb(tmdbId, tmdbType)
    .then(function (media) {
      if (!media.titles.length) return [];
      return findPost(media, wantTv).then(function (post) {
        if (!post) return [];
        if (!wantTv) return playerEmbeds(post._id).then(resolveEmbeds);
        return episodeStreams(post._id, parseInt(season, 10) || 1, parseInt(episode, 10) || 1);
      });
    })
    .catch(function (err) {
      console.error('[CineCalidad] Error: ' + (err && err.message ? err.message : err));
      return [];
    });
}
