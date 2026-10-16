// compat.js — utilidades para correr en QuickJS (lo que el motor no trae).
// Portado a MasterScrap junto con pelis182; en latinuvio vivía en cada provider.
//
//   · parseUrl(x[, base]) -> mismo papel que `new URL(x[, base])`.
//   · execAll(texto, re)  -> mismo papel que `[...texto.matchAll(re)]`.

// Parseo de URL propio (QuickJS no tiene URL ni URLSearchParams).
function parseUrl(url, base) {
  var u = String(url === undefined || url === null ? "" : url);
  if (u.indexOf("//") === 0) u = "https:" + u;
  if (base && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) {
    var b = String(base).match(/^(https?:\/\/[^\/?#]+)([^?#]*)/i);
    if (b) u = u.charAt(0) === "/" ? b[1] + u : b[1] + b[2].replace(/[^\/]*$/, "") + u;
  }
  var m = u.match(/^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\/\/([^\/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#([\s\S]*))?/) || [];
  var protocol = m[1] ? m[1] + ":" : "";
  var host = m[2] || "";
  var pathname = m[3] || "";
  if (!pathname && host) pathname = "/";
  var search = m[4] === undefined ? "" : "?" + m[4];
  var hash = m[5] === undefined ? "" : "#" + m[5];
  var origin = host ? protocol + "//" + host : "";
  return {
    href: origin + pathname + search + hash,
    protocol: protocol,
    host: host,
    hostname: host.replace(/:\d+$/, ""),
    port: (host.match(/:(\d+)$/) || ["", ""])[1],
    origin: origin,
    pathname: pathname,
    search: search,
    hash: hash
  };
}

// Sustituto de String.prototype.matchAll (no existe en el motor).
function execAll(texto, re) {
  var salida = [], m = null, s = String(texto === undefined || texto === null ? "" : texto);
  var flags = "g";
  try { flags = re.flags.indexOf("g") === -1 ? re.flags + "g" : re.flags; } catch (e) { flags = "g"; }
  var rx = new RegExp(re.source, flags);
  while ((m = rx.exec(s)) !== null) {
    salida.push(m);
    if (m.index === rx.lastIndex) rx.lastIndex++;
    if (salida.length >= 500) break;
  }
  return salida;
}

module.exports = { parseUrl: parseUrl, execAll: execAll };
