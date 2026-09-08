/**
 * Draining the outbox.
 *
 * WHAT IS FINISHED AND WHAT IS NOT
 *
 * The queue, the ordering, the retry accounting and the replay semantics are
 * real and tested. The transport — the thing that actually talks to Supabase —
 * is an interface with one in-memory implementation used by the tests. Wiring
 * `@supabase/supabase-js` in is a small change to one file, and it is left
 * until the project URL and anon key exist, because a half-written client that
 * silently no-ops is worse than an obvious gap.
 *
 * WHY REPLAY, NOT MERGE
 *
 * Entries are applied strictly in `seq` order and each carries a whole row, so
 * applying the log twice produces the same database as applying it once. That
 * makes the failure mode a duplicate request rather than a lost edit, which is
 * the right way round: the network will drop responses, and a client that
 * cannot safely retry will eventually drop data instead.
 *
 * CONFLICTS
 *
 * Last-writer-wins, by arrival. For field data this is very nearly always
 * correct, because two cruisers do not tally the same tree — they work
 * different stands. Where it is not correct is a shared cruise header edited by
 * two people on the same afternoon, and that is worth revisiting once anyone
 * actually does it. Guessing at a merge strategy now would be inventing a
 * problem to solve.
 */

import { db } from '../db/db.js';
import type { OutboxEntry } from '../db/schema.js';

export interface SyncTransport {
  /**
   * Apply one entry remotely. Resolve on success; throw to have the entry kept
   * and retried. Implementations must be idempotent — an entry may be applied
   * more than once when a response is lost.
   */
  apply(entry: OutboxEntry): Promise<void>;
}

export interface SyncResult {
  sent: number;
  failed: number;
  /** The first error encountered, for showing the cruiser something specific. */
  error?: string;
}

/** How many times an entry is retried before it stops being attempted automatically. */
export const MAX_ATTEMPTS = 5;

/**
 * Send everything pending, oldest first.
 *
 * Stops at the first failure rather than skipping past it. Order matters: a
 * tree whose plot has not arrived is a foreign key violation, and pushing on
 * would turn one transient error into a cascade of permanent ones.
 */
export async function drainOutbox(
  transport: SyncTransport,
  opts: { limit?: number } = {}
): Promise<SyncResult> {
  const pending = await db.outbox.orderBy('seq').limit(opts.limit ?? 500).toArray();

  let sent = 0;
  for (const entry of pending) {
    if (entry.attempts >= MAX_ATTEMPTS) {
      return {
        sent,
        failed: pending.length - sent,
        error: `Entry ${entry.seq} has failed ${entry.attempts} times: ${entry.lastError ?? 'unknown error'}`,
      };
    }
    try {
      await transport.apply(entry);
      await db.outbox.delete(entry.seq!);
      sent += 1;
    } catch (err) {
      await db.outbox.update(entry.seq!, {
        attempts: entry.attempts + 1,
        lastError: (err as Error).message,
      });
      return { sent, failed: pending.length - sent, error: (err as Error).message };
    }
  }
  return { sent, failed: 0 };
}

/** How many changes are waiting. Shown in the header so it is never a surprise. */
export function pendingCount(): Promise<number> {
  return db.outbox.count();
}

/**
 * A transport that keeps everything in memory.
 *
 * Used by the tests, and useful in development: it makes the queue observable
 * without a server, so the offline path can be exercised without pretending to
 * be offline.
 */
export function createMemoryTransport(options: { failOn?: (e: OutboxEntry) => boolean } = {}) {
  const applied: OutboxEntry[] = [];
  return {
    applied,
    transport: {
      async apply(entry: OutboxEntry) {
        if (options.failOn?.(entry)) throw new Error(`Rejected entry ${entry.seq}`);
        applied.push(entry);
      },
    } satisfies SyncTransport,
  };
}
