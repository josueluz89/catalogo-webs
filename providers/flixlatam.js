/**
 * flixlatam - Built from src/flixlatam/
 * Generated: 2026-06-30T00:02:08.617Z
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

// src/flixlatam/http.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers)
    }, options));
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for ${url}`);
    }
    return yield response.text();
  });
}

// src/flixlatam/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var import_crypto_js = __toESM(require("crypto-js"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://flixlatam.com";
function normalizeText(text) {
  if (!text)
    return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function getMediaTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const res = yield fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    }
    const data = yield res.json();
    const title = mediaType === "movie" ? data.title : data.name;
    const originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    return { title, originalTitle };
  });
}
function solvePow(challenge, difficulty, salt) {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  while (true) {
    const hash = import_crypto_js.default.SHA256(challenge + nonce).toString(import_crypto_js.default.enc.Hex);
    if (hash.startsWith(prefix)) {
      return import_crypto_js.default.SHA256(challenge + nonce + salt);
    }
    nonce++;
  }
}
function decryptAES(encryptedBase64, powKey) {
  try {
    const decoded = import_crypto_js.default.enc.Base64.parse(encryptedBase64);
    const iv = import_crypto_js.default.lib.WordArray.create(decoded.words.slice(0, 4), 16);
    const ciphertext = import_crypto_js.default.lib.WordArray.create(decoded.words.slice(4), decoded.sigBytes - 16);
    const decrypted = import_crypto_js.default.AES.decrypt(
      { ciphertext },
      powKey,
      { iv, mode: import_crypto_js.default.mode.CBC, padding: import_crypto_js.default.pad.Pkcs7 }
    );
    return decrypted.toString(import_crypto_js.default.enc.Utf8);
  } catch (e) {
    console.log(`[Flixlatam] Decryption error: ${e.message}`);
    return null;
  }
}
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
    return null;
  }
}
function resolveVoeStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(embedUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      let encodedVoe = null;
      $("script").each((i, el) => {
        const type = $(el).attr("type");
        if (type === "application/json") {
          const text = $(el).html().trim();
          const m = text.match(/\[\s*"([^"]+)"\s*\]/);
          if (m) {
            encodedVoe = m[1];
          }
        }
      });
      if (encodedVoe) {
        const decrypted = decryptVoe(encodedVoe);
        if (decrypted) {
          return decrypted.source || decrypted.direct_access_url;
        }
      }
    } catch (e) {
      console.log(`[Flixlatam] Failed to resolve voe: ${e.message}`);
    }
    return null;
  });
}
function resolveByseStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const u = new URL(embedUrl);
      const code = u.pathname.split("/").pop();
      const apiUrl = `${u.protocol}//${u.host}/api/video`;
      const res = yield fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": embedUrl,
          "Origin": `${u.protocol}//${u.host}`,
          "Accept": "application/json, text/plain, */*"
        },
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        const json = yield res.json();
        if (json.status === "success" && json.data && json.data.video) {
          return json.data.video.master;
        }
      }
    } catch (e) {
      console.log(`[Flixlatam] Byse resolver error: ${e.message}`);
    }
    return null;
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `${MAIN_URL}/search?s=${encodeURIComponent(query)}`;
      console.log(`[Flixlatam] Searching: ${searchUrl}`);
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("article.item").each((i, el) => {
        const linkElement = $(el).find(".data h3 a").first();
        const href = linkElement.attr("href");
        const name = linkElement.text().trim();
        if (href) {
          candidates.push({ name, href });
        }
      });
      let targetUrl = null;
      const normalizedQuery = normalizeText(query);
      const normalizedOriginal = normalizeText(originalTitle);
      for (const cand of candidates) {
        const normalizedCand = normalizeText(cand.name);
        if (normalizedCand.includes(normalizedQuery) || normalizedCand.includes(normalizedOriginal)) {
          targetUrl = cand.href;
          break;
        }
      }
      if (!targetUrl && candidates.length > 0) {
        targetUrl = candidates[0].href;
      }
      if (!targetUrl) {
        console.log("[Flixlatam] Media not found on Flixlatam");
        return [];
      }
      let pageUrl = targetUrl;
      if (pageUrl && !pageUrl.startsWith("http")) {
        pageUrl = MAIN_URL + pageUrl;
      }
      if (mediaType === "tv") {
        console.log(`[Flixlatam] Fetching TV page: ${pageUrl}`);
        const tvHtml = yield fetchText(pageUrl);
        const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
        let epUrl = null;
        tv$("ul.episodios li").each((i, el) => {
          const epLink = tv$(el).find(".episodiotitle a");
          const href = epLink.attr("href");
          const numerando = tv$(el).find(".numerando").text() || "1-1";
          const parts = numerando.split("-");
          const s = parseInt(parts[0], 10) || 1;
          const e = parseInt(parts[1], 10) || 1;
          if (s === season && e === episode) {
            epUrl = href;
          }
        });
        if (!epUrl) {
          console.log(`[Flixlatam] Episode S${season}E${episode} not found`);
          return [];
        }
        pageUrl = epUrl;
        if (pageUrl && !pageUrl.startsWith("http")) {
          pageUrl = MAIN_URL + pageUrl;
        }
      }
      console.log(`[Flixlatam] Fetching player page: ${pageUrl}`);
      const playHtml = yield fetchText(pageUrl);
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      let iframeUrl = play$("div.play iframe").attr("src") || play$('iframe[src*="embed69"]').attr("src") || play$('iframe[src*="/vidurl/"]').attr("src");
      if (!iframeUrl) {
        console.log("[Flixlatam] Player iframe not found");
        return [];
      }
      if (iframeUrl.startsWith("//")) {
        iframeUrl = "https:" + iframeUrl;
      } else if (iframeUrl.startsWith("/")) {
        iframeUrl = MAIN_URL + iframeUrl;
      }
      console.log(`[Flixlatam] Fetching embed69 player: ${iframeUrl}`);
      const embedHtml = yield fetchText(iframeUrl, {
        headers: { "Referer": pageUrl }
      });
      const powChallengeMatch = embedHtml.match(/const\s+POW_CHALLENGE\s*=\s*'([^']+)';/);
      const powDifficultyMatch = embedHtml.match(/const\s+POW_DIFFICULTY\s*=\s*(\d+);/);
      const powSaltMatch = embedHtml.match(/const\s+POW_SALT\s*=\s*'([^']+)';/);
      if (!powChallengeMatch || !powSaltMatch) {
        console.log("[Flixlatam] Challenge tokens not found");
        return [];
      }
      const challenge = powChallengeMatch[1];
      const difficulty = powDifficultyMatch ? parseInt(powDifficultyMatch[1], 10) : 3;
      const salt = powSaltMatch[1];
      console.log(`[Flixlatam] Solving Proof of Work (Diff: ${difficulty})...`);
      const aesKey = solvePow(challenge, difficulty, salt);
      const dataLinkMatch = embedHtml.match(/let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/);
      if (!dataLinkMatch) {
        console.log("[Flixlatam] No dataLink found in player HTML");
        return [];
      }
      const dataList = JSON.parse(dataLinkMatch[1]);
      const streams = [];
      for (const entry of dataList) {
        const allEmbeds = entry.sortedEmbeds || [];
        const downloadEmbeds = entry.downloadEmbeds || [];
        for (const item of [...allEmbeds, ...downloadEmbeds]) {
          const encryptedLink = item.link;
          if (!encryptedLink)
            continue;
          const decryptedLink = decryptAES(encryptedLink, aesKey);
          if (decryptedLink && decryptedLink.startsWith("http")) {
            const fixedUrl = decryptedLink.replace("dintezuvio.com", "vidhide.com").replace("hglink.to", "streamwish.to").replace("minochinos.com", "vidhide.com").replace("ghbrisk.com", "streamwish.to");
            let directStreamUrl = null;
            if (fixedUrl.includes("voe.sx")) {
              console.log(`[Flixlatam] Resolving voe stream: ${fixedUrl}`);
              directStreamUrl = yield resolveVoeStream(fixedUrl);
            } else if (fixedUrl.includes("byse") || fixedUrl.includes("bysedi") || fixedUrl.includes("streamwish") || fixedUrl.includes("vidhide") || fixedUrl.includes("filelions")) {
              console.log(`[Flixlatam] Resolving Byse stream: ${fixedUrl}`);
              directStreamUrl = yield resolveByseStream(fixedUrl);
            }
            if (directStreamUrl) {
              streams.push({
                name: `Flixlatam Direct (${item.name || "Stream"})`,
                title: `${title || query} [Latino]`,
                url: directStreamUrl,
                quality: "1080p",
                headers: {
                  "Referer": fixedUrl,
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
              });
            } else {
              streams.push({
                name: `Flixlatam Embed (${item.name || "Server"})`,
                title: `${title || query} [Latino]`,
                url: fixedUrl,
                quality: "720p",
                headers: {
                  "Referer": iframeUrl
                }
              });
            }
          }
        }
      }
      return streams;
    } catch (e) {
      console.error(`[Flixlatam] Error in extractor: ${e.message}`);
      return [];
    }
  });
}

// src/flixlatam/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[Flixlatam] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[Flixlatam] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
