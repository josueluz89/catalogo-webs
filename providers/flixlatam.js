/**
 * flixlatam - Built from src/flixlatam/
 * Generated: 2026-06-30T02:02:05.695Z
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
function fetchWithRetry(_0) {
  return __async(this, arguments, function* (url, options = {}, retries = 2, timeout = FETCH_TIMEOUT) {
    for (let i = 0; i <= retries; i++) {
      try {
        return yield fetchText(url, options, timeout);
      } catch (e) {
        if (i === retries)
          throw e;
        yield new Promise((r) => setTimeout(r, 1e3 * (i + 1)));
      }
    }
  });
}

// src/flixlatam/http.js
var PROTECTION_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.8,en-US;q=0.5,en;q=0.3",
  "Sec-GPC": "1",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Priority": "u=0, i",
  "Te": "trailers"
};

// src/flixlatam/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var import_crypto_js = __toESM(require("crypto-js"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://flixlatam.com";
var DOMAIN_MAP = {
  "dintezuvio.com": "vidhide.com",
  "hglink.to": "streamwish.to",
  "minochinos.com": "vidhide.com",
  "ghbrisk.com": "streamwish.to"
};
function mapDomain(url) {
  let result = url;
  for (const [from, to] of Object.entries(DOMAIN_MAP)) {
    if (result.includes(from)) {
      result = result.replace(from, to);
      break;
    }
  }
  return result;
}
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
    return { title, originalTitle };
  });
}
function solvePowAsync(challenge, difficulty, salt, maxAttempts = 5e5) {
  return new Promise((resolve, reject) => {
    const prefix = "0".repeat(difficulty);
    let nonce = 0;
    let attempts = 0;
    function chunk() {
      const start = Date.now();
      while (attempts < maxAttempts && Date.now() - start < 100) {
        const hash = import_crypto_js.default.SHA256(challenge + nonce).toString(import_crypto_js.default.enc.Hex);
        if (hash.startsWith(prefix)) {
          resolve(import_crypto_js.default.SHA256(challenge + nonce + salt));
          return;
        }
        nonce++;
        attempts++;
      }
      if (attempts >= maxAttempts) {
        reject(new Error("PoW max attempts exceeded"));
        return;
      }
      setTimeout(chunk, 0);
    }
    chunk();
  });
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
    return null;
  }
}
function getServerLabel(url) {
  if (url.includes("voe.sx") || url.includes("cloudwindow"))
    return "VOE";
  if (url.includes("streamwish") || url.includes("hlswish") || url.includes("vibuxer") || url.includes("strwish") || url.includes("premilkyway"))
    return "StreamWish";
  if (url.includes("vidhide") || url.includes("dintezuvio") || url.includes("minochinos") || url.includes("dramiyos") || url.includes("dhcplay") || url.includes("smoothpre") || url.includes("dhtpre") || url.includes("vidspeeder") || url.includes("moorearn") || url.includes("travid") || url.includes("vidhidehub") || url.includes("vidhidevip") || url.includes("vidhidepre") || url.includes("kinoger") || url.includes("movearnpre") || url.includes("peytonepre") || url.includes("filelions"))
    return "VidHide";
  if (url.includes("bysedikamoum") || url.includes("bysedi") || url.includes("filemoon") || url.includes("rapidvideo"))
    return "FileMoon";
  if (url.includes("luluvid") || url.includes("lulus"))
    return "Lulu";
  if (url.includes("uqload"))
    return "Uqload";
  if (url.includes("goodstream"))
    return "GoodStream";
  if (url.includes("vimeos"))
    return "Vimeos";
  return "Online";
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `${MAIN_URL}/search?s=${encodeURIComponent(query)}`;
      const html = yield fetchWithRetry(searchUrl, {
        headers: __spreadProps(__spreadValues({}, PROTECTION_HEADERS), { Referer: `${MAIN_URL}/` })
      });
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("article.item").each((i, el) => {
        const linkElement = $(el).find(".data h3 a, .poster a").first();
        const href = linkElement.attr("href");
        let name = linkElement.text().trim();
        if (!name)
          name = $(el).find(".poster img").attr("alt") || "";
        name = name.replace(/^Ver\s+/i, "").replace(/\s+online$/i, "").trim();
        if (href && name)
          candidates.push({ name, href });
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
      if (!targetUrl)
        return [];
      let pageUrl = targetUrl;
      if (pageUrl && !pageUrl.startsWith("http")) {
        pageUrl = MAIN_URL + pageUrl;
      }
      if (mediaType === "tv") {
        const tvHtml = yield fetchWithRetry(pageUrl, {
          headers: __spreadProps(__spreadValues({}, PROTECTION_HEADERS), { Referer: `${MAIN_URL}/` })
        });
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
        if (!epUrl)
          return [];
        pageUrl = epUrl;
        if (pageUrl && !pageUrl.startsWith("http")) {
          pageUrl = MAIN_URL + pageUrl;
        }
      }
      const playHtml = yield fetchWithRetry(pageUrl, {
        headers: __spreadProps(__spreadValues({}, PROTECTION_HEADERS), { Referer: `${MAIN_URL}/` })
      });
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      let iframeUrl = play$("div.play iframe").attr("src") || play$('iframe[src*="embed69"]').attr("src") || play$('iframe[src*="/vidurl/"]').attr("src");
      if (!iframeUrl)
        return [];
      if (iframeUrl.startsWith("//")) {
        iframeUrl = "https:" + iframeUrl;
      } else if (iframeUrl.startsWith("/")) {
        iframeUrl = MAIN_URL + iframeUrl;
      }
      const embedHtml = yield fetchWithRetry(iframeUrl, {
        headers: { Referer: pageUrl }
      });
      const powChallengeMatch = embedHtml.match(/const\s+POW_CHALLENGE\s*=\s*'([^']+)';/);
      const powDifficultyMatch = embedHtml.match(/const\s+POW_DIFFICULTY\s*=\s*(\d+);/);
      const powSaltMatch = embedHtml.match(/const\s+POW_SALT\s*=\s*'([^']+)';/);
      if (!powChallengeMatch || !powSaltMatch) {
        return [];
      }
      const challenge = powChallengeMatch[1];
      const difficulty = powDifficultyMatch ? parseInt(powDifficultyMatch[1], 10) : 3;
      const salt = powSaltMatch[1];
      let aesKey;
      try {
        aesKey = yield solvePowAsync(challenge, difficulty, salt);
      } catch (e) {
        return [];
      }
      const dataLinkMatch = embedHtml.match(/let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/);
      if (!dataLinkMatch)
        return [];
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
            const fixedUrl = mapDomain(decryptedLink);
            const serverLabel = getServerLabel(fixedUrl);
            streams.push({
              name: `Flixlatam (${serverLabel})`,
              title: `Embed \xB7 Latino \xB7 ${serverLabel}`,
              url: fixedUrl,
              quality: "Unknown",
              headers: { Referer: iframeUrl, "User-Agent": "Mozilla/5.0" }
            });
          }
        }
      }
      return streams;
    } catch (e) {
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
