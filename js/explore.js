// The Explore section: filters, key numbers, map, charts, comparison and sortable table.
// One set of filters scopes everything in the section, so the numbers always agree.

import * as A from './analysis.js';
import * as F from './format.js';
import * as url from './url.js';
import { figure, mount, histogram, line, campusMap, emptyState } from './charts.js';
import { fillSelect, moneyInput, rangeControl } from './controls.js';

const d3 = window.d3;

function byId(id) {
  return document.getElementById(id);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const FEATURE_KEYS = ['garage', 'basement', 'fireplace'];
const FEATURE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
];
const BED_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6 or more' },
];

// Which side of its marker each campus label sits on, so neighbors do not collide.
const LABEL_SIDE = {
  'uc-davis': 'right',
  iowa: 'left',
  wisconsin: 'left',
  illinois: 'bottom',
  purdue: 'right',
  michigan: 'top',
  'penn-state': 'right',
  virginia: 'right',
  unc: 'right',
  georgia: 'left',
  florida: 'right',
};

// Lucide "chevrons-up-down". The arrow for the active sort direction is highlighted in CSS.
const SORT_ICON =
  '<svg class="sort-icon" viewBox="0 0 24 24" aria-hidden="true"><path class="sort-up" d="m7 9 5-5 5 5"/><path class="sort-down" d="m7 15 5 5 5-5"/></svg>';

export function initExplore(rows, mapDataPromise) {
  const campuses = A.allCampuses(rows);
  const cities = A.allCities(rows);
  const years = A.uniqueSorted(rows.filter((r) => r.year != null).map((r) => r.year));
  const validTotal = A.validRows(rows).length;
  const monthKeys = A.monthKeys(rows);

  // Which cities have sales in each campus area, so the city list can follow the campus filter.
  const citiesByCampus = new Map(campuses.map((c) => [c, A.uniqueSorted(rows.filter((r) => r.campus === c).map((r) => r.city))]));
  const campusBySlug = new Map(campuses.map((c) => [A.campusSlug(c), c]));
  const cityBySlug = new Map(cities.map((c) => [A.slugify(c), c]));

  // Range filter limits come from the data.
  const milesAll = rows.filter((r) => r.miles != null).map((r) => r.miles);
  const builtAll = rows.filter((r) => r.built != null).map((r) => r.built);
  const MILES = { min: 0, max: Math.ceil(Math.max(...milesAll)), step: 0.1 };
  const BUILT = { min: Math.min(...builtAll), max: Math.max(...builtAll), step: 1 };

  // Each campus area sits at the median latitude and longitude of its sales.
  const campusPlaces = campuses.map((c) => ({ campus: c, ...A.medianLocation(rows.filter((r) => r.campus === c)) }));

  // ---------- State, read from the page address ----------

  const inRange = (value, range) => (value != null && value >= range.min && value <= range.max ? value : null);
  const feature = (key) => (FEATURE_OPTIONS.some((o) => o.value === url.read(key)) ? url.read(key) : 'any');
  const state = {
    campus: campusBySlug.get(url.read('campus')) || '',
    city: cityBySlug.get(url.read('city')) || '',
    year: years.includes(url.readNumber('year')) ? url.readNumber('year') : null,
    beds: BED_OPTIONS.some((o) => o.value === url.read('beds')) ? url.read('beds') : '',
    priceMin: url.readNumber('pmin'),
    priceMax: url.readNumber('pmax'),
    milesLo: inRange(url.readNumber('dmin'), MILES) ?? MILES.min,
    milesHi: inRange(url.readNumber('dmax'), MILES) ?? MILES.max,
    builtLo: inRange(url.readNumber('bmin'), BUILT) ?? BUILT.min,
    builtHi: inRange(url.readNumber('bmax'), BUILT) ?? BUILT.max,
    garage: feature('garage'),
    basement: feature('basement'),
    fireplace: feature('fireplace'),
    sort: url.read('sort') || 'n',
    dir: url.read('dir') === 'asc' ? 'asc' : 'desc',
    by: url.read('by') === 'campus' ? 'campus' : 'city',
    a: null,
    b: null,
  };
  if (state.milesLo > state.milesHi) [state.milesLo, state.milesHi] = [state.milesHi, state.milesLo];
  if (state.builtLo > state.builtHi) [state.builtLo, state.builtHi] = [state.builtHi, state.builtLo];
  if (state.campus && state.city && !citiesByCampus.get(state.campus).includes(state.city)) state.city = '';

  const placeFromSlug = (slug) =>
    campusBySlug.has(slug) ? { type: 'campus', name: campusBySlug.get(slug) } : cityBySlug.has(slug) ? { type: 'city', name: cityBySlug.get(slug) } : null;
  const placeSlug = (place) => (place.type === 'campus' ? A.campusSlug(place.name) : A.slugify(place.name));
  const DEFAULT_A = { type: 'campus', name: campuses.includes('University of Illinois Urbana-Champaign') ? 'University of Illinois Urbana-Champaign' : campuses[0] };
  const DEFAULT_B = { type: 'campus', name: campuses.includes('University of Michigan') ? 'University of Michigan' : campuses[campuses.length - 1] };
  state.a = placeFromSlug(url.read('a')) || DEFAULT_A;
  state.b = placeFromSlug(url.read('b')) || DEFAULT_B;

  function saveState() {
    url.write({
      campus: state.campus ? A.campusSlug(state.campus) : null,
      city: state.city ? A.slugify(state.city) : null,
      year: state.year,
      beds: state.beds || null,
      pmin: state.priceMin,
      pmax: state.priceMax,
      dmin: state.milesLo > MILES.min ? state.milesLo : null,
      dmax: state.milesHi < MILES.max ? state.milesHi : null,
      bmin: state.builtLo > BUILT.min ? state.builtLo : null,
      bmax: state.builtHi < BUILT.max ? state.builtHi : null,
      garage: state.garage === 'any' ? null : state.garage,
      basement: state.basement === 'any' ? null : state.basement,
      fireplace: state.fireplace === 'any' ? null : state.fireplace,
      sort: state.sort === 'n' && state.dir === 'desc' ? null : state.sort,
      dir: state.sort === 'n' && state.dir === 'desc' ? null : state.dir,
      by: state.by === 'city' ? null : state.by,
      a: placeSlug(state.a) === placeSlug(DEFAULT_A) ? null : placeSlug(state.a),
      b: placeSlug(state.b) === placeSlug(DEFAULT_B) ? null : placeSlug(state.b),
    });
  }

  // The filter in the form the analysis functions expect. A range at its full extent is "off".
  function currentFilter() {
    return {
      campus: state.campus,
      city: state.city,
      year: state.year,
      beds: state.beds === '' ? null : Number(state.beds),
      priceMin: state.priceMin,
      priceMax: state.priceMax,
      milesMin: state.milesLo > MILES.min ? state.milesLo : null,
      milesMax: state.milesHi < MILES.max ? state.milesHi : null,
      builtMin: state.builtLo > BUILT.min ? state.builtLo : null,
      builtMax: state.builtHi < BUILT.max ? state.builtHi : null,
      garage: state.garage,
      basement: state.basement,
      fireplace: state.fireplace,
    };
  }

  function activeFilterCount() {
    const f = currentFilter();
    return [f.campus, f.city, f.year, f.beds, f.priceMin, f.priceMax, f.milesMin ?? f.milesMax, f.builtMin ?? f.builtMax]
      .filter((v) => v != null && v !== '')
      .length + FEATURE_KEYS.filter((k) => state[k] !== 'any').length;
  }

  // ---------- Controls ----------

  const campusSelect = byId('f-campus');
  const citySelect = byId('f-city');
  const yearSelect = byId('f-year');
  const bedsSelect = byId('f-beds');

  function fillCityOptions() {
    const list = state.campus ? citiesByCampus.get(state.campus) : cities;
    fillSelect(citySelect, [{ value: '', label: state.campus ? 'All cities in this area' : 'All cities' }, ...list.map((c) => ({ value: c, label: c }))], state.city);
  }

  fillSelect(campusSelect, [{ value: '', label: 'All campus areas' }, ...campuses.map((c) => ({ value: c, label: c }))], state.campus);
  fillCityOptions();
  fillSelect(yearSelect, [{ value: '', label: 'All years' }, ...years.map((y) => ({ value: y, label: String(y) }))], state.year ?? '');
  fillSelect(bedsSelect, BED_OPTIONS, state.beds);
  for (const key of FEATURE_KEYS) fillSelect(byId(`f-${key}`), FEATURE_OPTIONS, state[key]);

  function setCampus(campus) {
    state.campus = campus;
    campusSelect.value = campus;
    if (state.city && campus && !citiesByCampus.get(campus).includes(state.city)) state.city = '';
    fillCityOptions();
  }

  campusSelect.addEventListener('change', () => {
    setCampus(campusSelect.value);
    update();
  });
  citySelect.addEventListener('change', () => {
    state.city = citySelect.value;
    update();
  });
  yearSelect.addEventListener('change', () => {
    state.year = yearSelect.value === '' ? null : Number(yearSelect.value);
    update();
  });
  bedsSelect.addEventListener('change', () => {
    state.beds = bedsSelect.value;
    update();
  });
  for (const key of FEATURE_KEYS) {
    byId(`f-${key}`).addEventListener('change', (evt) => {
      state[key] = evt.target.value;
      update();
    });
  }
  const priceMinBox = moneyInput(byId('f-pmin'), state.priceMin, (value) => {
    state.priceMin = value;
    update();
  });
  const priceMaxBox = moneyInput(byId('f-pmax'), state.priceMax, (value) => {
    state.priceMax = value;
    update();
  });
  const milesRange = rangeControl(byId('f-miles'), {
    ...MILES,
    lo: state.milesLo,
    hi: state.milesHi,
    onChange: (lo, hi) => {
      state.milesLo = lo;
      state.milesHi = hi;
      update();
    },
  });
  const builtRange = rangeControl(byId('f-built'), {
    ...BUILT,
    lo: state.builtLo,
    hi: state.builtHi,
    onChange: (lo, hi) => {
      state.builtLo = lo;
      state.builtHi = hi;
      update();
    },
  });

  function resetFilters() {
    Object.assign(state, {
      city: '',
      year: null,
      beds: '',
      priceMin: null,
      priceMax: null,
      milesLo: MILES.min,
      milesHi: MILES.max,
      builtLo: BUILT.min,
      builtHi: BUILT.max,
      garage: 'any',
      basement: 'any',
      fireplace: 'any',
    });
    setCampus('');
    yearSelect.value = '';
    bedsSelect.value = '';
    for (const key of FEATURE_KEYS) byId(`f-${key}`).value = 'any';
    priceMinBox.set(null);
    priceMaxBox.set(null);
    milesRange.set(MILES.min, MILES.max);
    builtRange.set(BUILT.min, BUILT.max);
    update();
  }
  byId('reset-filters').addEventListener('click', resetFilters);

  // Copy a link to the current view.
  const copyButton = byId('copy-link');
  const copyLabel = copyButton.querySelector('.btn-label');
  let copyTimer = null;
  copyButton.addEventListener('click', async () => {
    const link = url.currentLink();
    let ok = false;
    try {
      await navigator.clipboard.writeText(link);
      ok = true;
    } catch (err) {
      // Older browsers: fall back to a temporary text box.
      const box = document.createElement('textarea');
      box.value = link;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      try {
        ok = document.execCommand('copy');
      } catch (err2) {
        ok = false;
      }
      box.remove();
    }
    copyLabel.textContent = ok ? 'Link copied' : 'Copy the address bar instead';
    copyButton.classList.toggle('is-done', ok);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyLabel.textContent = 'Copy link to this view';
      copyButton.classList.remove('is-done');
    }, 2400);
  });

  // ---------- Figures ----------

  const NO_MATCH = 'No sales match these filters. Try widening a range, or reset the filters.';

  const mapFig = figure(byId('map-figure'), {
    title: 'Campus areas',
    subtitle: 'Select a campus area on the map, or with the buttons below it, to filter this whole section. Circle size shows the number of matching sales.',
  });
  const chips = el('div', 'chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Filter by campus area');
  mapFig.body.after(chips);
  let mapData = null;
  let mapPlaces = [];
  const mapChart = mount(mapFig.body, (width) => {
    if (!mapData) return;
    campusMap(mapFig.body, width, {
      states: mapData.states,
      borders: mapData.borders,
      places: mapPlaces,
      anySelected: Boolean(state.campus),
      ariaLabel: 'Map of the United States showing the campus areas',
      onSelect: toggleCampus,
    });
  });
  mapFig.body.classList.add('map-body');
  mapFig.body.appendChild(el('p', 'map-loading', 'Loading the map'));
  mapDataPromise
    .then((data) => {
      mapData = data;
      mapChart.update();
    })
    .catch(() => {
      mapFig.body.replaceChildren(el('p', 'map-loading', 'The map could not be loaded. The buttons below still filter by campus area.'));
    });

  function toggleCampus(campus) {
    setCampus(state.campus === campus ? '' : campus);
    update();
  }

  const trendFig = figure(byId('trend-figure'), {});
  let drawTrend = null;
  const trendChart = mount(trendFig.body, (width) => drawTrend && drawTrend(width));

  const distFig = figure(byId('dist-figure'), {});
  let drawDist = null;
  const distChart = mount(distFig.body, (width) => drawDist && drawDist(width));

  // ---------- Key numbers ----------

  function renderTiles(summary) {
    byId('tile-n').textContent = F.int(summary.n);
    byId('tile-n-note').textContent = `of ${F.int(validTotal)} sales in the price range`;
    byId('tile-price').textContent = F.usd(summary.medianPrice);
    byId('tile-price-note').textContent = summary.n ? `Half sold for less, half for more` : 'No matching sales';
    byId('tile-dom').textContent = F.days(summary.medianDom);
    byId('tile-dom-note').textContent = summary.nDom ? `From ${F.sales(summary.nDom)} with both dates` : 'No matching sales with both dates';
    byId('tile-ppsf').textContent = summary.medianPpsf == null ? F.usd(null) : F.usd(summary.medianPpsf);
    byId('tile-ppsf-note').textContent = summary.nPpsf ? `From ${F.sales(summary.nPpsf)} with a living area` : 'No matching sales with a living area';
  }

  function scopeText() {
    const where = state.city || (state.campus ? `the ${A.campusShort(state.campus)} campus area` : 'all campus areas');
    return `${where}${state.year ? `, ${state.year}` : ''}`;
  }

  // ---------- Map ----------

  function renderMap(listAnywhere) {
    const groups = A.groupBy(listAnywhere, (r) => r.campus);
    const stats = campusPlaces.map((place) => {
      const list = groups.get(place.campus) || [];
      return { ...place, n: list.length, median: list.length ? A.median(list.map((r) => r.price)) : null };
    });
    mapPlaces = stats.map((s) => ({
      key: s.campus,
      label: A.campusShort(s.campus),
      lon: s.lon,
      lat: s.lat,
      n: s.n,
      selected: s.campus === state.campus,
      labelSide: LABEL_SIDE[A.campusSlug(s.campus)],
      tip: {
        title: s.campus,
        rows: [['Matching sales', F.int(s.n)], ['Median sale price', F.usd(s.median)]],
        note: s.campus === state.campus ? 'Select again to clear' : 'Select to filter',
      },
    }));
    mapChart.update();

    chips.replaceChildren();
    for (const s of stats) {
      const chip = el('button', `chip${s.campus === state.campus ? ' is-selected' : ''}`);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(s.campus === state.campus));
      chip.title = s.campus;
      chip.append(el('span', 'chip-name', A.campusShort(s.campus)), el('span', 'chip-count', F.int(s.n)));
      chip.addEventListener('click', () => toggleCampus(s.campus));
      chips.appendChild(chip);
    }
    mapFig.setTable(
      [
        { label: 'Campus area', value: (s) => s.campus },
        { label: 'Matching sales', value: (s) => F.int(s.n), numeric: true },
        { label: 'Median sale price', value: (s) => F.usd(s.median), numeric: true },
      ],
      stats.map((s) => ({ ...s, isKey: s.campus === state.campus }))
    );
  }

  // ---------- Median sale price by month ----------

  function renderTrend(list) {
    trendFig.setTitle('Median sale price by month');
    trendFig.setSubtitle(`Matching sales in ${scopeText()}, by month of sale.`);
    const keys = state.year ? monthKeys.filter((k) => Number(k.slice(0, 4)) === state.year) : monthKeys;
    const months = A.monthlyMedians(list, keys);
    if (!list.length) {
      drawTrend = () => emptyState(trendFig.body, NO_MATCH);
      trendFig.setTable([], []);
    } else {
      const points = months.map((m) => ({
        key: m.key,
        value: m.median,
        tick: state.year ? ((m.month - 1) % 3 === 0 ? F.MONTHS_SHORT[m.month - 1] : null) : m.month === 1 ? String(m.year) : null,
        tip: { title: `${F.MONTHS[m.month - 1]} ${m.year}`, rows: [['Median sale price', F.usd(m.median)], ['Sales', F.int(m.n)]] },
      }));
      drawTrend = (width) =>
        line(trendFig.body, width, {
          points,
          yFormat: F.usdShort,
          yTitle: 'Median sale price',
          xTitle: state.year ? `Month of sale, ${state.year}` : 'Month of sale',
          endLabel: (p) => F.usdShort(p.value),
          ariaLabel: 'Line chart of median sale price by month',
        });
      trendFig.setTable(
        [
          { label: 'Month', value: (m) => `${F.MONTHS[m.month - 1]} ${m.year}` },
          { label: 'Median sale price', value: (m) => F.usd(m.median), numeric: true },
          { label: 'Sales', value: (m) => F.int(m.n), numeric: true },
        ],
        months
      );
    }
    trendChart.update();
  }

  // ---------- Sale price distribution ----------

  function renderDistribution(list, summary) {
    distFig.setTitle('How sale prices are spread');
    if (!list.length) {
      distFig.setSubtitle(`Matching sales in ${scopeText()}.`);
      drawDist = () => emptyState(distFig.body, NO_MATCH);
      distFig.setTable([], []);
      distChart.update();
      return;
    }
    const prices = A.sortedCopy(list.map((r) => r.price));
    const lowest = prices[0];
    // The axis stops at the 99th percentile, so a few very high prices do not flatten the chart.
    const cap = A.quantileSorted(prices, 0.99);
    const step = Math.max(d3.tickStep(lowest, Math.max(cap, lowest + 1), 24), 1000);
    const start = Math.floor(lowest / step) * step;
    const end = Math.max(Math.ceil(cap / step) * step, start + step);
    const count = Math.round((end - start) / step);
    const bins = Array.from({ length: count }, (_, i) => ({ x0: start + i * step, x1: start + (i + 1) * step, n: 0 }));
    const overflow = { x0: end, x1: end + step, n: 0, overflow: true };
    for (const p of prices) {
      if (p >= end) overflow.n += 1;
      else bins[Math.min(count - 1, Math.floor((p - start) / step))].n += 1;
    }
    if (overflow.n) bins.push(overflow);
    for (const b of bins) {
      b.tip = {
        title: b.overflow ? `${F.usd(b.x0)} or more` : `${F.usd(b.x0)} to under ${F.usd(b.x1)}`,
        rows: [['Sales', F.int(b.n)]],
      };
    }
    distFig.setSubtitle(
      `Matching sales in ${scopeText()}. Each bar covers ${F.usd(step)}` + (overflow.n ? `, and the last bar groups every sale of ${F.usd(end)} or more.` : '.')
    );
    drawDist = (width) =>
      histogram(distFig.body, width, {
        bins,
        yFormat: F.int,
        xFormat: F.usdShort,
        yTitle: 'Sales',
        xTitle: 'Sale price',
        marker: { value: Math.min(summary.medianPrice, end + step / 2), label: `Median ${F.usd(summary.medianPrice)}` },
        ariaLabel: 'Histogram of sale prices for the matching sales',
      });
    distFig.setTable(
      [
        { label: 'Sale price', value: (b) => (b.overflow ? `${F.usd(b.x0)} or more` : `${F.usd(b.x0)} to under ${F.usd(b.x1)}`) },
        { label: 'Sales', value: (b) => F.int(b.n), numeric: true },
      ],
      bins
    );
    distChart.update();
  }

  // ---------- Side-by-side comparison ----------

  const placeOptions = [
    { group: 'Campus areas', options: campuses.map((c) => ({ value: `campus:${c}`, label: c })) },
    { group: 'Cities', options: cities.map((c) => ({ value: `city:${c}`, label: c })) },
  ];
  const placeValue = (place) => `${place.type}:${place.name}`;
  const parsePlace = (value) => ({ type: value.slice(0, value.indexOf(':')), name: value.slice(value.indexOf(':') + 1) });
  const cmpA = byId('cmp-a');
  const cmpB = byId('cmp-b');
  fillSelect(cmpA, placeOptions, placeValue(state.a));
  fillSelect(cmpB, placeOptions, placeValue(state.b));
  cmpA.addEventListener('change', () => {
    state.a = parsePlace(cmpA.value);
    update();
  });
  cmpB.addEventListener('change', () => {
    state.b = parsePlace(cmpB.value);
    update();
  });

  const METRICS = [
    { label: 'Number of sales', value: (s) => s.n, format: F.int },
    { label: 'Median sale price', value: (s) => s.medianPrice, format: F.usd },
    { label: 'Median days on market', value: (s) => s.medianDom, format: F.days },
    { label: 'Median price per sq ft', value: (s) => s.medianPpsf, format: (v) => (v == null ? F.usd(null) : F.usd(v)) },
    { label: 'Median distance to campus', value: (s) => s.medianMiles, format: F.miles },
  ];

  function renderCompare(listAnywhere) {
    const pick = (place) => listAnywhere.filter((r) => (place.type === 'campus' ? r.campus === place.name : r.city === place.name));
    const sides = [
      { place: state.a, cls: 'is-a', summary: A.summarize(pick(state.a)) },
      { place: state.b, cls: 'is-b', summary: A.summarize(pick(state.b)) },
    ];
    const host = byId('compare-result');
    host.replaceChildren();
    const head = el('div', 'cmp-row cmp-head');
    for (const side of sides) {
      const cell = el('div', `cmp-cell ${side.cls}`);
      cell.append(el('span', 'cmp-dot'), el('span', 'cmp-name', side.place.name));
      head.appendChild(cell);
    }
    host.appendChild(head);
    for (const metric of METRICS) {
      host.appendChild(el('p', 'cmp-metric', metric.label));
      const row = el('div', 'cmp-row');
      const values = sides.map((side) => metric.value(side.summary));
      const top = Math.max(...values.filter((v) => v != null), 0);
      sides.forEach((side, i) => {
        const cell = el('div', `cmp-cell ${side.cls}`);
        cell.appendChild(el('p', 'cmp-value', metric.format(values[i])));
        const track = el('div', 'cmp-track');
        const bar = el('div', 'cmp-bar');
        bar.style.width = values[i] != null && top > 0 ? `${Math.max(1.5, (values[i] / top) * 100)}%` : '0';
        track.appendChild(bar);
        cell.appendChild(track);
        row.appendChild(cell);
      });
      host.appendChild(row);
    }
    const same = placeValue(state.a) === placeValue(state.b);
    byId('compare-note').textContent =
      (same ? 'Both sides show the same place. Choose a different one to compare. ' : '') +
      'Uses every filter above except campus area and city. Days on market uses sales with both dates.';
  }

  // ---------- Sortable table ----------

  const COLUMNS = [
    { key: 'name', label: () => (state.by === 'campus' ? 'Campus area' : 'City'), value: (g) => g.name, format: (g) => g.name, text: true },
    { key: 'campus', label: () => 'Campus area', value: (g) => g.campusShort, format: (g) => g.campusShort, text: true, cityOnly: true, optional: true },
    { key: 'n', label: () => 'Sales', value: (g) => g.n, format: (g) => F.int(g.n) },
    { key: 'price', label: () => 'Median sale price', value: (g) => g.medianPrice, format: (g) => F.usd(g.medianPrice) },
    { key: 'ppsf', label: () => 'Median price per sq ft', value: (g) => g.medianPpsf, format: (g) => (g.medianPpsf == null ? F.usd(null) : F.usd(g.medianPpsf)), optional: true },
    { key: 'dom', label: () => 'Median days on market', value: (g) => g.medianDom, format: (g) => (g.medianDom == null ? F.one(null) : F.one(g.medianDom)) },
    { key: 'miles', label: () => 'Median miles to campus', value: (g) => g.medianMiles, format: (g) => F.one(g.medianMiles), optional: true },
  ];
  if (!COLUMNS.some((c) => c.key === state.sort)) state.sort = 'n';

  for (const button of document.querySelectorAll('[data-table-by]')) {
    button.addEventListener('click', () => {
      state.by = button.dataset.tableBy;
      if (state.by === 'campus' && state.sort === 'campus') state.sort = 'name';
      update();
    });
  }

  function renderTable(list) {
    for (const button of document.querySelectorAll('[data-table-by]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tableBy === state.by));
    }
    const host = byId('explore-table');
    const groups = Array.from(A.groupBy(list, (r) => (state.by === 'campus' ? r.campus : r.city)), ([name, sales]) => ({
      name,
      campusShort: A.campusShort(sales[0].campus),
      ...A.summarize(sales),
    }));
    const columns = COLUMNS.filter((c) => !(c.cityOnly && state.by === 'campus'));
    const sortCol = columns.find((c) => c.key === state.sort) || columns.find((c) => c.key === 'n');
    const sign = state.dir === 'asc' ? 1 : -1;
    groups.sort((x, y) => {
      const a = sortCol.value(x);
      const b = sortCol.value(y);
      // Missing values always go last.
      if (a == null || b == null) return (a == null) - (b == null);
      const order = sortCol.text ? String(a).localeCompare(String(b)) : a - b;
      return order * sign || x.name.localeCompare(y.name);
    });

    byId('table-caption').textContent = groups.length
      ? `${groups.length} ${state.by === 'campus' ? (groups.length === 1 ? 'campus area' : 'campus areas') : groups.length === 1 ? 'city' : 'cities'} with matching sales. Select a column heading to sort.`
      : '';
    if (!groups.length) {
      const box = el('div', 'empty-state');
      box.append(el('p', 'empty-title', 'No sales match'), el('p', null, NO_MATCH));
      host.replaceChildren(box);
      return;
    }

    const table = el('table', 'data-table sortable');
    const headRow = el('tr');
    for (const col of columns) {
      const th = el('th', `${col.text ? '' : 'num'}${col.optional ? ' col-optional' : ''}`.trim());
      th.scope = 'col';
      const active = col.key === sortCol.key;
      th.setAttribute('aria-sort', active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      const button = el('button', `sort-btn${active ? ` is-${state.dir}` : ''}`);
      button.type = 'button';
      button.appendChild(el('span', null, col.label()));
      button.insertAdjacentHTML('beforeend', SORT_ICON);
      button.addEventListener('click', () => {
        if (state.sort === col.key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
        else {
          state.sort = col.key;
          state.dir = col.text ? 'asc' : 'desc';
        }
        saveState();
        renderTable(list);
        // Keep keyboard focus on the heading that was used.
        const again = host.querySelector(`[data-col="${col.key}"] .sort-btn`);
        if (again) again.focus();
      });
      th.dataset.col = col.key;
      th.appendChild(button);
      headRow.appendChild(th);
    }
    const thead = el('thead');
    thead.appendChild(headRow);
    const tbody = el('tbody');
    for (const group of groups) {
      const tr = el('tr');
      columns.forEach((col, i) => {
        const cell = el(i === 0 ? 'th' : 'td', `${col.text ? '' : 'num'}${col.optional ? ' col-optional' : ''}`.trim(), col.format(group));
        if (i === 0) cell.scope = 'row';
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    host.replaceChildren(table);
  }

  // ---------- Update everything ----------

  function update() {
    saveState();
    const filter = currentFilter();
    const list = A.filterSales(rows, filter);
    const listAnywhere = A.filterSales(rows, filter, { ignoreLocation: true });
    const summary = A.summarize(list);

    const active = activeFilterCount();
    const { lo, hi } = A.clampPriceRange(state.priceMin, state.priceMax);
    const priceNote = lo > hi ? ' The minimum price is above the maximum price.' : '';
    byId('filter-summary').textContent =
      `${F.int(summary.n)} of ${F.int(validTotal)} sales match` + (active ? `, with ${active} ${active === 1 ? 'filter' : 'filters'} on.` : '. No filters are on.') + priceNote;
    byId('reset-filters').disabled = !active;
    byId('explore-empty').hidden = summary.n > 0;

    renderTiles(summary);
    renderMap(listAnywhere);
    renderTrend(list);
    renderDistribution(list, summary);
    renderCompare(listAnywhere);
    renderTable(list);
  }

  byId('empty-reset').addEventListener('click', resetFilters);
  update();
}
