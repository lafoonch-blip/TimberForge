/**
 * A cruise to open the app on.
 *
 * An empty first screen makes a field app impossible to evaluate: you cannot
 * tell whether the compile is right until there is something to compile. This
 * seeds one 80-acre loblolly stand with four 10-BAF points, including one
 * legitimately empty point, because the empty-point handling is the part most
 * worth seeing work.
 *
 * Runs once. It checks for any existing cruise first, so it cannot overwrite
 * real field data — and it is never called after the database has rows.
 */

import { db } from './db.js';
import { createCruise, addStand, addPlot, tallyTree, markPlotEmpty } from './actions.js';

/** dbh, total height (ft) pairs, roughly a 22-year-old planted loblolly stand. */
const POINTS: Array<Array<[number, number]>> = [
  [
    [11.2, 68],
    [9.8, 63],
    [13.4, 74],
    [10.1, 65],
    [12.6, 71],
  ],
  [
    [14.1, 78],
    [12.2, 72],
    [10.9, 66],
    [15.3, 81],
  ],
  [], // Visited, nothing in. A real zero, not a gap.
  [
    [9.4, 61],
    [11.8, 69],
    [12.9, 73],
    [10.6, 66],
    [13.1, 75],
    [11.1, 68],
  ],
];

export async function seedIfEmpty(): Promise<void> {
  if ((await db.cruise.count()) > 0) return;

  const cruise = await createCruise({
    name: 'Sample — Ridge Tract',
    regionId: 'us_south',
    defaultMethod: 'variable_radius',
    defaultBaf: 10,
    targetSamplingErrorPct: 10,
  });

  const stand = await addStand(cruise.id, { name: 'North Block', acres: 80 });

  for (const trees of POINTS) {
    const plot = await addPlot(cruise, stand.id);
    if (trees.length === 0) {
      await markPlotEmpty(plot, true);
      continue;
    }
    for (const [dbh, ht] of trees) {
      await tallyTree(plot, {
        species: 'LP',
        dbh,
        totalHeightFt: ht,
        // Two 16-foot logs is a fair merchantable height for this size class;
        // it is a measurement in the field, so it is entered as one here.
        merchHeight: 2,
        merchHeightUnit: 'logs',
      });
    }
  }
}
