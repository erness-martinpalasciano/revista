/* ==========================================================
   main.js — Arranque y conexión de módulos.
   Rutas por hash:
     #/                  galería
     #/articulo/<id>     lector de revista
     #/autor/<slug>      artículos de un mismo estudiante
   ========================================================== */
(function () {
  'use strict';
  var CC = window.CC, doc = document;
  function $(s) { return doc.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  /* ---------- miniaturas ---------- */
  function card(a) {
    var cover = a.cover ? 'src="' + esc(a.cover) + '"' : 'src="' + BLANK + '" data-cover="' + esc(a.id) + '"';
    return '<a class="card" href="#/articulo/' + encodeURIComponent(a.id) + '">' +
      '<div class="card-img"><img ' + cover + ' alt="Portada de ' + esc(a.title) + '" loading="lazy" width="480" height="672"></div>' +
      '<div class="card-body"><h3>' + esc(a.title) + '</h3>' +
      (a.authors.length ? '<p class="by">' + esc(CC.joinNames(a.authors)) + '</p>' : '') +
      (a.dateText ? '<p><time datetime="' + a.dateISO + '">' + a.dateText + '</time></p>' : '') + '</div>' +
      '<span class="num" title="Identificación">' + esc(a.number) + '</span></a>';
  }
  /** Si un artículo no trae portada, se genera con la página 1 de su PDF. */
  function fillCovers(root) {
    root.querySelectorAll('img[data-cover]').forEach(function (im) {
      var a = CC.getArticle(im.getAttribute('data-cover')); im.removeAttribute('data-cover');
      if (a && a.pdf) CC.coverFromPdf(a, 480).then(function (u) { im.src = u; }).catch(function () {});
    });
  }
  CC.renderCards = function (el, list) {
    el.innerHTML = list.length ? list.map(card).join('') : '<p class="empty">No encontramos artículos con esos datos. Probá con otro autor, tema o fecha.</p>';
    fillCovers(el);
  };

  /* ---------- sonido de hojas: 4 variantes locales, volumen y velocidad levemente distintos ---------- */
  var snd = { muted: false, pool: [] };
  for (var i = 1; i <= 4; i++) { var au = new Audio('assets/sounds/page-flip-' + i + '.wav'); au.preload = 'auto'; snd.pool.push(au); }
  try { snd.muted = localStorage.getItem('cc-muted') === '1'; } catch (e) {}
  /** Las muestras tienen un roce suave que crece (~0.17 s) y luego el "golpe de papel" del audio de referencia.
      durMs: duración del giro (el sonido se acelera/frena para que su parte fuerte caiga en el tramo más rápido).
      desde: avance de la hoja al empezar el sonido (si ya va avanzada, se salta el roce inicial). */
  snd.play = function (durMs, desde) {
    if (snd.muted) return;
    var base = snd.pool[Math.floor(Math.random() * snd.pool.length)], a = base.cloneNode();
    var rate = 0.97 + Math.random() * 0.06;
    if (durMs) rate = Math.max(0.8, Math.min(1.25, 0.17 / (0.3 * durMs / 1000) * (0.97 + Math.random() * 0.06)));
    try { a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false; } catch (e) {}
    a.playbackRate = rate; a.volume = 0.55 + Math.random() * 0.15;
    if (desde > 0.25) { try { a.currentTime = 0.15; } catch (e) {} }
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
  var fb = null, src = null, token = 0, currentArticle = null;
  var views = { home: $('#viewHome'), reader: $('#viewReader'), author: $('#viewAuthor') };
  var range = $('#fbRange'), prevB = $('#fbPrev'), nextB = $('#fbNext'), status = $('#fbStatus');

  function closeReader() {
    token++;
    if (fb) { fb.destroy(); fb = null; }
    if (src) { src.destroy(); src = null; }
  }
  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    doc.body.classList.toggle('reading', name === 'reader');
    if (name !== 'reader') closeReader();
  }

  function moreBy(a) {
    var box = $('#moreBy');
    if (!a.authors.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (a.authors.length === 1) {
      box.innerHTML = '<a class="pill solid" href="#/autor/' + a.authorSlugs[0] + '">Más artículos escritos por este/a estudiante</a>';
    } else {
      box.innerHTML = '<p class="more-label">Más artículos escritos por estos/as estudiantes:</p><div class="more-list">' +
        a.authors.map(function (n, i) { return '<a class="pill solid" href="#/autor/' + a.authorSlugs[i] + '">' + esc(n) + '</a>'; }).join('') + '</div>';
    }
  }

  function openReader(a) {
    closeReader(); show('reader');
    var my = token;
    currentArticle = a;
    doc.title = a.title + ' · Revista Científica ConCiencia';
    $('#readerTitle').textContent = a.title;
    // Autores y fecha: si faltan, no se muestra ninguna etiqueta ni texto de relleno.
    $('#infoAuthor').textContent = a.authors.length ? 'Artículo escrito por: ' + CC.joinNames(a.authors) : '';
    $('#infoAuthor').hidden = !a.authors.length;
    $('#infoDate').textContent = a.dateText ? 'Fecha de publicación: ' + a.dateText : '';
    $('#infoDate').hidden = !a.dateText;
    moreBy(a);
    $('#authorInfo').hidden = !a.authors.length && !a.dateText;
    range.max = 1; range.value = 0; $('#fbIndicator').textContent = '';
    prevB.disabled = nextB.disabled = true;
    status.hidden = false; status.textContent = 'Cargando revista…';
    fitStage();
    CC.openSource(a).then(function (s) {
      if (my !== token) { s.destroy(); return; }
      src = s; status.hidden = true;
      fb = CC.createFlipbook({
        stage: $('#fbStage'), book: $('#fbBook'), source: s, title: a.title, sound: snd,
        onZoom: function (i) { zoomPage(a, i); },
        onChange: function (st) {
          range.max = st.max; range.value = st.t; $('#fbIndicator').textContent = st.label;
          prevB.disabled = st.atStart; nextB.disabled = st.atEnd;
        }
      });
      $('#fbStage').focus({ preventScroll: true });
    }).catch(function (err) {
      if (my !== token) return;
      status.hidden = false;
      status.textContent = location.protocol === 'file:'
        ? 'Para leer un PDF hay que abrir la revista desde un servidor (por ejemplo, la extensión Live Server de Visual Studio Code) o publicarla en Netlify. Con doble clic sobre index.html el navegador bloquea la lectura de archivos.'
        : 'No se pudo cargar «' + (a.pdf || 'el artículo') + '». Revisá que el archivo exista en esa ruta.';
      if (window.console) console.error(err);
    });
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
    if (!fb || !src) return;
    CC.openZoom({ source: src, title: a.title, index: i, onClose: function (k) {
      if (fb) { fb.showPage(k); $('#fbStage').focus({ preventScroll: true }); }
    } });
  }
  $('#fbZoom').addEventListener('click', function () { if (fb && currentArticle) zoomPage(currentArticle, fb.currentPage()); });
  prevB.addEventListener('click', function () { if (fb) fb.prev(); });
  nextB.addEventListener('click', function () { if (fb) fb.next(); });
  range.addEventListener('input', function () { if (fb) fb.goTo(+range.value); });
  // Los botones laterales no deben robar el foco ni provocar desplazamientos.
  [prevB, nextB].forEach(function (b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); }); });

  function openAuthor(slug) {
    var list = CC.byAuthor(slug);
    show('author');
    if (!list.length) { $('#authorTitle').textContent = 'No encontramos a ese estudiante'; CC.renderCards($('#authorGrid'), []); return; }
    var name = CC.authorName(slug);
    $('#authorTitle').textContent = 'Artículos de ' + name;
    doc.title = 'Artículos de ' + name + ' · ConCiencia';
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
