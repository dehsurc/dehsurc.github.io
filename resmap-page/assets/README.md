# Assets

The page references these files. Any that are missing render as a dashed
placeholder naming the expected path, so the page stays usable while they
are being produced.

## Figures — `assets/figures/`

| File            | Used in       | Source                                    | Status  |
|-----------------|---------------|-------------------------------------------|---------|
| `overview.webp` | §3 Method     | paper Fig. 1 (architecture)               | in      |
| `ocmq.webp`     | §3.2          | paper Fig. 3 (query design / matching)    | in      |
| `gate.webp`     | §7.1 Analysis | paper Fig. 2, composed from its six parts  | in      |
| `social.jpg`    | link previews | 1200 x 630, the top of the overview        | stopgap |
| `teaser.webp`   | hero          | not in the paper: a qualitative panel under all-camera drop would do | **wanted** |

`gate.webp` is assembled by `compose_gate.py`, which reads the six parts the
paper builds Figure 2 from (`1-1`, `1-2`, `2-1`, `2-2`, `colorbar_v`, `3`) out
of `SRC` at the top of the file and writes the WebP straight out. It draws the
headers, the rotated row and axis labels and the sub-captions that the LaTeX
tabular puts around them.

## How these were made

Rendered from the paper PDFs with ghostscript, trimmed, then encoded as WebP:

```
gs -q -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r<dpi> \
   -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile=out.png fig.pdf
convert out.png -bordercolor white -border 1 -fuzz 1% -trim +repage \
        -bordercolor white -border 12 -strip flat.png
convert flat.png -define webp:near-lossless=60 -define webp:method=6 \
        -strip final.webp
```

`<dpi>` is `2880 / <pdf width in points> * 72`, which gives a 2880 px image:
twice the 1440 px the figures are ever shown at.

Pick the encoder by what is in the figure. Line art with flat fills compresses
better truly lossless (`-define webp:lossless=true`): `ocmq` is 59 KB that way
against 96 KB near-lossless. Anything with a photograph in it goes the other
way, and `overview` is 158 KB near-lossless against 246 KB lossless. Both are
indistinguishable from the PNG at 1:1; the PNGs they replaced were 465 KB and
160 KB.

Keep each file well under 200 KB. The four together are 288 KB.

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
