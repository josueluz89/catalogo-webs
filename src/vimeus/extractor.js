// Extractor de vimeus.com: pide la pagina /e/movie|serie|anime?tmdb=...&view_key=...
// y lee el JSON embebido (<script type="text/json" id="data">) con la lista de
// embeds; cada embed se resuelve a un m3u8/mp4 directo.

import { UA } from './util.js';
import { resolverVideo } from './resolvers.js';
import { arreglarCabeceras } from './filtro.js';

var VIEW_KEY = 'ttapaNFkp2YbIFMawxmnqCPcs0pRVzbjrI5r1-da5M4';

// Nombre legible del servidor a partir de la URL del embed.
function nombreServidor(url) {
  if (!url) return 'Unknown';
  if (url.indexOf('ok.ru') !== -1) return 'Ok.ru';
  if (url.indexOf('filemoon') !== -1) return 'FileMoon';
  if (url.indexOf('voe.sx') !== -1 || url.indexOf('voe') !== -1) return 'VOE';
  if (url.indexOf('streamtape.com') !== -1) return 'StreamTape';
  if (url.indexOf('streamwish') !== -1 || url.indexOf('sfastwish') !== -1 || url.indexOf('hlswish') !== -1) return 'StreamWish';
  if (url.indexOf('vidhide') !== -1 || url.indexOf('vidhidepre') !== -1) return 'VidHide';
  if (url.indexOf('mixdrop') !== -1 || url.indexOf('mxdrop') !== -1) return 'MixDrop';
  if (url.indexOf('ds2play.com') !== -1 || url.indexOf('ds2play') !== -1) return 'DS2Play';
  if (url.indexOf('do7go.com') !== -1 || url.indexOf('do7go') !== -1) return 'Do7Go';
  if (url.indexOf('flaswish.com') !== -1 || url.indexOf('flaswish') !== -1) return 'FlasWish';
  if (url.indexOf('vimeos.net') !== -1) return 'Vimeos';
  if (url.indexOf('goodstream.one') !== -1) return 'GoodStream';
  return 'Unknown';
}

var RE_DATA = /<script\s+type=["']text\/json["']\s+id=["']data["']>\s*(\{[\s\S]*?\})\s*<\/script>/i;

function extraerStreams(tmdbId, mediaType, season, episode) {
  var url = mediaType === 'movie'
    ? 'https://vimeus.com/e/movie?tmdb=' + tmdbId + '&view_key=' + VIEW_KEY
    : 'https://vimeus.com/e/serie?tmdb=' + tmdbId + '&se=' + season + '&ep=' + episode + '&view_key=' + VIEW_KEY;
  console.log('[Vimeus] Pidiendo embed: ' + url);

  var cabeceras = { 'User-Agent': UA, Referer: 'https://vimeus.com/' };

  return fetch(url, { headers: cabeceras })
    .then(function (resp) {
      if (!resp.ok) {
        console.log('[Vimeus] HTTP ' + resp.status);
        return null;
      }
      return resp.text();
    })
    .then(function (html) {
      if (html === null) return [];
      var m = html.match(RE_DATA);
      if (m) return procesarJson(m[1]);

      // Algunas series solo salen por la ruta de anime.
      if (mediaType === 'movie') {
        console.log('[Vimeus] Sin bloque de datos en el HTML');
        return [];
      }
      var urlAnime = 'https://vimeus.com/e/anime?tmdb=' + tmdbId + '&se=' + season + '&ep=' + episode + '&view_key=' + VIEW_KEY;
      console.log('[Vimeus] Reintentando por anime: ' + urlAnime);
      return fetch(urlAnime, { headers: cabeceras })
        .then(function (r2) {
          if (!r2.ok) return [];
          return r2.text();
        })
        .then(function (html2) {
          var m2 = html2.match(RE_DATA);
          return m2 ? procesarJson(m2[1]) : [];
        });
    })
    .catch(function (e) {
      console.error('[Vimeus] Error de extraccion: ' + (e && e.message));
      return [];
    });
}

// Recorre los embeds del JSON y resuelve cada uno. El idioma que declara el
// sitio viaja en embed.lang (Latino / Castellano / Subtitulado...).
function procesarJson(dataStr) {
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (e) {
    console.error('[Vimeus] JSON invalido: ' + (e && e.message));
    return Promise.resolve([]);
  }
  var embeds = data.embeds || [];
  console.log('[Vimeus] Embeds encontrados: ' + embeds.length);

  var tareas = [];
  var i;
  for (i = 0; i < embeds.length; i++) {
    tareas.push(resolverEmbed(embeds[i]));
  }
  return Promise.all(tareas).then(function (listas) {
    var streams = [];
    var j, k;
    for (j = 0; j < listas.length; j++) {
      for (k = 0; k < listas[j].length; k++) streams.push(listas[j][k]);
    }
    console.log('[Vimeus] Streams resueltos: ' + streams.length);
    return streams;
  });
}

function resolverEmbed(embed) {
  var serverUrl = embed && embed.url;
  if (!serverUrl) return Promise.resolve([]);
  if (!/^http/.test(serverUrl)) {
    serverUrl = serverUrl.indexOf('//') === 0 ? 'https:' + serverUrl : 'https://' + serverUrl;
  }
  var interno = embed.server || 'Unknown';
  var adivinado = nombreServidor(serverUrl);
  var serverName = adivinado !== 'Unknown' ? adivinado : interno;
  console.log('[Vimeus] Resolviendo ' + serverName + ': ' + serverUrl);

  return resolverVideo(serverUrl, serverName)
    .then(function (resuelto) {
      if (!resuelto || !resuelto.url) {
        console.log('[Vimeus] Sin resolver: ' + serverName);
        return [];
      }
      var idioma = embed.lang ? String(embed.lang) : '';
      var calidad = resuelto.quality || embed.quality || '720p';
      // La etiqueta cruda del sitio (p. ej. "Latino") va en el title: el filtro
      // final la usa para decidir si el stream entra o no.
      var stream = {
        server: serverName,
        title: (idioma ? '[' + idioma + '] ' : '') + '[' + serverName + '] ' + calidad,
        language: idioma,
        quality: calidad,
        url: resuelto.url,
        headers: Object.assign({ 'User-Agent': UA, Referer: serverUrl }, resuelto.headers || {})
      };
      console.log('[Vimeus] Resuelto ' + serverName + ' -> ' + resuelto.url.substring(0, 60));
      return [arreglarCabeceras(stream)];
    })
    .catch(function (err) {
      console.log('[Vimeus] Error resolviendo ' + serverName + ': ' + (err && err.message));
      return [];
    });
}

export { VIEW_KEY, nombreServidor, extraerStreams, procesarJson };
