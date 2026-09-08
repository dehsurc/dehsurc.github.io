# ReSMap project page

Static page for *ReSMap: Recasting Satellite Priors for Robust and Accurate
Online HD Map Construction*. No build step ,  three files plus assets.

    index.html    content; every table is plain HTML, marked with an
                  `<!-- ==== TABLE n · paper Tab. X ,  update numbers here ==== -->`
                  comment so numbers can be edited in place
    style.css     all styling; both palettes live in the `:root` and
                  `:root[data-theme="dark"]` blocks
    main.js       theme toggle, scroll progress, section reveal, nav
                  highlighting, scene switcher, BibTeX copy
    failure.js    the pinned camera-failure walkthrough
    drive.js      the route rail down the right edge
    assets/       figures, videos, PDF (see assets/README.md)

## Type and theme

Latin is set in Inter and Hangul in Freesentation ,  Inter comes first in the
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

## The camera-failure walkthrough

Section 4 is a pinned stage the scroll drives through four measured conditions:
clean, front camera dropped, three front dropped, all six dropped. The rig is a
schematic ,  surround coverage around the ego with the satellite tile behind it,
built as SVG in `failure.js`, no assets ,  and the bars are Table 2, interpolated
between levels so the motion is continuous while every stop on it is a real
measurement. Editing the numbers means editing `METHODS` in `failure.js`; they
must stay in step with Table 2 in `index.html`.

Scrolling is the primary control. The play button drives the same scroll at a
readable pace for anyone who would rather watch ,  it never starts on its own,
and any scroll, key or pointer of your own takes it straight back.

Knobs: the `.track` height in `style.css` sets how much scroll the four stages
take, `SECONDS` in `failure.js` is how long the play-through takes, and `SCALE`
is the mAP at full bar width. Below 62rem the stage unpins and stacks.

## The route rail

`drive.js` draws the rail down the right edge: the whole document as one road,
with the car as the scroll thumb. Ahead of the car the road is bare surface
with faint markings. Behind it the same elements are drawn in their map class
colours, with the per-polyline vertices a predicted map is drawn with, because
the car is building the map as it drives. That is the subject of the paper, and
it is what makes the progress indicator mean something. It descends as the page scrolls, and each
section is a junction with a **road sign** beside it ,  the signs are the
navigation, which is why the top bar drops its links while the rail is up.
Each plate carries its section number the way a guide sign carries an exit
number. Sections bunch together wherever the document has several short ones in
a row, so the plates are pushed apart to a legible spacing and an elbowed arm
runs back to the junction they actually mark. A section counts as current once
its heading is `LOOKAHEAD` up the viewport rather than only at the very top,
which is what stops the previous sign from staying lit.

Every section needs an entry in the top bar's link list, since that is where
the signs take their short names from.

The rail is also the page's chrome. While it is up the top bar is hidden
entirely and the rail carries the wordmark, the theme toggle (moved into it, so
there is only ever one such button) and **Drive**, which scrolls the whole page
at a steady 210 px/s. Drive runs one rAF loop advancing a float scroll
position, with `scroll-behavior` forced to auto for the duration; a chain of
smooth `scrollTo` calls restarts itself every frame, which is what made the
earlier stage-by-stage play stutter. Any scroll, key or pointer of your own
stops it.

Signs are guide-sign green, the colour they are on the road, with the section
number set like an exit number. Pressing or dragging on the carriageway seeks
one to one; seeking is explicitly
instant, because `html` carries `scroll-behavior: smooth` and a smooth scroll
restarted on every pointermove lurches instead of tracking. The rail reserves
its own gutter the way a scrollbar does, so it never sits over the content, and
below 900 px it hides and the top bar's links come back.

Knobs: `--rail` in `style.css` (the JS reads it, so the gutter and the drawing
cannot drift apart), and `CAP`, `SIGN_GAP`, `SIGN_RIGHT` and `MIN_VIEWPORT` in
`drive.js`.

## Deploy cache

GitHub Pages serves assets with `max-age=600`, so a fresh `index.html` and a
stale `drive.js` can disagree for ten minutes. Every asset link carries a `?v=`
query: **bump it in `index.html` whenever you change a CSS or JS file.**

There was a procedurally generated HD map behind the page as well. It is gone.
The geometry was invented, so it visibly repeated left to right, and a region
of interest over invented geometry reveals nothing worth revealing. If a map
comes back it should be real polylines from a real scene.

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
