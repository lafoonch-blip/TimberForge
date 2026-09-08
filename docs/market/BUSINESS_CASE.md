# TimberForge business case

**Date:** 2026-09-08 · **Status:** pre-validation · **Chosen first segment:** independent consulting foresters

This revises an earlier market analysis. That analysis got the strategy right and
the arithmetic wrong, in one specific and consequential way: it used a
denominator for *all* forestry professionals while recommending a *consulting
forester* go-to-market. Those differ by roughly an order of magnitude.

Every number below is tagged. **Verified** means checked against a named source
on 2026-09-08. **Modeled** means I constructed it and it is only as good as its
assumptions. **Unknown** means nobody has the number, including the people who
publish confident-looking versions of it.

---

## 1. The correction that matters

The prior analysis proposed 15,000–30,000 addressable US professional users and
called 2,500 paying users a "solid niche business" producing ~$3M ARR.

The Association of Consulting Foresters has **approximately 750 members across
40 states** (**verified**). ACF is credential-gated, so practicing consultants
certainly outnumber members — but not by a factor of twenty. Census counted
about **2,023 employer establishments in NAICS 115310** (Support Activities for
Forestry, 2023), and that code also contains reforestation contractors, forest
firefighting, and logging support, so only a fraction are cruising consultancies.

Reconciling those, the practicing US consulting forester population is plausibly
**2,000–5,000 individuals** (**modeled**, from ACF membership as an assumed
15–35% of practitioners). No authoritative national count exists (**unknown** —
I looked; state directories are the only real enumeration).

That reframes the prior model's scenarios:

| Scenario | Users | Share of the *entire* consulting segment |
|---|---|---|
| Prior "conservative" | 500 | 10–25% |
| Prior "solid niche business" | 2,500 | **50–125%** |
| Prior "strong platform" | 5,000 | **100–250%** |

The middle row is not a base case. It is a scenario in which TimberForge is
installed on the device of every consulting forester in America, and Forest
Metrix — a mature product with real customers — has none. The bottom row is
arithmetically impossible within this segment.

**The consulting forester segment cannot produce $3M ARR at any realistic
penetration.** Whole-segment revenue at 100% capture is `2,000–5,000 ×
$1,000–1,500` = **$2M–$7.5M**, across all vendors. A strong new entrant taking
5–15% over five years lands at **100–750 users, or roughly $120K–$900K ARR**
(**modeled**).

## 2. What that implies

Not that the segment is wrong — it is the right first customer, for reasons in
§4. But it changes what the segment *is for*.

**Consulting foresters are a wedge, not a market.** They are reachable without a
sales team, they cruise constantly, and they generate exactly the
predicted-vs-actual data the Intelligence business needs. What they cannot do is
carry the business on subscription revenue. Planning as though they will is the
error that would waste the next two years.

So the honest framing of the bet: spend the wedge phase proving the workflow and
accumulating ground truth, with subscription revenue covering costs rather than
constituting the outcome. The outcome, if there is one, is in §5.

## 3. Verified competitive anchors

**Forest Metrix: $1,000/year (Pro), $1,500/year (Pro Plus)** (**verified**).
This is the most useful number available. A professional forester demonstrably
pays four figures annually for cruise software, which validates the
$79–$149/month range the prior analysis proposed. Do not price below this
without a reason — undercutting an incumbent in a small professional market
signals inferiority more often than it wins deals.

**CruiseComp claims "over 90% of the British Columbia forest industry"**
(**verified as a claim**, on cruisecomp.ca — it is vendor marketing, not an
independent measurement, and should be cited that way).

More important, and missed by the prior analysis: **CruiseComp already ships the
field layer.** Their stack is Cruiser Tablet (field collection) → CruiseComp
compilation → Interior Appraisal (stumpage). The recommendation to enter BC as
"the modern field layer that exports into CruiseComp" therefore proposes
competing with CruiseComp's own handheld for the right to feed CruiseComp's
compiler. That is a worse position than the analysis suggests. **Canada should
come off the roadmap entirely for now**, not sit at Phase 4.

**Southern stumpage, Q4 2025** (**verified**, TimberMart-South via Southern Ag
Today): pine sawtimber $23.23/ton, down ~6% YoY and ~10% from the early-2022
peak. Pine pulpwood $5.96/ton, down 22% YoY and 46% from peak.

But the regional spread is the actionable part, and it favors the launch plan:
sawtimber runs $17–21/ton in TN, SC and AL versus **over $30/ton in NC and FL**,
and pulpwood runs under $4/ton in AR, LA, TN and E. TX versus **$9–14/ton in
Virginia, eastern NC, south GA and north-central FL** (**verified**).

Virginia and North Carolina sit in the strongest band in the South on both
products. The VA/NC launch is therefore defensible on market grounds, not just
on proximity — worth knowing, because "I live here" is a weak reason that
happens to coincide with a strong one.

## 4. Why consulting foresters remain the right wedge

One property of this segment is genuinely unusual and worth building the
go-to-market around: **you can enumerate your entire market by name.**

State forestry agencies publish consulting forester directories — Virginia DOF
maintains one with a view-all listing, as do West Virginia, South Carolina and
Maine (**verified** that the directories exist; I could not retrieve the Virginia
listing directly, as the domain is blocked from this environment, so the count is
**unknown** until someone opens it).

Most companies cannot list their addressable market. You can, in an afternoon.
That means no paid acquisition, direct outreach as the primary channel,
precisely measurable penetration, and — for validation — a sample of 20
interviews representing something like 0.5–1% of the entire national segment,
which is a real sample rather than anecdote.

It also means the reverse: this community is small and highly networked, which
is why §6 is not optional.

## 5. Where the actual upside is, and what it costs

The prior analysis is right that the ground-truth dataset is the larger prize.
Two corrections to how it scores that.

**The dataset is a defensive asset, not an acquisition asset.** You need users
before you have data, so it cannot help solve the cold-start problem. Scoring
"defensibility after ground-truth dataset: 9/10" assumes away the hard part —
getting to enough users to have a dataset at all.

**The dataset is regional.** Ten thousand stands collected in Virginia and North
Carolina are ten thousand loblolly stands, which teach you very little about
Douglas-fir or northern hardwoods. The moat rebuilds from near zero in each new
region, which compounds the fragmentation problem rather than escaping it.

Volume sanity check (**modeled**): a working consultant runs perhaps 20–50
cruises a year at 2–5 strata each, so roughly 50–150 stands per user-year. Ten
thousand stands is therefore about 100 user-years — reachable in a year at 100
users, or five years at 20. The binding constraint is users, not time.

## 6. The risk the prior analysis missed entirely

Consulting foresters do not own the cruise data they produce. They generate it
under contract for a landowner, and a timber inventory is the direct basis for a
stumpage negotiation.

TimberForge Intelligence, as proposed, sells to TIMOs, REITs, timber buyers and
procurement foresters — the parties **on the other side of that negotiation**.
The plan therefore aggregates data produced by group A, about group A's clients,
into a product sold to group B, who negotiate against them.

Foresters will work this out. In a segment of a few thousand people who mostly
know each other, one forester concluding that TimberForge monetizes their
clients' inventories against them is a distribution event, not an isolated
complaint. It also attaches to LandForge, since the two share an owner.

This is solvable, and cheaply, *before* the first customer — see
[`../decisions/0006-cruise-data-rights.md`](../decisions/0006-cruise-data-rights.md).
It is not solvable afterward, because it is a trust problem.

## 7. What weak timber prices actually do

The prior analysis argues falling prices increase demand for efficiency. Half
right, and the other half cuts the other way: **consulting foresters are often
paid a percentage of the timber sale**, so falling stumpage means falling
forester income, which means *more* software price sensitivity, not less.

The question that actually predicts revenue is not price but **cruise volume, by
purpose**. Timber-sale cruises track harvest activity and should be soft where
mills closed. Appraisal, estate, tax-basis and acquisition cruises track
transactions and land values, and are far less correlated with stumpage.

This is directly answerable in interviews (§ INTERVIEW_KIT Q4) and it is the
single most useful thing the interviews can establish.

## 8. Revised scorecard

| Dimension | Prior | Revised | Why |
|---|---|---|---|
| Market need | 8/10 | 7/10 | Real, but unproven until interviews |
| Competition | 7/10 | 7/10 | No US monopoly — holds up |
| Segment size | 6/10 | **3/10** | Consulting segment is ~$2–7.5M total, not $20M+ |
| SaaS economics | 8/10 | 8/10 | $1,000–1,500/yr precedent verified |
| Expansion potential | 9/10 | 8/10 | Real, but gated on solving §6 |
| Defensibility today | 4/10 | 4/10 | Holds up |
| Defensibility w/ dataset | 9/10 | 6/10 | Defensive not offensive; regional not national |
| Distribution | not scored | **9/10** | Enumerable market — an unusual advantage |

**Overall: proceed, with the goal restated.** Not "build a cruising SaaS
business," which the arithmetic does not support. Rather: use an enumerable,
reachable segment to prove a workflow and accumulate regional ground truth,
while keeping the data-rights position clean enough that the Intelligence
business remains available.

## 9. The decision gate

Before significant further development, the target is not a revenue number. It
is:

**Ten to twenty working consulting foresters in VA/NC confirm that TimberForge
prepares, guides and reports a cruise faster than their current workflow — and
at least three commit money or a scheduled pilot on a real tract.**

Stated willingness-to-pay does not count. Professionals are polite. A calendar
date on a real tract counts.

If that fails, the correct response is to stop, and the cost of finding out is a
few weeks rather than a year.

---

## Sources

- [Forest Metrix pricing — Capterra](https://www.capterra.com/p/221156/Forest-Metrix/pricing/)
- [Forest Metrix](https://forestmetrix.com/)
- [CruiseComp](https://www.cruisecomp.ca/) · [Cruiser Desktop](https://www.cruisecomp.ca/cruiserdesktop/) · [Cruiser Tablet](https://www.cruisecomp.ca/cruiser/)
- [BC Cruise Compilation Manual](https://www2.gov.bc.ca/gov/content/industry/forestry/competitive-forest-industry/timber-pricing/timber-cruising/cruise-compilation-manual)
- [Pine Sawtimber Prices Soften as Pine Pulpwood Continues to Fall — Southern Ag Today, Jan 2026](https://southernagtoday.org/2026/01/26/pine-sawtimber-prices-soften-as-pine-pulpwood-continues-to-fall/)
- [TimberMart-South state stumpage prices](https://timbermart-south.com/resources/state-stumpage-prices/)
- [Association of Consulting Foresters — membership](https://www.acf-foresters.org/membership)
- [Virginia DOF Private Consulting Forester Directory](https://dof.virginia.gov/forest-management-health/landowner-assistance/find-a-forester/private-forestry-consultant-directory/view/all/)
- [West Virginia consulting forester list (PDF)](https://wvforestry.com/pdf/Private_Consulting_Foresters.pdf)
