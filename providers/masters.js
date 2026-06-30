/**
 * masters - Built from src/masters/
 * Generated: 2026-06-30T00:27:03.783Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
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

// src/masters/http.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    console.log(`[Masters] Fetching: ${url}`);
    const response = yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers)
    }, options));
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for ${url}`);
    }
    return yield response.text();
  });
}

// src/masters/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
function rot13(str) {
  return str.replace(/[A-Za-z]/g, (c) => {
    return String.fromCharCode(
      c.charCodeAt(0) + (c.toUpperCase() <= "M" ? 13 : -13)
    );
  });
}
function replacePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let res = str;
  for (const p of patterns) {
    res = res.split(p).join("_");
  }
  return res;
}
function charShift(str, shift) {
  return str.split("").map((c) => String.fromCharCode(c.charCodeAt(0) - shift)).join("");
}
function base64Decode(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let str = input.replace(/=+$/, "");
  let output = "";
  if (str.length % 4 === 1)
    return "";
  for (let i = 0, bc = 0, bs = 0; i < str.length; i++) {
    const char = str.charAt(i);
    const idx = chars.indexOf(char);
    if (idx === -1)
      continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
    }
  }
  return output;
}
function decryptVoe(encoded) {
  try {
    const vF = rot13(encoded);
    const vF2 = replacePatterns(vF);
    const vF3 = vF2.split("_").join("");
    const vF4 = base64Decode(vF3);
    const vF5 = charShift(vF4, 3);
    const vF6 = vF5.split("").reverse().join("");
    const vAtob = base64Decode(vF6);
    return JSON.parse(vAtob);
  } catch (e) {
    console.log(`[Masters] Voe decryption failed: ${e.message}`);
    return null;
  }
}
function normalizeText(text) {
  if (!text)
    return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function getMediaTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    console.log(`[Masters] Fetching title from TMDB: ${url}`);
    const res = yield fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    }
    const data = yield res.json();
    const title = mediaType === "movie" ? data.title : data.name;
    const originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    const year = (data.release_date || data.first_air_date || "").split("-")[0];
    return { title, originalTitle, year };
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `https://ww3.gnulahd.nu/?s=${encodeURIComponent(query)}`;
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("a").each((i, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim() || $(el).find("img").attr("alt") || "";
        if (href && href.includes("/ver/")) {
          candidates.push({ text, href });
        }
      });
      let targetUrl = null;
      const normalizedQuery = normalizeText(query);
      const normalizedOriginal = normalizeText(originalTitle);
      for (const cand of candidates) {
        const normalizedCand = normalizeText(cand.text);
        if (normalizedCand.includes(normalizedQuery) || normalizedCand.includes(normalizedOriginal)) {
          targetUrl = cand.href;
          break;
        }
      }
      if (!targetUrl && candidates.length > 0) {
        targetUrl = candidates[0].href;
      }
      if (!targetUrl) {
        console.log("[Masters] No media page found on GnulaHD");
        return [];
      }
      let pageUrl = targetUrl;
      if (mediaType === "tv") {
        console.log(`[Masters] Fetching TV series page to find episode S${season}E${episode}: ${pageUrl}`);
        const tvHtml = yield fetchText(pageUrl);
        const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
        let epUrl = null;
        const epPattern1 = `-${season}x${episode < 10 ? "0" + episode : episode}`;
        const epPattern2 = `-${season}x${episode}`;
        tv$("a").each((i, el) => {
          const href = tv$(el).attr("href");
          if (href && (href.includes(epPattern1) || href.includes(epPattern2))) {
            epUrl = href;
          }
        });
        if (!epUrl) {
          console.log(`[Masters] Could not find episode link for S${season}E${episode}`);
          return [];
        }
        pageUrl = epUrl;
      }
      console.log(`[Masters] Fetching player page: ${pageUrl}`);
      const playHtml = yield fetchText(pageUrl);
      let dataStr = null;
      const gdMatch = playHtml.match(/var\s+_gd\s*=\s*(\[[\s\S]*?\])\s*;/);
      const epLangsMatch = playHtml.match(/var\s+_gnpv_ep_langs\s*=\s*(\[[\s\S]*?\])\s*;/);
      if (gdMatch) {
        dataStr = gdMatch[1];
      } else if (epLangsMatch) {
        dataStr = epLangsMatch[1];
      }
      if (!dataStr) {
        console.log("[Masters] No video servers found in script tags");
        return [];
      }
      let resolvePath = null;
      let authParam = null;
      const resolveMatch = playHtml.match(/var\s+RESOLVE\s*=\s*'([^']*)'\s*,\s*AUTH\s*=\s*'([^']*)'/);
      if (resolveMatch) {
        resolvePath = resolveMatch[1];
        authParam = resolveMatch[2];
      }
      const languages = JSON.parse(dataStr);
      const streams = [];
      for (const lang of languages) {
        const langLabel = lang.label || "Latino";
        const normalizedLabel = langLabel.toLowerCase();
        if (normalizedLabel.includes("latino")) {
          for (const srv of lang.servers || []) {
            let cleanSrc = (srv.src || "").replace(/\\/g, "");
            if (!cleanSrc)
              continue;
            if (cleanSrc.startsWith("//")) {
              cleanSrc = "https:" + cleanSrc;
            }
            if ((cleanSrc.includes("they.tube") || cleanSrc.includes("the.tube")) && resolvePath && authParam) {
              try {
                const codeMatch = cleanSrc.match(/the(?:y)?\.tube\/(?:e\/)?([A-Za-z0-9_-]+?)(?:\.html)?(?:[?#]|$)/i);
                if (codeMatch) {
                  const code = codeMatch[1];
                  const resolveUrl = `https://ww3.gnulahd.nu${resolvePath}${encodeURIComponent(code)}${authParam}`;
                  console.log(`[Masters] Resolving they.tube link: ${resolveUrl}`);
                  const resolveRes = yield fetch(resolveUrl, {
                    headers: {
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                      "Referer": pageUrl
                    }
                  });
                  if (resolveRes.ok) {
                    const resolveData = yield resolveRes.json();
                    if (resolveData && resolveData.master) {
                      streams.push({
                        name: `GnulaHD Direct (${srv.title || "they.tube"})`,
                        title: `${title || query} [${langLabel}]`,
                        url: resolveData.master,
                        quality: "1080p",
                        headers: {
                          "Referer": "https://ww3.gnulahd.nu/",
                          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
                        }
                      });
                    }
                  }
                }
              } catch (e) {
                console.log(`[Masters] Failed to resolve they.tube: ${e.message}`);
              }
            }
            if (cleanSrc.includes("voe.sx")) {
              try {
                console.log(`[Masters] Resolving voe.sx link: ${cleanSrc}`);
                const voeHtml = yield fetchText(cleanSrc);
                const voe$ = import_cheerio_without_node_native.default.load(voeHtml);
                let encodedVoe = null;
                voe$("script").each((i, el) => {
                  const type = voe$(el).attr("type");
                  if (type === "application/json") {
                    const text = voe$(el).html().trim();
                    const m = text.match(/\[\s*"([^"]+)"\s*\]/);
                    if (m) {
                      encodedVoe = m[1];
                    }
                  }
                });
                if (encodedVoe) {
                  const decrypted = decryptVoe(encodedVoe);
                  const directUrl = decrypted ? decrypted.source || decrypted.direct_access_url : null;
                  if (directUrl) {
                    streams.push({
                      name: `GnulaHD Direct (${srv.title || "voe.sx"})`,
                      title: `${title || query} [${langLabel}]`,
                      url: directUrl,
                      quality: "720p",
                      headers: {
                        "Referer": cleanSrc,
                        "Origin": "https://voe.sx/"
                      }
                    });
                  }
                }
              } catch (e) {
                console.log(`[Masters] Failed to resolve voe.sx: ${e.message}`);
              }
            }
          }
        }
      }
      return streams;
    } catch (err) {
      console.error(`[Masters] Error in extractor: ${err.message}`);
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
