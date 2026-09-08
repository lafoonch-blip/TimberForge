/**
 * The LandForge bridge.
 *
 * The most important test in this file is the sentinel-collision one. It is an
 * executable statement of a bug in a system this repository does not own, kept
 * here so the bug cannot be forgotten and so the day LandForge is fixed, the
 * test tells us.
 */

import { describe, expect, it } from 'vitest';
import {
  compileCruise,
  getRegion,
  type PlotRecord,
  type StandRecord,
  type TreeRecord,
} from '@timberforge/forestry-core';
import {
  ADAPTER_VERIFIED,
  assessInventoryTier,
  collidesWithSentinel,
  detectSentinelCollisions,
  ENGINE_FIELD_MAPPINGS,
  forecastImpact,
  harvestResellConfidence,
  LF_ASSUMPTIONS,
  millScore,
  projectCruiseToLandForge,
  timberReservePenaltyPct,
  toLandForgeInput,
  weakerOf,
  type StumpagePricing,
} from '@timberforge/landforge-contract';

const region = getRegion('us_south');

function buildCruise(opts: { plots?: number; dbh?: number; acres?: number } = {}) {
  const plotCount = opts.plots ?? 6;
  const acres = opts.acres ?? 80;
  const stands: StandRecord[] = [{ id: 's1', name: 'Stand 1', acres }];
  const plots: PlotRecord[] = [];
  const trees: TreeRecord[] = [];
  for (let i = 1; i <= plotCount; i++) {
    plots.push({
      id: `p${i}`,
      standId: 's1',
      number: i,
      method: 'variable_radius',
      baf: 10,
    });
    // Slight variation between plots so a real sampling error exists.
    for (let j = 0; j < 3; j++) {
      trees.push({
        id: `t${i}_${j}`,
        plotId: `p${i}`,
        species: 'LP',
        dbh: (opts.dbh ?? 14) + (i % 3) - 1 + j * 0.5,
        merchHeight: 2,
        merchHeightUnit: 'logs',
        product: 'sawtimber',
        defectPct: 5,
      });
    }
  }
  return compileCruise({ stands, plots, trees, region, confidence: 0.95 });
}

const pricing: StumpagePricing = {
  sawtimberPerMbf: 380,
  provenance: 'estimated',
  source: 'TimberMart-South 2026Q2, illustrative',
};

describe('mirrored assumptions', () => {
  it('carries the four LandForge modeled defaults', () => {
    expect(LF_ASSUMPTIONS.defaultStandAge).toBe(24);
    expect(LF_ASSUMPTIONS.defaultMbfPerAcre).toBe(4.5);
    expect(LF_ASSUMPTIONS.defaultMillDistanceMi).toBe(45);
    expect(LF_ASSUMPTIONS.defaultSiteIndex).toBe(70);
  });
});

describe('sentinel collisions', () => {
  /**
   * THE BUG, STATED EXECUTABLY.
   *
   * LandForge's §7.4 ladder identifies "real" timber data by testing that the
   * value is NOT EQUAL to its modeled default. A value-equality test cannot
   * distinguish a default from a genuine measurement that happens to land on
   * it — and 4.5 MBF/ac is an entirely ordinary young-pine figure, not an
   * exotic coincidence.
   *
   * The consequence is perverse: a professionally cruised parcel gets scored as
   * LESS trustworthy precisely because the cruise agreed with the model.
   */
  it('detects a measured value that lands exactly on a modeled default', () => {
    const collisions = detectSentinelCollisions({ mbfPerAcre: 4.5 });
    expect(collisions).toHaveLength(1);
    expect(collisions[0]!.assumption).toBe('defaultMbfPerAcre');
    expect(collisions[0]!.exact).toBe(true);
    expect(collisions[0]!.message).toMatch(/provenance/i);
  });

  it('detects collisions across all four sentinels at once', () => {
    const collisions = detectSentinelCollisions({
      mbfPerAcre: 4.5,
      standAgeYears: 24,
      millDistanceMi: 45,
      siteIndex: 70,
    });
    expect(collisions).toHaveLength(4);
  });

  it('does not fire on ordinary values', () => {
    expect(
      detectSentinelCollisions({
        mbfPerAcre: 6.2,
        standAgeYears: 31,
        millDistanceMi: 22,
        siteIndex: 85,
      })
    ).toHaveLength(0);
  });

  it('ignores absent and non-finite values', () => {
    expect(detectSentinelCollisions({})).toHaveLength(0);
    expect(detectSentinelCollisions({ mbfPerAcre: NaN })).toHaveLength(0);
  });

  it('exposes a cheap boolean for the field UI', () => {
    expect(collidesWithSentinel('defaultMbfPerAcre', 4.5)).toBe(true);
    expect(collidesWithSentinel('defaultMbfPerAcre', 4.6)).toBe(false);
    expect(collidesWithSentinel('defaultMbfPerAcre', undefined)).toBe(false);
  });

  /**
   * We never nudge a measurement to dodge a sentinel. That would be fabricating
   * data, and it would corrupt the ground truth TimberForge exists to collect.
   * The value passes through untouched; only a warning is added.
   */
  it('passes the colliding value through unchanged rather than perturbing it', () => {
    const c = detectSentinelCollisions({ mbfPerAcre: 4.5 })[0]!;
    expect(c.value).toBe(4.5);
    expect(c.sentinel).toBe(4.5);
  });
});

describe('inventory confidence ladder replica', () => {
  it('returns the none tier when there is no timber data at all', () => {
    const a = assessInventoryTier({});
    expect(a.tier).toBe('none');
  });

  it('reaches medium when volume differs from the modeled default', () => {
    const a = assessInventoryTier({ mbfPerAcre: 7.1 });
    expect(a.tier).toBe('medium');
  });

  it('drops to low when volume sits on the modeled default', () => {
    const a = assessInventoryTier({ mbfPerAcre: 4.5 });
    expect(a.tier).toBe('low');
    expect(a.collisions).toHaveLength(1);
  });

  it('reaches high only with a real sampling design behind it', () => {
    const a = assessInventoryTier({
      mbfPerAcre: 7.1,
      provenance: 'measured',
      plotCount: 12,
      samplingErrorPct: 9.4,
    });
    expect(a.tier).toBe('high');
    expect(a.reasons.join(' ')).toMatch(/12 plots/);
  });

  it('withholds the high tier when the sampling design is too thin', () => {
    const a = assessInventoryTier({
      mbfPerAcre: 7.1,
      provenance: 'measured',
      plotCount: 1,
    });
    expect(a.tier).toBe('medium');
  });

  /**
   * The corrected-tier field is what makes the bug arguable rather than merely
   * assertable: it shows exactly what the parcel SHOULD have scored.
   */
  it('reports the tier that explicit provenance would have produced', () => {
    const a = assessInventoryTier({
      mbfPerAcre: 4.5, // real, cruised, and colliding
      provenance: 'measured',
      plotCount: 14,
      samplingErrorPct: 8,
    });
    expect(a.tier).toBe('low');
    expect(a.tierIfProvenanceHonored).toBe('high');
    expect(a.reasons.join(' ')).toMatch(/under-rated/i);
  });
});

describe('downstream LandForge terms', () => {
  it('reproduces millScore, including its clamps', () => {
    // The first 20 miles are free.
    expect(millScore(20)).toBeCloseTo(95, 10); // clamped from 100
    expect(millScore(10)).toBeCloseTo(95, 10);
    // 45 miles: 100 - 25*1.4 = 65
    expect(millScore(45)).toBeCloseTo(65, 10);
    // Far mills floor at 15.
    expect(millScore(500)).toBeCloseTo(15, 10);
  });

  it('reproduces the Harvest + Resell confidence weighting', () => {
    const v = harvestResellConfidence(80, 70, 45);
    expect(v).toBeCloseTo(80 * 0.5 + 70 * 0.24 + 65 * 0.26, 10);
  });

  it('applies the reserve penalty below a timber confidence of 55', () => {
    expect(timberReservePenaltyPct(45)).toBe(3.5);
    expect(timberReservePenaltyPct(65)).toBe(0);
    expect(timberReservePenaltyPct(54.9)).toBe(3.5);
  });

  /**
   * This is the commercial consequence of the sentinel bug, in one assertion:
   * the collision flips the tier from medium to low, which crosses the 55-point
   * threshold, which turns on a 3.5% reserve requirement.
   */
  it('shows the sentinel collision turning on the reserve penalty', () => {
    const clean = assessInventoryTier({ mbfPerAcre: 4.6, provenance: 'measured' });
    const colliding = assessInventoryTier({ mbfPerAcre: 4.5, provenance: 'measured' });

    expect(timberReservePenaltyPct(clean.timberConfidence)).toBe(0);
    expect(timberReservePenaltyPct(colliding.timberConfidence)).toBe(3.5);
  });
});

describe('impact forecasting', () => {
  it('quantifies what delivering a cruise does to a parcel', () => {
    const f = forecastImpact(
      { mbfPerAcre: 4.5 }, // LandForge's modeled default, before
      {
        mbfPerAcre: 8.3,
        provenance: 'measured',
        plotCount: 14,
        samplingErrorPct: 9.1,
      },
      { uqs: 70, millDistanceMi: 30 }
    );

    expect(f.before.tier).toBe('low');
    expect(f.after.tier).toBe('high');
    expect(f.timberConfidenceDelta).toBeGreaterThan(0);
    expect(f.strategyConfidenceDelta).toBeGreaterThan(0);
    expect(f.reservePctDelta).toBe(-3.5);
    expect(f.headlines.join(' ')).toMatch(/low to high/i);
  });

  it('says plainly when a cruise changes nothing', () => {
    const f = forecastImpact(
      { mbfPerAcre: 8.0 },
      { mbfPerAcre: 8.1 },
      { uqs: 70, millDistanceMi: 30 }
    );
    expect(f.headlines.join(' ')).toMatch(/does not change/i);
  });

  it('surfaces a warning when the delivered cruise is being under-rated', () => {
    const f = forecastImpact(
      {},
      {
        mbfPerAcre: 4.5,
        provenance: 'measured',
        plotCount: 14,
        samplingErrorPct: 9,
      },
      { uqs: 70, millDistanceMi: 30 }
    );
    expect(f.headlines.join(' ')).toMatch(/should be high/i);
  });
});

describe('projection', () => {
  it('produces volume without pricing, and says so', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
    });

    expect(feed.mbfPerAcre).toBeGreaterThan(0);
    expect(feed.tGross).toBeNull();
    expect(feed.timberCost).toBeNull();
    expect(feed.netStumpagePerAcre).toBeNull();
    expect(feed.warnings.join(' ')).toMatch(/no stumpage pricing/i);
  });

  /**
   * Refusing to invent a price is a product requirement, not a limitation.
   * Price is the largest lever on tGross; a fabricated one produces a confident
   * dollar figure with nothing behind it.
   */
  it('never fabricates a stumpage price', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
    });
    expect(feed.tGross).toBeNull();
    expect(feed.provenance.tGross).toBeUndefined();
  });

  it('computes value when pricing is supplied, and records its source', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
      pricing,
    });

    expect(feed.tGross).toBeGreaterThan(0);
    expect(feed.sources.tGross).toBe(pricing.source);
    expect(feed.netStumpagePerAcre).toBeGreaterThan(0);
  });

  /**
   * A measured volume times an estimated price is an ESTIMATED value. Reporting
   * it as measured would launder the weakest input into the strongest claim.
   */
  it('downgrades value provenance to the weakest contributing input', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
      pricing,
    });
    expect(feed.provenance.mbfPerAcre).toBe('measured');
    expect(feed.provenance.tGross).toBe('estimated');
  });

  it('orders provenance strength correctly', () => {
    expect(weakerOf('measured', 'defaulted')).toBe('defaulted');
    expect(weakerOf('computed', 'measured')).toBe('computed');
    expect(weakerOf('estimated', 'predicted')).toBe('predicted');
    expect(weakerOf('measured', 'measured')).toBe('measured');
  });

  it('subtracts harvest costs to reach net stumpage', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
      pricing,
      costs: {
        loggingPerTon: 18,
        mobilizationCost: 4500,
        commissionPct: 10,
        provenance: 'estimated',
        source: 'Contractor quote, illustrative',
      },
    });

    expect(feed.timberCost).toBeGreaterThan(0);
    expect(feed.netStumpagePerAcre).toBeCloseTo(
      (feed.tGross! - feed.timberCost!) / feed.acres,
      6
    );
  });

  it('carries the sampling evidence that earns the high tier', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise({ plots: 8 }),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
    });
    expect(feed.sampling.plotCount).toBe(8);
    expect(feed.sampling.samplingErrorPct).toBeGreaterThan(0);
    expect(feed.sampling.confidenceLevel).toBe(0.95);
    expect(feed.sampling.logRule).toBe('doyle');
    expect(feed.sampling.regionProfile).toBe('us_south');
  });

  it('stamps the calculation engine and the ladder replica version', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
    });
    expect(feed.stamp.calcEngine).toMatch(/^tf-calc-/);
    expect(feed.stamp.ladderReplica).toMatch(/^lf-ladder-replica-/);
    expect(feed.feedVersion).toBe('tf-feed-v1');
  });

  it('warns rather than silently approximating a multi-stand sampling error', () => {
    const cruise = compileCruise({
      stands: [
        { id: 's1', name: 'A', acres: 40 },
        { id: 's2', name: 'B', acres: 60 },
      ],
      plots: [
        { id: 'p1', standId: 's1', number: 1, method: 'variable_radius', baf: 10 },
        { id: 'p2', standId: 's1', number: 2, method: 'variable_radius', baf: 10 },
        { id: 'p3', standId: 's2', number: 1, method: 'variable_radius', baf: 10 },
        { id: 'p4', standId: 's2', number: 2, method: 'variable_radius', baf: 10 },
      ],
      trees: [
        { id: 'a', plotId: 'p1', species: 'LP', dbh: 12, merchHeight: 2, merchHeightUnit: 'logs', product: 'sawtimber' },
        { id: 'b', plotId: 'p2', species: 'LP', dbh: 16, merchHeight: 2, merchHeightUnit: 'logs', product: 'sawtimber' },
        { id: 'c', plotId: 'p3', species: 'LP', dbh: 14, merchHeight: 3, merchHeightUnit: 'logs', product: 'sawtimber' },
        { id: 'd', plotId: 'p4', species: 'LP', dbh: 18, merchHeight: 3, merchHeightUnit: 'logs', product: 'sawtimber' },
      ],
      region,
    });

    const feed = projectCruiseToLandForge({
      cruise,
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
    });
    expect(feed.warnings.join(' ')).toMatch(/acre-weighted/i);
  });

  it('restricts the projection to selected stands', () => {
    const cruise = compileCruise({
      stands: [
        { id: 's1', name: 'A', acres: 40 },
        { id: 's2', name: 'B', acres: 60 },
      ],
      plots: [
        { id: 'p1', standId: 's1', number: 1, method: 'variable_radius', baf: 10 },
        { id: 'p2', standId: 's2', number: 1, method: 'variable_radius', baf: 10 },
      ],
      trees: [
        { id: 'a', plotId: 'p1', species: 'LP', dbh: 14, merchHeight: 2, merchHeightUnit: 'logs' },
        { id: 'b', plotId: 'p2', species: 'LP', dbh: 14, merchHeight: 2, merchHeightUnit: 'logs' },
      ],
      region,
    });

    const feed = projectCruiseToLandForge({
      cruise,
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
      standIds: ['s1'],
    });
    expect(feed.acres).toBe(40);
  });

  it('propagates a sentinel collision into the payload warnings', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: {
        landForgeParcelId: 'lf-123',
        standAgeYears: 24, // collides
        millDistanceMi: 45, // collides
      },
    });
    expect(feed.sentinelCollisions.length).toBeGreaterThanOrEqual(2);
    expect(feed.warnings.join(' ')).toMatch(/modeled default/i);
  });
});

describe('the adapter seam', () => {
  it('is honestly marked unverified until checked against LandForge', () => {
    // This must stay false until someone reads index.html. Flipping it without
    // doing the work is the only way this package can quietly become wrong.
    expect(ADAPTER_VERIFIED).toBe(false);
  });

  it('warns on every call while unverified', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
      pricing,
    });
    const out = toLandForgeInput(feed);
    expect(out.warnings.join(' ')).toMatch(/not been verified/i);
    expect(out.unverified.length).toBeGreaterThan(0);
  });

  it('maps the engine fields named in the scoring manual', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123', millDistanceMi: 30 },
      pricing,
    });
    const { payload } = toLandForgeInput(feed);

    expect(payload.acres).toBe(feed.acres);
    expect(payload.tGross).toBeCloseTo(feed.tGross!, 6);
    expect(payload.mbfPerAcre).toBeCloseTo(feed.mbfPerAcre!, 6);
    expect(payload.millDistance).toBe(30);
  });

  /**
   * An absent timber value means "fall back to the modeled default," which is
   * correct when we do not know. An explicit null risks coercion to zero
   * somewhere downstream, and zero timber is a very different claim from
   * unknown timber — it reads as "we cruised this and it is worthless."
   */
  it('omits unknown values rather than sending null', () => {
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
    });
    const { payload, dropped } = toLandForgeInput(feed);

    expect('tGross' in payload).toBe(false);
    expect(dropped).toContain('tGross');
    expect(payload.mbfPerAcre).toBeGreaterThan(0);
  });

  it('sends explicit provenance even though LandForge ignores it today', () => {
    // Costs nothing now; the day LandForge reads it, every record already
    // written becomes correct retroactively.
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
    });
    const { payload } = toLandForgeInput(feed);
    expect(payload.timberProvenance).toBeDefined();
    expect(payload.timberSamplingErrorPct).toBeGreaterThan(0);
    expect(payload.timberCruiseId).toBe('c1');
  });

  it('flags the per-acre-vs-total ambiguity on net stumpage', () => {
    // The highest-risk unverified mapping in the file: an error here scales
    // with acreage and still looks plausible.
    const feed = projectCruiseToLandForge({
      cruise: buildCruise(),
      cruiseId: 'c1',
      parcel: { landForgeParcelId: 'lf-123' },
      pricing,
    });
    const out = toLandForgeInput(feed);
    expect(out.warnings.join(' ')).toMatch(/per-acre/i);
  });

  it('documents which mappings came from the manual and which are guesses', () => {
    const verified = ENGINE_FIELD_MAPPINGS.filter((m) => m.status === 'verified');
    const unverified = ENGINE_FIELD_MAPPINGS.filter((m) => m.status === 'unverified');
    expect(verified.map((m) => m.landForgeField)).toEqual(
      expect.arrayContaining(['acres', 'tGross', 'timberCost'])
    );
    expect(unverified.length).toBeGreaterThan(0);
    for (const m of unverified) {
      expect(m.note.length).toBeGreaterThan(20);
    }
  });
});
