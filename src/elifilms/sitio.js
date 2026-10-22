// sitio.js — capa del sitio (allcalidad.re, la API REST que usa EliFilms) y de TMDB.
// Portado a QuickJS: sin new URL / matchAll / normalize; los helpers viven dentro de src/elifilms/.

import { fetchJson } from '../shared/http.js';

export var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
export var HOST = 'https://allcalidad.re';
export var API = HOST + '/api/rest/';
export var USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export var CABECERAS = {
  'User-Agent': USER_AGENT,
  'Accept': 'application/json, text/plain, */*',
  'Connection': 'keep-alive',
  'Referer': HOST + '/'
};

export function limpiarTitulo(title) {
  if (!title) return '';
  return String(title)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[-_:]/g, ' ')
    .replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// La búsqueda del sitio se rompe con consultas largas: solo las dos primeras palabras útiles.
export function consultaDe(title) {
  if (!title) return '';
  var q = String(title).split(':')[0];
  q = q.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '');
  q = q.replace(/[^a-zA-Z0-9\s\-áéíóúÁÉÍÓÚñÑ]/g, '');
  q = q.replace(/\s+/g, ' ').trim();
  var palabras = [];
  var partes = q.split(' ');
  for (var i = 0; i < partes.length; i++) {
    if (partes[i].length > 1) palabras.push(partes[i]);
  }
  return palabras.slice(0, 2).join(' ');
}

export async function datosTMDB(id, tipo) {
  // Nuvio solo pasa tmdbId/mediaType/season/episode: el título se resuelve aquí vía TMDB.
  // Las 3 lenguas van en paralelo (antes eran 3 fetches en serie).
  var idiomas = ['es-MX', 'es-ES', 'en-US'];
  function pedir(url) {
    return fetchJson(url, { headers: { 'User-Agent': USER_AGENT } }).then(function (r) { return r; }, function () { return null; });
  }
  var promesas = [];
  for (var i = 0; i < idiomas.length; i++) {
    promesas.push(pedir('https://api.themoviedb.org/3/' + tipo + '/' + id + '?api_key=' + TMDB_API_KEY + '&language=' + idiomas[i]));
  }
  var resultados = await Promise.all(promesas);
  var titulos = [];
  var year = '';
  for (var j = 0; j < idiomas.length; j++) {
    var res = resultados[j];
    if (!res) {
      console.log('[EliFilms] TMDB error (' + idiomas[j] + ')');
      continue;
    }
    var t = tipo === 'movie' ? res.title : res.name;
    var o = tipo === 'movie' ? res.original_title : res.original_name;
    if (t && titulos.indexOf(t) === -1) titulos.push(t);
    if (o && titulos.indexOf(o) === -1) titulos.push(o);
    if (!year) year = String(res.release_date || res.first_air_date || '').substring(0, 4);
  }
  return titulos.length ? { titles: titulos, year: year } : null;
}

export async function buscarPosts(query, tipo) {
  try {
    var postType = tipo === 'tv' ? 'tvshows' : 'movies';
    var url = API + 'search?post_type=' + postType + '&query=' + encodeURIComponent(query) + '&posts_per_page=20';
    console.log('[EliFilms] Buscando: ' + url);
    var json = await fetchJson(url, { headers: CABECERAS });
    var posts = json && json.data ? json.data.posts : null;
    if (Array.isArray(posts)) {
      // Guarda del original: si la búsqueda no encuentra nada, el sitio devuelve los últimos
      // posts publicados; se descarta el lote si ningún título contiene una palabra buscada.
      var palabras = String(query).toLowerCase().split(/\s+/);
      var relevantes = [];
      for (var w = 0; w < palabras.length; w++) {
        if (palabras[w].length > 2) relevantes.push(palabras[w]);
      }
      var hay = false;
      for (var i = 0; i < posts.length && !hay; i++) {
        var pt = String(posts[i].title || '').toLowerCase();
        for (var j = 0; j < relevantes.length; j++) {
          if (pt.indexOf(relevantes[j]) !== -1) { hay = true; break; }
        }
      }
      if (!hay) {
        console.log('[EliFilms] Resultados irrelevantes para "' + query + '": se descarta.');
        return [];
      }
      var out = [];
      for (var k = 0; k < posts.length; k++) {
        out.push({
          id: posts[k]._id,
          title: posts[k].title,
          originalTitle: posts[k].original_title || '',
          type: posts[k].type || postType
        });
      }
      return out;
    }
  } catch (e) {
    console.log('[EliFilms] Error de búsqueda: ' + (e && e.message));
  }
  return [];
}

export async function capitulosDe(postId) {
  try {
    var url = API + 'episodes?post_id=' + postId;
    console.log('[EliFilms] Episodios de: ' + url);
    var data = await fetchJson(url, { headers: CABECERAS });
    return data && data.data ? data.data : [];
  } catch (e) {
    console.log('[EliFilms] Error de episodios: ' + (e && e.message));
    return [];
  }
}

export async function embedsDe(postId) {
  try {
    var url = API + 'player?post_id=' + postId + '&_any=1';
    console.log('[EliFilms] Player de: ' + url);
    var data = await fetchJson(url, { headers: CABECERAS });
    return data && data.data && data.data.embeds ? data.data.embeds : [];
  } catch (e) {
    console.log('[EliFilms] Error de player: ' + (e && e.message));
    return [];
  }
}
