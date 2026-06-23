var v = Object.defineProperty;
var V = Object.getOwnPropertyDescriptor;
var D = Object.getOwnPropertyNames, U = Object.getOwnPropertySymbols;
var W = Object.prototype.hasOwnProperty, z = Object.prototype.propertyIsEnumerable;
var M = (e, t, n) => t in e ? v(e, t, { enumerable: true, configurable: true, writable: true, value: n }) : e[t] = n, S = (e, t) => {
  for (var n in t || (t = {}))
    W.call(t, n) && M(e, n, t[n]);
  if (U)
    for (var n of U(t))
      z.call(t, n) && M(e, n, t[n]);
  return e;
};
var I = (e, t) => {
  for (var n in t)
    v(e, n, { get: t[n], enumerable: true });
}, P = (e, t, n, s) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let o of D(t))
      !W.call(e, o) && o !== n && v(e, o, { get: () => t[o], enumerable: !(s = V(t, o)) || s.enumerable });
  return e;
};
var B = (e) => P(v({}, "__esModule", { value: true }), e);
var d = (e, t, n) => new Promise((s, o) => {
  var r = (c) => {
    try {
      u(n.next(c));
    } catch (a) {
      o(a);
    }
  }, i = (c) => {
    try {
      u(n.throw(c));
    } catch (a) {
      o(a);
    }
  }, u = (c) => c.done ? s(c.value) : Promise.resolve(c.value).then(r, i);
  u((n = n.apply(e, t)).next());
});
var pe = {};
I(pe, { getStreams: () => de });
module.exports = B(pe);

if (typeof CryptoJS === "undefined") var CryptoJS = require("crypto-js");

const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const LACARTOONS = "https://lacartoons.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "es-MX,es;q=0.9" };

const CUBE_KEY = CryptoJS.enc.Utf8.parse("kiemtienmua911ca");
const CUBE_IV = CryptoJS.enc.Utf8.parse("1234567890oiuytr");
const CUBE_VIDEO_API = "https://cubeembed.rpmvid.com/api/v1/video?id=";

function slugify(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function extractJsonAttr(html) {
  let m = html.match(/hlsManifestUrl[^:]*:"([^"]+)"/);
  if (m) {
    let url = m[1].replace(/\\u0026/g, "&").replace(/\\\"/g, "").replace(/\\"/g, "");
    return url;
  }
  m = html.match(/hlsManifestUrl[^:]*:\\"([^\\]+)\\"/);
  if (m) {
    let url = m[1].replace(/\\u0026/g, "&");
    return url;
  }
  return null;
}

function extractVideoUrls(html) {
  let m = html.match(/"videos"\s*:\s*\[([^\]]+)\]/);
  if (!m) return [];
  let urls = [];
  let regex = /"url"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(m[1])) !== null) {
    let url = match[1].replace(/\\u0026/g, "&");
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

async function fetchTMDB(tmdbId, type) {
  let langs = ["es-MX", "es-ES", "en-US"];
  for (let lang of langs) {
    try {
      let res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=${lang}`, { headers: HEADERS });
      if (!res.ok) continue;
      let data = await res.json();
      let title = type === "movie" ? data.title : data.name;
      let origTitle = type === "movie" ? data.original_title : data.original_name;
      let year = (data.release_date || data.first_air_date || "").substring(0, 4);
      if (title) return { title, originalTitle: origTitle, year };
    } catch (e) {}
  }
  return null;
}

async function searchLacartoons(query) {
  let url = `${LACARTOONS}/?s=${encodeURIComponent(query)}`;
  try {
    let res = await fetch(url, { headers: HEADERS });
    let html = await res.text();
    let results = [];
    let regex = /<a\s+href="\/serie\/(\d+)"[^>]*>[\s\S]*?<div[^>]*class="serie"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<p[^>]*class="nombre-serie"[^>]*>([\s\S]*?)<\/p>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push({ id: match[1], title: match[3].trim(), poster: match[2] });
    }
    if (results.length === 0) {
      let regex2 = /<a\s+href="\/serie\/(\d+)"[^>]*>[\s\S]*?<p[^>]*class="nombre-serie"[^>]*>([\s\S]*?)<\/p>/g;
      while ((match = regex2.exec(html)) !== null) {
        results.push({ id: match[1], title: match[2].trim() });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

async function getSeriesEpisodes(seriesId) {
  try {
    let res = await fetch(`${LACARTOONS}/serie/${seriesId}`, { headers: HEADERS });
    let html = await res.text();
    let episodes = [];
    let regex = /<a\s+href="(\/serie\/capitulo\/(\d+)[^"]*)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      let href = match[1];
      let epId = match[2];
      let epNumText = match[3].trim();
      let season = 1;
      let tMatch = href.match(/[?&]t=(\d+)/);
      if (tMatch) season = parseInt(tMatch[1]);
      let epNum = parseInt(epNumText.match(/\d+/)?.[0]) || episodes.length + 1;
      let titleText = "";
      let titleMatch = html.substring(match.index + match[0].length).match(/^[\s\S]*?<\/a>/);
      if (titleMatch) {
        let after = html.substring(match.index + match[0].length, match.index + match[0].length + titleMatch[0].length);
        titleText = after.replace(/<[^>]+>/g, "").replace(epNumText, "").trim();
      }
      episodes.push({
        id: epId,
        season,
        number: epNum,
        title: titleText || `Capítulo ${epNum}`,
        url: LACARTOONS + href
      });
    }
    if (episodes.length === 0) {
      let regex2 = /href="(\/serie\/capitulo\/(\d+)[^"]*)"/g;
      let seen = new Set();
      while ((match = regex2.exec(html)) !== null) {
        let href = match[1];
        let epId = match[2];
        if (seen.has(epId)) continue;
        seen.add(epId);
        let tMatch = href.match(/[?&]t=(\d+)/);
        let season = tMatch ? parseInt(tMatch[1]) : 1;
        episodes.push({
          id: epId,
          season,
          number: episodes.length + 1,
          title: `Capítulo ${episodes.length + 1}`,
          url: LACARTOONS + href
        });
      }
    }
    return episodes;
  } catch (e) {
    return [];
  }
}

async function getEpisodeEmbed(episodeUrl) {
  try {
    let res = await fetch(episodeUrl, { headers: HEADERS });
    let html = await res.text();
    let m = html.match(/<iframe[^>]+src="([^"]+)"/);
    if (m) return m[1];
    return null;
  } catch (e) {
    return null;
  }
}

function decryptCubeembed(hex) {
  try {
    let parsed = CryptoJS.enc.Hex.parse(hex.trim());
    let decrypted = CryptoJS.AES.decrypt(
      { ciphertext: parsed },
      CUBE_KEY,
      { iv: CUBE_IV, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    let json = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

async function resolveCubeEmbed(embedUrl) {
  try {
    let videoId;
    let hash = embedUrl.split("#")[1];
    if (hash) {
      videoId = hash.split("?")[0];
    } else {
      let segments = embedUrl.replace(/\/+$/, "").split("/");
      videoId = segments[segments.length - 1].split("?")[0];
    }
    if (!videoId) return null;
    let w = 1280, h = 720;
    let apiUrl = `${CUBE_VIDEO_API}${videoId}&w=${w}&h=${h}&r=${encodeURIComponent(LACARTOONS + "/")}`;
    let res = await fetch(apiUrl, {
      headers: { Referer: LACARTOONS + "/", "User-Agent": UA }
    });
    if (!res.ok) return null;
    let hex = await res.text();
    let data = decryptCubeembed(hex);
    if (!data || !data.source) return null;
    return {
      url: data.source,
      quality: "Unknown",
      headers: { Referer: "https://cubeembed.rpmvid.com/", "User-Agent": UA }
    };
  } catch (e) {
    return null;
  }
}

async function resolveOkRu(embedUrl) {
  try {
    let res = await fetch(embedUrl, { headers: S({}, HEADERS, { Referer: LACARTOONS }) });
    if (!res.ok) return null;
    let html = await res.text();
    let hlsUrl = extractJsonAttr(html);
    if (hlsUrl) {
      return { url: hlsUrl, quality: "Unknown", headers: { Referer: "https://ok.ru/", "User-Agent": UA } };
    }
    let videoUrls = extractVideoUrls(html);
    if (videoUrls.length > 0) {
      let best = videoUrls[videoUrls.length - 1];
      return { url: best, quality: "Unknown", headers: { Referer: "https://ok.ru/", "User-Agent": UA } };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function de(e, t, n, s) {
  return d(this, null, function* () {
    if (!e || !t) return [];
    if (t !== "tv") return [];
    try {
      let tmdb = yield fetchTMDB(e, t);
      if (!tmdb || !tmdb.title) return [];
      let slugs = [slugify(tmdb.title)];
      if (tmdb.originalTitle && tmdb.originalTitle !== tmdb.title) slugs.push(slugify(tmdb.originalTitle));
      let seriesList = [];
      for (let q of slugs) {
        let results = yield searchLacartoons(q);
        if (results.length > 0) { seriesList = results; break; }
      }
      if (seriesList.length === 0) {
        let results = yield searchLacartoons(slugify(tmdb.title).split("-")[0]);
        if (results.length > 0) seriesList = results;
      }
      if (seriesList.length === 0) return [];
      let bestMatch = seriesList.find(x => slugify(x.title).includes(slugs[0])) || seriesList[0];
      let episodes = yield getSeriesEpisodes(bestMatch.id);
      if (episodes.length === 0) return [];
      let ep = episodes.find(function(x) { return x.season === (n || 1) && x.number === (s || 1); });
      if (!ep) return [];
      let embedUrl = yield getEpisodeEmbed(ep.url);
      if (!embedUrl) return [];
      let stream = null;
      if (embedUrl.includes("ok.ru")) {
        stream = yield resolveOkRu(embedUrl);
      } else if (embedUrl.includes("cubeembed")) {
        stream = yield resolveCubeEmbed(embedUrl);
      } else {
        return [];
      }
      if (!stream) return [];
      let label = embedUrl.includes("ok.ru") ? "OK.ru" : "CubeEmbed";
      return [{ title: `${stream.quality} · ${label}`, url: stream.url, quality: stream.quality, headers: stream.headers }];
    } catch (e) {
      return [];
    }
  });
}
