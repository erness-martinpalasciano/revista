/* ==========================================================
   flipbook.js — Revista digital con hojas de papel que se curvan.
   Sin dependencias. Mientras una hoja se mueve se descompone en
   tiras verticales articuladas (16 bisagras): cada tira gira un poco
   más que la anterior, lo que genera la curvatura del papel. Además:
   - sombra propia por tira según su inclinación (volumen),
   - sombra proyectada sobre la página de abajo,
   - aceleración/desaceleración suaves (curva senoidal),
   - páginas cargadas a demanda desde una "fuente" (PDF o imágenes).
   Pantalla ancha: páginas enfrentadas. Angosta: una por vez.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});
  var BREAK = 820;   // por debajo de este ancho: una sola página
  var K = 16;        // tiras por hoja durante el giro
  var BEND = 46;     // curvatura máxima (grados acumulados en el borde libre)
  var OV = 0.8;      // solape entre tiras para evitar costuras

  function el(cls, tag) { var d = document.createElement(tag || 'div'); d.className = cls; return d; }

  /**
   * o: { stage, book, source, title, sound, onChange(info), onZoom(pageIndex) }
   * source: ver pdf-source.js (n, ratio, book(i,w))
   */
  CC.createFlipbook = function (o) {
    var stage = o.stage, book = o.book, src = o.source, n = src.n, RATIO = src.ratio, title = o.title || '';
    var sound = o.sound, notify = o.onChange || function () {};
    var single = false, leaves = [], t = 0, pw = 0, ph = 0, drag = null, ro = null, timer = 0, lastTap = null;
    var qW = 0, res = [], castL, castR, dead = false;

    function maxT() { return single ? n - 1 : leaves.length; }

    /* ---------- páginas (carga a demanda) ---------- */
    function need(i) {
      if (i < 0 || i >= n || res[i]) return;
      var r = res[i] = { url: null };
      src.book(i, qW).then(function (x) { if (dead) return; r.url = x.url; repaint(i); })
        .catch(function () { r.err = true; });
    }
    function prefetch() {
      var c = single ? t : 2 * t, order = [0, -1, 1, 2, 3, -2, 4, 5];
      order.forEach(function (d) { need(c + d); });
    }
    function paint(f, idx) {
      if (idx < 0 || idx >= n) { f.classList.add('blank'); return; }
      var r = res[idx];
      if (r && r.url) {
        var im = f.querySelector('img');
        if (!im) { im = new Image(); im.draggable = false; im.alt = 'Página ' + (idx + 1) + ' de «' + title + '»'; f.insertBefore(im, f.firstChild); }
        if (im.getAttribute('src') !== r.url) im.src = r.url;
        f.classList.remove('loading');
      } else f.classList.add('loading');
    }
    function paintStrips(L) {
      if (!L.strips) return;
      var rf = res[L.fi], rb = L.bi < n ? res[L.bi] : null;
      L.strips.forEach(function (s) {
        s.f.style.backgroundImage = rf && rf.url ? 'url("' + rf.url + '")' : 'none';
        s.b.style.backgroundImage = rb && rb.url ? 'url("' + rb.url + '")' : 'none';
      });
    }
    function repaint(i) {
      leaves.forEach(function (L) {
        if (L.fi === i) { paint(L.fc, i); paintStrips(L); }
        if (L.bi === i) { paint(L.bc, i); paintStrips(L); }
      });
    }

    /* ---------- construcción ---------- */
    function face(cls) { var d = el('face ' + cls); d.appendChild(el('shade')); return d; }

    function mount(rightIdx) {
      cancelAll(); book.innerHTML = ''; leaves = [];
      var count = single ? n : Math.ceil(n / 2);
      for (var j = 0; j < count; j++) {
        var L = { el: el('leaf'), flat: el('flat'), fc: face('front'), bc: face('back'), angle: 0, raf: 0, curl: null, strips: null,
                  fi: single ? j : 2 * j, bi: single ? -1 : 2 * j + 1 };
        L.fs = L.fc.lastChild; L.bs = L.bc.lastChild;
        L.flat.appendChild(L.fc); L.flat.appendChild(L.bc); L.el.appendChild(L.flat);
        book.appendChild(L.el); leaves.push(L);
        paint(L.fc, L.fi); paint(L.bc, L.bi);
      }
      castR = el('cast cast-r'); castL = el('cast cast-l'); book.appendChild(castR); book.appendChild(castL);
      t = single ? Math.min(rightIdx, n - 1) : Math.min(Math.floor(rightIdx / 2), count);
      resize(); settle(); update();
    }

    function resize() {
      var aw = stage.clientWidth, ah = stage.clientHeight;
      pw = Math.floor(Math.min(aw / (single ? 1 : 2), ah / RATIO)); ph = Math.floor(pw * RATIO);
      if (!qW) {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var big = Math.min(screen.height * 0.85 / RATIO, screen.width / (single ? 1 : 2));
        qW = Math.max(700, Math.min(1700, Math.round(Math.max(pw, big) * dpr)));
      }
      book.style.width = (single ? pw : pw * 2) + 'px'; book.style.height = ph + 'px';
      leaves.forEach(function (L) {
        L.el.style.left = (single ? 0 : pw) + 'px'; L.el.style.width = pw + 'px'; L.el.style.height = ph + 'px';
        if (L.curl) { L.curl.remove(); L.curl = null; L.strips = null; }   // se reconstruye con el nuevo tamaño
      });
      [castR, castL].forEach(function (c) { c.style.height = ph + 'px'; });
      shift();
    }

    /** Centra la portada (t=0) y la contraportada (t=max), como en una revista real. */
    function shift() {
      var x = 0;
      if (!single) { if (t === 0) x = -pw / 2; else if (t === leaves.length) x = pw / 2; }
      book.style.transform = 'translateX(' + x + 'px)';
      book.classList.toggle('at-start', !single && t === 0);
      book.classList.toggle('at-end', !single && t === leaves.length);
    }

    /* ---------- hoja curvada (tiras articuladas) ---------- */
    function buildCurl(L) {
      var sw = pw / K, root = el('curl'), parent = root; L.strips = [];
      for (var k = 0; k < K; k++) {
        var s = el('strip'), f = el('sf'), b = el('sb'), fsh = el('shade'), bsh = el('shade');
        s.style.width = (sw + OV) + 'px'; s.style.left = (k ? sw : 0) + 'px';
        f.style.backgroundSize = pw + 'px ' + ph + 'px'; f.style.backgroundPosition = (-k * sw) + 'px 0';
        b.style.backgroundSize = pw + 'px ' + ph + 'px'; b.style.backgroundPosition = (-(pw - (k + 1) * sw - OV)) + 'px 0';
        f.appendChild(fsh); b.appendChild(bsh); s.appendChild(f); s.appendChild(b);
        parent.appendChild(s); parent = s;
        L.strips.push({ el: s, f: f, b: b, fs: fsh, bs: bsh });
      }
      root.style.display = 'none'; L.el.appendChild(root); L.curl = root; paintStrips(L);
    }
    function useCurl(L, on) {
      if (on) { if (!L.curl) buildCurl(L); L.flat.style.display = 'none'; L.curl.style.display = 'block'; }
      else { if (L.curl) L.curl.style.display = 'none'; L.flat.style.display = 'block'; }
    }

    /** Aplica el ángulo base de la hoja y, si se está moviendo, su curvatura y sus sombras. */
    function setAngle(j, a, moving) {
      var L = leaves[j]; L.angle = a;
      if (!moving) {
        L.el.style.transform = 'rotateY(' + a + 'deg)'; L.fs.style.opacity = 0; L.bs.style.opacity = 0; return;
      }
      L.el.style.transform = 'translateZ(2px) rotateY(' + a + 'deg)';
      var p = Math.min(1, Math.abs(a) / 180);
      // El borde libre se adelanta al levantar la hoja y se atrasa al apoyarla.
      var d = -BEND * Math.sin(2 * Math.PI * p) / (K - 1);
      for (var k = 0; k < K; k++) {
        var S = L.strips[k], phi = (a + k * d) * Math.PI / 180, c = Math.cos(phi), dark = 0.5 * (1 - Math.abs(c));
        S.el.style.transform = k ? 'rotateY(' + d + 'deg)' : 'none';
        S.fs.style.opacity = c > 0 ? dark : 0; S.bs.style.opacity = c < 0 ? dark : 0;
      }
      castShadow(a);
    }

    /** Sombra proyectada por la hoja en movimiento sobre la página que queda debajo. */
    function castShadow(a) {
      var abs = Math.abs(a), r = abs * Math.PI / 180, s = Math.sin(r), c = Math.cos(r), op = 0.46 * Math.pow(s, 0.8);
      var right = abs < 90, wR = Math.min(pw, pw * Math.max(c, 0) + pw * 0.16), wL = Math.min(pw, pw * Math.max(-c, 0) + pw * 0.16);
      castR.style.left = (single ? 0 : pw) + 'px'; castR.style.width = wR + 'px'; castR.style.opacity = right ? op : 0;
      castL.style.left = (pw - wL) + 'px'; castL.style.width = wL + 'px'; castL.style.opacity = (!single && !right) ? op : 0;
    }
    function hideCast() { if (castR) { castR.style.opacity = 0; castL.style.opacity = 0; } }
    function anyMoving() { return !!drag && drag.moved || leaves.some(function (L) { return L.raf; }); }

    function fixZ(j) { var L = leaves[j]; L.el.style.zIndex = L.angle <= -90 ? j + 1 : leaves.length - j; }
    function settle() {
      leaves.forEach(function (L, j) { useCurl(L, false); setAngle(j, j < t ? -180 : 0, false); fixZ(j); }); hideCast();
    }
    function cancelAll() { leaves.forEach(function (L) { if (L.raf) cancelAnimationFrame(L.raf); L.raf = 0; }); }

    /** Anima la hoja j hasta el ángulo "to" con arranque y frenado suaves. */
    function animate(j, to) {
      var L = leaves[j]; if (L.raf) cancelAnimationFrame(L.raf);
      var from = L.angle, start = performance.now(), dur = 560 + 520 * Math.abs(to - from) / 180;
      useCurl(L, true); L.el.style.zIndex = 1000 + j;
      (function step(now) {
        var p = Math.min(1, (now - start) / dur), e = (1 - Math.cos(Math.PI * p)) / 2;
        setAngle(j, from + (to - from) * e, true);
        if (p < 1) L.raf = requestAnimationFrame(step);
        else { L.raf = 0; setAngle(j, to, false); useCurl(L, false); fixZ(j); if (!anyMoving()) hideCast(); }
      })(start);
      return dur;
    }

    /* ---------- estado e indicador ---------- */
    function label() {
      if (single) return 'Página ' + (t + 1) + ' de ' + n;
      if (t === 0) return 'Portada · página 1 de ' + n;
      var l = 2 * t, r = 2 * t + 1;
      if (r > n) return (l >= n ? 'Contraportada · ' : 'Página ') + Math.min(l, n) + ' de ' + n;
      return 'Páginas ' + l + '–' + r + ' de ' + n;
    }
    function update() {
      shift(); prefetch();
      notify({ t: t, max: maxT(), label: label(), atStart: t === 0, atEnd: t >= maxT() });
    }

    /* ---------- acciones públicas ---------- */
    function next() { if (t >= maxT()) return; var j = t++, d = animate(j, -180); if (sound) sound.play(d); update(); }
    function prev() { if (t <= 0) return; t--; var d = animate(t, 0); if (sound) sound.play(d); update(); }
    function goTo(k) { t = Math.max(0, Math.min(maxT(), k)); cancelAll(); settle(); update(); }

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
        var L = leaves[drag.j]; if (L.raf) { cancelAnimationFrame(L.raf); L.raf = 0; }
        useCurl(L, true); L.el.style.zIndex = 2000;
        try { stage.setPointerCapture(drag.id); } catch (x) {}
      }
      var p = Math.min(1, Math.abs(dx) / (pw * 1.2)); drag.p = p;
      setAngle(drag.j, drag.dir === 1 ? -180 * p : -180 * (1 - p), true);
    }
    function onUp(e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.moved) {
        var fast = Math.abs(e.clientX - d.x0) / Math.max(1, performance.now() - d.tm) > 0.45, commit = d.p > 0.3 || fast, dur;
        if (d.dir === 1) { if (commit) { t++; dur = animate(d.j, -180); if (sound) sound.play(dur); } else animate(d.j, 0); }
        else { if (commit) { t--; dur = animate(d.j, 0); if (sound) sound.play(dur); } else animate(d.j, -180); }
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
    function pageAt(f) {
      if (single) return t;
      if (f < 0.5) return t > 0 ? 2 * t - 1 : -1;
      return 2 * t < n ? 2 * t : -1;
    }
    function currentPage() { return single ? t : (2 * t < n ? 2 * t : 2 * t - 1); }
    function showPage(i) { i = Math.max(0, Math.min(n - 1, i)); goTo(single ? i : Math.ceil(i / 2)); }
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
    function onCancel() { if (drag && drag.moved) animate(drag.j, drag.dir === 1 ? 0 : -180); drag = null; }

    /* ---------- adaptación a tamaños ---------- */
    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (dead) return;
        var s = stage.clientWidth < BREAK;
        if (s !== single) { var idx = single ? t : 2 * t; single = s; mount(idx); } else resize();
      }, 80);
    }

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
    if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(stage); } else window.addEventListener('resize', onResize);

    single = stage.clientWidth < BREAK;
    mount(0);

    return {
      next: next, prev: prev, goTo: goTo, showPage: showPage, currentPage: currentPage,
      destroy: function () {
        dead = true; cancelAll(); clearTimeout(timer);
        document.removeEventListener('keydown', onKey);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
        stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerup', onUp); stage.removeEventListener('pointercancel', onCancel);
        book.innerHTML = '';
      }
    };
  };
})();
