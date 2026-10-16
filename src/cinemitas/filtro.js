// Filtro de idioma y de "reproducibilidad" propio de cinemitas.
// Regla del usuario: SOLO español latino y subtitulado. Aquí importa de verdad:
// el catálogo de cinemitas trae CASTELLANO en las mismas fichas.

var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;

function idiomaPermitido(titulo) {
  var t = String(titulo || '');
  if (RE_ESPANA.test(t)) return false;
  return RE_LATINO.test(t) || RE_SUB.test(t);
}

// Etiqueta de idioma de una opcion del reproductor (LATINO HD, CASTELLANO,
// SUBTITULADO...): '' significa "no lo se" y por tanto se descarta.
function clasificarEtiqueta(etiqueta) {
  var t = String(etiqueta || '').toLowerCase();
  if (RE_LATINO.test(t)) return 'Latino';
  if (RE_SUB.test(t)) return 'Subtitulado';
  return '';
}

var RE_HOST_EMBED = /(voe\.sx|voe\.|streamwish|strwish|hlswish|awish|wishfast|embedwish|hanerix|filemoon|moonembed|bysesukior|bysesukop|vidhide|minochinos|dintezuvio|morencius|movearnpre|luluvdo|uqload|doodstream|dood\.|ds2play|mixdrop|streamtape|waaw|goodstream|vimeos|fastream|mp4upload|ok\.ru|okcdn|odnoklassniki|embed69|dramiyos|premilkyway|vidmoly|supervideo|streamlare|vibuxer|hglink|dhcplay|filelions|vidnest|dropcdn|barmonrey|rpmvid|vidsrc|playmogo|embedseek|tplayer|vidsonic|vidsuper|primeload|fkplayer|embedshortener|paulinito|zilla-networks|acek-cdn|cloudwindow-route|mega\.nz|mega\.co\.nz)/i;
var RE_EXT_DIRECTA = /\.(m3u8|mp4|ts|mkv|webm|m4v|mov)(\?|#|$)/i;
var RE_RUTA_MEDIO = /(\/m3u8\/|\/hls\/|\/hls2\/|master\.m3u8|playlist\.m3u8|video\.m3u8|\.urlset\/|\/manifest)/i;

function esReproducible(url) {
  var u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return false;
  if (RE_EXT_DIRECTA.test(u) || RE_RUTA_MEDIO.test(u)) return true;
  return !RE_HOST_EMBED.test(u);
}

function arreglarCabeceras(stream) {
  if (!stream || !stream.url) return stream;
  var u = String(stream.url).toLowerCase();
  if (/vimeos\.|vms\.sh/.test(u)) {
    var h = {};
    var k;
    for (k in (stream.headers || {})) {
      if (!/^(referer|origin)$/i.test(k)) h[k] = stream.headers[k];
    }
    stream.headers = h;
  } else if (/mp4upload\.com/.test(u)) {
    stream.headers = Object.assign({}, stream.headers || {}, { Referer: stream.url });
  }
  return stream;
}

// Filtro final sobre TODOS los streams: idioma + medio + sin duplicados.
// La salida va normalizada: "<calidad> · <Latino|Subtitulado> · <servidor>".
function filtrarStreams(streams) {
  var salida = [];
  var vistos = {};
  var lista = streams || [];
  var i;
  for (i = 0; i < lista.length; i++) {
    var s = lista[i];
    if (!s || !s.url) continue;
    var etiqueta = String(s.title || '') + ' ' + String(s.language || '');
    if (!idiomaPermitido(etiqueta)) continue;
    if (!esReproducible(s.url)) continue;
    if (vistos[s.url]) continue;
    vistos[s.url] = 1;
    var idioma = (RE_SUB.test(etiqueta) && !RE_LATINO.test(etiqueta)) ? 'Subtitulado' : 'Latino';
    var calidad = String(s.quality || 'HD');
    var servidor = String(s.server || 'Online');
    salida.push({
      title: calidad + ' \u00b7 ' + idioma + ' \u00b7 ' + servidor,
      quality: calidad,
      language: idioma,
      url: s.url,
      headers: s.headers || {}
    });
  }
  return salida;
}

export { RE_LATINO, RE_SUB, RE_ESPANA, idiomaPermitido, clasificarEtiqueta, esReproducible, arreglarCabeceras, filtrarStreams };
