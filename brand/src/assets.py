"""TimberForge — generate the full identity asset set from the vector master."""
import os, json, math, shutil, io
import build as B
from build import (BORDER, DEEP, CREAM, INK, GREEN, GREY, TAN,
                   badge_layers, shield_path, conifer, text_path,
                   text_width, cap_height, wordmark, VBH)

ROOT = "/sessions/nifty-optimistic-goodall"
OUT  = f"{ROOT}/mnt/TimberForge/brand"

# brand-guide names for flat surfaces
FOREST = "#0F3328"   # guide Deep Forest — used for solid backgrounds
SAND   = "#D9CFBD"
WHITE  = "#FFFFFF"

TAGLINE = "ASSESS. CRUISE. REPORT."
PARENT  = "A LANDFORGE COMPANY"

SHIELD_W, SHIELD_H = 99.84, 114.79


def d(*parts):
    p = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def write(path, text):
    with open(d(path), "w") as f:
        f.write(text)
    return d(path)


# ---------------------------------------------------------------- glyph
def glyph_inner(shield_fill=DEEP, tree_fill=CREAM, ring=False, tiny=False):
    """Knockout glyph in the native 0 0 100 114.95 space."""
    out = [f'<path d="{shield_path(0)}" fill="{shield_fill}"/>']
    if ring:
        out.append(f'<path d="{shield_path(7.5)}" fill="{tree_fill}"/>')
        out.append(f'<path d="{shield_path(11.0)}" fill="{shield_fill}"/>')
    tree = (conifer(50, 96, 72, 28, tiers=4, notch=0.44, taper=0.75) if tiny
            else conifer(50, 94, 66, 22))
    out.append(f'<path d="{tree}" fill="{tree_fill}"/>')
    return "".join(out)


def square(inner, box=100, pad=0.08, bg=None, rx=None, src_w=SHIELD_W, src_h=SHIELD_H):
    """Centre `inner` (native shield space) inside a square canvas."""
    avail = box * (1 - 2 * pad)
    s = avail / src_h
    tx = (box - src_w * s) / 2
    ty = (box - src_h * s) / 2
    body = ""
    if bg:
        r = f' rx="{rx}"' if rx else ""
        body += f'<rect width="{box}" height="{box}"{r} fill="{bg}"/>'
    body += f'<g transform="translate({tx:.3f},{ty:.3f}) scale({s:.5f})">{inner}</g>'
    return body


# ---------------------------------------------------------------- lockups
def wm_block(size, tagline=None, colors=None):
    """Wordmark block with top-left at (0,0). Returns (inner, w, h)."""
    cap = cap_height("bold", size)
    ink, green, grey = colors or (INK, GREEN, GREY)
    d1, w1 = text_path("Timber", "bold", size, x=0, y=cap)
    d2, w2 = text_path("Forge", "bold", size, x=w1, y=cap)
    out = [f'<path d="{d1}" fill="{ink}"/>', f'<path d="{d2}" fill="{green}"/>']
    w, h = w1 + w2, cap
    if tagline:
        ts = size * 0.150
        tw = text_width(tagline, "med", ts, tracking=0.215)
        gap = size * 0.30
        d3, _ = text_path(tagline, "med", ts, tracking=0.215,
                          x=(w - tw) / 2, y=cap + gap + cap_height("med", ts))
        out.append(f'<path d="{d3}" fill="{grey}"/>')
        h = cap + gap + cap_height("med", ts)
    return "".join(out), w, h


def lockup(kind="horizontal", tagline=None, colors=None, badge=None,
           badge_h=200, pad=8):
    """kind: horizontal | stacked. Returns (svg_inner, W, H)."""
    badge = badge or badge_layers()
    bs = badge_h / SHIELD_H
    bw = SHIELD_W * bs
    size = badge_h * (0.30 if kind == "horizontal" else 0.26) / 0.70
    wm, ww, wh = wm_block(size, tagline, colors)

    if kind == "horizontal":
        gap = badge_h * 0.16
        W = pad * 2 + bw + gap + ww
        H = pad * 2 + max(badge_h, wh)
        by = pad + (H - pad * 2 - badge_h) / 2
        wy = pad + (H - pad * 2 - wh) / 2
        inner = (f'<g transform="translate({pad},{by:.2f}) scale({bs:.5f})">{badge}</g>'
                 f'<g transform="translate({pad + bw + gap:.2f},{wy:.2f})">{wm}</g>')
    else:
        gap = badge_h * 0.13
        W = pad * 2 + max(bw, ww)
        H = pad * 2 + badge_h + gap + wh
        inner = (f'<g transform="translate({pad + (W - pad*2 - bw)/2:.2f},{pad}) '
                 f'scale({bs:.5f})">{badge}</g>'
                 f'<g transform="translate({pad + (W - pad*2 - ww)/2:.2f},'
                 f'{pad + badge_h + gap:.2f})">{wm}</g>')
    return inner, W, H


def svgdoc(inner, w, h, bg=None):
    b = f'<rect width="{w:.2f}" height="{h:.2f}" fill="{bg}"/>' if bg else ""
    return ('<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {w:.2f} {h:.2f}" width="{w:.2f}" height="{h:.2f}">'
            f'{b}{inner}</svg>')


def recolor(badge, mapping):
    for a, b in mapping.items():
        badge = badge.replace(f'fill="{a}"', f'fill="{b}"')
    return badge


BADGE       = badge_layers()
BADGE_REV   = recolor(BADGE, {BORDER: CREAM})          # cream rim, for dark backgrounds
GLYPH       = glyph_inner(DEEP, CREAM)                 # knockout, 2-colour
GLYPH_BLACK = glyph_inner("#000000", "#FFFFFF")
GLYPH_WHITE = glyph_inner("#FFFFFF", "#0F2C1F")        # white shield (needs dark bg)
GLYPH_FOR   = glyph_inner(FOREST, "#FFFFFF")


# ---------------------------------------------------------------- masters
def emit_masters():
    files = {}

    def put(name, inner, w, h, bg=None):
        files[name] = write(f"master/{name}", svgdoc(inner, w, h, bg))

    put("badge-full-color.svg", BADGE, 100, VBH)
    put("badge-reversed.svg", BADGE_REV, 100, VBH)
    put("glyph.svg", GLYPH, 100, VBH)
    put("glyph-forest.svg", GLYPH_FOR, 100, VBH)
    put("glyph-black.svg", GLYPH_BLACK, 100, VBH)
    put("glyph-white.svg", GLYPH_WHITE, 100, VBH)

    wm, w, h = wm_block(200)
    put("wordmark.svg", wm, w, h)
    wm, w, h = wm_block(200, TAGLINE)
    put("wordmark-tagline.svg", wm, w, h)
    wm, w, h = wm_block(200, TAGLINE, (FOREST, FOREST, FOREST))
    put("wordmark-forest.svg", wm, w, h)
    wm, w, h = wm_block(200, TAGLINE, ("#000000",) * 3)
    put("wordmark-black.svg", wm, w, h)
    wm, w, h = wm_block(200, TAGLINE, ("#FFFFFF",) * 3)
    put("wordmark-white.svg", wm, w, h)

    for kind in ("horizontal", "stacked"):
        for tag, suf in ((None, ""), (TAGLINE, "-tagline")):
            i, w, h = lockup(kind, tag)
            put(f"lockup-{kind}{suf}.svg", i, w, h)
            i, w, h = lockup(kind, tag, ("#FFFFFF",) * 3, BADGE_REV)
            put(f"lockup-{kind}{suf}-white.svg", i, w, h)
            i, w, h = lockup(kind, tag, ("#000000",) * 3, GLYPH_BLACK)
            put(f"lockup-{kind}{suf}-black.svg", i, w, h)

    # LandForge relationship lockup (stacked, parent line under the tagline)
    i, w, h = lockup("stacked", TAGLINE)
    ps = 18.0
    pw = text_width(PARENT, "med", ps, tracking=0.22)
    pd, _ = text_path(PARENT, "med", ps, tracking=0.22,
                      x=(w - pw) / 2, y=h + 34)
    rule = (f'<rect x="{(w - pw*1.55)/2:.1f}" y="{h + 13:.1f}" '
            f'width="{pw*1.55:.1f}" height="1.2" fill="{GREY}" opacity="0.45"/>')
    put("lockup-landforge.svg", i + rule + f'<path d="{pd}" fill="{GREY}"/>', w, h + 44)
    return files


# ---------------------------------------------------------------- raster
import cairosvg
from PIL import Image


def render(svg_text, w=None, h=None, path=None):
    kw = {}
    if w: kw["output_width"] = w
    if h: kw["output_height"] = h
    png = cairosvg.svg2png(bytestring=svg_text.encode(), **kw)
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    if path:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        im.save(path)
    return im


def write_ico(path, images):
    """Multi-resolution .ico with distinct artwork per size (PIL downsamples instead)."""
    import struct
    blobs = []
    for im in images:
        b = io.BytesIO()
        im.save(b, format="PNG")
        blobs.append(b.getvalue())
    out = struct.pack("<HHH", 0, 1, len(blobs))
    offset = 6 + 16 * len(blobs)
    for im, b in zip(images, blobs):
        w, h = im.size
        out += struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(b), offset)
        offset += len(b)
    with open(path, "wb") as f:
        f.write(out + b"".join(blobs))


def icon_svg(box=100, pad=0.08, bg=None, rx=None, shield=DEEP, tree=CREAM, tiny=False):
    inner = square(glyph_inner(shield, tree, tiny=tiny), box, pad, bg, rx)
    return svgdoc(inner, box, box)


# ---------------------------------------------------------------- web
def emit_web():
    made = []
    # transparent full-bleed shield favicons
    fav = icon_svg(100, 0.02)
    fav_tiny = icon_svg(100, 0.02, tiny=True)   # chunkier tree, holds at 16-24px
    write("web/favicon.svg", fav)
    write("web/favicon-tiny.svg", fav_tiny)
    made += ["web/favicon.svg", "web/favicon-tiny.svg"]

    ico_ims = []
    for s in (16, 32, 48, 64):
        p = d(f"web/favicon-{s}x{s}.png")
        im = render(fav_tiny if s <= 24 else fav, w=s, h=s, path=p)
        ico_ims.append(im)
        made.append(p)

    write_ico(d("web/favicon.ico"), ico_ims)
    made.append("web/favicon.ico")

    # apple touch icon — opaque, rounded corners are added by iOS
    apple = icon_svg(100, 0.13, bg=FOREST, shield=CREAM, tree=FOREST)
    render(apple, 180, 180, d("web/apple-touch-icon.png"))

    # PWA
    pwa = icon_svg(100, 0.10, bg=FOREST, shield=CREAM, tree=FOREST)
    for s in (192, 512):
        render(pwa, s, s, d(f"web/icon-{s}.png"))
    # maskable: 40% safe radius -> keep art inside the centre 66%
    mask = icon_svg(100, 0.22, bg=FOREST, shield=CREAM, tree=FOREST)
    for s in (192, 512):
        render(mask, s, s, d(f"web/maskable-{s}.png"))
    write("web/icon-512-maskable.svg", mask)

    manifest = {
        "name": "TimberForge",
        "short_name": "TimberForge",
        "description": "Assess. Cruise. Report.",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#F7F5EF",
        "theme_color": FOREST,
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/maskable-192.png", "sizes": "192x192", "type": "image/png",
             "purpose": "maskable"},
            {"src": "/maskable-512.png", "sizes": "512x512", "type": "image/png",
             "purpose": "maskable"},
            {"src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml"},
        ],
    }
    write("web/site.webmanifest", json.dumps(manifest, indent=2))

    write("web/head-snippet.html", f"""<!-- TimberForge favicons & PWA -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="{FOREST}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="TimberForge">
<meta property="og:description" content="Assess. Cruise. Report.">
<meta property="og:image" content="/social/og-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="/social/twitter-1200x600.png">
""")
    return made


def flatten(im, bg=FOREST):
    b = Image.new("RGBA", im.size, bg)
    b.alpha_composite(im)
    return b.convert("RGB")


# ---------------------------------------------------------------- ios
IOS = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]


def emit_ios():
    art = icon_svg(100, 0.13, bg=FOREST, shield=CREAM, tree=FOREST)
    art_t = icon_svg(100, 0.13, bg=FOREST, shield=CREAM, tree=FOREST, tiny=True)
    for s in IOS:
        im = render(art_t if s <= 40 else art, s, s)
        flatten(im).save(d(f"ios/AppIcon-{s}.png"))   # opaque, no alpha (App Store rule)
    write("ios/AppIcon.svg", art)
    write("ios/Contents.json", json.dumps({
        "images": [
            {"filename": "AppIcon-40.png", "idiom": "iphone", "scale": "2x", "size": "20x20"},
            {"filename": "AppIcon-60.png", "idiom": "iphone", "scale": "3x", "size": "20x20"},
            {"filename": "AppIcon-58.png", "idiom": "iphone", "scale": "2x", "size": "29x29"},
            {"filename": "AppIcon-87.png", "idiom": "iphone", "scale": "3x", "size": "29x29"},
            {"filename": "AppIcon-80.png", "idiom": "iphone", "scale": "2x", "size": "40x40"},
            {"filename": "AppIcon-120.png", "idiom": "iphone", "scale": "3x", "size": "40x40"},
            {"filename": "AppIcon-120.png", "idiom": "iphone", "scale": "2x", "size": "60x60"},
            {"filename": "AppIcon-180.png", "idiom": "iphone", "scale": "3x", "size": "60x60"},
            {"filename": "AppIcon-20.png", "idiom": "ipad", "scale": "1x", "size": "20x20"},
            {"filename": "AppIcon-40.png", "idiom": "ipad", "scale": "2x", "size": "20x20"},
            {"filename": "AppIcon-29.png", "idiom": "ipad", "scale": "1x", "size": "29x29"},
            {"filename": "AppIcon-58.png", "idiom": "ipad", "scale": "2x", "size": "29x29"},
            {"filename": "AppIcon-40.png", "idiom": "ipad", "scale": "1x", "size": "40x40"},
            {"filename": "AppIcon-80.png", "idiom": "ipad", "scale": "2x", "size": "40x40"},
            {"filename": "AppIcon-76.png", "idiom": "ipad", "scale": "1x", "size": "76x76"},
            {"filename": "AppIcon-152.png", "idiom": "ipad", "scale": "2x", "size": "76x76"},
            {"filename": "AppIcon-167.png", "idiom": "ipad", "scale": "2x", "size": "83.5x83.5"},
            {"filename": "AppIcon-1024.png", "idiom": "ios-marketing", "scale": "1x",
             "size": "1024x1024"},
        ],
        "info": {"author": "xcode", "version": 1},
    }, indent=2))


# ---------------------------------------------------------------- android
ANDROID = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def emit_android():
    art = icon_svg(100, 0.13, bg=FOREST, shield=CREAM, tree=FOREST)
    art_t = icon_svg(100, 0.13, bg=FOREST, shield=CREAM, tree=FOREST, tiny=True)
    for dpi, s in ANDROID.items():
        render(art_t if s <= 48 else art, s, s,
               d(f"android/mipmap-{dpi}/ic_launcher.png"))
    # adaptive icon: 108dp canvas, art must live inside the centre 72dp (66.7%)
    fg = svgdoc(square(glyph_inner(CREAM, FOREST), 108, pad=(108 - 62) / 2 / 108),
                108, 108)
    write("android/ic_launcher_foreground.svg", fg)
    for dpi, s in ANDROID.items():
        px = round(s * 108 / 48)
        render(fg, px, px, d(f"android/mipmap-{dpi}/ic_launcher_foreground.png"))
        bgim = Image.new("RGBA", (px, px), FOREST)
        bgim.save(d(f"android/mipmap-{dpi}/ic_launcher_background.png"))
    write("android/ic_launcher.xml",
          '<?xml version="1.0" encoding="utf-8"?>\n'
          '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
          '    <background android:drawable="@color/ic_launcher_background"/>\n'
          '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
          '    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>\n'
          '</adaptive-icon>\n')
    write("android/colors.xml",
          '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
          f'    <color name="ic_launcher_background">{FOREST}</color>\n</resources>\n')
    flatten(render(art, 512, 512)).save(d("android/play-store-512.png"))


# ---------------------------------------------------------------- social
def banner(W, H, dark=True, tagline=True, badge_h=None):
    bg = FOREST if dark else "#F7F5EF"
    cols = ("#FFFFFF",) * 3 if dark else (INK, GREEN, GREY)
    if dark:
        cols = ("#FFFFFF", "#A9C0A0", "#C9D2C4")
    bh = badge_h or H * 0.34
    inner, w, h = lockup("stacked", TAGLINE if tagline else None, cols,
                         BADGE_REV if dark else BADGE, badge_h=bh, pad=0)
    s = min((W * 0.62) / w, (H * 0.68) / h)
    tx, ty = (W - w * s) / 2, (H - h * s) / 2
    art = (f'<rect width="{W}" height="{H}" fill="{bg}"/>'
           f'<g transform="translate({tx:.2f},{ty:.2f}) scale({s:.5f})">{inner}</g>')
    return svgdoc(art, W, H)


def emit_social():
    specs = {"og-1200x630": (1200, 630), "twitter-1200x600": (1200, 600),
             "linkedin-1200x627": (1200, 627), "facebook-1200x630": (1200, 630)}
    for name, (W, H) in specs.items():
        flatten(render(banner(W, H, dark=True), W, H)).save(d(f"social/{name}.png"))
    flatten(render(banner(1200, 630, dark=False), 1200, 630), "#F7F5EF").save(
        d("social/og-1200x630-light.png"))
    # square avatars — glyph only, safe inside a circular crop
    av = icon_svg(100, 0.16, bg=FOREST, shield=CREAM, tree=FOREST)
    for s in (400, 800):
        flatten(render(av, s, s)).save(d(f"social/avatar-{s}.png"))
    write("social/avatar.svg", av)
    # LinkedIn / YouTube cover strip
    flatten(render(banner(1584, 396, dark=True, tagline=True), 1584, 396)).save(
        d("social/linkedin-cover-1584x396.png"))


# ---------------------------------------------------------------- print + email
def emit_print():
    jobs = {
        "lockup-horizontal": lockup("horizontal", TAGLINE),
        "lockup-stacked": lockup("stacked", TAGLINE),
        "lockup-landforge": None,
        "badge": (BADGE, 100, VBH),
        "glyph-black": (GLYPH_BLACK, 100, VBH),
    }
    for name, val in jobs.items():
        if val is None:
            src = open(d("master/lockup-landforge.svg")).read()
        else:
            src = svgdoc(*val)
        cairosvg.svg2pdf(bytestring=src.encode(), write_to=d(f"print/{name}.pdf"))
        write(f"print/{name}.svg", src)
    # 300 dpi rasters for anyone who cannot place vector
    i, w, h = lockup("horizontal", TAGLINE)
    render(svgdoc(i, w, h), 3000, path=d("print/lockup-horizontal@300dpi.png"))
    i, w, h = lockup("stacked", TAGLINE)
    render(svgdoc(i, w, h), 2000, path=d("print/lockup-stacked@300dpi.png"))
    render(svgdoc(BADGE, 100, VBH), 2000, path=d("print/badge@300dpi.png"))


def emit_email():
    i, w, h = lockup("horizontal", TAGLINE)
    src = svgdoc(i, w, h)
    for px, name in ((220, "signature-logo.png"), (440, "signature-logo@2x.png")):
        im = render(src, px)
        Image.alpha_composite(Image.new("RGBA", im.size, "#FFFFFF"), im) \
            .convert("RGB").save(d(f"email/{name}"))
    ih = round(220 * h / w)
    write("email/signature.html", f"""<!-- TimberForge email signature -->
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#242927">
  <tr>
    <td style="padding-right:16px;border-right:2px solid {SAND}">
      <img src="cid:timberforge-logo" alt="TimberForge" width="220" height="{ih}"
           style="display:block;border:0">
    </td>
    <td style="padding-left:16px">
      <div style="font-size:15px;font-weight:bold;color:{FOREST}">Your Name</div>
      <div style="font-size:13px;color:#586063">Title</div>
      <div style="font-size:13px;color:#586063;padding-top:6px">
        <a href="mailto:you@timberforge.com" style="color:{FOREST};text-decoration:none">you@timberforge.com</a><br>
        <a href="https://timberforge.com" style="color:{FOREST};text-decoration:none">timberforge.com</a>
      </div>
    </td>
  </tr>
</table>
<!-- Attach signature-logo@2x.png inline with Content-ID: timberforge-logo -->
""")


# ---------------------------------------------------------------- app wiring
FIELD = "/sessions/nifty-optimistic-goodall/mnt/TimberForge/apps/field/public"


def install_into_field_app():
    """Replace the field PWA's placeholder icon with the real identity."""
    if not os.path.isdir(FIELD):
        return
    for name in ("favicon.ico", "favicon.svg", "favicon-16x16.png",
                 "favicon-32x32.png", "favicon-48x48.png", "apple-touch-icon.png",
                 "icon-192.png", "icon-512.png", "maskable-192.png", "maskable-512.png"):
        shutil.copy(d(f"web/{name}"), os.path.join(FIELD, name))
    shutil.copy(d("web/favicon.svg"), os.path.join(FIELD, "icon.svg"))

    mf = os.path.join(FIELD, "manifest.webmanifest")
    m = json.load(open(mf))
    m["theme_color"] = FOREST
    m["background_color"] = FOREST
    m["icons"] = [
        {"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
        {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "/maskable-192.png", "sizes": "192x192", "type": "image/png",
         "purpose": "maskable"},
        {"src": "/maskable-512.png", "sizes": "512x512", "type": "image/png",
         "purpose": "maskable"},
    ]
    json.dump(m, open(mf, "w"), indent=2)
    open(mf, "a").write("\n")

    idx = os.path.join(os.path.dirname(FIELD), "index.html")
    src = open(idx).read()
    old = ('    <link rel="icon" href="/icon.svg" type="image/svg+xml" />\n'
           '    <link rel="apple-touch-icon" href="/icon.svg" />\n')
    new = ('    <link rel="icon" href="/favicon.ico" sizes="32x32" />\n'
           '    <link rel="icon" href="/icon.svg" type="image/svg+xml" />\n'
           '    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />\n'
           f'    <meta name="theme-color" content="{FOREST}" />\n')
    if old in src:
        open(idx, "w").write(src.replace(old, new))


def main():
    emit_masters(); emit_web(); emit_ios(); emit_android()
    emit_social(); emit_print(); emit_email(); install_into_field_app()
    n = sum(len(f) for _, _, f in os.walk(OUT))
    print(f"{n} files under {OUT}")


if __name__ == "__main__":
    main()
