/* ==========================================================
   zoom.js — Lectura ampliada, SOLO LECTURA (sin edición).
   Muestra una página grande sobre fondo neutro, con scroll
   vertical y sin animaciones de giro. Salida: botón, Escape.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});

  /** o: { pages[], title, index, onClose(index) } */
  CC.openZoom = function (o) {
    var idx = o.index, n = o.pages.length, body = document.body;
    var el = document.createElement('div');
    el.className = 'zoom'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Lectura ampliada');
    el.innerHTML =
      '<div class="zoom-bar"><button type="button" class="pill sm" data-x>✕ Volver a la revista</button>' +
      '<span class="zoom-title"></span>' +
      '<span class="zoom-nav"><button type="button" class="round sm" data-p aria-label="Página anterior">‹</button>' +
      '<span class="zoom-ind" aria-live="polite"></span>' +
      '<button type="button" class="round sm" data-n aria-label="Página siguiente">›</button></span></div>' +
      '<div class="zoom-scroll" tabindex="0"><img class="zoom-page" draggable="false" alt=""></div>';
    el.querySelector('.zoom-title').textContent = o.title || '';
    var img = el.querySelector('img'), sc = el.querySelector('.zoom-scroll'), ind = el.querySelector('.zoom-ind');
    var bp = el.querySelector('[data-p]'), bn = el.querySelector('[data-n]');

    function paint() {
      img.src = o.pages[idx]; img.alt = 'Página ' + (idx + 1) + ' de «' + (o.title || '') + '»';
      ind.textContent = (idx + 1) + ' / ' + n; bp.disabled = idx === 0; bn.disabled = idx === n - 1;
      sc.scrollTop = 0;
    }
    function go(d) { var k = Math.max(0, Math.min(n - 1, idx + d)); if (k !== idx) { idx = k; paint(); } }
    function close() {
      document.removeEventListener('keydown', onKey, true);
      el.remove(); body.classList.remove('zooming');
      if (o.onClose) o.onClose(idx);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    }
    el.querySelector('[data-x]').addEventListener('click', close);
    bp.addEventListener('click', function () { go(-1); });
    bn.addEventListener('click', function () { go(1); });
    el.addEventListener('contextmenu', function (e) { if (e.target === img) e.preventDefault(); });
    document.addEventListener('keydown', onKey, true);
    body.classList.add('zooming'); body.appendChild(el); paint(); sc.focus({ preventScroll: true });
  };
})();
