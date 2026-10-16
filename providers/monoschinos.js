/**
 * monoschinos - Built from src/monoschinos/
 * Generated: 2026-10-16T21:40:16.153Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
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
var FETCH_TIMEOUT = 2e4;
function fetchWithTimeout(url, options, timeout) {
  if (!options)
    options = {};
  var ms = timeout || FETCH_TIMEOUT;
  var controller = null;
  var signal = null;
  try {
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      signal = controller.signal;
      if (typeof setTimeout !== "undefined") {
        (function(c) {
          setTimeout(function() {
            try {
              c.abort();
            } catch (e) {
            }
          }, ms);
        })(controller);
      }
    }
  } catch (e) {
    controller = null;
  }
  var headers = Object.assign({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.8"
  }, options.headers || {});
  var req = { headers, redirect: "follow" };
  if (signal)
    req.signal = signal;
  if (options.method)
    req.method = options.method;
  if (options.body)
    req.body = options.body;
  return fetch(url, Object.assign({}, options, req));
}
function fetchText(url, options, timeout) {
  return fetchWithTimeout(url, options, timeout).then(function(res) {
    if (!res.ok)
      throw new Error("HTTP " + res.status + " for " + url);
    return res.text();
  });
}
function fetchWithRetry(url, options, retries, timeout) {
  if (retries === void 0 || retries === null)
    retries = 2;
  return fetchText(url, options, timeout).catch(function(e) {
    if (retries <= 0)
      throw e;
    if (typeof setTimeout === "undefined") {
      return fetchWithRetry(url, options, retries - 1, timeout);
    }
    return new Promise(function(r) {
      setTimeout(r, 1e3);
    }).then(function() {
      return fetchWithRetry(url, options, retries - 1, timeout);
    });
  });
}

// src/shared/quality.js
var KNOWN_QUALITY = {
  vimeos: { h: "720p", n: "480p" },
  goodstream: { x: "1080p", h: "720p", n: "480p", l: "360p" },
  vidhide: { n: "720p", l: "480p" },
  streamwish: { x: "1080p", h: "1080p", n: "720p", l: "480p" },
  voe: { n: "720p", l: "360p" }
};
function getQualityMap(url) {
  if (url.includes("vimeos"))
    return KNOWN_QUALITY.vimeos;
  if (url.includes("goodstream"))
    return KNOWN_QUALITY.goodstream;
  if (url.includes("cloudwindow-route"))
    return KNOWN_QUALITY.voe;
  if (url.includes("minochinos") || url.includes("vidhide") || url.includes("dintezuvio") || url.includes("dramiyos"))
    return KNOWN_QUALITY.vidhide;
  if (url.includes("premilkyway") || url.includes("hlswish") || url.includes("vibuxer") || url.includes("streamwish") || url.includes("harborviewlearninghub") || url.includes("aurorionagency") || url.includes("centaurus") || url.includes("bysedikamoum") || url.includes("filelions") || url.includes("rapidvideo"))
    return KNOWN_QUALITY.streamwish;
  return null;
}
function guessQualityFromUrl(url) {
  if (!url)
    return "Unknown";
  const qmap = getQualityMap(url);
  if (qmap) {
    const m = url.match(/_,([a-z,]+),\.urlset/);
    if (m) {
      const labels = m[1].split(",").filter(Boolean);
      const order = ["x", "o", "h", "n", "l"];
      for (const key of order) {
        if (labels.includes(key) && qmap[key])
          return qmap[key];
      }
    }
  }
  const numMatch = url.match(/[_-](\d{3,4})p/);
  return numMatch ? numMatch[1] + "p" : "Unknown";
}
function detectQualityFromM3U8(url) {
  return __async(this, null, function* () {
    if (typeof setTimeout === "undefined") {
      return guessQualityFromUrl(url);
    }
    var guessed = guessQualityFromUrl(url);
    if (guessed !== "Unknown")
      return guessed;
    try {
      const res = yield fetchWithTimeout(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      }, 5e3);
      if (!res.ok)
        return guessQualityFromUrl(url);
      const text = yield res.text();
      if (!text.includes("#EXT-X-STREAM-INF")) {
        return guessQualityFromUrl(url);
      }
      let maxH = 0, maxW = 0;
      for (const line of text.split("\n")) {
        const m = line.match(/RESOLUTION=(\d+)x(\d+)/);
        if (m) {
          const h = parseInt(m[2]);
          if (h > maxH) {
            maxH = h;
            maxW = parseInt(m[1]);
          }
        }
      }
      if (maxH >= 2160)
        return "4K";
      if (maxH >= 1080)
        return "1080p";
      if (maxH >= 720)
        return "720p";
      if (maxH >= 480)
        return "480p";
      return maxH > 0 ? `${maxH}p` : guessQualityFromUrl(url);
    } catch (e) {
      return guessQualityFromUrl(url);
    }
  });
}

// src/shared/voe.js
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
function rot13(str) {
  return str.replace(
    /[A-Za-z]/g,
    (c) => String.fromCharCode(c.charCodeAt(0) + (c.toUpperCase() <= "M" ? 13 : -13))
  );
}
function charShift(str, shift) {
  return str.split("").map((c) => String.fromCharCode(c.charCodeAt(0) - shift)).join("");
}
function replacePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let res = str;
  for (const p of patterns) {
    res = res.split(p).join("_");
  }
  return res;
}
function decryptVoe(encoded) {
  try {
    let s = rot13(encoded);
    s = replacePatterns(s);
    s = s.split("_").join("");
    let decoded = base64Decode(s);
    if (!decoded)
      return null;
    decoded = charShift(decoded, 3);
    decoded = decoded.split("").reverse().join("");
    decoded = base64Decode(decoded);
    if (!decoded)
      return null;
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}
function extractQuality(url) {
  if (!url)
    return "Unknown";
  const m = url.match(/[_-](\d{3,4})p/);
  return m ? m[1] + "p" : "Unknown";
}
function resolveVoeStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(embedUrl, {
        headers: {
          Referer: embedUrl,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      let pageText = html;
      if (/permanentToken/i.test(pageText)) {
        const redirectMatch = pageText.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (redirectMatch) {
          const redirectRes = yield fetchWithTimeout(redirectMatch[1], {
            headers: { Referer: embedUrl, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          });
          if (redirectRes.ok) {
            pageText = yield redirectRes.text();
          }
        }
      }
      const jsonMatch = pageText.match(/<script[^>]*type=['"]application\/json['"][^>]*>\s*\[\s*"([^"]+)"\s*\]\s*<\/script>/i);
      if (!jsonMatch) {
        var re1 = /(?:mp4|hls)'\s*:\s*'([^']+)'/gi;
        var re2 = /(?:mp4|hls)"\s*:\s*"([^"]+)"/gi;
        var m;
        while ((m = re1.exec(pageText)) !== null) {
          var u1 = m[1];
          if (u1.indexOf("aHR0") === 0) {
            try {
              u1 = base64Decode(u1) || u1;
            } catch (e) {
            }
          }
          return { url: u1, quality: extractQuality(u1), headers: { Referer: embedUrl } };
        }
        while ((m = re2.exec(pageText)) !== null) {
          var u2 = m[1];
          if (u2.indexOf("aHR0") === 0) {
            try {
              u2 = base64Decode(u2) || u2;
            } catch (e) {
            }
          }
          return { url: u2, quality: extractQuality(u2), headers: { Referer: embedUrl } };
        }
        return null;
      }
      const encodedStr = jsonMatch[1];
      const decrypted = decryptVoe(encodedStr);
      if (!decrypted)
        return null;
      const directUrl = decrypted.source || decrypted.direct_access_url;
      if (!directUrl)
        return null;
      return { url: directUrl, quality: extractQuality(directUrl), headers: { Referer: embedUrl } };
    } catch (e) {
      return null;
    }
  });
}

// src/shared/embedResolvers.js
function getUrlOrigin(url) {
  if (!url)
    return "";
  const match = url.match(/^(https?:\/\/[^\/]+)/);
  return match ? match[1] : "";
}
function unpackPacked(html) {
  try {
    const pMatch = html.match(/eval\(function\(p,a,c,k,e,[premd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!pMatch)
      return null;
    let [, p, a, c, k] = pMatch;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    k = k.split("|");
    const decodeBase36 = (num, rad) => {
      const symbols = "0123456789abcdefghijklmnopqrstuvwxyz";
      let res = "";
      while (num > 0) {
        res = symbols[num % rad] + res;
        num = Math.floor(num / rad);
      }
      return res || "0";
    };
    return p.replace(/\b\w+\b/g, (w) => {
      const idx = parseInt(w, 36);
      return idx < k.length && k[idx] ? k[idx] : decodeBase36(idx, a);
    });
  } catch (e) {
    return null;
  }
}
function normalizeVidHideUrl(url) {
  try {
    if (!url)
      return "";
    let res = url;
    if (!res.includes("/embed/")) {
      const match = res.match(/^(https?:\/\/[^\/]+)\/([A-Za-z0-9_-]+)/);
      if (match) {
        res = `${match[1]}/embed/${match[2]}`;
      }
    }
    return res;
  } catch (e) {
    return url;
  }
}
var DOMAIN_MAP = {
  "hglink.to": "vibuxer.com",
  "ghbrisk.com": "vibuxer.com",
  "premilkyway.com": "streamwish.to"
};
function mapDomain(url) {
  let result = url;
  var keys = Object.keys(DOMAIN_MAP);
  for (var i = 0; i < keys.length; i++) {
    var from = keys[i];
    var to = DOMAIN_MAP[from];
    if (result.indexOf(from) !== -1) {
      result = result.replace(from, to);
      break;
    }
  }
  return result;
}
function resolveHLSWishStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const base = mapDomain(embedUrl);
      const origin0 = getUrlOrigin(base);
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://embed69.org/",
        Origin: "https://embed69.org",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9"
      };
      const candidates = [base];
      const vVariant = base.replace("/e/", "/v/");
      if (vVariant !== base)
        candidates.push(vVariant);
      let html = null;
      let origin = origin0;
      for (const u of candidates) {
        try {
          html = yield fetchWithRetry(u, { headers }, 1);
          origin = getUrlOrigin(u);
          break;
        } catch (e) {
          html = null;
        }
      }
      if (!html)
        return null;
      const fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        let fileUrl = fileMatch[1];
        if (fileUrl.startsWith("/"))
          fileUrl = origin + fileUrl;
        const quality = yield detectQualityFromM3U8(fileUrl);
        return { url: fileUrl, quality, headers: { Referer: origin + "/" } };
      }
      const unpacked = unpackPacked(html);
      if (unpacked) {
        const srcMatch = unpacked.match(/["']([^"']{30,}\.m3u8[^"']*)['"]/i);
        if (srcMatch) {
          let fileUrl = srcMatch[1];
          if (fileUrl.startsWith("/"))
            fileUrl = origin + fileUrl;
          const quality = yield detectQualityFromM3U8(fileUrl);
          return { url: fileUrl, quality, headers: { Referer: origin + "/" } };
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveVidHideProStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const normalizedUrl = normalizeVidHideUrl(embedUrl);
      const origin = getUrlOrigin(normalizedUrl);
      const html = yield fetchWithRetry(normalizedUrl, {
        headers: {
          Referer: "https://embed69.org/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "cross-site"
        }
      });
      let script = null;
      const packed = unpackPacked(html);
      if (packed) {
        let data = packed;
        if (data.includes("var links")) {
          data = data.substring(data.indexOf("var links"));
        }
        script = data;
      }
      if (!script) {
        const srcMatch = html.match(/<script[^>]*>([\s\S]*?sources:[\s\S]*?)<\/script>/i);
        if (srcMatch)
          script = srcMatch[1];
      }
      if (!script)
        return null;
      const m3u8Regex = /:\s*"([^"]*\.m3u8[^"]*)"/i;
      const m3u8Match = script.match(m3u8Regex);
      if (!m3u8Match)
        return null;
      let url = m3u8Match[1];
      if (url.startsWith("/"))
        url = origin + url;
      if (!url.startsWith("http"))
        url = origin + "/" + url;
      const quality = yield detectQualityFromM3U8(url);
      return { url, quality, headers: { Referer: origin + "/", Origin: origin } };
    } catch (e) {
      return null;
    }
  });
}
function resolveFilemoonStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const defaultHeaders = {
        "Referer": embedUrl,
        "Sec-Fetch-Dest": "iframe",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0"
      };
      const initialResponse = yield fetchWithRetry(embedUrl, {
        headers: __spreadProps(__spreadValues({}, defaultHeaders), { Referer: "https://embed69.org/" })
      });
      const iframeSrc = initialResponse.match(/<iframe[^>]*src=["']([^"']+)["']/i);
      if (iframeSrc) {
        let iframeUrl = iframeSrc[1];
        if (!iframeUrl.startsWith("http")) {
          iframeUrl = getUrlOrigin(embedUrl) + iframeUrl;
        }
        const iframeHtml = yield fetchWithRetry(iframeUrl, {
          headers: __spreadProps(__spreadValues({}, defaultHeaders), { "Accept-Language": "en-US,en;q=0.5", Referer: embedUrl })
        });
        const unpacked2 = unpackPacked(iframeHtml);
        if (unpacked2) {
          const videoMatch = unpacked2.match(/sources:\s*\[\s*\{\s*file\s*:\s*"([^"]+)"/i);
          if (videoMatch) {
            let url = videoMatch[1];
            if (!url.startsWith("http"))
              url = getUrlOrigin(iframeUrl) + url;
            const quality = yield detectQualityFromM3U8(url);
            return { url, quality, headers: { Referer: getUrlOrigin(iframeUrl) + "/" } };
          }
        }
        return null;
      }
      const unpacked = unpackPacked(initialResponse);
      if (unpacked) {
        const videoMatch = unpacked.match(/sources:\s*\[\s*\{\s*file\s*:\s*"([^"]+)"/i);
        if (videoMatch) {
          let url = videoMatch[1];
          if (!url.startsWith("http"))
            url = getUrlOrigin(embedUrl) + url;
          const quality = yield detectQualityFromM3U8(url);
          return { url, quality, headers: { Referer: getUrlOrigin(embedUrl) + "/" } };
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveLulusStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const filecode = embedUrl.replace(/\/+$/, "").split("/").pop();
      if (!filecode)
        return null;
      var bodyStr = "op=embed&file_code=" + encodeURIComponent(filecode) + "&auto=1&referer=" + encodeURIComponent(embedUrl);
      const res = yield fetch(origin + "/dl", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0",
          Referer: origin
        },
        body: bodyStr
      });
      if (!res.ok)
        return null;
      const html = yield res.text();
      const scriptMatch = html.match(/<script[^>]*>([\s\S]*?vplayer[\s\S]*?)<\/script>/i);
      if (!scriptMatch)
        return null;
      const fileMatch = scriptMatch[1].match(/file\s*:\s*"([^"]+)"/);
      if (!fileMatch)
        return null;
      let url = fileMatch[1];
      if (url.startsWith("/"))
        url = origin + url;
      return { url, quality: "1080p", headers: { Referer: origin + "/" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveMp4uploadStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.mp4upload.com/"
        }
      });
      if (!html)
        return null;
      const m = html.match(/player\.src\(\{\s*type:\s*"video\/mp4",\s*src:\s*"([^"]+)"/) || html.match(/type:\s*"video\/mp4",\s*src:\s*"([^"]+)"/) || html.match(/"src"\s*:\s*"(https?:[^"]+\.mp4[^"]*)"/);
      if (!m)
        return null;
      return {
        url: m[1],
        quality: "HD",
        headers: { Referer: "https://www.mp4upload.com/" }
      };
    } catch (e) {
      return null;
    }
  });
}
function resolveUqloadStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Upgrade-Insecure-Requests": "1"
        }
      });
      const unpacked = unpackPacked(html);
      if (!unpacked)
        return null;
      const m3u8Match = unpacked.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/i);
      if (m3u8Match) {
        const quality = yield detectQualityFromM3U8(m3u8Match[0]);
        return { url: m3u8Match[0], quality, headers: { Referer: origin + "/", Origin: origin } };
      }
      const mp4Match = unpacked.match(/https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/i);
      if (mp4Match) {
        return { url: mp4Match[0], quality: "1080p", headers: { Referer: origin + "/", Origin: origin } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveYourUploadStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://www.yourupload.com/"
        }
      });
      const m = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i) || html.match(/(https?:[^"'<>\s]+\.mp4[^"'<>\s]*)/i);
      if (!m)
        return null;
      const url = m[1] || m[0];
      if (url.indexOf("http") !== 0)
        return null;
      return {
        url,
        quality: "720p",
        headers: { Referer: "https://www.yourupload.com/" }
      };
    } catch (e) {
      return null;
    }
  });
}
function extractUrlsetM3U8(html) {
  try {
    if (!html)
      return null;
    html = html.replace(/\\"/g, '"').replace(/\\\//g, "/");
    var m = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*"([^"]+?\.m3u8[^"]*?)"/i);
    var u = m && m[1];
    if (u && u.indexOf("//") === 0)
      u = "https:" + u;
    if (u && u.indexOf("http") === 0)
      return u;
    var unpacked = unpackPacked(html);
    if (unpacked) {
      unpacked = unpacked.replace(/\\"/g, '"').replace(/\\\//g, "/");
      var m2 = unpacked.match(/file\s*:\s*"([^"]+?\.m3u8[^"]*?)"/i) || unpacked.match(/((?:https?:)?\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
      if (m2) {
        var u2 = m2[1] || m2[0];
        if (u2 && u2.indexOf("//") === 0)
          u2 = "https:" + u2;
        if (u2 && u2.indexOf("http") === 0)
          return u2;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}
function resolveGoodstreamStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: origin + "/"
        }
      }, 1, 12e3);
      const url = extractUrlsetM3U8(html);
      if (!url)
        return null;
      const quality = yield detectQualityFromM3U8(url);
      return { url, quality, headers: { Referer: origin + "/" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveVimeosStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: origin + "/"
        }
      }, 1, 12e3);
      const url = extractUrlsetM3U8(html);
      if (!url)
        return null;
      const quality = yield detectQualityFromM3U8(url);
      return { url, quality, headers: { Referer: origin + "/" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveDoodStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: embedUrl
        }
      }, 1, 1e4);
      const host = getUrlOrigin(embedUrl);
      const m = html.match(/\/pass_md5\/([\w\-\/.]+)/);
      if (!m)
        return null;
      const res = yield fetchWithTimeout(host + "/pass_md5/" + m[1], {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: embedUrl
        }
      }, 1e4);
      if (!res.ok)
        return null;
      const url = (yield res.text()).trim();
      if (!url || url.indexOf("http") !== 0)
        return null;
      return { url, quality: "720p", headers: { Referer: host + "/" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveVidaraStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const code = embedUrl.replace(/\/+$/, "").split("/").pop().split("?")[0];
      if (!code)
        return null;
      const res = yield fetchWithTimeout(origin + "/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: embedUrl,
          Origin: origin,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        },
        body: JSON.stringify({ filecode: code })
      });
      if (!res.ok)
        return null;
      let data;
      try {
        data = JSON.parse(yield res.text());
      } catch (e) {
        return null;
      }
      if (!data || !data.streaming_url)
        return null;
      return {
        url: data.streaming_url,
        quality: "1080p",
        headers: { Referer: origin + "/", Origin: origin }
      };
    } catch (e) {
      return null;
    }
  });
}
function resolveOkRuStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
          Referer: "https://ok.ru/"
        }
      });
      let m = html.match(/hlsManifestUrl(?:&quot;|"):(?:&quot;|")([^"&]+?)(?:&quot;|")/);
      if (!m)
        return null;
      const url = m[1].replace(/\\u0026/gi, "&").replace(/\\/g, "");
      if (url.indexOf("http") !== 0)
        return null;
      return {
        url,
        quality: "720p",
        headers: {
          Referer: "https://ok.ru/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        }
      };
    } catch (e) {
      return null;
    }
  });
}
function getEmbedResolver(url) {
  if (url.includes("ok.ru")) {
    return resolveOkRuStream;
  }
  if (url.includes("voe.sx") || url.includes("cloudwindow-route.com")) {
    return resolveVoeStream;
  }
  if (url.includes("hlswish") || url.includes("streamwish") || url.includes("vibuxer") || url.includes("strwish") || url.includes("hglink") || url.includes("ghbrisk") || url.includes("premilkyway") || url.includes("hgplaycdn") || url.includes("waaw")) {
    return resolveHLSWishStream;
  }
  if (url.includes("vidhide") || url.includes("dintezuvio") || url.includes("minochinos") || url.includes("dramiyos") || url.includes("dhcplay") || url.includes("smoothpre") || url.includes("dhtpre") || url.includes("vidspeeder") || url.includes("moorearn") || url.includes("travid") || url.includes("vidhidehub") || url.includes("vidhidevip") || url.includes("vidhidepre") || url.includes("kinoger") || url.includes("movearnpre") || url.includes("peytonepre") || url.includes("filelions") || url.includes("morencius")) {
    return resolveVidHideProStream;
  }
  if (url.includes("byse") || url.includes("filemoon") || url.includes("rapidvideo")) {
    return resolveFilemoonStream;
  }
  if (url.includes("luluvid") || url.includes("lulus") || url.includes("lulu")) {
    return resolveLulusStream;
  }
  if (url.includes("yourupload")) {
    return resolveYourUploadStream;
  }
  if (url.includes("vidara") || url.includes("vidwara")) {
    return resolveVidaraStream;
  }
  if (url.includes("uqload")) {
    return resolveUqloadStream;
  }
  if (url.includes("goodstream")) {
    return resolveGoodstreamStream;
  }
  if (url.includes("vimeos")) {
    return resolveVimeosStream;
  }
  if (url.includes("doodstream") || url.includes("dsvplay") || url.includes("dood.to") || url.includes("dood.watch") || url.includes("dood.so")) {
    return resolveDoodStream;
  }
  if (url.includes("mp4upload")) {
    return resolveMp4uploadStream;
  }
  return null;
}

// src/monoschinos/resolvers.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function originOf(url) {
  var m = String(url || "").match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : "";
}
function unpackPacked2(html) {
  try {
    let decodeBase36 = function(num, rad) {
      var res = "";
      while (num > 0) {
        res = symbols[num % rad] + res;
        num = Math.floor(num / rad);
      }
      return res || "0";
    };
    var pMatch = html.match(/eval\(function\(p,a,c,k,e,[premd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!pMatch)
      return null;
    var p = pMatch[1];
    var a = parseInt(pMatch[2], 10);
    var k = pMatch[4].split("|");
    var symbols = "0123456789abcdefghijklmnopqrstuvwxyz";
    return p.replace(/\b\w+\b/g, function(w) {
      var idx = parseInt(w, 36);
      return idx < k.length && k[idx] ? k[idx] : decodeBase36(idx, a);
    });
  } catch (e) {
    return null;
  }
}
function extractCandidates(html) {
  var text = html;
  var up = unpackPacked2(html);
  if (up)
    text = up;
  var candidates = [];
  var seen = {};
  function push(u) {
    if (!u || typeof u !== "string")
      return;
    var v = u.replace(/\\\//g, "/").replace(/\\"/g, '"').trim();
    if (v && seen[v] !== true) {
      seen[v] = true;
      candidates.push(v);
    }
  }
  var m = text.match(/links\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (m) {
    var obj = null;
    try {
      obj = JSON.parse(m[1].replace(/\\"/g, '"').replace(/\\'/g, "'"));
    } catch (e) {
      obj = null;
    }
    if (obj) {
      var keys = Object.keys(obj);
      var order = [];
      var prefer = ["hls4", "hls3", "hls2", "hls1", "hls"];
      for (var i = 0; i < prefer.length; i++) {
        for (var j = 0; j < keys.length; j++) {
          if (keys[j].toLowerCase().indexOf(prefer[i]) !== -1)
            order.push(keys[j]);
        }
      }
      for (var q = 0; q < keys.length; q++) {
        if (order.indexOf(keys[q]) === -1)
          order.push(keys[q]);
      }
      var used = {};
      for (var o = 0; o < order.length; o++) {
        var k2 = order[o];
        if (used[k2])
          continue;
        used[k2] = true;
        var val = obj[k2];
        if (typeof val === "string" && /\.m3u8|master\.txt|urlset/.test(val))
          push(val);
      }
    }
  }
  var re = /(?:file|src)\s*:\s*["']([^"']+\.(?:m3u8|txt)[^"']*)["']/gi;
  var mm;
  while ((mm = re.exec(text)) !== null)
    push(mm[1]);
  var reAbs = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|txt)[^\s"'<>\\]*/gi;
  while ((mm = reAbs.exec(text)) !== null)
    push(mm[0]);
  return candidates;
}
var VIDHIDE_HOSTS = [
  "vidhide",
  "dintezuvio",
  "minochinos",
  "dramiyos",
  "dhcplay",
  "smoothpre",
  "dhtpre",
  "vidspeeder",
  "moorearn",
  "travid",
  "vidhidehub",
  "vidhidevip",
  "vidhidepre",
  "kinoger",
  "movearnpre",
  "peytonepre",
  "filelions",
  "callistanise",
  "morencius"
];
var STREAMWISH_HOSTS = ["hlswish", "streamwish", "vibuxer", "strwish", "hglink", "ghbrisk", "premilkyway", "hgplaycdn"];
function familiaDe(url) {
  var u = String(url || "").toLowerCase();
  for (var i = 0; i < VIDHIDE_HOSTS.length; i++)
    if (u.indexOf(VIDHIDE_HOSTS[i]) !== -1)
      return "vidhide";
  for (var j = 0; j < STREAMWISH_HOSTS.length; j++)
    if (u.indexOf(STREAMWISH_HOSTS[j]) !== -1)
      return "streamwish";
  return null;
}
function rewriteHost(url) {
  return String(url || "").replace(/`/g, "").replace(/^(https?:\/\/)(?:www\.)?hglink\.to(\/|$)/i, "$1vibuxer.com$2").replace(/^(https?:\/\/)(?:www\.)?filelions\.to(\/|$)/i, "$1callistanise.com$2");
}
function normalizeVidhideUrl(url) {
  var u = String(url || "");
  if (u.indexOf("/embed/") !== -1)
    return u;
  var m = u.match(/^(https?:\/\/[^\/]+)\/([A-Za-z0-9_-]+)/);
  if (m)
    return m[1] + "/embed/" + m[2];
  return u;
}
function resolverFamilia(embedUrl, familia) {
  var target = rewriteHost(embedUrl);
  if (familia === "vidhide")
    target = normalizeVidhideUrl(target);
  var origin = originOf(target);
  return fetchText(target, { headers: { Referer: "https://embed69.org/", Origin: "https://embed69.org", "User-Agent": UA } }, 12e3).then(function(html) {
    var candidates = extractCandidates(html);
    if (!candidates.length) {
      var iframe = html.match(/<iframe[^>]*src=["']([^"']+)["']/i);
      if (!iframe)
        return null;
      var iu = iframe[1];
      if (iu.indexOf("//") === 0)
        iu = "https:" + iu;
      else if (iu.indexOf("/") === 0)
        iu = origin + iu;
      return fetchText(iu, { headers: { Referer: target, "User-Agent": UA } }, 12e3).then(function(h2) {
        return extractCandidates(h2);
      }).catch(function() {
        return [];
      });
    }
    return candidates;
  }).then(function(candidates) {
    if (!candidates || !candidates.length)
      return null;
    var url = candidates[0];
    if (url.indexOf("//") === 0)
      url = "https:" + url;
    else if (url.indexOf("/") === 0)
      url = origin + url;
    else if (url.indexOf("http") !== 0)
      url = origin + "/" + url;
    var qm = url.match(/[_-](\d{3,4})p/i);
    var labels = url.match(/_,([a-z,]+),\.urlset/);
    var quality = qm ? qm[1] + "p" : "HD";
    if (!qm && labels && labels[1].indexOf("x") !== -1)
      quality = "1080p";
    return { url, quality, headers: { "User-Agent": UA, Referer: origin + "/", Origin: origin } };
  }).catch(function() {
    return null;
  });
}

// src/monoschinos/extractor.js
var HOST = "https://vww.monoschinos2.net";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var UA2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA2,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
  "Referer": HOST + "/"
};
var MAX_EMBEDS = 8;
var MAX_STREAMS = 8;
function calidadDe(q) {
  var s = String(q || "");
  if (!s || s === "Unknown")
    return "HD";
  return s;
}
var ACCENTS = {
  "\xE1": "a",
  "\xE0": "a",
  "\xE4": "a",
  "\xE2": "a",
  "\xE3": "a",
  "\xE5": "a",
  "\xE9": "e",
  "\xE8": "e",
  "\xEB": "e",
  "\xEA": "e",
  "\xED": "i",
  "\xEC": "i",
  "\xEF": "i",
  "\xEE": "i",
  "\xF3": "o",
  "\xF2": "o",
  "\xF6": "o",
  "\xF4": "o",
  "\xF5": "o",
  "\xFA": "u",
  "\xF9": "u",
  "\xFC": "u",
  "\xFB": "u",
  "\xF1": "n",
  "\xE7": "c",
  "\xDF": "ss"
};
function sinAcentos(s) {
  var out = "";
  var str = String(s == null ? "" : s).toLowerCase();
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    out += ACCENTS[c] != null ? ACCENTS[c] : c;
  }
  return out;
}
function norm(s) {
  return sinAcentos(s).replace(/[^a-z0-9]/g, "");
}
var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function base64ToBytes(input) {
  var str = String(input || "").replace(/=+$/, "");
  var out = [];
  var bs = 0;
  var bc = 0;
  for (var i = 0; i < str.length; i++) {
    var idx = B64_CHARS.indexOf(str.charAt(i));
    if (idx === -1)
      continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4)
      out.push(255 & bs >> (-2 * bc & 6));
  }
  return out;
}
function base64ToText(input) {
  var bytes = base64ToBytes(input);
  var out = "";
  for (var i = 0; i < bytes.length; i++)
    out += String.fromCharCode(bytes[i]);
  return out;
}
var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;
function etiquetaDeTitulo(titulo) {
  var t = String(titulo || "");
  if (RE_ESPANA.test(t))
    return null;
  if (/dub|doblaje|latino/i.test(t))
    return "Latino";
  return "Subtitulado";
}
function filtrarIdioma(streams) {
  var out = [];
  for (var i = 0; i < streams.length; i++) {
    var s = streams[i];
    if (!s || !s.url)
      continue;
    var t = String(s.title || "") + " " + String(s.language || "");
    if (RE_ESPANA.test(t))
      continue;
    if (!RE_LATINO.test(t) && !RE_SUB.test(t))
      continue;
    s.language = RE_SUB.test(t) && !RE_LATINO.test(t) ? "Subtitulado" : "Latino";
    out.push(s);
  }
  return out;
}
function getTmdbInfo(id, tipo) {
  var url = "https://api.themoviedb.org/3/" + tipo + "/" + id + "?api_key=" + TMDB_KEY + "&language=es-MX";
  return fetchText(url, { headers: { "User-Agent": UA2 } }, 1e4).then(function(raw) {
    var res = JSON.parse(raw);
    return {
      title: tipo === "movie" ? res.title || res.original_title : res.name || res.original_name,
      originalTitle: tipo === "movie" ? res.original_title || res.title : res.original_name || res.name
    };
  }).catch(function() {
    return null;
  });
}
function getTmdbAltTitles(id, tipo) {
  var url = "https://api.themoviedb.org/3/" + tipo + "/" + id + "/alternative_titles?api_key=" + TMDB_KEY;
  return fetchText(url, { headers: { "User-Agent": UA2 } }, 1e4).then(function(raw) {
    var res = JSON.parse(raw);
    var arr = res.titles || res.results || [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].title && out.indexOf(arr[i].title) < 0)
        out.push(arr[i].title);
    }
    return out;
  }).catch(function() {
    return [];
  });
}
function searchSite(searchTitle) {
  var ns = norm(searchTitle);
  if (!ns)
    return Promise.resolve(null);
  var url = HOST + "/animes?buscar=" + encodeURIComponent(searchTitle);
  return fetchText(url, { headers: HEADERS }, 15e3).then(function(html) {
    var bloques = [];
    var re = /ficha_efecto">([\s\S]*?)<\/li>/gi;
    var m;
    while ((m = re.exec(html)) !== null)
      bloques.push(m[1]);
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < bloques.length; i++) {
      var block = bloques[i];
      var title = (block.match(/title="([^"]*)"/) || [])[1] || "";
      var href = (block.match(/href="([^"]*)"/) || [])[1] || "";
      if (!title || !href)
        continue;
      var cleanTitle = title.replace("Ver Anime", "").replace("Online Gratis", "").replace(/&quot;|&amp;|&#039;/g, "").replace(/^\s+|\s+$/g, "");
      var nct = norm(cleanTitle);
      if (!nct)
        continue;
      var score = 0;
      if (nct === ns)
        score = 100;
      else if (nct.indexOf(ns) !== -1 || ns.indexOf(nct) !== -1) {
        score = 50 - Math.min(20, Math.floor(Math.abs(nct.length - ns.length) / 2));
      }
      if (score > bestScore) {
        bestScore = score;
        best = href.indexOf("http") === 0 ? href : href.replace("./", HOST + "/");
      }
    }
    return best ? { url: best, score: bestScore } : null;
  }).catch(function() {
    return null;
  });
}
function getEpisodeUrl(seriesUrl, episode) {
  return fetchText(seriesUrl, { headers: HEADERS }, 15e3).then(function(html) {
    var dataI = (html.match(/data-i="([^"]+)"/) || [])[1];
    var dataU = (html.match(/data-u="([^"]+)"/) || [])[1];
    if (!dataI || !dataU)
      return null;
    var targetEp = String(parseInt(episode, 10) || 1);
    function buscarEnPagina(p) {
      var body = "acc=episodes&i=" + encodeURIComponent(dataI) + "&u=" + encodeURIComponent(dataU) + "&p=" + p;
      return fetchText(HOST + "/ajax_pagination", {
        method: "POST",
        headers: {
          "User-Agent": UA2,
          "Accept": "text/html,*/*",
          "Accept-Language": "es-MX,es;q=0.9",
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": seriesUrl
        },
        body
      }, 15e3).then(function(ajaxHtml) {
        var re = /<article>([\s\S]*?)<\/article>/gi;
        var m;
        var count = 0;
        var found = null;
        while ((m = re.exec(ajaxHtml)) !== null) {
          count++;
          var article = m[1];
          var epUrl = (article.match(/href="([^"]+)"/) || [])[1] || "";
          var alt = article.match(/alt="[^"]*episodio\s*(\d+)/i) || article.match(/alt="[^"]*capitulo\s*(\d+)/i);
          var epNum = alt ? alt[1] : "";
          if (epUrl && epNum === targetEp)
            found = epUrl;
        }
        if (found)
          return found;
        if (count === 0 || p >= 5)
          return null;
        return buscarEnPagina(p + 1);
      }).catch(function() {
        return null;
      });
    }
    return buscarEnPagina(1);
  }).catch(function() {
    return null;
  });
}
function getEmbedUrls(episodeUrl) {
  return fetchText(episodeUrl, { headers: HEADERS }, 15e3).then(function(html) {
    var embeds = [];
    var vistos = {};
    function push(u) {
      if (!u || vistos[u])
        return;
      vistos[u] = true;
      embeds.push(u);
    }
    var re = /target="_blank"\s+href="(https?:\/\/[^"]+)"/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      if (!/rpmplayer\./.test(m[1]))
        push(m[1]);
    }
    var encrypt = (html.match(/data-encrypt="([^"]+)"/) || [])[1];
    if (!encrypt)
      return embeds;
    return fetchText(HOST + "/ajax_pagination", {
      method: "POST",
      headers: {
        "User-Agent": UA2,
        "Accept": "text/html,*/*",
        "Accept-Language": "es-MX,es;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": episodeUrl
      },
      body: "acc=opt&i=" + encodeURIComponent(encrypt)
    }, 15e3).then(function(ajaxHtml) {
      var re2 = /data-player="([^"]+)"/gi;
      var m2;
      while ((m2 = re2.exec(ajaxHtml)) !== null) {
        var url = base64ToText(m2[1]);
        if (url.indexOf("http") === 0 && !/rpmplayer\./.test(url))
          push(url);
      }
      return embeds;
    }).catch(function() {
      return embeds;
    });
  }).catch(function() {
    return [];
  });
}
function sanitizePlaybackHeaders(url, headers) {
  var h = {};
  var src = headers || {};
  for (var k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k))
      h[k] = src[k];
  }
  var u = String(url || "").toLowerCase();
  if (/vimeos\.|vms\.sh/.test(u)) {
    delete h.Referer;
    delete h.referer;
    delete h.Origin;
    delete h.origin;
  } else if (/mp4upload\.com/.test(u)) {
    h.Referer = String(url || "");
  }
  return h;
}
function resolverEmbed(embedUrl) {
  var familia = familiaDe(embedUrl);
  var promesa = familia ? resolverFamilia(embedUrl, familia) : Promise.resolve(null);
  return promesa.then(function(r) {
    if (r && r.url)
      return r;
    var fn = null;
    try {
      fn = getEmbedResolver(embedUrl);
    } catch (e) {
      fn = null;
    }
    if (typeof fn !== "function")
      return null;
    return Promise.resolve().then(function() {
      return fn(embedUrl);
    }).then(function(r2) {
      return r2 && r2.url ? r2 : null;
    }).catch(function() {
      return null;
    });
  }).catch(function() {
    return null;
  });
}
function extraer(tmdbId, mediaType, season, episode, title) {
  return __async(this, null, function* () {
    var tipo = mediaType === "movie" ? "movie" : "tv";
    if (!tmdbId && !title)
      return [];
    var candidatosMain = [];
    if (title)
      candidatosMain.push(title);
    var info = yield getTmdbInfo(tmdbId, tipo);
    if (info) {
      if (info.title && candidatosMain.indexOf(info.title) < 0)
        candidatosMain.push(info.title);
      if (info.originalTitle && candidatosMain.indexOf(info.originalTitle) < 0)
        candidatosMain.push(info.originalTitle);
    }
    var altTitles = yield getTmdbAltTitles(tmdbId, tipo);
    var candidatosAlt = [];
    for (var ai = 0; ai < altTitles.length && candidatosAlt.length < 9; ai++) {
      if (candidatosMain.indexOf(altTitles[ai]) < 0 && candidatosAlt.indexOf(altTitles[ai]) < 0)
        candidatosAlt.push(altTitles[ai]);
    }
    var candidatos = candidatosMain.concat(candidatosAlt);
    if (!candidatos.length)
      return [];
    var seriesUrl = null;
    var bestScore = -1;
    for (var ci = 0; ci < candidatos.length; ci++) {
      if (ci >= candidatosMain.length && bestScore > 0)
        break;
      var hit = yield searchSite(candidatos[ci]);
      if (hit && hit.score > bestScore) {
        bestScore = hit.score;
        seriesUrl = hit.url;
      }
      if (bestScore >= 100)
        break;
    }
    if (!seriesUrl)
      return [];
    var pageUrl = seriesUrl;
    if (tipo === "tv" && episode) {
      var epUrl = yield getEpisodeUrl(seriesUrl, episode);
      if (!epUrl)
        return [];
      pageUrl = epUrl;
    } else if (tipo === "tv") {
      return [];
    } else if (tipo === "movie") {
      var epUrlM = yield getEpisodeUrl(seriesUrl, 1);
      if (epUrlM)
        pageUrl = epUrlM;
    }
    if (/castellano/i.test(pageUrl))
      return [];
    var embeds = yield getEmbedUrls(pageUrl);
    if (!embeds.length)
      return [];
    if (embeds.length > MAX_EMBEDS)
      embeds = embeds.slice(0, MAX_EMBEDS);
    var etiqueta = etiquetaDeTitulo(pageUrl);
    if (!etiqueta)
      return [];
    var resueltos = yield Promise.all(embeds.map(function(embedUrl) {
      var server = (embedUrl.match(/:\/\/(?:www\.)?([^.]+)\./) || [])[1] || "?";
      return resolverEmbed(embedUrl).then(function(r) {
        if (!r || !r.url)
          return null;
        return {
          title: server + " \xB7 " + etiqueta,
          quality: calidadDe(r.quality),
          language: etiqueta,
          url: r.url,
          headers: sanitizePlaybackHeaders(r.url, r.headers || { Referer: embedUrl, "User-Agent": UA2 }),
          __embed: embedUrl
        };
      });
    }));
    var streams = [];
    var vistos = {};
    for (var i = 0; i < resueltos.length; i++) {
      var s = resueltos[i];
      if (!s)
        continue;
      if (vistos[s.url])
        continue;
      vistos[s.url] = true;
      delete s.__embed;
      streams.push(s);
      if (streams.length >= MAX_STREAMS)
        break;
    }
    return filtrarIdioma(streams);
  });
}

// src/shared/validate.js
var VALIDATE_TIMEOUT_MS = 7e3;
var VALIDATE_CONCURRENCY = 4;
function qualityRank(q) {
  if (!q)
    return 0;
  var s = String(q).toLowerCase();
  if (s.indexOf("4k") !== -1 || s.indexOf("2160") !== -1)
    return 2160;
  var m = s.match(/(\d{3,4})\s*p/);
  if (m)
    return parseInt(m[1], 10);
  return 0;
}
function isM3u8(url) {
  return /\.m3u8(\?|#|$)/i.test(url || "");
}
function checkUrl(url, headers, timeoutMs) {
  return new Promise(function(resolve) {
    var done = false;
    var timer = null;
    var controller = null;
    function finish(ok) {
      if (done)
        return;
      done = true;
      if (timer) {
        try {
          clearTimeout(timer);
        } catch (e) {
        }
        timer = null;
      }
      if (controller) {
        try {
          controller.abort();
        } catch (e) {
        }
      }
      resolve(!!ok);
    }
    if (!url || typeof url !== "string" || url.indexOf("http") !== 0) {
      resolve(false);
      return;
    }
    if (typeof setTimeout !== "undefined") {
      timer = setTimeout(function() {
        timer = null;
        finish(false);
      }, timeoutMs || VALIDATE_TIMEOUT_MS);
    }
    var reqHeaders = {
      "Range": "bytes=0-2047",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    if (headers) {
      for (var k in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, k) && headers[k]) {
          reqHeaders[k] = headers[k];
        }
      }
    }
    var reqInit = { headers: reqHeaders, redirect: "follow" };
    try {
      if (typeof AbortController !== "undefined") {
        controller = new AbortController();
        reqInit.signal = controller.signal;
      }
    } catch (e) {
      controller = null;
    }
    fetch(url, reqInit).then(function(res) {
      var status = res.status;
      if (status === 200 || status === 206 || status === 416) {
        if (isM3u8(url)) {
          res.text().then(function(t) {
            finish(t && t.indexOf("#EXTM3U") !== -1);
          }).catch(function() {
            finish(true);
          });
        } else {
          finish(true);
        }
      } else {
        finish(false);
      }
    }).catch(function() {
      finish(false);
    });
  });
}
function filterWorkingStreams(streams, opts) {
  opts = opts || {};
  var timeout = opts.timeoutMs || VALIDATE_TIMEOUT_MS;
  var concurrency = opts.concurrency || VALIDATE_CONCURRENCY;
  var seen = {};
  var uniq = [];
  (streams || []).forEach(function(s) {
    if (!s || !s.url || seen[s.url])
      return;
    seen[s.url] = 1;
    uniq.push(s);
  });
  if (uniq.length === 0)
    return Promise.resolve([]);
  var results = new Array(uniq.length);
  var cursor = 0;
  function worker() {
    if (cursor >= uniq.length)
      return Promise.resolve();
    var i = cursor++;
    var st = uniq[i];
    return checkUrl(st.url, st.headers, timeout).then(function(ok) {
      results[i] = ok ? st : null;
    }).catch(function() {
      results[i] = null;
    }).then(worker);
  }
  var workers = [];
  var n = Math.min(concurrency, uniq.length);
  for (var w = 0; w < n; w++)
    workers.push(worker());
  return Promise.all(workers).then(function() {
    var alive = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i])
        alive.push(results[i]);
    }
    alive.sort(function(a, b) {
      return qualityRank(b.quality) - qualityRank(a.quality);
    });
    return alive;
  }).catch(function() {
    return uniq;
  });
}
function withWorkingStreams(extractPromise) {
  return Promise.resolve(extractPromise).then(function(streams) {
    return filterWorkingStreams(streams);
  }).catch(function() {
    return [];
  });
}

// src/monoschinos/index.js
function withTimeout(promise, ms) {
  if (typeof setTimeout === "undefined")
    return promise;
  return Promise.race([
    promise,
    new Promise(function(res) {
      setTimeout(function() {
        res([]);
      }, ms);
    })
  ]);
}
function getStreams(tmdbId, mediaType, season, episode) {
  var tipo = String(mediaType || "tv").toLowerCase();
  return withWorkingStreams(withTimeout(
    extraer(tmdbId, tipo === "movie" ? "movie" : "tv", season, episode).catch(function() {
      return [];
    }),
    4e4
  ));
}
module.exports = { getStreams };
