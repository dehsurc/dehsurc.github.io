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
theme. The two directions are not symmetric: going dark the new palette grows
out of the button, going light the old one collapses back into it. Figures keep a light backing in dark mode so white-background diagrams
stay readable.

## The map behind the page, and the route beside it

`drive.js` generates one world — no assets — and draws it twice.

The background is a vectorised HD map and only contains what the nuScenes map
ground truth contains: lane dividers, road boundaries and pedestrian crossings
as closed polygons. It is drawn nearly invisible until the pointer passes over
it, where a 1:2 region of interest — the shape of the 60 x 30 m crop the model
predicts into, with crop marks and a label — redraws the same geometry in the
class colours, with the per-polyline vertices a MapTR-style figure shows. The
faint pass is cached to an offscreen canvas and redrawn only on scroll; the
coloured pass renders at ROI size, so the per-frame cost is flat in display
size.

The rail down the right edge is the whole document as one route. The car is the
scroll thumb: it travels down the road as the page scrolls, each section is a
junction along the way, and pressing or dragging anywhere on the rail scrolls
one-to-one. The rail reserves its own gutter the way a scrollbar does, so it
never sits over the content, and it hides below 900 px.

Knobs: `ROI_W` / `ROI_H` / `PEAK` for the region of interest, `ROAD_HALF` /
`LANE` / `SIDE` / `JUNCTION` / `VERT` for the world, `PARALLAX` for how fast it
passes, `RW` / `CAP` / `MIN_VIEWPORT` for the rail.

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
