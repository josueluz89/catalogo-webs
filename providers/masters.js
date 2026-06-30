/**
 * masters - Built from src/masters/
 * Generated: 2026-06-30T02:02:05.726Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/shared/http.js
var FETCH_TIMEOUT = 15e3;
function fetchWithTimeout(_0) {
  return __async(this, arguments, function* (url, options = {}, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
        signal: controller.signal,
        headers: __spreadValues({
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }, options.headers),
        redirect: "follow"
      }));
      return response;
    } finally {
      clearTimeout(timer);
    }
  });
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}, timeout = FETCH_TIMEOUT) {
    const res = yield fetchWithTimeout(url, options, timeout);
    if (!res.ok)
      throw new Error(`HTTP ${res.status} for ${url}`);
    return yield res.text();
  });
}

// src/masters/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://ww3.gnulahd.nu";
function normalizeText(text) {
  if (!text)
    return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function getMediaTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const res = yield fetch(url);
    if (!res.ok)
      throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    const data = yield res.json();
    const title = mediaType === "movie" ? data.title : data.name;
    const originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    const year = (data.release_date || data.first_air_date || "").split("-")[0];
    return { title, originalTitle, year };
  });
}
function getServerLabel(url) {
  if (url.includes("voe.sx") || url.includes("tubeless") || url.includes("simpulum") || url.includes("uroch") || url.includes("nathanfromsubject") || url.includes("yip.su") || url.includes("metagnath") || url.includes("donaldlineelse") || url.includes("crystal") || url.includes("cloudwindow"))
    return "VOE";
  if (url.includes("they.tube") || url.includes("the.tube"))
    return "Tube";
  if (url.includes("filemoon") || url.includes("bysedi"))
    return "FileMoon";
  if (url.includes("streamwish") || url.includes("hlswish") || url.includes("vibuxer") || url.includes("strwish"))
    return "StreamWish";
  if (url.includes("vidhide") || url.includes("dintezuvio") || url.includes("filelions"))
    return "VidHide";
  if (url.includes("uqload"))
    return "Uqload";
  if (url.includes("luluvid") || url.includes("lulus"))
    return "Lulu";
  if (url.includes("ok.ru") || url.includes("ok video"))
    return "OK";
  return "Online";
}
function resolveTheyTube(code, resolvePath, authParam, pageUrl) {
  return __async(this, null, function* () {
    try {
      const resolveUrl = `${MAIN_URL}${resolvePath}${encodeURIComponent(code)}${authParam}`;
      const res = yield fetch(resolveUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36", Referer: pageUrl }
      });
      if (!res.ok)
        return null;
      const data = yield res.json();
      if (data && data.master) {
        return { url: data.master, quality: "1080p", headers: { Referer: MAIN_URL + "/", "User-Agent": "Mozilla/5.0" } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("div.listupd article.bs").each((i, el) => {
        const $el = $(el);
        if ($el.hasClass("styleegg"))
          return;
        const aTag = $el.find("div.bsx > a");
        const itemTitle = aTag.attr("title") || $el.find("div.tt h2").text().trim();
        const href = aTag.attr("href");
        const typeText = $el.find("div.typez").text().trim();
        if (!href || !itemTitle || href.includes("/blog/"))
          return;
        if (itemTitle.includes("Mejores") || itemTitle.includes("Cronolog\xEDa"))
          return;
        const type = typeText.includes("Serie") ? "tv" : typeText.includes("Anime") ? "tv" : "movie";
        candidates.push({ title: itemTitle, href, type, typeText });
      });
      let targetUrl = null;
      let targetType = "movie";
      const normalizedQuery = normalizeText(query);
      const normalizedOriginal = normalizeText(originalTitle);
      const expectedType = mediaType === "tv" ? "tv" : "movie";
      let bestTvScore = -1;
      let bestTvUrl = null;
      let bestMovieScore = -1;
      let bestMovieUrl = null;
      for (const cand of candidates) {
        const normalizedCand = normalizeText(cand.title);
        let score = 0;
        if (normalizedCand === normalizedQuery || normalizedCand === normalizedOriginal) {
          score = 100;
        } else if (normalizedCand.includes(normalizedQuery) || normalizedCand.includes(normalizedOriginal)) {
          score = 60;
        } else {
          const qWords = normalizedQuery.split(" ").filter(Boolean);
          const oWords = normalizedOriginal.split(" ").filter(Boolean);
          const cWords = normalizedCand.split(" ").filter(Boolean);
          const qMatch = qWords.filter((w) => normalizedCand.includes(w)).length;
          const oMatch = oWords.filter((w) => normalizedCand.includes(w)).length;
          const cMatch = cWords.filter((w) => normalizedQuery.includes(w) || normalizedOriginal.includes(w)).length;
          score = qMatch * 8 + oMatch * 8 + cMatch * 5;
        }
        if (cand.type === "tv" && score > bestTvScore) {
          bestTvScore = score;
          bestTvUrl = cand.href;
        }
        if (cand.type === "movie" && score > bestMovieScore) {
          bestMovieScore = score;
          bestMovieUrl = cand.href;
        }
      }
      if (expectedType === "tv" && bestTvUrl) {
        targetUrl = bestTvUrl;
      } else if (expectedType === "movie" && bestMovieUrl) {
        targetUrl = bestMovieUrl;
      } else {
        targetUrl = bestTvUrl || bestMovieUrl || (candidates.length > 0 ? candidates[0].href : null);
      }
      if (targetUrl) {
        const matched = candidates.find((c) => c.href === targetUrl);
        if (matched)
          targetType = matched.type;
      }
      if (!targetUrl)
        return [];
      let pageUrl = targetUrl;
      if (!pageUrl.startsWith("http"))
        pageUrl = MAIN_URL + pageUrl;
      if (mediaType === "tv" || targetType === "tv") {
        const tvHtml = yield fetchText(pageUrl);
        const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
        let epUrl = null;
        tv$("div.eplister ul li").each((i, el) => {
          const a = tv$(el).find("a");
          const href = a.attr("href");
          const epnumtext = a.find("div.epl-num").text().trim();
          const regex2 = /(\d+)x(\d+)/;
          const match2 = regex2.exec(epnumtext);
          if (match2) {
            const s = parseInt(match2[1], 10);
            const e = parseInt(match2[2], 10);
            if (s === season && e === episode) {
              epUrl = href;
            }
          }
        });
        if (!epUrl)
          return [];
        pageUrl = epUrl;
        if (!pageUrl.startsWith("http"))
          pageUrl = MAIN_URL + pageUrl;
      }
      const playHtml = yield fetchText(pageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
      });
      const regex = /var\s+(_gnpv_ep_langs|_gd)\s*=\s*(\[.*\]);/;
      const match = regex.exec(playHtml);
      if (!match)
        return [];
      let resolvePath = null;
      let authParam = null;
      const resolveMatch = playHtml.match(/var\s+RESOLVE\s*=\s*'([^']*)'\s*,\s*AUTH\s*=\s*'([^']*)'/);
      if (resolveMatch) {
        resolvePath = resolveMatch[1];
        authParam = resolveMatch[2];
      }
      const langs = JSON.parse(match[2]);
      const streams = [];
      for (const langobj of langs) {
        const label = langobj.label || "";
        const normalizedLabel = label.toLowerCase();
        if (!normalizedLabel.includes("latino") && !normalizedLabel.includes("mx"))
          continue;
        for (const srv of langobj.servers || []) {
          let cleanSrc = (srv.src || "").replace(/\\\//g, "/");
          if (!cleanSrc)
            continue;
          if (cleanSrc.startsWith("//"))
            cleanSrc = "https:" + cleanSrc;
          if ((cleanSrc.includes("they.tube") || cleanSrc.includes("the.tube")) && resolvePath && authParam) {
            const codeMatch = cleanSrc.match(/the(?:y)?\.tube\/(?:e\/)?([A-Za-z0-9_-]+?)(?:\.html)?(?:[?#]|$)/i);
            if (codeMatch) {
              const result = yield resolveTheyTube(codeMatch[1], resolvePath, authParam, pageUrl);
              if (result) {
                streams.push({
                  name: `GnulaHD (${srv.title || "Tube"})`,
                  title: `${result.quality || "HD"} \xB7 Latino \xB7 ${srv.title || "Tube"}`,
                  url: result.url,
                  quality: result.quality || "HD",
                  headers: result.headers
                });
              } else {
                streams.push({
                  name: `GnulaHD (${srv.title || "Tube"})`,
                  title: `Embed \xB7 Latino \xB7 ${srv.title || "Tube"}`,
                  url: cleanSrc,
                  quality: "Unknown",
                  headers: { Referer: pageUrl, "User-Agent": "Mozilla/5.0" }
                });
              }
            }
            continue;
          }
          const serverLabel = getServerLabel(cleanSrc);
          streams.push({
            name: `GnulaHD (${srv.title || serverLabel})`,
            title: `Embed \xB7 Latino \xB7 ${srv.title || serverLabel}`,
            url: cleanSrc,
            quality: "Unknown",
            headers: { Referer: pageUrl, "User-Agent": "Mozilla/5.0" }
          });
        }
      }
      return streams;
    } catch (err) {
      console.error(`[Masters] Error: ${err.message}`);
      return [];
    }
  });
}

// src/masters/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[Masters] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[Masters] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
