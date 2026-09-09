# Forestry directory counts — Virginia & North Carolina

**Compiled:** 2026-09-08. Counted directly from public state and association
forestry directories. These are the load-bearing population numbers behind the
market sizing in [`BUSINESS_CASE.md`](BUSINESS_CASE.md).

> **On what is and isn't published here.** This file carries the *aggregate
> counts* only. The named-practitioner contact list compiled alongside it is kept
> out of this repository deliberately: every entry is individually public in a
> state directory, but a consolidated, downloadable contact file is a different
> artifact from those listings, and consulting forestry is a small enough
> community that publishing one would be a poor first impression. It lives
> locally as `docs/market/OUTREACH_LIST.local.md` and is gitignored.
>
> The Association of Consulting Foresters directory was deliberately not used as
> a source at all — its use policy forbids generating contact lists for
> commercial purposes. ACF membership appears below only where a *state* agency
> independently reports it.

---

## 1. Directory counts

These are the load-bearing numbers for the market-size estimate. Each is marked `verified` (I reached the page and counted the entries myself) or `unknown` (not obtainable).

**Finding 1 — N.C. Forest Service statewide consulting forester list: 187 entries. `verified`**
Counted directly from the statewide PDF, revised 06-Apr-2026, 20 pages. 187 distinct forester records (one "NC Reg. #" block each).
Source: [NCFS Statewide List of Consulting Foresters (PDF)](https://www.ncagr.gov/divisions/nc-forest-service/NCFS-ConsultingForesters_Statewide.pdf/download?attachment), linked from [NCFS Consulting Foresters](https://www.ncagr.gov/divisions/nc-forest-service/managing-your-forest/consulting-foresters).

**Finding 2 — Of those 187, the number with a North Carolina mailing address: 147. `verified`**
Breakdown by the state in each listing's address: NC 147, SC 21, VA 12, GA 4, TN 1, IN 1, WV 1. The out-of-state entries are consultants licensed in NC who work across the border.
Source: same PDF as Finding 1.

**Finding 3 — Full-time vs part-time consultants in the NC list: 169 full-time (FTC), 13 part-time (PTC), 5 unmarked. `verified`**
NCFS defines FTC as spending 75%+ of time on consulting. This matters: the addressable "this is my actual job" population in NC is ~169, not 187.
Source: same PDF as Finding 1.

**Finding 4 — Association memberships self-reported inside the NC list: 38 ACF, 88 SAF, 90 with no organization listed. `verified`**
Of the 38 ACF, 29 also list SAF and 29 hold NC addresses. Note this is ACF membership as reported to a *state* agency, not scraped from ACF.
Source: same PDF as Finding 1.

**Finding 5 — Virginia DOF Private Consulting Forester Directory: 75 listings, 72 distinct business names. `verified`**
Counted from the directory's own "view all" page. The gap is repeat entries — American Forest Management appears 4 times (separate offices), and GFR, Three Rivers, Southern Land & Timber and William H. Lock each appear twice.
Source: [VDOF Private Consulting Forester Directory — view all](https://dof.virginia.gov/forest-management-health/landowner-assistance/find-a-forester/private-forestry-consultant-directory/view/all/).
**Caveat:** this directory is self-registration ("Businesses register to appear in this directory. DOF does not endorse these businesses"), so it undercounts VA consultants who never signed up. It is a floor, not a census.

**Finding 6 — Virginia Forestry Association member directory, Consulting Forester category: 31 listings. `verified`**
The count is printed on the category page itself. Firm-level listings, mostly without an individual's name; a few are VA-adjacent (NC, WV). Useful as a cross-check on Finding 5, not as an independent population.
Source: [VFA Association Directory — Consulting Forester](https://vfa.myassociationdirectory.com/places/category/consulting-forester/).

**Finding 7 — ACF national membership: approximately 750 members across 40 states. `verified` (as a published figure, not a count I performed)**
This is ACF's own published self-description and it corroborates the existing 750-member assumption behind the 2,000–5,000 US-wide estimate. I could not independently count it, and I could not obtain a VA-only or NC-only ACF chapter count.
Source: [ACF LinkedIn company profile](https://www.linkedin.com/company/the-association-of-consulting-foresters); ACF's own site describes the directory but does not publish a member count.

**Finding 8 — ACF member count for Virginia specifically: `unknown`. ACF member count for North Carolina specifically: `unknown`.**
The ACF Find-a-Forester search is a client-side JavaScript application; the server returns only a "Loading…" shell, so no count is available without running the app, and its use policy bars list generation anyway. The nearest available proxy is Finding 4: 29 NC-addressed foresters in the state list self-report ACF membership.
Sources: [ACF Find a Forester Search](https://www.acf-foresters.org/find-a-forester-search), [ACF Use Policy](https://www.acf-foresters.org/use-policy).

**Finding 9 — Total NC Registered Foresters on the state licensing board's roll: `unknown`.**
The NC Board of Registration for Foresters does not publish a licensee count on its site or on the State Auditor's board page. This would be the cleanest denominator for NC (registration is legally required to call yourself a consulting forester under NC G.S. 89B-2) and is worth a phone call to the board at (919) 847-5441 if the number matters.
Sources: [NCBRF](https://www.ncbrf.nc.gov/), [NC Auditor — Board page](https://www.auditor.nc.gov/divisionoffice/nc-board-registration-foresters).

### What these counts imply

Two of the three largest timber states in the Southeast publish rosters totalling roughly **147 NC-based + ~72 VA businesses**, of which only ~169 NC entries are full-time. If VA and NC — both heavily forested, high-harvest states — together support somewhere in the low hundreds of full-time consulting practices, a national total in the **2,000–5,000** range is consistent, and the lower half of that range looks more defensible than the upper. Finding 7 (ACF ≈750) is unchanged from the existing estimate.

---


---

## 3. Could not reach

| Source | What happened | Workaround used |
|---|---|---|
| **ACF member directory (acf-foresters.org)** | Reachable, but the Find-a-Forester search renders entirely client-side — `web_fetch` returns a page whose results area is just "Loading…". No member records and no VA/NC counts are available from the served HTML. Separately, the [ACF Use Policy](https://www.acf-foresters.org/use-policy) forbids using the directory to generate contact lists, so I did not pursue it further. | ACF membership captured indirectly from the NCFS and VDOF directories, which record it as a self-reported credential. |
| **ACF VA / NC chapter member counts** | Not published anywhere I could reach. | Reported as `unknown` (Finding 8). |
| **NC Board of Registration for Foresters — licensee count** | Site and the NC State Auditor board page carry no roster size. | Reported as `unknown` (Finding 9); board phone number noted for a human follow-up. |
| **`ncforestry.org` Consulting Forester List (PDF)** | Fetched, but the server returned it as `application/octet-stream` and the content came back as unparsed binary. | Superseded by the NCFS statewide PDF, which is more current (06-Apr-2026) and parsed cleanly. |
| **VDOF `print-directory-results` export endpoint** | Returned an empty body to a plain GET (it expects search parameters from the page's form). | Used the directory's own `view/all` page plus individual listing pages instead. |
| **SAF Virginia / North Carolina chapter rosters** | Not pursued — SAF is a general forestry society, and the NCFS and VDOF directories already record SAF membership per individual, which is the part relevant here. | SAF flags taken from the state directories. |

**Note on dof.virginia.gov:** a previous environment reported this domain as unreachable. **It was reachable in this run** — the directory index, the `view/all` listing and all 40 individual listing pages fetched normally. If it fails again, the block is intermittent rather than permanent.

---

