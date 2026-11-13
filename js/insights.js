// The Insights section. P1's numbers, chart and table are computed from the data.

import * as A from './analysis.js';
import * as F from './format.js';
import { figure, mount, dumbbell } from './charts.js';

const { strong, escapeHtml } = F;

function ordinal(n) {
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${suffix}`;
}

export function renderInsights(rows) {
  const result = A.blankDatesEffect(rows);
  const { overall, cities, mostMissing, leastMissing, mostDistorted } = result;
  const d = mostDistorted;

  // The city that would wrongly come out as the fastest of all.
  const winner = result.fastestIfZero.find((c) => c.city !== d.city && c.rank > 1);
  const falseWinner = winner
    ? `${escapeHtml(winner.city)} would look like the fastest city of all at ${F.days(winner.medianIfZero)}, when it is really ${ordinal(winner.rank)} at ${F.days(winner.median)}. `
    : '';

  document.getElementById('p1-text').innerHTML =
    `<p><span class="answer-lead">The problem.</span> Days on market is the contract date minus the list date, so it needs both. ` +
    `Many sales are missing one of them: of the ${F.int(overall.n)} sales in the price range, only ${strong(F.int(overall.nBoth))} ` +
    `(${F.pct((overall.nBoth / overall.n) * 100)}) have both dates. The gaps are not spread evenly. ` +
    `${escapeHtml(mostMissing.city)} is missing a date on ${strong(F.pct(mostMissing.missingPct))} of its sales, ` +
    `against ${F.pct(leastMissing.missingPct)} in ${escapeHtml(leastMissing.city)}.</p>` +
    `<p><span class="answer-lead">How the site handles it.</span> A blank date means "not recorded", never zero days. ` +
    `Every days-on-market number here (Q5, Q8 and the Explore section) uses only sales that have both dates, and shows how many sales that is.</p>` +
    `<p><span class="answer-lead">What it changes.</span> Counting each blank as 0 days would make thousands of homes look as if they sold instantly. ` +
    `The overall median would fall from ${strong(F.days(overall.median))} to ${strong(F.days(overall.medianIfZero))}. ` +
    `The worst case is ${strong(d.city)}: its median would drop from ${strong(F.days(d.median))} to ${strong(F.days(d.medianIfZero))}, ` +
    `moving it from ${ordinal(d.rank)} fastest of ${cities.length} cities to ${ordinal(d.rankIfZero)}. ` +
    falseWinner +
    `The mean has its own problem: a long tail of slow sales pulls it to ${F.days(Math.round(overall.mean * 10) / 10)}, ` +
    `${F.one(overall.mean / overall.median)} times the median, which is why the site reports medians.</p>` +
    `<p><span class="answer-lead">The caveat that remains.</span> Leaving blanks out is not neutral either. Where many sales have no dates, the median describes only the homes that were listed.</p>`;

  const fig = figure(document.getElementById('p1-chart'), {
    title: 'Median days on market by city, under two rules',
    subtitle: 'Sorted by the share of sales missing a list or contract date. The city whose ranking would change most is highlighted.',
    legend: [
      { shape: 'dot', cls: 'quiet', label: 'Only sales with both dates (used on this site)' },
      { shape: 'ring', cls: 'quiet', label: 'If a blank were counted as 0 days' },
      { shape: 'dot', cls: 'accent', label: 'Largest ranking change' },
    ],
  });
  const chartRows = cities.map((c) => ({
    label: c.city,
    a: c.medianIfZero,
    b: c.median,
    display: F.pct(c.missingPct),
    cls: c.city === d.city ? 'accent' : 'quiet',
    tip: {
      title: c.city,
      rows: [
        ['Sales missing a date', F.pct(c.missingPct)],
        ['Median, both dates', F.days(c.median)],
        ['Median, blank as 0', F.days(c.medianIfZero)],
        ['Rank, both dates', `${ordinal(c.rank)} fastest`],
        ['Rank, blank as 0', `${ordinal(c.rankIfZero)} fastest`],
      ],
    },
  }));
  mount(fig.body, (width) =>
    dumbbell(fig.body, width, {
      rows: chartRows,
      xFormat: F.int,
      xTitle: 'Median days on market',
      valueHeader: 'Missing a date',
      fromZero: true,
      ariaLabel: 'Dumbbell chart comparing median days on market by city under two rules for blank dates',
    })
  );
  fig.setTable(
    [
      { label: 'City', value: (c) => c.city },
      { label: 'Missing a date', value: (c) => F.pct(c.missingPct), numeric: true },
      { label: 'Median, both dates', value: (c) => F.dayCount(c.median), numeric: true },
      { label: 'Median, blank as 0', value: (c) => F.dayCount(c.medianIfZero), numeric: true },
      { label: 'Rank change', value: (c) => `${ordinal(c.rank)} to ${ordinal(c.rankIfZero)}`, numeric: true },
    ],
    cities.map((c) => ({ ...c, isKey: c.city === d.city }))
  );
}
