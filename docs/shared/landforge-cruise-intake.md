# LandForge cruise intake form

**Owner:** LandForge · **Mirror status:** confirmed (DOM read) · **Captured:** 2026-09-07 from `/beta`, "New Property Analysis".

LandForge already accepts cruise data. This is the real integration surface — a flat form, not a nested payload — and it is what TimberForge's adapter should target.

No functions were invoked during capture. `applyParsedFields(obj)` and `parseCruiseFile(f)` would have revealed the exact key names the parser expects, but calling them writes into a live form on a beta account. **The mapping from these DOM ids to the parser's object keys is therefore still unknown.** See `docs/integration/OPEN_QUESTIONS.md`.

## Fields

| id | Label | Type | Notes |
|---|---|---|---|
| `na-fac` | Forested acres | number | **required** |
| `na-cd` | Cruise date | date | **required** |
| `na-cm` | Method | select | see vocabulary below |
| `na-pc` | Plot count | number | this is the `n` in `samplingTol` |
| `na-baf` | BAF | select | `5, 10, 15, 20, 25, 30, 40` |
| `na-int` | Sample intensity (%) | number | |
| `na-conf` | Your confidence in this cruise | select | `5` … `1`, see below |
| `na-tmbf` | **Total MBF** | number | a total, not per acre |
| `na-si` | Site index | number | |
| `na-op` | Operable forest acres | number | distinct from forested acres |
| `na-ba` | Basal area (sq ft/ac) | number | |
| `na-tpa` | Trees per acre | number | |
| `na-dbh` | Avg DBH (in) | number | |
| `na-mh` | Merch height (ft) | number | |
| `na-dc` | Defect / cull % | number | |
| `na-bs` | Sawtimber | number | product mix, percent |
| `na-bc` | Chip-n-saw | number | product mix, percent |
| `na-bp` | Pulpwood | number | product mix, percent |

Helper functions, arity confirmed: `parseCruiseUpload()` `0`, `parseCruiseFile(f)` `1`, `applyParsedFields(obj)` `1`, `mapSpecies(s)` `1`, `lfStandType(s)` `1`, `lfMoney(n)` `1`, `matchColor(x)` `1`.

## Method vocabulary

```
"Variable-radius (BAF)"   "Fixed-radius plots"   "100% tally"
"Strip cruise"            "Ocular estimate"
```

TimberForge MVP produces the first two, which map exactly. The presence of `Ocular estimate` is the most plausible explanation for `CV_PRIOR.mbf_per_acre` being as high as 0.60 — the prior has to cover inputs that are, in the field's own words, a rough guess.

## Confidence vocabulary

```
5 — Walked it, high confidence
4 — Solid sample
3 — Reasonable estimate
2 — Quick look
1 — Rough guess
```

This is the **cruiser's self-report**, not a computed quantity. TimberForge does not map onto it — see `docs/decisions/0003-pre-and-post-cruise-are-separate.md`.

## The units finding

The form collects a **total** (`na-tmbf`). The scoring model is keyed entirely on **`mbf_per_acre`** — that is what has a CV prior, a field weight and a tolerance. LandForge divides somewhere between intake and scoring.

Both are therefore true, at different layers: emit a total at the intake boundary, expect per-acre semantics anywhere near confidence or tolerance. An adapter that picks one convention and applies it throughout will be wrong at one end and will look correct in testing.

**Unresolved:** whether the divisor is `na-fac` or `na-op`. These are different numbers and the choice moves every downstream figure. Open question, not to be guessed.
