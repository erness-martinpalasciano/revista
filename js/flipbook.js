/* ==========================================================
   flipbook.js — Revista digital con giro 3D de hojas.
   Sin dependencias. Cada hoja ("leaf") tiene frente y dorso y
   gira con CSS 3D alrededor del lomo. Soporta arrastre (mouse y
   táctil), clic en los bordes, teclado y sonido.
   - Pantalla ancha: páginas enfrentadas (portada sola a la derecha).
   - Pantalla angosta: una página por vez.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});
  var RATIO = 1100 / 800; // alto / ancho de página
  var BREAK = 820;        // por debajo de este ancho: una sola página

  CC.createFlipbook = function (o) {
    var stage = o.stage, book = o.book, pages = o.pages.slice(), title = o.title || '';
    var sound = o.sound, notify = o.onChange || function () {};
    var single = false, leaves = [], t = 0, pw = 0, ph = 0, drag = null, ro = null, timer = 0, lastTap = null;

    function maxT() { return single ? pages.length - 1 : leaves.length; }

    /* ---------- construcción ---------- */
    function face(cls, src, idx) {
      var d = document.createElement('div');
      d.className = 'face ' + cls + (src ? '' : ' blank');
      if (src) {
        var im = new Image();
        im.src = src; im.alt = 'Página ' + (idx + 1) + ' de «' + title + '»'; im.draggable = false; im.decoding = 'async';
        d.appendChild(im);
      }
      var s = document.createElement('div'); s.className = 'shade'; d.appendChild(s);
      return d;
    }

    function mount(rightIdx) {
      cancelAll(); book.innerHTML = ''; leaves = [];
      var n = pages.length, count = single ? n : Math.ceil(n / 2);
      for (var j = 0; j < count; j++) {
        var fi = single ? j : 2 * j, bi = single ? -1 : 2 * j + 1;
        var el = document.createElement('div'); el.className = 'leaf';
        var f = face('front', pages[fi], fi), b = face('back', bi >= 0 ? pages[bi] : null, bi);
        el.appendChild(f); el.appendChild(b);
        book.appendChild(el);
        leaves.push({ el: el, fs: f.lastChild, bs: b.lastChild, angle: 0, raf: 0 });
      }
      t = single ? Math.min(rightIdx, n - 1) : Math.min(Math.floor(rightIdx / 2), count);
      resize(); settle(); update();
    }

    function resize() {
      var aw = stage.clientWidth, ah = stage.clientHeight;
      pw = Math.floor(Math.min(aw / (single ? 1 : 2), ah / RATIO)); ph = Math.floor(pw * RATIO);
      book.style.width = (single ? pw : pw * 2) + 'px'; book.style.height = ph + 'px';
      leaves.forEach(function (L) {
        L.el.style.left = (single ? 0 : pw) + 'px'; L.el.style.width = pw + 'px'; L.el.style.height = ph + 'px';
      });
      shift();
    }

    /* Centra la portada (t=0) y la contraportada (t=max) como en una revista real. */
    function shift() {
      var x = 0;
      if (!single) { if (t === 0) x = -pw / 2; else if (t === leaves.length) x = pw / 2; }
      book.style.transform = 'translateX(' + x + 'px)';
      book.classList.toggle('at-start', !single && t === 0);
      book.classList.toggle('at-end', !single && t === leaves.length);
    }

    /* ---------- ángulos, sombras y animación ---------- */
    function setAngle(j, a) {
      var L = leaves[j]; L.angle = a; L.el.style.transform = 'rotateY(' + a + 'deg)';
      var abs = Math.abs(a), s = Math.sin(abs * Math.PI / 180);
      L.fs.style.opacity = abs < 90 ? abs / 90 * 0.9 : 0;
      L.bs.style.opacity = abs > 90 ? (180 - abs) / 90 * 0.9 : 0;
      L.el.style.boxShadow = s > 0.02 ? '0 0 ' + (s * 50) + 'px rgba(0,0,0,' + (s * 0.35) + ')' : 'none';
    }
    function fixZ(j) { var L = leaves[j]; L.el.style.zIndex = L.angle <= -90 ? j + 1 : leaves.length - j; }
    function settle() { for (var j = 0; j < leaves.length; j++) { setAngle(j, j < t ? -180 : 0); fixZ(j); } }
    function cancelAll() { leaves.forEach(function (L) { if (L.raf) cancelAnimationFrame(L.raf); L.raf = 0; }); }

    function animate(j, to) {
      var L = leaves[j]; if (L.raf) cancelAnimationFrame(L.raf);
      var from = L.angle, start = performance.now(), dur = 160 + 640 * Math.abs(to - from) / 180;
      L.el.style.zIndex = 1000 + j;
      (function step(now) {
        var p = Math.min(1, (now - start) / dur), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        setAngle(j, from + (to - from) * e);
        if (p < 1) L.raf = requestAnimationFrame(step); else { L.raf = 0; fixZ(j); }
      })(start);
    }

    /* ---------- estado e indicador ---------- */
    function label() {
      var n = pages.length;
      if (single) return 'Página ' + (t + 1) + ' de ' + n;
      if (t === 0) return 'Portada · página 1 de ' + n;
      var l = 2 * t, r = 2 * t + 1;
      if (r > n) return (l >= n ? 'Contraportada · ' : 'Página ') + Math.min(l, n) + ' de ' + n;
      return 'Páginas ' + l + '–' + r + ' de ' + n;
    }
    function update() {
      shift();
      notify({ t: t, max: maxT(), label: label(), atStart: t === 0, atEnd: t >= maxT() });
    }

    /* ---------- acciones públicas ---------- */
    function next() { if (t >= maxT()) return; var j = t++; animate(j, -180); if (sound) sound.play(); update(); }
    function prev() { if (t <= 0) return; t--; animate(t, 0); if (sound) sound.play(); update(); }
    function goTo(n) { t = Math.max(0, Math.min(maxT(), n)); cancelAll(); settle(); update(); }

    /* ---------- arrastre (mouse y táctil) y clics ---------- */
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.side-arrow')) return;
      drag = { x0: e.clientX, y0: e.clientY, id: e.pointerId, tm: performance.now(), moved: false, dir: 0, j: -1, p: 0 };
    }
    function onMove(e) {
      if (!drag) { hover(e); return; }
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        var dir = dx < 0 ? 1 : -1;               // 1: siguiente, -1: anterior
        if ((dir === 1 && t >= maxT()) || (dir === -1 && t <= 0)) { drag = null; return; }
        drag.moved = true; drag.dir = dir; drag.j = dir === 1 ? t : t - 1;
        if (leaves[drag.j].raf) cancelAnimationFrame(leaves[drag.j].raf);
        leaves[drag.j].el.style.zIndex = 2000;
        try { stage.setPointerCapture(drag.id); } catch (x) {}
      }
      var p = Math.min(1, Math.abs(dx) / (pw * 1.2)); drag.p = p; drag.last = dx;
      setAngle(drag.j, drag.dir === 1 ? -180 * p : -180 * (1 - p));
    }
    function onUp(e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.moved) {
        var fast = Math.abs(e.clientX - d.x0) / Math.max(1, performance.now() - d.tm) > 0.45;
        var commit = d.p > 0.3 || fast;
        if (d.dir === 1) { if (commit) { t++; animate(d.j, -180); if (sound) sound.play(); } else animate(d.j, 0); }
        else { if (commit) { t--; animate(d.j, 0); if (sound) sound.play(); } else animate(d.j, -180); }
        update(); return;
      }
      if (performance.now() - d.tm > 600) return;
      var r = book.getBoundingClientRect(), f = (e.clientX - r.left) / r.width;
      if (e.clientY < r.top || e.clientY > r.bottom || f < 0 || f > 1) return;
      var z = zone(f);
      if (z) { lastTap = null; if (z > 0) next(); else prev(); return; }   // bordes: pasar página
      var now = performance.now();                                          // centro: doble clic / doble toque = ampliar
      if (lastTap && now - lastTap.t < 350 && Math.abs(e.clientX - lastTap.x) < 30 && Math.abs(e.clientY - lastTap.y) < 30) {
        lastTap = null; var pi = pageAt(f); if (pi >= 0 && o.onZoom) o.onZoom(pi);
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    /** Zona lateral de la fracción horizontal f: 1 = siguiente, -1 = anterior, 0 = centro. */
    function zone(f) {
      var E = single ? 0.22 : 0.18;
      if (f > 1 - E && t < maxT()) return 1;
      if (f < E && t > 0) return -1;
      return 0;
    }
    /** Índice de la página bajo la fracción f (-1 si no hay página ahí). */
    function pageAt(f) {
      if (single) return t;
      if (f < 0.5) return t > 0 ? 2 * t - 1 : -1;
      return 2 * t < pages.length ? 2 * t : -1;
    }
    function currentPage() { return single ? t : (2 * t < pages.length ? 2 * t : 2 * t - 1); }
    function showPage(i) { i = Math.max(0, Math.min(pages.length - 1, i)); goTo(single ? i : Math.ceil(i / 2)); }
    function hover(e) {
      var r = book.getBoundingClientRect(), z = zone((e.clientX - r.left) / r.width);
      stage.style.cursor = z > 0 ? 'e-resize' : z < 0 ? 'w-resize' : 'grab';
    }
    function onKey(e) {
      if (document.body.classList.contains('zooming')) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); goTo(maxT()); }
    }

    /* ---------- adaptación a tamaños ---------- */
    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var s = stage.clientWidth < BREAK;
        if (s !== single) { var idx = single ? t : 2 * t; single = s; mount(idx); } else resize();
      }, 80);
    }

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    function onCancel() { if (drag && drag.moved) { animate(drag.j, drag.dir === 1 ? 0 : -180); } drag = null; }
    stage.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
    if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(stage); } else window.addEventListener('resize', onResize);

    single = stage.clientWidth < BREAK;
    mount(0);

    return {
      next: next, prev: prev, goTo: goTo, showPage: showPage, currentPage: currentPage,
      destroy: function () {
        cancelAll(); clearTimeout(timer);
        document.removeEventListener('keydown', onKey);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
        stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerup', onUp); stage.removeEventListener('pointercancel', onCancel);
        book.innerHTML = '';
      }
    };
  };
})();
