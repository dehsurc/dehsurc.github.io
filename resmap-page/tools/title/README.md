# The name in the title

`index.html` carries "ReSMap" as an inline SVG built from the font, in three layers
(solid / road / map). Regenerate it only if the word, the face or the weight changes.

1. `build_name_svg.py` — shapes the word with HarfBuzz in Inter Tight 700 (overlaps
   removed, letter-spacing -0.035em as in `.h1-name`) and writes outlines plus
   resampled boundary polylines to `title.json`. Needs `fontTools`, `uharfbuzz`,
   `skia-pathops` and the font as `it700-flat.ttf`.
2. `centrelines.py` — rasterizes each letter, skeletonizes it and traces the stroke
   centrelines (the lane dividers). Needs `scikit-image`; run it with the `resmap`
   env's python, read-only.
3. `emit_name_svg.py` — writes the markup; paste it into the `<h1>`.
