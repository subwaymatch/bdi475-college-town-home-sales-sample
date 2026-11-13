// Q7 to Q10: questions whose answers depend on settings the visitor chooses.
// Each one recomputes its answer and redraws its chart from the data whenever a setting changes.

import * as A from './analysis.js';
import * as F from './format.js';
import * as url from './url.js';
import { figure, mount, rankedRows, columns, histogram, emptyState } from './charts.js';
import { fillSelect, moneyInput, numberInput } from './controls.js';

const { strong, escapeHtml } = F;

function byId(id) {
  return document.getElementById(id);
}

function setAnswer(id, html) {
  byId(id).innerHTML = html;
}

// A note for answers that rest on very few sales.
function smallGroupNote(n) {
  return n < 10 ? ` That median rests on only ${F.sales(n)}, so treat it with caution.` : '';
}

const SCOPE_NOTE = `The price rule still applies: only sales from ${F.usd(A.PRICE_MIN)} to ${F.usd(A.PRICE_MAX)} are counted.`;

// ---------- Q7 ----------

function initQ7(rows) {
  const DEFAULT = 3;
  const bedOptions = A.uniqueSorted(rows.filter((r) => r.beds != null).map((r) => r.beds));
  const select = byId('q7-beds');
  let beds = url.readNumber('q7beds');
  if (!bedOptions.includes(beds)) beds = DEFAULT;
  fillSelect(select, bedOptions.map((b) => ({ value: b, label: `${b} ${b === 1 ? 'bedroom' : 'bedrooms'}` })), beds);

  const fig = figure(byId('q7-chart'), {});
  let draw = null;
  const chart = mount(fig.body, (width) => draw && draw(width));

  function update() {
    const result = A.q7(rows, beds);
    const lowNames = new Set(result.lowest.map((c) => c.city));
    const label = `${beds}-bedroom`;
    fig.setTitle(`Median sale price of ${label} homes by city`);
    fig.setSubtitle(`Homes with exactly ${beds} ${beds === 1 ? 'bedroom' : 'bedrooms'}, sold from ${F.usd(A.PRICE_MIN)} to ${F.usd(A.PRICE_MAX)}. Lowest median highlighted.`);

    if (!result.total) {
      setAnswer('q7-answer', `<p>No ${label} homes sold within the price rule, so there is no median to report. Try another number of bedrooms.</p>`);
      draw = () => emptyState(fig.body, `No ${label} homes were sold from ${F.usd(A.PRICE_MIN)} to ${F.usd(A.PRICE_MAX)}. Try another number of bedrooms.`);
      fig.setTable([], []);
    } else {
      const low = result.lowest[0];
      const withSales = result.cities.filter((c) => c.n > 0);
      const highest = withSales[withSales.length - 1];
      const missing = result.cities.length - withSales.length;
      setAnswer(
        'q7-answer',
        `<p>For ${strong(`${label} homes`)}, ${F.listJoin(result.lowest.map((c) => strong(c.city)))} ${result.lowest.length > 1 ? 'have' : 'has'} the lowest median sale price: ` +
          `${strong(F.usd(low.median))}, from ${strong(F.sales(low.n))}.${smallGroupNote(low.n)}</p>` +
          `<p>${withSales.length > 1 ? `The highest is ${escapeHtml(highest.city)} at ${F.usd(highest.median)} (${F.sales(highest.n)}). ` : ''}` +
          `${F.sales(result.total)} in all match this bedroom count${missing ? `, and ${missing} ${missing === 1 ? 'city has' : 'cities have'} none` : ''}.</p>`
      );
      const chartRows = result.cities.map((c) => ({
        label: c.city,
        value: c.median,
        display: `${F.usd(c.median)} · ${F.sales(c.n)}`,
        cls: lowNames.has(c.city) ? 'accent' : 'quiet',
        tip: { title: c.city, rows: c.n ? [['Median sale price', F.usd(c.median)], ['Sales', F.int(c.n)]] : [['Sales', '0']] },
      }));
      draw = (width) =>
        rankedRows(fig.body, width, {
          rows: chartRows,
          xFormat: F.usdShort,
          xTitle: 'Median sale price',
          emptyText: 'No sales',
          ariaLabel: `Bar chart of median sale price of ${label} homes for each city`,
        });
      fig.setTable(
        [
          { label: 'City', value: (c) => c.city },
          { label: 'Median sale price', value: (c) => F.usd(c.median), numeric: true },
          { label: 'Sales', value: (c) => F.int(c.n), numeric: true },
        ],
        result.cities.map((c) => ({ ...c, isKey: lowNames.has(c.city) }))
      );
    }
    chart.update();
  }

  select.addEventListener('change', () => {
    beds = Number(select.value);
    url.write({ q7beds: beds === DEFAULT ? null : beds });
    update();
  });
  update();
}

// ---------- Q8 ----------

function initQ8(rows) {
  const DEFAULT_MIN = 200000;
  const DEFAULT_MAX = 400000;
  let min = url.read('q8min') != null ? url.readNumber('q8min') : DEFAULT_MIN;
  let max = url.read('q8max') != null ? url.readNumber('q8max') : DEFAULT_MAX;

  const fig = figure(byId('q8-chart'), {});
  let draw = null;
  const chart = mount(fig.body, (width) => draw && draw(width));
  const note = byId('q8-note');

  function update() {
    url.write({ q8min: min === DEFAULT_MIN ? null : min ?? 'any', q8max: max === DEFAULT_MAX ? null : max ?? 'any' });
    const { lo, hi, clamped } = A.clampPriceRange(min, max);
    const rangeText = `${F.usd(lo)} to ${F.usd(hi)}`;
    fig.setTitle('Median days on market by city');
    fig.setSubtitle(`Sales priced from ${rangeText} that have both a list date and a contract date. Shortest median highlighted.`);
    note.hidden = !clamped || lo > hi;
    note.textContent = `${SCOPE_NOTE} Your range is read as ${rangeText}.`;

    const result = lo > hi ? { total: 0, cities: [], shortest: [] } : A.q8(rows, min, max);
    if (!result.total) {
      const why =
        min != null && max != null && min > max
          ? 'The minimum price is above the maximum price. Swap them or widen the range.'
          : lo > hi
            ? `That range falls outside the price rule (${F.usd(A.PRICE_MIN)} to ${F.usd(A.PRICE_MAX)}).`
            : `No sales priced from ${rangeText} have both dates. Try a wider price range.`;
      setAnswer('q8-answer', `<p>There is no answer for this price range. ${escapeHtml(why)}</p>`);
      draw = () => emptyState(fig.body, why);
      fig.setTable([], []);
    } else {
      const shortNames = new Set(result.shortest.map((c) => c.city));
      const s = result.shortest[0];
      const withSales = result.cities.filter((c) => c.n > 0);
      const longest = withSales[withSales.length - 1];
      const missing = result.cities.length - withSales.length;
      setAnswer(
        'q8-answer',
        `<p>For sales priced from ${strong(rangeText)}, ${F.listJoin(result.shortest.map((c) => strong(c.city)))} ${result.shortest.length > 1 ? 'have' : 'has'} the shortest median days on market: ` +
          `${strong(F.days(s.median))}${result.shortest.length > 1 ? ' each' : `, from ${strong(F.sales(s.n))}`}.${result.shortest.length === 1 ? smallGroupNote(s.n) : ''}</p>` +
          `<p>${withSales.length > 1 ? `The longest is ${escapeHtml(longest.city)} at ${F.days(longest.median)} (${F.sales(longest.n)}). ` : ''}` +
          `${F.sales(result.total)} in this range have both dates${missing ? `, and ${missing} ${missing === 1 ? 'city has' : 'cities have'} none` : ''}.</p>`
      );
      const chartRows = result.cities.map((c) => ({
        label: c.city,
        value: c.median,
        display: `${F.days(c.median)} · ${F.sales(c.n)}`,
        cls: shortNames.has(c.city) ? 'accent' : 'quiet',
        tip: { title: c.city, rows: c.n ? [['Median days on market', F.days(c.median)], ['Sales used', F.int(c.n)]] : [['Sales used', '0']] },
      }));
      draw = (width) =>
        rankedRows(fig.body, width, {
          rows: chartRows,
          mark: 'lollipop',
          xFormat: F.int,
          xTitle: 'Median days from listing to contract',
          emptyText: 'No sales',
          ariaLabel: 'Dot chart of median days on market for each city',
        });
      fig.setTable(
        [
          { label: 'City', value: (c) => c.city },
          { label: 'Median days on market', value: (c) => (c.median == null ? F.one(null) : F.one(c.median)), numeric: true },
          { label: 'Sales used', value: (c) => F.int(c.n), numeric: true },
        ],
        result.cities.map((c) => ({ ...c, isKey: shortNames.has(c.city) }))
      );
    }
    chart.update();
  }

  moneyInput(byId('q8-min'), min, (value) => {
    min = value;
    update();
  });
  moneyInput(byId('q8-max'), max, (value) => {
    max = value;
    update();
  });
  update();
}

// ---------- Q9 ----------

function initQ9(rows) {
  const cities = A.allCities(rows);
  const years = A.uniqueSorted(rows.filter((r) => r.year != null).map((r) => r.year));
  const saleDates = rows.filter((r) => r.sale).map((r) => r.sale).sort();
  const firstSale = saleDates[0];
  const lastSale = saleDates[saleDates.length - 1];
  const DEFAULT_CITY = cities.includes('Champaign, IL') ? 'Champaign, IL' : cities[0];
  const DEFAULT_YEAR = years.includes(2025) ? 2025 : years[years.length - 1];

  let city = cities.find((c) => A.slugify(c) === url.read('q9city')) || DEFAULT_CITY;
  let year = years.includes(url.readNumber('q9year')) ? url.readNumber('q9year') : DEFAULT_YEAR;
  const citySelect = byId('q9-city');
  const yearSelect = byId('q9-year');
  fillSelect(citySelect, cities.map((c) => ({ value: c, label: c })), city);
  fillSelect(yearSelect, years.map((y) => ({ value: y, label: String(y) })), year);

  const fig = figure(byId('q9-chart'), {});
  let draw = null;
  const chart = mount(fig.body, (width) => draw && draw(width));

  function update() {
    url.write({ q9city: city === DEFAULT_CITY ? null : A.slugify(city), q9year: year === DEFAULT_YEAR ? null : year });
    const result = A.q9(rows, city, year);
    const busyMonths = new Set(result.busiest.map((m) => m.month));
    fig.setTitle(`Sales recorded each month in ${city}, ${year}`);
    fig.setSubtitle('All rows with a sale date, by month of sale. No price rule. Busiest month highlighted.');
    // The first and last years in the data are not complete years.
    let partial = '';
    if (Number(lastSale.slice(0, 4)) === year && Number(lastSale.slice(5, 7)) < 12) {
      partial = ` The data ends in ${F.MONTHS[Number(lastSale.slice(5, 7)) - 1]} ${year}, so later months show no sales.`;
    } else if (Number(firstSale.slice(0, 4)) === year && Number(firstSale.slice(5, 7)) > 1) {
      partial = ` The data starts in ${F.MONTHS[Number(firstSale.slice(5, 7)) - 1]} ${year}, so earlier months show no sales.`;
    }

    if (!result.total) {
      setAnswer('q9-answer', `<p>No sales were recorded in ${escapeHtml(city)} in ${year}.${partial}</p>`);
      draw = () => emptyState(fig.body, `No sales were recorded in ${city} in ${year}. Try another city or year.`);
      fig.setTable([], []);
    } else {
      const top = result.busiest[0];
      setAnswer(
        'q9-answer',
        `<p>In ${strong(city)} in ${strong(String(year))}, ${F.listJoin(result.busiest.map((m) => strong(F.MONTHS[m.month - 1])))} ` +
          `had the most sales: ${strong(F.int(top.n))}${result.busiest.length > 1 ? ' each' : ''}.</p>` +
          `<p>${F.sales(result.total)} were recorded across the year.${partial}</p>`
      );
      const cols = result.months.map((m) => ({
        label: F.MONTHS_SHORT[m.month - 1],
        value: m.n,
        display: F.int(m.n),
        cls: busyMonths.has(m.month) ? 'accent' : 'quiet',
        tip: { title: `${F.MONTHS[m.month - 1]} ${year}`, rows: [['Sales', F.int(m.n)]] },
      }));
      draw = (width) =>
        columns(fig.body, width, {
          cols,
          yFormat: F.int,
          yTitle: 'Sales',
          xTitle: `Month of sale, ${year}`,
          ariaLabel: `Column chart of sales in each month of ${year} in ${city}`,
        });
      fig.setTable(
        [
          { label: 'Month', value: (m) => F.MONTHS[m.month - 1] },
          { label: 'Sales', value: (m) => F.int(m.n), numeric: true },
        ],
        result.months.map((m) => ({ ...m, isKey: busyMonths.has(m.month) }))
      );
    }
    chart.update();
  }

  citySelect.addEventListener('change', () => {
    city = citySelect.value;
    update();
  });
  yearSelect.addEventListener('change', () => {
    year = Number(yearSelect.value);
    update();
  });
  update();
}

// ---------- Q10 ----------

function initQ10(rows) {
  const campuses = A.allCampuses(rows);
  const DEFAULT_CAMPUS = campuses.includes('University of Illinois Urbana-Champaign') ? 'University of Illinois Urbana-Champaign' : campuses[0];
  const DEFAULT_BUDGET = 400000;
  const DEFAULT_BEDS = 3;
  const BIN = 0.5;

  let campus = campuses.find((c) => A.campusSlug(c) === url.read('q10campus')) || DEFAULT_CAMPUS;
  let budget = url.read('q10budget') != null ? url.readNumber('q10budget') : DEFAULT_BUDGET;
  let minBeds = url.read('q10beds') != null ? url.readNumber('q10beds') : DEFAULT_BEDS;
  const select = byId('q10-campus');
  fillSelect(select, campuses.map((c) => ({ value: c, label: c })), campus);

  const fig = figure(byId('q10-chart'), {});
  let draw = null;
  const chart = mount(fig.body, (width) => draw && draw(width));
  const note = byId('q10-note');

  function update() {
    url.write({
      q10campus: campus === DEFAULT_CAMPUS ? null : A.campusSlug(campus),
      q10budget: budget === DEFAULT_BUDGET ? null : budget ?? 'any',
      q10beds: minBeds === DEFAULT_BEDS ? null : minBeds ?? 'any',
    });
    // An empty budget means "no maximum" (the price rule's top still applies). Empty bedrooms means "any".
    const budgetUsed = budget == null ? A.PRICE_MAX : budget;
    const bedsUsed = minBeds == null ? 0 : minBeds;
    const result = A.q10(rows, campus, budgetUsed, bedsUsed);
    const short = A.campusShort(campus);
    const bedsText = `${F.int(bedsUsed)} or more ${bedsUsed === 1 ? 'bedroom' : 'bedrooms'}`;
    const priceText = `${F.usd(result.hi)} or less`;
    note.hidden = budgetUsed <= A.PRICE_MAX && budgetUsed >= A.PRICE_MIN;
    note.textContent = budgetUsed > A.PRICE_MAX ? `${SCOPE_NOTE} Your budget is read as ${F.usd(A.PRICE_MAX)}.` : `${SCOPE_NOTE} A budget below ${F.usd(A.PRICE_MIN)} matches no sales.`;
    fig.setTitle(`Distance to campus for matching homes near ${short}`);
    fig.setSubtitle(`Sales near ${campus} priced from ${F.usd(A.PRICE_MIN)} to ${F.usd(result.hi)} with ${bedsText}. Each bar covers half a mile.`);

    if (!result.n) {
      setAnswer('q10-answer', `<p>No sales near ${escapeHtml(campus)} match a budget of ${escapeHtml(priceText)} with ${escapeHtml(bedsText)}, so there is no median distance. Try a higher budget or fewer bedrooms.</p>`);
      draw = () => emptyState(fig.body, 'No sales meet these conditions. Try a higher budget or fewer bedrooms.');
      fig.setTable([], []);
    } else {
      setAnswer(
        'q10-answer',
        `<p>Near ${strong(campus)}, homes that sold for ${strong(priceText)} with ${strong(bedsText)} are a median of ` +
          `${strong(F.miles(result.median))} from campus.</p>` +
          `<p>${strong(F.sales(result.n))} meet these conditions.${smallGroupNote(result.n)} ` +
          `The closest is ${F.miles(result.miles[0])} away and the farthest ${F.miles(result.miles[result.miles.length - 1])}.</p>`
      );
      // Half-mile bins. The axis covers every sale in this campus area, so it stays put as the settings change.
      const campusMax = Math.max(...rows.filter((r) => r.campus === campus && r.miles != null).map((r) => r.miles));
      const binCount = Math.max(1, Math.floor(campusMax / BIN) + 1);
      const bins = Array.from({ length: binCount }, (_, i) => ({ x0: i * BIN, x1: (i + 1) * BIN, n: 0 }));
      for (const m of result.miles) bins[Math.min(binCount - 1, Math.floor(m / BIN))].n += 1;
      for (const b of bins) {
        b.tip = { title: `${F.one(b.x0)} to under ${F.one(b.x1)} miles from campus`, rows: [['Sales', F.int(b.n)]] };
      }
      draw = (width) =>
        histogram(fig.body, width, {
          bins,
          yFormat: F.int,
          xFormat: (v) => F.int(v),
          yTitle: 'Sales',
          xTitle: 'Straight-line miles to campus',
          marker: { value: result.median, label: `Median ${F.miles(result.median)}` },
          ariaLabel: `Histogram of distance to campus for matching sales near ${campus}`,
        });
      fig.setTable(
        [
          { label: 'Miles to campus', value: (b) => `${F.one(b.x0)} to under ${F.one(b.x1)}` },
          { label: 'Sales', value: (b) => F.int(b.n), numeric: true },
        ],
        bins
      );
    }
    chart.update();
  }

  select.addEventListener('change', () => {
    campus = select.value;
    update();
  });
  moneyInput(byId('q10-budget'), budget, (value) => {
    budget = value;
    update();
  });
  numberInput(byId('q10-beds'), minBeds, (value) => {
    minBeds = value == null ? null : Math.max(0, Math.floor(value));
    update();
  });
  update();
}

export function renderLiveQuestions(rows) {
  initQ7(rows);
  initQ8(rows);
  initQ9(rows);
  initQ10(rows);
}
