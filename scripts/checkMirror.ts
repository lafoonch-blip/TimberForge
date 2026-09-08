/**
 * Drift check for docs/shared — the LandForge mirror.
 *
 * What this can prove and what it cannot is worth stating plainly, because a
 * green check here is easy to over-read.
 *
 * It CAN detect:
 *   - a TimberForge-side edit to a mirrored file (someone "fixing" a constant
 *     locally so a test passes, producing a repo that agrees with itself and
 *     disagrees with production);
 *   - a mirror that has gone stale past maxAgeDays;
 *   - a file added to or removed from docs/shared without a manifest entry,
 *     which is how an unprovenanced document quietly acquires authority.
 *
 * It CANNOT detect that LandForge changed. Nothing in this repository can —
 * LandForge's source is not reachable from here. Reconciliation is a deliberate
 * human act. The age check exists because that act is easy to forget, not
 * because it substitutes for it.
 *
 * This module is side-effect free. The CLI lives in runMirrorCheck.ts.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SHARED_DIR = join(import.meta.dirname ?? __dirname, '..', 'docs', 'shared');
export const MANIFEST_NAME = 'mirror.manifest.json';

/** Files in docs/shared that are documentation about the mirror, not mirrored content. */
const NOT_MIRRORED = new Set([MANIFEST_NAME, 'README.md']);

export interface MirrorEntry {
  describes: string;
  capturedAt: string | null;
  capturedFrom: string | null;
  method: string;
  confidence: 'confirmed' | 'derived' | 'inferred' | 'pending';
  caveat?: string;
  blocks?: string;
  sha256: string | null;
}

export interface Manifest {
  canonicalOwner: string;
  maxAgeDays: number;
  files: Record<string, MirrorEntry>;
}

export interface Finding {
  file: string;
  kind: 'edited' | 'unprovenanced' | 'missing' | 'stale' | 'uncaptured';
  detail: string;
}

export function hashContent(text: string): string {
  // Normalise line endings so a checkout on Windows does not read as tampering.
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

export function readManifest(dir = SHARED_DIR): Manifest {
  return JSON.parse(readFileSync(join(dir, MANIFEST_NAME), 'utf8')) as Manifest;
}

export function listMirroredFiles(dir = SHARED_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') || f.endsWith('.json'))
    .filter((f) => !NOT_MIRRORED.has(f))
    .sort();
}

/**
 * `now` is injected rather than read from the clock so the staleness branch is
 * testable without waiting ninety days or mocking Date globally.
 */
export function checkMirror(
  dir = SHARED_DIR,
  now: Date = new Date()
): { findings: Finding[]; ok: boolean } {
  const manifest = readManifest(dir);
  const onDisk = listMirroredFiles(dir);
  const findings: Finding[] = [];

  for (const file of onDisk) {
    const entry = manifest.files[file];
    if (!entry) {
      findings.push({
        file,
        kind: 'unprovenanced',
        detail:
          'Present in docs/shared but absent from the manifest. A mirrored file ' +
          'without provenance is indistinguishable from something someone invented.',
      });
      continue;
    }

    const actual = hashContent(readFileSync(join(dir, file), 'utf8'));

    if (entry.confidence === 'pending') {
      // A placeholder is allowed to have no hash and no capture date. It is
      // reported so it stays visible, but it does not fail the check.
      findings.push({
        file,
        kind: 'uncaptured',
        detail: `Placeholder awaiting capture. ${entry.blocks ? 'Blocks: ' + entry.blocks : ''}`.trim(),
      });
      continue;
    }

    if (entry.sha256 === null) {
      findings.push({
        file,
        kind: 'edited',
        detail: 'No hash recorded. Run `npm run check:mirror -- --update` and review the diff.',
      });
    } else if (entry.sha256 !== actual) {
      findings.push({
        file,
        kind: 'edited',
        detail:
          'Content does not match the recorded hash. If LandForge changed, re-capture and ' +
          'update the manifest. If this was a local edit to make something pass, revert it.',
      });
    }

    if (entry.capturedAt) {
      const ageDays = Math.floor(
        (now.getTime() - new Date(entry.capturedAt).getTime()) / 86_400_000
      );
      if (ageDays > manifest.maxAgeDays) {
        findings.push({
          file,
          kind: 'stale',
          detail: `Captured ${ageDays} days ago; limit is ${manifest.maxAgeDays}. Re-verify against LandForge.`,
        });
      }
    }
  }

  for (const file of Object.keys(manifest.files)) {
    if (!onDisk.includes(file)) {
      findings.push({ file, kind: 'missing', detail: 'In the manifest but not on disk.' });
    }
  }

  // `uncaptured` is informational; everything else is a failure.
  const ok = findings.every((f) => f.kind === 'uncaptured');
  return { findings, ok };
}

export function updateHashes(dir = SHARED_DIR): string[] {
  const manifest = readManifest(dir);
  const changed: string[] = [];
  for (const file of listMirroredFiles(dir)) {
    const entry = manifest.files[file];
    if (!entry || entry.confidence === 'pending') continue;
    const actual = hashContent(readFileSync(join(dir, file), 'utf8'));
    if (entry.sha256 !== actual) {
      entry.sha256 = actual;
      changed.push(file);
    }
  }
  writeFileSync(join(dir, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + '\n');
  return changed;
}
