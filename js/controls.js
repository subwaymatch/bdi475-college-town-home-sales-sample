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
