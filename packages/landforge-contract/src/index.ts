/**
 * @timberforge/landforge-contract
 *
 * The bridge between a timber cruise and the LandForge scoring engine.
 *
 * The whole package exists to keep one coupling in one place. TimberForge and
 * LandForge share a Supabase project, a user, and a parcel — but they must not
 * share a mental model. When LandForge changes, exactly one file here should
 * need editing: `adapter.ts`.
 *
 * Layering, strongest guarantee to weakest:
 *
 *   assumptions.ts  mirrored constants + the sentinel-collision guard
 *   confidence.ts   a replica of LandForge's §7.4 ladder, for forecasting
 *   projection.ts   cruise -> narrow, provenance-carrying payload
 *   adapter.ts      payload -> LandForge's actual field names  <-- THE SEAM
 */

export * from './assumptions.js';
export * from './confidence.js';
export * from './projection.js';
export * from './adapter.js';
