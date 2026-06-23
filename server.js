const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const scraper = require('./scraper');

const PORT = process.env.PORT || 3004;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const manifest = {
  id: 'com.masterscr.catalogowebs',
  version: '1.0.0',
  name: 'Catálogo Webs',
  description: 'Catálogo de LACartoons y más sitios',
  logo: `${BASE_URL}/public/logo.svg`,
  background: `${BASE_URL}/public/logo.svg`,
  resources: ['catalog', 'meta'],
  types: ['tv'],
  catalogs: [
    {
      id: 'cartoons_catalog',
      name: 'LACartoons',
      type: 'tv',
      extra: [{ name: 'search', isRequired: false }]
    }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  if (type !== 'tv' || id !== 'cartoons_catalog') return { metas: [] };

  let series = await scraper.getCatalog();

  if (extra && extra.search) {
    const q = extra.search.toLowerCase();
    series = series.filter(s => s.title.toLowerCase().includes(q));
  }

  const metas = series.map(s => ({
    id: `lc_${s.id}`,
    type: 'tv',
    name: s.title,
    poster: s.poster,
    posterShape: 'poster',
    year: s.year,
    genres: s.category ? [s.category] : undefined
  }));

  return { metas };
});

builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== 'tv' || !id.startsWith('lc_')) return { meta: null };

  const seriesId = id.replace('lc_', '');
  const detail = await scraper.getSeriesDetail(seriesId);
  if (!detail) return { meta: null };

  return {
    meta: {
      id,
      type: 'tv',
      name: detail.title,
      poster: detail.poster,
      posterShape: 'poster',
      year: detail.year,
      genres: detail.category ? [detail.category] : undefined,
      description: detail.description,
      releaseInfo: detail.year ? String(detail.year) : undefined,
      runtime: `Episodios: ${detail.episodes.length}`,
      videos: detail.episodes.map(ep => ({
        id: `lc_${seriesId}_ep_${ep.id}`,
        title: ep.name,
        season: ep.season,
        episode: ep.number,
        released: undefined
      }))
    }
  };
});

const app = express();
app.use('/public', express.static('public'));

const addonRouter = getRouter(builder.getInterface());
app.use('/cartoons', addonRouter);

// Health check
app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
  console.log(`[CatalogoWebs] Addon corriendo en puerto ${PORT}`);
  console.log(`[CatalogoWebs] Manifest: ${BASE_URL}/cartoons/manifest.json`);

  // Pre-warm cache
  scraper.refreshCatalog().then(() => {
    console.log('[CatalogoWebs] Catálogo precargado');
  });
});

module.exports = app;
