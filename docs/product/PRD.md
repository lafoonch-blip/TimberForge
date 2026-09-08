# TimberForge Product Requirements Document (PRD)

## 1. Product Overview

**Product:** TimberForge  
**Version:** MVP / Beta  
**Primary Users:** Consulting foresters and timber cruisers  
**Core Product Flow:** **Assess → Cruise → Value → Score**

TimberForge is a professional timber intelligence and cruising platform that helps foresters understand a property before visiting it, design and conduct a timber cruise, calculate inventory and timber value, generate a professional report, and produce a standardized TimberForge Score.

TimberForge will operate as a standalone product initially. At a later stage, its score and underlying timber metrics will feed into LandForge.

> **Market position (added 2026-09-08).** Independent consulting foresters are the
> chosen first segment, but they are a **wedge, not a market**. The whole US
> consulting segment supports roughly $2M–$7.5M of annual software spend across
> all vendors, so subscription revenue from this segment covers costs rather than
> constituting the outcome. The product is built to prove the workflow and
> accumulate regional ground truth. Sizing, sources and the revised scorecard are
> in [`../market/BUSINESS_CASE.md`](../market/BUSINESS_CASE.md); this PRD should
> not be read as a revenue plan.

---

## 2. Problem Statement

Timber cruisers currently use a mix of mobile cruising software, GIS tools, spreadsheets, desktop applications, field notes, and manual reporting workflows.

Existing tools are generally strong at field data collection and cruise calculations, but the workflow is fragmented across:

- Pre-cruise parcel research
- GIS / mapping
- Cruise planning
- Field navigation
- Tree and plot data collection
- Statistical validation
- Timber valuation
- Client reporting

TimberForge should unify these activities into one workflow while adding pre-cruise intelligence and predicted-vs-actual analysis.

---

## 3. Product Goals

### MVP Goals

1. Reduce the time required to prepare, execute, and report a timber cruise.
2. Provide useful property intelligence before the cruiser enters the field.
3. Support professional-grade field data collection and cruise calculations.
4. Generate a client-ready timber cruise report.
5. Compare TimberForge pre-cruise predictions to actual cruise results.
6. Create the foundation for a trusted TimberForge Score.
7. Capture structured ground-truth data that can improve future remote timber estimates.

### Non-Goals for MVP

- Replace every feature in Forest Metrix, TCruise, or FScruiser.
- Support every cruise methodology on launch.
- Fully automate professional forestry judgment.
- Replace a licensed/qualified forester.
- Build LandForge integration into the first beta.
- Build hardware integrations in the first release.

---

## 4. Target Users

### Primary — and the only one being built for

- Independent consulting foresters
- Independent timber cruisers
- Small forestry firms

Launch geography is **Virginia and North Carolina**. This is defensible on market
grounds rather than convenience: both sit in the strongest band in the South on
both products, with sawtimber over $30/ton in NC against $17–21/ton in TN, SC and
AL, and pulpwood at $9–14/ton in VA and eastern NC against under $4/ton in AR, LA
and TN (TimberMart-South, Q4 2025).

This segment has one unusual property that shapes go-to-market: **it can be
enumerated by name.** State forestry agencies publish consulting forester
directories, so the addressable launch market is a list, not an estimate. Direct
outreach is the channel; paid acquisition is not needed.

### Secondary / Future — explicitly not now

- Procurement foresters
- Timber buyers
- Timberland investors
- Landowners
- Brokers
- TIMOs
- REITs
- Timber companies
- Government agencies

These are three different sales motions blended into one list. Sole proprietors
buy personally and slowly; procurement foresters have tools chosen for them;
institutions want contracts and security review. Building for more than one at a
time is the most likely way to build for none.

Note also that several entries here are **counterparties** to the primary users
in a stumpage negotiation. That is not a reason to exclude them permanently, but
it is why [`../decisions/0006-cruise-data-rights.md`](../decisions/0006-cruise-data-rights.md)
exists and why it should be read before any work targeting them.

### Off the roadmap

**Canada, including British Columbia.** BC cruising is regulated with provincial
compilation specifications, and the incumbent claims over 90% of the BC industry
while already shipping its own field tablet alongside its compiler. Entering as
"the modern field layer that exports into their compiler" means competing with
their handheld for the right to feed their compiler. Reconsider only with a
specific reason.

---

## 5. Core User Journey

### Step 1 — Create Property

User:
- Searches address / parcel
- Selects parcel boundary
- Creates TimberForge property

System:
- Loads parcel and property intelligence
- Calculates total and forested acres
- Creates initial property workspace

### Step 2 — Pre-Cruise Assessment

TimberForge generates:

- Parcel map
- Aerial imagery
- Estimated forested area
- Suggested stand boundaries
- Likely timber type
- Likely species composition
- Estimated stand age
- Terrain / slope
- Streams / wetlands
- Existing roads / access
- Nearby mills
- Market-price context
- Preliminary timber volume
- Preliminary timber value
- Confidence level

User can accept, edit, or override estimates.

### Step 3 — Design Cruise

User:

- Confirms / edits stands
- Selects cruise method
- Sets target sampling error / confidence
- Defines products / species
- Reviews recommended plots

TimberForge:

- Recommends methodology where appropriate
- Recommends plot count
- Allocates plots by stand
- Generates plot locations
- Creates field navigation map

### Step 4 — Conduct Field Cruise

User records:

- Stand
- Plot / point
- GPS position
- Species
- DBH
- Height
- Merchantable height
- Product
- Defect
- Grade / quality where applicable
- Notes
- Photos

Requirements:

- Offline-capable
- Auto-save
- Fast mobile entry
- Minimal typing
- Resume interrupted cruises

### Step 5 — QA / Validation

TimberForge flags:

- Missing required fields
- Potential DBH / height outliers
- Duplicate records
- Product / species conflicts
- Sampling gaps
- Sampling error above target
- Potential need for additional plots

### Step 6 — Compile & Value

TimberForge calculates:

- Trees per acre
- Basal area
- QMD
- Species mix
- Diameter distribution
- Volume per acre
- Total volume
- Product mix
- Gross / net volume
- Sampling error
- Confidence interval
- Value by species
- Value by product
- Value by stand
- Total timber value
- Timber value per acre

### Step 7 — Report

System generates editable report containing:

- Executive summary
- Property overview
- Maps
- Cruise methodology
- Stand descriptions
- Sampling statistics
- Species / diameter distribution
- Stand tables
- Volume summary
- Timber valuation
- Harvest / access considerations
- Photos
- Assumptions
- TimberForge Score
- Recommendations

### Step 8 — Compare Prediction vs. Actual

TimberForge compares:

- Predicted vs. actual species
- Predicted vs. actual stand composition
- Predicted vs. actual volume
- Predicted vs. actual timber value
- Accuracy by stand
- Confidence performance

This data should be stored for model improvement.

---

## 6. MVP Functional Requirements

### 6.1 Accounts & Organizations

**Must Have**

- Email / SSO login
- Individual user profile
- Organization / company name
- Role permissions
- Property / cruise history
- **Ground-truth contribution flag, per organization, defaulting OFF** — surfaced
  at first run, not buried in settings. See
  [`../decisions/0006-cruise-data-rights.md`](../decisions/0006-cruise-data-rights.md).
- **Full data export on demand**, including on account termination. TimberForge
  is a custodian of the client's inventory, not its owner, and a custodian that
  cannot return what it holds is not one.

### 6.2 Property Management

**Must Have**

- Search / create property
- Parcel boundary
- Acreage
- Property map
- Property status
- Archive property

### 6.3 Pre-Cruise Intelligence

**Must Have**

- Aerial imagery
- Parcel boundary
- Forested-acre estimate
- Stand creation
- Manual stand editing
- Terrain / slope
- Streams / wetlands
- Access / roads
- Preliminary timber assessment

**Beta Differentiators**

- Suggested stand boundaries
- Estimated timber type
- Estimated stand age
- Preliminary volume
- Preliminary value
- Confidence score

### 6.4 Cruise Setup

**Must Have**

- Create cruise
- Assign stands
- Select cruise method
- Define species list
- Define products
- Define measurements
- Set target sampling error
- Create / edit plots

### 6.5 Field Data Collection

**Must Have**

- Mobile-first interface
- Offline operation
- Plot / tree data entry
- Species
- DBH
- Height
- Product
- Defect
- Notes
- Photos
- GPS
- Auto-save

### 6.6 Field Navigation

**Must Have**

- Property map
- Stand boundaries
- Plot locations
- Current GPS position
- Completed / incomplete plots

**Later**

- Suggested walking route
- Turn-by-turn navigation

### 6.7 Calculations

**Must Have**

Support calculations required for the initial beta methodologies, including:

- TPA
- Basal area
- QMD
- Volume
- Volume / acre
- Product distribution
- Sampling error
- Confidence interval
- Timber value

All calculations must:

- Preserve formula / methodology
- Be reproducible
- Expose assumptions
- Distinguish measured vs. estimated values

### 6.8 QA

**Must Have**

- Missing required-field warnings
- Outlier detection
- Duplicate detection
- Basic statistical validation
- Sampling-error status

### 6.9 Timber Pricing & Valuation

**Must Have**

- Product-specific pricing
- Species-specific pricing
- User-overridable prices
- Price effective date
- Price source
- Value by stand
- Total timber value

### 6.10 Reporting

**Must Have**

- Professional PDF
- Editable narrative
- Maps
- Tables
- Branding
- Cruise methodology
- Sampling statistics
- Volume / value
- TimberForge Score

### 6.11 Predicted vs. Actual

**Must Have**

Store:

- Pre-cruise predicted values
- Actual cruise values
- Difference
- Percent error
- Confidence

This data should remain available for future model training and analytics where customer permissions allow.

**Constraint (added 2026-09-08).** "Where customer permissions allow" means
explicit per-organization opt-in, defaulting off — not acceptance of terms of
service. Training uses **derived features** (the relationship between remotely
observable inputs and measured outcomes), never tract-level inventory that can be
re-identified to a parcel or landowner. The forester's client owns the inventory;
a cruise is the basis for a stumpage negotiation, not neutral telemetry. See
[`../decisions/0006-cruise-data-rights.md`](../decisions/0006-cruise-data-rights.md).

---

## 7. TimberForge Score

### Purpose

Provide a standardized summary of the timber asset while keeping underlying forestry metrics transparent.

### Initial Score Dimensions

Potential dimensions:

- Timber Inventory
- Timber Value
- Stand Quality
- Harvest Readiness
- Logging Accessibility
- Mill Market Access
- Timber Risk
- Data Confidence

### Requirements

- Score range: 0–100
- Display total score + component scores
- Explain major score drivers
- Preserve underlying metrics
- Show confidence
- Do not present score as a substitute for professional judgment

**MVP Note:** Beta may begin with an experimental score before final weighting is locked.

---

## 8. Initial Cruise Methodologies

MVP should support the smallest set required by beta users.

Recommended starting point:

1. **Variable-radius / point sampling**
2. **Fixed-area plots**

Potential next:

- 100% tally
- Sample tree
- 3P
- Hybrid methods

Final MVP methods should be confirmed through cruiser interviews.

---

## 9. Data Model

Core hierarchy:

**Organization**
→ **User**
→ **Property**
→ **Parcel**
→ **Stand**
→ **Cruise**
→ **Stratum**
→ **Plot / Point**
→ **Tree**
→ **Product / Log**
→ **Measurement**
→ **Calculated Metrics**
→ **Value**
→ **TimberForge Score**
→ **Report**

Each important field should preserve:

- Source
- Timestamp
- User
- Method
- Confidence
- Predicted vs. measured status

---

## 10. Offline Requirements

Field functionality must operate without reliable cellular service.

Offline requirements:

- Download property before field visit
- Maps available offline
- Plot locations available offline
- Full tree / plot entry offline
- Photos stored locally
- Auto-save locally
- Sync when connectivity returns
- Conflict handling
- Visible sync status

Offline failure is considered a critical product failure.

---

## 11. UX Principles

- Designed for one-handed mobile use
- Large tap targets
- Minimal text entry
- Common values selectable in 1–2 taps
- Current plot always obvious
- Fast transition between trees
- No unnecessary screens
- Strong contrast outdoors
- Clear offline / sync state
- Undo recent action
- Never lose field data

---

## 12. Beta Requirements

### Prerequisite — validation comes first

Beta is **stage two**. Before it, run 15–20 interviews with consulting foresters
in VA/NC using [`../market/INTERVIEW_KIT.md`](../market/INTERVIEW_KIT.md). The
gate to proceed:

- Reconstructed cruise hours cluster in **preparation and reporting**, not field
  time. If the hours are dominated by field work and travel, the bottleneck is
  physical, software cannot fix it, and this PRD is aimed at the wrong part of
  the job.
- The "highest-value feature" answers **converge** on two or three things rather
  than scattering.
- **At least three foresters name a real tract and a date.** Stated willingness
  to pay does not count toward this; a calendar commitment does.

If nobody will name a tract, that is a clear and cheap answer, and the correct
response is to stop rather than to push through.

### Beta Size

Initial target:

**5–10 professional foresters / cruisers**, drawn from the interview cohort —
specifically the ones who committed a tract.

### Beta Process

Each participant should:

1. Add a real upcoming property.
2. Review TimberForge pre-cruise assessment.
3. Configure a cruise.
4. Use TimberForge during the field cruise.
5. Compare results against existing tools/process.
6. Generate a TimberForge report.
7. Review prediction accuracy.
8. Provide structured feedback.

### Beta Success Metrics

- Cruise setup time
- Time per plot
- Total field-entry time
- Office/reporting time saved
- Calculation accuracy
- Pre-cruise prediction error
- Offline reliability
- Data-loss incidents
- Report usefulness
- User satisfaction
- Willingness to switch
- Willingness to pay
- Repeat usage

---

## 13. Competitive Requirements

TimberForge must meet basic expectations established by competitors such as Forest Metrix and newer tools.

### Table Stakes

- Offline cruising
- GPS
- Fast tree entry
- Common cruise methods
- Sampling calculations
- Volume calculations
- Professional reporting

### TimberForge Differentiators

- Pre-cruise parcel intelligence
- Remote stand analysis
- Preliminary timber estimate
- Cruise-planning assistance
- Real-time QA
- Predicted-vs-actual comparison
- TimberForge Score
- Long-term timber intelligence dataset

---

## 14. Technical Principles

- Mobile-first
- Offline-first
- Cloud synchronization
- API-first backend
- Configurable species / products
- Auditable calculation engine
- Versioned calculation methodologies
- GIS-capable architecture
- Data provenance
- Role-based security
- Scalable to multi-user organizations
- Future-ready for LandForge API integration

---

## 15. AI Requirements

AI may assist with:

- Pre-cruise summaries
- Stand suggestions
- Cruise recommendations
- QA / anomaly detection
- Predicted-vs-actual explanations
- Report drafting
- Client summaries

AI must **not silently invent**:

- Measurements
- Species
- Grade
- Defect
- Volume
- Sampling statistics
- Timber prices

AI-generated content must remain reviewable and editable.

---

## 16. Data & Privacy Requirements

TimberForge must define:

- Customer ownership of cruise data
- TimberForge rights to use anonymized / aggregated data
- Opt-in / opt-out rules
- Organization-level privacy
- Data export
- Data deletion
- Security controls

This must be addressed before large-scale beta expansion.

---

## 17. Key Open Decisions

Before development is finalized:

- Initial launch geography
- Exact beta cruise methods
- Species / product configuration
- Volume equations
- Log rules
- Pricing data source
- GIS / imagery providers
- LiDAR strategy
- TimberForge Score formula
- Score weights
- Report template
- Mobile technology
- Pricing model
- Beta incentive
- Data-use terms

---

## 18. Recommended Build Sequence

### Phase 0 — Validation
- 10–20 cruiser interviews
- Competitor benchmark
- Workflow mapping
- Validate MVP cruise methods

### Phase 1 — Prototype
- Property setup
- Pre-cruise assessment
- Stand editor
- Cruise setup
- Mobile field workflow
- Report prototype

### Phase 2 — Functional Alpha
- Offline field collection
- Calculation engine
- QA
- Pricing / valuation
- Report generation

### Phase 3 — Beta
- 5–10 cruisers
- Real properties
- Parallel validation against existing workflows
- Predicted-vs-actual collection

### Phase 4 — Commercial MVP
- Resolve beta issues
- Finalize pricing
- Improve reporting
- Improve pre-cruise intelligence
- Launch initial TimberForge Score

---

## 19. MVP Success Definition

TimberForge MVP is successful if professional cruisers can:

> **Select a property → understand it before visiting → configure the cruise → collect data reliably offline → calculate professional results → value the timber → create a client-ready report → review a TimberForge Score**

while materially reducing workflow time compared with their current process.

---

## 20. Product Vision

> **TimberForge is the professional timber intelligence platform that connects remote property analysis with real-world timber cruising to help foresters assess, cruise, value, and score timber assets.**
