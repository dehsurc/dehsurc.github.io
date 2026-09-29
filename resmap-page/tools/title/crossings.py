"""Pedestrian crossings for the map layer of the name: a few, across the
straight stems, sized to the stroke they cross, with the lane divider cut
where it passes through them as it would be on a road. Run after
centrelines.py, with the resmap env's python (numpy, PIL, scipy)."""
import json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

S = 0.28
# Letters that get one, and where: a fraction along the stem, or for a letter
# whose centreline is one curve (S), a fraction along that curve's length.
AT = {'S': ('curve', 0.5), 'M': ('stem', 0.62), 'p': ('stem', 0.62)}
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
    # Where it goes: on the longest straight run of centreline (the stem), or,
    # for a letter with no stem to speak of, part-way along its longest curve.
    lines = L['center']
    mode, frac = AT[L['ch']]
    def lens(l): return [math.dist(p, q) for p, q in zip(l, l[1:])]
    if mode == 'stem':     # the line holding the longest straight segment
        li = max(range(len(lines)), key=lambda i: max(lens(lines[i])))
    else:                  # the longest line
        li = max(range(len(lines)), key=lambda i: sum(lens(lines[i])))
    line = lines[li]
    seg = lens(line)
    straight = mode == 'stem'
    if straight:
        si = max(range(len(seg)), key=lambda i: seg[i])
        s_at = sum(seg[:si]) + seg[si] * frac
    else:
        s_at = sum(seg) * frac
    def at(s):                                # point and unit tangent at arc length s
        acc = 0.0
        for i, ln in enumerate(seg):
            if acc + ln >= s or i == len(seg) - 1:
                f = (s - acc) / ln
                a, b = line[i], line[i + 1]
                return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), i
            acc += ln
    (cx, cy), _ = at(s_at)
    (ax, ay), _ = at(max(0, s_at - 120)); (bx, by), _ = at(min(sum(seg), s_at + 120))
    tl = math.hypot(bx - ax, by - ay)
    dx, dy = (bx - ax) / tl, (by - ay) / tl
    nx, ny = -dy, dx
    r, c = int((cy - y0) * S), int((cx - x0) * S)
    half = dist[r, c] * 0.93                 # to just inside the stroke's edges
    hd = DEPTH / 2
    poly = [(cx + nx * half + dx * hd, cy + ny * half + dy * hd),
            (cx - nx * half + dx * hd, cy - ny * half + dy * hd),
            (cx - nx * half - dx * hd, cy - ny * half - dy * hd),
            (cx + nx * half - dx * hd, cy + ny * half - dy * hd)]
    L['crossings'].append(poly)
    # Cut the divider around it, along the line's own length so a curve is cut too.
    cut = hd + GAP
    pa, ia = at(s_at - cut); pb, ib = at(s_at + cut)
    before = line[:ia + 1] + [pa]; after = [pb] + line[ib + 1:]
    L['center'][li:li + 1] = [before, after]
    ln = sum(seg)
    print(f"{L['ch']}: crossing {2*half:.0f} x {DEPTH} units, {'on the stem' if straight else 'along the curve'}")
json.dump(d, open('title.json', 'w'))
