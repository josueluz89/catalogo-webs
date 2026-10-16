// tools/qjs-correr.mjs — corre un provider en QuickJS de verdad, con lo mismo que inyecta el motor:
// fetch, console, atob/btoa, AbortController, setTimeout y require('crypto-js'). NADA más.
// No hay Buffer, ni require('crypto'|'https'|'zlib'): si el provider los usa, aquí se cae igual que en la app.
// El fetch lo hace el host con curl (sync) y el arnés bombea los timers, así que la semántica es la del motor.
//
// Uso:  node tools/qjs-correr.mjs <provider.js> [tmdbId] [movie|tv] [season] [episode]
//       LIMITE_MS=60000 node tools/qjs-correr.mjs providers/embed69.js 1396 tv 1 1
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { newQuickJSWASMModule } from 'quickjs-emscripten';

const REPO = path.dirname(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')));
const reqRepo = createRequire(path.join(REPO, 'package.json'));

const [ruta, tmdb = '693134', tipo = 'movie', season = 'null', episode = 'null'] = process.argv.slice(2);
const LIMITE_MS = Number(process.env.LIMITE_MS || 90000);
if (!ruta) { console.error('uso: node tools/qjs-correr.mjs <provider.js> [tmdbId] [movie|tv] [s] [e]'); process.exit(1); }

const codigo = fs.readFileSync(path.resolve(REPO, ruta), 'utf8');
const cryptoJs = fs.readFileSync(reqRepo.resolve('crypto-js/crypto-js.js'), 'utf8');
const UA_DEFECTO = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

const QuickJS = await newQuickJSWASMModule();
const ctx = QuickJS.newContext();

function dormir(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ---------- fetch real: el host hace curl y devuelve el cuerpo como texto ----------
const tmp = path.join(os.tmpdir(), 'qjs-fetch-' + process.pid + '.txt');
function curl(url, opciones) {
  const args = ['-sSL', '--compressed', '-m', String(opciones.timeoutMs || 45000), '-o', tmp, '-w', '%{http_code}|%{content_type}|%{url_effective}'];
  const headers = Object.assign({ 'User-Agent': UA_DEFECTO }, opciones.headers || {});
  for (const [k, v] of Object.entries(headers)) { if (v !== undefined && v !== null) args.push('-H', `${k}: ${v}`); }
  if (opciones.method && String(opciones.method).toUpperCase() !== 'GET') args.push('-X', String(opciones.method).toUpperCase());
  if (opciones.body !== undefined && opciones.body !== null) {
    args.push('--data-raw', typeof opciones.body === 'string' ? opciones.body : JSON.stringify(opciones.body));
  }
  args.push(String(url));
  let meta = '';
  try { meta = execFileSync('curl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return { status: 0, error: String(e.message).slice(0, 200), ctype: '', url: String(url), body: '' }; }
  const [status, ctype, efectiva] = meta.split('|');
  let body = '';
  try { body = fs.readFileSync(tmp, 'utf8'); } catch { body = ''; }
  return { status: Number(status) || 0, ctype: ctype || '', url: efectiva || String(url), body };
}

const curlBridge = ctx.newFunction('__curl', (urlH, optsH) => {
  let opciones = {};
  try { opciones = JSON.parse(ctx.getString(optsH) || '{}') || {}; } catch { opciones = {}; }
  const r = curl(ctx.getString(urlH), opciones);
  return ctx.newString(JSON.stringify(r));
});
curlBridge.consume((h) => ctx.setProp(ctx.global, '__curl', h));

const btoaBridge = ctx.newFunction('__btoa', (h) => ctx.newString(Buffer.from(ctx.getString(h), 'binary').toString('base64')));
btoaBridge.consume((h) => ctx.setProp(ctx.global, '__btoa', h));
const atobBridge = ctx.newFunction('__atob', (h) => ctx.newString(Buffer.from(ctx.getString(h), 'base64').toString('binary')));
atobBridge.consume((h) => ctx.setProp(ctx.global, '__atob', h));

const PRELUDIO = `
globalThis.window = globalThis; globalThis.self = globalThis;
var __logs = [];
function __log(nivel, args){
  var s = '';
  try { for (var i = 0; i < args.length; i++) s += (i ? ' ' : '') + (typeof args[i] === 'string' ? args[i] : JSON.stringify(args[i])); } catch (e) { s = '[no serializable]'; }
  if (__logs.length < 200) __logs.push(nivel + ' ' + s.slice(0, 400));
}
globalThis.console = {
  log: function(){ __log('log', arguments); }, info: function(){ __log('info', arguments); },
  warn: function(){ __log('warn', arguments); }, error: function(){ __log('error', arguments); },
  debug: function(){}, trace: function(){}
};
globalThis.atob = __atob;
globalThis.btoa = __btoa;
globalThis.TextEncoder = undefined;
globalThis.TextDecoder = undefined;
globalThis.AbortController = function(){ var self = this; this.signal = { aborted: false }; this.abort = function(){ self.signal.aborted = true; }; };
var __tid = 0, __timers = [];
globalThis.setTimeout = function(fn, ms){ __tid++; __timers.push({ id: __tid, fn: fn, cuando: Date.now() + (ms || 0) }); return __tid; };
globalThis.clearTimeout = function(id){ for (var i = 0; i < __timers.length; i++) if (__timers[i].id === id) { __timers.splice(i, 1); return; } };
globalThis.setInterval = globalThis.setTimeout;
globalThis.clearInterval = globalThis.clearTimeout;
globalThis.__correrTimers = function(){
  var ahora = Date.now(), n = 0, vivos = [];
  for (var i = 0; i < __timers.length; i++) {
    if (__timers[i].cuando <= ahora) { n++; try { __timers[i].fn(); } catch (e) { __log('error', ['timer: ' + e]); } }
    else vivos.push(__timers[i]);
  }
  __timers = vivos;
  return n + '|' + vivos.length;
};
globalThis.fetch = function(url, opts){
  var o = opts || {};
  var cabeceras = {};
  if (o.headers) {
    if (typeof o.headers.forEach === 'function') o.headers.forEach(function(v, k){ cabeceras[k] = v; });
    else for (var k in o.headers) cabeceras[k] = o.headers[k];
  }
  var r = JSON.parse(__curl(String(url), JSON.stringify({
    method: o.method || 'GET', headers: cabeceras, body: o.body === undefined ? null : o.body
  })));
  var h = {
    get: function(k){ return (r.ctype && String(k).toLowerCase() === 'content-type') ? r.ctype : null; },
    has: function(k){ return String(k).toLowerCase() === 'content-type' ? !!r.ctype : false; },
    forEach: function(cb){ if (r.ctype) cb(r.ctype, 'content-type'); }
  };
  return Promise.resolve({
    ok: r.status >= 200 && r.status < 300,
    status: r.status, statusText: '', url: r.url || String(url), redirected: false,
    headers: h,
    text: function(){ return Promise.resolve(r.body); },
    json: function(){ return Promise.resolve(JSON.parse(r.body)); },
    arrayBuffer: function(){ return Promise.reject(new Error('arrayBuffer no soportado en el arnés')); }
  });
};
`;
let r = ctx.evalCode(PRELUDIO);
if (r.error) { console.error('preludio:', JSON.stringify(ctx.dump(r.error))); process.exit(1); }
r.value?.dispose?.();

// crypto-js (es el único EXTERNAL_MODULES del build.js del repo)
r = ctx.evalCode(`${cryptoJs}\nglobalThis.CryptoJS = CryptoJS;\nglobalThis.require = function(nombre){ if (nombre === 'crypto-js') return CryptoJS; throw new Error('require no permitido en el motor: ' + nombre); };`);
if (r.error) { console.error('crypto-js:', JSON.stringify(ctx.dump(r.error)).slice(0, 600)); process.exit(1); }
r.value?.dispose?.();

// el provider, como CommonJS
r = ctx.evalCode(`
var __mod = { exports: {} };
(function(module, exports, require){
${codigo}
})(__mod, __mod.exports, globalThis.require);
globalThis.__PROVIDER = __mod.exports;`);
if (r.error) {
  console.error('CARGA FALLIDA en QuickJS:');
  console.error(JSON.stringify(ctx.dump(r.error), null, 1).slice(0, 2000));
  process.exit(2);
}
r.value?.dispose?.();

const arranque = ctx.evalCode(`globalThis.__R = (function(){
  try { return Promise.resolve(__PROVIDER.getStreams('${tmdb}', '${tipo}', ${season}, ${episode}))
    .then(function(s){ return JSON.stringify({ ok: true, streams: (s || []).map(function(x){ return {
      title: String(x.title || x.name || ''), quality: String(x.quality || ''), language: String(x.language || ''),
      url: String(x.url || ''), headers: x.headers || null }; }) }); },
    function(e){ return JSON.stringify({ ok: false, error: String(e && e.message || e) }); });
  } catch (e) { return Promise.resolve(JSON.stringify({ ok: false, error: String(e && e.message || e) })); }
})();`);
if (arranque.error) { console.error('llamada:', JSON.stringify(ctx.dump(arranque.error))); process.exit(3); }
const promesa = arranque.value;

let estado = ctx.getPromiseState(promesa);
const t0 = Date.now();
let cuelga = false;
while (estado.type === 'pending') {
  ctx.runtime.executePendingJobs();
  const timers = ctx.evalCode('__correrTimers()');
  let pendientes = 0;
  if (!timers.error) { pendientes = Number(ctx.getString(timers.value).split('|')[1]); }
  timers.value?.dispose?.();
  if (Date.now() - t0 > LIMITE_MS) { cuelga = true; break; }
  dormir(pendientes > 0 ? 25 : 4);
  estado = ctx.getPromiseState(promesa);
}

const logsHandle = ctx.evalCode('JSON.stringify(__logs)');
const logs = logsHandle.error ? [] : JSON.parse(ctx.getString(logsHandle.value));

if (cuelga) {
  console.error('CUELGA: getStreams no resolvió en ' + LIMITE_MS + 'ms (¿espera un timer o una promesa que nunca llega?)');
  console.error('  últimos logs:', JSON.stringify(logs.slice(-8), null, 1));
  process.exit(6);
}
if (estado.type === 'rejected') { console.error('rechazó:', JSON.stringify(ctx.dump(estado.value)).slice(0, 800)); process.exit(4); }

const salida = JSON.parse(ctx.getString(estado.value));
console.log(JSON.stringify({ provider: path.basename(ruta), caso: `${tipo} ${tmdb}` + (season !== 'null' ? ` S${season}E${episode}` : ''), ...salida, ms: Date.now() - t0, logs: logs.slice(0, 60) }, null, 1));
