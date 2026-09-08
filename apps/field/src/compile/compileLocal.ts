/**
 * Running the engine on what is in IndexedDB.
 *
 * This is the whole reason the calculation engine has no I/O. The same
 * `compileCruise` that a Supabase Edge Function will call on the server runs
 * here, in the browser, with no signal — so the number a cruiser sees standing
 * in the stand is the number that ends up in the report. If the field app had
 * its own approximation, every discrepancy would be a support conversation.
 *
 * QA is run twice on purpose. The first pass sees raw field data only; the
 * second is given per-plot volumes from the compile, which unlocks the
 * plot-divergence check — a plot that disagrees violently with its neighbours
 * is usually a transcription error, and it cannot be spotted before the volumes
 * exist.
 */

import {
  compileCruise,
  runQa,
  getRegion,
  type CruiseResult,
  type QaReport,
  type RegionProfile,
} from '@timberforge/forestry-core';
import { loadCruise } from '../db/db.js';

export interface LocalCompilation {
  result: CruiseResult;
  qa: QaReport;
  region: RegionProfile;
}

export async function compileLocalCruise(cruiseId: string): Promise<LocalCompilation> {
  const { cruise, stands, plots, trees } = await loadCruise(cruiseId);
  if (!cruise) throw new Error(`No such cruise: ${cruiseId}`);

  const region = getRegion(cruise.regionId);

  const result = compileCruise({
    stands,
    plots,
    trees,
    region,
    logRule: cruise.logRule,
    targetSamplingErrorPct: cruise.targetSamplingErrorPct,
  });

  const plotVolumes: Record<string, number> = {};
  for (const stand of result.stands) {
    for (const pv of stand.plotValues) {
      plotVolumes[pv.plotId] = pv.netBoardFeetPerAcre;
    }
  }

  const qa = runQa({ stands, plots, trees, region, plotVolumes });

  return { result, qa, region };
}
