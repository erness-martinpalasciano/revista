/* ==========================================================
   zoom.js — Lectura ampliada, SOLO LECTURA (sin edición).
   Muestra la página con su proporción ORIGINAL (si es PDF, se
   vuelve a renderizar a la resolución necesaria para mantener la
   nitidez), con scroll vertical, botones de acercar/alejar y sin
   animaciones de giro. Salida: botón o Escape.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});
  var STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2, 2.5];

  /** o: { source, title, index, onClose(index) } */
  CC.openZoom = function (o) {
    var src = o.source, idx = o.index, n = src.n, body = document.body, level = 2, token = 0;
    var el = document.createElement('div');
    el.className = 'zoom'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Lectura ampliada');
    el.innerHTML =
      '<div class="zoom-bar"><button type="button" class="pill sm" data-x>✕ Volver a la revista</button>' +
      '<span class="zoom-title"></span>' +
      '<span class="zoom-nav">' +
      '<button type="button" class="round sm" data-zo aria-label="Alejar">−</button>' +
      '<button type="button" class="round sm" data-zi aria-label="Acercar">+</button>' +
      '<button type="button" class="round sm" data-p aria-label="Página anterior">‹</button>' +
      '<span class="zoom-ind" aria-live="polite"></span>' +
      '<button type="button" class="round sm" data-n aria-label="Página siguiente">›</button></span></div>' +
      '<div class="zoom-scroll" tabindex="0"><div class="zoom-wait" hidden>Cargando página…</div><img class="zoom-page" draggable="false" alt=""></div>';
    el.querySelector('.zoom-title').textContent = o.title || '';
    var img = el.querySelector('img'), sc = el.querySelector('.zoom-scroll'), ind = el.querySelector('.zoom-ind'), wait = el.querySelector('.zoom-wait');
    var bp = el.querySelector('[data-p]'), bn = el.querySelector('[data-n]'), bzi = el.querySelector('[data-zi]'), bzo = el.querySelector('[data-zo]');

    /** Ancho en píxeles CSS de la página según el nivel de acercamiento. */
    function cssWidth() {
      var base = Math.min(900, sc.clientWidth - 24);
      return Math.max(240, Math.round(base * STEPS[level]));
    }
    function paint() {
      var my = ++token, w = cssWidth(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      ind.textContent = (idx + 1) + ' / ' + n; bp.disabled = idx === 0; bn.disabled = idx === n - 1;
      bzi.disabled = level === STEPS.length - 1; bzo.disabled = level === 0;
      img.alt = 'Página ' + (idx + 1) + ' de «' + (o.title || '') + '»';
      wait.hidden = false;
      src.zoom(idx, Math.min(3600, Math.round(w * dpr))).then(function (x) {
        if (my !== token) return;
        img.src = x.url; img.style.width = w + 'px';
        if (x.w && x.h) img.style.aspectRatio = x.w + ' / ' + x.h;   // conserva la proporción original
        wait.hidden = true;
      }).catch(function () { if (my === token) wait.textContent = 'No se pudo cargar la página.'; });
    }
    function go(d) { var k = Math.max(0, Math.min(n - 1, idx + d)); if (k !== idx) { idx = k; sc.scrollTop = 0; paint(); } }
    function zoomBy(d) { var k = Math.max(0, Math.min(STEPS.length - 1, level + d)); if (k !== level) { level = k; paint(); } }
    function close() {
      document.removeEventListener('keydown', onKey, true); token++;
      el.remove(); body.classList.remove('zooming');
      if (o.onClose) o.onClose(idx);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1); }
      else if (e.key === '-') { e.preventDefault(); zoomBy(-1); }
    }
    el.querySelector('[data-x]').addEventListener('click', close);
    bp.addEventListener('click', function () { go(-1); });
    bn.addEventListener('click', function () { go(1); });
    bzi.addEventListener('click', function () { zoomBy(1); });
    bzo.addEventListener('click', function () { zoomBy(-1); });
    el.addEventListener('contextmenu', function (e) { if (e.target === img) e.preventDefault(); });
    document.addEventListener('keydown', onKey, true);
    body.classList.add('zooming'); body.appendChild(el); paint(); sc.focus({ preventScroll: true });
  };
})();
