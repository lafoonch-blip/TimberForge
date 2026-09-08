# Forester interview kit

**Target:** 15–20 independent consulting foresters in Virginia and North Carolina.
**Purpose:** decide whether to keep building. See
[`BUSINESS_CASE.md` §9](BUSINESS_CASE.md#9-the-decision-gate) for the gate.

Twenty interviews is roughly 0.5–1% of the entire US consulting forester
population. That is an unusually strong sample for this kind of research, and it
is worth running properly rather than as a formality.

---

## Before you start: the two failure modes

**Interviews that confirm what you already believe.** You built this. You will
want them to like it. The single most useful discipline is to spend the first
half of every conversation on their current workflow and say nothing about
TimberForge — once you demo, everything after is contaminated by politeness.

**Mistaking enthusiasm for demand.** "That's really neat" is not a signal. Every
question below is designed to produce either a number or a commitment, because
those are the only two things that survive contact with a calendar.

## Recruiting

State agencies publish consulting forester directories — Virginia DOF has a
view-all listing, and West Virginia publishes a PDF. Start there; it is close to
a complete enumeration of your launch market. Known VA firms from the directory
include F&W Forestry Services, H&H Forest Management, Morgan Forestry
Consultants, Ridgeline Forestry, Rock Springs Forestry, and Southern Land &
Timber Consultants.

Before cold outreach, check your existing LandForge users. A warm introduction
from someone who already pays you converts far better, and those users may
themselves cruise or hire cruisers.

Ask for 30 minutes. Offer no compensation initially — willingness to spend 30
unpaid minutes is itself a weak demand signal, and paying removes it.

**Say:** *"I'm building software for timber cruising and I'm trying to understand
how the work actually gets done before I build any more of it. I'm not selling
anything — I'd like 30 minutes to hear how you run a cruise."*

That is true, which is why it works.

---

## Part 1 — Their world (12 min, no product talk)

**Q1. Walk me through the last cruise you finished. Start from how it came to
you.**

Open-ended, then shut up. Let them ramble; the digressions are the data. You are
listening for where the work actually is, which is frequently not where you
assume.

**Q2. Reconstruct that cruise hour by hour with me.**

This is the most important question in the kit. Do not accept "about a week."
Walk the stages and write down hours for each:

| Stage | Hours | Tool used |
|---|---|---|
| Getting parcel info, deed, boundaries | | |
| Aerials / GIS / stand delineation | | |
| Designing the cruise, plot layout | | |
| Travel to and from the tract | | |
| Field time (actual tallying) | | |
| Data transfer off the device | | |
| Compilation and calculation | | |
| Checking for errors / re-cruising | | |
| Pricing and valuation | | |
| Writing the client report | | |

**Why this matters:** the prior market analysis, and most cruise software,
assumes the bottleneck is field tallying. If the hours cluster in preparation and
reporting instead, that confirms the TimberForge thesis. If they cluster in the
field, the thesis is wrong and you should know that in week two rather than
month twelve. **This table is the single most valuable artifact of the whole
exercise.**

**Q3. What do you use now, and what does it cost you?**

Forest Metrix, MobileMap, FScruiser, SuperACE, Excel, paper, something custom?
Get the actual annual figure. Compare against the verified anchors: Forest
Metrix is $1,000/yr Pro, $1,500/yr Pro Plus.

Then: **what do you dislike about it?** And critically — **have you ever tried
to switch? What happened?** A history of failed switching attempts tells you far
more about switching costs than any hypothetical.

**Q4. How has your cruise volume changed over the last two years — and has the
mix changed?**

Break it out: timber sale cruises, appraisal, estate/tax basis, acquisition due
diligence, management planning. Southern pine sawtimber was $23.23/ton in Q4
2025, down ~6% YoY, and pulpwood was down 46% from its 2022 peak. The hypothesis
is that sale cruises softened while appraisal and estate work held up. If true,
that shapes who TimberForge is for and how it should be sold. If false, the
revenue outlook is worse than modeled.

**Q5. How do you charge — per acre, per day, percentage of sale?**

If they are paid a percentage of the sale, weak stumpage is cutting their income
directly, and their software price sensitivity is currently high. Note it; it
changes what they will say in Part 3.

**Q6. What goes wrong on a cruise?**

Listen for: bad plot locations, a cruiser tallying the wrong stand, transcription
errors, discovering a problem after leaving the tract, statistics that don't hold
up, a client disputing the numbers. Every one of these is a QA feature with
evidence behind it.

---

## Part 2 — The workflow (10 min)

Now show it. Walk the sequence: parcel in → property, stands, terrain, mills,
estimated inventory → generated plot design → field collection with live QA →
compiled valuation → client report.

Do not pitch. Narrate and stop talking often.

**Q7. Where does this fit, or not fit, into how you actually work?**

**Q8. Which single part of that would save you the most time?**

Force a ranking, one answer. Aggregate across all interviews — if the answers
scatter across ten features, there is no wedge and the product is a vitamin.

**Q9. What did I get wrong?**

Ask it plainly and let it be uncomfortable. Foresters will tell you, and the
domain is deep enough that you are certainly wrong about something. This
question surfaces the regional and methodological assumptions you cannot see
from inside.

**Q10. What's missing that would stop you using this on a real job tomorrow?**

Listen specifically for: a cruise method you don't support, a report format their
clients require, defect and cull handling, a specific log rule, or an export
their mill or client demands.

---

## Part 3 — Commitment (8 min)

**Q11. Is there anything here you'd change software for?**

The yes/no question. A hedge is a no.

**Q12. What would have to be true for you to use this on your next paying job?**

Their answer is your actual roadmap.

**Q13 — the real one. I'm looking for a few foresters to run this on a real
tract this fall. Would you be one of them? Which tract, and when?**

Do not ask what they would pay. Stated WTP from a polite professional is close
to worthless. Ask for a **tract and a date**. Put it in the calendar on the call.

If they say yes but won't name a tract, that is a no. Record it as a no.

**Q14. If it saved you the hours we talked about in Q2, what would that be worth
against the $1,000–1,500/year you're already spending?**

Ask this *last*, and only after the commitment question, so it cannot anchor the
answer. Their own Q2 hours are the frame — this is arithmetic about their time,
not a pricing survey.

---

## Scoring sheet

One row per interview. Fill it in within an hour of the call, while you still
remember tone.

| Field | Capture |
|---|---|
| Name / firm / county | |
| Years practicing | |
| Cruises per year | |
| Typical tract size | |
| Current software + annual cost | |
| Ever tried to switch? Outcome? | |
| **Total hours per cruise (Q2)** | |
| **Hours in prep + reporting vs field** | |
| Volume trend, and mix shift | |
| Fee basis (per acre / day / % of sale) | |
| Top time sink, their words | |
| Single highest-value feature (Q8) | |
| What I got wrong (Q9) | |
| Blocker to real use (Q10) | |
| **Would switch? Y / N / hedge** | |
| **Pilot: tract named + date booked?** | |
| Value vs current spend (Q14) | |
| Verbatim quote worth keeping | |

## Reading the results

**Proceed** if the hours in Q2 cluster in preparation and reporting rather than
field time; if Q8 converges on two or three features rather than scattering; and
if **at least three foresters name a tract and a date**.

**Reconsider** if the hours are dominated by field time and travel. That would
mean the bottleneck is physical, software cannot fix it, and the TimberForge
thesis is aimed at the wrong part of the job.

**Stop, or pivot the segment** if nobody will name a tract. Twenty polite
conversations with zero commitments is not a discouraging result to be pushed
through — it is a clear answer, arriving cheaply, which is the entire point of
doing this before building further.

One caution on interpretation: consulting foresters are a small, highly
networked community. Early conversations will shape your reputation in it before
you have a product. Turning up genuinely curious and not selling is both the
better research method and the better first impression.

---

## Sources

- [Forest Metrix pricing — Capterra](https://www.capterra.com/p/221156/Forest-Metrix/pricing/)
- [Virginia DOF Private Consulting Forester Directory](https://dof.virginia.gov/forest-management-health/landowner-assistance/find-a-forester/private-forestry-consultant-directory/view/all/)
- [West Virginia consulting forester list (PDF)](https://wvforestry.com/pdf/Private_Consulting_Foresters.pdf)
- [Pine Sawtimber Prices Soften as Pine Pulpwood Continues to Fall — Southern Ag Today](https://southernagtoday.org/2026/01/26/pine-sawtimber-prices-soften-as-pine-pulpwood-continues-to-fall/)
