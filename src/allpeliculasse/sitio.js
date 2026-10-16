// sitio.js — capa del sitio (allpeliculas.la) y de TMDB, portada a QuickJS.
// Igual que el original: búsqueda por la API interna /wp-api/v1/, lista de episodios y
// endpoint de players. Sin new URL / matchAll / normalize.

import { fetchJson } from '../shared/http.js';

export var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
export var BASE_URL = 'https://allpeliculas.la';
export var USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export var CABECERAS = {
  'User-Agent': USER_AGENT,
  'Accept': 'application/json, text/plain, */*',
  'Connection': 'keep-alive',
  'Referer': BASE_URL + '/'
};

export function limpiarTitulo(title) {
  if (!title) return '';
  return String(title)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/:\s*.*?$/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function consultaDe(title) {
  if (!title) return '';
  var q = String(title).split(':')[0];
  q = q.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '');
  q = q.replace(/[^a-zA-Z0-9\s\-áéíóúÁÉÍÓÚñÑ]/g, '');
  return q.replace(/\s+/g, ' ').trim();
}

// Títulos (es-MX/es-ES/en-US) + año. Tolerante a fallos: si TMDB no contesta, devuelve null.
export async function datosTMDB(id, tipo) {
  var titulos = [];
  var year = '';
  var idiomas = ['es-MX', 'es-ES', 'en-US'];
  for (var i = 0; i < idiomas.length; i++) {
    try {
      var url = 'https://api.themoviedb.org/3/' + tipo + '/' + id + '?api_key=' + TMDB_API_KEY + '&language=' + idiomas[i];
      var res = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });
      var t = tipo === 'movie' ? res.title : res.name;
      var o = tipo === 'movie' ? res.original_title : res.original_name;
      if (t && titulos.indexOf(t) === -1) titulos.push(t);
      if (o && titulos.indexOf(o) === -1) titulos.push(o);
      if (!year) year = String(res.release_date || res.first_air_date || '').substring(0, 4);
    } catch (e) {
      console.log('[AllpeliculasSE] TMDB error (' + idiomas[i] + '): ' + (e && e.message));
    }
  }
  return titulos.length ? { titles: titulos, year: year } : null;
}

export async function buscarPosts(query, tipo) {
  try {
    var postType = tipo === 'tv' ? 'tvshows' : 'movies';
    var url = BASE_URL + '/wp-api/v1/search?filter=[]&q=' + encodeURIComponent(query) +
      '&orderBy=latest&order=desc&postType=' + postType + '&postsPerPage=20&page=1';
    console.log('[AllpeliculasSE] Buscando: ' + url);
    var data = await fetchJson(url, { headers: CABECERAS });
    if (data && data.data && data.data.posts) {
      var posts = [];
      for (var i = 0; i < data.data.posts.length; i++) {
        var p = data.data.posts[i];
        posts.push({ id: p._id, title: p.title, slug: p.slug, type: p.type });
      }
      return posts;
    }
  } catch (e) {
    console.log('[AllpeliculasSE] Error de búsqueda: ' + (e && e.message));
  }
  return [];
}

// Devuelve el _id del post del episodio pedido, o null.
export async function buscarCapitulo(postId, season, episode) {
  try {
    var url = BASE_URL + '/wp-api/v1/single/episodes/list?_id=' + postId + '&season=' + season + '&postsPerPage=100&page=1';
    console.log('[AllpeliculasSE] Lista de episodios: ' + url);
    var data = await fetchJson(url, { headers: CABECERAS });
    var posts = data && data.data ? data.data.posts : null;
    if (!posts) return null;
    for (var i = 0; i < posts.length; i++) {
      var ep = posts[i];
      if (parseInt(ep.season_number, 10) === parseInt(season, 10) && parseInt(ep.episode_number, 10) === parseInt(episode, 10)) {
        return ep._id;
      }
    }
  } catch (e) {
    console.log('[AllpeliculasSE] Error listando episodios: ' + (e && e.message));
  }
  return null;
}

export async function embedsDe(postId) {
  try {
    var url = BASE_URL + '/wp-api/v1/player?postId=' + postId + '&demo=0';
    console.log('[AllpeliculasSE] Players de: ' + url);
    var data = await fetchJson(url, { headers: CABECERAS });
    if (data && data.data && data.data.embeds) return data.data.embeds;
  } catch (e) {
    console.log('[AllpeliculasSE] Error obteniendo players: ' + (e && e.message));
  }
  return [];
}
