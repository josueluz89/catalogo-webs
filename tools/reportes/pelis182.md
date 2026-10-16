# pelis182 — portado desde latinokodi/latinuvio-V2 (providers/pelis182.js)

- Sitio: pelis182.net
- Cambios vs el original: adaptado a QuickJS (sin Buffer, sin require('crypto'/'https'), sin
  matchAll ni String.normalize; helpers hermanos inlineados), `axios` → `fetch`, cripto con
  crypto-js empaquetado, y **filtro final a español latino y subtitulado** (se descartan
  `Esp`/`Castellano`/`SPA`/`dual`). Hoy solo devuelve streams en series (en película da 0): se añadió con esa limitación anotada en la descripción del manifest.

## Verificación (QuickJS real)

```bash
$ node build.js pelis182
$ node tools/qjs-correr.mjs providers/pelis182.js 693134 movie
$ node tools/qjs-correr.mjs providers/pelis182.js 76479 tv 3 1
```

Streams medidos: **1396 tv 1 1 → 1 · 693134 movie → 0**, todos con `language` `Latino` o `Subtitulado`, cero castellano.
