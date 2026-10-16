/**
 * cinemitas - Built from src/cinemitas/
 * Generated: 2026-10-16T21:33:10.190Z
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

// src/cinemitas/util.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var CABECERAS_BASE = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};
function urlOrigen(url) {
  var m = String(url || "").match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : "";
}
function urlAbsoluta(rel, base) {
  var r = String(rel || "");
  if (/^https?:\/\//i.test(r))
    return r;
  if (r.indexOf("//") === 0)
    return "https:" + r;
  var origen = urlOrigen(base);
  if (!origen)
    return r;
  if (r.charAt(0) === "/")
    return origen + r;
  var dir = String(base || "").match(/^(https?:\/\/[^?#]*\/)/);
  return (dir ? dir[1] : origen + "/") + r;
}
function pedir(url, cabeceras, opciones) {
  var cab = {};
  var k;
  for (k in CABECERAS_BASE)
    cab[k] = CABECERAS_BASE[k];
  for (k in cabeceras || {})
    cab[k] = cabeceras[k];
  var req = { headers: cab, redirect: "follow" };
  var o = opciones || {};
  if (o.metodo)
    req.method = o.metodo;
  if (o.cuerpo !== void 0 && o.cuerpo !== null)
    req.body = o.cuerpo;
  if (typeof AbortController !== "undefined" && typeof setTimeout !== "undefined") {
    try {
      var control = new AbortController();
      setTimeout(function() {
        try {
          control.abort();
        } catch (e) {
        }
      }, o.timeout || 15e3);
      req.signal = control.signal;
    } catch (e) {
    }
  }
  return fetch(url, req);
}
function pedirTexto(url, cabeceras, opciones) {
  return pedir(url, cabeceras, opciones).then(function(res) {
    if (!res.ok)
      throw new Error("HTTP " + res.status + " para " + url);
    return res.text();
  });
}
function base64Decodificar(str) {
  try {
    if (typeof atob !== "undefined")
      return atob(String(str).replace(/-/g, "+").replace(/_/g, "/"));
  } catch (e) {
  }
  return null;
}
function desempacarBase36(texto) {
  var m = String(texto).match(/eval\(function\(p,a,c,k,e,[rd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
  if (!m)
    return null;
  try {
    let enBase36 = function(num, base) {
      var salida = "";
      while (num > 0) {
        salida = chars.charAt(num % base) + salida;
        num = Math.floor(num / base);
      }
      return salida || "0";
    };
    var payload = m[1];
    var radix = parseInt(m[2], 10);
    var symtab = m[4].split("|");
    var chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    return payload.replace(/\b\w+\b/g, function(token) {
      var idx = parseInt(token, 36);
      return idx < symtab.length && symtab[idx] ? symtab[idx] : enBase36(idx, radix);
    });
  } catch (e) {
    return null;
  }
}
function extraerM3u8(texto) {
  var m = String(texto || "").match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/i);
  return m ? m[0].replace(/\\u0026/g, "&").replace(/\\\//g, "/") : null;
}
function extraerHls(desempacado, host) {
  var obj = String(desempacado).match(/\{[^{}]*"hls[234]"\s*:\s*"([^"]+)"[^{}]*\}/);
  if (obj) {
    try {
      var normalizado = obj[0].replace(/(\w+)\s*:/g, '"$1":');
      var json = JSON.parse(normalizado);
      var url = json.hls4 || json.hls3 || json.hls2;
      if (url)
        return url.charAt(0) === "/" ? host + url : url;
    } catch (e) {
      var solo = obj[0].match(/"hls[234]"\s*:\s*"([^"]+\.m3u8[^"]*)"/);
      if (solo)
        return solo[1].charAt(0) === "/" ? host + solo[1] : solo[1];
    }
  }
  var largo = String(desempacado).match(/["']([^"']{30,}\.m3u8[^"']*)['"]/i);
  if (largo)
    return largo[1].charAt(0) === "/" ? host + largo[1] : largo[1];
  return null;
}

// src/cinemitas/resolvers.js
function desempacarScript(script) {
  var m = String(script).match(/\(([\s\S]+?),\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
  if (!m)
    return null;
  var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var radix = parseInt(m[2], 10);
  var symtab = m[4].split("|");
  function desbase(s) {
    var v = 0;
    var i, idx;
    for (i = 0; i < s.length; i++) {
      idx = chars.indexOf(s.charAt(i));
      if (idx === -1)
        return NaN;
      v = v * radix + idx;
    }
    return v;
  }
  return m[1].replace(/\b([0-9a-zA-Z]+)\b/g, function(token) {
    var idx = desbase(token);
    return !isNaN(idx) && idx < symtab.length && symtab[idx] && symtab[idx] !== "" ? symtab[idx] : token;
  });
}
function voeDecode(ct, luts) {
  try {
    var trozos = String(luts).replace(/^\[|\]$/g, "").split("','");
    var escapadas = [];
    var i;
    for (i = 0; i < trozos.length; i++) {
      escapadas.push(trozos[i].replace(/^'+|'+$/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
    var txt = "";
    for (i = 0; i < ct.length; i++) {
      var c = ct.charCodeAt(i);
      if (c > 64 && c < 91)
        c = (c - 52) % 26 + 65;
      else if (c > 96 && c < 123)
        c = (c - 84) % 26 + 97;
      txt += String.fromCharCode(c);
    }
    for (i = 0; i < escapadas.length; i++)
      txt = txt.replace(new RegExp(escapadas[i], "g"), "_");
    txt = txt.split("_").join("");
    var paso1 = base64Decodificar(txt);
    if (!paso1)
      return null;
    var paso2 = "";
    for (i = 0; i < paso1.length; i++)
      paso2 += String.fromCharCode((paso1.charCodeAt(i) - 3 + 256) % 256);
    var invertido = paso2.split("").reverse().join("");
    var finalStr = base64Decodificar(invertido);
    return finalStr ? JSON.parse(finalStr) : null;
  } catch (e) {
    console.log("[Cinemitas:VOE] voeDecode error: " + (e && e.message));
    return null;
  }
}
function resolverVoe(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log("[Cinemitas:VOE] Resolviendo: " + embedUrl);
      var res = yield pedirTexto(embedUrl, { Referer: embedUrl });
      if (/permanentToken/i.test(res)) {
        var redir = res.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (redir)
          res = yield pedirTexto(redir[1], { Referer: embedUrl });
      }
      var u = res.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
      if (u) {
        var cifrado = u[1];
        var loader = urlAbsoluta(u[2], embedUrl);
        var js = yield pedirTexto(loader, { Referer: embedUrl });
        var luts = js.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || js.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
        if (luts) {
          var dec = voeDecode(cifrado, luts[1]);
          if (dec && (dec.source || dec.direct_access_url)) {
            return { url: dec.source || dec.direct_access_url, server: "VOE", quality: "1080p", headers: { Referer: embedUrl } };
          }
        }
      }
      var re1 = /(?:mp4|hls)'\s*:\s*'([^']+)'/gi;
      var re2 = /(?:mp4|hls)"\s*:\s*"([^"]+)"/gi;
      var candidatos = [];
      var m;
      while ((m = re1.exec(res)) !== null)
        candidatos.push(m[1]);
      while ((m = re2.exec(res)) !== null)
        candidatos.push(m[1]);
      var i;
      for (i = 0; i < candidatos.length; i++) {
        if (!candidatos[i])
          continue;
        var url = candidatos[i];
        if (url.indexOf("aHR0") === 0)
          url = base64Decodificar(url) || url;
        return { url, server: "VOE", quality: "720p", headers: { Referer: embedUrl } };
      }
    } catch (e) {
      console.log("[Cinemitas:VOE] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverStreamwish(embedUrl) {
  return __async(this, null, function* () {
    try {
      var host = urlOrigen(embedUrl);
      console.log("[Cinemitas:StreamWish] Resolviendo: " + embedUrl);
      var res = yield pedirTexto(embedUrl, { Referer: "https://cinemitas.org/" });
      if (res.indexOf('id="root"') !== -1 && res.indexOf("__vite_is_modern_browser") !== -1) {
        console.log("[Cinemitas:StreamWish] Embed SPA (requiere navegador): " + embedUrl);
        return null;
      }
      var cab = { "User-Agent": UA, Referer: host + "/" };
      var file = res.match(/file\s*:\s*["']([^"']+)["']/i);
      if (file) {
        var urlF = file[1];
        if (urlF.charAt(0) === "/")
          urlF = host + urlF;
        return { url: urlF, server: "StreamWish", quality: "1080p", headers: cab };
      }
      var pack = res.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[^}]+\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
      if (pack) {
        var desempacado = desempacarScript(pack[0]);
        if (desempacado) {
          var hls = extraerHls(desempacado, host);
          if (hls)
            return { url: hls, server: "StreamWish", quality: "1080p", headers: cab };
          var directo = desempacado.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
          if (directo)
            return { url: directo[0], server: "StreamWish", quality: "1080p", headers: cab };
        }
      }
      var suelto = extraerM3u8(res);
      if (suelto)
        return { url: suelto, server: "StreamWish", quality: "1080p", headers: cab };
    } catch (e) {
      console.log("[Cinemitas:StreamWish] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverVidhide(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log("[Cinemitas:VidHide] Resolviendo: " + embedUrl);
      var res = yield pedirTexto(embedUrl, { Referer: "https://cinemitas.org/" });
      var bloque = res.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
      if (!bloque) {
        var m3 = extraerM3u8(res);
        if (m3)
          return { url: m3, server: "VidHide", quality: "720p", headers: { Referer: embedUrl } };
        return null;
      }
      var desempacado = desempacarBase36(bloque[0]);
      if (!desempacado)
        return null;
      var hls = desempacado.match(/"hls4"\s*:\s*"([^"]+)"/) || desempacado.match(/"hls2"\s*:\s*"([^"]+)"/);
      if (!hls)
        return null;
      var origen = urlOrigen(embedUrl);
      var url = hls[1];
      if (!/^http/i.test(url))
        url = origen + url;
      return { url, server: "VidHide", quality: "1080p", headers: { "User-Agent": UA, Referer: origen + "/", Origin: origen } };
    } catch (e) {
      console.log("[Cinemitas:VidHide] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverFilemoon(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log("[Cinemitas:FileMoon] Resolviendo: " + embedUrl);
      var res = yield pedirTexto(embedUrl, { Referer: "https://cinemitas.org/" });
      var bloque = res.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
      if (bloque) {
        var desempacado = desempacarBase36(bloque[0]);
        if (desempacado) {
          var m3 = desempacado.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
          if (m3)
            return { url: m3[0], server: "FileMoon", quality: "1080p", headers: { "User-Agent": UA, Referer: embedUrl } };
        }
      }
      var suelto = extraerM3u8(res);
      if (suelto)
        return { url: suelto, server: "FileMoon", quality: "720p", headers: { "User-Agent": UA, Referer: embedUrl } };
    } catch (e) {
      console.log("[Cinemitas:FileMoon] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverCvid(embedUrl) {
  return __async(this, null, function* () {
    try {
      var url = String(embedUrl).replace(/\/f\//, "/e/");
      console.log("[Cinemitas:Cvid] Resolviendo: " + url);
      var res = yield pedirTexto(url, { Referer: "https://cinemitas.org/" });
      var m3 = res.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (m3)
        return { url: m3[0], server: "Cvid", quality: "1080p", headers: { "User-Agent": UA, Referer: "https://cvid.lat/" } };
      var mp4 = res.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/i);
      if (mp4)
        return { url: mp4[0], server: "Cvid", quality: "1080p", headers: { "User-Agent": UA, Referer: "https://cvid.lat/" } };
    } catch (e) {
      console.log("[Cinemitas:Cvid] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverUqload(embedUrl) {
  return __async(this, null, function* () {
    try {
      var html = yield pedirTexto(embedUrl, { Referer: "https://cinemitas.org/" });
      if (!html)
        return null;
      var sm = html.match(/sources\s*:\s*\[([^\]]+)\]/);
      if (!sm) {
        var pm = html.match(/eval\s*\(\s*function\s*\(p,a,c,k,e,[dr]\)[\s\S]*?\.split\('\|'\)[^)]*\)\)/);
        if (pm) {
          var desempacado = desempacarScript(pm[0]);
          if (desempacado)
            sm = desempacado.match(/sources\s*:\s*\[([^\]]+)\]/);
        }
      }
      if (!sm)
        return null;
      var url = extraerM3u8(sm[1]) || (sm[1].match(/https?:\/\/[^\s"'<>]+/) || [])[0];
      if (!url || !/^http/.test(url))
        return null;
      var origen = urlOrigen(embedUrl) || "https://uqload.com";
      return { url, server: "Uqload", quality: "1080p", headers: { Referer: origen + "/", "User-Agent": UA } };
    } catch (e) {
      console.log("[Cinemitas:Uqload] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverGoodstream(embedUrl) {
  return __async(this, null, function* () {
    try {
      var html = yield pedirTexto(embedUrl, { Referer: "https://cinemitas.org/" });
      if (!html)
        return null;
      var fm = html.match(/file\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/i);
      if (fm)
        return { url: fm[1], server: "GoodStream", quality: "1080p", headers: { Referer: "https://goodstream.one/", Origin: "https://goodstream.one", "User-Agent": UA } };
      var m3 = extraerM3u8(html);
      return m3 ? { url: m3, server: "GoodStream", quality: "1080p", headers: { Referer: "https://goodstream.one/", "User-Agent": UA } } : null;
    } catch (e) {
      console.log("[Cinemitas:GoodStream] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverVimeos(embedUrl) {
  return __async(this, null, function* () {
    try {
      var html = yield pedirTexto(embedUrl, { Referer: "https://cinemitas.org/" });
      if (!html)
        return null;
      var pm = html.match(/eval\s*\(\s*function\s*\(p,a,c,k,e,[dr]\)[\s\S]*?\.split\('\|'\)[^)]*\)\)/);
      if (pm) {
        var desempacado = desempacarScript(pm[0]);
        if (desempacado) {
          var url = extraerM3u8(desempacado);
          if (url)
            return { url, server: "Vimeos", quality: "1080p", headers: { Referer: "https://vimeos.net/", Origin: "https://vimeos.net", "User-Agent": UA } };
        }
      }
      var m3 = extraerM3u8(html);
      return m3 ? { url: m3, server: "Vimeos", quality: "1080p", headers: { Referer: "https://vimeos.net/", "User-Agent": UA } } : null;
    } catch (e) {
      console.log("[Cinemitas:Vimeos] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverAudinifer(embedUrl) {
  return __async(this, null, function* () {
    try {
      var html = yield pedirTexto(embedUrl, { Referer: "https://cinemitas.org/" });
      if (!html)
        return null;
      var pm = html.match(/eval\s*\(\s*function\s*\(p,a,c,k,e,[dr]\)[\s\S]*?\.split\('\|'\)[^)]*\)\)/);
      if (pm) {
        var desempacado = desempacarScript(pm[0]);
        if (desempacado) {
          var m3u8 = extraerM3u8(desempacado);
          if (m3u8)
            return { url: m3u8, server: "Audinifer", quality: "1080p", headers: { Referer: embedUrl, "User-Agent": UA } };
          var f = desempacado.match(/(?:file|src)\s*[:=]\s*["']([^"']+)["']/i);
          if (f && f[1] && /^http/.test(f[1]))
            return { url: f[1], server: "Audinifer", quality: "1080p", headers: { Referer: embedUrl, "User-Agent": UA } };
        }
      }
      var m3 = extraerM3u8(html);
      return m3 ? { url: m3, server: "Audinifer", quality: "1080p", headers: { Referer: embedUrl, "User-Agent": UA } } : null;
    } catch (e) {
      console.log("[Cinemitas:Audinifer] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverVidara(embedUrl) {
  return __async(this, null, function* () {
    try {
      var id = (String(embedUrl).match(/\/e\/([^/]+)/i) || [])[1] || (String(embedUrl).match(/\/player\/([^/]+)/i) || [])[1];
      if (!id)
        return null;
      var res = yield pedir("https://vidara.so/api/stream", {
        "User-Agent": UA,
        Referer: embedUrl,
        Origin: urlOrigen(embedUrl),
        Accept: "application/json",
        "Content-Type": "application/json"
      }, { metodo: "POST", cuerpo: JSON.stringify({ filecode: id }) });
      if (!res.ok)
        return null;
      var j = JSON.parse(yield res.text());
      var f = j.streaming_url || j.file || j.url || j.source || j.data && (j.data.streaming_url || j.data.url || j.data.file);
      if (f && /^http/.test(f))
        return { url: f, server: "Vidara", quality: "1080p", headers: { Referer: embedUrl, "User-Agent": UA } };
    } catch (e) {
      console.log("[Cinemitas:Vidara] Error: " + (e && e.message));
    }
    return null;
  });
}
function resolverEmbed(embedUrl) {
  var u = String(embedUrl || "").toLowerCase();
  if (u.indexOf("voe.sx") !== -1 || u.indexOf("/voe/") !== -1)
    return resolverVoe(embedUrl);
  if (u.indexOf("wish") !== -1 || u.indexOf("vibuxer") !== -1 || u.indexOf("hglink") !== -1 || u.indexOf("hanerix") !== -1)
    return resolverStreamwish(embedUrl);
  if (u.indexOf("vidhide") !== -1 || u.indexOf("ds2play") !== -1 || u.indexOf("do7go") !== -1 || u.indexOf("dintezuvio") !== -1)
    return resolverVidhide(embedUrl);
  if (u.indexOf("filemoon") !== -1 || u.indexOf("fmoon") !== -1)
    return resolverFilemoon(embedUrl);
  if (u.indexOf("cvid.lat") !== -1)
    return resolverCvid(embedUrl);
  if (u.indexOf("uqload") !== -1)
    return resolverUqload(embedUrl);
  if (u.indexOf("goodstream") !== -1)
    return resolverGoodstream(embedUrl);
  if (u.indexOf("vimeos") !== -1)
    return resolverVimeos(embedUrl);
  if (u.indexOf("audinifer") !== -1)
    return resolverAudinifer(embedUrl);
  if (u.indexOf("vidara") !== -1)
    return resolverVidara(embedUrl);
  console.log("[Cinemitas] Sin resolver para: " + embedUrl);
  return Promise.resolve(null);
}

// src/cinemitas/filtro.js
var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;
function idiomaPermitido(titulo) {
  var t = String(titulo || "");
  if (RE_ESPANA.test(t))
    return false;
  return RE_LATINO.test(t) || RE_SUB.test(t);
}
function clasificarEtiqueta(etiqueta) {
  var t = String(etiqueta || "").toLowerCase();
  if (RE_LATINO.test(t))
    return "Latino";
  if (RE_SUB.test(t))
    return "Subtitulado";
  return "";
}
var RE_HOST_EMBED = /(voe\.sx|voe\.|streamwish|strwish|hlswish|awish|wishfast|embedwish|hanerix|filemoon|moonembed|bysesukior|bysesukop|vidhide|minochinos|dintezuvio|morencius|movearnpre|luluvdo|uqload|doodstream|dood\.|ds2play|mixdrop|streamtape|waaw|goodstream|vimeos|fastream|mp4upload|ok\.ru|okcdn|odnoklassniki|embed69|dramiyos|premilkyway|vidmoly|supervideo|streamlare|vibuxer|hglink|dhcplay|filelions|vidnest|dropcdn|barmonrey|rpmvid|vidsrc|playmogo|embedseek|tplayer|vidsonic|vidsuper|primeload|fkplayer|embedshortener|paulinito|zilla-networks|acek-cdn|cloudwindow-route|mega\.nz|mega\.co\.nz)/i;
var RE_EXT_DIRECTA = /\.(m3u8|mp4|ts|mkv|webm|m4v|mov)(\?|#|$)/i;
var RE_RUTA_MEDIO = /(\/m3u8\/|\/hls\/|\/hls2\/|master\.m3u8|playlist\.m3u8|video\.m3u8|\.urlset\/|\/manifest)/i;
function esReproducible(url) {
  var u = String(url || "");
  if (!/^https?:\/\//i.test(u))
    return false;
  if (RE_EXT_DIRECTA.test(u) || RE_RUTA_MEDIO.test(u))
    return true;
  return !RE_HOST_EMBED.test(u);
}
function filtrarStreams(streams) {
  var salida = [];
  var vistos = {};
  var lista = streams || [];
  var i;
  for (i = 0; i < lista.length; i++) {
    var s = lista[i];
    if (!s || !s.url)
      continue;
    var etiqueta = String(s.title || "") + " " + String(s.language || "");
    if (!idiomaPermitido(etiqueta))
      continue;
    if (!esReproducible(s.url))
      continue;
    if (vistos[s.url])
      continue;
    vistos[s.url] = 1;
    var idioma = RE_SUB.test(etiqueta) && !RE_LATINO.test(etiqueta) ? "Subtitulado" : "Latino";
    var calidad = String(s.quality || "HD");
    var servidor = String(s.server || "Online");
    salida.push({
      title: calidad + " \xB7 " + idioma + " \xB7 " + servidor,
      quality: calidad,
      language: idioma,
      url: s.url,
      headers: s.headers || {}
    });
  }
  return salida;
}

// src/cinemitas/extractor.js
var SITIO = "https://cinemitas.org";
var AJAX = SITIO + "/wp-admin/admin-ajax.php";
var ACCENT_MAP = {
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
  "\xFD": "y",
  "\xDF": "ss"
};
function quitarAcentos(texto) {
  return String(texto || "").toLowerCase().replace(/[^\x00-\x7F]/g, function(c) {
    return ACCENT_MAP[c] || "";
  });
}
function slugify(titulo) {
  return quitarAcentos(titulo).replace(/&/g, "y").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function getTmdbTitles(tmdbId, tipo) {
  return __async(this, null, function* () {
    var reel = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
    var datos = yield Promise.all(["es-ES", "es-MX", "en-US"].map(function(idioma) {
      return fetch("https://api.themoviedb.org/3/" + tipo + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=" + idioma).then(function(r) {
        return r.json();
      }).catch(function(e) {
        console.error("[Cinemitas] TMDB " + idioma + ": " + (e && e.message));
        return null;
      });
    }));
    var res = datos[0] || {};
    var titleEs = tipo === "movie" ? res.title : res.name;
    var titleOriginal = tipo === "movie" ? res.original_title : res.original_name;
    var year = null;
    var fecha = tipo === "movie" ? res.release_date : res.first_air_date;
    if (fecha)
      year = String(fecha).split("-")[0];
    var resMx = datos[1] || {};
    var t = tipo === "movie" ? resMx.title : resMx.name;
    if (t && !reel.test(t))
      titleEs = titleEs || t;
    var resEn = datos[2] || {};
    var titleEn = tipo === "movie" ? resEn.title : resEn.name;
    return { titleEs, titleOriginal, titleEn, year };
  });
}
function dooBuscar(query, mediaType) {
  if (!query)
    return Promise.resolve(null);
  var postType = mediaType === "movie" ? "movie" : "tvshows";
  var ruta = mediaType === "movie" ? "movies" : "tvshows";
  var url = SITIO + "/?dooplay=search&post_type=" + postType + "&s=" + encodeURIComponent(query);
  return pedir(url, { "User-Agent": UA, Accept: "text/html" }).then(function(res) {
    return res.ok ? res.text() : null;
  }).then(function(html) {
    if (!html)
      return null;
    var re = new RegExp('href="' + SITIO.replace(/\./g, "\\.") + "/" + ruta + '/[a-z0-9-]+/"', "i");
    var m = html.match(re);
    if (!m)
      return null;
    return m[0].slice(6, m[0].length - 1);
  }).catch(function() {
    return null;
  });
}
function candidatosSlug(info) {
  var lista = [];
  var vistos = {};
  function meter(titulo) {
    if (!titulo)
      return;
    var base = slugify(titulo);
    if (base && !vistos[base]) {
      vistos[base] = 1;
      lista.push(base);
    }
    if (base && info.year) {
      var conAnio = base + "-" + info.year;
      if (!vistos[conAnio]) {
        vistos[conAnio] = 1;
        lista.push(conAnio);
      }
    }
  }
  meter(info.titleEs);
  meter(info.titleOriginal);
  meter(info.titleEn);
  return lista;
}
function encontrarPagina(info, mediaType) {
  return __async(this, null, function* () {
    var ruta = mediaType === "movie" ? "movies" : "tvshows";
    var candidatos = candidatosSlug(info);
    var i;
    for (i = 0; i < candidatos.length; i++) {
      var url = SITIO + "/" + ruta + "/" + candidatos[i] + "/";
      try {
        var res = yield pedir(url, { "User-Agent": UA });
        if (res.status === 200) {
          console.log("[Cinemitas] Ficha encontrada por slug: " + url);
          return { url, html: yield res.text() };
        }
      } catch (e) {
        console.log("[Cinemitas] Fallo el slug " + url + ": " + (e && e.message));
      }
    }
    console.log("[Cinemitas] Slugs agotados, probando la busqueda del sitio");
    var busquedas = [info.titleEs, info.titleOriginal, info.titleEn];
    for (i = 0; i < busquedas.length; i++) {
      var encontrada = yield dooBuscar(busquedas[i], mediaType);
      if (!encontrada)
        continue;
      try {
        var resB = yield pedir(encontrada, { "User-Agent": UA });
        if (resB.status === 200) {
          console.log("[Cinemitas] Ficha encontrada por busqueda: " + encontrada);
          return { url: encontrada, html: yield resB.text() };
        }
      } catch (e2) {
        console.log("[Cinemitas] Fallo la ficha " + encontrada + ": " + (e2 && e2.message));
      }
    }
    return null;
  });
}
function encontrarEpisodio(pagina, season, episode) {
  return __async(this, null, function* () {
    var m = pagina.url.match(/\/tvshows\/([^\/]+)\/?/);
    var slug = m ? m[1] : null;
    if (!slug) {
      console.log("[Cinemitas] No se pudo sacar el slug de la serie");
      return null;
    }
    var prevista = SITIO + "/episodes/" + slug + "-" + season + "x" + episode + "/";
    console.log("[Cinemitas] Probando episodio: " + prevista);
    try {
      var res = yield pedir(prevista, { "User-Agent": UA });
      if (res.status === 200)
        return { url: prevista, html: yield res.text() };
    } catch (e) {
      console.log("[Cinemitas] Fallo el episodio previsto: " + (e && e.message));
    }
    var re = /href="([^"]*\/episodes\/[^"]*?-(\d+)x(\d+)\/?)"/gi;
    var m2;
    while ((m2 = re.exec(pagina.html)) !== null) {
      if (parseInt(m2[2], 10) !== parseInt(season, 10) || parseInt(m2[3], 10) !== parseInt(episode, 10))
        continue;
      var url = urlAbsoluta(m2[1], SITIO);
      try {
        var res2 = yield pedir(url, { "User-Agent": UA });
        if (res2.status === 200) {
          console.log("[Cinemitas] Episodio encontrado en la ficha: " + url);
          return { url, html: yield res2.text() };
        }
      } catch (e2) {
      }
    }
    console.log("[Cinemitas] Episodio S" + season + "E" + episode + " no encontrado");
    return null;
  });
}
function atributo(tag, nombre) {
  var m = tag.match(new RegExp(nombre + `\\s*=\\s*['"]([^'"]*)['"]`, "i"));
  return m ? m[1] : null;
}
function extraerOpciones(html) {
  var opciones = [];
  var re = /<li[^>]*dooplay_player_option[^>]*>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var tag = m[0];
    var post = atributo(tag, "data-post");
    var nume = atributo(tag, "data-nume");
    var tipo = atributo(tag, "data-type");
    if (!post || !nume || !tipo)
      continue;
    var resto = html.slice(m.index + tag.length, m.index + tag.length + 600);
    var span = resto.match(/<span[^>]*class=['"]title['"][^>]*>([^<]*)<\/span>/i);
    var texto = "";
    if (span)
      texto = span[1];
    else
      texto = resto.split("</li>")[0].replace(/<[^>]*>/g, " ");
    texto = texto.replace(/\s+/g, " ").trim();
    opciones.push({ post, nume, tipo, lang: texto });
  }
  return opciones;
}
function resolverOpciones(pagina) {
  return __async(this, null, function* () {
    var opciones = extraerOpciones(pagina.html);
    console.log("[Cinemitas] Opciones del reproductor: " + opciones.length);
    var streams = [];
    var latinos = 0;
    var subs = 0;
    var i;
    for (i = 0; i < opciones.length; i++) {
      var op = opciones[i];
      var idioma = clasificarEtiqueta(op.lang);
      if (!idioma) {
        console.log("[Cinemitas] Opcion descartada (" + op.lang + "): no es latino ni subtitulado");
        continue;
      }
      try {
        var cuerpo = "action=doo_player_ajax&post=" + encodeURIComponent(op.post) + "&nume=" + encodeURIComponent(op.nume) + "&type=" + encodeURIComponent(op.tipo);
        var res = yield pedir(AJAX, {
          "User-Agent": UA,
          Referer: pagina.url,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded"
        }, { metodo: "POST", cuerpo });
        if (!res.ok)
          continue;
        var data = JSON.parse(yield res.text());
        if (!data || !data.embed_url)
          continue;
        var embedUrl = String(data.embed_url);
        if (embedUrl.charAt(0) === "<") {
          var src = embedUrl.match(/src=["']([^"']+)["']/);
          if (!src)
            continue;
          embedUrl = src[1];
        }
        if (/bysezoxexe\.com/i.test(embedUrl)) {
          console.log("[Cinemitas] Opcion descartada (Bysezoxexe es SPA): " + embedUrl);
          continue;
        }
        console.log("[Cinemitas] Opcion " + op.nume + " (" + idioma + "): " + embedUrl);
        var resuelto = yield resolverEmbed(embedUrl);
        if (resuelto && resuelto.url) {
          var calidad = resuelto.quality || "1080p";
          var servidor = resuelto.server || "Online";
          streams.push({
            server: servidor,
            quality: calidad,
            language: idioma,
            title: calidad + " \xB7 " + idioma + " \xB7 " + servidor,
            url: resuelto.url,
            headers: resuelto.headers || {}
          });
          if (idioma === "Latino")
            latinos++;
          else if (idioma === "Subtitulado")
            subs++;
        } else {
          console.log("[Cinemitas] Embed sin resolver (" + idioma + "): " + embedUrl);
        }
      } catch (e) {
        console.log("[Cinemitas] Error en la opcion " + op.nume + ": " + (e && e.message));
      }
      if (latinos > 0 && subs > 0) {
        console.log("[Cinemitas] Suficiente (1 Latino + 1 Sub): se omiten las opciones restantes");
        break;
      }
    }
    return comprobarVivos(streams);
  });
}
var RE_MEDIA_PROBABLE = /\.m3u8(\?|$)|\.mp4(\?|$)|\.mpd(\?|$)|\/hls2?\/|\/master\.m3u8/;
function comprobarVivos(streams) {
  return __async(this, null, function* () {
    var salida = [];
    var i;
    for (i = 0; i < streams.length; i++) {
      var s = streams[i];
      if (!s.url || !RE_MEDIA_PROBABLE.test(s.url)) {
        if (s.url)
          salida.push(s);
        continue;
      }
      var ok = false;
      var status = 0;
      try {
        var cab = Object.assign({ "User-Agent": UA, Range: "bytes=0-0" }, s.headers || {});
        var res = yield fetch(s.url, { method: "GET", headers: cab, redirect: "follow" });
        status = res.status;
        ok = res.ok || res.status === 206;
      } catch (e) {
      }
      if (ok && status >= 200 && status < 400)
        salida.push(s);
      else
        console.log("[Cinemitas] Enlace descartado (" + status + "): " + String(s.url).slice(0, 70));
    }
    console.log("[Cinemitas] Enlaces vivos: " + salida.length + " de " + streams.length);
    return salida;
  });
}
function extraerStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType) {
      console.error("[Cinemitas] Falta tmdbId o mediaType");
      return [];
    }
    console.log("[Cinemitas] Resolviendo TMDB " + tmdbId + " (" + mediaType + ")" + (mediaType !== "movie" ? " S" + season + "E" + episode : ""));
    var info = yield getTmdbTitles(tmdbId, mediaType);
    if (!info.titleEs && !info.titleOriginal && !info.titleEn) {
      console.log("[Cinemitas] TMDB no devolvio titulos");
      return [];
    }
    var pagina = yield encontrarPagina(info, mediaType);
    if (!pagina) {
      console.log("[Cinemitas] Sin ficha para " + tmdbId);
      return [];
    }
    if (mediaType !== "movie") {
      pagina = yield encontrarEpisodio(pagina, season, episode);
      if (!pagina)
        return [];
    }
    return resolverOpciones(pagina);
  });
}

// src/cinemitas/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  var tipo = mediaType === "series" || mediaType === "anime" ? "tv" : mediaType || "movie";
  return Promise.resolve().then(function() {
    return extraerStreams(tmdbId, tipo, season, episode);
  }).then(function(streams) {
    return filtrarStreams(streams);
  }).catch(function(e) {
    console.error("[Cinemitas] Error: " + (e && e.message));
    return [];
  });
}
module.exports = { getStreams };
