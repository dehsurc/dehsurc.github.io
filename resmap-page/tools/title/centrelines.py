"""Stroke centrelines for each letter of the name: rasterize the outline,
skeletonize, prune the spurs, trace the result into polylines in font units.
These become the lane divider painted down the middle of each stroke."""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize
from skimage.measure import approximate_polygon

S = 0.28                     # raster px per font unit
PRUNE = 150                  # font units: spurs shorter than this are corner forks
d = json.load(open('title.json'))

def raster(contours):
    xs = [p[0] for c in contours for p in c]; ys = [p[1] for c in contours for p in c]
    x0, y0 = min(xs) - 40, min(ys) - 40
    w = int((max(xs) - x0 + 40) * S) + 1; h = int((max(ys) - y0 + 40) * S) + 1
    acc = np.zeros((h, w), bool)
    for c in contours:          # even-odd: holes come out as holes
        im = Image.new('1', (w, h), 0)
        ImageDraw.Draw(im).polygon([((x - x0) * S, (y - y0) * S) for x, y in c], fill=1)
        acc ^= np.array(im, bool)
    return acc, x0, y0

N8 = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
def nbrs(sk, r, c):
    h, w = sk.shape
    return [(r+dr, c+dc) for dr, dc in N8 if 0 <= r+dr < h and 0 <= c+dc < w and sk[r+dr, c+dc]]

def prune(sk, length_px):
    sk = sk.copy()
    for _ in range(4):
        changed = False
        ends = [tuple(p) for p in np.argwhere(sk) if len(nbrs(sk, *p)) == 1]
        for e in ends:
            path = [e]; prev = None; cur = e
            while True:
                nb = [q for q in nbrs(sk, *cur) if q != prev and q not in path]
                if len(nbrs(sk, *cur)) > 2 or not nb or len(path) > length_px: break
                prev, cur = cur, nb[0]; path.append(cur)
            if len(nbrs(sk, *cur)) > 2 and len(path) <= length_px:
                for q in path[:-1]: sk[q] = False
                changed = True
        if not changed: break
    return skeletonize(sk)

def trace(sk):
    """Polylines between endpoints and junctions; closed loops on their own."""
    deg = {tuple(p): len(nbrs(sk, *p)) for p in np.argwhere(sk)}
    nodes = {p for p, k in deg.items() if k != 2}
    seen = set(); lines = []
    def walk(a, b):
        line = [a, b]; prev, cur = a, b
        while cur not in nodes:
            nxt = [q for q in nbrs(sk, *cur) if q != prev]
            if not nxt: break
            prev, cur = cur, nxt[0]
            if cur == line[0]: line.append(cur); break
            line.append(cur)
        return line
    for n in nodes:
        for m in nbrs(sk, *n):
            e = frozenset((n, m))
            if e in seen: continue
            line = walk(n, m)
            for i in range(len(line) - 1): seen.add(frozenset((line[i], line[i+1])))
            lines.append(line)
    rest = {p for p in deg if not any(frozenset((p, q)) in seen for q in nbrs(sk, *p))}
    while rest:                                  # pure cycles (no node on them)
        start = rest.pop(); nb = nbrs(sk, *start)
        line = walk(start, nb[0]); rest -= set(line); lines.append(line)
    return lines

for L in d['letters']:
    mask, x0, y0 = raster(L['dense'])
    sk = prune(skeletonize(mask), int(PRUNE * S))
    out = []
    for line in trace(sk):
        if len(line) < 6: continue
        pts = approximate_polygon(np.array(line, float), tolerance=1.2)
        out.append([(float(c / S + x0), float(r / S + y0)) for r, c in pts])
    L['center'] = out
    print(L['ch'], len(out), 'centrelines', [len(p) for p in out])
json.dump(d, open('title.json', 'w'))
