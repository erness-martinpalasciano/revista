/* ==========================================================
   pdf.js — Lee el PDF del artículo con PDF.js (copia local en js/vendor/)
   y entrega una lista de "páginas" para la revista y la lectura ampliada.
   Cada página: { w, h, src, render(ancho) → Promise<url>, hires(ancho) → Promise<url> }
   w/h son las dimensiones originales (relación de aspecto real).
   Requiere abrir el sitio por http(s) (Live Server, Netlify…), no con file://.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});
  var libP = null;

  function lib() {
    if (!libP) libP = import('./vendor/pdf.min.mjs').then(function (m) {
      m.GlobalWorkerOptions.workerSrc = new URL('js/vendor/pdf.worker.min.mjs', document.baseURI).href;
      return m;
    });
    return libP;
  }

  function toURL(canvas) {
    return new Promise(function (ok, no) {
      canvas.toBlob(function (b) { b ? ok(URL.createObjectURL(b)) : no(new Error('toBlob')); }, 'image/jpeg', 0.92);
    });
  }

  /** Renderiza una página PDF con el ancho (px de bitmap) indicado, sin deformarla. */
  function renderPdfPage(proxy, width) {
    var base = proxy.getViewport({ scale: 1 });
    var scale = Math.min(width / base.width, 4096 / Math.max(base.width, base.height));
    var vp = proxy.getViewport({ scale: scale });
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    return proxy.render({ canvasContext: ctx, canvas: cv, viewport: vp }).promise.then(function () { return toURL(cv); });
  }

  function fromPdf(url) {
    return lib().then(function (pdfjs) {
      return pdfjs.getDocument({
        url: url,
        standardFontDataUrl: new URL('js/vendor/standard_fonts/', document.baseURI).href
      }).promise;
    }).then(function (doc) {
      var jobs = [];
      for (var i = 1; i <= doc.numPages; i++) jobs.push(doc.getPage(i));
      return Promise.all(jobs).then(function (proxies) {
        var made = [];
        var pages = proxies.map(function (px) {
          var v = px.getViewport({ scale: 1 }), cache = null;
          return {
            w: v.width, h: v.height, src: null,
            render: function (w) { return renderPdfPage(px, w); },
            hires: function (w) {
              return renderPdfPage(px, w).then(function (u) { if (cache) URL.revokeObjectURL(cache); cache = u; return u; });
            }
          };
        });
        return { pages: pages, destroy: function () { pages.forEach(function (p) { if (p.src && p.src.indexOf('blob:') === 0) URL.revokeObjectURL(p.src); p.src = null; }); doc.destroy(); } };
      });
    });
  }

  /** Compatibilidad: artículos con lista de imágenes (pages: ['a.jpg', …]). */
  function fromImages(list) {
    return Promise.all(list.map(function (src) {
      return new Promise(function (ok, no) {
        var im = new Image(); im.onload = function () { ok({ w: im.naturalWidth, h: im.naturalHeight, src: src, render: function () { return Promise.resolve(src); }, hires: function () { return Promise.resolve(src); } }); };
        im.onerror = function () { no(new Error('No se pudo cargar ' + src)); }; im.src = src;
      });
    })).then(function (pages) { return { pages: pages, destroy: function () {} }; });
  }

  CC.loadPages = function (a) {
    if (a.pdf) return fromPdf(a.pdf);
    if (a.pages && a.pages.length) return fromImages(a.pages);
    return Promise.reject(new Error('El artículo no tiene PDF.'));
  };

  /** Miniatura (portada) generada desde la primera página, si falta la imagen de portada. */
  CC.pdfThumb = function (a) {
    return CC.loadPages(a).then(function (r) {
      return r.pages[0].render(480).then(function (u) { return { url: u, done: function () { r.destroy(); } }; });
    });
  };
})();
