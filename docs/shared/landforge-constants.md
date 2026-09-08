# LandForge scoring constants

**Owner:** LandForge · **Mirror status:** confirmed / derived · **Captured:** 2026-09-07 from the authenticated `/beta` application.

There is no `LF_ASSUMPTIONS` object. Earlier TimberForge work assumed one; it does not exist. The real constants are four separate top-level bindings, and every field key is `snake_case`.

## Values — confirmed, read directly from the running application

```js
CV_PRIOR = { mbf_per_acre: 0.60, basal_area: 0.35, tpa: 0.40, tons_per_acre: 0.55 }

FIXED_TOL = { forested_acres: 5, site_index: 15, stand_age: 20 }

FIELD_WEIGHT = { mbf_per_acre: 3, basal_area: 2, tpa: 1,
                 forested_acres: 1, site_index: 1, stand_age: 1 }

T90 = [6.31, 2.92, 2.35, 2.13, 2.02, 1.94, 1.89, 1.86, 1.83, 1.81,
       1.80, 1.78, 1.77, 1.76, 1.75, 1.75, 1.74, 1.73, 1.73, 1.72,
       1.72, 1.72, 1.71, 1.71, 1.71, 1.71, 1.70, 1.70, 1.70, 1.70]
```

`CV_PRIOR` values are coefficients of variation — prior expectations about how variable each metric is across plots, used before a cruise supplies a measured CV. `mbf_per_acre` at 0.60 is high; see the note on ocular estimates in `landforge-cruise-intake.md`.

`FIXED_TOL` values are absolute tolerances in the field's own units: ±5 acres, ±15 site-index points, ±20 years.

## Two asymmetries worth knowing

`tons_per_acre` has a CV prior but **no** `FIELD_WEIGHT` entry. Green tons are tracked and given a tolerance, but contribute nothing to the agreement score.

`mbf_per_acre` carries weight 3 — triple any fixed field and 1.5× basal area. Volume dominates agreement. A cruise that nails acreage, site index and stand age but misses volume will still score poorly, which is almost certainly the intended behaviour.

## Tolerance model — derived, then verified

Function source could not be read (the capture filter blocked it), so these were reconstructed from observed input/output pairs:

```
tVal(n)               = T90[clamp(n - 2, 0, 29)]
samplingTol(field, n) = round1( tVal(n) * CV_PRIOR[field] / sqrt(n) * 100 )    // percent
fieldTol(field, n)    = FIXED_TOL[field] ?? samplingTol(field, n || 1)
```

Verified exactly — `actual === predicted`, no rounding slack — on five independent live calls:

| field | n | value |
|---|---|---|
| `mbf_per_acre` | 10 | 34.7 |
| `mbf_per_acre` | 3 | 101.2 |
| `basal_area` | 20 | 13.5 |
| `tpa` | 30 | 12.4 |
| `tons_per_acre` | 7 | 40.3 |

### Three traps

**`T90` is a 90% table, not 95%.** Indexing is `df = n - 1`, so `tVal(2)` is the first entry. TimberForge's `statistics.ts` must use the same confidence level, or the two products will report different sampling errors for the identical cruise and both will look correct in isolation.

**Argument order is `(field, n)`.** Calling `samplingTol(n, field)` returns `null` rather than throwing — a silent wrong answer.

**`fieldTol` defaults `n` to 1**, which is what produces the otherwise inexplicable `fieldTol('mbf_per_acre') === 378.6`. That is `6.31 × 0.60 × 100` — the one-plot, "we know nothing" tolerance.

## Related

`matchColor(x)` returns `"r"` for 0–50 and `"g"` for 100+; the threshold between was not narrowed. Green is the high value, so its argument is an agreement score rather than an error percentage. **Inferred**, not confirmed.
