/* Headless DOM + Canvas2D stub, enough to run drive.js and assert on it. */
'use strict';
var calls = [];
function ctx2d() {
  var c = {
    canvas: null, _t: 1,
    setTransform: function () {}, save: function () {}, restore: function () {},
    clearRect: function () {}, beginPath: function () {}, closePath: function () {},
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), arc: rec('arc'),
    rect: rec('rect'), fillRect: rec('fillRect'), stroke: rec('stroke'),
    fill: rec('fill'), quadraticCurveTo: rec('q'), bezierCurveTo: rec('b'),
    setLineDash: function () {}, translate: function () {}, rotate: function () {},
    arcTo: rec('arcTo'), roundRect: rec('roundRect'), ellipse: rec('ellipse'),
    scale: function () {}, clip: function () {},
    measureText: function (t) { return { width: t.length * 7 }; },
    fillText: rec('fillText'),
    createLinearGradient: function () {
      var stops = [];
      return { addColorStop: function (o, c) {
        if (!isFinite(o)) throw new Error('gradient stop offset ' + o);
        if (o < 0 || o > 1) throw new Error('gradient stop out of range: ' + o);
        if (stops.length && o < stops[stops.length - 1]) calls.push(['grad-out-of-order', o]);
        stops.push(o);
      } };
    },
    createRadialGradient: function () { return { addColorStop: function () {} }; }
  };
  function rec(name) {
    return function () {
      var a = Array.prototype.slice.call(arguments);
      a.forEach(function (v) {
        if (typeof v === 'number' && !isFinite(v)) throw new Error(name + ' got ' + v);
      });
      calls.push([name].concat(a));
    };
  }
  return c;
}

function El(tag, id) {
  var self = {
    tagName: (tag || 'div').toUpperCase(), id: id || '', children: [], _text: '',
    hidden: false, dataset: {}, _cls: {},
    style: { setProperty: function (k, v) { self.style[k] = v; }, removeProperty: function () {} },
    classList: {
      add: function (c) { self._cls[c] = true; },
      remove: function (c) { delete self._cls[c]; },
      contains: function (c) { return !!self._cls[c]; },
      toggle: function (c, on) {
        if (on === undefined) on = !self._cls[c];
        if (on) self._cls[c] = true; else delete self._cls[c];
        return on;
      }
    },
    getContext: function () { return self._ctx || (self._ctx = ctx2d()); },
    getBoundingClientRect: function () { return { top: self._top || 0, left: 0, width: 300, height: self._h || 30, bottom: (self._top || 0) + 30, right: 300 }; },
    addEventListener: function (t, f) { (self._h2 = self._h2 || {})[t] = (self._h2[t] || []).concat(f); },
    removeEventListener: function () {},
    appendChild: function (c) { self.children.push(c); return c; },
    setAttribute: function (k, v) { self['attr_' + k] = v; },
    removeAttribute: function (k) { delete self['attr_' + k]; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    scrollIntoView: function () {},
    offsetWidth: 74, offsetHeight: 22, offsetTop: 0,
    clientWidth: 1440, clientHeight: 78,
    parentNode: null,
    firstElementChild: null
  };
  Object.defineProperty(self, 'textContent', {
    get: function () { return self._text; },
    set: function (v) { self._text = v; self.children = []; }
  });
  return self;
}

var nodes = {};
function get(id) { return nodes[id] || (nodes[id] = El('div', id)); }

var root = El('html', 'root');
root.scrollHeight = 24000;
root.dataset.theme = 'light';

var SECTIONS = [
  { id: 'failure', num: '', top: 1400 },
  { id: 'abstract', num: '1', top: 4200 },
  { id: 'method', num: '2', top: 7000 },
  { id: 'results', num: '3', top: 12000 },
  { id: 'qualitative', num: '4', top: 17000 },
  { id: 'cite', num: '5', top: 21000 }
];
var sectionEls = SECTIONS.map(function (s) {
  var el = El('section', s.id);
  el._top = s.top;
  var h2 = El('h2');
  h2._text = s.num + ' ' + s.id;
  var numEl = s.num ? El('span') : null;
  if (numEl) numEl._text = s.num;
  el.querySelector = function (sel) {
    if (sel === 'h2 .num') return numEl;
    if (sel === 'h2') return h2;
    return null;
  };
  return el;
});

global.window = {
  scrollY: 0, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
  matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
  addEventListener: function () {}, removeEventListener: function () {},
  getComputedStyle: function () { return { getPropertyValue: function () { return ''; }, top: '0px' }; },
  requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: function () {},
  scrollTo: function (o) { window.scrollY = (o && o.top) || 0; },
  localStorage: { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = v; } },
  setTimeout: function () { return 0; }, clearTimeout: function () {}
};
global.localStorage = window.localStorage;
global.getComputedStyle = window.getComputedStyle;
global.requestAnimationFrame = window.requestAnimationFrame;
global.cancelAnimationFrame = window.cancelAnimationFrame;

global.document = {
  documentElement: root,
  body: El('body'),
  activeElement: null,
  getElementById: function (id) {
    if (id === 'road-map') {
      var c = get(id);
      c.width = 1440; c.height = 100;
      c.parentNode = c.parentNode || El('div');
      c.parentNode.clientHeight = 78;
      return c;
    }
    for (var i = 0; i < sectionEls.length; i++) if (sectionEls[i].id === id) return sectionEls[i];
    return get(id);
  },
  querySelector: function (sel) {
    var m = /^\.topbar a\[href="#([^"]+)"\]$/.exec(sel);
    if (m) { var a = El('a'); a._text = m[1]; return a; }
    return null;
  },
  querySelectorAll: function (sel) {
    if (sel === 'main section[id]') return sectionEls;
    return [];
  },
  createElement: function (t) { return El(t); },
  createTextNode: function (v) { var n = El('#text'); n._text = String(v); return n; },
  createElementNS: function (ns, t) { return El(t); },
  addEventListener: function () {}
};

module.exports = { root: root, nodes: nodes, get: get, calls: calls, SECTIONS: SECTIONS, El: El };
