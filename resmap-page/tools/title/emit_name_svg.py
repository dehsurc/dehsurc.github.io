"""Write the name's inline SVG from title.json (build_name_svg.py, then
centrelines.py). Two layers over one set of glyph outlines:
  solid - the name as text; always there, never cut
  map   - the same letters as a predicted HD map: road boundaries along the
          edges, lane dividers down the centre of every stroke. It shows only
          inside a round lens that main.js moves with the pointer, over
          page-coloured copies of the letters that hide the solid ones.
Cutting the solid letters at the lens edge instead would leave a hairline
seam there at rest, where two anti-aliased halves meet."""
import json, re
d = json.load(open('title.json'))
W, top, upm = d['width'], d['top'], d['upm']
R = 880                       # lens radius: about a letter and a half across
MID = (-1510 + 418) / 2       # halfway down the glyphs, where the demo pass runs
def f(v): return ('%.1f' % v).rstrip('0').rstrip('.')
def pts(p, close=False):
    q = p + ([p[0]] if close else [])
    return ' '.join(f'{f(x)},{f(y)}' for x, y in q)
def path(dstr): return re.sub(r'-?\d+\.\d+', lambda m: f(float(m.group(0))), dstr)
L = d['letters']
o = [f'<svg class="name-svg" viewBox="0 {f(top)} {f(W)} {upm}" aria-hidden="true" focusable="false"'
     f' data-lens="{R} {f(MID)}">', '<defs>']
for i, l in enumerate(L):
    o.append(f'<path id="nm-p{i}" d="{path(l["d"])}"/>')
o.append(f'<clipPath id="nm-in"><circle id="nm-lens" cx="-99999" cy="{f(MID)}" r="{R}"/></clipPath>')
o.append('</defs>')
o.append('<g class="nm-solid">' + ''.join(f'<use href="#nm-p{i}"/>' for i in range(len(L))) + '</g>')
m = ['<g class="nm-map" clip-path="url(#nm-in)">']
for i, l in enumerate(L):
    # Page colour in the shape of the letter, not a disc: a disc covered
    # whatever sat near the name -- the venue line above it, for one.
    m.append(f'<use class="paper" href="#nm-p{i}"/><use class="ghost" href="#nm-p{i}"/>')
    for p in l['polys']:
        m.append(f'<polyline class="boundary" points="{pts(p, True)}"/>')
    for c in l['center']:
        m.append(f'<polyline class="divider" points="{pts(c)}"/>')
m.append('</g>')
o += m
o.append('</svg>')
out = ''.join(o)
open('name.svg.html', 'w').write(out)
print('bytes', len(out))
