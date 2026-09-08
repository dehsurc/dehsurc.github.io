# ReSMap project page

Static page for *ReSMap: Recasting Satellite Priors for Robust and Accurate
Online HD Map Construction*. No build step — three files plus assets.

    index.html    content; every table is plain HTML, marked with an
                  `<!-- ==== TABLE n · paper Tab. X — update numbers here ==== -->`
                  comment so numbers can be edited in place
    style.css     all styling; both palettes live in the `:root` and
                  `:root[data-theme="dark"]` blocks
    main.js       theme toggle, scroll progress, section reveal, nav
                  highlighting, scene switcher, BibTeX copy
    drive.js      the procedural map behind the page and the ego view
    assets/       figures, videos, PDF (see assets/README.md)

## Type and theme

Latin is set in Inter and Hangul in Freesentation — Inter comes first in the
stack and carries no Hangul glyphs, so Korean text falls through to
Freesentation on its own. Inter comes from Google Fonts; Freesentation is
declared in `style.css` against a commit-pinned jsDelivr URL, restricted by
`unicode-range` to the Korean blocks so an all-English page downloads none of
its ~470 KB weights.

The theme follows the OS by default and is overridden by the toggle in the
nav bar (or the `t` key), remembered in `localStorage`. Switching wipes the
new palette in from the button through the View Transitions API, picking one
of seven clip-path shapes at random; browsers without the API cross-fade the
palette instead, and `prefers-reduced-motion` skips straight to the new
theme. Figures keep a light backing in dark mode so white-background diagrams
stay readable.

## The map behind the page

`drive.js` generates one road — two sines in `World.centre()`, no assets —
and draws it twice.

Behind the page it is a faint vectorised road. The pointer is the ROI: inside
its radius the same geometry is redrawn in the usual online-mapping colours
(boundary green, divider amber, crossing blue) and composited through a soft
radial mask, so moving the mouse reveals the map the way the model builds it.
The faint pass is cached to an offscreen canvas and only redrawn when the page
scrolls; the coloured pass is rendered at lens size, not viewport size, so the
per-frame cost does not grow with the display.

In the corner it is an ego view. Scrolling drives the car forward, and the
page's own sections are the landmarks along the route — the panel names the
next one and its distance, and clicking the road jumps to the nearest.

Knobs: `R` (reveal radius) and `PEAK` (how strongly it tints) for the
background, `SCALE` and `EGO_Y` for the ego view, `LANE` and `CROSSING` for
the road itself. Touch pointers and `prefers-reduced-motion` get the faint map
with no reveal; the ego view hides below 56rem.

## Deploying

Lives at <https://dehsurc.github.io/resmap-page/>, served as a subfolder of
the `dehsurc/dehsurc.github.io` user site. Pushing to `main` publishes it;
there is nothing to configure. Renaming this folder changes the URL, so the
`canonical` and `og:url` meta tags in `index.html` have to follow.

Still placeholders in `index.html`:

- the four links in the hero (`aria-disabled="true"`),
- the PDF links in the citation section,
- the `journal` / `year` fields of the BibTeX entry.

## Local preview

    python3 -m http.server 8000

then open <http://localhost:8000>.

## Before publishing

- [ ] Drop the figures and videos listed in `assets/README.md`
- [ ] Re-check every table against the final version of the paper
- [ ] Fill in the arXiv, code, and PDF links
- [ ] Add `assets/figures/social.jpg` (1200 × 630) for link previews
