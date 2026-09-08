/**
 * Engine version stamping.
 *
 * LandForge already learned this lesson — its scoring manual carries version
 * stamps (lfs-v3, hbu-v1, v18-valuation-coherence) precisely so a score can be
 * reproduced later. TimberForge needs the same discipline for a stronger reason:
 * a timber cruise is a professional work product that a client may rely on in a
 * transaction, and "which version of the math produced this number" is a
 * question that can arrive years later, from a lawyer.
 *
 * Every CruiseResult carries this stamp, and it is persisted with the result.
 * Bump CALC_ENGINE_VERSION whenever a change would alter previously-computed
 * output. Do not bump it for refactors that cannot change a number.
 */

export const CALC_ENGINE_VERSION = 'tf-calc-v0.1.0-vrp-fixed-formclass';

export interface EngineStamp {
  calcEngine: string;
  logRule: string;
  regionProfile: string;
  volumeMethod: string;
  computedAt: string;
}
