# Design brief — TimberForge Phase 1 walkthrough

Paste the section below into Claude Design (or any design tool) to produce the
interview mockup. Everything it needs is here: the screens, the real content,
the brand palette, and the numbers.

A working HTML version already exists at `index.html` in this folder — open it
in a browser to see the flow and the interactions. Use it as the reference for
*what goes where*; the design tool's job is to make it look better.

**One rule that matters more than the visuals:** the numbers below are
deliberate. They were checked so a forester wouldn't dismiss them — 42 plots
for a 186-acre tract at 10% sampling error is credible; 210 plots is not. Don't
let a design pass round them off or invent new ones.

---

## Paste this

I need a clickable, realistic mockup of a web app called **TimberForge**, for
showing to professional foresters in interviews. Desktop layout, viewed on a
laptop. It should look like working software, not a wireframe.

**What the product does:** before a forester drives out to measure timber on a
property, TimberForge assembles everything already knowable about that land —
boundaries, imagery, forest cover, terrain, wetlands, access, soils, nearby
mills, timber prices — and turns it into a designed cruise with plot locations.
The tagline is *Know More Before You Go*. Today foresters do this by hand across
several GIS tools and spreadsheets.

**Brand:** forest and earth tones, restrained, green dominant, brown only as an
accent. Deep Forest `#0F3328` (headers, wordmark), Evergreen `#345B45`
(buttons, active states), Moss `#71885D` (supporting UI), Timber Brown `#8B6843`
(accent only), Warm Sand `#D9CFBD`, Warm Off-White `#F7F5EF` (page background),
Charcoal `#242927` (text). Modern geometric sans — Inter or Manrope. Technical
and precise, not rustic. No wood textures, no outdoorsy script fonts. The
wordmark is TIMBERFORGE, one word, with TIMBER bolder than FORGE.

**Seven screens, with a clickable step bar across the top:**

1. **Find parcel.** Search field pre-filled with "4180 Rockfish River Rd, Nelson
   County, VA". One match: Parcel 41-A-12, 186.4 acres. A simple map showing the
   parcel outline. Button: Create property.

2. **Assembling.** A checklist that ticks through, one item every quarter second,
   conveying that this is automatic: parcel boundary, 2025 imagery, canopy height,
   elevation and slope, wetlands, streams, soils, road network, mills within 75
   miles, regional stumpage prices, stand delineation, volume estimate.

3. **Property overview** — the most important screen. Header: Rockfish Creek
   Tract, 186.4 acres, Nelson County VA. Four summary figures: 186.4 total acres;
   171.2 forested (92%); 1,840 MBF estimated merchantable volume (Doyle, ±35%,
   marked low confidence); $213K estimated stumpage (low confidence). Then a map
   showing three coloured forest stands, a creek with its buffer, contour lines
   and road frontage. Alongside it, operating conditions — terrain moderate with
   82% favourable, mean slope 11% (max 28%), wetlands 6.7 ac / 3.6%, streams
   3,900 ft with 14.2 ac buffer, road frontage 2,140 ft, one old woods road, two
   candidate deck sites, site index 72, Hayesville–Cecil soils. And a markets
   panel: Buckingham Lumber 31 mi (pine sawtimber), James River Fiber 44 mi
   (pulpwood), Piedmont Hardwoods 52 mi (hardwood grade); pine sawtimber
   $26.40/ton, pine pulpwood $11.20/ton, hardwood grade $34.10/ton.

   **Every single figure carries a confidence badge — High, Medium or Low — and
   a one-line source.** This is the most important design element on the screen,
   not decoration. The product's credibility with foresters rests on never
   presenting an estimate as a measurement.

4. **Stands.** Map with three delineated stands, and a table: A, loblolly pine,
   62.8 ac, est. 24 yr, high confidence; B, mixed hardwood, 51.4 ac, est. 55 yr,
   medium; C, pine–hardwood, 57.0 ac, est. 38 yr, medium. Clicking a row
   highlights it on the map. Below, likely species for stand A: loblolly pine
   78%, sweetgum 9%, yellow-poplar 7%, red maple 6%. An "Edit boundaries" button
   — these are a starting point, not an answer.

5. **Cruise design.** Choice of variable-radius point sampling (BAF 10) or
   fixed-area 1/10-acre plots. A slider for target sampling error, default 10% at
   95% confidence, range 5–20%. It calculates the plot count live: **at 10% it
   must show 42 points** — 14 in stand A at 440 ft spacing, 15 in B at 385 ft, 13
   in C at 435 ft — with estimated field time 1.5 days and 6.2 miles of walking.
   Plots scale with 1 over error squared, so 5% gives about 168 plots and six
   days, and 20% gives about 18. Fixed-area needs roughly 25% more plots than
   variable-radius for the same precision. That trade-off is the whole point of
   the screen; a forester should be able to feel it move.

6. **Plot layout.** The stand map with 42 plot points on a systematic grid with
   a random start, kept out of the stream buffer, joined by a dashed walking
   route. A "before you go" checklist — basemap cached offline, coordinates
   loaded, Virginia Piedmont species list, Doyle log rule and BAF 10 prism,
   stream buffers marked no-plot — and a "Download to phone" button with the note
   that it works with no signal.

7. **Ready to cruise.** Summary: 186.4 acres, 3 stands, 42 points, prep time
   about 9 minutes. Then a predicted-versus-measured table with the measured
   column empty and marked pending — basal area 118 ft²/ac predicted, merch
   volume 14.2 MBF/ac, dominant species loblolly 78% — to show that field results
   will be compared against these estimates and improve the next property's.

**Two things to keep:** a small "Concept · sample data" chip in the header
throughout, and a closing note on screen 7 saying this is a concept, the numbers
are invented, and the point of showing it is to find out where it's wrong.

**Tone of the writing:** plain, specific, unsalesy. Foresters are technical
professionals who are pitched constantly. No marketing adjectives, no
exclamation marks. Say what a number is and where it came from.
