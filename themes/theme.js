/* Picks the visual style before first paint (loaded synchronously in <head>).
 * A/B split: set SPLIT = false to send everyone back to the original look; the 50/50 assignment is remembered per browser, so turning it on again keeps each visitor's style.
 * Manual preview always wins: ?theme=meadow saves it, ?theme=off clears it. */
(function () {
  var SPLIT = true;
  try {
    var q = new URLSearchParams(location.search).get('theme');
    if (q) q === 'off' ? localStorage.removeItem('theme') : localStorage.setItem('theme', q);
    var t = localStorage.getItem('theme');
    if (!t && SPLIT) {
      t = localStorage.getItem('theme_ab');
      if (!t) localStorage.setItem('theme_ab', (t = Math.random() < 0.5 ? 'meadow' : 'control'));
    }
    if (t === 'meadow') {
      document.documentElement.dataset.theme = 'meadow';
      // opening animation: home page, every load like the Compute intro (meadow.js plays it; the CSS cover hides the page until then)
      var home = /^\/(index\.html)?$/.test(location.pathname);
      if (home) document.documentElement.classList.add('m-intro');
      document.write('<link rel="stylesheet" href="/themes/meadow.css"><link rel="stylesheet" href="/themes/meadow-extras.css"><script defer src="/themes/meadow.js"><\/script>');
    }
  } catch (e) {}
})();
