"""TimberForge master vector assets: badge, glyph, wordmark, lockups."""
import json, re, os
from shapely.geometry import Polygon
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = "/sessions/nifty-optimistic-goodall"
T = json.load(open(f"{ROOT}/brand/traced.json"))
VBH = T["vbh"]

# palette (from the approved artwork)
BORDER = "#041B1C"
DEEP   = "#0F2C1F"
CREAM  = "#FBFAF6"
INK    = "#0F2C1F"
GREEN  = "#3A5036"
GREY   = "#586063"
TAN    = "#A8946E"

FONTS = {"bold": f"{ROOT}/fonts/montserrat-700.ttf",
         "med":  f"{ROOT}/fonts/montserrat-600.ttf",
         "reg":  f"{ROOT}/fonts/montserrat-400.ttf"}

# ---------------- badge ----------------
def badge_layers():
    return "".join(f'<path d="{l["d"]}" fill="{l["fill"]}" fill-rule="evenodd"/>'
                   for l in T["layers"])

# ---------------- shield geometry ----------------
def _parse(d):
    nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", d)]
    return list(zip(nums[0::2], nums[1::2]))

SHIELD_POLY = Polygon(_parse(T["shield"]))

def shield_path(inset=0.0, prec=2):
    p = SHIELD_POLY if inset == 0 else SHIELD_POLY.buffer(-inset, join_style=1, quad_segs=32)
    if p.geom_type == "MultiPolygon":
        p = max(p.geoms, key=lambda g: g.area)
    pts = list(p.exterior.coords)[:-1]
    return "M " + " L ".join(f"{x:.{prec}f} {y:.{prec}f}" for x, y in pts) + " Z"

def conifer(cx, base, h, w, tiers=5, notch=0.52, taper=0.82):
    right = []
    for i in range(1, tiers + 1):
        t = i / tiers
        y = base - h + h * (0.88 * t)
        half = w * (t ** taper)
        right.append((cx + half, y))
        if i < tiers:
            right.append((cx + half * notch, y))
    right.append((cx + w * 0.22, base))
    left = [(2 * cx - x, y) for x, y in reversed(right)]
    pts = [(cx, base - h)] + right + left
    return "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z"

def glyph(mono=None, ring=True):
    """Simplified mark for <=48px. mono = single colour override."""
    a = mono or BORDER
    b = CREAM if not mono else "none"
    tree = mono or DEEP
    out = [f'<path d="{shield_path(0)}" fill="{a}"/>']
    if ring:
        out.append(f'<path d="{shield_path(9.5)}" fill="{b}"/>')
    out.append(f'<path d="{conifer(50, 93, 63, 21)}" fill="{tree}"/>')
    return "".join(out)

def glyph_solid(fg=CREAM, bg=DEEP):
    """Knockout version: solid shield, tree cut out. Best for tiny sizes."""
    return (f'<path d="{shield_path(0)}" fill="{bg}"/>'
            f'<path d="{conifer(50, 93, 63, 21)}" fill="{fg}"/>')

# ---------------- type ----------------
_cache = {}
def _font(k):
    if k not in _cache:
        f = TTFont(FONTS[k]); _cache[k] = (f, f.getGlyphSet(), f.getBestCmap(),
                                           f["hmtx"], f["head"].unitsPerEm)
    return _cache[k]

def text_path(s, weight="bold", size=100, tracking=0.0, x=0.0, y=0.0):
    """Outline text to an SVG path. tracking is in em units. Returns (d, width)."""
    font, gs, cmap, hmtx, upem = _font(weight)
    scale = size / upem
    pen = SVGPathPen(gs)
    cur = x
    for ch in s:
        gn = cmap.get(ord(ch))
        if gn is None:
            cur += size * 0.3
            continue
        tp = TransformPen(pen, (scale, 0, 0, -scale, cur, y))
        gs[gn].draw(tp)
        cur += hmtx[gn][0] * scale + tracking * size
    return pen.getCommands(), cur - x

def text_width(s, weight="bold", size=100, tracking=0.0):
    font, gs, cmap, hmtx, upem = _font(weight)
    scale = size / upem
    return sum(hmtx[cmap[ord(c)]][0] * scale + tracking * size
               for c in s if ord(c) in cmap)

def cap_height(weight="bold", size=100):
    font = _font(weight)[0]
    try:
        return font["OS/2"].sCapHeight / font["head"].unitsPerEm * size
    except Exception:
        return size * 0.7

def wordmark(size=100, tagline=None, tag_size=None, x=0, y=0):
    """'TimberForge' two-tone, optional tagline beneath. Returns (svg, w, h)."""
    d1, w1 = text_path("Timber", "bold", size, x=x, y=y)
    d2, w2 = text_path("Forge", "bold", size, x=x + w1, y=y)
    out = [f'<path d="{d1}" fill="{INK}"/>', f'<path d="{d2}" fill="{GREEN}"/>']
    w = w1 + w2
    h = cap_height("bold", size)
    if tagline:
        ts = tag_size or size * 0.185
        tw = text_width(tagline, "med", ts, tracking=0.20)
        gap = size * 0.30
        d3, _ = text_path(tagline, "med", ts, tracking=0.20,
                          x=x + (w - tw) / 2, y=y + gap + cap_height("med", ts))
        out.append(f'<path d="{d3}" fill="{GREY}"/>')
        h += gap + cap_height("med", ts)
    return "".join(out), w, h

# ---------------- svg wrapper ----------------
def svg(inner, vb, w=None, h=None):
    dims = f' width="{w}" height="{h}"' if w else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{dims}>'
            f"{inner}</svg>")
