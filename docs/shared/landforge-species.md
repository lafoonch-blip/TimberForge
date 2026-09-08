# LandForge species vocabulary

**Owner:** LandForge · **Mirror status:** confirmed · **Captured:** 2026-09-07 · **Change pending — see below.**

## Current `SP_LIST`

```js
SP_LIST = ["Loblolly pine", "Shortleaf pine", "Virginia pine", "Eastern white pine",
           "White oak", "Red oak", "Yellow-poplar", "Sweetgum", "Red maple",
           "Hickory", "Mixed hardwood", "Mixed pine-hardwood", "Other"]
```

A closed 13-value vocabulary. TimberForge must emit these exact strings.

## `mapSpecies` behaviour — probed

Normalises case and partial names:

| input | output |
|---|---|
| `"loblolly pine"` | `"Loblolly pine"` |
| `"shortleaf"` | `"Shortleaf pine"` |
| `"yellow poplar"` | `"Yellow-poplar"` |
| `"sweetgum"` | `"Sweetgum"` |
| `"LP"` | `""` |
| `"Pinus taeda"` | `""` |
| `"unknownthing"` | `""` |

Unrecognised input returns **empty string**, not `"Other"` and not an error. Abbreviations and Latin binomials are not handled. TimberForge should therefore resolve species on its own side and send an exact `SP_LIST` string — never a raw field code, never a binomial — so that an unmapped species is a decision rather than an empty cell.

## Regional gap — accepted, fix in progress

There is no Douglas-fir, ponderosa pine, western hemlock, spruce or true fir. The Pacific Northwest and Lake States / Northeast region profiles in `packages/forestry-core/src/regions.ts` have **no representable species** on the LandForge side.

**Decision (2026-09-07): expand `SP_LIST` in LandForge** rather than degrade the bridge. See `docs/decisions/0004-species-vocabulary.md`.

Until that lands, a non-Southern cruise cannot round-trip. TimberForge itself is unaffected — regions are configuration and the calculation engine never branches on species vocabulary — but the LandForge export is regionally limited.

Candidate additions, for whoever does the LandForge-side work. This is a **proposal, not a mirror** — it has no authority until it exists in LandForge:

- Pacific Northwest: Douglas-fir, Ponderosa pine, Western hemlock, Western redcedar, Sitka spruce, Red alder, Bigleaf maple
- Lake States / Northeast: Red pine, Jack pine, Eastern hemlock, Balsam fir, White spruce, Sugar maple, Yellow birch, Quaking aspen, Northern red oak *(may collapse into existing "Red oak")*, American basswood

Note the ambiguity in that last one. Expanding a closed vocabulary that already has `CV_PRIOR`-style priors attached to stand types is not purely additive — check `lfStandType` before adding names that overlap existing entries.
