# TimberForge — Identity Assets

Everything here is generated from one vector master. Nothing is a screenshot or an
upscaled raster. The badge was traced from the approved artwork into layered SVG
paths, and the wordmark is outlined type (Montserrat), so no font needs to be
installed anywhere for these files to render correctly.

Regenerate the whole set with `brand/assets.py`.

## The two-tier rule

The approved badge is an illustration: a mountain, a road, a treeline, and eleven
conifers, in seven colours. It is beautiful at 150px and unreadable at 32px, where
it collapses into a dark smudge. So there are two marks, and the size decides which
one you use.

**Above ~64px — the full badge.** Lockups, letterhead, the site header, social
cards, presentation title slides, signage, anything printed.

**At or below ~64px — the simplified glyph.** A solid shield with a single conifer
knocked out of it. Favicons, app icons, avatars, embroidery, anything one-colour.
Below 24px the glyph switches again to a chunkier four-tier conifer, because the
five-tier version loses its notches at that size. That swap is already baked into
`favicon.ico` and the small app icons — different artwork per size, which is what
the ICO format is for.

## What's in each folder

`master/` — the source SVGs. 24 files: the full badge and its reversed (cream-rim)
version, the glyph in four colourways, the wordmark in five, and horizontal and
stacked lockups with and without the tagline, each in full colour, all-white, and
all-black. Plus `lockup-landforge.svg`, the stacked lockup with "A LandForge
Company" set under a hairline rule. Start here for anything not covered below.

`web/` — `favicon.ico` (16/32/48/64, distinct artwork per size), matching PNGs,
`favicon.svg`, `apple-touch-icon.png` at 180, PWA icons at 192 and 512, maskable
icons at 192 and 512, `site.webmanifest`, and `head-snippet.html` with the link
and meta tags ready to paste.

`ios/` — the full App Store ladder from 20px to 1024px, opaque RGB with no alpha
channel (Apple rejects icons with alpha), plus `Contents.json` for the asset
catalogue. Do not round the corners yourself; iOS masks them.

`android/` — legacy launcher icons at all five densities, adaptive-icon foreground
and background layers on the 108dp canvas with the art held inside the 72dp safe
zone, `ic_launcher.xml`, `colors.xml`, and the 512px Play Store icon.

`social/` — Open Graph at 1200×630 in dark and light, Twitter 1200×600, LinkedIn
1200×627, the 1584×396 LinkedIn cover strip, and square avatars at 400 and 800
with the glyph inset far enough to survive a circular crop.

`print/` — vector PDFs and SVGs of the badge, both lockups, the LandForge lockup,
and the one-colour black glyph, plus 300dpi PNGs for anyone who can't place vector.
Send the PDF to a printer, not the PNG.

`email/` — `signature-logo.png` at 220px and 440px on a white background (email
clients handle transparency badly), and `signature.html`, a table-based signature
block that survives Outlook.

## Colour

The badge carries the colours of the approved artwork: rim `#041B1C`, conifers
`#0E2B1E`, cream field `#FCFCFB`, mountain `#A8946E`, and three greens in the
treeline and fields. Flat brand surfaces — icon backgrounds, the OG card, the
theme colour — use Deep Forest `#0F3328` from the branding guide. The wordmark is
`#0F2C1F` for "Timber" and `#3A5036` for "Forge", sampled from the artwork.

## Already wired up

The field PWA at `apps/field/` now uses these assets. Its placeholder `icon.svg`
was replaced, the favicon and touch-icon PNGs were added to `public/`, the
manifest icon list was rewritten with proper `any` and `maskable` entries, and its
theme and background colours were changed from `#1d3323` / `#12180f` to Deep
Forest `#0F3328`. Nothing else in the app was touched.

## Two things to settle

**The tagline.** These assets say "Assess. Cruise. Report." The branding guide says
"Assess. Cruise. Value. Score." The approved logo image said "Plan. Measure.
Maximize." Three versions are in circulation. The guide should be updated to match
whichever one is real.

**The guide contradicts the logo.** Section 7 of the branding guide lists mountain
landscapes, detailed illustrated forests, and vintage badge lockups under "Avoid."
The approved logo is all three. That's a legitimate direction to take — but the
guide now argues against the mark, and one of them needs to change.
