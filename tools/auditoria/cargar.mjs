// cargar.mjs — carga un provider CommonJS (bundle de terceros) fuera del runtime de la app.
// Da: require() shim (hermanos, crypto-js, cheerio, axios sobre fetch), fetch, Buffer, timers.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// resolvemos las deps reales desde el node_modules del repo MasterScrap
const REQUIERE_REPO = createRequire('C:/Users/josue/OneDrive/Documentos/scraperstv-providers/package.json');

function axiosShim() {
  async function ejecutar(url, cfg = {}) {
    const headers = { ...(cfg.headers || {}) };
    let body;
    if (cfg.data !== undefined && cfg.data !== null) {
      if (typeof cfg.data === 'string') body = cfg.data;
      else if (Buffer.isBuffer(cfg.data)) body = cfg.data;
      else {
        body = typeof cfg.data === 'object' ? JSON.stringify(cfg.data) : String(cfg.data);
        if (!Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), cfg.timeout || 45000);
    let r, texto;
    try {
      r = await fetch(url, {
        method: (cfg.method || 'GET').toUpperCase(),
        headers,
        body,
        redirect: 'follow',
        signal: c.signal,
      });
      texto = await r.text();
    } finally {
      clearTimeout(t);
    }
    let data = texto;
    if (cfg.responseType !== 'text') {
      try { data = JSON.parse(texto); } catch { data = texto; }
    }
    if (r.status >= 400) {
      const e = new Error('HTTP ' + r.status);
      e.response = { status: r.status, data, headers: Object.fromEntries(r.headers) };
      throw e;
    }
    return { data, status: r.status, statusText: r.statusText, headers: Object.fromEntries(r.headers), config: cfg };
  }
  const axios = (cfg) => ejecutar(cfg.url || cfg, cfg);
  axios.request = (cfg) => ejecutar(cfg.url, cfg);
  axios.get = (url, cfg) => ejecutar(url, { ...cfg, method: 'GET' });
  axios.post = (url, data, cfg) => ejecutar(url, { ...cfg, method: 'POST', data });
  axios.head = (url, cfg) => ejecutar(url, { ...cfg, method: 'HEAD' });
  axios.create = () => axios;
  axios.all = (ps) => Promise.all(ps);
  axios.defaults = { headers: { common: {} } };
  return axios;
}

export function cargar(rutaArchivo, { log } = {}) {
  const cache = new Map();
  const AX = axiosShim();
  const diag = [];

  function requerir(nombre, desde) {
    if (nombre.startsWith('.')) {
      let abs = path.resolve(path.dirname(desde), nombre);
      if (!fs.existsSync(abs) && fs.existsSync(abs + '.js')) abs += '.js';
      if (!fs.existsSync(abs) && fs.existsSync(abs + '.json')) return JSON.parse(fs.readFileSync(abs + '.json', 'utf8'));
      return cargarArchivo(abs);
    }
    if (nombre === 'axios') return AX;
    if (nombre === 'cheerio' || nombre.startsWith('cheerio')) return REQUIERE_REPO('cheerio-without-node-native');
    if (nombre === 'crypto-js') return REQUIERE_REPO('crypto-js');
    if (nombre === 'crypto' || nombre === 'node:crypto') return REQUIERE_REPO('crypto');
    if (nombre === 'https' || nombre === 'node:https') return REQUIERE_REPO('https');
    if (nombre === 'http' || nombre === 'node:http') return REQUIERE_REPO('http');
    if (nombre === 'zlib' || nombre === 'node:zlib') return REQUIERE_REPO('zlib');
    if (nombre === 'buffer' || nombre === 'node:buffer') return REQUIERE_REPO('buffer');
    if (nombre === 'url' || nombre === 'node:url') return REQUIERE_REPO('url');
    if (nombre.endsWith('.json')) {
      const abs = path.resolve(path.dirname(desde), nombre);
      if (fs.existsSync(abs)) return JSON.parse(fs.readFileSync(abs, 'utf8'));
    }
    throw new Error('require no soportado: ' + nombre);
  }

  function cargarArchivo(abs) {
    if (cache.has(abs)) return cache.get(abs).exports;
    const codigo = fs.readFileSync(abs, 'utf8');
    const module = { exports: {} };
    cache.set(abs, module);
    const consola = log
      ? {
          log: (...a) => log('log', abs, a),
          warn: (...a) => log('warn', abs, a),
          error: (...a) => log('error', abs, a),
          info: (...a) => log('log', abs, a),
          debug: () => {},
        }
      : console;
    const fn = new Function(
      'module', 'exports', 'require', 'fetch', 'console', 'setTimeout', 'clearTimeout',
      'setInterval', 'clearInterval', 'AbortController', 'URL', 'URLSearchParams',
      'TextEncoder', 'TextDecoder', 'atob', 'btoa', 'Buffer', 'process', 'globalThis', 'crypto',
      codigo + '\n//# sourceURL=' + abs
    );
    fn(
      module, module.exports, (n) => requerir(n, abs), fetch, consola, setTimeout, clearTimeout,
      setInterval, clearInterval, AbortController, URL, URLSearchParams, TextEncoder, TextDecoder,
      (s) => Buffer.from(String(s), 'base64').toString('binary'),
      (s) => Buffer.from(String(s), 'binary').toString('base64'),
      Buffer, process, globalThis, globalThis.crypto
    );
    return module.exports;
  }

  const exp = cargarArchivo(path.resolve(rutaArchivo));
  return { exp, diag };
}
