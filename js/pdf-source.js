/* ==========================================================
   pdf-source.js — Fuentes de páginas para la revista.
   - PDF (PDF.js local en assets/vendor/pdfjs/): detecta la cantidad de
     páginas y sus dimensiones, y renderiza cada página sin deformarla.
   - Imágenes (alternativa): usa la lista article.pages.

   Una fuente expone:
     n         cantidad de páginas
     ratio     alto/ancho de la página de portada (define la "hoja" de la revista)
     book(i,w) Promise<{url}>  imagen de la página i para el libro, de ancho w
                               (si el PDF mezcla tamaños, la página se centra con
                               márgenes blancos dentro de la hoja: nunca se estira)
     zoom(i,w) Promise<{url,w,h}>  página i con su proporción ORIGINAL, ancho w
     ratioOf(i) Promise<number>
     destroy() libera memoria
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});
  var VENDOR = 'assets/vendor/pdfjs/';
  var libP = null, docs = {};

  function abs(u) { return new URL(u, document.baseURI).href; }

  function lib() {
    if (!libP) {
      libP = import(abs(VENDOR + 'pdf.min.mjs')).then(function (m) {
        m.GlobalWorkerOptions.workerSrc = abs(VENDOR + 'pdf.worker.min.mjs');
        return m;
      });
    }
    return libP;
  }

  function loadDoc(url) {
    if (!docs[url]) {
      docs[url] = lib().then(function (pdfjs) {
        return pdfjs.getDocument({ url: abs(url), standardFontDataUrl: abs(VENDOR + 'standard_fonts/') }).promise;
      });
      docs[url].catch(function () { delete docs[url]; });
    }
    return docs[url];
  }

  function toBlobUrl(cv) {
    return new Promise(function (res) {
      cv.toBlob(function (b) { res(URL.createObjectURL(b)); }, 'image/jpeg', 0.92);
    });
  }

  function pdfSource(a) {
    return loadDoc(a.pdf).then(function (doc) {
      return doc.getPage(1).then(function (p1) {
        var v1 = p1.getViewport({ scale: 1 }), ratio = v1.height / v1.width;
        var bookCache = {}, zoomCache = {}, urls = [];

        /** Dibuja la página i en un lienzo cw×ch; si ch = 0 usa su proporción original. */
        function draw(i, cw, ch) {
          return doc.getPage(i + 1).then(function (pg) {
            var v = pg.getViewport({ scale: 1 });
            cw = Math.round(cw); ch = ch ? Math.round(ch) : Math.round(cw * v.height / v.width);
            var sc = Math.min(cw / v.width, ch / v.height), vp = pg.getViewport({ scale: sc });
            vp = pg.getViewport({ scale: sc, offsetX: (cw - vp.width) / 2, offsetY: (ch - vp.height) / 2 });
            var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
            var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
            return pg.render({ canvasContext: ctx, canvas: cv, viewport: vp }).promise.then(function () {
              return toBlobUrl(cv).then(function (url) { urls.push(url); return { url: url, w: cw, h: ch }; });
            });
          });
        }
        function cached(cache, key, make) { return cache[key] || (cache[key] = make()); }

        return {
          n: doc.numPages, ratio: ratio, isPdf: true,
          book: function (i, w) { return cached(bookCache, i + ':' + w, function () { return draw(i, w, w * ratio); }); },
          zoom: function (i, w) { return cached(zoomCache, i + ':' + w, function () { return draw(i, w, 0); }); },
          ratioOf: function (i) { return doc.getPage(i + 1).then(function (pg) { var v = pg.getViewport({ scale: 1 }); return v.height / v.width; }); },
          destroy: function () { urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = []; bookCache = {}; zoomCache = {}; }
        };
      });
    });
  }

  function imageSource(a) {
    var pages = a.pages;
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im.naturalHeight / im.naturalWidth); };
      im.onerror = function () { res(1100 / 800); };
      im.src = pages[0];
    }).then(function (ratio) {
      function get(i) { return Promise.resolve({ url: pages[i] }); }
      return { n: pages.length, ratio: ratio, isPdf: false, book: get, zoom: get,
        ratioOf: function () { return Promise.resolve(ratio); }, destroy: function () {} };
    });
  }

  /** Abre la fuente de un artículo (PDF o lista de imágenes). */
  CC.openSource = function (a) {
    if (a.pdf) return pdfSource(a);
    if (a.pages && a.pages.length) return imageSource(a);
    return Promise.reject(new Error('El artículo no tiene "pdf" ni "pages".'));
  };

  /** Portada automática (página 1 del PDF) para artículos sin imagen de portada. */
  CC.coverFromPdf = function (a, w) {
    return loadDoc(a.pdf).then(function (doc) {
      return doc.getPage(1).then(function (pg) {
        var v = pg.getViewport({ scale: 1 }), sc = w / v.width, vp = pg.getViewport({ scale: sc });
        var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        return pg.render({ canvasContext: ctx, canvas: cv, viewport: vp }).promise.then(function () { return toBlobUrl(cv); });
      });
    });
  };
})();
