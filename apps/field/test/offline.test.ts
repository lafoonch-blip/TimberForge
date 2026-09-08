/**
 * The offline path, end to end.
 *
 * These tests exist because the offline story is the product. A field app that
 * loses a tally is not a slightly worse app; it is one nobody will carry twice.
 * So the properties asserted here are the ones a cruiser is relying on without
 * ever being told about them:
 *
 *   * a tally lands in the database and in the sync queue, together or not at all;
 *   * an empty point survives as an observed zero rather than as missing data;
 *   * the queue replays in order and survives a failure mid-flight;
 *   * what was collected offline compiles offline, with the same engine the
 *     server uses.
 *
 * fake-indexeddb provides a real IndexedDB implementation in Node, so this is
 * Dexie's actual transaction and index behaviour, not a mock of it.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, loadCruise } from '../src/db/db.js';
import {
  addPlot,
  addStand,
  createCruise,
  markPlotEmpty,
  markPlotSkipped,
  tallyTree,
  untallyTree,
  nextPlotNumber,
} from '../src/db/actions.js';
import { createMemoryTransport, drainOutbox, MAX_ATTEMPTS } from '../src/sync/outbox.js';
import { compileLocalCruise } from '../src/compile/compileLocal.js';

async function freshCruise() {
  return createCruise({
    name: 'Test tract',
    regionId: 'us_south',
    defaultMethod: 'variable_radius',
    defaultBaf: 10,
    targetSamplingErrorPct: 10,
  });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('local writes', () => {
  it('queues every write for sync in the same transaction', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);
    await tallyTree(plot, { species: 'LP', dbh: 12, totalHeightFt: 70 });

    const queued = await db.outbox.orderBy('seq').toArray();
    expect(queued.map((q) => q.table)).toEqual(['cruise', 'stand', 'plot', 'tree']);
    expect(queued.every((q) => q.op === 'upsert')).toBe(true);
    // Every entry knows which cruise it belongs to, so a single cruise can be
    // pushed on its own — a cruiser with one bar should not have to upload
    // three other jobs to get this one in.
    expect(new Set(queued.map((q) => q.cruiseId))).toEqual(new Set([cruise.id]));
  });

  it('carries the whole row, not a patch, so a replay is idempotent', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const entry = (await db.outbox.orderBy('seq').toArray()).at(-1)!;
    expect(entry.payload).toEqual(stand);
  });

  it('numbers plots per stand, and never collides after a mid-list deletion', async () => {
    const cruise = await freshCruise();
    const a = await addStand(cruise.id, { name: 'A', acres: 10 });
    const b = await addStand(cruise.id, { name: 'B', acres: 10 });

    await addPlot(cruise, a.id);
    const a2 = await addPlot(cruise, a.id);
    const a3 = await addPlot(cruise, a.id);
    const b1 = await addPlot(cruise, b.id);

    // Numbering restarts per stand, because that is how cruisers speak about
    // plots — "plot 1 in the north block", not "plot 47".
    expect(b1.number).toBe(1);
    expect(a2.number).toBe(2);

    // Delete from the middle. Counting plots would now hand out 3 again and put
    // two different points in the same stand under one number, which is
    // unrecoverable once the field notes are written. Taking the maximum
    // cannot do that.
    await db.plot.delete(a2.id);
    expect(await nextPlotNumber(a.id)).toBe(4);
    expect(a3.number).toBe(3);

    // Deleting the highest plot DOES hand its number back, and should: a plot
    // added by a mis-tap and immediately removed should not leave a permanent
    // gap in the numbering a cruiser has to explain in the report.
    await db.plot.delete(a3.id);
    expect(await nextPlotNumber(a.id)).toBe(2);
  });

  it('refuses a variable-radius plot with no BAF', async () => {
    const cruise = await createCruise({
      name: 'No BAF',
      regionId: 'us_south',
      defaultMethod: 'variable_radius',
    });
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    await expect(addPlot(cruise, stand.id)).rejects.toThrow(/basal area factor/i);
  });

  it('refuses a fixed-area plot with no plot size', async () => {
    const cruise = await createCruise({
      name: 'No size',
      regionId: 'us_south',
      defaultMethod: 'fixed_area',
    });
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    await expect(addPlot(cruise, stand.id)).rejects.toThrow(/plot size/i);
  });

  it('never stores both a BAF and a plot size on one plot', async () => {
    // The database enforces this too. Enforcing it here as well means the
    // failure happens at the tap rather than at the sync, days later.
    const cruise = await createCruise({
      name: 'Fixed',
      regionId: 'us_south',
      defaultMethod: 'fixed_area',
      defaultPlotAcres: 0.1,
      defaultBaf: 10,
    });
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);
    expect(plot.plotAcres).toBe(0.1);
    expect(plot.baf).toBeUndefined();
  });

  it('clears the empty flag when a tree is tallied on the plot', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);
    const empty = await markPlotEmpty(plot, true);
    expect(empty.isEmpty).toBe(true);

    await tallyTree(empty, { species: 'LP', dbh: 10 });
    const after = await db.plot.get(plot.id);
    // A stale empty flag on a plot with trees would be a plot the engine counts
    // as a zero AND as its trees, which double-counts the sample.
    expect(after!.isEmpty).toBe(false);
  });

  it('keeps empty and skipped mutually exclusive', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);

    const skipped = await markPlotSkipped(plot, true);
    expect(skipped.isSkipped).toBe(true);

    const empty = await markPlotEmpty(skipped, true);
    // They mean opposite things: skipped is "no observation", empty is "an
    // observation of zero". A plot claiming both cannot be compiled honestly.
    expect(empty.isEmpty).toBe(true);
    expect(empty.isSkipped).toBe(false);
  });

  it('queues a deletion rather than dropping it silently', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);
    const tree = await tallyTree(plot, { species: 'LP', dbh: 12 });

    await untallyTree(tree);

    expect(await db.tree.get(tree.id)).toBeUndefined();
    const last = (await db.outbox.orderBy('seq').toArray()).at(-1)!;
    expect(last).toMatchObject({ table: 'tree', op: 'delete', rowId: tree.id });
  });
});

describe('sync queue', () => {
  it('sends in the order the cruiser made the changes', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);
    await tallyTree(plot, { species: 'LP', dbh: 12 });

    const { transport, applied } = createMemoryTransport();
    const res = await drainOutbox(transport);

    expect(res).toEqual({ sent: 4, failed: 0 });
    // Parents before children. A tree arriving before its plot is a foreign key
    // violation on the server, so order is not a nicety here.
    expect(applied.map((a) => a.table)).toEqual(['cruise', 'stand', 'plot', 'tree']);
    expect(await db.outbox.count()).toBe(0);
  });

  it('stops at the first failure instead of pushing past it', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);
    await tallyTree(plot, { species: 'LP', dbh: 12 });

    const { transport, applied } = createMemoryTransport({
      failOn: (e) => e.table === 'plot',
    });
    const res = await drainOutbox(transport);

    expect(res.sent).toBe(2);
    expect(res.error).toMatch(/rejected/i);
    expect(applied.map((a) => a.table)).toEqual(['cruise', 'stand']);
    // The plot and everything after it are still queued, in order.
    const left = await db.outbox.orderBy('seq').toArray();
    expect(left.map((l) => l.table)).toEqual(['plot', 'tree']);
    expect(left[0]!.attempts).toBe(1);
    expect(left[0]!.lastError).toMatch(/rejected/i);
  });

  it('gives up on an entry that keeps failing rather than retrying for ever', async () => {
    const cruise = await freshCruise();
    const { transport } = createMemoryTransport({ failOn: () => true });

    for (let i = 0; i < MAX_ATTEMPTS; i++) await drainOutbox(transport);
    const res = await drainOutbox(transport);

    // A poison entry that blocks the queue silently is how a cruiser ends up
    // with a week of work that never uploaded and no indication of it.
    expect(res.error).toMatch(/has failed/i);
    expect((await db.outbox.get(1))!.attempts).toBe(MAX_ATTEMPTS);
    expect(cruise.id).toBeTruthy();
  });

  it('resumes where it left off once the transport recovers', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    await addPlot(cruise, stand.id);

    let broken = true;
    const applied: string[] = [];
    await drainOutbox({
      async apply(e) {
        if (broken && e.table === 'stand') throw new Error('offline');
        applied.push(e.table);
      },
    });
    broken = false;
    const res = await drainOutbox({
      async apply(e) {
        applied.push(e.table);
      },
    });

    expect(applied).toEqual(['cruise', 'stand', 'plot']);
    expect(res.failed).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('compiling what is on the device', () => {
  it('produces a stand result from locally collected data', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 80 });

    for (const dbhs of [
      [11, 13, 10],
      [14, 12, 15],
      [9, 12, 13],
    ]) {
      const plot = await addPlot(cruise, stand.id);
      for (const dbh of dbhs) {
        await tallyTree(plot, {
          species: 'LP',
          dbh,
          totalHeightFt: 60 + dbh,
          merchHeight: 2,
          merchHeightUnit: 'logs',
        });
      }
    }

    const { result } = await compileLocalCruise(cruise.id);
    const s = result.stands[0]!;

    expect(s.plotCount).toBe(3);
    expect(s.treeCount).toBe(9);
    expect(s.basalAreaPerAcre).toBeCloseTo(30, 6); // 3 plots x 3 trees x 10 BAF / 3
    expect(s.netBoardFeetPerAcre).toBeGreaterThan(0);
    expect(s.totalNetMbf).toBeGreaterThan(0);
  });

  it('counts an empty point as a zero, not as a missing plot', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });

    const p1 = await addPlot(cruise, stand.id);
    await tallyTree(p1, { species: 'LP', dbh: 12, totalHeightFt: 70 });
    const p2 = await addPlot(cruise, stand.id);
    await markPlotEmpty(p2, true);

    const { result } = await compileLocalCruise(cruise.id);
    const s = result.stands[0]!;

    expect(s.plotCount).toBe(2);
    expect(s.emptyPlotCount).toBe(1);
    // One 10-BAF tree over two plots is 5 sq ft/acre. Dropping the empty point
    // would report 10 — a 100% overestimate, from a plot the cruiser walked to.
    expect(s.basalAreaPerAcre).toBeCloseTo(5, 6);
  });

  it('excludes a skipped plot from the sample entirely', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });

    const p1 = await addPlot(cruise, stand.id);
    await tallyTree(p1, { species: 'LP', dbh: 12, totalHeightFt: 70 });
    const p2 = await addPlot(cruise, stand.id);
    await markPlotSkipped(p2, true);

    const { result } = await compileLocalCruise(cruise.id);
    const s = result.stands[0]!;

    // A plot nobody could reach is not evidence of anything. Unlike the empty
    // point above, it must not pull the mean down.
    expect(s.skippedPlotCount).toBe(1);
    expect(s.basalAreaPerAcre).toBeCloseTo(10, 6);
  });

  it('survives the round trip through IndexedDB unchanged', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);
    await tallyTree(plot, {
      species: 'LP',
      dbh: 12.4,
      totalHeightFt: 71,
      merchHeight: 2.5,
      merchHeightUnit: 'logs',
      defectPct: 12,
    });

    const loaded = await loadCruise(cruise.id);
    const t = loaded.trees[0]!;
    // Structured clone is exact for numbers, but this is the seam where a
    // float would quietly become a string if anything started serialising.
    expect(t.dbh).toBe(12.4);
    expect(t.merchHeight).toBe(2.5);
    expect(t.defectPct).toBe(12);
    expect(t.provenance).toBe('measured');
  });

  it('reports QA findings against locally collected data', async () => {
    const cruise = await freshCruise();
    const stand = await addStand(cruise.id, { name: 'North', acres: 40 });
    const plot = await addPlot(cruise, stand.id);
    await tallyTree(plot, { species: 'LP', dbh: 12 });

    const { qa } = await compileLocalCruise(cruise.id);
    // The specific finding matters less than the wiring: QA runs on device, so
    // a problem is visible while the cruiser can still walk back to the tree.
    expect(qa.findings.length).toBeGreaterThan(0);
    expect(qa.errorCount + qa.warningCount + qa.infoCount).toBe(qa.findings.length);
  });
});
