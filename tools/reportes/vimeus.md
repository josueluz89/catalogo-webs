# vimeus — portado desde latinokodi/latinuvio-V2 (providers/vimeus.js)

- Sitio: vimeus.com
- Cambios vs el original: adaptado a QuickJS (sin Buffer, sin require('crypto'/'https'), sin
  matchAll ni String.normalize; helpers hermanos inlineados), `axios` → `fetch`, cripto con
  crypto-js empaquetado, y **filtro final a español latino y subtitulado** (se descartan
  `Esp`/`Castellano`/`SPA`/`dual`). Vimeos 1080p con etiqueta [Latino]. Se inlineó ./stream_labels.js (que no aportaba nada) y se añadió el filtro latino/sub.

## Verificación (QuickJS real)

```bash
$ node build.js vimeus
$ node tools/qjs-correr.mjs providers/vimeus.js 693134 movie
$ node tools/qjs-correr.mjs providers/vimeus.js 76479 tv 3 1
```

Streams medidos: **693134 movie → 1 · 76479 tv 3 1 → 1**, todos con `language` `Latino` o `Subtitulado`, cero castellano.
