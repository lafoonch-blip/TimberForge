# Forestry glossary

For engineers working on TimberForge who are not foresters.

This is deliberately not a general forestry glossary. Every entry is a term that
appears in this codebase, and each one says **where the concept lives in the
code** and, where relevant, **how it is commonly gotten wrong**. Terms that do not
affect a calculation here are omitted.

---

## Measuring a tree

**DBH — diameter at breast height.** Trunk diameter in inches at 4.5 ft above
ground. The universal size measurement in North American forestry. Breast height
is a convention, not a biological fact; it exists so two cruisers measuring the
same tree get the same number.

**Basal area (BA).** The cross-sectional area of a trunk at DBH, in square feet.

```
BA = FOREST_CONSTANT × DBH²   // expansion.ts: basalArea()
FOREST_CONSTANT = 0.005454154 // constants.ts
```

That constant is π/4 converted from square inches to square feet. Per acre, basal
area is the single best summary of how much wood is standing — it captures
stocking in one number in a way that stem count cannot, because a hundred
6-inch stems and ten 20-inch stems are very different forests.

**Merchantable height.** How far up the stem is worth cutting, distinct from
total height. A tree can be 90 ft tall with 40 ft of merchantable stem. Only the
merchantable portion enters volume.

**DIB — diameter inside bark.** Wood diameter with bark excluded. Log rules take
DIB at the small end, not DBH. Confusing the two systematically overestimates
volume.

**Taper.** The rate the stem narrows going up. Modelled by `TaperModel` in
`volume.ts`; `linearTaper(taperInPerLog = 1.6)` is the simple default — 1.6
inches lost per 16-ft log.

**Defect / cull.** The share of gross volume that is rotten, hollow, crooked or
otherwise unsellable. Applied as a deduction; gross volume without a defect
deduction is not a number anyone should be paid on.

---

## Measuring a stand

A cruise measures a few small plots and expands them to per-acre figures. The
expansion factor is where methods differ, and it is the arithmetic most worth
being careful about.

**Variable-radius plot (point sampling, prism cruising).** The cruiser stands at
a point and sweeps with a prism or angle gauge. A tree is "in" if it looks wider
than the gauge angle — so **larger trees are counted from farther away**. The plot
has no fixed boundary; each tree carries its own.

This is counterintuitive and it is the source of most confusion for engineers new
to the domain. The consequence is elegant: **every "in" tree contributes exactly
BAF square feet of basal area per acre, regardless of its size.** Basal area per
acre is therefore just `BAF × (tree count) / (plot count)`.

**BAF — basal area factor.** The constant above, in ft²/acre per counted tree.
Common values are 10, 20, 40. Required for variable-radius plots;
`expansion.ts` throws a plot-identifying error if it is missing or non-positive,
rather than defaulting.

**Trees per acre (TPA) from a variable-radius plot** is *not* uniform across
trees — it is inversely proportional to each tree's basal area, so a small tree
represents many trees per acre and a large one represents few. See
`treesPerAcreFactor()`.

**Limiting distance.** The maximum distance at which a tree of a given DBH counts
as "in" for a given BAF (`limitingDistanceFt()`). Used for borderline trees. In
practice cruisers check borderline trees rather than measuring every distance,
and consistently misjudging them biases the whole cruise.

**Fixed-area plot.** A circle of known size — commonly 1/10 or 1/5 acre. Every
tree inside counts, and each represents `1 / plotAcres` trees per acre. Simpler,
and the right choice for regeneration and small stems where a prism is
unreliable. `fixedPlotRadiusFt()` converts area to radius.

TimberForge supports both **per plot**, so one cruise can mix them — which is what
cruisers actually do when a stand has a merchantable overstory and a young
understory. See
[`../decisions/0002-mvp-cruise-methods.md`](../decisions/0002-mvp-cruise-methods.md).

**QMD — quadratic mean diameter.** The DBH of the tree of average basal area:
`sqrt(BA_per_acre / (FOREST_CONSTANT × TPA))` (`compile.ts`). Always ≥ arithmetic
mean DBH, and it is the one that matters because it is consistent with basal area.

**Site index.** Expected dominant tree height at a base age (commonly 25 or 50
years) — a measure of how productive the *land* is, independent of what is
currently growing. LandForge treats it as a fixed-tolerance field
(`FIXED_TOL.site_index = 15`) rather than a sampled one.

---

## Turning trees into product

**Board foot (BF).** A nominal 12 × 12 × 1 inch of lumber. **MBF** is a thousand
board feet — the M is Roman, not "mega", and this trips people up constantly.

**Log rule.** A formula converting log dimensions into board feet. There is no
single correct one; they are **market conventions**, and they disagree with each
other substantially. TimberForge implements three, pluggable via
`registerLogRule` / `getLogRule`, with `makeTableRule` for real published tables.

- **Doyle** — `((D − 4) / 4)² × L`. Penalises small logs harshly and is generous
  on large ones. It is not accurate to cubic reality, and it is nonetheless the
  default in the US South, because *accuracy to the market matters more than
  accuracy to physics when the mill is paying on Doyle.*
- **Scribner Decimal C** — `(0.79D² − 2D − 4) × (L/16)`, rounded to the nearest
  10 BF. "Decimal C" means volumes are in tens of board feet, so **the rounding
  is part of the rule, not a display choice.** The implementation is an
  approximation of a diagram rule and should be replaced with a real table
  before Scribner-region use; this is flagged in the source.
- **International ¼-inch** — genuinely constructive: 4-ft segments, each scaled
  from its own small-end DIB with a ½-inch taper allowance per segment. The
  ¼-inch is assumed saw kerf, already inside the coefficients. Closest to true
  cubic content, which is why it is the standard for research and FIA work.

**Product classes.** The same tree yields different products by size and quality,
priced very differently:

- **Sawtimber** — large, straight, sound. Highest value.
- **Chip-n-saw** — intermediate; a small sawlog with a chipped outer portion.
- **Pulpwood** — small or low quality, sold by weight for paper and board.

Because pulpwood sells by **tons** and sawtimber by **MBF**, a stand's value is
not a single-unit quantity. `tons_per_acre` and `mbf_per_acre` both appear in
LandForge's `CV_PRIOR` for this reason.

**Stumpage.** The price paid for standing timber, before it is cut — what the
landowner receives. Distinct from delivered price, which includes harvesting and
haul.

---

## Statistics

**Coefficient of variation (CV).** Standard deviation over mean. Timber is
variable, and CV is how much. LandForge carries priors by field —
`mbf_per_acre: 0.60`, `basal_area: 0.35` — which is why volume needs many more
plots than basal area for the same precision. See
[`../shared/landforge-constants.md`](../shared/landforge-constants.md).

**Confidence level and degrees of freedom.** Cruise statistics use Student's t
with `df = n − 1`, where n is the **number of plots**, not the number of trees.
This matters: plots are the sampling unit, trees within a plot are not
independent.

Two levels are in play, on purpose. LandForge's pre-cruise tolerance model uses
**90%**; TimberForge's reported statistics default to **95%**, the convention for
a professional deliverable. `tCritical(df, confidence)` takes the level
explicitly and anything crossing that boundary must pass it. See
[`../decisions/0003-pre-and-post-cruise-scoring.md`](../decisions/0003-pre-and-post-cruise-scoring.md).

**Provenance ladder.** How a value was obtained, most to least trustworthy:
**measured** > **computed** > **estimated** > **predicted** > **defaulted**. Every
value carries its rung. A defaulted number that renders identically to a measured
one is how a cruise report becomes confidently wrong, and the ladder exists to
prevent that.
