"""Write the name's inline SVG from title.json (build_name_svg.py, then
centrelines.py). Three layers over one set of glyph outlines:
  solid - the name as text, which is all anyone sees at rest
  road  - asphalt letters with edge lines and a dashed centre line
  map   - the same letters as a predicted HD map: boundaries and dividers
The map layer shows only inside the ego's ROI box, the road layer only
outside it; main.js moves the box with the pointer."""
import json
d = json.load(open('title.json'))
W, top, upm = d['width'], d['top'], d['upm']
# The ego's ROI: as tall as the glyphs (-1510 to 418) and a margin, about a
# letter wide. No frame is drawn, so its proportions are not a claim; the
# edge is where the road stops and the map starts.
ROI_Y0, ROI_Y1 = -1550, 460
ROI_H = ROI_Y1 - ROI_Y0; ROI_W = 1200
def f(v): return ('%.1f' % v).rstrip('0').rstrip('.')
def pts(p, close=False):
    q = p + ([p[0]] if close else [])
    return ' '.join(f'{f(x)},{f(y)}' for x, y in q)
import re
def path(dstr): return re.sub(r'-?\d+\.\d+', lambda m: f(float(m.group(0))), dstr)
L = d['letters']
o = [f'<svg class="name-svg" viewBox="0 {f(top)} {f(W)} {upm}" aria-hidden="true" focusable="false"'
     f' data-roi="{ROI_Y0} {ROI_H} {ROI_W}">', '<defs>']
for i, l in enumerate(L):
    o.append(f'<path id="nm-p{i}" d="{path(l["d"])}"/>')
    o.append(f'<clipPath id="nm-c{i}"><use href="#nm-p{i}"/></clipPath>')
o.append(f'<clipPath id="nm-in"><rect id="nm-roi-in" x="-99999" y="{ROI_Y0}" width="{ROI_W}" height="{ROI_H}"/></clipPath>')
o.append(f'<clipPath id="nm-out"><path id="nm-roi-out" clip-rule="evenodd" d="M-9999,-9999H99999V99999H-9999Z"/></clipPath>')
o.append('</defs>')
o.append('<g class="nm-solid">' + ''.join(f'<use href="#nm-p{i}"/>' for i in range(len(L))) + '</g>')
road = ['<g class="nm-road" clip-path="url(#nm-out)">']
for i, l in enumerate(L):
    road.append(f'<use class="asphalt" href="#nm-p{i}"/><use class="edge" href="#nm-p{i}" clip-path="url(#nm-c{i})"/>')
    for c in l['center']:
        road.append(f'<polyline class="lane" points="{pts(c)}"/>')
road.append('</g>')
o += road
m = ['<g class="nm-map" clip-path="url(#nm-in)">']
for i, l in enumerate(L):
    m.append(f'<use class="ghost" href="#nm-p{i}"/>')
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
