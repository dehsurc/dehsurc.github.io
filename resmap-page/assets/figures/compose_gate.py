"""Assemble the gate figure from the paper's five sub-PDFs.

The LaTeX builds this as a 2x3 tabular; here it is composed directly so the
one image the page needs carries its own headers and row labels. Parts:
1-1/1-2 and 2-1/2-2 are the BEV gate maps, colorbar_v is their scale, and
3 is the per-query bar chart.
"""
import subprocess, os, tempfile
from PIL import Image, ImageDraw, ImageFont

SRC = '/home/kyungmin/min_ws'                      # where the paper's parts are
OUT = os.path.dirname(os.path.abspath(__file__))
TMP = tempfile.mkdtemp(prefix='gate-')
S = 2                                   # supersample, downscaled at the end

BEV_W, GAP, COL_GAP = 640 * S, 12 * S, 12 * S
CBAR_PAD = 22 * S                       # air either side of the colorbar
LBL_W, HEAD_H, CAP_H = 34 * S, 34 * S, 40 * S
AX_W = 38 * S

def size(name):
    out = subprocess.run(
        ['python3', '-c',
         "import warnings;warnings.filterwarnings('ignore')\n"
         "from pypdf import PdfReader\n"
         "b=PdfReader('%s/%s.pdf').pages[0].mediabox\n"
         "print(float(b.width), float(b.height))" % (SRC, name)],
        capture_output=True, text=True).stdout.split()
    return float(out[0]), float(out[1])

def render(name, target_w=None, target_h=None):
    out = os.path.join(TMP, 'c-%s.png' % name)
    w, h = size(name)
    dpi = round((target_w / w if target_w else target_h / h) * 72)
    subprocess.run(['gs', '-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=png16m',
                    '-r%d' % dpi, '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4',
                    '-sOutputFile=' + out, '%s/%s.pdf' % (SRC, name)], check=True)
    return Image.open(out).convert('RGB')

bev = {n: render(n, target_w=BEV_W) for n in ('1-1', '1-2', '2-1', '2-2')}
row_h = bev['1-1'].height

# The bar chart stands as tall as the two BEV rows together.
panel_h = row_h * 2 + GAP
chart = render('3', target_w=4000)
chart = chart.resize((round(chart.width * panel_h / chart.height), panel_h), Image.LANCZOS)

# The scale for the two BEV rows, standing as tall as they do.
cbar = render('colorbar_v', target_h=panel_h * 3)
cbar = cbar.resize((round(cbar.width * panel_h / cbar.height), panel_h), Image.LANCZOS)
PANEL_GAP = cbar.width + CBAR_PAD * 2

W = LBL_W + BEV_W * 2 + COL_GAP + PANEL_GAP + chart.width + AX_W
H = HEAD_H + panel_h + CAP_H
img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)

F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FI = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf'
head = ImageFont.truetype(F, 17 * S)
cap = ImageFont.truetype(F, 17 * S)
lab = ImageFont.truetype(FI, 17 * S)
sub = ImageFont.truetype(F, 12 * S)
AX_W = AX_W
INK = (21, 23, 27)

def centre(text, font, cx, cy, fill=INK):
    b = d.textbbox((0, 0), text, font=font)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), text, font=font, fill=fill)

def script(base, subs, font, small):
    """A label as a tight RGBA tile: base glyphs, then a subscript."""
    bb, sb = font.getbbox(base), small.getbbox(subs)
    w = (bb[2] - bb[0]) + (sb[2] - sb[0]) + 3 * S
    h = (bb[3] - bb[1]) + 5 * S
    t = Image.new('RGBA', (w + 4 * S, h + 4 * S), (0, 0, 0, 0))
    dd = ImageDraw.Draw(t)
    dd.text((2 * S - bb[0], 2 * S - bb[1]), base, font=font, fill=INK)
    dd.text((2 * S - bb[0] + (bb[2] - bb[0]) + 2 * S, 2 * S - bb[1] + (bb[3] - bb[1]) - (sb[3] - sb[1]) + 2 * S),
            subs, font=small, fill=INK)
    return t

def turned(tile, cx, cy, deg):
    t = tile.rotate(deg, expand=True, resample=Image.BICUBIC)
    img.paste(t, (round(cx - t.width / 2), round(cy - t.height / 2)), t)

x0 = LBL_W
col = [x0, x0 + BEV_W + COL_GAP]
panel_x = x0 + BEV_W * 2 + COL_GAP + PANEL_GAP

centre('Clean', head, col[0] + BEV_W / 2, HEAD_H / 2)
centre('All-camera drop', head, col[1] + BEV_W / 2, HEAD_H / 2)
centre('Per-query camera gate', head, panel_x + chart.width / 2, HEAD_H / 2)

for r, (a, b_) in enumerate((('1-1', '1-2'), ('2-1', '2-2'))):
    y = HEAD_H + r * (row_h + GAP)
    img.paste(bev[a], (col[0], y))
    img.paste(bev[b_], (col[1], y))
    turned(script('r', ['cam', 'sat'][r], lab, sub), LBL_W / 2, y + row_h / 2, 90)

img.paste(cbar, (x0 + BEV_W * 2 + COL_GAP + CBAR_PAD, HEAD_H))
img.paste(chart, (panel_x, HEAD_H))
turned(script('α', 'cam', lab, sub), panel_x + chart.width + AX_W / 2, HEAD_H + panel_h * 0.25, 270)
turned(script('Δα', 'cam', lab, sub), panel_x + chart.width + AX_W / 2, HEAD_H + panel_h * 0.75, 270)

yc = HEAD_H + panel_h + CAP_H / 2
centre('(a) Per-pixel BEV gate', cap, x0 + BEV_W + COL_GAP / 2, yc)
centre('(b) Per-query gate', cap, panel_x + chart.width / 2, yc)

img = img.resize((W // S, H // S), Image.LANCZOS)
flat = os.path.join(TMP, 'gate.png')
img.save(flat)

# Near-lossless: the BEV maps are photographic enough that truly lossless
# costs more than it is worth, and the labels stay exact either way.
final = os.path.join(OUT, 'gate.webp')
subprocess.run(['convert', flat, '-define', 'webp:near-lossless=60',
                '-define', 'webp:method=6', '-strip', final], check=True)
print('gate.webp  %dx%d  %d bytes' % (img.width, img.height, os.path.getsize(final)))
