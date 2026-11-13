// Starts the site: loads the data, then fills in each section.

import * as A from './analysis.js';
import * as F from './format.js';
import { redrawAll } from './charts.js';
import { renderFixedQuestions } from './questions.js';
import { renderLiveQuestions } from './questions-live.js';

const d3 = window.d3;
const DATA_URL = 'data/site_sales.csv';

// ---------- Light and dark mode ----------

function initTheme() {
  const button = document.getElementById('theme-toggle');
  const label = button.querySelector('.theme-toggle-label');
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    label.textContent = dark ? 'Light mode' : 'Dark mode';
  }
  apply(document.documentElement.dataset.theme || 'light');
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', next);
    } catch (err) {
      // Saving the choice is optional. The toggle still works without it.
    }
    apply(next);
  });
}

// ---------- Headline numbers at the top of the page ----------

function monthYear(isoDate) {
  return `${F.MONTHS[Number(isoDate.slice(5, 7)) - 1]} ${isoDate.slice(0, 4)}`;
}

function renderOverview(rows) {
  const saleDates = rows.filter((r) => r.sale).map((r) => r.sale).sort();
  const stats = {
    rows: F.int(rows.length),
    cities: F.int(A.allCities(rows).length),
    campuses: F.int(A.allCampuses(rows).length),
    median: F.usd(A.median(A.validRows(rows).map((r) => r.price))),
    firstSale: monthYear(saleDates[0]),
    lastSale: monthYear(saleDates[saleDates.length - 1]),
  };
  document.querySelectorAll('[data-stat]').forEach((node) => {
    node.textContent = stats[node.dataset.stat] ?? '';
  });
}

// ---------- Start ----------

async function start() {
  initTheme();
  const status = document.getElementById('load-status');
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`The data file could not be loaded (status ${response.status}).`);
    const rows = d3.csvParse(await response.text(), A.parseRow);
    // Wait briefly for the web font, so chart labels are measured in the right typeface.
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);

    document.querySelectorAll('[data-needs-data]').forEach((node) => (node.hidden = false));
    status.hidden = true;
    renderOverview(rows);
    renderFixedQuestions(rows);
    renderLiveQuestions(rows);
    document.fonts.ready.then(redrawAll);
  } catch (err) {
    console.error(err);
    status.classList.add('is-error');
    status.querySelector('.load-title').textContent = 'The sales data did not load';
    status.querySelector('.load-text').textContent = 'Please check your connection and refresh the page to try again.';
  }
}

start();
