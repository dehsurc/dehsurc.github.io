"""Pedestrian crossings for the map layer of the name: a few, across the
straight stems, sized to the stroke they cross, with the lane divider cut
where it passes through them as it would be on a road. Run after
centrelines.py, with the resmap env's python (numpy, PIL, scipy)."""
import json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

S = 0.28
AT = {'R': 0.5, 'M': 0.62, 'p': 0.62}   # letters that get one, and where along the stem
DEPTH = 190                               # font units along the stroke (half = 95)
GAP = 60                                  # divider stops this far short of the crossing

d = json.load(open('title.json'))

def raster(contours):
    xs = [p[0] for c in contours for p in c]; ys = [p[1] for c in contours for p in c]
    x0, y0 = min(xs) - 40, min(ys) - 40
    w = int((max(xs) - x0 + 40) * S) + 1; h = int((max(ys) - y0 + 40) * S) + 1
    m = np.zeros((h, w), bool)
    for c in contours:
        im = Image.new('1', (w, h), 0)
        ImageDraw.Draw(im).polygon([((x - x0) * S, (y - y0) * S) for x, y in c], fill=1)
        m ^= np.array(im, bool)
    return m, x0, y0

for L in d['letters']:
    L['crossings'] = []
    if L['ch'] not in AT: continue
    m, x0, y0 = raster(L['dense'])
    dist = ndimage.distance_transform_edt(m) / S
    # The longest straight run of centreline: that is the stem.
    best = None
    for li, line in enumerate(L['center']):
        for si in range(len(line) - 1):
            a, b = line[si], line[si + 1]
            ln = math.dist(a, b)
            if best is None or ln > best[0]: best = (ln, li, si)
    ln, li, si = best
    a, b = L['center'][li][si], L['center'][li][si + 1]
    dx, dy = (b[0] - a[0]) / ln, (b[1] - a[1]) / ln
    nx, ny = -dy, dx
    t = AT[L['ch']]
    cx, cy = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
    r, c = int((cy - y0) * S), int((cx - x0) * S)
    half = dist[r, c] * 0.93                 # to just inside the stroke's edges
    hd = DEPTH / 2
    poly = [(cx + nx * half + dx * hd, cy + ny * half + dy * hd),
            (cx - nx * half + dx * hd, cy - ny * half + dy * hd),
            (cx - nx * half - dx * hd, cy - ny * half - dy * hd),
            (cx + nx * half - dx * hd, cy + ny * half - dy * hd)]
    L['crossings'].append(poly)
    # Cut the divider around it.
    cut = hd + GAP
    pa = (cx - dx * cut, cy - dy * cut); pb = (cx + dx * cut, cy + dy * cut)
    line = L['center'][li]
    before = line[:si + 1] + [pa]; after = [pb] + line[si + 1:]
    L['center'][li:li + 1] = [before, after]
    print(f"{L['ch']}: crossing {2*half:.0f} x {DEPTH} units across a {ln:.0f}-unit stem")
json.dump(d, open('title.json', 'w'))
