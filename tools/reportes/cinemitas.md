# cinemitas — portado desde latinokodi/latinuvio-V2 (providers/cinemitas.js)

- Sitio: cinemitas.org
- Cambios vs el original: adaptado a QuickJS (sin Buffer, sin require('crypto'/'https'), sin
  matchAll ni String.normalize; helpers hermanos inlineados), `axios` → `fetch`, cripto con
  crypto-js empaquetado, y **filtro final a español latino y subtitulado** (se descartan
  `Esp`/`Castellano`/`SPA`/`dual`). El sitio trae LATINO HD y CASTELLANO (Uqload): el filtro descarta el castellano antes de resolver. Helpers ./cdn_resolvers y ./stream_labels inlineados.

## Verificación (QuickJS real)

```bash
$ node build.js cinemitas
$ node tools/qjs-correr.mjs providers/cinemitas.js 693134 movie
$ node tools/qjs-correr.mjs providers/cinemitas.js 76479 tv 3 1
```

Streams medidos: **693134 movie → 1 · 76479 tv 3 1 → 1**, todos con `language` `Latino` o `Subtitulado`, cero castellano.
