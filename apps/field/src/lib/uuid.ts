/**
 * Device-generated identifiers.
 *
 * `crypto.randomUUID` is available in every browser TimberForge targets and in
 * Node 19+, but it is only exposed in secure contexts. On http://192.168.x.x —
 * which is exactly how a cruiser would reach a laptop tethered in a truck — it
 * is undefined. The fallback below is a v4 UUID built from `getRandomValues`,
 * which has no such restriction.
 *
 * There is deliberately no Math.random() path. A weak id is a collision, and a
 * collision here silently merges two cruisers' tallies.
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (!c) throw new Error('No Web Crypto available; refusing to generate a weak id.');
  if (typeof c.randomUUID === 'function') return c.randomUUID();

  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant 10
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  );
}

/** ISO timestamp, one place so every row is written the same way. */
export const now = (): string => new Date().toISOString();
