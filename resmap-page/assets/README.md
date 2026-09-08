# Assets

The page references these files. Any that are missing render as a dashed
placeholder naming the expected path, so the page stays usable while they
are being produced.

## Figures — `assets/figures/`

| File           | Used in            | Source                                   |
|----------------|--------------------|------------------------------------------|
| `teaser.png`   | hero               | new figure: baselines vs. ReSMap under all-camera drop |
| `overview.png` | §3 Method          | paper Fig. 1 (architecture)              |
| `ocmq.png`     | §3.2               | paper Fig. 3 (query design / matching)   |
| `gate.png`     | §6.1 Analysis      | paper Fig. 2 (per-pixel and per-query gate) |
| `social.jpg`   | link previews      | 1200 × 630 crop of the teaser            |

Export at roughly 2× the display width (2000–2400 px wide is plenty) and
keep each file under ~600 KB. PNG for diagrams, JPEG for photographic panels.

## Video — `assets/video/`

One `.mp4` and one `.jpg` poster per scene, named after the scene:

    scene-0369.mp4   scene-0369.jpg
    scene-0100.mp4   scene-0100.jpg
    scene-0796.mp4   scene-0796.jpg

H.264 / yuv420p, ≤ 1600 px wide, no audio track. To change the list, edit the
`.scene-picker` buttons in `index.html`; `main.js` derives both paths from
each button's `data-scene` value.

## Paper — `assets/paper/`

`resmap.pdf` (and optionally `resmap_supp.pdf`), then link them from the
citation section of `index.html`.
