// Small helpers for form controls.

import * as F from './format.js';

export function debounce(fn, wait = 160) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Fills a <select>. options: [{value, label}] or [{group, options: [...]}].
export function fillSelect(select, options, selected) {
  select.replaceChildren();
  const add = (parent, opt) => {
    const node = document.createElement('option');
    node.value = String(opt.value);
    node.textContent = opt.label;
    parent.appendChild(node);
  };
  for (const opt of options) {
    if (opt.group) {
      const group = document.createElement('optgroup');
      group.label = opt.group;
      opt.options.forEach((o) => add(group, o));
      select.appendChild(group);
    } else {
      add(select, opt);
    }
  }
  if (selected != null) select.value = String(selected);
  if (select.selectedIndex < 0) select.selectedIndex = 0;
}

// Reads a whole-dollar amount from a text box. "$400,000" and "400000" both give 400000.
// An empty box gives null.
export function parseAmount(text) {
  const cleaned = String(text).replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

// A dollar text box that accepts any amount, and tidies it to 400,000 when the visitor leaves it.
export function moneyInput(input, initial, onChange) {
  const show = (value) => {
    input.value = value == null ? '' : F.int(value);
  };
  show(initial);
  const changed = debounce(() => onChange(parseAmount(input.value)));
  input.addEventListener('input', changed);
  input.addEventListener('change', () => {
    const value = parseAmount(input.value);
    show(value);
    onChange(value);
  });
  input.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') input.blur();
  });
  return { set: show };
}

// A whole-number box (for example a number of bedrooms). An empty box gives null.
export function numberInput(input, initial, onChange) {
  input.value = initial == null ? '' : String(initial);
  const read = () => {
    if (input.value.trim() === '') return null;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : null;
  };
  input.addEventListener('input', debounce(() => onChange(read())));
  input.addEventListener('change', () => onChange(read()));
  return { set: (value) => (input.value = value == null ? '' : String(value)) };
}

// A range filter with two slider handles and two number boxes that stay in sync.
// Dragging gives a rough range; typing gives an exact one.
export function rangeControl(root, { min, max, step, lo, hi, onChange }) {
  const sliderLo = root.querySelector('.range-lo');
  const sliderHi = root.querySelector('.range-hi');
  const boxLo = root.querySelector('.range-box-lo');
  const boxHi = root.querySelector('.range-box-hi');
  const fill = root.querySelector('.range-fill');
  const decimals = (String(step).split('.')[1] || '').length;
  const snap = (value) => Number((Math.round(value / step) * step).toFixed(decimals));
  const clamp = (value) => Math.min(max, Math.max(min, snap(value)));

  for (const input of [sliderLo, sliderHi, boxLo, boxHi]) {
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
  }

  function paint() {
    sliderLo.value = String(lo);
    sliderHi.value = String(hi);
    boxLo.value = String(lo);
    boxHi.value = String(hi);
    const span = max - min || 1;
    fill.style.left = `${((lo - min) / span) * 100}%`;
    fill.style.right = `${((max - hi) / span) * 100}%`;
    // When both handles sit at the top end, the lower one must stay reachable.
    sliderLo.style.zIndex = lo > min + span / 2 ? '3' : '2';
  }

  const emit = debounce(() => onChange(lo, hi), 120);

  sliderLo.addEventListener('input', () => {
    lo = Math.min(clamp(Number(sliderLo.value)), hi);
    paint();
    emit();
  });
  sliderHi.addEventListener('input', () => {
    hi = Math.max(clamp(Number(sliderHi.value)), lo);
    paint();
    emit();
  });
  // Number boxes apply when the visitor finishes typing (Enter, Tab or clicking away).
  boxLo.addEventListener('change', () => {
    const value = boxLo.value.trim() === '' ? min : Number(boxLo.value);
    lo = Math.min(clamp(Number.isFinite(value) ? value : min), hi);
    paint();
    onChange(lo, hi);
  });
  boxHi.addEventListener('change', () => {
    const value = boxHi.value.trim() === '' ? max : Number(boxHi.value);
    hi = Math.max(clamp(Number.isFinite(value) ? value : max), lo);
    paint();
    onChange(lo, hi);
  });
  for (const box of [boxLo, boxHi]) {
    box.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') box.blur();
    });
  }

  // Clicking or tapping the rail moves the nearer handle to that spot, and the visitor can keep
  // dragging from there. Which handle moves:
  //   - a click outside the selected range moves the handle on that side
  //     (left of the start moves the start, right of the end moves the end);
  //   - a click inside the range moves whichever handle is closer;
  //   - a click exactly halfway between them moves the end.
  // The handles themselves still drag as normal.
  const rail = root.querySelector('.range-slider');
  const HANDLE = 22; // handle width in pixels; its center travels from 11px to width - 11px

  function valueAt(clientX) {
    const box = rail.getBoundingClientRect();
    const usable = Math.max(1, box.width - HANDLE);
    const frac = Math.min(1, Math.max(0, (clientX - box.left - HANDLE / 2) / usable));
    return clamp(min + frac * (max - min));
  }

  function pickHandle(value) {
    if (value <= lo) return 'lo';
    if (value >= hi) return 'hi';
    // Compare with a small tolerance, so decimal rounding cannot turn an exact tie into a win for the start.
    return value - lo < hi - value - step / 1000 ? 'lo' : 'hi';
  }

  function moveTo(which, value) {
    if (which === 'lo') lo = Math.min(value, hi);
    else hi = Math.max(value, lo);
    paint();
  }

  let dragging = null;
  rail.addEventListener('pointerdown', (evt) => {
    // Presses on a handle are left to the browser's own slider behaviour.
    if (evt.button !== 0 || evt.target === sliderLo || evt.target === sliderHi) return;
    const value = valueAt(evt.clientX);
    dragging = pickHandle(value);
    moveTo(dragging, value);
    emit();
    rail.setPointerCapture(evt.pointerId);
    // Keyboard focus follows, so the arrow keys fine-tune the handle that just moved.
    (dragging === 'lo' ? sliderLo : sliderHi).focus({ preventScroll: true });
    evt.preventDefault();
  });
  rail.addEventListener('pointermove', (evt) => {
    if (!dragging) return;
    moveTo(dragging, valueAt(evt.clientX));
    emit();
  });
  const stop = () => {
    dragging = null;
  };
  rail.addEventListener('pointerup', stop);
  rail.addEventListener('pointercancel', stop);

  paint();
  return {
    set(newLo, newHi) {
      lo = clamp(newLo);
      hi = Math.max(clamp(newHi), lo);
      paint();
    },
  };
}
