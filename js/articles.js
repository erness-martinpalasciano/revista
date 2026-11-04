/* ==========================================================
   articles.js — ÚNICO lugar donde se registran los artículos.

   Para agregar una publicación:
     1) Copiá el PDF a assets/articles/  (ej.: article-01.pdf)
     2) Copiá su portada a assets/images/ (ej.: article-01-cover.jpg)
     3) Agregá un objeto a RAW (copiá el anterior y cambiá los datos).
   El resto (galería, buscador, autores, lector) se arma solo.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});

  var RAW = [
    {
      id: '00',                                   // identificador (también es el número de la miniatura)
      title: 'La historia del club de ciencias ConCiencia',
      authors: ['Eduardo Zorzoli', 'Gustavo Fernández', 'Agustín Moya'],
      date: '06/11/2026',                         // DD/MM/AAAA (también acepta AAAA-MM-DD)
      category: 'Institucional',
      relatedLabel: 'Más artículos escritos por estos profesores:', // opcional: encabezado propio de la sección "más artículos"
      cover: 'assets/images/article-00-cover.jpg', // opcional: si falta, se genera con la página 1 del PDF
      pdf: 'assets/articles/article-00.pdf'
    }
    // Alternativa sin PDF: pages: ['ruta/p1.jpg', 'ruta/p2.jpg', …]
  ];

  /** Texto → identificador sin tildes ni espacios ("Ana Pérez" → "ana-perez"). */
  CC.slug = function (s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  /** Fecha DD/MM/AAAA o AAAA-MM-DD → { iso, text }. Vacía si no hay fecha. */
  function parseDate(s) {
    s = String(s || '').trim(); var m;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return { iso: m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2), text: ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3] };
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return { iso: s, text: m[3] + '/' + m[2] + '/' + m[1] };
    return { iso: '', text: '' };
  }

  /** Completa los campos derivados de un artículo. */
  function normalize(a) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    var authors = a.authors || (a.author ? [a.author] : []);
    o.authors = authors.filter(Boolean);
    o.authorSlugs = o.authors.map(CC.slug);
    var d = parseDate(a.date); o.dateISO = d.iso; o.dateText = d.text;
    o.topic = a.category || a.topic || '';
    o.number = a.number || a.id;
    o.pages = a.pages || null;
    return o;
  }

  CC.articles = [];
  /** Agrega un artículo en tiempo de ejecución (también lo usa la lista RAW). */
  CC.addArticle = function (raw) {
    CC.articles.push(normalize(raw));
    CC.articles.sort(function (x, y) { return (y.dateISO || '').localeCompare(x.dateISO || ''); });
  };
  RAW.forEach(CC.addArticle);

  CC.getArticle = function (id) {
    return CC.articles.filter(function (a) { return a.id === id; })[0] || null;
  };
  /** Relación autor → artículos, generada automáticamente. */
  CC.byAuthor = function (slug) {
    return slug ? CC.articles.filter(function (a) { return a.authorSlugs.indexOf(slug) !== -1; }) : [];
  };
  /** Nombre visible de un autor a partir de su slug. */
  CC.authorName = function (slug) {
    for (var i = 0; i < CC.articles.length; i++) {
      var j = CC.articles[i].authorSlugs.indexOf(slug);
      if (j !== -1) return CC.articles[i].authors[j];
    }
    return '';
  };
  /** "A, B y C" */
  CC.joinNames = function (list) {
    return list.length < 2 ? (list[0] || '') : list.slice(0, -1).join(', ') + ' y ' + list[list.length - 1];
  };
})();
