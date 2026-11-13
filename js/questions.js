// The graded questions. Each one writes its answer in words and draws its chart.

import * as A from './analysis.js';
import * as F from './format.js';
import { figure, mount, rankedRows, dumbbell, boxRows, slope } from './charts.js';

const { strong, escapeHtml } = F;

function byId(id) {
  return document.getElementById(id);
}

function setAnswer(id, html) {
  byId(id).innerHTML = html;
}

function ordinal(n) {
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${suffix}`;
}

const PRICE_RULE = `Sales from ${F.usd(A.PRICE_MIN)} to ${F.usd(A.PRICE_MAX)}`;

// ---------- Q1 ----------

function renderQ1(rows) {
  const { cities, top } = A.q1(rows);
  const topNames = new Set(top.map((c) => c.city));
  const runnerUp = cities.find((c) => !topNames.has(c.city));
  const lowest = cities[cities.length - 1];

  setAnswer(
    'q1-answer',
    `<p>${F.listJoin(top.map((c) => strong(c.city)))} ${top.length > 1 ? 'have' : 'has'} the highest median sale price: ` +
      `${strong(F.usd(top[0].median))}, across ${F.sales(top[0].n)}.</p>` +
      `<p>${escapeHtml(runnerUp.city)} is next at ${F.usd(runnerUp.median)}. ` +
      `The lowest median is ${escapeHtml(lowest.city)} at ${F.usd(lowest.median)}.</p>`
  );

  const fig = figure(byId('q1-chart'), {
    title: 'Median sale price by city',
    subtitle: `${PRICE_RULE}. Highest median highlighted.`,
  });
  const chartRows = cities.map((c) => ({
    label: c.city,
    value: c.median,
    display: F.usd(c.median),
    cls: topNames.has(c.city) ? 'accent' : 'quiet',
    tip: { title: c.city, rows: [['Median sale price', F.usd(c.median)], ['Sales', F.int(c.n)]] },
  }));
  mount(fig.body, (width) =>
    rankedRows(fig.body, width, {
      rows: chartRows,
      xFormat: F.usdShort,
      xTitle: 'Median sale price',
      ariaLabel: 'Bar chart of median sale price for each city',
    })
  );
  fig.setTable(
    [
      { label: 'City', value: (c) => c.city },
      { label: 'Median sale price', value: (c) => F.usd(c.median), numeric: true },
      { label: 'Sales', value: (c) => F.int(c.n), numeric: true },
    ],
    cities.map((c) => ({ ...c, isKey: topNames.has(c.city) }))
  );
}

// ---------- Q2 ----------

function renderQ2(rows) {
  const { cities, top } = A.q2(rows);
  const topNames = new Set(top.map((c) => c.city));
  const t = top[0];

  const outliers =
    t.overMax > 1
      ? `${F.int(t.overMax)} sales above ${F.usd(A.PRICE_MAX)}, the largest recorded at ${strong(F.usd(t.largest))}`
      : `one sale recorded at ${strong(F.usd(t.largest))}`;
  setAnswer(
    'q2-answer',
    `<p>${strong(t.city)} has the mean furthest above its median. Using all rows, its mean sale price is ` +
      `${strong(F.usd(t.mean))} and its median is ${strong(F.usd(t.median))}, a gap of ${strong(F.pct(t.gapPct))} of the median.</p>` +
      `<p><span class="answer-lead">What causes it:</span> ${escapeHtml(t.city)} has ${outliers}. ` +
      `A mean adds every price together, so one extreme row pulls it up, while the median only looks at the middle sale and barely moves. ` +
      `Without that single largest sale, the mean would be ${F.usd(t.meanWithoutLargest)} and the gap would shrink to ${F.pct(t.gapPctWithoutLargest)}.</p>`
  );

  const fig = figure(byId('q2-chart'), {
    title: 'Mean and median sale price by city, all rows',
    subtitle: 'No price rule applied. Sorted by how far the mean sits above the median.',
    legend: [
      { shape: 'ring', cls: 'quiet', label: 'Median' },
      { shape: 'dot', cls: 'quiet', label: 'Mean' },
      { shape: 'dot', cls: 'accent', label: 'Largest gap' },
    ],
  });
  const chartRows = cities.map((c) => ({
    label: c.city,
    a: c.median,
    b: c.mean,
    display: F.signedPct(c.gapPct),
    cls: topNames.has(c.city) ? 'accent' : 'quiet',
    tip: {
      title: c.city,
      rows: [
        ['Mean', F.usd(c.mean)],
        ['Median', F.usd(c.median)],
        ['Gap', F.signedPct(c.gapPct)],
        ['Sales', F.int(c.n)],
        ['Largest sale', F.usd(c.largest)],
      ],
    },
  }));
  mount(fig.body, (width) =>
    dumbbell(fig.body, width, {
      rows: chartRows,
      xFormat: F.usdShort,
      xTitle: 'Sale price',
      valueHeader: 'Gap',
      ariaLabel: 'Dumbbell chart of mean and median sale price for each city',
    })
  );
  fig.setTable(
    [
      { label: 'City', value: (c) => c.city },
      { label: 'Mean', value: (c) => F.usd(c.mean), numeric: true },
      { label: 'Median', value: (c) => F.usd(c.median), numeric: true },
      { label: 'Gap', value: (c) => F.signedPct(c.gapPct), numeric: true },
      { label: 'Sales', value: (c) => F.int(c.n), numeric: true },
    ],
    cities.map((c) => ({ ...c, isKey: topNames.has(c.city) }))
  );
}

// ---------- Q3 ----------

function renderQ3(rows) {
  const { cities, changed } = A.q3(rows);
  const unchanged = cities.length - changed.length;

  let html;
  if (!changed.length) {
    html = `<p>No city changes rank. All ${cities.length} cities keep the same position with and without the price rule.</p>`;
  } else {
    // Largest moves first.
    const ordered = changed.slice().sort((a, b) => Math.abs(b.moved) - Math.abs(a.moved) || a.rankAll - b.rankAll);
    const items = ordered
      .map((c) => {
        const places = Math.abs(c.moved);
        return (
          `<li>${strong(c.city)} ${c.moved > 0 ? 'moves up' : 'moves down'} ${strong(`${places} ${places === 1 ? 'position' : 'positions'}`)}, ` +
          `from ${ordinal(c.rankAll)} to ${ordinal(c.rankValid)} ` +
          `<span class="answer-detail">(mean ${F.usd(c.meanAll)} with all rows, ${F.usd(c.meanValid)} with the price rule)</span></li>`
        );
      })
      .join('');
    html =
      `<p>${strong(`${changed.length} ${changed.length === 1 ? 'city changes' : 'cities change'} rank`)} when the price rule is applied:</p>` +
      `<ul>${items}</ul>` +
      `<p>The other ${unchanged} cities keep the same rank.</p>`;
  }
  setAnswer('q3-answer', html);

  const fig = figure(byId('q3-chart'), {
    title: 'City rank by mean sale price, before and after the price rule',
    subtitle: `Rank 1 is the highest mean. Left: all rows. Right: ${PRICE_RULE.toLowerCase()}.`,
    legend: [
      { shape: 'line', cls: 'accent', label: 'Moved down' },
      { shape: 'line', cls: 'accent2', label: 'Moved up' },
      { shape: 'line', cls: 'quiet', label: 'Same rank' },
    ],
  });
  const chartRows = cities.map((c) => ({
    label: c.city,
    left: c.rankAll,
    right: c.rankValid,
    cls: c.moved < 0 ? 'accent' : c.moved > 0 ? 'accent2' : 'quiet',
    tip: {
      title: c.city,
      rows: [
        ['Rank, all rows', ordinal(c.rankAll)],
        ['Mean, all rows', F.usd(c.meanAll)],
        ['Rank, price rule', ordinal(c.rankValid)],
        ['Mean, price rule', F.usd(c.meanValid)],
        ['Rows left out', F.int(c.nAll - c.nValid)],
      ],
    },
  }));
  mount(fig.body, (width) =>
    slope(fig.body, width, {
      rows: chartRows,
      leftTitle: 'All rows',
      rightTitle: 'Price rule',
      ariaLabel: 'Slope chart of city ranks by mean sale price, using all rows and using the price rule',
    })
  );
  fig.setTable(
    [
      { label: 'City', value: (c) => c.city },
      { label: 'Rank, all rows', value: (c) => String(c.rankAll), numeric: true },
      { label: 'Mean, all rows', value: (c) => F.usd(c.meanAll), numeric: true },
      { label: 'Rank, price rule', value: (c) => String(c.rankValid), numeric: true },
      { label: 'Mean, price rule', value: (c) => F.usd(c.meanValid), numeric: true },
    ],
    cities.map((c) => ({ ...c, isKey: c.moved !== 0 }))
  );
}

// ---------- Q4 ----------

function renderQ4(rows) {
  const { campuses, top, decreased } = A.q4(rows);
  const topNames = new Set(top.map((c) => c.campus));
  const t = top[0];

  const decreaseText = decreased.length
    ? `${strong(`${decreased.length} campus ${decreased.length === 1 ? 'area' : 'areas'}`)} had a decrease: ` +
      F.listJoin(
        decreased
          .slice()
          .sort((a, b) => a.pct - b.pct)
          .map((c) => `${strong(c.campus)} (${F.signedPct(c.pct)}, from ${F.usd(c.median2024)} to ${F.usd(c.median2025)})`)
      ) +
      '.'
    : 'No campus area had a decrease.';
  setAnswer(
    'q4-answer',
    `<p>${F.listJoin(top.map((c) => strong(c.campus)))} had the largest increase: its median sale price rose ` +
      `${strong(F.signedPct(t.pct))}, from ${F.usd(t.median2024)} in 2024 to ${F.usd(t.median2025)} in 2025.</p>` +
      `<p>${decreaseText}</p>`
  );

  const fig = figure(byId('q4-chart'), {
    title: 'Change in median sale price from 2024 to 2025, by campus area',
    subtitle: `${PRICE_RULE}, by year of sale.`,
    legend: [
      { cls: 'accent', label: 'Largest increase' },
      { cls: 'accent2', label: 'Decrease' },
      { cls: 'quiet', label: 'Other increases' },
    ],
  });
  const chartRows = campuses.map((c) => ({
    label: A.campusShort(c.campus),
    value: c.pct,
    display: F.signedPct(c.pct),
    cls: topNames.has(c.campus) ? 'accent' : c.pct < 0 ? 'accent2' : 'quiet',
    tip: {
      title: c.campus,
      rows: [
        ['Change', F.signedPct(c.pct)],
        ['2024 median', F.usd(c.median2024)],
        ['2025 median', F.usd(c.median2025)],
        ['2024 sales', F.int(c.n2024)],
        ['2025 sales', F.int(c.n2025)],
      ],
    },
  }));
  mount(fig.body, (width) =>
    rankedRows(fig.body, width, {
      rows: chartRows,
      xFormat: (v) => F.signedPct(v).replace('.0%', '%'),
      xTitle: 'Change in median sale price, 2024 to 2025',
      ariaLabel: 'Bar chart of the percent change in median sale price from 2024 to 2025 for each campus area',
    })
  );
  fig.setTable(
    [
      { label: 'Campus area', value: (c) => c.campus },
      { label: '2024 median', value: (c) => F.usd(c.median2024), numeric: true },
      { label: '2025 median', value: (c) => F.usd(c.median2025), numeric: true },
      { label: 'Change', value: (c) => F.signedPct(c.pct), numeric: true },
    ],
    campuses.map((c) => ({ ...c, isKey: topNames.has(c.campus) || c.pct < 0 }))
  );
}

// ---------- Q5 ----------

function renderQ5(rows) {
  const { campuses, slowest, fastest } = A.q5(rows);
  const slowNames = new Set(slowest.map((c) => c.campus));
  const fastNames = new Set(fastest.map((c) => c.campus));
  const used = A.sum(campuses.map((c) => c.n));

  const tieNote = (list) => (list.length > 1 ? `, a ${list.length}-way tie` : '');
  setAnswer(
    'q5-answer',
    `<p><span class="answer-lead">Slowest:</span> ${F.listJoin(slowest.map((c) => strong(c.campus)))}, with a median of ` +
      `${strong(F.days(slowest[0].median))} on market${tieNote(slowest)}.</p>` +
      `<p><span class="answer-lead">Fastest:</span> ${F.listJoin(fastest.map((c) => strong(c.campus)))}, ` +
      `${fastest.length > 1 ? 'each ' : ''}with a median of ${strong(F.days(fastest[0].median))}${tieNote(fastest)}.</p>` +
      `<p class="answer-detail">Based on the ${F.int(used)} sales that have both a list date and a contract date.</p>`
  );

  const fig = figure(byId('q5-chart'), {
    title: 'Days on market by campus area',
    subtitle: 'Thick line: median. Box: the middle half of sales. Thin line: 10th to 90th percentile.',
    legend: [
      { cls: 'accent', label: 'Slowest' },
      { cls: 'accent2', label: 'Fastest' },
      { cls: 'quiet', label: 'Other campus areas' },
    ],
  });
  const chartRows = campuses.map((c) => ({
    label: A.campusShort(c.campus),
    ...c,
    display: F.days(c.median),
    cls: slowNames.has(c.campus) ? 'accent' : fastNames.has(c.campus) ? 'accent2' : 'quiet',
    tip: {
      title: c.campus,
      rows: [
        ['Median', F.days(c.median)],
        ['Middle half', `${F.one(c.q1)} to ${F.days(c.q3)}`],
        ['10th to 90th percentile', `${F.one(c.p10)} to ${F.days(c.p90)}`],
        ['Sales with both dates', F.int(c.n)],
      ],
    },
  }));
  mount(fig.body, (width) =>
    boxRows(fig.body, width, {
      rows: chartRows,
      xFormat: F.int,
      xTitle: 'Days from listing to contract',
      valueHeader: 'Median',
      ariaLabel: 'Box plot of days on market for each campus area',
    })
  );
  fig.setTable(
    [
      { label: 'Campus area', value: (c) => c.campus },
      { label: 'Median days', value: (c) => F.one(c.median), numeric: true },
      { label: '25th percentile', value: (c) => F.one(c.q1), numeric: true },
      { label: '75th percentile', value: (c) => F.one(c.q3), numeric: true },
      { label: 'Sales used', value: (c) => F.int(c.n), numeric: true },
    ],
    campuses.map((c) => ({ ...c, isKey: slowNames.has(c.campus) || fastNames.has(c.campus) }))
  );
}

// ---------- Q6 ----------

function renderQ6(rows) {
  const { campuses, highest, lowest, rowsUsed } = A.q6(rows);
  const highNames = new Set(highest.map((c) => c.campus));
  const lowNames = new Set(lowest.map((c) => c.campus));
  const h = highest[0];
  const l = lowest[0];

  setAnswer(
    'q6-answer',
    `<p><span class="answer-lead">Highest:</span> ${F.listJoin(highest.map((c) => strong(c.campus)))}, where annual property tax adds up to ` +
      `${strong(F.pct2(h.pct))} of sale prices (${F.usd(h.taxTotal)} of tax on ${F.usd(h.priceTotal)} of sales).</p>` +
      `<p><span class="answer-lead">Lowest:</span> ${F.listJoin(lowest.map((c) => strong(c.campus)))}, at ${strong(F.pct2(l.pct))} ` +
      `(${F.usd(l.taxTotal)} on ${F.usd(l.priceTotal)}).</p>` +
      `<p class="answer-detail">Based on ${F.int(rowsUsed)} sales with a valid price and a tax amount above $0 and below 10% of the sale price.</p>`
  );

  const fig = figure(byId('q6-chart'), {
    title: 'Annual property tax as a percent of sale price, by campus area',
    subtitle: 'Total tax divided by total sale price for each campus area.',
    legend: [
      { shape: 'dot', cls: 'accent', label: 'Highest' },
      { shape: 'dot', cls: 'accent2', label: 'Lowest' },
      { shape: 'dot', cls: 'quiet', label: 'Other campus areas' },
    ],
  });
  const chartRows = campuses.map((c) => ({
    label: A.campusShort(c.campus),
    value: c.pct,
    display: F.pct2(c.pct),
    cls: highNames.has(c.campus) ? 'accent' : lowNames.has(c.campus) ? 'accent2' : 'quiet',
    tip: {
      title: c.campus,
      rows: [
        ['Tax as % of price', F.pct2(c.pct)],
        ['Total annual tax', F.usd(c.taxTotal)],
        ['Total sale price', F.usd(c.priceTotal)],
        ['Sales used', F.int(c.n)],
      ],
    },
  }));
  mount(fig.body, (width) =>
    rankedRows(fig.body, width, {
      rows: chartRows,
      mark: 'lollipop',
      xFormat: (v) => `${F.one(v)}%`,
      xTitle: 'Total annual property tax as a percent of total sale price',
      ariaLabel: 'Dot chart of property tax as a percent of sale price for each campus area',
    })
  );
  fig.setTable(
    [
      { label: 'Campus area', value: (c) => c.campus },
      { label: 'Tax as % of price', value: (c) => F.pct2(c.pct), numeric: true },
      { label: 'Total annual tax', value: (c) => F.usd(c.taxTotal), numeric: true },
      { label: 'Total sale price', value: (c) => F.usd(c.priceTotal), numeric: true },
      { label: 'Sales used', value: (c) => F.int(c.n), numeric: true },
    ],
    campuses.map((c) => ({ ...c, isKey: highNames.has(c.campus) || lowNames.has(c.campus) }))
  );
}

export function renderFixedQuestions(rows) {
  renderQ1(rows);
  renderQ2(rows);
  renderQ3(rows);
  renderQ4(rows);
  renderQ5(rows);
  renderQ6(rows);
}
