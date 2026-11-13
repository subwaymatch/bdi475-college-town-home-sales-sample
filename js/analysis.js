// Every number on the site is computed here, from the rows of data/site_sales.csv.
// This file has no page code in it, so the same functions can be checked outside the browser.

// Price scope rule: a "valid price" is from $10,000 to $5,000,000, inclusive.
export const PRICE_MIN = 10000;
export const PRICE_MAX = 5000000;

const DAY_MS = 24 * 60 * 60 * 1000;

// Short display names for the 11 campus areas. The numbers never depend on these.
export const CAMPUS_NAMES = {
  'Purdue University': { short: 'Purdue', slug: 'purdue' },
  'The Pennsylvania State University': { short: 'Penn State', slug: 'penn-state' },
  'The University of Iowa': { short: 'Iowa', slug: 'iowa' },
  'The University of North Carolina at Chapel Hill': { short: 'UNC Chapel Hill', slug: 'unc' },
  'University of California, Davis': { short: 'UC Davis', slug: 'uc-davis' },
  'University of Florida': { short: 'Florida', slug: 'florida' },
  'University of Georgia': { short: 'Georgia', slug: 'georgia' },
  'University of Illinois Urbana-Champaign': { short: 'Illinois', slug: 'illinois' },
  'University of Michigan': { short: 'Michigan', slug: 'michigan' },
  'University of Virginia': { short: 'Virginia', slug: 'virginia' },
  'University of Wisconsin-Madison': { short: 'Wisconsin', slug: 'wisconsin' },
};

export function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function campusShort(name) {
  return CAMPUS_NAMES[name] ? CAMPUS_NAMES[name].short : name;
}

export function campusSlug(name) {
  return CAMPUS_NAMES[name] ? CAMPUS_NAMES[name].slug : slugify(name);
}

// A blank cell is missing (null), never zero.
function num(text) {
  return text === '' || text == null ? null : Number(text);
}

// Turns one CSV row (all text) into the fields the site uses.
export function parseRow(d) {
  const price = num(d.sale_price);
  const list = d.list_date || null;
  const contract = d.contract_date || null;
  const sale = d.sale_date || null;
  return {
    city: `${d.city}, ${d.state}`,
    campus: d.university,
    lat: num(d.latitude),
    lon: num(d.longitude),
    miles: num(d.miles_to_campus),
    list,
    contract,
    sale,
    // Year and month come from sale_date.
    year: sale ? Number(sale.slice(0, 4)) : null,
    month: sale ? Number(sale.slice(5, 7)) : null,
    // Days on market = contract_date minus list_date, only when both dates exist.
    dom: list && contract ? Math.round((Date.parse(contract) - Date.parse(list)) / DAY_MS) : null,
    price,
    valid: price != null && price >= PRICE_MIN && price <= PRICE_MAX,
    beds: num(d.beds),
    sqft: num(d.living_area_sqft),
    built: num(d.year_built),
    basement: num(d.has_basement),
    garage: num(d.has_garage),
    fireplace: num(d.has_fireplace),
    tax: num(d.tax_annual_amount),
  };
}

// ---------- Small statistics helpers ----------

export function sum(values) {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function mean(values) {
  return values.length ? sum(values) / values.length : null;
}

// Quantile of an already sorted list, with linear interpolation
// (the same method as pandas and Excel's PERCENTILE.INC).
export function quantileSorted(sorted, p) {
  const n = sorted.length;
  if (!n) return null;
  const pos = (n - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function sortedCopy(values) {
  return Array.from(values).sort((a, b) => a - b);
}

// Median: the middle value, or the average of the two middle values.
export function median(values) {
  return quantileSorted(sortedCopy(values), 0.5);
}

export function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(row);
  }
  return groups;
}

export function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// All items that share the highest (or lowest) value, so ties are all reported.
export function extremes(items, valueFn, which) {
  const scored = items.filter((item) => valueFn(item) != null);
  if (!scored.length) return [];
  const values = scored.map(valueFn);
  const target = which === 'max' ? Math.max(...values) : Math.min(...values);
  return scored.filter((item) => valueFn(item) === target);
}

export function validRows(rows) {
  return rows.filter((r) => r.valid);
}

export function allCities(rows) {
  return uniqueSorted(rows.map((r) => r.city));
}

export function allCampuses(rows) {
  return uniqueSorted(rows.map((r) => r.campus));
}

// ---------- Q1 to Q6: fixed answers for the full dataset ----------

// Q1. Median sale price of every city (valid prices).
export function q1(rows) {
  const groups = groupBy(validRows(rows), (r) => r.city);
  const cities = Array.from(groups, ([city, list]) => ({
    city,
    n: list.length,
    median: median(list.map((r) => r.price)),
  })).sort((a, b) => b.median - a.median || a.city.localeCompare(b.city));
  return { cities, top: extremes(cities, (c) => c.median, 'max') };
}

// Q2. Mean and median of every city using all rows (no price rule),
// and the gap between them as a percent of the median.
export function q2(rows) {
  const groups = groupBy(rows.filter((r) => r.price != null), (r) => r.city);
  const cities = Array.from(groups, ([city, list]) => {
    const prices = sortedCopy(list.map((r) => r.price));
    const med = quantileSorted(prices, 0.5);
    const avg = mean(prices);
    const largest = prices[prices.length - 1];
    const withoutLargest = prices.slice(0, -1);
    return {
      city,
      n: prices.length,
      mean: avg,
      median: med,
      gapPct: ((avg - med) / med) * 100,
      largest,
      overMax: prices.filter((p) => p > PRICE_MAX).length,
      underMin: prices.filter((p) => p < PRICE_MIN).length,
      // What the mean and the gap would be without the single largest sale.
      meanWithoutLargest: mean(withoutLargest),
      gapPctWithoutLargest:
        ((mean(withoutLargest) - quantileSorted(withoutLargest, 0.5)) / quantileSorted(withoutLargest, 0.5)) * 100,
    };
  }).sort((a, b) => b.gapPct - a.gapPct);
  return { cities, top: extremes(cities, (c) => c.gapPct, 'max') };
}

// Ranks a list of {key, value}: rank 1 is the highest value. Equal values share a rank.
function rankDescending(items) {
  const sorted = items.slice().sort((a, b) => b.value - a.value);
  const ranks = new Map();
  sorted.forEach((item, i) => {
    const rank = i > 0 && sorted[i - 1].value === item.value ? ranks.get(sorted[i - 1].key) : i + 1;
    ranks.set(item.key, rank);
  });
  return ranks;
}

// Q3. Rank cities by mean sale price twice: all rows, then valid prices only.
export function q3(rows) {
  const priced = rows.filter((r) => r.price != null);
  const allGroups = groupBy(priced, (r) => r.city);
  const validGroups = groupBy(validRows(rows), (r) => r.city);
  const cities = Array.from(allGroups, ([city, list]) => {
    const validList = validGroups.get(city) || [];
    return {
      city,
      nAll: list.length,
      nValid: validList.length,
      meanAll: mean(list.map((r) => r.price)),
      meanValid: mean(validList.map((r) => r.price)),
    };
  });
  const rankAll = rankDescending(cities.map((c) => ({ key: c.city, value: c.meanAll })));
  const rankValid = rankDescending(
    cities.filter((c) => c.meanValid != null).map((c) => ({ key: c.city, value: c.meanValid }))
  );
  for (const c of cities) {
    c.rankAll = rankAll.get(c.city);
    c.rankValid = rankValid.get(c.city);
    // Positive = moved up the ranking (toward rank 1) once the price rule is applied.
    c.moved = c.rankAll - c.rankValid;
  }
  cities.sort((a, b) => a.rankAll - b.rankAll);
  return { cities, changed: cities.filter((c) => c.moved !== 0) };
}

// Q4. Percent change in median sale price from 2024 to 2025, by campus area (valid prices).
export function q4(rows) {
  const groups = groupBy(validRows(rows), (r) => r.campus);
  const campuses = Array.from(groups, ([campus, list]) => {
    const p24 = list.filter((r) => r.year === 2024).map((r) => r.price);
    const p25 = list.filter((r) => r.year === 2025).map((r) => r.price);
    const m24 = median(p24);
    const m25 = median(p25);
    return {
      campus,
      n2024: p24.length,
      n2025: p25.length,
      median2024: m24,
      median2025: m25,
      pct: m24 && m25 != null ? ((m25 - m24) / m24) * 100 : null,
    };
  }).sort((a, b) => b.pct - a.pct);
  return {
    campuses,
    top: extremes(campuses, (c) => c.pct, 'max'),
    decreased: campuses.filter((c) => c.pct != null && c.pct < 0),
  };
}

// Q5. Median days on market by campus area (valid prices, rows with both dates).
export function q5(rows) {
  const groups = groupBy(validRows(rows).filter((r) => r.dom != null), (r) => r.campus);
  const campuses = Array.from(groups, ([campus, list]) => {
    const days = sortedCopy(list.map((r) => r.dom));
    return {
      campus,
      n: days.length,
      median: quantileSorted(days, 0.5),
      q1: quantileSorted(days, 0.25),
      q3: quantileSorted(days, 0.75),
      p10: quantileSorted(days, 0.1),
      p90: quantileSorted(days, 0.9),
    };
  }).sort((a, b) => b.median - a.median || a.campus.localeCompare(b.campus));
  return {
    campuses,
    slowest: extremes(campuses, (c) => c.median, 'max'),
    fastest: extremes(campuses, (c) => c.median, 'min'),
  };
}

// Q6. Total annual property tax as a percent of total sale price, by campus area.
// Rows need a valid price and a tax amount greater than 0 and less than 10% of the price.
export function q6(rows) {
  const usable = validRows(rows).filter((r) => r.tax != null && r.tax > 0 && r.tax < 0.1 * r.price);
  const groups = groupBy(usable, (r) => r.campus);
  const campuses = Array.from(groups, ([campus, list]) => {
    const taxTotal = sum(list.map((r) => r.tax));
    const priceTotal = sum(list.map((r) => r.price));
    return { campus, n: list.length, taxTotal, priceTotal, pct: (taxTotal / priceTotal) * 100 };
  }).sort((a, b) => b.pct - a.pct);
  return {
    campuses,
    rowsUsed: usable.length,
    highest: extremes(campuses, (c) => c.pct, 'max'),
    lowest: extremes(campuses, (c) => c.pct, 'min'),
  };
}

// ---------- Q7 to Q10: answers that depend on a visitor's settings ----------

// Q7. Median sale price by city for homes with exactly `beds` bedrooms (valid prices).
export function q7(rows, beds) {
  const groups = groupBy(validRows(rows).filter((r) => r.beds === beds), (r) => r.city);
  const cities = allCities(rows).map((city) => {
    const list = groups.get(city) || [];
    return { city, n: list.length, median: list.length ? median(list.map((r) => r.price)) : null };
  });
  cities.sort((a, b) => (a.median == null) - (b.median == null) || a.median - b.median || a.city.localeCompare(b.city));
  return {
    cities,
    total: sum(cities.map((c) => c.n)),
    lowest: extremes(cities, (c) => c.median, 'min'),
  };
}

// The part of a visitor's price range that falls inside the price scope rule.
export function clampPriceRange(min, max) {
  const lo = Math.max(min == null || Number.isNaN(min) ? PRICE_MIN : min, PRICE_MIN);
  const hi = Math.min(max == null || Number.isNaN(max) ? PRICE_MAX : max, PRICE_MAX);
  return { lo, hi, clamped: lo !== min || hi !== max };
}

// Q8. Median days on market by city for sales priced from `min` to `max`, inclusive.
export function q8(rows, min, max) {
  const { lo, hi } = clampPriceRange(min, max);
  const usable = rows.filter((r) => r.valid && r.price >= lo && r.price <= hi && r.dom != null);
  const groups = groupBy(usable, (r) => r.city);
  const cities = allCities(rows).map((city) => {
    const list = groups.get(city) || [];
    return { city, n: list.length, median: list.length ? median(list.map((r) => r.dom)) : null };
  });
  cities.sort((a, b) => (a.median == null) - (b.median == null) || a.median - b.median || a.city.localeCompare(b.city));
  return {
    cities,
    lo,
    hi,
    total: usable.length,
    shortest: extremes(cities, (c) => c.median, 'min'),
  };
}

// Q9. Number of sales in each month for one city and year. Uses all rows with a sale date.
export function q9(rows, city, year) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, n: 0 }));
  for (const r of rows) {
    if (r.city === city && r.year === year && r.month != null) months[r.month - 1].n += 1;
  }
  const total = sum(months.map((m) => m.n));
  return { months, total, busiest: total ? extremes(months, (m) => m.n, 'max') : [] };
}

// Q10. Median distance to campus for one campus area, a maximum budget and a minimum number of bedrooms.
export function q10(rows, campus, budget, minBeds) {
  const hi = Math.min(budget, PRICE_MAX);
  const matches = rows.filter(
    (r) => r.campus === campus && r.valid && r.price <= hi && r.beds != null && r.beds >= minBeds && r.miles != null
  );
  const miles = sortedCopy(matches.map((r) => r.miles));
  return { n: miles.length, median: quantileSorted(miles, 0.5), miles, hi };
}

// ---------- Explore section: filters and summaries ----------

// Home feature filters. A blank cell means "not reported", which is its own choice, not "no".
export function featureMatches(value, choice) {
  if (choice === 'yes') return value === 1;
  if (choice === 'no') return value === 0;
  if (choice === 'unknown') return value == null;
  return true;
}

// Returns the sales that match the Explore filters. The price rule always applies.
// A range filter left at its full extent (null) keeps rows where that value is missing;
// once a range is narrowed, rows missing that value are left out.
export function filterSales(rows, f, { ignoreLocation = false } = {}) {
  const { lo, hi } = clampPriceRange(f.priceMin, f.priceMax);
  return rows.filter((r) => {
    if (!r.valid || r.price < lo || r.price > hi) return false;
    if (!ignoreLocation) {
      if (f.campus && r.campus !== f.campus) return false;
      if (f.city && r.city !== f.city) return false;
    }
    if (f.year != null && r.year !== f.year) return false;
    if (f.beds != null) {
      if (r.beds == null) return false;
      if (f.beds >= 6 ? r.beds < 6 : r.beds !== f.beds) return false;
    }
    if (f.milesMin != null && (r.miles == null || r.miles < f.milesMin)) return false;
    if (f.milesMax != null && (r.miles == null || r.miles > f.milesMax)) return false;
    if (f.builtMin != null && (r.built == null || r.built < f.builtMin)) return false;
    if (f.builtMax != null && (r.built == null || r.built > f.builtMax)) return false;
    return featureMatches(r.garage, f.garage) && featureMatches(r.basement, f.basement) && featureMatches(r.fireplace, f.fireplace);
  });
}

// Key numbers for a list of sales.
export function summarize(list) {
  const dom = list.filter((r) => r.dom != null).map((r) => r.dom);
  // Price per square foot needs a living area above zero (some rows are blank or 0).
  const ppsf = list.filter((r) => r.sqft != null && r.sqft > 0).map((r) => r.price / r.sqft);
  const miles = list.filter((r) => r.miles != null).map((r) => r.miles);
  return {
    n: list.length,
    medianPrice: list.length ? median(list.map((r) => r.price)) : null,
    medianDom: dom.length ? median(dom) : null,
    nDom: dom.length,
    medianPpsf: ppsf.length ? median(ppsf) : null,
    nPpsf: ppsf.length,
    medianMiles: miles.length ? median(miles) : null,
  };
}

// Every month from the first sale to the last, as 'YYYY-MM' keys.
export function monthKeys(rows) {
  const dates = rows.filter((r) => r.sale).map((r) => r.sale).sort();
  if (!dates.length) return [];
  let year = Number(dates[0].slice(0, 4));
  let month = Number(dates[0].slice(5, 7));
  const endYear = Number(dates[dates.length - 1].slice(0, 4));
  const endMonth = Number(dates[dates.length - 1].slice(5, 7));
  const keys = [];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

// Median sale price and number of sales for each month.
export function monthlyMedians(list, keys) {
  const groups = groupBy(list.filter((r) => r.sale), (r) => r.sale.slice(0, 7));
  return keys.map((key) => {
    const sales = groups.get(key) || [];
    return {
      key,
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7)),
      n: sales.length,
      median: sales.length ? median(sales.map((r) => r.price)) : null,
    };
  });
}

// The median latitude and longitude of a list of sales: where a place sits on the map.
export function medianLocation(list) {
  return {
    lat: median(list.filter((r) => r.lat != null).map((r) => r.lat)),
    lon: median(list.filter((r) => r.lon != null).map((r) => r.lon)),
  };
}

// ---------- Insights: what happens if a blank date is treated as zero days ----------

// For each city (valid prices): how many sales lack a list or contract date, the median days on
// market using only sales with both dates (the rule this site uses), and what the median would be
// if every blank were wrongly counted as 0 days.
export function blankDatesEffect(rows) {
  const valid = validRows(rows);
  const describe = (list) => {
    const both = list.filter((r) => r.dom != null).map((r) => r.dom);
    const asZero = list.map((r) => (r.dom == null ? 0 : r.dom));
    return {
      n: list.length,
      nBoth: both.length,
      missingPct: list.length ? ((list.length - both.length) / list.length) * 100 : null,
      median: both.length ? median(both) : null,
      mean: mean(both),
      medianIfZero: list.length ? median(asZero) : null,
    };
  };
  const cities = Array.from(groupBy(valid, (r) => r.city), ([city, list]) => ({ city, ...describe(list) }));
  // Rank 1 = fastest (lowest median). Equal medians share a rank.
  const rankAscending = (key) => {
    const sorted = cities.slice().sort((a, b) => a[key] - b[key]);
    const ranks = new Map();
    sorted.forEach((c, i) => ranks.set(c.city, i > 0 && sorted[i - 1][key] === c[key] ? ranks.get(sorted[i - 1].city) : i + 1));
    return ranks;
  };
  const rank = rankAscending('median');
  const rankIfZero = rankAscending('medianIfZero');
  for (const c of cities) {
    c.rank = rank.get(c.city);
    c.rankIfZero = rankIfZero.get(c.city);
    c.drop = c.median - c.medianIfZero;
  }
  cities.sort((a, b) => b.missingPct - a.missingPct);
  return {
    overall: describe(valid),
    cities,
    mostMissing: cities[0],
    leastMissing: cities[cities.length - 1],
    // The city whose rank would improve the most under the wrong rule.
    mostDistorted: cities.slice().sort((a, b) => b.rank - b.rankIfZero - (a.rank - a.rankIfZero) || b.drop - a.drop)[0],
    fastestIfZero: extremes(cities, (c) => c.medianIfZero, 'min'),
  };
}
