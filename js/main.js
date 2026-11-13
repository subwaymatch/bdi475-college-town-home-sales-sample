// Starts the site: loads the data, then fills in each section.

import * as A from './analysis.js';
import * as F from './format.js';
import { redrawAll } from './charts.js';
import { renderFixedQuestions } from './questions.js';
import { renderLiveQuestions } from './questions-live.js';
import { initExplore } from './explore.js';
import { renderInsights } from './insights.js';

const d3 = window.d3;
const DATA_URL = 'data/site_sales.csv';
const MAP_URL = 'vendor/us-states-10m.json';

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

// ---------- Show which section the visitor is in ----------

function initNavHighlight() {
  const links = Array.from(document.querySelectorAll('.site-nav a'));
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const visible = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      // When two sections are on screen, the one further down the page is the current one.
      const current = sections.map((s) => s.id).filter((id) => visible.has(id)).pop();
      for (const link of links) {
        if (link.getAttribute('href') === `#${current}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sections.forEach((section) => observer.observe(section));
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
    valid: F.int(A.validRows(rows).length),
    belowMin: F.int(rows.filter((r) => r.price != null && r.price < A.PRICE_MIN).length),
    aboveMax: F.int(rows.filter((r) => r.price != null && r.price > A.PRICE_MAX).length),
    domRows: F.int(rows.filter((r) => r.dom != null).length),
    maxTax: F.usd(Math.max(...rows.filter((r) => r.tax != null).map((r) => r.tax))),
    // Median days from contract to closing, for sales with both dates.
    closeDays: F.days(A.median(rows.filter((r) => r.contract && r.sale).map((r) => Math.round((Date.parse(r.sale) - Date.parse(r.contract)) / 86400000)))),
    firstSale: monthYear(saleDates[0]),
    lastSale: monthYear(saleDates[saleDates.length - 1]),
  };
  document.querySelectorAll('[data-stat]').forEach((node) => {
    node.textContent = stats[node.dataset.stat] ?? '';
  });
}

// ---------- Map outlines ----------

// US state shapes for the Explore map. Loaded alongside the sales data.
async function loadMap() {
  const response = await fetch(MAP_URL);
  if (!response.ok) throw new Error('The map file could not be loaded.');
  const us = await response.json();
  const topojson = window.topojson;
  return {
    states: topojson.feature(us, us.objects.states),
    borders: topojson.mesh(us, us.objects.states, (a, b) => a !== b),
  };
}

// ---------- Start ----------

async function start() {
  initTheme();
  const status = document.getElementById('load-status');
  const mapData = loadMap();
  mapData.catch(() => {});
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
    initExplore(rows, mapData);
    renderInsights(rows);
    document.fonts.ready.then(redrawAll);
    initNavHighlight();
  } catch (err) {
    console.error(err);
    status.classList.add('is-error');
    status.querySelector('.load-title').textContent = 'The sales data did not load';
    status.querySelector('.load-text').textContent = 'Please check your connection and refresh the page to try again.';
  }
}

start();
