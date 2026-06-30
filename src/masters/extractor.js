import { fetchText, fetchJson } from '../shared/http.js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://ww3.gnulahd.nu';

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getServerLabel(url) {
  if (url.indexOf('voe.sx') !== -1 || url.indexOf('tubeless') !== -1 || url.indexOf('simpulum') !== -1 ||
      url.indexOf('uroch') !== -1 || url.indexOf('nathanfromsubject') !== -1 || url.indexOf('yip.su') !== -1 ||
      url.indexOf('metagnath') !== -1 || url.indexOf('donaldlineelse') !== -1 || url.indexOf('crystal') !== -1 ||
      url.indexOf('cloudwindow') !== -1) return 'VOE';
  if (url.indexOf('they.tube') !== -1 || url.indexOf('the.tube') !== -1) return 'Tube';
  if (url.indexOf('filemoon') !== -1 || url.indexOf('bysedi') !== -1) return 'FileMoon';
  if (url.indexOf('streamwish') !== -1 || url.indexOf('hlswish') !== -1 || url.indexOf('vibuxer') !== -1 ||
      url.indexOf('strwish') !== -1) return 'StreamWish';
  if (url.indexOf('vidhide') !== -1 || url.indexOf('dintezuvio') !== -1 || url.indexOf('filelions') !== -1) return 'VidHide';
  if (url.indexOf('uqload') !== -1) return 'Uqload';
  if (url.indexOf('luluvid') !== -1 || url.indexOf('lulus') !== -1) return 'Lulu';
  if (url.indexOf('ok.ru') !== -1 || url.indexOf('ok video') !== -1) return 'OK';
  return 'Online';
}

function extractSearchResults(html) {
  var candidates = [];
  var articleRegex = /<article[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/article>/gi;
  var article;
  while ((article = articleRegex.exec(html)) !== null) {
    var cls = article[1];
    var content = article[2];
    if (/styleegg/i.test(cls)) continue;
    if (/\/blog\//i.test(content)) continue;

    var href = (content.match(/<a[^>]*href="([^"]*)"[^>]*>/) || [])[1];
    var titleAttr = (content.match(/title="([^"]*)"/) || [])[1];
    var h2Text = (content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1];

    var itemTitle = (h2Text || titleAttr || '').replace(/<[^>]*>/g, '').trim();
    if (!href || !itemTitle) continue;
    if (/mejores|cronología/i.test(itemTitle)) continue;

    var typeText = (content.match(/<div[^>]*class="[^"]*typez[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
    var type = /serie/i.test(typeText) || /anime/i.test(typeText) ? 'tv' : 'movie';

    candidates.push({ title: itemTitle, href: href, type: type });
  }
  return candidates;
}

function extractEpisodes(html, season, episode) {
  var eplister = html.match(/<div[^>]*class="[^"]*eplister[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\!--/i);
  if (!eplister) eplister = html.match(/<div[^>]*class="[^"]*eplister[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (!eplister) return null;

  var liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  var li;
  while ((li = liRegex.exec(eplister[1])) !== null) {
    var liContent = li[1];
    var aHref = (liContent.match(/<a[^>]*href="([^"]*)"[^>]*>/i) || [])[1];
    var epNum = (liContent.match(/<div[^>]*class="[^"]*epl-num[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1];
    if (!aHref || !epNum) continue;

    var match = epNum.match(/(\d+)x(\d+)/);
    if (match) {
      var s = parseInt(match[1], 10);
      var e = parseInt(match[2], 10);
      if (s === season && e === episode) return aHref;
    }
  }
  return null;
}

function getMediaTitle(tmdbId, mediaType) {
  var url = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=es-MX';
  return fetchText(url)
    .then(function(raw) {
      var data = JSON.parse(raw);
      var title = mediaType === 'movie' ? data.title : data.name;
      var originalTitle = mediaType === 'movie' ? data.original_title : data.original_name;
      return { title: title, originalTitle: originalTitle };
    });
}

function resolveTheyTube(code, resolvePath, authParam, pageUrl) {
  var resolveUrl = MAIN_URL + resolvePath + encodeURIComponent(code) + authParam;
  return fetchText(resolveUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36', Referer: pageUrl }
  })
    .then(function(raw) {
      var data = JSON.parse(raw);
      if (data && data.master) {
        return { url: data.master, quality: '1080p', headers: { Referer: 'https://they.tube/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } };
      }
      return null;
    })
    .catch(function() { return null; });
}

function searchSite(query) {
  var searchUrl = MAIN_URL + '/?s=' + encodeURIComponent(query);
  return fetchText(searchUrl).then(function(html) {
    return extractSearchResults(html);
  });
}

export function extractStreams(tmdbId, mediaType, season, episode) {
  return getMediaTitle(tmdbId, mediaType)
    .then(function(media) {
      var queries = [];
      if (media.originalTitle) queries.push(media.originalTitle);
      if (media.title && media.title !== media.originalTitle) queries.push(media.title);
      if (queries.length === 0) return [];

      var normalizedOriginals = [normalizeText(media.originalTitle || '')];
      var normalizedTitles = [normalizeText(media.title || '')];
      var expectedType = mediaType === 'tv' ? 'tv' : 'movie';

      var bestTvScore = -1, bestTvUrl = null, bestTvType = 'movie';
      var bestMovieScore = -1, bestMovieUrl = null, bestMovieType = 'movie';

      function scoreCandidate(cand) {
        var normalizedCand = normalizeText(cand.title);
        var score = 0;

        for (var n = 0; n < normalizedOriginals.length; n++) {
          var no = normalizedOriginals[n];
          if (normalizedCand === no) score = 100;
          else if (normalizedCand.indexOf(no) !== -1 || no.indexOf(normalizedCand) !== -1) score = Math.max(score, 80);
        }
        for (var n = 0; n < normalizedTitles.length; n++) {
          var nt = normalizedTitles[n];
          if (normalizedCand === nt) score = Math.max(score, 100);
          else if (normalizedCand.indexOf(nt) !== -1 || nt.indexOf(normalizedCand) !== -1) score = Math.max(score, 80);
        }

        if (score === 0) {
          var qWords = [];
          for (var n = 0; n < normalizedOriginals.length; n++)
            qWords = qWords.concat(normalizedOriginals[n].split(' ').filter(Boolean));
          for (var n = 0; n < normalizedTitles.length; n++)
            qWords = qWords.concat(normalizedTitles[n].split(' ').filter(Boolean));
          var unique = {};
          qWords = qWords.filter(function(w) { if (unique[w]) return false; unique[w] = true; return true; });
          var cWords = normalizedCand.split(' ').filter(Boolean);
          var qMatch = 0, cMatch = 0;
          for (var w = 0; w < qWords.length; w++) {
            if (normalizedCand.indexOf(qWords[w]) !== -1) qMatch++;
          }
          for (var w = 0; w < cWords.length; w++) {
            for (var q = 0; q < qWords.length; q++) {
              if (qWords[q] === cWords[w]) { cMatch++; break; }
            }
          }
          score = qMatch * 8 + cMatch * 5;
        }

        if (cand.type === 'tv' && score > bestTvScore) { bestTvScore = score; bestTvUrl = cand.href; bestTvType = cand.type; }
        if (cand.type === 'movie' && score > bestMovieScore) { bestMovieScore = score; bestMovieUrl = cand.href; bestMovieType = cand.type; }
      }

      function selectTarget() {
        var targetUrl, targetType = 'movie';
        if (expectedType === 'tv' && bestTvUrl) { targetUrl = bestTvUrl; targetType = bestTvType; }
        else if (expectedType === 'movie' && bestMovieUrl) { targetUrl = bestMovieUrl; targetType = bestMovieType; }
        else { targetUrl = bestTvUrl || bestMovieUrl; targetType = bestTvType || bestMovieType; }

        if (!targetUrl) return null;
        if (targetUrl.indexOf('http') !== 0) targetUrl = MAIN_URL + targetUrl;
        return { url: targetUrl, type: targetType };
      }

      var searchIndex = 0;
      function doSearch() {
        if (searchIndex >= queries.length) return selectTarget();

        return searchSite(queries[searchIndex++])
          .then(function(candidates) {
            for (var i = 0; i < candidates.length; i++) scoreCandidate(candidates[i]);
            return doSearch();
          });
      }

      return doSearch().then(function(target) {
        if (!target) return [];
        return getPageContent(target.url, mediaType, target.type, season, episode, media);
      });
    })
    .catch(function(err) {
      console.error('[Masters] Error: ' + (err.message || err));
      return [];
    });
}

function getPageContent(pageUrl, mediaType, targetType, season, episode, media) {
  var isTv = mediaType === 'tv' || targetType === 'tv';

  if (isTv) {
    return fetchText(pageUrl)
      .then(function(tvHtml) {
        var epUrl = extractEpisodes(tvHtml, season, episode);
        if (!epUrl) return [];
        if (epUrl.indexOf('http') !== 0) epUrl = MAIN_URL + epUrl;
        return getPlayPage(epUrl);
      });
  }

  return getPlayPage(pageUrl);
}

function getPlayPage(pageUrl) {
  return fetchText(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
  })
    .then(function(playHtml) {
      var regex = /var\s+(_gnpv_ep_langs|_gd)\s*=\s*(\[.*\]);/;
      var match = regex.exec(playHtml);
      if (!match) return [];

      var resolvePath = null, authParam = null;
      var resolveMatch = playHtml.match(/var\s+RESOLVE\s*=\s*'([^']*)'\s*,\s*AUTH\s*=\s*'([^']*)'/);
      if (resolveMatch) {
        resolvePath = resolveMatch[1];
        authParam = resolveMatch[2];
      }

      var langs;
      try { langs = JSON.parse(match[2]); } catch (e) { return []; }
      var streams = [];

      var promises = [];
      for (var l = 0; l < langs.length; l++) {
        var langobj = langs[l];
        var label = langobj.label || '';
        if (label.toLowerCase().indexOf('latino') === -1 && label.toLowerCase().indexOf('mx') === -1) continue;

        var servers = langobj.servers || [];
        for (var s = 0; s < servers.length; s++) {
          var srv = servers[s];
          var cleanSrc = (srv.src || '').replace(/\\\//g, '/');
          if (!cleanSrc) continue;
          if (cleanSrc.indexOf('//') === 0) cleanSrc = 'https:' + cleanSrc;

          if ((cleanSrc.indexOf('they.tube') !== -1 || cleanSrc.indexOf('the.tube') !== -1) && resolvePath && authParam) {
            var codeMatch = cleanSrc.match(/the(?:y)?\.tube\/(?:e\/)?([A-Za-z0-9_-]+?)(?:\.html)?(?:[?#]|$)/i);
            if (codeMatch) {
              (function(src, title) {
                promises.push(
                  resolveTheyTube(codeMatch[1], resolvePath, authParam, pageUrl)
                    .then(function(result) {
                      if (result) {
                        streams.push({
                          name: 'GnulaHD (' + (title || 'Tube') + ')',
                          title: (result.quality || 'HD') + ' · Latino · ' + (title || 'Tube'),
                          url: result.url,
                          quality: result.quality || 'HD',
                          headers: result.headers,
                        });
                      } else {
                        streams.push({
                          name: 'GnulaHD (' + (title || 'Tube') + ')',
                          title: 'Embed · Latino · ' + (title || 'Tube'),
                          url: src,
                          quality: 'Unknown',
                          headers: { Referer: pageUrl, 'User-Agent': 'Mozilla/5.0' },
                        });
                      }
                    })
                );
              })(cleanSrc, srv.title);
              continue;
            }
          }

          var serverLabel = getServerLabel(cleanSrc);
          streams.push({
            name: 'GnulaHD (' + (srv.title || serverLabel) + ')',
            title: 'Embed · Latino · ' + (srv.title || serverLabel),
            url: cleanSrc,
            quality: 'Unknown',
            headers: { Referer: pageUrl, 'User-Agent': 'Mozilla/5.0' },
          });
        }
      }

      if (promises.length > 0) {
        return Promise.all(promises).then(function() { return streams; });
      }
      return streams;
    });
}
