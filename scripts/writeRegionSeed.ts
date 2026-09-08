/**
 * CLI for the region seed generator.
 *
 *   npm run gen:regions     -- rewrite supabase/migrations/0002_seed_regions.sql
 *   npm run check:regions   -- exit 1 if that file is stale
 *
 * The logic lives in genRegionSeed.ts, which is kept side-effect free so the
 * guard test can import it without writing to the working tree.
 */

import { seedIsCurrent, writeSeed } from './genRegionSeed.js';

if (process.argv.includes('--check')) {
  const { current, reason } = seedIsCurrent();
  if (!current) {
    console.error(`${reason}\nRun: npm run gen:regions`);
    process.exit(1);
  }
  console.log('region seed is current');
} else {
  console.log(`wrote ${writeSeed()}`);
}
