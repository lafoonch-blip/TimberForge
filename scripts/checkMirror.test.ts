/**
 * Tests for the LandForge mirror drift check.
 *
 * These build a throwaway mirror directory rather than asserting against the
 * real docs/shared, because the real one changes every time someone re-captures
 * from LandForge and a test that breaks on legitimate work gets deleted.
 *
 * The last test is the one that matters: it runs against the real docs/shared
 * and asserts only structural properties that must hold regardless of content.
 */

import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  SHARED_DIR,
  checkMirror,
  hashContent,
  listMirroredFiles,
  readManifest,
  updateHashes,
  type Manifest,
} from './checkMirror.js';

const temps: string[] = [];
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeMirror(files: Record<string, string>, manifest: Manifest): string {
  const dir = mkdtempSync(join(tmpdir(), 'mirror-'));
  temps.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  writeFileSync(join(dir, 'mirror.manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

function entry(over: Partial<Manifest['files'][string]> = {}): Manifest['files'][string] {
  return {
    describes: 'a thing',
    capturedAt: '2026-09-01',
    capturedFrom: 'somewhere',
    method: 'read',
    confidence: 'confirmed',
    sha256: null,
    ...over,
  };
}

const NOW = new Date('2026-09-07T00:00:00Z');

describe('mirror drift check', () => {
  it('passes when every file matches its recorded hash', () => {
    const body = '# constants\n\nvalue = 1\n';
    const dir = makeMirror(
      { 'a.md': body },
      { canonicalOwner: 'LandForge', maxAgeDays: 90, files: { 'a.md': entry({ sha256: hashContent(body) }) } }
    );
    const { ok, findings } = checkMirror(dir, NOW);
    expect(ok).toBe(true);
    expect(findings).toHaveLength(0);
  });

  it('catches a local edit to a mirrored file', () => {
    // The scenario this whole mechanism exists for: someone changes a mirrored
    // constant here to make a TimberForge test pass, rather than reconciling
    // with LandForge. The repo then agrees with itself and not with production.
    const original = 'CV_PRIOR.mbf_per_acre = 0.60\n';
    const dir = makeMirror(
      { 'a.md': 'CV_PRIOR.mbf_per_acre = 0.45\n' },
      { canonicalOwner: 'LandForge', maxAgeDays: 90, files: { 'a.md': entry({ sha256: hashContent(original) }) } }
    );
    const { ok, findings } = checkMirror(dir, NOW);
    expect(ok).toBe(false);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('edited');
  });

  it('treats a missing hash as an edit rather than as a pass', () => {
    // Failing open here would mean a file could be introduced with no hash and
    // sail through forever.
    const dir = makeMirror(
      { 'a.md': 'x\n' },
      { canonicalOwner: 'LandForge', maxAgeDays: 90, files: { 'a.md': entry({ sha256: null }) } }
    );
    expect(checkMirror(dir, NOW).ok).toBe(false);
  });

  it('flags a file with no provenance entry', () => {
    const dir = makeMirror(
      { 'a.md': 'x\n', 'smuggled.md': 'invented facts\n' },
      { canonicalOwner: 'LandForge', maxAgeDays: 90, files: { 'a.md': entry({ sha256: hashContent('x\n') }) } }
    );
    const { ok, findings } = checkMirror(dir, NOW);
    expect(ok).toBe(false);
    expect(findings.find((f) => f.file === 'smuggled.md')?.kind).toBe('unprovenanced');
  });

  it('flags a manifest entry whose file has been deleted', () => {
    const dir = makeMirror(
      {},
      { canonicalOwner: 'LandForge', maxAgeDays: 90, files: { 'gone.md': entry({ sha256: 'abc' }) } }
    );
    const { ok, findings } = checkMirror(dir, NOW);
    expect(ok).toBe(false);
    expect(findings[0].kind).toBe('missing');
  });

  it('flags a mirror that has aged past the limit', () => {
    const body = 'x\n';
    const dir = makeMirror(
      { 'a.md': body },
      {
        canonicalOwner: 'LandForge',
        maxAgeDays: 90,
        files: { 'a.md': entry({ sha256: hashContent(body), capturedAt: '2026-01-01' }) },
      }
    );
    const { ok, findings } = checkMirror(dir, NOW);
    expect(ok).toBe(false);
    expect(findings.find((f) => f.kind === 'stale')).toBeTruthy();
  });

  it('reports a pending placeholder without failing the check', () => {
    // parcel.md is deliberately uncaptured. It must stay visible without
    // turning the suite red, or someone will "fix" it by inventing a schema.
    const dir = makeMirror(
      { 'parcel.md': 'not captured yet\n' },
      {
        canonicalOwner: 'LandForge',
        maxAgeDays: 90,
        files: {
          'parcel.md': entry({ confidence: 'pending', capturedAt: null, sha256: null, blocks: 'the FK' }),
        },
      }
    );
    const { ok, findings } = checkMirror(dir, NOW);
    expect(ok).toBe(true);
    expect(findings[0].kind).toBe('uncaptured');
  });

  it('ignores README.md, which documents the mirror rather than mirroring anything', () => {
    const dir = makeMirror(
      { 'README.md': 'how this works\n' },
      { canonicalOwner: 'LandForge', maxAgeDays: 90, files: {} }
    );
    expect(checkMirror(dir, NOW).ok).toBe(true);
  });

  describe('updateHashes', () => {
    it('records the current content and makes the check pass', () => {
      const dir = makeMirror(
        { 'a.md': 'new content\n' },
        { canonicalOwner: 'LandForge', maxAgeDays: 90, files: { 'a.md': entry({ sha256: 'stale' }) } }
      );
      expect(checkMirror(dir, NOW).ok).toBe(false);
      expect(updateHashes(dir)).toEqual(['a.md']);
      expect(checkMirror(dir, NOW).ok).toBe(true);
    });

    it('leaves pending placeholders unhashed', () => {
      // Hashing a placeholder would freeze "we don't know yet" into something
      // that looks captured.
      const dir = makeMirror(
        { 'parcel.md': 'tbd\n' },
        {
          canonicalOwner: 'LandForge',
          maxAgeDays: 90,
          files: { 'parcel.md': entry({ confidence: 'pending', capturedAt: null }) },
        }
      );
      expect(updateHashes(dir)).toEqual([]);
      const written = JSON.parse(readFileSync(join(dir, 'mirror.manifest.json'), 'utf8')) as Manifest;
      expect(written.files['parcel.md'].sha256).toBeNull();
    });
  });

  describe('the real docs/shared', () => {
    it('has a manifest entry for every mirrored file and vice versa', () => {
      const manifest = readManifest(SHARED_DIR);
      const onDisk = listMirroredFiles(SHARED_DIR);
      expect(onDisk.length).toBeGreaterThan(0);
      expect(Object.keys(manifest.files).sort()).toEqual(onDisk);
    });

    it('is intact', () => {
      const { findings, ok } = checkMirror(SHARED_DIR);
      const failures = findings.filter((f) => f.kind !== 'uncaptured');
      expect(failures.map((f) => `${f.file}: ${f.kind}`)).toEqual([]);
      expect(ok).toBe(true);
    });

    it('still records parcel.md as uncaptured, so the open FK stays visible', () => {
      const manifest = readManifest(SHARED_DIR);
      // If someone captures the parcel schema, this test should be updated in
      // the same commit — that is the point of it failing.
      expect(manifest.files['parcel.md'].confidence).toBe('pending');
    });
  });
});
