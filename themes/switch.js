/* Footer style switch (home page). A manual pick overrides the 50/50 split in this browser. */
(function () {
  var cur = document.documentElement.dataset.theme === 'meadow' ? 'meadow' : 'control';
  document.querySelectorAll('[data-style]').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.style === cur));
    b.addEventListener('click', function () {
      if (b.dataset.style === cur) return;
      try { localStorage.setItem('theme', b.dataset.style); } catch (e) {}
      if (window.track) window.track('style_switch', b.dataset.style);
      setTimeout(function () { location.replace(location.pathname + location.hash); }, 60); // drop any ?theme= (it would override this pick); let the beacon leave first
    });
  });
})();

/* Compute: Core Stack slides through as two counter-running rows (Meadow builds its own in meadow.js). */
(function () {
  var stack = document.documentElement.dataset.theme !== 'meadow' && document.querySelector('main > .section > .container > .tech-stack');
  if (!stack || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var tags = stack.innerHTML, rows = document.createElement('div'), back = document.createElement('div');
  rows.className = 'c-rows';
  stack.before(rows); rows.append(stack);
  stack.innerHTML = tags + '<span aria-hidden="true" style="display:contents">' + tags + tags + tags + '</span>';
  back.className = 'tech-stack'; back.setAttribute('aria-hidden', 'true'); back.innerHTML = tags + tags + tags + tags;
  rows.append(back);
})();
