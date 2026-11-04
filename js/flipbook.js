/* ==========================================================
   flipbook.js — Revista digital con hoja de papel flexible.
   Las páginas en reposo son imágenes normales (nítidas). Mientras
   una hoja se mueve, se dibuja con curl.js (WebGL): se levanta desde
   la esquina, se pliega en diagonal, se curva sobre un cilindro y se
   apoya sobre la otra página, con sombra dinámica.
   El mismo movimiento se usa al arrastrar (la hoja sigue al dedo o al
   mouse), con clic en los bordes y con el teclado.
   Pantalla ancha: páginas enfrentadas. Angosta: una por vez.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});
  var BREAK = 820;     // por debajo de este ancho: una sola página
  var LIFT = 0.34;     // cuánto sube la esquina al pasar la hoja (fracción del alto)
  var DRAG_GAIN = 1.3; // sensibilidad del arrastre
  var FLIP_MS = 720;   // duración de un giro completo

  function el(cls, tag) { var d = document.createElement(tag || 'div'); d.className = cls; return d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(x) { return x * x * (3 - 2 * x); }

  /** o: { stage, book, source, title, sound, onChange(info), onZoom(pageIndex) } */
  CC.createFlipbook = function (o) {
    var stage = o.stage, book = o.book, src = o.source, n = src.n, RATIO = src.ratio, title = o.title || '';
    var sound = o.sound, notify = o.onChange || function () {};
    var single = false, t = 0, pw = 0, ph = 0, qW = 0, dpr = 1, res = [], dead = false, ready = false;
    var anim = null, queue = [], drag = null, lastTap = null, ro = null, timer = 0, raf = 0, dragRaf = 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- DOM: dos páginas planas + lienzo para la hoja ---------- */
    function slot(cls) {
      var s = { el: el('pg ' + cls), img: new Image(), idx: -1, url: null };
      s.img.draggable = false; s.img.alt = ''; s.el.appendChild(s.img); book.appendChild(s.el); return s;
    }
    book.innerHTML = '';
    var sL = slot('l'), sR = slot('r');
    var canvas = el('fb-canvas', 'canvas'); stage.appendChild(canvas);
    var curl = reduce ? null : CC.createCurl(canvas);
    if (!curl) canvas.style.display = 'none';

    function maxT() { return single ? n - 1 : Math.ceil(n / 2); }

    /* ---------- páginas (carga a demanda) ---------- */
    function need(i) {
      if (i < 0 || i >= n || res[i]) return;
      var r = res[i] = { img: null, url: null };
      src.book(i, qW).then(function (x) {
        if (dead) return;
        var im = new Image(); im.decoding = 'async';
        im.onload = function () { if (dead || res[i] !== r) return; r.img = im; r.url = x.url; paintSlots(); };
        im.src = x.url;
      }).catch(function () {});
    }
    function prefetch() {
      var c = single ? t : 2 * t;
      [0, 1, -1, 2, 3, -2, 4, 5, -3].forEach(function (d) { need(c + d); });
    }
    function setSlot(s, idx) {
      if (idx < 0 || idx >= n) { s.el.style.visibility = 'hidden'; s.idx = -1; return; }
      s.el.style.visibility = 'visible';
      var r = res[idx];
      if (r && r.url) {
        if (s.url !== r.url) { s.img.src = r.url; s.url = r.url; }
        s.img.alt = 'Página ' + (idx + 1) + ' de «' + title + '»';
        s.img.style.visibility = 'visible'; s.el.classList.remove('loading');
      } else { s.img.style.visibility = 'hidden'; s.url = null; s.el.classList.add('loading'); }
      s.idx = idx;
    }
    /** Qué página muestra cada lado: en reposo según t; durante un giro, lo que hay debajo de la hoja. */
    function paintSlots() {
      var L, R;
      if (anim) {
        var j = anim.j;
        L = single ? -1 : (j > 0 ? 2 * j - 1 : -1);
        R = single ? (j + 1 < n ? j + 1 : -1) : (2 * j + 2 < n ? 2 * j + 2 : -1);
      } else {
        L = single ? -1 : (t > 0 ? 2 * t - 1 : -1);
        R = single ? t : (2 * t < n ? 2 * t : -1);
      }
      setSlot(sL, L); setSlot(sR, R);
    }

    /* ---------- tamaño y posición ---------- */
    function layout() {
      var aw = stage.clientWidth, ah = stage.clientHeight;
      if (!aw || !ah) return false;
      var s = aw < BREAK;
      if (ready && s !== single) {                     // cambio de modo: conserva la página que se estaba leyendo
        var i = single ? t : 2 * t; single = s;
        t = single ? Math.min(i, n - 1) : Math.min(Math.floor(i / 2), maxT());
      } else single = s;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      pw = Math.floor(Math.min(aw / (single ? 1 : 2), ah / RATIO)); ph = Math.floor(pw * RATIO);
      book.style.width = (single ? pw : 2 * pw) + 'px'; book.style.height = ph + 'px';
      sL.el.style.cssText = 'left:0;width:' + pw + 'px;height:' + ph + 'px;' + (single ? 'display:none' : '');
      sR.el.style.cssText = 'left:' + (single ? 0 : pw) + 'px;width:' + pw + 'px;height:' + ph + 'px';
      var w = Math.min(1600, Math.max(400, Math.ceil(pw * dpr / 100) * 100));
      if (w !== qW) { qW = w; res = []; sL.url = sR.url = null; if (curl) curl.dropAll(); }
      if (curl) { curl.resize(aw, ah, dpr); curl.clear(); }
      ready = true; shift(); return true;
    }
    /** Centra la portada (t=0) y la contraportada (t=max), como una revista real. */
    function shift() {
      var x = 0;
      if (!single) { if (t === 0) x = -pw / 2; else if (t >= maxT()) x = pw / 2; }
      book.style.transform = 'translateX(' + x + 'px)';
      book.classList.toggle('at-start', !single && t === 0);
      book.classList.toggle('at-end', !single && t >= maxT());
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
      shift(); prefetch(); paintSlots();
      notify({ t: t, max: maxT(), label: label(), atStart: t === 0, atEnd: t >= maxT() });
    }

    /* ---------- la hoja ---------- */
    function pageTex(idx) {
      if (idx < 0 || idx >= n || !res[idx] || !res[idx].img) return curl.paper;
      return curl.tex(qW + ':' + idx, res[idx].img);
    }
    /** Dibuja la hoja en el avance p (0 = plana a la derecha, 1 = plana a la izquierda). */
    function drawSheet(p) {
      if (!curl || !anim) return;
      var br = book.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      var spineX = br.left - sr.left + (single ? 0 : pw), top = br.top - sr.top;
      var sinp = Math.sin(Math.PI * p), Oy = anim.Oy;
      /* El punto que "agarra" la esquina viaja de la derecha (pw) a la izquierda (-pw) elevándose.
         El doblez es la mediatriz entre la esquina original y ese punto: por eso nace en diagonal
         (la esquina inferior se adelanta) y termina vertical, junto al lomo. */
      var qx = pw * (1 - 2 * p);
      var dev = (-anim.H * sinp * anim.liftK + anim.dy * anim.decay) * Math.min(1, (1 - p) * 6);
      var qy = Oy + dev, vx = pw - qx, vy = -dev, len = Math.sqrt(vx * vx + vy * vy);
      var nx = len < 1e-3 ? 1 : vx / len, ny = len < 1e-3 ? 0 : vy / len;
      var f = nx * (pw + qx) / 2 + ny * (Oy + qy) / 2;
      var R = pw * (0.014 + 0.115 * Math.pow(sinp, 0.8));      // radio del cilindro: máximo a mitad del giro
      var alpha = single ? 1 - smooth(clamp((p - 0.55) / 0.45, 0, 1)) : 1;
      var j = anim.j;
      curl.draw({
        n: [nx, ny], f: f, R: R, spine: [spineX, top], size: [pw, ph], alpha: alpha,
        front: pageTex(single ? j : 2 * j), back: single ? curl.paper : pageTex(2 * j + 1)
      });
    }

    /** Anima el avance de la hoja hasta anim.to con arranque y frenado suaves. */
    function run() {
      cancelAnimationFrame(raf);
      function step(now) {
        if (dead || !anim) return;
        var x = clamp((now - anim.start) / anim.dur, 0, 1), p = anim.from + (anim.to - anim.from) * smooth(x);
        anim.decay = 1 - x; drawSheet(p);
        if (x < 1) { raf = requestAnimationFrame(step); return; }
        anim = null; paintSlots(); if (curl) curl.clear();
        if (queue.length) { var q = queue.shift(); begin(q[0], q[1]); }
      }
      raf = requestAnimationFrame(step);
    }

    function begin(dir, y) {
      if ((dir > 0 && t >= maxT()) || (dir < 0 && t <= 0)) return false;
      var j = dir > 0 ? t : t - 1;
      t += dir;
      if (!curl) { if (sound) sound.play(500, 0); update(); return true; }   // sin WebGL / movimiento reducido: cambio directo
      anim = { j: j, mode: 'auto', dir: dir, Oy: clamp(y, 0.12 * ph, 0.97 * ph), H: LIFT * ph, liftK: 1, dy: 0, decay: 1,
               from: dir > 0 ? 0 : 1, to: dir > 0 ? 1 : 0, start: performance.now(), dur: FLIP_MS };
      if (sound) sound.play(anim.dur, 0);
      update(); run(); return true;
    }
    function flip(dir, y) {
      if (drag && drag.moved) return;
      if (anim) { if (queue.length < 2) queue.push([dir, y]); return; }
      begin(dir, y);
    }
    function next(y) { flip(1, y === undefined ? 0.92 * ph : y); }
    function prev(y) { flip(-1, y === undefined ? 0.92 * ph : y); }
    function goTo(k) {
      anim = null; queue = []; cancelAnimationFrame(raf); if (curl) curl.clear();
      t = clamp(k, 0, maxT()); update();
    }

    /* ---------- arrastre (la hoja sigue al dedo/mouse) y clics ---------- */
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.side-arrow')) return;
      drag = { x0: e.clientX, y0: e.clientY, id: e.pointerId, tm: performance.now(), moved: false, dir: 0, p: 0, p0: 0 };
    }
    function onMove(e) {
      if (!drag) { hover(e); return; }
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) || anim || !curl) return;
        var dir = dx < 0 ? 1 : -1;
        if ((dir === 1 && t >= maxT()) || (dir === -1 && t <= 0)) { drag = null; return; }
        var br = book.getBoundingClientRect();
        drag.moved = true; drag.dir = dir; drag.p0 = drag.p = dir > 0 ? 0 : 1;
        anim = { j: dir > 0 ? t : t - 1, mode: 'drag', dir: dir, Oy: clamp(drag.y0 - br.top, 0.12 * ph, 0.97 * ph),
                 H: LIFT * ph, liftK: 0.7, dy: 0, decay: 1 };
        try { stage.setPointerCapture(drag.id); } catch (x) {}
        paintSlots();
      }
      drag.p = clamp(drag.p0 - DRAG_GAIN * dx / (2 * pw), 0, 1); anim.dy = clamp(dy, -0.4 * ph, 0.4 * ph);
      if (!dragRaf) dragRaf = requestAnimationFrame(function () { dragRaf = 0; if (anim && drag && drag.moved) drawSheet(drag.p); });
    }
    function onUp(e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.moved) {
        var dt = Math.max(1, performance.now() - d.tm), vx = (e.clientX - d.x0) / dt;
        var fast = Math.abs(vx) > 0.45 && (vx < 0) === (d.dir > 0);
        var commit = d.dir > 0 ? (d.p > 0.3 || fast) : (d.p < 0.7 || fast);
        var to = commit ? (d.dir > 0 ? 1 : 0) : (d.dir > 0 ? 0 : 1);
        anim.mode = 'auto'; anim.from = d.p; anim.to = to; anim.start = performance.now();
        anim.dur = Math.round(260 + 460 * Math.abs(to - d.p)); anim.decay = 1;
        if (commit) { t += d.dir; if (sound) sound.play(anim.dur, Math.abs(d.p - d.p0)); }
        update(); run(); return;
      }
      if (performance.now() - d.tm > 600) return;
      var r = book.getBoundingClientRect(), f = (e.clientX - r.left) / r.width;
      if (e.clientY < r.top || e.clientY > r.bottom || f < 0 || f > 1) return;
      var z = zone(f), y = e.clientY - r.top;
      if (z) { lastTap = null; if (z > 0) next(y); else prev(y); return; }   // bordes: pasar página
      var now = performance.now();                                            // centro: doble clic / doble toque = ampliar
      if (lastTap && now - lastTap.t < 350 && Math.abs(e.clientX - lastTap.x) < 30 && Math.abs(e.clientY - lastTap.y) < 30) {
        lastTap = null; var pi = pageAt(f); if (pi >= 0 && o.onZoom) o.onZoom(pi);
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    function onCancel() {
      if (drag && drag.moved && anim) {
        anim.mode = 'auto'; anim.from = drag.p; anim.to = drag.dir > 0 ? 0 : 1; anim.start = performance.now(); anim.dur = 320; anim.decay = 1; run();
      }
      drag = null;
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
    function showPage(i) { i = clamp(i, 0, n - 1); goTo(single ? i : Math.ceil(i / 2)); }
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
      timer = setTimeout(function () { if (dead) return; anim = null; queue = []; if (layout()) update(); }, 80);
    }

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
    if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(stage); } else window.addEventListener('resize', onResize);

    layout(); update();

    return {
      next: next, prev: prev, goTo: goTo, showPage: showPage, currentPage: currentPage,
      destroy: function () {
        dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(dragRaf); clearTimeout(timer);
        document.removeEventListener('keydown', onKey);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
        stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerup', onUp); stage.removeEventListener('pointercancel', onCancel);
        if (curl) curl.destroy();
        canvas.remove(); book.innerHTML = '';
      }
    };
  };
})();
