/**
 * @timberforge/forestry-core
 *
 * The calculation engine. Zero runtime dependencies, pure functions, no I/O.
 *
 * That constraint is not aesthetic. This exact code has to run in three places
 * and produce byte-identical numbers in all three:
 *
 *   - in the browser, offline, on a phone in the woods with no signal;
 *   - in a Supabase Edge Function, when a cruise is recompiled server-side;
 *   - in a test, when we prove a number against a published forestry table.
 *
 * Anything that touches the network, the clock, or a database belongs in a
 * different package. The only exception is the timestamp in the engine stamp,
 * which records when a compilation happened and is not an input to any number.
 */

export * from './constants.js';
export * from './types.js';
export * from './logRules.js';
export * from './expansion.js';
export * from './volume.js';
export * from './statistics.js';
export * from './regions.js';
export * from './compile.js';
export * from './qa.js';
export * from './version.js';
