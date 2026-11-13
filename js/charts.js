// Chart building blocks, drawn as SVG with D3.
// Colors come from CSS classes (styles.css), so every chart follows the light or dark theme.

const d3 = window.d3;

const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
const F_LABEL = `400 13px ${FONT}`;
const F_LABEL_KEY = `600 13px ${FONT}`;
const F_VALUE = `600 12px ${FONT}`; // measured at the heavier weight, so labels always fit
const F_TICK = `400 12px ${FONT}`;

let measureCtx;
function textWidth(text, font) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx.measureText(String(text ?? '')).width;
}

function maxWidth(items, textFn, fontFn) {
  let widest = 0;
  for (const item of items) widest = Math.max(widest, textWidth(textFn(item), typeof fontFn === 'function' ? fontFn(item) : fontFn));
  return Math.ceil(widest);
}

// ---------- Responsive mounting ----------

const mounted = new Set();

// Draws a chart into `body` and redraws it whenever the available width changes.
export function mount(body, draw) {
  let lastWidth = 0;
  const entry = {
    redraw(force) {
      const width = Math.floor(body.clientWidth);
      if (!width) return;
      if (force || width !== lastWidth) {
        lastWidth = width;
        draw(width);
      }
    },
  };
  new ResizeObserver(() => entry.redraw(false)).observe(body);
  mounted.add(entry);
  entry.redraw(true);
  return { update: () => entry.redraw(true) };
}

export function redrawAll() {
  mounted.forEach((entry) => entry.redraw(true));
}

// ---------- Tooltip ----------

const tooltip = (() => {
  let el;
  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'tooltip';
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    document.body.appendChild(el);
    window.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('pointerdown', (evt) => {
      if (!evt.target.closest || !evt.target.closest('[data-tip]')) hide();
    });
    return el;
  }
  function show(evt, content) {
    const node = ensure();
    node.replaceChildren();
    if (content.title) {
      const title = document.createElement('div');
      title.className = 'tooltip-title';
      title.textContent = content.title;
      node.appendChild(title);
    }
    if (content.rows && content.rows.length) {
      const list = document.createElement('dl');
      for (const [label, value] of content.rows) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        list.append(dt, dd);
      }
      node.appendChild(list);
    }
    if (content.note) {
      const note = document.createElement('div');
      note.className = 'tooltip-note';
      note.textContent = content.note;
      node.appendChild(note);
    }
    node.hidden = false;
    move(evt);
  }
  function move(evt) {
    if (!el || el.hidden) return;
    const pad = 12;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = evt.clientX + 14;
    let y = evt.clientY + 16;
    if (x + w + pad > window.innerWidth) x = evt.clientX - w - 14;
    if (x < pad) x = pad;
    if (y + h + pad > window.innerHeight) y = evt.clientY - h - 14;
    if (y < pad) y = pad;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function hide() {
    if (el) el.hidden = true;
  }
  return { show, move, hide, isHidden: () => !el || el.hidden };
})();

// Adds hover and tap tooltips to a D3 selection. `contentFn(d)` returns {title, rows, note}.
function attachTip(selection, contentFn) {
  selection
    .attr('data-tip', '')
    .on('pointerenter', (evt, d) => {
      const content = contentFn(d);
      if (content) tooltip.show(evt, content);
    })
    .on('pointermove', (evt, d) => {
      // Scrolling hides the tooltip. If the pointer then moves within the same mark, bring it back.
      if (tooltip.isHidden()) {
        const content = contentFn(d);
        if (content) tooltip.show(evt, content);
      } else {
        tooltip.move(evt);
      }
    })
    .on('pointerleave', (evt) => {
      // After a tap, keep the tooltip until the visitor taps somewhere else.
      if (evt.pointerType !== 'touch') tooltip.hide();
    });
}

// ---------- Figure shell: title, subtitle, legend, chart, data table ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Fills a <figure> with the standard parts and returns handles to update them.
export function figure(host, { title, subtitle, legend } = {}) {
  host.replaceChildren();
  host.classList.add('chart');
  const caption = el('figcaption', 'chart-caption');
  const titleEl = el('p', 'chart-title', title || '');
  const subEl = el('p', 'chart-sub', subtitle || '');
  caption.append(titleEl, subEl);
  const legendEl = el('div', 'legend');
  const body = el('div', 'chart-body');
  const details = el('details', 'chart-data');
  const summary = el('summary', null, 'View these numbers as a table');
  const tableHost = el('div', 'table-scroll');
  details.append(summary, tableHost);
  host.append(caption, legendEl, body, details);

  function setLegend(items) {
    legendEl.replaceChildren();
    legendEl.hidden = !items || !items.length;
    for (const item of items || []) {
      const entry = el('span', 'legend-item');
      const swatch = el('span', `swatch swatch--${item.shape || 'rect'} is-${item.cls || 'quiet'}`);
      entry.append(swatch, document.createTextNode(item.label));
      legendEl.appendChild(entry);
    }
  }
  setLegend(legend);

  return {
    body,
    setTitle: (text) => (titleEl.textContent = text),
    setSubtitle: (text) => (subEl.textContent = text),
    setLegend,
    setTable: (columns, rows) => {
      details.hidden = !rows.length;
      dataTable(tableHost, columns, rows);
    },
  };
}

// A plain data table. columns: [{label, value: row => text, numeric}]
export function dataTable(host, columns, rows) {
  const table = el('table', 'data-table');
  const thead = el('thead');
  const headRow = el('tr');
  for (const col of columns) {
    const th = el('th', col.numeric ? 'num' : null, col.label);
    th.scope = 'col';
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr', row.isKey ? 'is-key' : null);
    columns.forEach((col, i) => {
      const cell = el(i === 0 ? 'th' : 'td', col.numeric ? 'num' : null, col.value(row));
      if (i === 0) cell.scope = 'row';
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  host.replaceChildren(table);
}

// A friendly message shown in place of a chart when there is nothing to draw.
export function emptyState(body, message) {
  const box = el('div', 'empty-state');
  box.append(el('p', 'empty-title', 'No sales match'), el('p', null, message));
  body.replaceChildren(box);
}

// ---------- Shared SVG pieces ----------

function startSvg(body, width, height, label) {
  body.replaceChildren();
  return d3
    .select(body)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', label || 'Chart');
}

// Vertical gridlines, tick labels and an axis title along the bottom of a plot.
function bottomAxis(svg, x, { top, bottom, width, format, title, count }) {
  const ticks = x.ticks(count);
  const g = svg.append('g').attr('class', 'axis');
  g.selectAll('line')
    .data(ticks)
    .join('line')
    .attr('class', 'grid')
    .attr('x1', (d) => Math.round(x(d)) + 0.5)
    .attr('x2', (d) => Math.round(x(d)) + 0.5)
    .attr('y1', top)
    .attr('y2', bottom);
  g.selectAll('text.tick')
    .data(ticks)
    .join('text')
    .attr('class', 'tick')
    .attr('y', bottom + 18)
    .text((d) => format(d))
    .each(function (d) {
      // Keep the first and last tick labels inside the chart.
      const half = textWidth(format(d), F_TICK) / 2;
      const pos = x(d);
      const anchor = pos - half < 0 ? 'start' : pos + half > width ? 'end' : 'middle';
      d3.select(this)
        .attr('text-anchor', anchor)
        .attr('x', anchor === 'start' ? 0 : anchor === 'end' ? width : pos);
    });
  if (title) {
    const [r0, r1] = x.range();
    g.append('text')
      .attr('class', 'axis-title')
      .attr('x', (r0 + r1) / 2)
      .attr('y', bottom + 40)
      .attr('text-anchor', 'middle')
      .text(title);
  }
}

function tickCount(pixels, per = 90) {
  return Math.max(2, Math.min(8, Math.floor(pixels / per)));
}

// A bar with a rounded data end and a square end at the baseline.
function barPath(x0, x1, y, h) {
  const w = Math.abs(x1 - x0);
  const r = Math.min(4, w, h / 2);
  if (x1 >= x0) {
    return `M${x0},${y}H${x1 - r}a${r},${r} 0 0 1 ${r},${r}V${y + h - r}a${r},${r} 0 0 1 ${-r},${r}H${x0}Z`;
  }
  return `M${x0},${y}H${x1 + r}a${r},${r} 0 0 0 ${-r},${r}V${y + h - r}a${r},${r} 0 0 0 ${r},${r}H${x0}Z`;
}

// A column with a rounded top and a square bottom.
function columnPath(x, y0, y1, w) {
  const h = Math.abs(y0 - y1);
  const r = Math.min(4, h, w / 2);
  return `M${x},${y0}V${y1 + r}a${r},${r} 0 0 1 ${r},${-r}H${x + w - r}a${r},${r} 0 0 1 ${r},${r}V${y0}Z`;
}

// Layout shared by the charts that list one row per city or campus area.
function rowLayout(rows, width, valueWidth) {
  const natural = maxWidth(rows, (r) => r.label, (r) => (r.cls && r.cls !== 'quiet' ? F_LABEL_KEY : F_LABEL)) + 14;
  // Labels sit beside the marks when that leaves enough room to draw them. On a narrow screen
  // (or with long value labels) each label moves to its own line above its mark instead.
  const narrow = width - natural - valueWidth < 120;
  const labelW = narrow ? 0 : natural;
  return {
    narrow,
    labelW,
    rowH: narrow ? 46 : 30,
    // Vertical offset of the mark's center line inside a row.
    markY: narrow ? 31 : 15,
    plotLeft: labelW,
    plotRight: width - valueWidth,
  };
}

function drawRowLabels(svg, rows, layout, top) {
  svg
    .append('g')
    .selectAll('text')
    .data(rows)
    .join('text')
    .attr('class', (r) => `row-label${r.cls && r.cls !== 'quiet' ? ' is-key' : ''}`)
    .attr('x', layout.narrow ? 0 : layout.labelW - 14)
    .attr('y', (r, i) => top + i * layout.rowH + (layout.narrow ? 13 : layout.markY))
    .attr('text-anchor', layout.narrow ? 'start' : 'end')
    .attr('dominant-baseline', layout.narrow ? 'auto' : 'central')
    .text((r) => r.label);
}

// Invisible full-row hit areas, so the pointer never has to land on a thin mark.
function drawRowHits(svg, rows, layout, top, width) {
  const hits = svg
    .append('g')
    .selectAll('rect')
    .data(rows)
    .join('rect')
    .attr('class', 'hit')
    .attr('x', 0)
    .attr('y', (r, i) => top + i * layout.rowH)
    .attr('width', width)
    .attr('height', layout.rowH);
  attachTip(hits, (r) => r.tip);
}

// ---------- Ranked rows: bars or lollipops ----------

// o.rows: [{label, value, display, cls, tip}]. A null value shows `o.emptyText`.
// o.mark: 'bar' (default) or 'lollipop'. Negative values draw to the left of zero.
export function rankedRows(body, width, o) {
  const rows = o.rows;
  const values = rows.filter((r) => r.value != null).map((r) => r.value);
  const valueW = Math.max(maxWidth(rows, (r) => (r.value == null ? o.emptyText || '' : r.display), F_VALUE) + 12, 24);
  const layout = rowLayout(rows, width, valueW);
  const hasNegative = values.some((v) => v < 0);
  const top = 6;
  const bottom = top + rows.length * layout.rowH + 4;
  const height = bottom + (o.xTitle ? 50 : 28);
  const x = d3
    .scaleLinear()
    .domain([Math.min(0, d3.min(values) ?? 0), Math.max(0, d3.max(values) ?? 0) || 1])
    .range([layout.plotLeft + (hasNegative ? valueW : 0), layout.plotRight]);
  const count = tickCount(x.range()[1] - x.range()[0]);
  x.nice(count);

  const svg = startSvg(body, width, height, o.ariaLabel);
  bottomAxis(svg, x, { top, bottom, width, format: o.xFormat, title: o.xTitle, count });
  const zero = Math.round(x(0)) + 0.5;
  // The zero line goes in before the labels, so label text is never crossed by it.
  svg.append('line').attr('class', 'baseline').attr('x1', zero).attr('x2', zero).attr('y1', top).attr('y2', bottom);
  drawRowHits(svg, rows, layout, top, width);
  drawRowLabels(svg, rows, layout, top);

  const barH = 16;
  const marks = svg.append('g').attr('class', 'marks');
  rows.forEach((r, i) => {
    const cy = top + i * layout.rowH + layout.markY;
    const cls = `is-${r.cls || 'quiet'}`;
    if (r.value == null) {
      marks.append('text').attr('class', 'value-label is-empty').attr('x', zero + 6).attr('y', cy).attr('dominant-baseline', 'central').text(o.emptyText || '');
      return;
    }
    const end = x(r.value);
    if (o.mark === 'lollipop') {
      marks.append('line').attr('class', `stem ${cls}`).attr('x1', zero).attr('x2', end).attr('y1', cy).attr('y2', cy);
      marks.append('circle').attr('class', `dot ${cls}`).attr('cx', end).attr('cy', cy).attr('r', 6);
    } else {
      marks.append('path').attr('class', `bar ${cls}`).attr('d', barPath(zero, end, cy - barH / 2, barH));
    }
    const gap = o.mark === 'lollipop' ? 11 : 6;
    const left = r.value < 0;
    marks
      .append('text')
      .attr('class', `value-label${r.cls && r.cls !== 'quiet' ? ' is-key' : ''}`)
      .attr('x', left ? end - gap : end + gap)
      .attr('y', cy)
      .attr('text-anchor', left ? 'end' : 'start')
      .attr('dominant-baseline', 'central')
      .text(r.display);
  });
}

// ---------- Dumbbell: two values per row, joined by a line ----------

// o.rows: [{label, a, b, display, cls, tip}]. `a` draws as an open circle, `b` as a filled one.
export function dumbbell(body, width, o) {
  const rows = o.rows;
  const valueW = Math.max(maxWidth(rows, (r) => r.display, F_VALUE), textWidth(o.valueHeader || '', F_TICK)) + 14;
  const layout = rowLayout(rows, width, valueW);
  const top = o.valueHeader ? 24 : 6;
  const bottom = top + rows.length * layout.rowH + 4;
  const height = bottom + (o.xTitle ? 50 : 28);
  const all = rows.flatMap((r) => [r.a, r.b]).filter((v) => v != null);
  const x = d3
    .scaleLinear()
    .domain(o.fromZero ? [0, d3.max(all)] : d3.extent(all))
    .range([layout.plotLeft + 8, layout.plotRight - 10]);
  const count = tickCount(x.range()[1] - x.range()[0]);
  x.nice(count);

  const svg = startSvg(body, width, height, o.ariaLabel);
  bottomAxis(svg, x, { top, bottom, width, format: o.xFormat, title: o.xTitle, count });
  drawRowHits(svg, rows, layout, top, width);
  drawRowLabels(svg, rows, layout, top);
  if (o.valueHeader) {
    svg.append('text').attr('class', 'col-header').attr('x', width).attr('y', 12).attr('text-anchor', 'end').text(o.valueHeader);
  }

  const marks = svg.append('g').attr('class', 'marks');
  rows.forEach((r, i) => {
    const cy = top + i * layout.rowH + layout.markY;
    const cls = `is-${r.cls || 'quiet'}`;
    if (r.a != null && r.b != null) {
      marks.append('line').attr('class', `link ${cls}`).attr('x1', x(r.a)).attr('x2', x(r.b)).attr('y1', cy).attr('y2', cy);
    }
    if (r.a != null) marks.append('circle').attr('class', `ring ${cls}`).attr('cx', x(r.a)).attr('cy', cy).attr('r', 5);
    if (r.b != null) marks.append('circle').attr('class', `dot ${cls}`).attr('cx', x(r.b)).attr('cy', cy).attr('r', 6);
    marks
      .append('text')
      .attr('class', `value-label${r.cls && r.cls !== 'quiet' ? ' is-key' : ''}`)
      .attr('x', width)
      .attr('y', cy)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .text(r.display);
  });
}

// ---------- Box plot: one horizontal box per row ----------

// o.rows: [{label, p10, q1, median, q3, p90, display, cls, tip}]
export function boxRows(body, width, o) {
  const rows = o.rows;
  const valueW = Math.max(maxWidth(rows, (r) => r.display, F_VALUE), textWidth(o.valueHeader || '', F_TICK)) + 14;
  const layout = rowLayout(rows, width, valueW);
  const top = o.valueHeader ? 24 : 6;
  const bottom = top + rows.length * layout.rowH + 4;
  const height = bottom + (o.xTitle ? 50 : 28);
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(rows, (r) => r.p90) || 1])
    .range([layout.plotLeft + 2, layout.plotRight - 10]);
  const count = tickCount(x.range()[1] - x.range()[0]);
  x.nice(count);

  const svg = startSvg(body, width, height, o.ariaLabel);
  bottomAxis(svg, x, { top, bottom, width, format: o.xFormat, title: o.xTitle, count });
  drawRowHits(svg, rows, layout, top, width);
  drawRowLabels(svg, rows, layout, top);
  if (o.valueHeader) {
    svg.append('text').attr('class', 'col-header').attr('x', width).attr('y', 12).attr('text-anchor', 'end').text(o.valueHeader);
  }

  const boxH = 14;
  const marks = svg.append('g').attr('class', 'marks');
  rows.forEach((r, i) => {
    const cy = top + i * layout.rowH + layout.markY;
    const cls = `is-${r.cls || 'quiet'}`;
    marks.append('line').attr('class', `whisker ${cls}`).attr('x1', x(r.p10)).attr('x2', x(r.p90)).attr('y1', cy).attr('y2', cy);
    for (const end of [r.p10, r.p90]) {
      marks.append('line').attr('class', `whisker ${cls}`).attr('x1', x(end)).attr('x2', x(end)).attr('y1', cy - 4).attr('y2', cy + 4);
    }
    marks
      .append('rect')
      .attr('class', `box ${cls}`)
      .attr('x', x(r.q1))
      .attr('y', cy - boxH / 2)
      .attr('width', Math.max(2, x(r.q3) - x(r.q1)))
      .attr('height', boxH)
      .attr('rx', 3);
    marks.append('line').attr('class', `median-tick ${cls}`).attr('x1', x(r.median)).attr('x2', x(r.median)).attr('y1', cy - boxH / 2 - 3).attr('y2', cy + boxH / 2 + 3);
    marks
      .append('text')
      .attr('class', `value-label${r.cls && r.cls !== 'quiet' ? ' is-key' : ''}`)
      .attr('x', width)
      .attr('y', cy)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .text(r.display);
  });
}

// ---------- Slope chart: a rank on the left, a rank on the right ----------

// o.rows: [{label, left, right, cls, tip}] where left and right are ranks (1 = top).
export function slope(body, width, o) {
  const rows = o.rows;
  const narrow = width < 520;
  const font = narrow ? `400 12px ${FONT}` : F_LABEL;
  const fontKey = narrow ? `600 12px ${FONT}` : F_LABEL_KEY;
  const fontFor = (r) => (r.cls && r.cls !== 'quiet' ? fontKey : font);
  let labelText = (r, rank) => `${rank}. ${r.label}`;
  let sideW = maxWidth(rows, (r) => labelText(r, Math.max(r.left, r.right)), fontFor) + 16;
  // On a very small screen the full labels leave no room for the lines, so the short labels are used.
  if (width - 2 * sideW < 44 && rows.some((r) => r.shortLabel)) {
    labelText = (r, rank) => `${rank}. ${r.shortLabel || r.label}`;
    sideW = maxWidth(rows, (r) => labelText(r, Math.max(r.left, r.right)), fontFor) + 16;
  }
  const rowH = 28;
  const top = 34;
  const n = d3.max(rows, (r) => Math.max(r.left, r.right));
  const height = top + n * rowH + 8;
  const xL = sideW;
  const xR = width - sideW;
  const y = (rank) => top + (rank - 1) * rowH + rowH / 2;

  const svg = startSvg(body, width, height, o.ariaLabel);
  svg.append('text').attr('class', 'col-header').attr('x', xL).attr('y', 14).attr('text-anchor', 'end').text(o.leftTitle);
  svg.append('text').attr('class', 'col-header').attr('x', xR).attr('y', 14).attr('text-anchor', 'start').text(o.rightTitle);
  svg.append('line').attr('class', 'baseline').attr('x1', xL + 0.5).attr('x2', xL + 0.5).attr('y1', top).attr('y2', height - 8);
  svg.append('line').attr('class', 'baseline').attr('x1', xR - 0.5).attr('x2', xR - 0.5).attr('y1', top).attr('y2', height - 8);

  // Quiet rows first, so the highlighted lines sit on top.
  const ordered = rows.slice().sort((a, b) => (a.cls && a.cls !== 'quiet' ? 1 : 0) - (b.cls && b.cls !== 'quiet' ? 1 : 0));
  const marks = svg.append('g').attr('class', 'marks');
  for (const r of ordered) {
    const cls = `is-${r.cls || 'quiet'}`;
    const key = r.cls && r.cls !== 'quiet';
    const g = marks.append('g').datum(r);
    g.append('line').attr('class', `slope-line ${cls}`).attr('x1', xL).attr('x2', xR).attr('y1', y(r.left)).attr('y2', y(r.right));
    g.append('circle').attr('class', `dot ${cls}`).attr('cx', xL).attr('cy', y(r.left)).attr('r', key ? 5 : 4);
    g.append('circle').attr('class', `dot ${cls}`).attr('cx', xR).attr('cy', y(r.right)).attr('r', key ? 5 : 4);
    g.append('text')
      .attr('class', `row-label${key ? ' is-key' : ''}${narrow ? ' is-small' : ''}`)
      .attr('x', xL - 12)
      .attr('y', y(r.left))
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .text(labelText(r, r.left));
    g.append('text')
      .attr('class', `row-label${key ? ' is-key' : ''}${narrow ? ' is-small' : ''}`)
      .attr('x', xR + 12)
      .attr('y', y(r.right))
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'central')
      .text(labelText(r, r.right));
    // A wide invisible line makes each slope easy to hover or tap.
    const hit = g.append('line').attr('class', 'hit-line').attr('x1', 0).attr('x2', width).attr('y1', y(r.left)).attr('y2', y(r.right));
    attachTip(hit, (d) => d.tip);
  }
}

// ---------- Column chart: one column per category ----------

// o.cols: [{label, value, display, cls, tip}]
export function columns(body, width, o) {
  const cols = o.cols;
  const height = o.height || 300;
  const maxValue = d3.max(cols, (c) => c.value) || 1;
  const y = d3.scaleLinear().domain([0, maxValue]).nice(4);
  const yTicks = y.ticks(4).filter((t) => Number.isInteger(t));
  const left = maxWidth(yTicks, (t) => o.yFormat(t), F_TICK) + 10;
  const top = 34;
  const bottom = height - (o.xTitle ? 50 : 28);
  y.range([bottom, top]);
  const x = d3.scaleBand().domain(cols.map((c) => c.label)).range([left, width]).paddingInner(0.25).paddingOuter(0.15);
  const colW = Math.min(28, x.bandwidth());

  const svg = startSvg(body, width, height, o.ariaLabel);
  const axis = svg.append('g').attr('class', 'axis');
  axis
    .selectAll('line')
    .data(yTicks)
    .join('line')
    .attr('class', 'grid')
    .attr('x1', left)
    .attr('x2', width)
    .attr('y1', (d) => Math.round(y(d)) + 0.5)
    .attr('y2', (d) => Math.round(y(d)) + 0.5);
  axis
    .selectAll('text.tick')
    .data(yTicks)
    .join('text')
    .attr('class', 'tick')
    .attr('x', left - 8)
    .attr('y', (d) => y(d))
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'central')
    .text((d) => o.yFormat(d));
  if (o.yTitle) axis.append('text').attr('class', 'axis-title').attr('x', 0).attr('y', 12).text(o.yTitle);
  if (o.xTitle) {
    axis.append('text').attr('class', 'axis-title').attr('x', (left + width) / 2).attr('y', bottom + 40).attr('text-anchor', 'middle').text(o.xTitle);
  }
  const small = x.step() < 30;
  axis
    .selectAll('text.cat')
    .data(cols)
    .join('text')
    .attr('class', (c) => `tick cat${c.cls && c.cls !== 'quiet' ? ' is-key' : ''}${small ? ' is-small' : ''}`)
    .attr('x', (c) => x(c.label) + x.bandwidth() / 2)
    .attr('y', bottom + 18)
    .attr('text-anchor', 'middle')
    .text((c) => c.label);

  const hits = svg
    .append('g')
    .selectAll('rect')
    .data(cols)
    .join('rect')
    .attr('class', 'hit')
    .attr('x', (c) => x(c.label) - (x.step() - x.bandwidth()) / 2)
    .attr('y', top - 20)
    .attr('width', x.step())
    .attr('height', bottom - top + 20);
  attachTip(hits, (c) => c.tip);

  const marks = svg.append('g').attr('class', 'marks');
  for (const c of cols) {
    const cx = x(c.label) + x.bandwidth() / 2;
    const cls = `is-${c.cls || 'quiet'}`;
    if (c.value > 0) marks.append('path').attr('class', `bar ${cls}`).attr('d', columnPath(cx - colW / 2, bottom, y(c.value), colW));
    marks
      .append('text')
      .attr('class', `value-label${c.cls && c.cls !== 'quiet' ? ' is-key' : ''}${small ? ' is-small' : ''}`)
      .attr('x', cx)
      .attr('y', y(c.value) - 7)
      .attr('text-anchor', 'middle')
      .text(c.display);
  }
  svg.append('line').attr('class', 'baseline').attr('x1', left).attr('x2', width).attr('y1', bottom + 0.5).attr('y2', bottom + 0.5);
}

// ---------- Histogram ----------

// o.bins: [{x0, x1, n, tip}]. o.marker: {value, label} draws a labeled vertical line.
export function histogram(body, width, o) {
  const bins = o.bins;
  const height = o.height || 300;
  const maxValue = d3.max(bins, (b) => b.n) || 1;
  const y = d3.scaleLinear().domain([0, maxValue]).nice(4);
  const yTicks = y.ticks(4).filter((t) => Number.isInteger(t));
  const left = maxWidth(yTicks, (t) => o.yFormat(t), F_TICK) + 10;
  const top = 40;
  const bottom = height - (o.xTitle ? 50 : 28);
  y.range([bottom, top]);
  const right = width - 8;
  const x = d3.scaleLinear().domain([bins[0].x0, bins[bins.length - 1].x1]).range([left, right]);

  const svg = startSvg(body, width, height, o.ariaLabel);
  const axis = svg.append('g').attr('class', 'axis');
  axis
    .selectAll('line')
    .data(yTicks)
    .join('line')
    .attr('class', 'grid')
    .attr('x1', left)
    .attr('x2', right)
    .attr('y1', (d) => Math.round(y(d)) + 0.5)
    .attr('y2', (d) => Math.round(y(d)) + 0.5);
  axis
    .selectAll('text.ytick')
    .data(yTicks)
    .join('text')
    .attr('class', 'tick')
    .attr('x', left - 8)
    .attr('y', (d) => y(d))
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'central')
    .text((d) => o.yFormat(d));
  if (o.yTitle) axis.append('text').attr('class', 'axis-title').attr('x', 0).attr('y', 12).text(o.yTitle);
  const xTicks = o.xTicks ? o.xTicks(right - left) : x.ticks(tickCount(right - left, 70));
  axis
    .selectAll('text.xtick')
    .data(xTicks)
    .join('text')
    .attr('class', 'tick')
    .attr('x', (d) => x(d))
    .attr('y', bottom + 18)
    .attr('text-anchor', 'middle')
    .text((d) => o.xFormat(d));
  if (o.xTitle) {
    axis.append('text').attr('class', 'axis-title').attr('x', (left + right) / 2).attr('y', bottom + 40).attr('text-anchor', 'middle').text(o.xTitle);
  }

  const marks = svg.append('g').attr('class', 'marks');
  for (const b of bins) {
    const x0 = x(b.x0) + 1;
    const w = Math.max(1, x(b.x1) - x(b.x0) - 2);
    if (b.n > 0) marks.append('path').attr('class', `bar is-${o.cls || 'accent2'}`).attr('d', columnPath(x0, bottom, Math.min(y(b.n), bottom - 1), w));
  }
  const hits = svg
    .append('g')
    .selectAll('rect')
    .data(bins)
    .join('rect')
    .attr('class', 'hit')
    .attr('x', (b) => x(b.x0))
    .attr('y', top)
    .attr('width', (b) => x(b.x1) - x(b.x0))
    .attr('height', bottom - top);
  attachTip(hits, (b) => b.tip);
  svg.append('line').attr('class', 'baseline').attr('x1', left).attr('x2', right).attr('y1', bottom + 0.5).attr('y2', bottom + 0.5);

  if (o.marker && o.marker.value != null) {
    const mx = x(o.marker.value);
    const labelW = textWidth(o.marker.label, F_VALUE);
    const flip = mx + 8 + labelW > right;
    svg.append('line').attr('class', 'marker-line').attr('x1', mx).attr('x2', mx).attr('y1', top - 14).attr('y2', bottom);
    svg
      .append('text')
      .attr('class', 'value-label is-key')
      .attr('x', flip ? mx - 8 : mx + 8)
      .attr('y', top - 8)
      .attr('text-anchor', flip ? 'end' : 'start')
      .text(o.marker.label);
  }
}

// ---------- Line chart: one value per month ----------

// o.points: [{key, label, value (or null for a gap), tick (axis label or null), tip}]
export function line(body, width, o) {
  const points = o.points;
  const height = o.height || 300;
  const defined = points.filter((p) => p.value != null);
  const [lo, hi] = d3.extent(defined, (p) => p.value);
  const pad = (hi - lo) * 0.12 || hi * 0.1 || 1;
  const y = d3.scaleLinear().domain([Math.max(0, lo - pad), hi + pad]).nice(4);
  const yTicks = y.ticks(4);
  const left = maxWidth(yTicks, (t) => o.yFormat(t), F_TICK) + 10;
  const last = defined[defined.length - 1];
  const endLabel = o.endLabel ? o.endLabel(last) : '';
  const right = width - Math.max(12, Math.min(textWidth(endLabel, F_VALUE) + 12, 90));
  const top = 30;
  const bottom = height - (o.xTitle ? 50 : 28);
  y.range([bottom, top]);
  const x = d3.scaleLinear().domain([0, Math.max(1, points.length - 1)]).range([left + 6, right]);

  const svg = startSvg(body, width, height, o.ariaLabel);
  const axis = svg.append('g').attr('class', 'axis');
  axis
    .selectAll('line')
    .data(yTicks)
    .join('line')
    .attr('class', 'grid')
    .attr('x1', left)
    .attr('x2', right)
    .attr('y1', (d) => Math.round(y(d)) + 0.5)
    .attr('y2', (d) => Math.round(y(d)) + 0.5);
  axis
    .selectAll('text.ytick')
    .data(yTicks)
    .join('text')
    .attr('class', 'tick')
    .attr('x', left - 8)
    .attr('y', (d) => y(d))
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'central')
    .text((d) => o.yFormat(d));
  if (o.yTitle) axis.append('text').attr('class', 'axis-title').attr('x', 0).attr('y', 12).text(o.yTitle);
  const ticks = points.map((p, i) => ({ ...p, i })).filter((p) => p.tick);
  axis
    .selectAll('line.xtick')
    .data(ticks)
    .join('line')
    .attr('class', 'baseline')
    .attr('x1', (p) => x(p.i))
    .attr('x2', (p) => x(p.i))
    .attr('y1', bottom)
    .attr('y2', bottom + 5);
  axis
    .selectAll('text.xtick')
    .data(ticks)
    .join('text')
    .attr('class', 'tick')
    .attr('x', (p) => x(p.i))
    .attr('y', bottom + 20)
    .attr('text-anchor', 'middle')
    .text((p) => p.tick);
  if (o.xTitle) {
    axis.append('text').attr('class', 'axis-title').attr('x', (left + right) / 2).attr('y', bottom + 42).attr('text-anchor', 'middle').text(o.xTitle);
  }
  svg.append('line').attr('class', 'baseline').attr('x1', left).attr('x2', right).attr('y1', bottom + 0.5).attr('y2', bottom + 0.5);

  const path = d3
    .line()
    .defined((p) => p.value != null)
    .x((p, i) => x(i))
    .y((p) => y(p.value));
  svg.append('path').attr('class', `line-path is-${o.cls || 'accent2'}`).attr('d', path(points));
  // Months that stand alone (a gap on both sides) would be invisible as a line, so they get a dot.
  points.forEach((p, i) => {
    const alone = p.value != null && (points[i - 1]?.value ?? null) == null && (points[i + 1]?.value ?? null) == null;
    if (alone) svg.append('circle').attr('class', `dot is-${o.cls || 'accent2'}`).attr('cx', x(i)).attr('cy', y(p.value)).attr('r', 3.5);
  });
  if (last) {
    const li = points.indexOf(last);
    svg.append('circle').attr('class', `dot is-${o.cls || 'accent2'}`).attr('cx', x(li)).attr('cy', y(last.value)).attr('r', 5);
    if (endLabel) {
      svg.append('text').attr('class', 'value-label is-key').attr('x', x(li) + 10).attr('y', y(last.value)).attr('dominant-baseline', 'central').text(endLabel);
    }
  }

  // Crosshair: the pointer only has to be near a month, not on the line.
  const cross = svg.append('g').attr('class', 'crosshair').style('display', 'none');
  cross.append('line').attr('class', 'cross-line').attr('y1', top).attr('y2', bottom);
  cross.append('circle').attr('class', `dot is-${o.cls || 'accent2'}`).attr('r', 5);
  const overlay = svg
    .append('rect')
    .attr('class', 'overlay')
    .attr('data-tip', '')
    .attr('x', left)
    .attr('y', top)
    .attr('width', Math.max(0, right - left))
    .attr('height', bottom - top);
  function nearest(evt) {
    const [px] = d3.pointer(evt, svg.node());
    let best = null;
    points.forEach((p, i) => {
      if (p.value == null) return;
      const dist = Math.abs(x(i) - px);
      if (!best || dist < best.dist) best = { p, i, dist };
    });
    return best;
  }
  function show(evt) {
    const hit = nearest(evt);
    if (!hit) return;
    cross.style('display', null);
    cross.select('line').attr('x1', x(hit.i)).attr('x2', x(hit.i));
    cross.select('circle').attr('cx', x(hit.i)).attr('cy', y(hit.p.value));
    tooltip.show(evt, hit.p.tip);
  }
  overlay
    .on('pointerenter', show)
    .on('pointermove', show)
    .on('pointerdown', show)
    .on('pointerleave', (evt) => {
      if (evt.pointerType === 'touch') return;
      cross.style('display', 'none');
      tooltip.hide();
    });
}

// ---------- Map of campus areas ----------

// o.states: GeoJSON of US states. o.borders: mesh of state borders.
// o.places: [{key, label, lon, lat, n, selected, tip, labelSide}]. o.onSelect(key).
export function campusMap(body, width, o) {
  const height = Math.round(width * 0.62);
  const small = width < 520;
  const projection = d3.geoAlbersUsa().fitExtent(
    [
      [4, 4],
      [width - 4, height - 4],
    ],
    o.states
  );
  const geo = d3.geoPath(projection);
  const svg = startSvg(body, width, height, o.ariaLabel);
  svg.append('path').attr('class', 'map-land').attr('d', geo(o.states));
  svg.append('path').attr('class', 'map-borders').attr('d', geo(o.borders));

  const maxN = d3.max(o.places, (p) => p.n) || 1;
  const radius = d3.scaleSqrt().domain([0, maxN]).range([small ? 3.5 : 5, small ? 9 : 15]);
  const dotR = (p) => (p.n ? radius(p.n) : small ? 3.5 : 5);
  const placed = o.places
    .map((p) => ({ ...p, xy: projection([p.lon, p.lat]) }))
    .filter((p) => p.xy)
    // Larger circles are drawn first so smaller ones stay visible, and the selected one goes on top.
    .sort((a, b) => (a.selected ? 1 : 0) - (b.selected ? 1 : 0) || b.n - a.n);

  const groups = svg
    .append('g')
    .selectAll('g')
    .data(placed)
    .join('g')
    .attr('class', (p) => `map-place${p.selected ? ' is-selected' : ''}${p.n ? '' : ' is-empty'}${o.anySelected && !p.selected ? ' is-dimmed' : ''}`)
    .attr('transform', (p) => `translate(${p.xy[0]},${p.xy[1]})`);
  groups.append('circle').attr('class', 'map-dot').attr('r', (p) => dotR(p));

  // Place each label on the first side of its marker where it fits: inside the map,
  // clear of the other markers and of labels already placed. Selected and larger places
  // choose first. A label with no free spot is left off (its name is still in the tooltip
  // and on the buttons below the map).
  const font = small ? `600 10.5px ${FONT}` : `600 12px ${FONT}`; // measured at the selected (heavier) weight
  const lineH = small ? 12 : 14;
  const taken = placed.map((p) => ({ x0: p.xy[0] - dotR(p), x1: p.xy[0] + dotR(p), y0: p.xy[1] - dotR(p), y1: p.xy[1] + dotR(p), owner: p.key }));
  const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const order = placed.slice().sort((a, b) => (b.selected ? 1 : 0) - (a.selected ? 1 : 0) || b.n - a.n);
  for (const p of order) {
    const w = textWidth(p.label, font);
    const r = dotR(p) + (small ? 3 : 5);
    const [cx, cy] = p.xy;
    const boxes = {
      right: { x0: cx + r, x1: cx + r + w, y0: cy - lineH / 2, y1: cy + lineH / 2 },
      left: { x0: cx - r - w, x1: cx - r, y0: cy - lineH / 2, y1: cy + lineH / 2 },
      top: { x0: cx - w / 2, x1: cx + w / 2, y0: cy - r - lineH, y1: cy - r },
      bottom: { x0: cx - w / 2, x1: cx + w / 2, y0: cy + r, y1: cy + r + lineH },
    };
    const sides = [p.labelSide || 'right', 'right', 'left', 'top', 'bottom'];
    p.side = sides.find((side) => {
      const box = boxes[side];
      if (box.x0 < 0 || box.x1 > width || box.y0 < 0 || box.y1 > height) return false;
      return !taken.some((other) => other.owner !== p.key && overlaps(box, other));
    });
    if (p.side) {
      taken.push({ ...boxes[p.side], owner: p.key });
      // Remember where the label sits relative to its marker, for the label's own click area.
      const b = boxes[p.side];
      p.labelBox = { x: b.x0 - cx, y: b.y0 - cy, w: b.x1 - b.x0, h: b.y1 - b.y0 };
    }
  }
  groups
    .filter((p) => p.side)
    .append('text')
    .attr('class', `map-label${small ? ' is-small' : ''}`)
    .each(function (p) {
      const r = dotR(p) + (small ? 3 : 5);
      const text = d3.select(this).text(p.label);
      if (p.side === 'left') text.attr('x', -r).attr('text-anchor', 'end').attr('dominant-baseline', 'central');
      else if (p.side === 'top') text.attr('y', -r - 3).attr('text-anchor', 'middle');
      else if (p.side === 'bottom') text.attr('y', r + lineH - 3).attr('text-anchor', 'middle');
      else text.attr('x', r).attr('text-anchor', 'start').attr('dominant-baseline', 'central');
    });
  // A generous invisible circle makes each campus easy to tap.
  const hits = groups
    .append('circle')
    .attr('class', 'map-hit')
    .attr('r', (p) => Math.max(radius(p.n) + 4, small ? 11 : 14))
    .on('click', (evt, p) => o.onSelect(p.key));
  attachTip(hits, (p) => p.tip);
  // The name beside each marker selects the campus area too. Its click area is a little
  // larger than the text, so a short name such as "Iowa" is still easy to hit.
  const pad = small ? 3 : 4;
  const labelHits = groups
    .filter((p) => p.labelBox)
    .append('rect')
    .attr('class', 'map-hit')
    .attr('x', (p) => p.labelBox.x - pad)
    .attr('y', (p) => p.labelBox.y - pad)
    .attr('width', (p) => p.labelBox.w + pad * 2)
    .attr('height', (p) => p.labelBox.h + pad * 2)
    .on('click', (evt, p) => o.onSelect(p.key));
  attachTip(labelHits, (p) => p.tip);
}
