"""Set 'ReSMap' in Inter Tight 700 as SVG: the glyph outlines for the filled
state, and each contour resampled at even arc length for the mapped state."""
import sys, math, json
sys.path.insert(0, './py')
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.basePen import BasePen
from fontTools.pens.transformPen import TransformPen

WORD = 'ReSMap'
TRACK = -0.035            # letter-spacing, em, as in .h1-name
SPACING = float(sys.argv[1]) if len(sys.argv) > 1 else 250   # font units between vertices
MIN_PTS = 7
CLASSES = ['boundary', 'divider', 'crossing', 'boundary', 'divider', 'crossing']

font = TTFont('it700-flat.ttf')   # overlaps removed: the outline you see
upm = font['head'].unitsPerEm
gs = font.getGlyphSet()

blob = hb.Blob.from_file_path('it700-flat.ttf')
face = hb.Face(blob); hbfont = hb.Font(face)
buf = hb.Buffer(); buf.add_str(WORD); buf.guess_segment_properties()
hb.shape(hbfont, buf, {'kern': True, 'liga': True})
order = font.getGlyphOrder()

class Flat(BasePen):
    """Flattens quadratic outlines into dense point lists, one per contour."""
    def __init__(self, gs):
        super().__init__(gs); self.contours = []; self.cur = None
    def _moveTo(self, p): self.cur = [p]; self.contours.append(self.cur)
    def _lineTo(self, p): self.cur.append(p)
    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, 17):
            t = i / 16
            self.cur.append(((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0],
                             (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1]))
    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, 17):
            t = i / 16; u = 1 - t
            self.cur.append((u**3*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t**3*p3[0],
                             u**3*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t**3*p3[1]))
    def _closePath(self):
        if self.cur and self.cur[0] != self.cur[-1]: self.cur.append(self.cur[0])
    _endPath = _closePath

def turn(a, b, c):
    """Angle in degrees the path turns through at b."""
    v1 = (b[0]-a[0], b[1]-a[1]); v2 = (c[0]-b[0], c[1]-b[1])
    n1 = math.hypot(*v1); n2 = math.hypot(*v2)
    if n1 == 0 or n2 == 0: return 0.0
    cos = max(-1.0, min(1.0, (v1[0]*v2[0] + v1[1]*v2[1]) / (n1*n2)))
    return math.degrees(math.acos(cos))

def resample(pts, spacing, corner_deg=32):
    """Even arc-length vertices, but every sharp corner kept as a vertex:
    evenly spaced alone, a vertex lands wherever the spacing puts it and the
    corners in between are cut, which is what bent the R's leg into a zigzag."""
    if pts[0] == pts[-1]: pts = pts[:-1]
    n = len(pts)
    # Dedupe consecutive duplicates.
    pts = [p for i, p in enumerate(pts) if i == 0 or math.dist(p, pts[i-1]) > 1e-6]
    n = len(pts)
    corners = [i for i in range(n) if turn(pts[i-1], pts[i], pts[(i+1) % n]) > corner_deg]
    if not corners: corners = [0]
    out = []
    for k, ci in enumerate(corners):
        cj = corners[(k+1) % len(corners)]
        run = [pts[ci]]
        i = ci
        while True:
            i = (i + 1) % n
            run.append(pts[i])
            if i == cj: break
        seg = [math.dist(run[m], run[m+1]) for m in range(len(run)-1)]
        total = sum(seg)
        m = max(1, round(total / spacing))
        step = total / m
        acc, s_i = 0.0, 0
        for q in range(m):          # the run's start corner, then its interior points
            target = q * step
            while s_i < len(seg) - 1 and acc + seg[s_i] < target:
                acc += seg[s_i]; s_i += 1
            f = 0 if seg[s_i] == 0 else (target - acc) / seg[s_i]
            a, b = run[s_i], run[s_i+1]
            out.append((a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f))
    return out, None

letters, x = [], 0.0
track = TRACK * upm
for n, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
    gname = order[info.codepoint]
    ox = x + pos.x_offset
    sp = SVGPathPen(gs)
    gs[gname].draw(TransformPen(sp, (1, 0, 0, -1, ox, 0)))
    fl = Flat(gs)
    gs[gname].draw(TransformPen(fl, (1, 0, 0, -1, ox, 0)))
    polys = [resample(c, SPACING)[0] for c in fl.contours if len(c) > 2]
    letters.append({'ch': WORD[n], 'cls': CLASSES[n], 'd': sp.getCommands(), 'polys': polys,
                    'dense': [c for c in fl.contours if len(c) > 2]})
    x += pos.x_advance + (track if n < len(WORD) - 1 else 0)

# Vertical frame: the CSS line box of the text it replaces. line-height is 1,
# so the box is 1em tall and the content area (ascent + descent) is centred in
# it; the baseline sits ascent - half the overflow below the top.
asc, desc = font['hhea'].ascent, -font['hhea'].descent
top = -(asc - (asc + desc - upm) / 2)
json.dump({'upm': upm, 'width': x, 'top': top, 'letters': letters}, open('title.json', 'w'))
print('width', round(x), 'top', round(top), 'contours', [len(l['polys']) for l in letters],
      'vertices', [sum(len(p) for p in l['polys']) for l in letters])
