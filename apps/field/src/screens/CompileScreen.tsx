import { useEffect, useState } from 'react';
import { compileLocalCruise, type LocalCompilation } from '../compile/compileLocal.js';

/**
 * The compiled cruise.
 *
 * Two things are on this screen that a cruiser cannot get from a spreadsheet in
 * the truck, and they are the reason it exists:
 *
 *   1. "Can I go home yet" — the sampling error against the target, and the
 *      number of additional plots needed to hit it. Computed while standing in
 *      the stand, this saves a return trip; computed back at the office, it
 *      causes one.
 *   2. QA findings against the data as it stands, so a transcription error is
 *      found while the tree is still in front of the cruiser.
 *
 * Everything here is produced by the same engine the server runs. Nothing on
 * this screen is approximated for speed.
 */
export function CompileScreen({ cruiseId }: { cruiseId: string }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: LocalCompilation }
  >({ status: 'loading' });

  useEffect(() => {
    let live = true;
    compileLocalCruise(cruiseId)
      .then((data) => live && setState({ status: 'ok', data }))
      .catch((e: Error) => live && setState({ status: 'error', message: e.message }));
    return () => {
      live = false;
    };
  }, [cruiseId]);

  if (state.status === 'loading') return <p className="empty">Compiling…</p>;
  if (state.status === 'error')
    return <p className="empty" style={{ color: 'var(--red)' }}>{state.message}</p>;

  const { result, qa } = state.data;
  const n = (x: number, dp = 1) =>
    x.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

  return (
    <>
      <h2>Totals</h2>
      <div className="card">
        <table>
          <tbody>
            <tr>
              <td>Acres</td>
              <td className="mono">{n(result.totals.acres, 1)}</td>
            </tr>
            <tr>
              <td>Net MBF</td>
              <td className="mono">{n(result.totals.totalNetMbf, 1)}</td>
            </tr>
            <tr>
              <td>Net green tons</td>
              <td className="mono">{n(result.totals.totalNetGreenTons, 0)}</td>
            </tr>
            <tr>
              <td>Basal area / acre</td>
              <td className="mono">{n(result.totals.weightedBasalAreaPerAcre, 1)} ft²</td>
            </tr>
            <tr>
              <td>Trees / acre</td>
              <td className="mono">{n(result.totals.weightedTreesPerAcre, 0)}</td>
            </tr>
          </tbody>
        </table>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {result.stamp.calcEngine} · {result.stamp.logRule.replace(/_/g, ' ')} ·{' '}
          {result.stamp.regionProfile}
        </p>
      </div>

      {result.stands.map((s) => {
        const stats = s.statistics.netBoardFeetPerAcre;
        const need = s.plotsNeeded;
        return (
          <div key={s.standId}>
            <h2>{s.standName}</h2>
            <div className="card">
              <table>
                <tbody>
                  <tr>
                    <td>Plots (empty / skipped)</td>
                    <td className="mono">
                      {s.plotCount} ({s.emptyPlotCount} / {s.skippedPlotCount})
                    </td>
                  </tr>
                  <tr>
                    <td>Net bd ft / acre</td>
                    <td className="mono">{n(s.netBoardFeetPerAcre, 0)}</td>
                  </tr>
                  <tr>
                    <td>Basal area / acre</td>
                    <td className="mono">{n(s.basalAreaPerAcre, 1)} ft²</td>
                  </tr>
                  <tr>
                    <td>Trees / acre</td>
                    <td className="mono">{n(s.treesPerAcre, 0)}</td>
                  </tr>
                  <tr>
                    <td>QMD</td>
                    <td className="mono">{n(s.qmd, 1)}"</td>
                  </tr>
                  <tr>
                    <td>Sampling error (volume)</td>
                    <td className="mono">± {n(stats.samplingErrorPct, 1)}%</td>
                  </tr>
                </tbody>
              </table>

              {need && (
                <p className="small" style={{ marginBottom: 0 }}>
                  {need.achieved
                    ? `Target of ±${need.targetErrorPct}% met at ${s.plotCount} plots.`
                    : need.note
                      ? need.note
                      : `To reach ±${need.targetErrorPct}%, install about ${need.additionalPlots} more plot${need.additionalPlots === 1 ? '' : 's'}.`}
                </p>
              )}
            </div>

            {s.speciesComposition.length > 0 && (
              <div className="card">
                <table>
                  <thead>
                    <tr>
                      <th>Species</th>
                      <th>BA %</th>
                      <th>TPA</th>
                      <th>Bd ft/ac</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.speciesComposition.map((sp) => (
                      <tr key={sp.species}>
                        <td>{sp.commonName}</td>
                        <td className="mono">{n(sp.basalAreaPct, 0)}</td>
                        <td className="mono">{n(sp.treesPerAcre, 0)}</td>
                        <td className="mono">{n(sp.netBoardFeetPerAcre, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {s.warnings.length > 0 && (
              <div className="card">
                {s.warnings.map((w, i) => (
                  <p key={i} className="small muted" style={{ margin: '4px 0' }}>
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <h2>
        Quality checks — {qa.errorCount} errors, {qa.warningCount} warnings
      </h2>
      <div className="card">
        {qa.findings.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Nothing flagged.
          </p>
        ) : (
          qa.findings.map((f, i) => (
            <div key={`${f.code}-${i}`} className={`finding ${f.severity}`}>
              <div>{f.message}</div>
              {f.remedy && <div className="small muted">{f.remedy}</div>}
            </div>
          ))
        )}
      </div>
    </>
  );
}
