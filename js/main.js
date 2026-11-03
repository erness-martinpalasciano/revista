/* ==========================================================
   main.js — Arranque y conexión de módulos.
   Rutas por hash (funcionan también abriendo index.html directo):
     #/                  galería
     #/articulo/<id>     lector de revista
     #/autor/<slug>      artículos de un mismo estudiante
   ========================================================== */
(function () {
  'use strict';
  var CC = window.CC, doc = document;
  function $(s) { return doc.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  CC.fmtDate = function (iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  /* ---------- miniaturas ---------- */
  function card(a) {
    return '<a class="card" href="#/articulo/' + encodeURIComponent(a.id) + '">' +
      '<div class="card-img"><img src="' + esc(a.cover) + '" alt="Portada de ' + esc(a.title) + '" loading="lazy" width="480" height="660"></div>' +
      '<div class="card-body"><h3>' + esc(a.title) + '</h3>' +
      (a.author ? '<p class="by">' + esc(a.author) + '</p>' : '') +
      (a.date ? '<p><time datetime="' + a.date + '">' + CC.fmtDate(a.date) + '</time></p>' : '') + '</div>' +
      '<span class="num" title="Identificación">' + esc(a.number || '00') + '</span></a>';
  }
  CC.renderCards = function (el, list) {
    el.innerHTML = list.length ? list.map(card).join('') : '<p class="empty">No encontramos artículos con esos datos. Probá con otro autor, tema o fecha.</p>';
  };

  /* ---------- sonido de hojas (con silencio recordado) ---------- */
  var snd = { muted: false, base: new Audio('assets/sounds/page-flip.wav') };
  snd.base.preload = 'auto';
  try { snd.muted = localStorage.getItem('cc-muted') === '1'; } catch (e) {}
  snd.play = function () {
    if (snd.muted) return;
    var a = snd.base.cloneNode(); a.volume = 0.8;
    var p = a.play(); if (p && p.catch) p.catch(function () {});
  };
  var btnSound = $('#fbSound');
  function paintSound() {
    btnSound.textContent = snd.muted ? '🔇' : '🔊';
    btnSound.setAttribute('aria-pressed', String(snd.muted));
    btnSound.setAttribute('aria-label', snd.muted ? 'Activar sonido de páginas' : 'Silenciar sonido de páginas');
  }
  btnSound.addEventListener('click', function () {
    snd.muted = !snd.muted; try { localStorage.setItem('cc-muted', snd.muted ? '1' : '0'); } catch (e) {}
    paintSound();
  });
  paintSound();

  /* ---------- menú lateral ---------- */
  var side = $('#sidePanel'), overlay = $('#overlay'), btnMenu = $('#btnMenu'), lastFocus = null;
  side.inert = true;
  function menu(open) {
    if (open) lastFocus = doc.activeElement;
    side.classList.toggle('open', open); overlay.classList.toggle('show', open);
    side.setAttribute('aria-hidden', String(!open)); side.inert = !open;
    btnMenu.setAttribute('aria-expanded', String(open));
    if (open) $('#menuClose').focus(); else if (lastFocus) lastFocus.focus();
  }
  btnMenu.addEventListener('click', function () { menu(!side.classList.contains('open')); });
  $('#menuClose').addEventListener('click', function () { menu(false); });
  overlay.addEventListener('click', function () { menu(false); });
  side.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) menu(false); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && side.classList.contains('open')) menu(false); });
  $('#accAct').addEventListener('click', function (e) {
    var sub = $('#subAct'), open = !sub.classList.contains('open');
    sub.classList.toggle('open', open); e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  /* ---------- lector de revista ---------- */
  var fb = null, currentArticle = null, views = { home: $('#viewHome'), reader: $('#viewReader'), author: $('#viewAuthor') };
  var range = $('#fbRange'), prevB = $('#fbPrev'), nextB = $('#fbNext');

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    doc.body.classList.toggle('reading', name === 'reader');
    if (fb && name !== 'reader') { fb.destroy(); fb = null; }
  }

  function openReader(a) {
    show('reader');
    doc.title = a.title + ' · Revista Científica ConCiencia';
    $('#readerTitle').textContent = a.title;
    // Autor y fecha: si están vacíos, no se muestra ninguna etiqueta ni texto de relleno.
    $('#infoAuthor').textContent = a.author ? 'Artículo escrito por: ' + a.author : '';
    $('#infoAuthor').hidden = !a.author;
    $('#infoDate').textContent = a.date ? 'Fecha de publicación: ' + CC.fmtDate(a.date) : '';
    $('#infoDate').hidden = !a.date;
    $('#moreByAuthor').href = '#/autor/' + a.authorSlug; $('#moreByAuthor').hidden = !a.authorSlug;
    $('#authorInfo').hidden = !a.author && !a.date;
    fitStage();
    fb = CC.createFlipbook({
      stage: $('#fbStage'), book: $('#fbBook'), pages: a.pages, title: a.title, sound: snd,
      onZoom: function (i) { zoomPage(a, i); },
      onChange: function (s) {
        range.max = s.max; range.value = s.t; $('#fbIndicator').textContent = s.label;
        prevB.disabled = s.atStart; nextB.disabled = s.atEnd;
      }
    });
    $('#fbStage').focus({ preventScroll: true });
    currentArticle = a;
  }

  /** Ajusta la altura del lector al espacio libre de la ventana para ver la revista completa sin desplazarse. */
  function fitStage() {
    if (views.reader.hidden) return;
    var st = $('#fbStage'), top = st.getBoundingClientRect().top + window.pageYOffset;
    var h = Math.floor(window.innerHeight - top - $('#fbDock').offsetHeight - 22);
    st.style.height = Math.max(360, Math.min(1000, h)) + 'px';
  }
  window.addEventListener('resize', fitStage);

  /** Lectura ampliada (solo lectura): al cerrar, la revista vuelve a la página leída. */
  function zoomPage(a, i) {
    if (!fb) return;
    CC.openZoom({ pages: a.pages, title: a.title, index: i, onClose: function (k) {
      if (fb) { fb.showPage(k); $('#fbStage').focus({ preventScroll: true }); }
    } });
  }
  $('#fbZoom').addEventListener('click', function () { if (fb && currentArticle) zoomPage(currentArticle, fb.currentPage()); });
  // Los botones laterales no deben robar el foco ni provocar desplazamientos.
  [prevB, nextB].forEach(function (b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); }); });
  prevB.addEventListener('click', function () { if (fb) fb.prev(); });
  nextB.addEventListener('click', function () { if (fb) fb.next(); });
  range.addEventListener('input', function () { if (fb) fb.goTo(+range.value); });

  function openAuthor(slug) {
    var list = CC.byAuthor(slug);
    show('author');
    if (!list.length) { $('#authorTitle').textContent = 'No encontramos a ese estudiante'; CC.renderCards($('#authorGrid'), []); return; }
    $('#authorTitle').textContent = 'Artículos de ' + list[0].author;
    doc.title = 'Artículos de ' + list[0].author + ' · ConCiencia';
    CC.renderCards($('#authorGrid'), list);
  }

  /* ---------- rutas ---------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, '').split('/'), id = decodeURIComponent(h[1] || '');
    var a = h[0] === 'articulo' ? CC.getArticle(id) : null;
    if (a) openReader(a);
    else if (h[0] === 'autor') openAuthor(id);
    else { show('home'); doc.title = 'Revista Científica · ConCiencia'; }
    if (h[0] === 'articulo' || h[0] === 'autor') window.scrollTo(0, 0);
  }
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !views.reader.hidden && !doc.body.classList.contains('zooming') && !side.classList.contains('open') && !$('#searchPanel').classList.contains('open')) location.hash = '#/';
  });
  $('#skipLink').addEventListener('click', function (e) { e.preventDefault(); $('#contenido').focus(); });

  /* ---------- inicio ---------- */
  CC.renderCards($('#gallery'), CC.articles);
  CC.initSearch();
  CC.initAssistant();
  window.addEventListener('hashchange', route);
  route();
})();
