/**
 * CLI for the LandForge mirror drift check.
 *
 *   npm run check:mirror              -- report drift; exit 1 if the mirror is not intact
 *   npm run check:mirror -- --update  -- re-record hashes from current content
 *
 * The logic lives in checkMirror.ts, which is kept side-effect free so the test
 * suite can import it without a CLI running on import. This mirrors the split
 * between genRegionSeed.ts and writeRegionSeed.ts.
 *
 * `--update` is deliberately a separate, explicit invocation. It makes any diff
 * disappear, including one caused by a local edit that should have been
 * reverted rather than blessed — so the diff it produces must be read, not
 * rubber-stamped.
 */

import { checkMirror, updateHashes } from './checkMirror.js';

if (process.argv.includes('--update')) {
  const changed = updateHashes();
  console.log(
    changed.length
      ? `Updated hashes for:\n  ${changed.join('\n  ')}\n\nReview the diff before committing.`
      : 'No hash changes.'
  );
} else {
  const { findings, ok } = checkMirror();
  for (const f of findings) {
    const tag = f.kind === 'uncaptured' ? 'note' : 'FAIL';
    console.log(`[${tag}] ${f.file} — ${f.kind}\n        ${f.detail}`);
  }
  if (ok) {
    console.log(
      findings.length
        ? '\nMirror intact. (Intact and recent — not the same as correct; see docs/shared/README.md.)'
        : 'Mirror intact.'
    );
  } else {
    console.error('\nMirror drift detected. See docs/shared/README.md.');
    process.exit(1);
  }
}
