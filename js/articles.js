/* ==========================================================
   articles.js — ÚNICO lugar donde se registran los artículos.
   Para agregar uno: copiá un objeto de RAW, cambiá los datos y
   dejá sus páginas en assets/articles/<id>/01.jpg, 02.jpg, …
   Todo lo demás (galería, buscador, autores, lector) se arma solo.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});

  var RAW = [
    {
      id: 'demo-01',                      // identificador único (se usa en la URL)
      title: 'La historia del club de ciencias ConCiencia',
      author: '',                         // vacío por ahora (completar con el nombre del estudiante)
      date: '',                           // vacío por ahora (formato AAAA-MM-DD)
      topic: 'Club de ciencias',
      cover: 'assets/images/covers/demo-01.jpg',
      pagesPath: 'assets/articles/demo-01/', // carpeta con las páginas
      pageCount: 8,                       // 01.jpg … 08.jpg
      pageExt: 'jpg',
      number: '00',                       // identificación numérica de la miniatura
      demo: true
    }
    // Alternativa a pagesPath/pageCount: pages: ['ruta/p1.jpg', 'ruta/p2.jpg', …]
  ];

  /** Texto → identificador sin tildes ni espacios ("Ana Pérez" → "ana-perez"). */
  CC.slug = function (s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /** Normaliza cada artículo: calcula autor-slug y lista de páginas. */
  CC.articles = RAW.map(function (a) {
    var pages = a.pages;
    if (!pages) {
      pages = [];
      for (var i = 1; i <= a.pageCount; i++) pages.push(a.pagesPath + pad(i) + '.' + (a.pageExt || 'jpg'));
    }
    var o = {};
    for (var k in a) o[k] = a[k];
    o.pages = pages; o.pageCount = pages.length; o.authorSlug = a.author ? CC.slug(a.author) : '';
    return o;
  }).sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); }); // más recientes primero

  CC.getArticle = function (id) {
    return CC.articles.filter(function (a) { return a.id === id; })[0] || null;
  };
  /** Relación autor → artículos, generada automáticamente. */
  CC.byAuthor = function (slug) {
    return slug ? CC.articles.filter(function (a) { return a.authorSlug === slug; }) : [];
  };
})();
