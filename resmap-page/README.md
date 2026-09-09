# ReSMap project page

Static page for *ReSMap: Recasting Satellite Priors for Robust and Accurate
Online HD Map Construction*. No build step ,  three files plus assets.

    index.html    content; every table is plain HTML, marked with an
                  `<!-- ==== TABLE n · paper Tab. X ,  update numbers here ==== -->`
                  comment so numbers can be edited in place
    style.css     all styling; both palettes live in the `:root` and
                  `:root[data-theme="dark"]` blocks
    main.js       theme toggle, section reveal, nav highlighting, scene
                  switcher, BibTeX copy, missing-figure placeholders
    failure.js    the pinned camera-failure walkthrough
    drive.js      the road across the top, and the car that drives it
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

Scrolling is the only control. Nothing here plays itself; the stage rides the
page's scroll like any other part of it, whether that scroll comes from a wheel
or from the pedals.

Knobs: the `.track` height in `style.css` sets how much scroll the four stages
take, and `SCALE` in `failure.js` is the mAP at full bar width. Below 62rem the
stage unpins.

## The road

`drive.js` draws the road across the top of the page. The car sits a quarter of
the way into it, nose right, because right is forward is down the page, and the
world slides past the car rather than the car sliding along a track ,  that is
what driving looks like from the driver's seat, and it is the only way the
speed reads as speed.

The road carries the map the car is building, in its class colours and with
the per-polyline vertices a predicted map is drawn with. That is the subject of
the paper, and it is what makes a progress indicator mean something.

The map does not stop at the car. The model predicts over a region of interest
around the ego, so it runs `PERCEPTION_M` up the road ahead (30 m, the
longitudinal half of the paper's 60 x 30 m setting) and thins out across that
range, because distant evidence is sparse and the prediction there is a guess.
Every stretch driven stays drawn, and only the model extends one: scrolling
past a stretch you never drove leaves it bare. Drive away from one and a new
one starts without erasing the old. **Clear map** in the cockpit wipes them
all.

Reaching the end of the document sends the car off the right-hand side and
the road says thank you; driving back up takes it back.

Each section is a junction with a **guide sign** at its true position, green
with its section number set like an exit number, standing on two posts that run
down into the verge. Every section needs an entry in the top bar's link list,
since that is where the signs take their short names from. The next junction
and its distance are called out in the cockpit, next to the trip meter. Under the road runs the **route bar**: the whole document, with a
tick per section, and dragging it seeks one to one. Seeking is explicitly
instant, because `html` carries `scroll-behavior: smooth` and a smooth scroll
restarted on every pointermove lurches instead of tracking.

The road reserves its own band at the top the way a scrollbar reserves a
gutter, so it never sits over the content; the top bar sticks below it and
anchors clear both. Below 900 px, and under `prefers-reduced-motion`, the road
and the cockpit stand down and the link list comes back.

## Driving it

The cockpit at the bottom right carries the gear selector, the pedals, a
speedometer, a tachometer and a trip meter. **Accel** and **Brake** are held,
not clicked; `W` and `S` are the same two pedals and `D` and `R` the selector. The arrow keys are left alone, because they are how the page scrolls.

The scroll is not an easing curve. It is a longitudinal vehicle model: a 210 Nm
engine torque curve through a five-speed automatic and a 3.9 final drive,
against aerodynamic drag and rolling resistance, integrated once per frame on a
1500 kg car. The gearbox shifts on rpm with a torque cut, and its upshift point
rises with throttle, so a gentle pull-away shifts early and a floored one holds
each gear out to the redline. Lift off and it takes the tallest gear it can;
brake and it walks back down. **R** is a real gear, governed to about 18 km/h,
and it is how you go back up the page. There are only two gears, because there
are only two things you can do to a page: go down it or go back up. Changing
direction above walking pace is refused.

Metres are the unit throughout. `PX_PER_M` converts them to document pixels and
`ROAD_PX_PER_M` to strip pixels, and the two are deliberately different: the
document is long, and a road drawn at the document's own scale would show one
lane marking at a time. `PX_PER_M` is the one number that decides whether
ordinary road speeds come out as comfortable reading speeds ,  at 18, 50 km/h
scrolls at 250 px/s and 90 km/h at 450, which is what keeps the whole gearbox in
use over a document this length.

When the page is yours rather than the model's, the car does not sit exactly
where the page is: it chases it, and the speed on the dial is the chase's own
rate. A wheel moves the page in notches, and differentiating that staircase
gives a reading that spikes and dies on every notch, with a road that jumps
along with it. The chase costs about 200 ms of lag, which reads as the weight
of a car. Past a 60 m gap it stops chasing and simply relocates, because an
anchor jump is not driving. `FOLLOW_K` and `FOLLOW_SMOOTH` are the two knobs.

The model owns the scroll position only while someone is driving it. A wheel or
a touch of your own hands it straight back, and from then on the page scrolls
the way it always did while the road and the speedometer simply report what it
is doing; pressing a pedal takes the wheel again, from whatever speed the page
was already travelling at. It is one rAF loop advancing a float position with
`scroll-behavior` forced to auto for the duration ,  a chain of smooth
`scrollTo` calls restarts itself every frame and stutters ,  and the loop
sleeps when the car is stopped.

Knobs: `--road-h`, `--road-surface` and `--road-line` in `style.css` (the JS
reads the last two, so the carriageway and its markings cannot drift from the
palette), and `PX_PER_M`, `ROAD_PX_PER_M`, `CAR_X`, `MIN_VIEWPORT` and the
vehicle block in `drive.js`.

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
