const cheerio = require('cheerio');
const { fetchPage } = require('../helpers');

const BASE = 'https://lacartoons.com';

const CATEGORIES = [
  { id: 'all', name: 'Todas las series', url: '/' },
  { id: 'nickelodeon', name: 'Nickelodeon', url: '/?Categoria_id=1' },
  { id: 'cartoon-network', name: 'Cartoon Network', url: '/?Categoria_id=2' },
  { id: 'fox-kids', name: 'Fox Kids', url: '/?Categoria_id=3' },
  { id: 'hanna-barbera', name: 'Hanna Barbera', url: '/?Categoria_id=4' },
  { id: 'disney', name: 'Disney', url: '/?Categoria_id=5' },
  { id: 'warner', name: 'Warner Channel', url: '/?Categoria_id=6' },
  { id: 'marvel', name: 'Marvel', url: '/?Categoria_id=7' },
  { id: 'otros', name: 'Otros', url: '/?Categoria_id=8' },
];

const categoryNameMap = {
  '1': 'Nickelodeon', '2': 'Cartoon Network', '3': 'Fox Kids',
  '4': 'Hanna Barbera', '5': 'Disney', '6': 'Warner Channel',
  '7': 'Marvel', '8': 'Otros'
};

async function fetchSeriesList(categoryUrl) {
  const url = categoryUrl.startsWith('http') ? categoryUrl : BASE + categoryUrl;
  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const series = [];

  $('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href || !href.startsWith('/serie/')) return;
    const idMatch = href.match(/\/serie\/(\d+)/);
    if (!idMatch) return;

    const $div = $el.find('div.serie');
    if (!$div.length) return;

    const img = $div.find('img').first();
    const posterSrc = img.attr('data-src') || img.attr('src') || '';
    const poster = posterSrc.startsWith('http') ? posterSrc : BASE + posterSrc;

    const title = $div.find('p.nombre-serie').text().trim();
    if (!title) return;

    const categorySpan = $div.find('span.marcadorSeries').text().trim();
    const yearText = $div.find('span.marcador-ano').text().trim();
    const ratingText = $div.find('span.valoracion').text().trim();

    series.push({
      id: idMatch[1],
      title,
      poster,
      category: categorySpan,
      year: yearText ? parseInt(yearText) : null,
      rating: ratingText ? parseInt(ratingText) : null
    });
  });

  return series;
}

async function fetchSeriesDetail(seriesId) {
  const url = `${BASE}/serie/${seriesId}`;
  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  const title = $('h2.subtitulo-serie-seccion').contents().first().text().trim();
  if (!title) return null;

  const posterEl = $('div.imagen-serie img').first();
  const posterSrc = posterEl.attr('data-src') || posterEl.attr('src') || '';
  const poster = posterSrc.startsWith('http') ? posterSrc : BASE + posterSrc;

  const categorySpan = $('h2.subtitulo-serie-seccion span.marcadorSeries').text().trim();

  const description = $('.informacion-serie-seccion p:contains("Reseña") span').text().trim()
    || $('.informacion-serie-seccion p:contains("Reseña")').text().replace(/Reseña:/i, '').trim();

  const yearText = $('.informacion-serie-seccion span.marcador-año').text().trim();
  const year = yearText ? parseInt(yearText) : null;

  const ratingText = $('span.valoracion1').text().trim();
  const rating = ratingText ? parseInt(ratingText) : null;

  const episodes = [];
  $('div.episodio-panel ul.listas-de-episodion a').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    if (!href) return;

    const idMatch = href.match(/\/serie\/capitulo\/(\d+)/);
    if (!idMatch) return;

    const epNumText = $a.find('span').text().trim();
    const epTitle = $a.text().replace(epNumText, '').trim();

    const seasonMatch = href.match(/[?&]t=(\d+)/);
    const season = seasonMatch ? parseInt(seasonMatch[1]) : 1;
    const epNumMatch = epNumText.match(/\d+/);
    const epNumber = epNumMatch ? parseInt(epNumMatch[0]) : episodes.length + 1;

    episodes.push({
      id: idMatch[1],
      season,
      number: epNumber,
      title: epTitle,
      url: BASE + href,
      name: `Capítulo ${epNumber} - ${epTitle}`
    });
  });

  return {
    id: seriesId,
    title,
    poster,
    category: categorySpan,
    year,
    rating,
    description,
    episodes
  };
}

async function fetchSeriesListPaginated(baseUrl) {
  const seriesMap = new Map();
  const totalPages = 32;
  for (let page = 1; page <= totalPages; page++) {
    const url = page === 1 ? baseUrl : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}`;
    const items = await fetchSeriesList(url);
    if (items.length === 0) break;
    items.forEach(s => {
      if (!seriesMap.has(s.id)) seriesMap.set(s.id, s);
    });
  }
  return [...seriesMap.values()];
}

async function fetchAllSeries() {
  return await fetchSeriesListPaginated('/');
}

module.exports = { fetchSeriesList, fetchSeriesDetail, fetchAllSeries, CATEGORIES, BASE };
