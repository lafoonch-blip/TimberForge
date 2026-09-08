// @vitest-environment jsdom
/**
 * Does the thing actually open?
 *
 * The offline tests prove the data layer is correct, which is necessary and not
 * sufficient: a broken import, a hook called conditionally or a screen that
 * throws on first paint all typecheck cleanly and all leave the cruiser looking
 * at a white rectangle. This test drives the real components through the real
 * database and asserts on what a person would see.
 *
 * It is deliberately a walk-through rather than a set of unit tests — create a
 * cruise, add a stand, take a plot, tally a tree, compile it — because that is
 * the path every user takes on their first afternoon, and it is the path most
 * worth knowing is unbroken.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.js';
import { db } from '../src/db/db.js';

// Tables are cleared rather than the database dropped. `db.delete()` closes
// the connection, and Dexie's live queries — which are what the header and
// every list are built on — reject in flight when that happens, turning a
// perfectly good test run into a wall of unhandled rejections.
beforeEach(async () => {
  await db.open();
  await db.transaction('rw', db.cruise, db.stand, db.plot, db.tree, db.outbox, async () => {
    await Promise.all([
      db.cruise.clear(),
      db.stand.clear(),
      db.plot.clear(),
      db.tree.clear(),
      db.outbox.clear(),
    ]);
  });
});
afterEach(cleanup);

describe('the field app', () => {
  it('opens on a seeded cruise so there is something to look at', async () => {
    render(<App />);
    // The seed exists because an empty first screen makes the app impossible to
    // evaluate — you cannot tell whether the compile works with nothing in it.
    expect(await screen.findByText(/Sample — Ridge Tract/)).toBeTruthy();
  });

  it('walks a cruiser from a new cruise to a compiled result', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Sample — Ridge Tract/);

    await user.click(screen.getByRole('button', { name: /new cruise/i }));
    await user.type(screen.getByLabelText(/^name$/i), 'Walkthrough Tract');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    // Straight into the cruise. A new cruise has no stands, so that is the ask.
    await screen.findByText(/Walkthrough Tract/);
    const standName = await screen.findByLabelText(/^name$/i);
    await user.type(standName, 'North Block');
    await user.type(screen.getByLabelText(/acres/i), '80');
    await user.click(screen.getByRole('button', { name: /add stand/i }));

    await screen.findByText(/North Block · 80 ac/);
    await user.click(screen.getByRole('button', { name: /add plot/i }));

    // Adding a plot goes straight to the tally screen: the cruiser is standing
    // at the point, and one fewer tap here is a tap saved on every plot.
    await screen.findByText(/Plot 1/);
    await user.click(screen.getByRole('button', { name: /^12$/ }));
    await user.click(screen.getByRole('button', { name: /^14$/ }));

    await waitFor(() => expect(screen.getByText(/Tally \(2\)/)).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /done with this plot/i }));
    // Two places say it — the cruise summary and the plot row — and both are
    // meant to.
    await screen.findAllByText(/2 trees/);

    await user.click(screen.getByRole('button', { name: /^compile$/i }));

    // 2 trees x 10 BAF on 1 plot = 20 sq ft/acre. The number is asserted, not
    // just the presence of a table: a compile screen that renders zeroes is
    // worse than one that fails, because nobody notices.
    await screen.findByText(/Totals/);
    await waitFor(() => expect(screen.getAllByText(/^20\.0 ft²$/).length).toBeGreaterThan(0));
  });

  it('shows the queued-changes count, so nothing is silently unsynced', async () => {
    render(<App />);
    // The seed alone queues a cruise, a stand, four plots and fifteen trees.
    // The exact number matters less than that the header never reads zero while
    // work is sitting on the device.
    await waitFor(() => expect(screen.getByTitle(/waiting to sync/i)).toBeTruthy());
    const pill = screen.getByTitle(/waiting to sync/i);
    expect(Number(pill.textContent!.replace(/\D/g, ''))).toBeGreaterThan(0);
  });

  it('will not let a plot with trees on it be marked empty', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Sample — Ridge Tract/);
    await user.click(screen.getByRole('button', { name: /^open$/i }));

    // Wait for the seed to finish writing before touching it. The seed inserts
    // row by row, so a plot can be on screen a beat before its trees are — and
    // a test that clicks in that window is testing an empty plot.
    await screen.findByText(/·\s*5 trees/);

    // Plot 1 of the seed has five trees on it.
    const tallyButtons = await screen.findAllByRole('button', { name: /^tally$/i });
    await user.click(tallyButtons[0]!);

    // Synchronise on the tree count, not on the plot header. TallyScreen runs
    // three independent liveQueries, and the trees one is seeded with a default
    // of [] — so "Plot 1" renders as soon as the cruise and plot resolve, while
    // trees is still empty and the button is still enabled. Waiting on the
    // header therefore asserts into a window where the answer is legitimately
    // "not disabled yet", which is why this test was flaky rather than wrong.
    await screen.findByText(/5 trees/);

    const markEmpty = screen.getByRole('button', { name: /mark empty/i });
    // An empty point is an observation of zero. A plot that is both zero and
    // five trees would be counted twice by the engine, so the button is
    // disabled rather than merely discouraged.
    expect(markEmpty.hasAttribute('disabled')).toBe(true);
  });
});
