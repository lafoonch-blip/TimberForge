# TimberForge Project Context

## 1. Project Summary

**TimberForge** is a new, standalone business/product focused on professional timber cruising, timber intelligence, timber valuation, statistical QA, and reporting.

The core MVP workflow is:

> **Assess → Design → Cruise → QA → Value → Report**

> **Long-term direction (updated 2026-09-10).** The destination is broader than
> the above: an all-in-one operating platform for professional forestry, running
> PROPERTY → ASSESS → PLAN → CRUISE → QA → INVENTORY → VALUE → REPORT → LEARN.
> See [`VISION.md`](VISION.md). That sequence is the **product architecture, not
> the MVP scope** — the MVP strategy in §13 of this document is unchanged, and
> the guardrails there ("do not rebuild Forest Metrix feature-for-feature",
> "challenge unnecessary scope") remain in force precisely because the vision is
> broader. Conflicts between the two are tracked in
> [`STRATEGY_RECONCILIATION.md`](STRATEGY_RECONCILIATION.md).
>
> TimberForge is an evidence and workflow product, not a property-decision
> engine. It may describe inventory, timber value, access, sampling precision,
> and measured conditions. It should not tell a user whether to buy, sell, hold,
> develop, subdivide, conserve, or otherwise use the property, and it should not
> prescribe whether or when a landowner should harvest timber.
>
> One architectural consequence is not deferrable: stands and properties must
> **persist across cruises**, which the schema does not currently do. See
> [`../decisions/0008-persistent-forest-assets.md`](../decisions/0008-persistent-forest-assets.md).

TimberForge should help timber cruisers and consulting foresters:
1. Understand a property before visiting it.
2. Plan and conduct a timber cruise in the field.
3. Calculate inventory, volume, value, and confidence.
4. Validate whether the cruise meets its sampling target.
5. Generate a professional timber cruise report.

At a later stage, TimberForge may feed structured timber metrics into **LandForge**, which is the broader land-intelligence platform, under the data-rights and metrics-surface decisions already recorded.

---

## 2. Why TimberForge Exists

The original LandForge strategy focused on remotely estimating timber value and creating a timber/land investment score.

While developing LandForge, an opportunity became clear:

- Timber cruising software exists, but much of it is focused on field data collection and cruise calculations.
- There appears to be less focus on the full workflow from **pre-cruise property intelligence → cruise planning → field collection → QA → valuation → reporting**.
- Professional timber cruises can provide the ground-truth data needed to improve remote timber estimation over time.
- If professional cruisers use TimberForge as part of their normal workflow, TimberForge can build a proprietary dataset connecting remote parcel characteristics to actual forest inventory results where customer permissions allow.

The long-term data flywheel is:

**Remote property data → TimberForge pre-cruise estimate → Professional cruise → Predicted vs. actual comparison → Model improvement → Better remote timber intelligence**

---

## 3. Business / Brand Structure

### TimberForge
Standalone product and business initially.

Primary purpose:
- Professional timber intelligence
- Timber cruising workflow
- Statistical cruise QA
- Timber valuation
- Timber reporting

### LandForge
Separate broader land-intelligence platform.

Later, LandForge may consume structured TimberForge outputs such as:
- Timber value
- Timber value per acre
- Timber volume per acre
- Stand characteristics
- Harvest-readiness signals as descriptive metrics rather than prescriptions
- Logging/access metrics
- Mill-market metrics
- Cruise confidence / precision metrics
- Other timber-related risk/value metrics permitted by the LandForge-facing metrics surface

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
- Logging access observations
- Nearby mills
- Timber market / pricing context
- Historical imagery
- Preliminary timber volume estimate
- Preliminary timber value estimate
- Confidence level

This is intended to be a major TimberForge differentiator.

---

### Stage 2 — Cruise Design

TimberForge should help the forester design the cruise while keeping the professional in control of the methodology.

Core concepts:

- **Cruise purpose:** reconnaissance and production are different workflows. Reconnaissance characterizes stand variability and can inform a production sample design.
- **Stand / unit:** geographic acreage being managed or cruised.
- **Stratum:** a sampling group with similar conditions/product assumptions. It is not interchangeable with a geographic unit.
- **Method:** selected per stratum where appropriate.
- **Merchantability / volume basis:** explicit, versioned assumptions used in compilation.

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
- Configure regional species/product lists
- Configure log rule and merchantability assumptions
- Export/import GIS data where needed

Potential supported cruise methodologies over time:

- 100% cruise / measure
- Tally workflows
- Sample tree
- Fixed-area plot
- Variable-radius / point sampling
- 3P
- Hybrid methods

MVP should not attempt to support every possible forestry methodology unless user research proves it is necessary. The implemented foundation currently supports variable-radius/point sampling and fixed-area plots.

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
- Plot slope / aspect / elevation / canopy cover where configured
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
- Clear cruise/unit progress

The setup workflow may contain significant forestry configuration, but the active field screen should remain simple and expose only the measurements/actions required for the current plot or tree.

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
- Plot count
- Mean
- Standard deviation
- Coefficient of variation
- Standard error
- Sampling error
- Confidence interval
- Required total plots for target precision
- Additional plots needed
- Stratified vs. simple sampling performance where applicable
- Value by species
- Value by product
- Value by stand
- Total timber value
- Timber value per acre

Calculations must be transparent, defensible, and based on accepted forestry methods.

---

### Stage 6 — Report

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
13. Logging/access observations
14. Mill-market context
15. Photos
16. Assumptions
17. Limitations
18. Data quality / cruise confidence

The cruiser should be able to review/edit narrative content before generating the final report. Reports should communicate findings and assumptions, not prescribe a property-use or harvest decision.

---

## 6. Cruise Design & Statistical Confidence

TimberForge should treat cruise design and statistical confidence as part of the professional workflow rather than as a hidden calculation after data collection.

### Reconnaissance → Production

A reconnaissance cruise can estimate variability. TimberForge should use that variability, the user's target sampling error, and the selected confidence level to estimate the production sample requirement.

Expected outputs:

- Recon plot count
- Mean and variability statistics
- Coefficient of variation
- Target sampling error
- Confidence level
- Required total plots
- Additional plots needed
- Plain-language sampling adequacy status
- Ability to generate/update the production design from the recon results

Sample-size logic must remain auditable and tied to the actual implemented statistical method. Do not copy constants or formulas from competitor screenshots without professional verification.

### Post-cruise confidence

Post-cruise confidence is a sampling statistic, not a generalized property score. It remains distinct from LandForge's pre-cruise confidence model as recorded in [`../decisions/0003-pre-and-post-cruise-scoring.md`](../decisions/0003-pre-and-post-cruise-scoring.md).

---

## 7. SilvaCruise Competitive Workflow Review — 2026-09-10

SilvaCruise is a useful benchmark because it demonstrates a coherent professional sequence:

**Cruise setup → field execution → statistical validation → reporting**

The reviewed product should be treated as a workflow reference, not as an authoritative forestry source. Screenshot observations must not be copied into TimberForge calculations without independent validation.

### Setup model observed

SilvaCruise separates **Quick Cruise** from **Full Cruise**. Full Cruise distinguishes **Reconnaissance** from **Production** and then walks through a structured setup:

1. Basic information
2. Define strata
3. Add units
4. Region & species
5. Cruise design by stratum
6. Merchantability
7. Review & start

Notable design ideas:

- Strata can use independent cruise methods.
- Geographic units can be assigned to one or more strata.
- Variable-radius strata expose BAF; fixed/other methods are configured separately.
- Region presets narrow species choices.
- Merchantability assumptions are explicit before collection, including log rule, form class, minimum DBH, stump height, log length, and method-specific top/height logic.
- Map/GPS functionality can be optional for a tabular cruise workflow.
- Reconnaissance statistics can feed a production-cruise sample design.

### Field workflow observed

The active field workflow is materially simpler than the setup workflow. Plot-level observations include items such as slope, aspect, elevation, canopy cover, notes, trees, and photos. Tree entry emphasizes rapid species/DBH/height collection. Progress is visible at cruise and unit level.

Useful interaction ideas include:

- Add tree
- Flag borderline tree
- Mark empty plot
- Take photo
- Previous/next plot
- Complete plot
- Large, compact field controls rather than repeating setup configuration

### Analytics observed

SilvaCruise exposes both forestry inventory outputs and the statistics behind the estimate, including:

- BA/ac
- TPA
- QMD
- Gross/net BF/ac
- Total MBF
- Diameter distribution
- Volume by diameter class and species
- Plot count
- Mean
- Standard deviation
- CV
- Standard error
- Sampling error
- Confidence interval
- Plot-volume distribution
- Required sample size / additional plots
- Stratification analysis

This statistical transparency is the most important pattern for TimberForge to match or improve.

### Caution from the review

Several screenshots contain values or labels whose reporting basis is not obvious from the UI alone. Examples include differing CV values between views and totals that do not trivially reconcile with displayed per-acre means. These are **clarity/data-basis questions**, not proven competitor calculation errors. TimberForge should make population, stratum, acreage, unit basis, gross/net basis, and confidence assumptions explicit wherever ambiguity would change interpretation.

### TimberForge implication

Do not copy SilvaCruise screen-for-screen. Borrow the professional cruise structure and statistical transparency while differentiating upstream and downstream:

**Pre-cruise intelligence → assisted cruise design → simple offline field collection → real-time QA → auditable inventory/value/confidence → professional report**

The strongest TimberForge opportunity is to arrive at cruise setup with more of the property already understood, while keeping the forester in control of the final stand, method, merchantability, and sampling decisions.

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
- Statistical transparency
- Modern workflow / UX

### SilvaCruise
Newer low-cost / mobile-first competitor and current workflow benchmark.

Strengths observed in the 2026-09-10 review:
- Quick vs. Full Cruise progressive complexity
- Reconnaissance vs. Production purpose
- Strata and geographic units
- Regional species presets
- Explicit merchantability setup
- Cruise field collection
- Sampling calculations and sample-size planning
- Offline maps/navigation
- Statistical transparency
- Low-cost / free core positioning

Strategic implication:
Basic field-cruise functionality is becoming commoditized. TimberForge must be excellent at it, but the differentiator is the broader property-intelligence-to-report workflow.

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

**Property → Assess → Design → Cruise → QA → Value → Report**

The distinction is not that TimberForge makes the land decision for the user. It is that the professional begins the cruise with better property context and finishes with a more auditable work product.

---

## 10. Main Differentiators

Highest-priority differentiators:

1. **Pre-Cruise Intelligence**
2. **Automatic / assisted stand delineation**
3. **Cruise design recommendations for the professional to accept/override**
4. **Remote preliminary timber estimate**
5. **Real-time field QA**
6. **Predicted vs. actual comparison**
7. **Automatic professional report generation**
8. **Transparent statistical confidence**
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
→ **Metrics / Cruise Confidence**
→ **Report**

Remote/pre-cruise observations should be stored separately from field-measured ground truth so TimberForge can compare predictions against actual cruise results.

A **stand/unit** and a **stratum** must remain conceptually distinct. The former is geographic/persistent forest acreage; the latter is a sampling grouping within a cruise design. A cruise may use strata to sample one or more stands/units, including nested designs where supported.

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

Do **not** try to rebuild Forest Metrix or SilvaCruise feature-for-feature.

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
- Reconnaissance-to-production sample planning
- Predicted vs. actual analysis
- Clear data confidence

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

Before heavy development, interview **15–20 consulting foresters** in VA/NC. (An
earlier draft said 10–20; the go/no-go gate in `PRD.md` §12 assumes 15–20, and
the smaller number would weaken it.) Other segments — procurement foresters,
timber buyers, enterprise forestry staff, academics — are worth talking to, but
those conversations answer different questions and are *additional to* this
count, not part of it.

Key questions:

- What software do you currently use?
- What do you like/hate about it?
- What happens before you visit the property?
- How do you design a cruise?
- Do you use a separate reconnaissance cruise before production sampling?
- How do you distinguish geographic units/stands from sampling strata?
- Which merchantability assumptions must be configurable?
- What sampling-error/confidence targets do clients expect?
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

Competitor screenshots, including SilvaCruise, are UX/workflow evidence rather than a formula authority.

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
10. **Design permitted derived data so it can later feed LandForge through a controlled interface**
11. **Do not turn objective timber intelligence into property-use or harvest prescriptions**

---

## 18. AI Opportunities

Useful AI applications:

- Pre-cruise property summary
- Stand-boundary suggestions
- Cruise-design recommendations for professional review
- Measurement anomaly detection
- Missing-data detection
- Predicted vs. actual analysis
- Report narrative drafting
- Stand descriptions
- Logging/access observations
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

AI also should not use TimberForge data to issue property investment, development, land-use, or prescriptive harvest recommendations. All AI-generated analysis should be traceable to source data and reviewable by the professional user.

---

## 19. Open Decisions

Still to be determined:

- Exact MVP cruise methodologies
- Initial target geography
- Initial species/product library
- Timber price data source(s)
- Remote imagery / LiDAR data stack
- Data-confidence presentation
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
3. Benchmark Forest Metrix, SilvaCruise, and top competitors feature-by-feature.
4. Define the TimberForge MVP.
5. Define the forestry calculation engine.
6. Define the TimberForge data model.
7. Prototype pre-cruise intelligence.
8. Prototype cruise-design and field workflow.
9. Define report output and statistical-confidence presentation.
10. Run field beta.
11. Improve prediction models using ground-truth cruise data.
12. Expand features and geography.
13. Integrate permitted TimberForge outputs into LandForge later.

---

## 21. Guidance for AI Assistants Working on TimberForge

When helping build TimberForge:

- Prioritize concise, decision-oriented answers.
- Avoid long narrative unless explicitly requested.
- Separate **MVP**, **later**, and **not needed**.
- Do not assume a feature is valuable simply because competitors have it.
- Protect the core differentiation: pre-cruise intelligence + professional cruise + auditable confidence/reporting.
- Challenge unnecessary scope.
- Ground forestry logic in accepted professional sources.
- Treat competitor screenshots as workflow evidence, not formula authority.
- Flag where regional rules, species, log rules, or timber markets create variability.
- Prefer configurable logic over hard-coded assumptions where practical.
- Keep TimberForge separate from LandForge unless the task specifically concerns integration.
- Treat statistical confidence as a transparent description of cruise precision, not a recommendation about the property.
- Do not recommend what a user should do with a property or whether/when to harvest.
- Optimize for adoption by working professional foresters and cruisers first.

---

## 22. One-Sentence Product Vision

> **TimberForge is a professional timber intelligence platform that helps foresters understand a property before they arrive, design and conduct the cruise, validate the data, calculate and value the timber, and generate a defensible client report.**
