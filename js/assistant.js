/* ==========================================================
   assistant.js — Asistente Marie Curie (preguntas frecuentes).
   Textos copiados tal cual del sitio original de ConCiencia.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});

  var FAQ = [
    { q: '¿Cómo me sumo al club?', a: 'Escribinos por Sumate o pasá por la escuela. Recibimos a cualquier estudiante con ganas, no hace falta saber nada antes.' },
    { q: '¿Dónde los encuentro?', a: 'En el IPETyM N°84, San Francisco 33, B° La Estancia, Tanti, Córdoba. El mapa está en Contacto.' },
    { q: '¿Qué actividades hacen?', a: 'Revista, viajes, eventos y proyectos. Cada una tiene su página.' },
    { q: '¿Tiene algún costo?', a: 'Sumarte es gratis. Algunas salidas pueden tener costo, siempre se avisa con tiempo.' },
    { q: '¿Quiénes pueden participar?', a: 'Cualquier estudiante interesado en la ciencia. Importa la curiosidad, no el promedio.' }
  ];
  /* Mensajes espontáneos (globo sobre Marie). Pegá acá, tal cual, los textos del sitio original:
     var MESSAGES = ['Texto del mensaje 1', 'Texto del mensaje 2', …]
     Se muestran de a uno, en orden, solo en la galería (nunca mientras se lee un artículo). */
  var MESSAGES = [];
  var FIRST_DELAY = 7000, EVERY = 24000, VISIBLE = 7000;   // ms
  CC.marie = { messages: MESSAGES };
  var CHEVRON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  CC.initAssistant = function () {
    var root = document.createElement('div'); root.className = 'marie';
    root.innerHTML =
      '<section class="marie-panel" id="mariePanel" aria-label="Preguntas frecuentes" role="dialog">' +
        '<header><img src="assets/images/marie.png" alt=""><div><span class="marie-name">ConCiencia</span><span>Preguntas frecuentes</span></div>' +
        '<button type="button" class="marie-x" aria-label="Cerrar preguntas frecuentes">✕</button></header>' +
        '<div class="marie-list"></div></section>' +
      '<div class="marie-bubble" role="status" aria-live="polite"></div>' +
      '<button type="button" class="marie-fab" aria-expanded="false" aria-controls="mariePanel" aria-label="Abrir preguntas frecuentes con Marie Curie">' +
        '<img src="assets/images/marie.png" alt="Marie Curie"><span class="x" aria-hidden="true">✕</span></button>';
    document.body.appendChild(root);

    var list = root.querySelector('.marie-list'), fab = root.querySelector('.marie-fab'), panel = root.querySelector('.marie-panel');
    FAQ.forEach(function (item, i) {
      var d = document.createElement('div'); d.className = 'faq';
      d.innerHTML = '<button type="button" aria-expanded="false" aria-controls="faq' + i + '"><span></span>' + CHEVRON + '</button><p class="ans" id="faq' + i + '"></p>';
      d.querySelector('span').textContent = item.q; d.querySelector('.ans').textContent = item.a;
      d.querySelector('button').addEventListener('click', function () {
        var was = d.classList.contains('open');
        list.querySelectorAll('.faq').forEach(function (f) { f.classList.remove('open'); f.querySelector('button').setAttribute('aria-expanded', 'false'); });
        if (!was) { d.classList.add('open'); d.querySelector('button').setAttribute('aria-expanded', 'true'); }
      });
      list.appendChild(d);
    });

    var bubble = root.querySelector('.marie-bubble'), bi = 0, hideT = 0;
    function hideBubble() { bubble.classList.remove('show'); clearTimeout(hideT); }
    /** Muestra el siguiente mensaje espontáneo si no molesta (panel cerrado, sin lectura ni ampliado). */
    function spontaneous() {
      var m = CC.marie.messages, b = document.body;
      if (!m.length || root.classList.contains('open') || b.classList.contains('reading') || b.classList.contains('zooming') || document.hidden) return;
      bubble.textContent = m[bi++ % m.length]; bubble.classList.add('show');
      clearTimeout(hideT); hideT = setTimeout(hideBubble, VISIBLE);
    }
    bubble.addEventListener('click', hideBubble);
    setTimeout(function () { spontaneous(); setInterval(spontaneous, EVERY); }, FIRST_DELAY);
    function toggle(open) {
      root.classList.toggle('open', open); fab.setAttribute('aria-expanded', String(open));
      panel.inert = !open; if (open) hideBubble();
    }
    panel.inert = true;
    fab.addEventListener('click', function () { toggle(!root.classList.contains('open')); });
    root.querySelector('.marie-x').addEventListener('click', function () { toggle(false); fab.focus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) toggle(false); });
  };
})();
