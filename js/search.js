/* ==========================================================
   search.js — Buscador real sobre CC.articles.
   Criterios (se combinan): autor, tema/título, fecha exacta.
   ========================================================== */
(function () {
  'use strict';
  var CC = (window.CC = window.CC || {});

  /** Minúsculas y sin tildes, para que "fisica" encuentre "Física". */
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  CC.search = function (q) {
    var au = norm(q.author), tp = norm(q.topic);
    return CC.articles.filter(function (a) {
      return (!au || norm(a.authors.join(' ')).indexOf(au) !== -1) &&
             (!tp || norm(a.title + ' ' + a.topic).indexOf(tp) !== -1) &&
             (!q.date || a.dateISO === q.date);
    });
  };

  CC.initSearch = function () {
    var panel = document.getElementById('searchPanel'), btn = document.getElementById('btnSearch');
    var fa = document.getElementById('qAuthor'), ft = document.getElementById('qTopic'), fd = document.getElementById('qDate');
    var form = document.getElementById('searchForm'), out = document.getElementById('searchResults'), count = document.getElementById('searchCount');

    function run() {
      fd.classList.toggle('is-empty', !fd.value);   // (solo estilo) el ejemplo dd/mm/aaaa se ve como un placeholder
      var q = { author: fa.value, topic: ft.value, date: fd.value }, list = CC.search(q);
      CC.renderCards(out, list);
      var filtering = q.author || q.topic || q.date;
      count.textContent = filtering ? list.length + (list.length === 1 ? ' artículo encontrado' : ' artículos encontrados') : 'Todos los artículos (' + list.length + ')';
    }
    function toggle(open) {
      panel.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open));
      if (open) { run(); setTimeout(function () { fa.focus(); }, 60); }
    }
    btn.addEventListener('click', function () { toggle(!panel.classList.contains('open')); });
    [fa, ft, fd].forEach(function (el) { el.addEventListener('input', run); el.addEventListener('change', run); });
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    form.addEventListener('reset', function () { setTimeout(run, 0); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) { toggle(false); btn.focus(); } });
    // Al abrir un artículo desde los resultados, se cierra el buscador.
    out.addEventListener('click', function (e) { if (e.target.closest('a')) toggle(false); });
  };
})();
