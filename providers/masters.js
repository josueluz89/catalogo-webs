/**
 * masters - Built from src/masters/
 * Generated: 2026-06-30T03:20:02.202Z
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
function fetchWithTimeout(url, options, timeout) {
  if (!options)
    options = {};
  var headers = Object.assign({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  }, options.headers || {});
  return fetch(url, Object.assign({}, options, { headers, redirect: "follow" }));
}
function fetchText(url, options, timeout) {
  return fetchWithTimeout(url, options, timeout).then(function(res) {
    if (!res.ok)
      throw new Error("HTTP " + res.status + " for " + url);
    return res.text();
  });
}
function fetchWithRetry(url, options, retries, timeout) {
  if (!retries)
    retries = 2;
  return fetchText(url, options, timeout).catch(function(e) {
    if (retries <= 0)
      throw e;
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
    try {
      const res = yield fetchWithTimeout(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
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
        const urlPatterns = [
          ...pageText.matchAll(/(?:mp4|hls)'\s*:\s*'([^']+)'/gi),
          ...pageText.matchAll(/(?:mp4|hls)"\s*:\s*"([^"]+)"/gi)
        ];
        for (const m of urlPatterns) {
          let u = m[1];
          if (u.startsWith("aHR0")) {
            try {
              u = base64Decode(u) || u;
            } catch (e) {
            }
          }
          return { url: u, quality: extractQuality(u), headers: { Referer: embedUrl } };
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
  for (const [from, to] of Object.entries(DOMAIN_MAP)) {
    if (result.includes(from)) {
      result = result.replace(from, to);
      break;
    }
  }
  return result;
}
function resolveHLSWishStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const targetUrl = mapDomain(embedUrl).replace("/e/", "/v/");
      const origin = getUrlOrigin(targetUrl);
      const html = yield fetchWithRetry(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://embed69.org/",
          Origin: "https://embed69.org",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9"
        }
      });
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
      const res = yield fetch(origin + "/dl", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0",
          Referer: origin
        },
        body: new URLSearchParams({
          op: "embed",
          file_code: filecode,
          auto: "1",
          referer: embedUrl
        })
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
function resolveUqloadStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Upgrade-Insecure-Requests": "1",
          Referer: origin + "/"
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
function getEmbedResolver(url) {
  if (url.includes("voe.sx") || url.includes("cloudwindow-route.com")) {
    return resolveVoeStream;
  }
  if (url.includes("hlswish") || url.includes("streamwish") || url.includes("vibuxer") || url.includes("strwish") || url.includes("hglink") || url.includes("ghbrisk") || url.includes("premilkyway")) {
    return resolveHLSWishStream;
  }
  if (url.includes("vidhide") || url.includes("dintezuvio") || url.includes("minochinos") || url.includes("dramiyos") || url.includes("dhcplay") || url.includes("smoothpre") || url.includes("dhtpre") || url.includes("vidspeeder") || url.includes("moorearn") || url.includes("travid") || url.includes("vidhidehub") || url.includes("vidhidevip") || url.includes("vidhidepre") || url.includes("kinoger") || url.includes("movearnpre") || url.includes("peytonepre") || url.includes("filelions")) {
    return resolveVidHideProStream;
  }
  if (url.includes("bysedikamoum") || url.includes("bysedi") || url.includes("filemoon") || url.includes("rapidvideo")) {
    return resolveFilemoonStream;
  }
  if (url.includes("luluvid") || url.includes("lulus") || url.includes("lulu")) {
    return resolveLulusStream;
  }
  if (url.includes("uqload")) {
    return resolveUqloadStream;
  }
  return null;
}

// src/masters/extractor.js
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://ww3.gnulahd.nu";
function normalizeText(text) {
  if (!text)
    return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function getServerLabel(url) {
  if (url.indexOf("voe.sx") !== -1 || url.indexOf("tubeless") !== -1 || url.indexOf("simpulum") !== -1 || url.indexOf("uroch") !== -1 || url.indexOf("nathanfromsubject") !== -1 || url.indexOf("yip.su") !== -1 || url.indexOf("metagnath") !== -1 || url.indexOf("donaldlineelse") !== -1 || url.indexOf("crystal") !== -1 || url.indexOf("cloudwindow") !== -1)
    return "VOE";
  if (url.indexOf("they.tube") !== -1 || url.indexOf("the.tube") !== -1)
    return "Tube";
  if (url.indexOf("filemoon") !== -1 || url.indexOf("bysedi") !== -1)
    return "FileMoon";
  if (url.indexOf("streamwish") !== -1 || url.indexOf("hlswish") !== -1 || url.indexOf("vibuxer") !== -1 || url.indexOf("strwish") !== -1)
    return "StreamWish";
  if (url.indexOf("vidhide") !== -1 || url.indexOf("dintezuvio") !== -1 || url.indexOf("filelions") !== -1)
    return "VidHide";
  if (url.indexOf("uqload") !== -1)
    return "Uqload";
  if (url.indexOf("luluvid") !== -1 || url.indexOf("lulus") !== -1)
    return "Lulu";
  if (url.indexOf("ok.ru") !== -1 || url.indexOf("ok video") !== -1)
    return "OK";
  return "Online";
}
function extractSearchResults(html) {
  var candidates = [];
  var articleRegex = /<article[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/article>/gi;
  var article;
  while ((article = articleRegex.exec(html)) !== null) {
    var cls = article[1];
    var content = article[2];
    if (/styleegg/i.test(cls))
      continue;
    if (/\/blog\//i.test(content))
      continue;
    var href = (content.match(/<a[^>]*href="([^"]*)"[^>]*>/) || [])[1];
    var titleAttr = (content.match(/title="([^"]*)"/) || [])[1];
    var h2Text = (content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1];
    var itemTitle = (h2Text || titleAttr || "").replace(/<[^>]*>/g, "").trim();
    if (!href || !itemTitle)
      continue;
    if (/mejores|cronología/i.test(itemTitle))
      continue;
    var typeText = (content.match(/<div[^>]*class="[^"]*typez[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || "";
    var type = /serie/i.test(typeText) || /anime/i.test(typeText) ? "tv" : "movie";
    candidates.push({ title: itemTitle, href, type });
  }
  return candidates;
}
function extractEpisodes(html, season, episode) {
  var eplister = html.match(/<div[^>]*class="[^"]*eplister[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\!--/i);
  if (!eplister)
    eplister = html.match(/<div[^>]*class="[^"]*eplister[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (!eplister)
    return null;
  var liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  var li;
  while ((li = liRegex.exec(eplister[1])) !== null) {
    var liContent = li[1];
    var aHref = (liContent.match(/<a[^>]*href="([^"]*)"[^>]*>/i) || [])[1];
    var epNum = (liContent.match(/<div[^>]*class="[^"]*epl-num[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1];
    if (!aHref || !epNum)
      continue;
    var match = epNum.match(/(\d+)x(\d+)/);
    if (match) {
      var s = parseInt(match[1], 10);
      var e = parseInt(match[2], 10);
      if (s === season && e === episode)
        return aHref;
    }
  }
  return null;
}
function getMediaTitle(tmdbId, mediaType) {
  var url = "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=es-MX";
  return fetchText(url).then(function(raw) {
    var data = JSON.parse(raw);
    var title = mediaType === "movie" ? data.title : data.name;
    var originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    return { title, originalTitle };
  });
}
function resolveTheyTube(code, resolvePath, authParam, pageUrl) {
  var resolveUrl = MAIN_URL + resolvePath + encodeURIComponent(code) + authParam;
  return fetchText(resolveUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36", Referer: pageUrl }
  }).then(function(raw) {
    var data = JSON.parse(raw);
    if (data && data.master) {
      return { url: data.master, quality: "1080p", headers: { Referer: "https://they.tube/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } };
    }
    return null;
  }).catch(function() {
    return null;
  });
}
function searchSite(query) {
  var searchUrl = MAIN_URL + "/?s=" + encodeURIComponent(query);
  return fetchText(searchUrl).then(function(html) {
    return extractSearchResults(html);
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return getMediaTitle(tmdbId, mediaType).then(function(media) {
    var queries = [];
    if (media.originalTitle)
      queries.push(media.originalTitle);
    if (media.title && media.title !== media.originalTitle)
      queries.push(media.title);
    if (queries.length === 0)
      return [];
    var normalizedOriginals = [normalizeText(media.originalTitle || "")];
    var normalizedTitles = [normalizeText(media.title || "")];
    var expectedType = mediaType === "tv" ? "tv" : "movie";
    var bestTvScore = -1, bestTvUrl = null, bestTvType = "movie";
    var bestMovieScore = -1, bestMovieUrl = null, bestMovieType = "movie";
    function scoreCandidate(cand) {
      var normalizedCand = normalizeText(cand.title);
      var score = 0;
      for (var n = 0; n < normalizedOriginals.length; n++) {
        var no = normalizedOriginals[n];
        if (normalizedCand === no)
          score = 100;
        else if (normalizedCand.indexOf(no) !== -1 || no.indexOf(normalizedCand) !== -1)
          score = Math.max(score, 80);
      }
      for (var n = 0; n < normalizedTitles.length; n++) {
        var nt = normalizedTitles[n];
        if (normalizedCand === nt)
          score = Math.max(score, 100);
        else if (normalizedCand.indexOf(nt) !== -1 || nt.indexOf(normalizedCand) !== -1)
          score = Math.max(score, 80);
      }
      if (score === 0) {
        var qWords = [];
        for (var n = 0; n < normalizedOriginals.length; n++)
          qWords = qWords.concat(normalizedOriginals[n].split(" ").filter(Boolean));
        for (var n = 0; n < normalizedTitles.length; n++)
          qWords = qWords.concat(normalizedTitles[n].split(" ").filter(Boolean));
        var unique = {};
        qWords = qWords.filter(function(w2) {
          if (unique[w2])
            return false;
          unique[w2] = true;
          return true;
        });
        var cWords = normalizedCand.split(" ").filter(Boolean);
        var qMatch = 0, cMatch = 0;
        for (var w = 0; w < qWords.length; w++) {
          if (normalizedCand.indexOf(qWords[w]) !== -1)
            qMatch++;
        }
        for (var w = 0; w < cWords.length; w++) {
          for (var q = 0; q < qWords.length; q++) {
            if (qWords[q] === cWords[w]) {
              cMatch++;
              break;
            }
          }
        }
        score = qMatch * 8 + cMatch * 5;
      }
      if (cand.type === "tv" && score > bestTvScore) {
        bestTvScore = score;
        bestTvUrl = cand.href;
        bestTvType = cand.type;
      }
      if (cand.type === "movie" && score > bestMovieScore) {
        bestMovieScore = score;
        bestMovieUrl = cand.href;
        bestMovieType = cand.type;
      }
    }
    function selectTarget() {
      var targetUrl, targetType = "movie";
      if (expectedType === "tv" && bestTvUrl) {
        targetUrl = bestTvUrl;
        targetType = bestTvType;
      } else if (expectedType === "movie" && bestMovieUrl) {
        targetUrl = bestMovieUrl;
        targetType = bestMovieType;
      } else {
        targetUrl = bestTvUrl || bestMovieUrl;
        targetType = bestTvType || bestMovieType;
      }
      if (!targetUrl)
        return null;
      if (targetUrl.indexOf("http") !== 0)
        targetUrl = MAIN_URL + targetUrl;
      return { url: targetUrl, type: targetType };
    }
    var searchIndex = 0;
    function doSearch() {
      if (searchIndex >= queries.length)
        return selectTarget();
      return searchSite(queries[searchIndex++]).then(function(candidates) {
        for (var i = 0; i < candidates.length; i++)
          scoreCandidate(candidates[i]);
        return doSearch();
      });
    }
    return doSearch().then(function(target) {
      if (!target)
        return [];
      return getPageContent(target.url, mediaType, target.type, season, episode, media);
    });
  }).catch(function(err) {
    console.error("[Masters] Error: " + (err.message || err));
    return [];
  });
}
function getPageContent(pageUrl, mediaType, targetType, season, episode, media) {
  var isTv = mediaType === "tv" || targetType === "tv";
  if (isTv) {
    return fetchText(pageUrl).then(function(tvHtml) {
      var epUrl = extractEpisodes(tvHtml, season, episode);
      if (!epUrl)
        return [];
      if (epUrl.indexOf("http") !== 0)
        epUrl = MAIN_URL + epUrl;
      return getPlayPage(epUrl);
    });
  }
  return getPlayPage(pageUrl);
}
function getPlayPage(pageUrl) {
  return fetchText(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
  }).then(function(playHtml) {
    var regex = /var\s+(_gnpv_ep_langs|_gd)\s*=\s*(\[.*\]);/;
    var match = regex.exec(playHtml);
    if (!match)
      return [];
    var resolvePath = null, authParam = null;
    var resolveMatch = playHtml.match(/var\s+RESOLVE\s*=\s*'([^']*)'\s*,\s*AUTH\s*=\s*'([^']*)'/);
    if (resolveMatch) {
      resolvePath = resolveMatch[1];
      authParam = resolveMatch[2];
    }
    var langs;
    try {
      langs = JSON.parse(match[2]);
    } catch (e) {
      return [];
    }
    var streams = [];
    var promises = [];
    for (var l = 0; l < langs.length; l++) {
      var langobj = langs[l];
      var label = langobj.label || "";
      if (label.toLowerCase().indexOf("latino") === -1 && label.toLowerCase().indexOf("mx") === -1)
        continue;
      var servers = langobj.servers || [];
      for (var s = 0; s < servers.length; s++) {
        var srv = servers[s];
        var cleanSrc = (srv.src || "").replace(/\\\//g, "/");
        if (!cleanSrc)
          continue;
        if (cleanSrc.indexOf("//") === 0)
          cleanSrc = "https:" + cleanSrc;
        if ((cleanSrc.indexOf("they.tube") !== -1 || cleanSrc.indexOf("the.tube") !== -1) && resolvePath && authParam) {
          var codeMatch = cleanSrc.match(/the(?:y)?\.tube\/(?:e\/)?([A-Za-z0-9_-]+?)(?:\.html)?(?:[?#]|$)/i);
          if (codeMatch) {
            (function(src, title) {
              promises.push(
                resolveTheyTube(codeMatch[1], resolvePath, authParam, pageUrl).then(function(result) {
                  if (result) {
                    streams.push({
                      name: "GnulaHD (" + (title || "Tube") + ")",
                      title: (result.quality || "HD") + " \xB7 Latino \xB7 " + (title || "Tube"),
                      url: result.url,
                      quality: result.quality || "HD",
                      headers: result.headers
                    });
                  } else {
                    streams.push({
                      name: "GnulaHD (" + (title || "Tube") + ")",
                      title: "Embed \xB7 Latino \xB7 " + (title || "Tube"),
                      url: src,
                      quality: "Unknown",
                      headers: { Referer: pageUrl, "User-Agent": "Mozilla/5.0" }
                    });
                  }
                })
              );
            })(cleanSrc, srv.title);
            continue;
          }
        }
        var serverLabel = getServerLabel(cleanSrc);
        (function(srcUrl, srvTitle, sLabel) {
          var fixedUrl = mapDomain(srcUrl);
          var resolver = getEmbedResolver(fixedUrl);
          if (resolver) {
            promises.push(
              resolver(fixedUrl).then(function(result) {
                if (result && result.url) {
                  streams.push({
                    name: "GnulaHD Direct (" + (srvTitle || sLabel) + ")",
                    title: (result.quality || "HD") + " \xB7 Latino \xB7 " + (srvTitle || sLabel),
                    url: result.url,
                    quality: result.quality || "HD",
                    headers: result.headers
                  });
                } else {
                  streams.push({
                    name: "GnulaHD (" + (srvTitle || sLabel) + ")",
                    title: "Embed \xB7 Latino \xB7 " + (srvTitle || sLabel),
                    url: fixedUrl,
                    quality: "Unknown",
                    headers: { Referer: pageUrl, "User-Agent": "Mozilla/5.0" }
                  });
                }
              }).catch(function() {
                streams.push({
                  name: "GnulaHD (" + (srvTitle || sLabel) + ")",
                  title: "Embed \xB7 Latino \xB7 " + (srvTitle || sLabel),
                  url: fixedUrl,
                  quality: "Unknown",
                  headers: { Referer: pageUrl, "User-Agent": "Mozilla/5.0" }
                });
              })
            );
          } else {
            streams.push({
              name: "GnulaHD (" + (srvTitle || sLabel) + ")",
              title: "Embed \xB7 Latino \xB7 " + (srvTitle || sLabel),
              url: fixedUrl,
              quality: "Unknown",
              headers: { Referer: pageUrl, "User-Agent": "Mozilla/5.0" }
            });
          }
        })(cleanSrc, srv.title, serverLabel);
      }
    }
    if (promises.length > 0) {
      return Promise.all(promises).then(function() {
        return streams;
      });
    }
    return streams;
  });
}

// src/masters/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return extractStreams(tmdbId, mediaType, season, episode).catch(function() {
    return [];
  });
}
module.exports = { getStreams };
