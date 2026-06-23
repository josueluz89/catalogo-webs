const lacartoons = require('./src/scrapers/lacartoons');

let catalogCache = { series: [], timestamp: 0 };
let detailCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function refreshCatalog() {
  console.log('[Scraper] Refrescando catálogo...');
  try {
    const series = await lacartoons.fetchAllSeries();
    catalogCache = { series, timestamp: Date.now() };
    console.log(`[Scraper] Catálogo actualizado: ${series.length} series`);
  } catch (e) {
    console.error('[Scraper] Error:', e.message);
  }
}

async function getCatalog() {
  if (Date.now() - catalogCache.timestamp > CACHE_TTL) {
    await refreshCatalog();
  }
  return catalogCache.series;
}

async function getSeriesDetail(id) {
  const cached = detailCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = await lacartoons.fetchSeriesDetail(id);
  if (data) {
    detailCache.set(id, { data, timestamp: Date.now() });
  }
  return data;
}

module.exports = { getCatalog, getSeriesDetail, refreshCatalog };
