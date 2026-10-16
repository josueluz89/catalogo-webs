/**
 * allpeliculasse - Built from src/allpeliculasse/
 * Generated: 2026-10-15T23:52:33.535Z
 */
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
var FETCH_TIMEOUT = 12e3;
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
function fetchJson(url, options, timeout) {
  return fetchText(url, options, timeout).then(function(raw) {
    return JSON.parse(raw);
  });
}

// src/allpeliculasse/sitio.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://allpeliculas.la";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var CABECERAS = {
  "User-Agent": USER_AGENT,
  "Accept": "application/json, text/plain, */*",
  "Connection": "keep-alive",
  "Referer": BASE_URL + "/"
};
function limpiarTitulo(title) {
  if (!title)
    return "";
  return String(title).toLowerCase().replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/:\s*.*?$/g, "").replace(/[-_]/g, " ").replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ]/g, "").replace(/\s+/g, " ").trim();
}
function consultaDe(title) {
  if (!title)
    return "";
  var q = String(title).split(":")[0];
  q = q.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "");
  q = q.replace(/[^a-zA-Z0-9\s\-áéíóúÁÉÍÓÚñÑ]/g, "");
  return q.replace(/\s+/g, " ").trim();
}
function datosTMDB(id, tipo) {
  return __async(this, null, function* () {
    var titulos = [];
    var year = "";
    var idiomas = ["es-MX", "es-ES", "en-US"];
    for (var i = 0; i < idiomas.length; i++) {
      try {
        var url = "https://api.themoviedb.org/3/" + tipo + "/" + id + "?api_key=" + TMDB_API_KEY + "&language=" + idiomas[i];
        var res = yield fetchJson(url, { headers: { "User-Agent": USER_AGENT } });
        var t = tipo === "movie" ? res.title : res.name;
        var o = tipo === "movie" ? res.original_title : res.original_name;
        if (t && titulos.indexOf(t) === -1)
          titulos.push(t);
        if (o && titulos.indexOf(o) === -1)
          titulos.push(o);
        if (!year)
          year = String(res.release_date || res.first_air_date || "").substring(0, 4);
      } catch (e) {
        console.log("[AllpeliculasSE] TMDB error (" + idiomas[i] + "): " + (e && e.message));
      }
    }
    return titulos.length ? { titles: titulos, year } : null;
  });
}
function buscarPosts(query, tipo) {
  return __async(this, null, function* () {
    try {
      var postType = tipo === "tv" ? "tvshows" : "movies";
      var url = BASE_URL + "/wp-api/v1/search?filter=[]&q=" + encodeURIComponent(query) + "&orderBy=latest&order=desc&postType=" + postType + "&postsPerPage=20&page=1";
      console.log("[AllpeliculasSE] Buscando: " + url);
      var data = yield fetchJson(url, { headers: CABECERAS });
      if (data && data.data && data.data.posts) {
        var posts = [];
        for (var i = 0; i < data.data.posts.length; i++) {
          var p = data.data.posts[i];
          posts.push({ id: p._id, title: p.title, slug: p.slug, type: p.type });
        }
        return posts;
      }
    } catch (e) {
      console.log("[AllpeliculasSE] Error de b\xFAsqueda: " + (e && e.message));
    }
    return [];
  });
}
function buscarCapitulo(postId, season, episode) {
  return __async(this, null, function* () {
    try {
      var url = BASE_URL + "/wp-api/v1/single/episodes/list?_id=" + postId + "&season=" + season + "&postsPerPage=100&page=1";
      console.log("[AllpeliculasSE] Lista de episodios: " + url);
      var data = yield fetchJson(url, { headers: CABECERAS });
      var posts = data && data.data ? data.data.posts : null;
      if (!posts)
        return null;
      for (var i = 0; i < posts.length; i++) {
        var ep = posts[i];
        if (parseInt(ep.season_number, 10) === parseInt(season, 10) && parseInt(ep.episode_number, 10) === parseInt(episode, 10)) {
          return ep._id;
        }
      }
    } catch (e) {
      console.log("[AllpeliculasSE] Error listando episodios: " + (e && e.message));
    }
    return null;
  });
}
function embedsDe(postId) {
  return __async(this, null, function* () {
    try {
      var url = BASE_URL + "/wp-api/v1/player?postId=" + postId + "&demo=0";
      console.log("[AllpeliculasSE] Players de: " + url);
      var data = yield fetchJson(url, { headers: CABECERAS });
      if (data && data.data && data.data.embeds)
        return data.data.embeds;
    } catch (e) {
      console.log("[AllpeliculasSE] Error obteniendo players: " + (e && e.message));
    }
    return [];
  });
}

// src/allpeliculasse/resolvers.js
var USER_AGENT2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function partesDeUrl(u) {
  var s = String(u || "");
  var m = s.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\/?#]+)([^?#]*)/);
  if (!m)
    return { protocolo: "", host: "", origin: "", ruta: "" };
  var proto = m[1].toLowerCase();
  var host = m[2].toLowerCase();
  return { protocolo: proto, host, origin: proto + "://" + host, ruta: m[3] || "/" };
}
function localAtob(input) {
  if (!input)
    return "";
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var str = String(input).replace(/=+$/, "").replace(/[\s\n\r\t]/g, "");
  var output = "";
  if (str.length % 4 === 1)
    return "";
  for (var bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}
function unpackEval(payload, radix, symtab) {
  var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return payload.replace(/\b([0-9a-zA-Z]+)\b/g, function(match) {
    var idx = 0;
    for (var i = 0; i < match.length; i++) {
      var pos = chars.indexOf(match[i]);
      if (pos === -1)
        return match;
      idx = idx * radix + pos;
    }
    if (isNaN(idx) || idx >= symtab.length)
      return match;
    return symtab[idx] && symtab[idx] !== "" ? symtab[idx] : match;
  });
}
function desempacar(script) {
  try {
    var m = String(script || "").match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
    if (!m)
      return null;
    return unpackEval(m[1], parseInt(m[2], 10), m[4].split("|"));
  } catch (e) {
    return null;
  }
}
function limpiarCabecerasVimeos(url, cabeceras) {
  var limpio = {};
  var keys = Object.keys(cabeceras || {});
  for (var i = 0; i < keys.length; i++) {
    if (!/^(referer|origin)$/i.test(keys[i]))
      limpio[keys[i]] = cabeceras[keys[i]];
  }
  return limpio;
}
var ESPEJOS_WISH = [
  "https://hanerix.com/e/",
  "https://embedwish.com/e/",
  "https://hglink.to/e/",
  "https://awish.pro/e/",
  "https://strwish.com/e/"
];
function resolverStreamwish(embedUrl, vencido) {
  return __async(this, null, function* () {
    try {
      var rawId = String(embedUrl).split("?")[0].split("/").pop().replace(/\.html$/, "");
      if (!rawId)
        return null;
      var mirrors = [];
      for (var i = 0; i < ESPEJOS_WISH.length; i++)
        mirrors.push(ESPEJOS_WISH[i] + rawId);
      mirrors.push(embedUrl);
      for (var j = 0; j < mirrors.length; j++) {
        if (vencido())
          return null;
        var mirror = mirrors[j];
        var origen = partesDeUrl(mirror).origin;
        try {
          var html = yield fetchText(mirror, { headers: { "Referer": mirror, "User-Agent": USER_AGENT2 } });
          if (!html || html.length < 500 || html.indexOf("__vite_is_modern_browser") !== -1)
            continue;
          var m3u8Url = null;
          var hashMatch = html.match(/[0-9a-f]{32}/i);
          if (hashMatch && !vencido()) {
            var dlUrl = origen + "/dl?op=view&file_code=" + rawId + "&hash=" + hashMatch[0] + "&embed=1&referer=&adb=1&hls4=1";
            try {
              var dlText = yield fetchText(dlUrl, {
                headers: { "User-Agent": USER_AGENT2, "Referer": mirror, "X-Requested-With": "XMLHttpRequest" }
              });
              var mDl = dlText ? dlText.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/) : null;
              if (mDl)
                m3u8Url = mDl[0];
            } catch (e) {
            }
          }
          if (!m3u8Url) {
            var packed = html.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\s*\('[\s\S]+?',\s*\d+,\s*\d+,\s*'[\s\S]+?'\.split\('\|'\)/);
            if (packed) {
              var des = desempacar(packed[0]);
              if (des) {
                var mDes = des.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
                if (mDes)
                  m3u8Url = mDes[0];
              }
            }
          }
          if (!m3u8Url) {
            var fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
            if (fileMatch)
              m3u8Url = fileMatch[1];
          }
          if (!m3u8Url) {
            var bare = html.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/i);
            if (bare)
              m3u8Url = bare[0];
          }
          if (m3u8Url) {
            m3u8Url = m3u8Url.replace(/\\/g, "");
            if (m3u8Url.charAt(0) === "/")
              m3u8Url = origen + m3u8Url;
            return {
              url: m3u8Url,
              server: "StreamWish",
              quality: "1080p",
              headers: { "Referer": mirror, "Origin": origen, "User-Agent": USER_AGENT2 }
            };
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
    return null;
  });
}
function resolverVidhide(embedUrl, vencido) {
  return __async(this, null, function* () {
    try {
      var origin = partesDeUrl(embedUrl).origin;
      var html = yield fetchText(embedUrl, { headers: { "User-Agent": USER_AGENT2, "Referer": origin + "/" } });
      var finalUrl = null;
      var packedMatch = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
      if (packedMatch) {
        var des = desempacar(packedMatch[0]);
        if (des) {
          var hlsMatch = des.match(/"hls[24]"\s*:\s*"([^"]+)"/);
          if (hlsMatch)
            finalUrl = hlsMatch[1];
          if (!finalUrl) {
            var m3 = des.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/i);
            if (m3)
              finalUrl = m3[0];
          }
        }
      }
      if (!finalUrl) {
        var rawMatch = html.match(/"hls[24]"\s*:\s*"([^"]+)"/) || html.match(/file\s*:\s*["']([^"']+)["']/i) || html.match(/["'](https?:\/\/[^\s"']+?\/stream\/[^\s"']+?\.m3u8[^\s"']*)["']/i);
        if (rawMatch)
          finalUrl = rawMatch[1];
      }
      if (!finalUrl)
        return null;
      if (finalUrl.indexOf("http") !== 0)
        finalUrl = origin + finalUrl;
      return {
        url: finalUrl,
        server: "VidHide",
        quality: "1080p",
        headers: { "User-Agent": USER_AGENT2, "Referer": origin + "/", "Origin": origin, "X-Requested-With": "XMLHttpRequest" }
      };
    } catch (e) {
      return null;
    }
  });
}
function resolverVoe(embedUrl, vencido) {
  return __async(this, null, function* () {
    try {
      var html = yield fetchText(embedUrl, { headers: { "User-Agent": USER_AGENT2 } });
      if (html.indexOf("window.location.href") !== -1 && html.length < 2e3) {
        var rm = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
        if (rm) {
          try {
            var next = yield fetchText(rm[1], { headers: { "User-Agent": USER_AGENT2 } });
            if (next)
              html = next;
          } catch (e) {
          }
        }
      }
      var jsonMatch = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
      if (jsonMatch) {
        try {
          var parsed = JSON.parse(jsonMatch[1].trim());
          var encText = Array.isArray(parsed) ? parsed[0] : parsed;
          if (typeof encText === "string") {
            var decoded = encText.replace(/[a-zA-Z]/g, function(c) {
              var code = c.charCodeAt(0);
              var limit = c <= "Z" ? 90 : 122;
              var shifted = code + 13;
              return String.fromCharCode(limit >= shifted ? shifted : shifted - 26);
            });
            var ruido = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
            for (var i = 0; i < ruido.length; i++)
              decoded = decoded.split(ruido[i]).join("");
            var b64_1 = localAtob(decoded);
            if (b64_1) {
              var shifted2 = "";
              for (var j = 0; j < b64_1.length; j++)
                shifted2 += String.fromCharCode(b64_1.charCodeAt(j) - 3);
              var reversed = shifted2.split("").reverse().join("");
              var decrypted = localAtob(reversed);
              if (decrypted) {
                var data = JSON.parse(decrypted);
                if (data && data.source) {
                  return {
                    url: data.source,
                    server: "VOE",
                    quality: "1080p",
                    headers: { "User-Agent": USER_AGENT2, "Referer": embedUrl }
                  };
                }
              }
            }
          }
        } catch (e) {
        }
      }
      var m3 = html.match(/["'](https?:\/\/[^"']+?\.m3u8[^"']*?)["']/i);
      if (m3)
        return { url: m3[1], server: "VOE", quality: "1080p", headers: { "Referer": embedUrl, "User-Agent": USER_AGENT2 } };
    } catch (e) {
    }
    return null;
  });
}
function resolverVimeos(embedUrl, vencido) {
  return __async(this, null, function* () {
    try {
      var html = yield fetchText(embedUrl, {
        headers: {
          "User-Agent": USER_AGENT2,
          "Referer": "https://vimeos.net/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8"
        }
      });
      var vimeoIdMatch = html.match(/vimeo\.com\/video\/(\d+)/i);
      if (!vimeoIdMatch)
        vimeoIdMatch = String(embedUrl).match(/\/(\d{7,10})/);
      if (vimeoIdMatch && !vencido()) {
        var vimeoId = vimeoIdMatch[1];
        try {
          var config = yield fetchText("https://player.vimeo.com/video/" + vimeoId + "/config", {
            headers: { "User-Agent": USER_AGENT2, "Referer": embedUrl }
          });
          if (config) {
            var cfg = JSON.parse(config);
            var hlsUrl = null;
            if (cfg && cfg.request && cfg.request.files && cfg.request.files.hls && cfg.request.files.hls.cdns && cfg.request.files.hls.cdns.default) {
              hlsUrl = cfg.request.files.hls.cdns.default.url;
            }
            if (hlsUrl) {
              return {
                url: hlsUrl,
                server: "Vimeos",
                quality: "1080p",
                headers: { "User-Agent": USER_AGENT2, "Referer": "https://player.vimeo.com/", "Accept-Language": "es-MX,es;q=0.9" }
              };
            }
            var progressive = cfg && cfg.request && cfg.request.files ? cfg.request.files.progressive : null;
            if (progressive && progressive.length > 0) {
              progressive.sort(function(a, b) {
                return (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0);
              });
              var best = progressive[0];
              return {
                url: best.url,
                server: "Vimeos",
                quality: best.quality ? best.quality + "p" : "1080p",
                headers: { "User-Agent": USER_AGENT2, "Referer": "https://player.vimeo.com/", "Accept-Language": "es-MX,es;q=0.9" }
              };
            }
          }
        } catch (e) {
        }
      }
      var packMatch = html.match(/eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]+?\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/);
      if (packMatch) {
        var radix = parseInt(packMatch[2], 10);
        var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var symtab = packMatch[4].split("|");
        var unpacked = packMatch[1].replace(/\b(\w+)\b/g, function(match) {
          var idx = 0;
          for (var i = 0; i < match.length; i++)
            idx = idx * radix + chars.indexOf(match[i]);
          return symtab[idx] && symtab[idx] !== "" ? symtab[idx] : match;
        });
        var m3u8Match = unpacked.match(/["']([^"']+\.m3u8[^"']*)['"]/i);
        if (m3u8Match) {
          return {
            url: m3u8Match[1],
            server: "Vimeos",
            quality: "1080p",
            headers: { "User-Agent": USER_AGENT2, "Referer": "https://vimeos.net/", "Accept-Language": "es-MX,es;q=0.9" }
          };
        }
      }
    } catch (e) {
    }
    return null;
  });
}
var MIRRORS = {
  STREAMWISH: ["hlswish", "streamwish", "hglink", "hglamioz", "audinifer", "embedwish", "awish", "dwish", "strwish", "wishembed", "wishfast", "hanerix", "sfastwish", "jodwish", "swhoi", "swdyu", "playerwish", "filelions"],
  VIDHIDE: ["vidhide", "minochinos", "vadisov", "vaiditv", "amusemre", "callistanise", "vhaudm", "mdfury", "dintezuvio", "acek-cdn", "vedonm", "vidhidepro", "vidhidevip", "masukestin"],
  VOE: ["voe.sx", "voe-sx", "voex.sx", "marissashare", "cloudwindow"],
  VIMEOS: ["vimeos.net", "vimeos.cc", "vimeos.zip", "vms.sh"]
};
function esEspejo(url, grupo) {
  var u = String(url || "").toLowerCase();
  var lista = MIRRORS[grupo] || [];
  for (var i = 0; i < lista.length; i++) {
    if (u.indexOf(lista[i]) !== -1)
      return true;
  }
  return false;
}
function resolverEmbed(url, vencido) {
  return __async(this, null, function* () {
    try {
      if (esEspejo(url, "VIDHIDE"))
        return yield resolverVidhide(url, vencido);
      if (esEspejo(url, "STREAMWISH"))
        return yield resolverStreamwish(url, vencido);
      if (esEspejo(url, "VOE"))
        return yield resolverVoe(url, vencido);
      if (esEspejo(url, "VIMEOS"))
        return yield resolverVimeos(url, vencido);
    } catch (e) {
    }
    return null;
  });
}

// src/allpeliculasse/labels.js
var CALIDADES = [
  ["2160p", /(^|[^0-9])(2160|4k|uhd)([^0-9a-z]|$)/i],
  ["1440p", /(^|[^0-9])1440([^0-9]|$)/i],
  ["1080p", /(^|[^0-9])1080([^0-9]|$)/i],
  ["720p", /(^|[^0-9])720([^0-9]|$)/i],
  ["480p", /(^|[^0-9])480([^0-9]|$)/i],
  ["360p", /(^|[^0-9])360([^0-9]|$)/i]
];
function calidadDe(url, respaldo) {
  var t = String(url || "");
  for (var i = 0; i < CALIDADES.length; i++) {
    if (CALIDADES[i][1].test(t))
      return CALIDADES[i][0];
  }
  return respaldo || "HD";
}
var SERVIDORES = [
  ["Vimeos", /vimeos|vms\.sh/i],
  ["StreamWish", /streamwish|hlswish|hglink|embedwish|awish|strwish|wishfast|filelions/i],
  ["VidHide", /vidhide|vadisov|vaiditv|vhaudm|dintezuvio|vedonm|minochinos/i],
  ["VOE", /voe\.sx|voe-sx|voex|marissashare|cloudwindow/i],
  ["GoodStream", /goodstream|gs\.one/i]
];
function servidorDe(url, servidor) {
  var t = String(url || "") + " " + String(servidor || "");
  for (var i = 0; i < SERVIDORES.length; i++) {
    if (SERVIDORES[i][1].test(t))
      return SERVIDORES[i][0];
  }
  return String(servidor || "") || "Servidor";
}
function tituloStream(calidad, etiquetaIdioma, servidor) {
  return String(calidad || "HD") + " \xB7 " + String(etiquetaIdioma || "Lat") + " \xB7 " + String(servidor || "Servidor");
}

// src/allpeliculasse/index.js
var PRESUPUESTO_MS = 35e3;
function crearVencido(ms) {
  var t0 = Date.now();
  return function() {
    return Date.now() - t0 > ms;
  };
}
function normalizarTipo(mediaType) {
  var t = String(mediaType || "movie").toLowerCase();
  if (t === "series" || t === "anime" || t === "tv")
    return "tv";
  return "movie";
}
function etiquetaDeIdioma(langCrudo) {
  var s = String(langCrudo || "").toLowerCase();
  if (!s)
    return "Lat";
  if (/castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/.test(s))
    return "Esp";
  if (/latino|\blat\b|\blat\.|\[lat\]/.test(s))
    return "Lat";
  if (/subtitulad|\bvose\b|\bvosi\b|\bsub\b|\[sub\]/.test(s))
    return "Sub";
  if (/ingl|\beng\b|\bing\b|english/.test(s))
    return "Ing";
  return "Esp";
}
function etiquetaVisible(etiqueta) {
  return etiqueta === "Sub" ? "Sub" : "Lat";
}
var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;
function idiomaPermitido(titulo) {
  var t = String(titulo || "");
  if (RE_ESPANA.test(t))
    return false;
  return RE_LATINO.test(t) || RE_SUB.test(t);
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var vencido = crearVencido(PRESUPUESTO_MS);
    try {
      var tipo = normalizarTipo(mediaType);
      console.log("[AllpeliculasSE] ID " + tmdbId + " tipo " + tipo + " S:" + season + " E:" + episode);
      var info = yield datosTMDB(tmdbId, tipo);
      if (!info) {
        console.log("[AllpeliculasSE] Sin datos de TMDB.");
        return [];
      }
      var matched = null;
      var esperado = tipo === "tv" ? "tvshows" : "movies";
      for (var i = 0; i < info.titles.length; i++) {
        var consulta = consultaDe(info.titles[i]);
        if (!consulta)
          continue;
        var limpio = limpiarTitulo(info.titles[i]);
        var posts = yield buscarPosts(consulta, tipo);
        if (!posts.length)
          continue;
        for (var a = 0; a < posts.length; a++) {
          if (posts[a].type !== esperado)
            continue;
          var pt = limpiarTitulo(posts[a].title);
          if (pt.indexOf(limpio) !== -1 || limpio.indexOf(pt) !== -1) {
            matched = posts[a];
            break;
          }
        }
        if (matched)
          break;
        for (var b = 0; b < posts.length; b++) {
          if (posts[b].type === esperado) {
            matched = posts[b];
            break;
          }
        }
        if (matched)
          break;
      }
      if (!matched) {
        console.log("[AllpeliculasSE] Sin coincidencia en la b\xFAsqueda.");
        return [];
      }
      console.log('[AllpeliculasSE] Coincidencia: "' + matched.title + '" (ID ' + matched.id + ")");
      var objetivo = matched.id;
      if (tipo === "tv") {
        var epId = yield buscarCapitulo(matched.id, season, episode);
        if (!epId) {
          console.log("[AllpeliculasSE] Episodio S" + season + "E" + episode + " no encontrado.");
          return [];
        }
        objetivo = epId;
        console.log("[AllpeliculasSE] Episodio S" + season + "E" + episode + " -> post " + objetivo);
      }
      var embeds = yield embedsDe(objetivo);
      if (!embeds.length)
        return [];
      var streams = [];
      for (var e = 0; e < embeds.length; e++) {
        var embed = embeds[e] || {};
        var url = String(embed.url || "");
        var etiqueta = etiquetaDeIdioma(embed.lang);
        if (etiqueta === "Esp" || etiqueta === "Ing") {
          console.log("[AllpeliculasSE] Descartado por idioma (" + embed.lang + "): " + url);
          continue;
        }
        if (!/^https?:/i.test(url))
          continue;
        if (/^(magnet:)/i.test(url) || /\.torrent/i.test(url))
          continue;
        if (/sbcom|lvturbo|vanfem|fembed|1fichier|fireload/i.test(url))
          continue;
        if (vencido()) {
          console.log("[AllpeliculasSE] Presupuesto agotado, se corta con " + streams.length + " streams.");
          break;
        }
        var resuelto = yield resolverEmbed(url, vencido);
        if (!resuelto || !resuelto.url)
          continue;
        var calidad = resuelto.quality || calidadDe(resuelto.url, "1080p");
        var cabeceras = resuelto.headers || { "Referer": url, "User-Agent": "" };
        if (/vimeos\.|vms\.sh/i.test(resuelto.url))
          cabeceras = limpiarCabecerasVimeos(resuelto.url, cabeceras);
        streams.push({
          title: tituloStream(calidad, etiquetaVisible(etiqueta), servidorDe(resuelto.url, resuelto.server)),
          quality: calidad,
          language: etiqueta === "Sub" ? "Subtitulado" : "Latino",
          url: resuelto.url,
          headers: cabeceras
        });
      }
      console.log("[AllpeliculasSE] Streams resueltos: " + streams.length);
      var salida = [];
      for (var s = 0; s < streams.length; s++) {
        var st = streams[s];
        var texto = String(st.title || "") + " " + String(st.language || "");
        if (!idiomaPermitido(texto))
          continue;
        st.language = RE_SUB.test(texto) && !RE_LATINO.test(texto) ? "Subtitulado" : "Latino";
        salida.push(st);
      }
      return salida;
    } catch (e2) {
      console.log("[AllpeliculasSE] Error: " + (e2 && e2.message));
      return [];
    }
  });
}
module.exports = { getStreams };
