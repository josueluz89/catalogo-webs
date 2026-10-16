// labels.js — parte útil de `stream_labels.js` del provider original, portada a QuickJS.
//
// El original cargaba `./stream_labels.js` con un require() dentro de try/catch para obtener
// buildStreamLabel(), pero NINGUNO de los tres providers llegaba a llamarla (era código muerto).
// Lo que sí se aprovecha aquí es el reconocimiento de calidad y de servidor que hacía esa librería,
// reescrito sin dependencias.
//
// A propósito NO se porta parseLanguage() de stream_labels.js: esa función no reconoce la
// abreviatura real que usan los sitios ("Esp") porque busca /castellano|español|spanish|espa/,
// y al no coincidir devolvía "Latino" por defecto. Portarla habría etiquetado castellano como
// latino, justo lo contrario de lo que exige el filtro.

var CALIDADES = [
  ['2160p', /(^|[^0-9])(2160|4k|uhd)([^0-9a-z]|$)/i],
  ['1440p', /(^|[^0-9])1440([^0-9]|$)/i],
  ['1080p', /(^|[^0-9])1080([^0-9]|$)/i],
  ['720p', /(^|[^0-9])720([^0-9]|$)/i],
  ['480p', /(^|[^0-9])480([^0-9]|$)/i],
  ['360p', /(^|[^0-9])360([^0-9]|$)/i]
];

// Calidad deducida de la URL/marca del servidor; si no dice nada, el respaldo del resolvedor.
// Los números van con límite de dígitos a propósito: en la URL del CDN de VOE aparece "e=14400"
// y sin ese límite se etiquetaba como 1440p un stream que es 1080p.
export function calidadDe(url, respaldo) {
  var t = String(url || '');
  for (var i = 0; i < CALIDADES.length; i++) {
    if (CALIDADES[i][1].test(t)) return CALIDADES[i][0];
  }
  return respaldo || 'HD';
}

var SERVIDORES = [
  ['Vimeos', /vimeos|vms\.sh/i],
  ['StreamWish', /streamwish|hlswish|hglink|embedwish|awish|strwish|wishfast|filelions/i],
  ['VidHide', /vidhide|vadisov|vaiditv|vhaudm|dintezuvio|vedonm|minochinos/i],
  ['VOE', /voe\.sx|voe-sx|voex|marissashare|cloudwindow/i],
  ['GoodStream', /goodstream|gs\.one/i]
];

// Nombre de servidor normalizado (el original mostraba "vimeos" / "voe.sx" tal cual).
export function servidorDe(url, servidor) {
  var t = String(url || '') + ' ' + String(servidor || '');
  for (var i = 0; i < SERVIDORES.length; i++) {
    if (SERVIDORES[i][1].test(t)) return SERVIDORES[i][0];
  }
  return String(servidor || '') || 'Servidor';
}

// Título del stream, mismo formato que el original: "<calidad> · <idioma> · <servidor>".
export function tituloStream(calidad, etiquetaIdioma, servidor) {
  return String(calidad || 'HD') + ' · ' + String(etiquetaIdioma || 'Lat') + ' · ' + String(servidor || 'Servidor');
}
