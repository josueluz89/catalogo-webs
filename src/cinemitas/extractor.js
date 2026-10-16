// Extractor de cinemitas.org (DooPlay): busca la ficha por slug partiendo de los
// titulos de TMDB, cae a la busqueda del propio sitio, resuelve la pagina del
// episodio si es serie, lee las opciones del reproductor y las pasa por AJAX
// (admin-ajax.php?action=doo_player_ajax) al resolver de embeds.
//
// Sin cheerio: el HTML se parsea con expresiones regulares (QuickJS no tiene
// cheerio y el original ni siquiera cargaba en el motor por eso).

import { UA, TMDB_KEY, urlAbsoluta, pedir } from './util.js';
import { resolverEmbed } from './resolvers.js';
import { clasificarEtiqueta } from './filtro.js';

var SITIO = 'https://cinemitas.org';
var AJAX = SITIO + '/wp-admin/admin-ajax.php';

// Quitar acentos con tabla propia: String.normalize('NFD') no existe en QuickJS.
var ACCENT_MAP = {
  'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
  'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
  'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
  'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
  'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
  'ñ': 'n', 'ç': 'c', 'ý': 'y', 'ß': 'ss'
};

function quitarAcentos(texto) {
  return String(texto || '').toLowerCase().replace(/[^\x00-\x7F]/g, function (c) {
    return ACCENT_MAP[c] || '';
  });
}

function slugify(titulo) {
  return quitarAcentos(titulo)
    .replace(/&/g, 'y')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------- titulos de TMDB (multi-idioma, como el original) ----------
async function getTmdbTitles(tmdbId, tipo) {
  var titleEs = null;
  var titleOriginal = null;
  var titleEn = null;
  var year = null;
  var reel = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

  try {
    var res = await fetch('https://api.themoviedb.org/3/' + tipo + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=es-ES').then(function (r) { return r.json(); });
    titleEs = tipo === 'movie' ? res.title : res.name;
    titleOriginal = tipo === 'movie' ? res.original_title : res.original_name;
    var fecha = tipo === 'movie' ? res.release_date : res.first_air_date;
    if (fecha) year = String(fecha).split('-')[0];
  } catch (e) {
    console.error('[Cinemitas] TMDB es-ES: ' + (e && e.message));
  }

  try {
    var resMx = await fetch('https://api.themoviedb.org/3/' + tipo + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=es-MX').then(function (r) { return r.json(); });
    var t = tipo === 'movie' ? resMx.title : resMx.name;
    if (t && !reel.test(t)) titleEs = titleEs || t;
  } catch (e2) {
    console.error('[Cinemitas] TMDB es-MX: ' + (e2 && e2.message));
  }

  try {
    var resEn = await fetch('https://api.themoviedb.org/3/' + tipo + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US').then(function (r) { return r.json(); });
    titleEn = tipo === 'movie' ? resEn.title : resEn.name;
  } catch (e3) {
    console.error('[Cinemitas] TMDB en-US: ' + (e3 && e3.message));
  }

  return { titleEs: titleEs, titleOriginal: titleOriginal, titleEn: titleEn, year: year };
}

// ---------- busqueda DooPlay del propio sitio ----------
function dooBuscar(query, mediaType) {
  if (!query) return Promise.resolve(null);
  var postType = mediaType === 'movie' ? 'movie' : 'tvshows';
  var ruta = mediaType === 'movie' ? 'movies' : 'tvshows';
  var url = SITIO + '/?dooplay=search&post_type=' + postType + '&s=' + encodeURIComponent(query);
  return pedir(url, { 'User-Agent': UA, Accept: 'text/html' })
    .then(function (res) { return res.ok ? res.text() : null; })
    .then(function (html) {
      if (!html) return null;
      var re = new RegExp('href="' + SITIO.replace(/\./g, '\\.') + '/' + ruta + '/[a-z0-9-]+/"', 'i');
      var m = html.match(re);
      if (!m) return null;
      return m[0].slice(6, m[0].length - 1);
    })
    .catch(function () { return null; });
}

// ---------- localizar la ficha (probando slugs y, si falla, buscando) ----------
function candidatosSlug(info) {
  var lista = [];
  var vistos = {};
  function meter(titulo) {
    if (!titulo) return;
    var base = slugify(titulo);
    if (base && !vistos[base]) { vistos[base] = 1; lista.push(base); }
    if (base && info.year) {
      var conAnio = base + '-' + info.year;
      if (!vistos[conAnio]) { vistos[conAnio] = 1; lista.push(conAnio); }
    }
  }
  meter(info.titleEs);
  meter(info.titleOriginal);
  meter(info.titleEn);
  return lista;
}

async function encontrarPagina(info, mediaType) {
  var ruta = mediaType === 'movie' ? 'movies' : 'tvshows';
  var candidatos = candidatosSlug(info);
  var i;
  for (i = 0; i < candidatos.length; i++) {
    var url = SITIO + '/' + ruta + '/' + candidatos[i] + '/';
    try {
      var res = await pedir(url, { 'User-Agent': UA });
      if (res.status === 200) {
        console.log('[Cinemitas] Ficha encontrada por slug: ' + url);
        return { url: url, html: await res.text() };
      }
    } catch (e) {
      console.log('[Cinemitas] Fallo el slug ' + url + ': ' + (e && e.message));
    }
  }
  console.log('[Cinemitas] Slugs agotados, probando la busqueda del sitio');
  var busquedas = [info.titleEs, info.titleOriginal, info.titleEn];
  for (i = 0; i < busquedas.length; i++) {
    var encontrada = await dooBuscar(busquedas[i], mediaType);
    if (!encontrada) continue;
    try {
      var resB = await pedir(encontrada, { 'User-Agent': UA });
      if (resB.status === 200) {
        console.log('[Cinemitas] Ficha encontrada por busqueda: ' + encontrada);
        return { url: encontrada, html: await resB.text() };
      }
    } catch (e2) {
      console.log('[Cinemitas] Fallo la ficha ' + encontrada + ': ' + (e2 && e2.message));
    }
  }
  return null;
}

// ---------- pagina del episodio (series) ----------
async function encontrarEpisodio(pagina, season, episode) {
  var m = pagina.url.match(/\/tvshows\/([^\/]+)\/?/);
  var slug = m ? m[1] : null;
  if (!slug) {
    console.log('[Cinemitas] No se pudo sacar el slug de la serie');
    return null;
  }
  var prevista = SITIO + '/episodes/' + slug + '-' + season + 'x' + episode + '/';
  console.log('[Cinemitas] Probando episodio: ' + prevista);
  try {
    var res = await pedir(prevista, { 'User-Agent': UA });
    if (res.status === 200) return { url: prevista, html: await res.text() };
  } catch (e) {
    console.log('[Cinemitas] Fallo el episodio previsto: ' + (e && e.message));
  }

  // Plan B: buscar el enlace del episodio en la ficha de la serie.
  var re = /href="([^"]*\/episodes\/[^"]*?-(\d+)x(\d+)\/?)"/gi;
  var m2;
  while ((m2 = re.exec(pagina.html)) !== null) {
    if (parseInt(m2[2], 10) !== parseInt(season, 10) || parseInt(m2[3], 10) !== parseInt(episode, 10)) continue;
    var url = urlAbsoluta(m2[1], SITIO);
    try {
      var res2 = await pedir(url, { 'User-Agent': UA });
      if (res2.status === 200) {
        console.log('[Cinemitas] Episodio encontrado en la ficha: ' + url);
        return { url: url, html: await res2.text() };
      }
    } catch (e2) {}
  }
  console.log('[Cinemitas] Episodio S' + season + 'E' + episode + ' no encontrado');
  return null;
}

// ---------- opciones del reproductor (sustituye a cheerio) ----------
function atributo(tag, nombre) {
  var m = tag.match(new RegExp(nombre + '\\s*=\\s*[\'"]([^\'"]*)[\'"]', 'i'));
  return m ? m[1] : null;
}

function extraerOpciones(html) {
  var opciones = [];
  var re = /<li[^>]*dooplay_player_option[^>]*>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var tag = m[0];
    var post = atributo(tag, 'data-post');
    var nume = atributo(tag, 'data-nume');
    var tipo = atributo(tag, 'data-type');
    if (!post || !nume || !tipo) continue;
    var resto = html.slice(m.index + tag.length, m.index + tag.length + 600);
    var span = resto.match(/<span[^>]*class=['"]title['"][^>]*>([^<]*)<\/span>/i);
    var texto = '';
    if (span) texto = span[1];
    else texto = resto.split('</li>')[0].replace(/<[^>]*>/g, ' ');
    texto = texto.replace(/\s+/g, ' ').trim();
    opciones.push({ post: post, nume: nume, tipo: tipo, lang: texto });
  }
  return opciones;
}

// ---------- AJAX -> embed -> resolver ----------
async function resolverOpciones(pagina) {
  var opciones = extraerOpciones(pagina.html);
  console.log('[Cinemitas] Opciones del reproductor: ' + opciones.length);
  var streams = [];
  var i;
  for (i = 0; i < opciones.length; i++) {
    var op = opciones[i];
    var idioma = clasificarEtiqueta(op.lang);
    if (!idioma) {
      console.log('[Cinemitas] Opcion descartada (' + op.lang + '): no es latino ni subtitulado');
      continue;
    }
    try {
      var cuerpo = 'action=doo_player_ajax&post=' + encodeURIComponent(op.post) +
                   '&nume=' + encodeURIComponent(op.nume) + '&type=' + encodeURIComponent(op.tipo);
      var res = await pedir(AJAX, {
        'User-Agent': UA,
        Referer: pagina.url,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded'
      }, { metodo: 'POST', cuerpo: cuerpo });
      if (!res.ok) continue;
      var data = JSON.parse(await res.text());
      if (!data || !data.embed_url) continue;

      var embedUrl = String(data.embed_url);
      if (embedUrl.charAt(0) === '<') {
        var src = embedUrl.match(/src=["']([^"']+)["']/);
        if (!src) continue;
        embedUrl = src[1];
      }
      console.log('[Cinemitas] Opcion ' + op.nume + ' (' + idioma + '): ' + embedUrl);

      var resuelto = await resolverEmbed(embedUrl);
      if (resuelto && resuelto.url) {
        var calidad = resuelto.quality || '1080p';
        var servidor = resuelto.server || 'Online';
        streams.push({
          server: servidor,
          quality: calidad,
          language: idioma,
          title: calidad + ' \u00b7 ' + idioma + ' \u00b7 ' + servidor,
          url: resuelto.url,
          headers: resuelto.headers || {}
        });
      } else {
        console.log('[Cinemitas] Embed sin resolver (' + idioma + '): ' + embedUrl);
      }
    } catch (e) {
      console.log('[Cinemitas] Error en la opcion ' + op.nume + ': ' + (e && e.message));
    }
  }
  return comprobarVivos(streams);
}

// Solo se devuelven enlaces de video vivos (el original tambien lo hacia): se
// prueba con un GET de rango y se descarta lo que no responda 2xx.
var RE_MEDIA_PROBABLE = /\.m3u8(\?|$)|\.mp4(\?|$)|\.mpd(\?|$)|\/hls2?\/|\/master\.m3u8/;

async function comprobarVivos(streams) {
  var salida = [];
  var i;
  for (i = 0; i < streams.length; i++) {
    var s = streams[i];
    if (!s.url || !RE_MEDIA_PROBABLE.test(s.url)) {
      if (s.url) salida.push(s);
      continue;
    }
    var ok = false;
    var status = 0;
    try {
      var cab = Object.assign({ 'User-Agent': UA, Range: 'bytes=0-0' }, s.headers || {});
      var res = await fetch(s.url, { method: 'GET', headers: cab, redirect: 'follow' });
      status = res.status;
      ok = res.ok || res.status === 206;
    } catch (e) {}
    if (ok && status >= 200 && status < 400) salida.push(s);
    else console.log('[Cinemitas] Enlace descartado (' + status + '): ' + String(s.url).slice(0, 70));
  }
  console.log('[Cinemitas] Enlaces vivos: ' + salida.length + ' de ' + streams.length);
  return salida;
}

// ---------- flujo completo ----------
async function extraerStreams(tmdbId, mediaType, season, episode) {
  if (!tmdbId || !mediaType) {
    console.error('[Cinemitas] Falta tmdbId o mediaType');
    return [];
  }
  console.log('[Cinemitas] Resolviendo TMDB ' + tmdbId + ' (' + mediaType + ')' +
              (mediaType !== 'movie' ? ' S' + season + 'E' + episode : ''));
  var info = await getTmdbTitles(tmdbId, mediaType);
  if (!info.titleEs && !info.titleOriginal && !info.titleEn) {
    console.log('[Cinemitas] TMDB no devolvio titulos');
    return [];
  }
  var pagina = await encontrarPagina(info, mediaType);
  if (!pagina) {
    console.log('[Cinemitas] Sin ficha para ' + tmdbId);
    return [];
  }
  if (mediaType !== 'movie') {
    pagina = await encontrarEpisodio(pagina, season, episode);
    if (!pagina) return [];
  }
  return resolverOpciones(pagina);
}

export { SITIO, AJAX, quitarAcentos, slugify, getTmdbTitles, dooBuscar, candidatosSlug, encontrarPagina, encontrarEpisodio, extraerOpciones, resolverOpciones, comprobarVivos, extraerStreams };
