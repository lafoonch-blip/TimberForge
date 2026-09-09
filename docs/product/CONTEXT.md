# TimberForge Project Context

## 1. Project Summary

**TimberForge** is a new, standalone business/product focused on professional timber cruising, timber intelligence, and timber valuation.

The core strategy is:

> **Assess → Cruise → Value → Score**

> **Long-term direction (added 2026-09-09).** The destination is broader than
> the above: an all-in-one operating platform for professional forestry, running
> PROPERTY → ASSESS → PLAN → CRUISE → QA → INVENTORY → VALUE → REPORT → LEARN.
> See [`VISION.md`](VISION.md). That sequence is the **product architecture, not
> the MVP scope** — the MVP strategy in §10 of this document is unchanged, and
> the guardrails there ("do not rebuild Forest Metrix feature-for-feature",
> "challenge unnecessary scope") remain in force precisely because the vision is
> now broader. Conflicts between the two are tracked in
> [`STRATEGY_RECONCILIATION.md`](STRATEGY_RECONCILIATION.md).
>
> One architectural consequence is not deferrable: stands and properties must
> **persist across cruises**, which the schema does not currently do. See
> [`../decisions/0008-persistent-forest-assets.md`](../decisions/0008-persistent-forest-assets.md).

TimberForge should help timber cruisers and consulting foresters:
1. Understand a property before visiting it.
2. Plan and conduct a timber cruise in the field.
3. Calculate inventory, volume, value, and confidence.
4. Generate a professional timber cruise report.
5. Produce a standardized **TimberForge Score** and supporting timber metrics.

At a later stage, TimberForge will feed its score and timber metrics into **LandForge**, which is the broader land-intelligence platform.

---

## 2. Why TimberForge Exists

The original LandForge strategy focused on remotely estimating timber value and creating a timber/land investment score.

While developing LandForge, an opportunity became clear:

- Timber cruising software exists, but much of it is focused on field data collection and cruise calculations.
- There appears to be less focus on the full workflow from **pre-cruise property intelligence → cruise planning → field collection → reporting → scoring**.
- Professional timber cruises can provide the ground-truth data needed to improve remote timber estimation over time.
- If professional cruisers use TimberForge as part of their normal workflow, TimberForge can build a proprietary dataset connecting remote parcel characteristics to actual forest inventory results.

The long-term data flywheel is:

**Remote property data → TimberForge pre-cruise estimate → Professional cruise → Predicted vs. actual comparison → Model improvement → Better remote timber intelligence**

---

## 3. Business / Brand Structure

### TimberForge
Standalone product and business initially.

Primary purpose:
- Professional timber intelligence
- Timber cruising workflow
- Timber valuation
- Timber reporting
- TimberForge Score

### LandForge
Separate broader land-intelligence platform.

Later, LandForge should consume structured TimberForge outputs such as:
- TimberForge Score
- Timber value
- Timber value per acre
- Timber volume per acre
- Stand characteristics
- Harvest readiness
- Logging/access metrics
- Mill-market metrics
- Confidence score
- Other timber-related risk/value metrics

TimberForge should be designed so this integration is easy later, but LandForge integration is **not an MVP requirement**.

---

## 4. Initial Target User

Primary MVP user:

- Consulting foresters
- Timber cruisers
- Small forestry firms

Secondary/future users:

- Procurement foresters
- Timber buyers
- Landowners
- Timberland investors
- Brokers
- TIMOs
- REITs
- Timber companies
- Government agencies
- Lenders / insurers

The MVP should be optimized for the professional cruiser, not the landowner.

---

## 5. Core Product Workflow

### Stage 1 — Pre-Cruise Intelligence

The user enters or selects a property.

TimberForge should attempt to automatically provide:

- Parcel boundary
- Total acres
- Estimated forested acres
- Aerial/satellite imagery
- Stand delineation
- Likely timber types
- Likely species composition
- Estimated stand age
- Canopy / stocking indicators
- Terrain
- Slope
- Wetlands
- Streams / likely SMZ considerations
- Existing roads
- Road frontage / access
- Logging access considerations
- Nearby mills
- Timber market / pricing context
- Historical imagery
- Preliminary timber volume estimate
- Preliminary timber value estimate
- Confidence level

This is intended to be a major TimberForge differentiator.

---

### Stage 2 — Cruise Design

TimberForge should help the forester design the cruise.

Potential capabilities:

- Define stands / strata
- Edit AI-generated stand boundaries
- Select cruise methodology
- Recommend cruise methodology
- Set target sampling error / confidence
- Recommend BAF or plot size
- Estimate number of plots / points needed
- Allocate plots by stand
- Generate plot locations
- Allow manual plot editing
- Create field navigation route
- Export/import GIS data where needed

Potential supported cruise methodologies over time:

- 100% cruise
- Sample tree
- Fixed-area plot
- Variable-radius / point sampling
- 3P
- Hybrid methods

MVP should not attempt to support every possible forestry methodology unless user research proves it is necessary.

---

### Stage 3 — Field Cruise

Mobile-first and offline-capable.

Expected field inputs include:

- Stand
- Plot / point
- GPS location
- Species
- DBH
- Tree height
- Merchantable height
- Product
- Grade / quality
- Defect
- Tree count
- BAF / plot details
- Notes
- Photos
- Other configurable measurements

Key requirements:

- Fast field entry
- Large, simple controls
- Offline operation
- GPS navigation
- Automatic save
- Resume interrupted cruises
- Minimal typing
- Configurable species/product lists
- Real-time calculations where useful

Potential future integrations:
- Bluetooth forestry calipers
- Laser rangefinders
- Electronic dendrometers
- LiDAR / sensor systems
- Computer vision

---

### Stage 4 — Real-Time QA

TimberForge should use rules and statistical checks to identify likely errors while the cruiser is still in the field.

Examples:

- Unusually large/small DBH
- Unusual height for DBH/species
- Missing required measurements
- Species/product conflicts
- Duplicate plot/tree records
- Plot significantly different from neighboring plots
- Sampling distribution issues
- Sampling error still above target
- Estimated number of additional plots required

The goal is to reduce errors before the cruiser leaves the property.

---

### Stage 5 — Cruise Analytics

After or during the cruise, TimberForge should calculate appropriate metrics such as:

- Trees per acre
- Basal area per acre
- QMD
- Species composition
- Diameter distribution
- Stand tables
- Volume per acre
- Total volume
- MBF / acre
- Tons / acre
- Board-foot volume
- Pulpwood / chip-n-saw / sawtimber breakdown
- Product mix
- Gross and net volume
- Defect deductions
- Sampling error
- Confidence interval
- Value by species
- Value by product
- Value by stand
- Total timber value
- Timber value per acre

Calculations must be transparent, defensible, and based on accepted forestry methods.

---

## 6. TimberForge Report

A major product output should be a professional client-ready report.

Potential sections:

1. Executive summary
2. Property overview
3. Cruise methodology
4. Stand descriptions
5. Maps
6. Sampling statistics
7. Species composition
8. Diameter distribution
9. Stand tables
10. Timber volumes
11. Product mix
12. Timber valuation
13. Harvest-readiness analysis
14. Logging/access considerations
15. Mill-market context
16. Photos
17. Assumptions
18. Limitations
19. TimberForge Score
20. Recommended next actions

The cruiser should be able to review/edit narrative content before generating the final report.

---

## 7. TimberForge Score

TimberForge should eventually produce a standardized score representing the quality/value/readiness of the timber asset.

Working concept:

**TimberForge Score: 0–100**

Potential score dimensions:

- Timber Inventory
- Timber Value
- Stand Quality
- Harvest Readiness
- Logging Accessibility
- Mill Market Access
- Timber Risk
- Data Confidence

Example output:

- TimberForge Score: 82 / 100
- Timber value: $186,400
- Timber value/acre: $1,420
- Sawtimber volume: 5,870 BF/ac
- Pulpwood volume: 21.4 tons/ac
- Harvest readiness: 85/100
- Confidence: 92/100

The exact scoring logic and weighting are **not yet finalized** and should be developed using forestry expertise, beta data, and user research.

The score must never hide the underlying professional metrics. Users should always be able to see why a property received its score.

---

## 8. Competitive Landscape

Important current competitors / benchmarks:

### Forest Metrix
Primary commercial benchmark.

Strengths:
- Mature field cruising
- Professional calculations
- Configurability
- Reporting
- Established forestry user base

Current known pricing:
- Pro: approximately $1,000/year
- Pro Plus: approximately $1,500/year

TimberForge opportunity:
- Stronger pre-cruise parcel intelligence
- Automated property analysis
- Predicted vs. actual comparison
- Timber scoring
- Modern workflow / UX

### SilvaCruise
Newer low-cost / mobile-first competitor.

Strengths:
- Cruise field collection
- Plot-grid generation
- Sampling calculations
- Offline maps/navigation
- Low-cost / free core features

Strategic implication:
Basic field-cruise functionality is becoming commoditized.

### USDA FScruiser / National Cruise System
Important technical benchmark rather than primary commercial competitor.

Strengths:
- Deep professional methodology
- Multiple cruise methods
- Cruise design
- Statistical processing
- Government/industry-standard logic

Use Forest Service methodology as a reference for accepted cruising concepts rather than reinventing forestry science.

### Other relevant products

- TCruise
- SuperACE / FLIPS
- iCruisePro
- CruisePro
- Woodland Solutions Group inventory systems
- Haglöf hardware/software ecosystem
- Gaia AI

---

## 9. Competitive Positioning

TimberForge should **not** position itself as:

> A nicer timber tally app.

The desired position is:

> **TimberForge already understands the property before the cruiser arrives.**

Existing software generally starts at:

**Create Cruise → Configure → Collect → Calculate → Report**

TimberForge should aim for:

**Property → Assess → Design → Cruise → QA → Value → Report → Score**

---

## 10. Main Differentiators

Highest-priority differentiators:

1. **Pre-Cruise Intelligence**
2. **Automatic / assisted stand delineation**
3. **Cruise design recommendations**
4. **Remote preliminary timber estimate**
5. **Real-time field QA**
6. **Predicted vs. actual comparison**
7. **Automatic professional report generation**
8. **TimberForge Score**
9. **Longitudinal property intelligence**
10. **Ground-truth data flywheel**

Commodity / table-stakes features:

- Species entry
- DBH
- Height
- Defect
- GPS
- Offline mode
- Plots
- Standard volume calculations
- Basic statistics
- PDF export

These still need to be excellent, but they should not be treated as the main moat.

---

## 11. Core Data Model

The system should be designed approximately around:

**User / Organization**
→ **Property / Parcel**
→ **Stand**
→ **Inventory**
→ **Cruise**
→ **Stratum**
→ **Plot / Point**
→ **Tree**
→ **Log / Product**
→ **Measurement**
→ **Volume**
→ **Value**
→ **Metrics**
→ **TimberForge Score**
→ **Report**

Remote/pre-cruise observations should be stored separately from field-measured ground truth so TimberForge can compare predictions against actual cruise results.

> **Persistence and history (added 2026-09-09).** Properties and stands are
> **durable**; a cruise is an event that measures them. A stand carries an
> **inventory** — the current best estimate of what is standing — which a
> completed cruise updates rather than replaces, and a **stand event** log for
> treatments, thinnings, harvests, regeneration, disturbances and inspections.
> Plots and trees stay under the cruise, because a plot only means anything in
> the context of the design that placed it.
>
> The implemented schema does not yet work this way — `timberforge.stand` is a
> child of `cruise` and is deleted with it, so cruising the same tract twice
> produces two unrelated stands. Recorded, with the migration path and the
> reason the cost rises steeply after first deployment, in
> [`../decisions/0008-persistent-forest-assets.md`](../decisions/0008-persistent-forest-assets.md).
>
> The separation of predicted from measured stated immediately above is a hard
> constraint on that work: an inventory that merges a field measurement over a
> prediction in place destroys the left-hand column of the ground-truth loop.

Every important estimate should preserve:

- Source
- Date
- Method
- Confidence
- Assumptions
- Whether it is predicted, user-entered, or field-measured

---

## 12. Data Flywheel / Long-Term Moat

The long-term strategic asset is not simply the application.

The goal is to build a proprietary dataset containing, where permitted:

### Remote / parcel data
- Location
- Parcel
- Imagery
- Canopy
- LiDAR-derived metrics
- Terrain
- Soils
- Site index
- Access
- Hydrology
- Stand classification
- Historical imagery

### Ground-truth cruise data
- Species
- DBH
- Height
- Stocking
- Basal area
- TPA
- Grade
- Defect
- Product
- Volume
- Stand age
- Value

### Comparison data
- Predicted vs. actual volume
- Predicted vs. actual species composition
- Predicted vs. actual timber value
- Error by geography
- Error by stand type
- Error by imagery/data source
- Error by forest condition

This should allow TimberForge to improve remote estimates over time.

Data rights, customer confidentiality, anonymization, and acceptable aggregation must be designed deliberately from the beginning.

---

## 13. MVP Strategy

Do **not** try to rebuild Forest Metrix feature-for-feature.

Recommended MVP focus:

### Must Have
- Account / organization
- Property creation
- Parcel map
- Basic pre-cruise analysis
- Stand creation/editing
- Basic cruise setup
- One or two common cruise methodologies
- Offline mobile field collection
- Species / DBH / height / product / defect
- GPS plot navigation
- Volume calculations
- Sampling statistics
- Timber valuation
- Basic QA
- Professional report
- Prediction vs. cruise comparison

### Differentiating MVP capabilities
- Pre-cruise property intelligence
- Suggested stand boundaries
- Preliminary timber estimate
- Cruise-planning assistance
- Predicted vs. actual analysis

### Later
- Full methodology library
- Advanced enterprise GIS
- Growth/yield modeling
- Hardware integrations
- Computer vision
- Sensor-based inventory
- Enterprise APIs
- LandForge integration

---

## 14. Beta Strategy

Initial beta should focus on professional foresters/cruisers.

Recommended process:

1. Recruit 5–10 initial professional users.
2. Have them select real upcoming cruise properties.
3. TimberForge performs pre-cruise analysis.
4. Forester reviews/edit stands and assumptions.
5. Forester completes the cruise using TimberForge alongside or instead of the existing process.
6. TimberForge compiles results.
7. Generate the client report.
8. Compare TimberForge's pre-cruise estimate against actual cruise.
9. Capture user feedback.
10. Measure time saved, accuracy, usability, and report quality.

Important beta metrics:

- Time required to set up cruise
- Time required per plot/tree
- Total office time saved
- Report preparation time saved
- Crash / sync / offline reliability
- Calculation accuracy
- Pre-cruise prediction accuracy
- Sampling/statistical accuracy
- User willingness to replace current software
- User willingness to pay
- Repeat use

---

## 15. User Research Needed

Before heavy development, interview approximately 10–20 professional cruisers/foresters.

Key questions:

- What software do you currently use?
- What do you like/hate about it?
- What happens before you visit the property?
- How do you design a cruise?
- What GIS tools do you use?
- What equipment do you carry?
- What data do you enter in the field?
- What must work offline?
- What calculations do you trust?
- What causes rework?
- How long does reporting take?
- What reports do clients expect?
- What would make you switch software?
- What would you pay?
- What data are you comfortable allowing TimberForge to aggregate/anonymize?

---

## 16. Forestry Reference Material

Important reference material already collected for this project includes:

- USDA Forest Service — **National Forest Log Scaling Handbook (FSH 2409.11)**
- USDA Forest Service — **Timber Cruising Handbook (FSH 2409.12)**
- Burkhart, Avery, Bullock — **Forest Measurements, Sixth Edition**
- Bell & Dilworth — **Log Scaling and Timber Cruising**
- Forest Metrix user documentation / workflow analysis from prior LandForge work

These should be used to define accepted terminology, formulas, cruising methods, measurement logic, statistical requirements, reporting standards, and QA rules.

Do not assume all Forest Service requirements automatically apply to private consulting forestry. Separate:
- Accepted forestry science/methodology
- Federal Forest Service-specific policy/process
- Regional/private-market conventions

---

## 17. Product / Technical Principles

1. **Mobile-first in the field**
2. **Offline-first**
3. **Fast data entry**
4. **Professional calculations must be auditable**
5. **Predictions and measured data must be clearly distinguished**
6. **Every estimate should include confidence/provenance where possible**
7. **Cruisers remain the professional decision-maker**
8. **AI should reduce administrative work, not invent forestry measurements**
9. **Do not sacrifice forestry credibility for simplified UX**
10. **Design all data so it can later feed LandForge through an API**

---

## 18. AI Opportunities

Useful AI applications:

- Pre-cruise property summary
- Stand-boundary suggestions
- Cruise-design recommendations
- Measurement anomaly detection
- Missing-data detection
- Predicted vs. actual analysis
- Report narrative drafting
- Stand descriptions
- Harvest considerations
- Client-facing summaries
- Natural-language querying of completed cruises

AI should not silently fabricate:
- Species
- Measurements
- Volumes
- Defect
- Grades
- Sampling results
- Timber prices

All AI-generated analysis should be traceable to source data.

---

## 19. Open Decisions

Still to be determined:

- Exact MVP cruise methodologies
- Initial target geography
- Initial species/product library
- Timber price data source(s)
- Remote imagery / LiDAR data stack
- Exact TimberForge Score formula
- Score weights
- Pricing model
- Free vs. paid tiers
- Hardware integrations
- GIS architecture
- Report template
- Legal language / professional disclaimers
- Data-use rights
- Beta incentive structure
- Whether initial build is native mobile, cross-platform, or PWA

---

## 20. Current Strategic Priorities

In priority order:

1. Validate the problem with professional cruisers.
2. Map the exact current cruiser workflow.
3. Benchmark Forest Metrix and top competitors feature-by-feature.
4. Define the TimberForge MVP.
5. Define the forestry calculation engine.
6. Define the TimberForge data model.
7. Prototype pre-cruise intelligence.
8. Prototype field workflow.
9. Define report output.
10. Define initial TimberForge Score concept.
11. Run field beta.
12. Improve prediction models using ground-truth cruise data.
13. Expand features and geography.
14. Integrate TimberForge outputs into LandForge later.

---

## 21. Guidance for AI Assistants Working on TimberForge

When helping build TimberForge:

- Prioritize concise, decision-oriented answers.
- Avoid long narrative unless explicitly requested.
- Separate **MVP**, **later**, and **not needed**.
- Do not assume a feature is valuable simply because competitors have it.
- Protect the core differentiation: pre-cruise intelligence + professional cruise + score.
- Challenge unnecessary scope.
- Ground forestry logic in accepted professional sources.
- Flag where regional rules, species, log rules, or timber markets create variability.
- Prefer configurable logic over hard-coded assumptions where practical.
- Keep TimberForge separate from LandForge unless the task specifically concerns integration.
- Treat the TimberForge Score as an output supported by transparent underlying metrics, not a replacement for them.
- Optimize for adoption by working professional foresters and cruisers first.

---

## 22. One-Sentence Product Vision

> **TimberForge is a professional timber intelligence platform that helps foresters understand a property before they arrive, design and conduct the cruise, calculate and value the timber, generate the client report, and produce a trusted TimberForge Score.**
