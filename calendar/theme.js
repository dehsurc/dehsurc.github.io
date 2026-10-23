// Settle the theme and the style before first paint so the page never
// flashes. The theme shares the main site's key, so both pages follow the
// same switch; the style (chic or cute) is this page's own and per device.
// A file rather than an inline script so the CSP can stay at script-src 'self'.
(function () {
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem('kk-theme');
    var dark = saved ? saved === 'dark'
                     : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.style = localStorage.getItem('cal-style') === 'cute' ? 'cute' : 'chic';
  } catch (e) { /* keep the defaults */ }
})();
