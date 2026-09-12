import { fetchText, fetchJson } from '../shared/http.js';
import { getEmbedResolver, mapDomain } from '../shared/embedResolvers.js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const API_URL = 'https://cuevana.gs/wp-api/v1/';
const API_FALLBACKS = ['https://cuevana.gs/wp-api/v1/', 'https://cuevana8.com/wp-api/v1/', 'https://cuevana3.eu/wp-api/v1/'];

var ACCENT_MAP = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n', 'Á': 'a', 'É': 'a', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u', 'Ñ': 'n', 'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u', 'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u', 'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ç': 'c', 'ã': 'a', 'õ': 'o' };

function stripAccents(s) {
  return (s || '').replace(/[^\x00-\x7F]/g, function(c) { return ACCENT_MAP[c] || ''; });
}

// QuickJS (Nuvio) has no String.normalize: explicit accent map instead.
function normalizeText(text) {
  if (!text) return '';
  return stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(s) {
  return (s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function stripYear(title) {
  return (title || '').replace(/\s*\(\d{4}\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

var STOPWORDS = { y: 1, de: 1, la: 1, el: 1, los: 1, las: 1, un: 1, una: 1, del: 1, al: 1, e: 1, u: 1, o: 1, en: 1, con: 1, por: 1, para: 1, the: 1, a: 1, an: 1, of: 1, and: 1, to: 1, in: 1, on: 1, vs: 1 };

function searchWords(media) {
  var all = normalizeText((media.originalTitle || '') + ' ' + (media.title || ''));
  var words = all.replace(/[^a-z0-9]/g, ' ').split(' ').filter(Boolean);
  var unique = {}, out = [];
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (w.length < 3 || STOPWORDS[w] || unique[w]) continue;
    unique[w] = true;
    out.push(w);
  }
  out.sort(function(a, b) { return b.length - a.length; });
  return out.slice(0, 3);
}

function getMediaTitle(tmdbId, tmdbType) {
  var url = 'https://api.themoviedb.org/3/' + tmdbType + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=es-MX';
  return fetchJson(url).then(function(data) {
    var isMovie = tmdbType === 'movie';
    var date = isMovie ? data.release_date : data.first_air_date;
    return {
      title: isMovie ? data.title : data.name,
      originalTitle: isMovie ? data.original_title : data.original_name,
      year: date && date.length >= 4 ? date.slice(0, 4) : null,
    };
  });
}

function tryApi(path, idx) {
  if (idx === undefined) idx = 0;
  if (idx >= API_FALLBACKS.length) return Promise.reject(new Error('Cuevana API error - all domains failed'));
  return fetchJson(API_FALLBACKS[idx] + path).then(function(res) {
    if (!res || res.error) throw new Error('Cuevana API error');
    return res.data;
  }).catch(function(e) {
    if (idx + 1 < API_FALLBACKS.length) return tryApi(path, idx + 1);
    throw e;
  });
}
function api(path) { return tryApi(path, 0); }

function pickPost(posts, media, wantTv, ignoreYear) {
  var no = normalizeText(media.originalTitle || '');
  var nt = normalizeText(media.title || '');
  var best = null, bestScore = -1;
  // Build word list for fuzzy fallback (same as fanpelis)
  var allNorm = (no + ' ' + nt).trim();
  var qWords = allNorm ? allNorm.split(' ').filter(Boolean) : [];
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    var isTv = p.type === 'tvshows' || p.type === 'series' || p.type === 'animes';
    if (wantTv !== isTv) continue;
    var pt = normalizeText(stripYear(decodeEntities(p.title || '')));
    var score = 0;
    if (pt === no || pt === nt) score = 100;
    else if ((no && (pt.indexOf(no) !== -1 || no.indexOf(pt) !== -1)) ||
             (nt && (pt.indexOf(nt) !== -1 || nt.indexOf(pt) !== -1))) score = 80;
    if (score === 0) {
      var ptWords = pt.split(' ').filter(Boolean);
      var qMatch = 0, cMatch = 0;
      for (var qi = 0; qi < qWords.length; qi++) if (pt.indexOf(qWords[qi]) !== -1) qMatch++;
      for (var ci = 0; ci < ptWords.length; ci++) for (var qj = 0; qj < qWords.length; qj++) if (qWords[qj] === ptWords[ci]) { cMatch++; break; }
      score = qMatch * 8 + cMatch * 5;
      if (score < 10) continue;
    }
    if (!ignoreYear) {
      if (media.year && (p.title || '').indexOf(media.year) !== -1) score += 5;
      else if (media.year && p.release_date && p.release_date.indexOf(media.year) === 0) score += 5;
    }
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

// Cuevana wraps some embeds in player.php pages; unwrap to the direct host iframe.
function unwrapPlayer(embedUrl) {
  if (!embedUrl || embedUrl.indexOf('player.php') === -1) return Promise.resolve(embedUrl);
  return fetchText(embedUrl, { headers: { Referer: 'https://cuevana.gs/' } })
    .then(function(html) {
      var m = html.match(/<iframe\b[^>]*src="([^"]+)"[^>]*>/i);
      if (!m) return embedUrl;
      var src = m[1];
      if (src.indexOf('//') === 0) src = 'https:' + src;
      return src.indexOf('http') === 0 ? src : embedUrl;
    })
    .catch(function() { return embedUrl; });
}

function resolveEmbeds(embeds) {
  var streams = [];
  var jobs = (embeds || []).map(function(e) {
    var url = e.url || '';
    if (!url || url.indexOf('magnet:') === 0) return Promise.resolve();
    return unwrapPlayer(url).then(function(target) {
      if (!target) return null;
      // Only drop if unwrapped URL is still cuevana-related (avoid infinite loop)
      if (target !== url && target.indexOf('cuevana') !== -1) return null;
      var fixed = mapDomain(target);
      var resolver = getEmbedResolver(fixed);
      if (!resolver) return null;
      var lang = e.lang || 'LAT';
      return resolver(fixed).then(function(r) {
        if (r && r.url) {
          var host = '';
          try { host = fixed.split('/')[2]; } catch (err) {}
          streams.push({
            name: 'Cuevana (' + lang + ')',
            title: (r.quality || e.quality || 'HD') + ' · ' + lang + ' · ' + host,
            url: r.url,
            quality: r.quality || e.quality || 'HD',
            headers: r.headers,
          });
        }
      }).catch(function() {});
    });
  });
  return Promise.all(jobs).then(function() { return streams; });
}

function movieStreams(postId) {
  return api('player?postId=' + postId + '&demo=0')
    .then(function(data) { return resolveEmbeds(data.embeds); })
    .catch(function() { return []; });
}

function episodeStreams(showId, season, episode) {
  return api('single/episodes/list?_id=' + showId + '&season=' + season + '&page=1&postsPerPage=100')
    .then(function(data) {
      var posts = (data && data.posts) || [];
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].season_number === season && posts[i].episode_number === episode) {
          return api('player?postId=' + posts[i]._id + '&demo=0')
            .then(function(d) { return resolveEmbeds(d.embeds); });
        }
      }
      return [];
    })
    .catch(function() { return []; });
}

export function extractStreams(tmdbId, mediaType, season, episode) {
  // Nuvio passes Stremio content types ("movie"/"series"); API uses movies/tvshows.
  var tmdbType = (mediaType === 'tv' || mediaType === 'series' || mediaType === 'anime') ? 'tv' : 'movie';
  var wantTv = tmdbType === 'tv';
  return getMediaTitle(tmdbId, tmdbType)
    .then(function(media) {
      var words = searchWords(media);
      if (!words.length) return [];
      var posts = [];
      var seen = {};
      var chain = Promise.resolve();
      words.forEach(function(w) {
        chain = chain.then(function() {
          return api('search?q=' + encodeURIComponent(w) + '&page=1&postType=any&postsPerPage=16')
            .then(function(data) {
              var list = (data && data.posts) || [];
              for (var i = 0; i < list.length; i++) {
                if (!seen[list[i]._id]) { seen[list[i]._id] = true; posts.push(list[i]); }
              }
            }).catch(function() {});
        });
      });
      return chain.then(function() {
        var best = pickPost(posts, media, wantTv, false);
        if (!best) best = pickPost(posts, media, wantTv, true);
        if (!best) return [];
        if (!wantTv) return movieStreams(best._id);
        return episodeStreams(best._id, parseInt(season, 10) || 1, parseInt(episode, 10) || 1);
      });
    })
    .catch(function(err) {
      console.error('[Cuevana] Error: ' + (err && err.message ? err.message : err));
      return [];
    });
}
