# TimberForge vision

**Date:** 2026-09-09 · **Status:** current strategic direction

This is the long-term destination. It is deliberately broader than the product
being built.

[`PRD.md`](PRD.md) defines what ships. This file defines what it is growing
into. **Where the two appear to disagree about scope, the PRD wins** — that is
the entire point of separating them. A vision document that can expand the MVP
is not a vision document, it is scope creep with a table of contents.

Open conflicts between this direction and existing decisions are tracked in
[`STRATEGY_RECONCILIATION.md`](STRATEGY_RECONCILIATION.md). Read that before
acting on anything here.

---

## 1. The destination

**The all-in-one operating platform for professional forestry** — forest
intelligence, timber cruising, mobile field operations, inventory management,
valuation and reporting in one system.

The problem being solved is not "cruising software is bad." It is that
professional forestry currently requires assembling and maintaining a software
stack:

> GIS → cruise planning → mobile field collection → compilation → inventory
> management → Excel → pricing → reporting

Every handoff produces duplicate data, imports and exports, file management,
configuration, training, reconciliation work, additional cost, and an
opportunity for error. The value is in collapsing the handoffs, not in any one
station being nicer.

Target workflow:

> **PROPERTY → ASSESS → PLAN → CRUISE → QA → INVENTORY → VALUE → REPORT → LEARN**

One property. One dataset. One workflow.

**This nine-stage sequence is the product architecture, not the MVP scope.** The
MVP delivers PROPERTY → ASSESS → PLAN → CRUISE → QA → VALUE → REPORT against a
schema that *can* hold inventory and history. See
[`0008`](../decisions/0008-persistent-forest-assets.md).

## 2. Broad vision, narrow wedge

The entry point stays **independent consulting foresters and timber cruisers**,
and stays narrow. `PRD.md:86–101` remains in force: building for more than one
segment at a time is the most likely way to build for none.

The distinction that matters:

| | |
|---|---|
| **Build for** | independent consulting foresters (unchanged) |
| **Architect for** | organizations, portfolios, enterprise GIS |
| **Research with** | consulting foresters **plus** procurement foresters, timber buyers, enterprise forestry professionals, academics |

Research breadth is not build breadth. The beta gate stays scoped to the
consulting cohort — see `STRATEGY_RECONCILIATION.md` §2.5, because a broadened
cohort silently degrades it.

## 3. Where the differentiation actually is

Not the tally form. Basic field-cruise functionality is commoditizing
(`CONTEXT.md:347–358`), and several products already do it well.

The differentiation sits **before and after** the physical cruise.

**Before — "Know More Before You Go."** Assemble and *interpret* what is already
knowable about a property: boundaries, acreage, imagery, forest cover,
estimated stands, species indicators, stand age, canopy, terrain, slope, soils
and site productivity, wetlands, streams, roads and access, nearby mills, timber
market context, historical imagery and disturbance, preliminary volume and value,
and a confidence indicator on each.

**After — the ground-truth loop.** Remote prediction → professional cruise →
measured actuals → predicted-versus-actual → model improvement → better
predictions. Over time this becomes a proprietary forestry ground-truth dataset,
which is plausibly worth more than the cruising interface.

The loop only works if predicted and measured values are stored **separately**
with provenance (`CONTEXT.md:455–464`). Any inventory design that merges them
destroys the asset — this is a hard constraint in
[`0008`](../decisions/0008-persistent-forest-assets.md).

## 4. GIS philosophy

Give professional foresters the benefits of enterprise GIS without requiring
them to operate one.

Interpret GIS data **into forestry information**:

| Instead of | Produce |
|---|---|
| "Load the USGS elevation layer" | Terrain: Moderate — 82% favorable operating terrain |
| "Add the National Wetlands Inventory" | Wetlands: 11.2 acres / 3.6% of tract |

The GIS stays underneath. The complexity does not surface.

With one limit, from `CONTEXT.md:646`: **do not sacrifice forestry credibility
for simplified UX.** A forester must always be able to reach the underlying
number, the method and the assumption behind any interpreted statement. The
simplification is a default view, never a ceiling.

## 5. ArcGIS

**TimberForge does not compete with ArcGIS and does not aim to replace it.**

**TimberForge Pro** — individual consultants, cruisers, small firms. ArcGIS not
required; TimberForge provides the forestry mapping it needs itself.

**TimberForge Enterprise** — large forestry companies, TIMOs, REITs, agencies,
forest-products companies. ArcGIS remains the enterprise spatial system of
record, and TimberForge becomes the forestry intelligence, inventory, field
operations and decision-support layer above it, syncing both directions:

- **in** — boundaries, stand polygons, roads, streams, ownership, harvest
  history, existing inventory, organization layers
- **out** — cruise plots, updated stands, inventory results, calculated forestry
  attributes, treatments, harvest information

More generally: assume enterprise customers keep their existing systems.
TimberForge should be able to be **the whole workflow, or a layer inside someone
else's stack.**

## 6. Persistent forest assets

A cruise is an event that measures a forest. It is not the thing the system is
built around.

```
organization → property → stand → inventory → cruise → plot → tree/log
                          └── treatments, thinnings, harvests, regeneration,
                              growth, disturbances, inspections, imagery
```

Stands persist through time. A completed cruise updates the current inventory —
there is no "export the cruise into the inventory system" step, because there is
no second system.

The schema does not currently work this way; the fix is cheap now and expensive
after the first production migration. See
[`0008`](../decisions/0008-persistent-forest-assets.md).

## 7. Roadmap

Capability tranches. This axis is distinct from the maturity sequence at
`PRD.md:731–765` (Validation → Prototype → Alpha → Beta → Commercial MVP); both
exist and they are not the same thing.

| Phase | Capability | Purpose |
|---|---|---|
| **1** | Intelligence — property, parcel intelligence, mapping, forest intelligence, stand delineation, terrain/access/wetlands, cruise design, plot generation | Establish the differentiated wedge |
| **2** | Timber cruise — mobile offline collection, GPS, plot and tree data, QA, volume and statistics, valuation, reports | Remove the dependency on separate cruising software |
| **3** | Inventory management — persistent inventories, stand histories, treatments, harvests, growth, inventory updates, portfolio views | Remove the dependency on separate inventory software |
| **4** | Advanced field / mobile GIS — offline GIS, configurable forms, check cruising, advanced navigation, GIS editing | A comprehensive alternative to dedicated field platforms |
| **5** | Enterprise — ArcGIS integration, APIs, SSO, roles and permissions, organization management, large portfolios | Move upmarket without forcing anyone to abandon their GIS |
| **6** | Intelligence network — predicted-versus-actual modeling, remote inventory, portfolio intelligence, data products | Build the long-term data moat |

Phases 1 and 2 are inverted relative to what exists today: the field app was
built first. That is not wasted work, but the *wedge* is Phase 1, and the
sequencing of new work should reflect it.

## 8. The second business

The ground-truth dataset supports a second business — remote timber inventory,
acquisition screening, harvest readiness, portfolio monitoring, change
detection, confidence scoring, valuation APIs.

**This is constrained, not open.** [`0006`](../decisions/0006-cruise-data-rights.md)
and [`0007`](../decisions/0007-landforge-metrics-surface.md) permit derived,
aggregated, consented products and forbid selling tract-level inventory
re-identifiable to a parcel or landowner — particularly to parties who may
transact against that landowner. Several buyers named in the strategy handoff
fall on the wrong side of that line.

This is unresolved and is the first item in
[`STRATEGY_RECONCILIATION.md`](STRATEGY_RECONCILIATION.md). It needs a decision,
not a rewording.

## 9. LandForge

Separate products. LandForge is land investment intelligence; TimberForge is
professional forestry.

LandForge may eventually consume TimberForge outputs — timber value, harvest
readiness, confidence, forest inventory — under the constraints in
[`0007`](../decisions/0007-landforge-metrics-surface.md).

**LandForge integration is not required for TimberForge's success.** TimberForge
must stand alone for professional forestry customers. Note that the schema does
not yet permit this: `parcel_link.landforge_parcel_id` is `not null`, so a tract
cannot exist without a LandForge parcel.

## 10. What TimberForge should not do

- Replace ArcGIS, or require it for smaller customers
- Build enterprise capability before product-market fit
- Support every regional cruise methodology in the first release
- Rely on AI-generated timber estimates, or treat remote estimates as
  substitutes for professional field measurement
- Replace professional forestry judgment
- Become a generic GIS product
- Trade field reliability for AI features
- Compromise offline reliability — offline failure is a critical product failure
- **Expand MVP scope because the vision is broad**

## 11. Guiding principles

1. **One forestry workflow** — avoid application switching, exports, duplicate entry
2. **Know more before you go** — meaningful intelligence before the field visit
3. **Professional judgment wins** — assist foresters, don't pretend to replace them
4. **Ground truth matters** — field measurement validates and improves remote intelligence
5. **GIS power without GIS complexity** — expose forestry decisions, not geospatial configuration
6. **Offline means offline**
7. **Capture once, use everywhere** — a tree measured in a cruise is never re-entered
8. **Build for the small forester; architect for enterprise**
9. **Integrate rather than force replacement**
10. **Broad vision, narrow MVP** — every feature earns its place on validated need

## 12. North star

A forester receives a new property. They open TimberForge and select the parcel.

Within minutes TimberForge has assembled the boundary, imagery, terrain,
wetlands, access, soils, likely stands, preliminary timber characteristics,
nearby mills and market context — each with a confidence indicator. It helps
design the cruise and generates the plots. The forester downloads the property
for offline use.

In the field, TimberForge navigates between plots and captures professional
measurements, continuously evaluating data quality and telling the forester
whether more sampling is needed **before leaving the property**.

On completion it calculates inventory, statistics, volume, product mix and
value. The cruise becomes part of the property's persistent inventory. A
client-ready report is produced without rebuilding the analysis anywhere else.

The measurements are compared against the original remote predictions, and the
differences improve the next prediction.

For a small consulting forester, all of that happens inside TimberForge. For an
enterprise organization, the same workflow synchronizes with its existing ArcGIS
environment.
