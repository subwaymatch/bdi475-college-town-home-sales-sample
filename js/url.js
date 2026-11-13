// Keeps the visitor's settings in the page address, so a copied link opens the same view.

const params = new URLSearchParams(window.location.search);
let timer = null;

export function read(key) {
  return params.get(key);
}

export function readNumber(key) {
  const text = params.get(key);
  if (text == null || text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function flush() {
  timer = null;
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

// write({key: value}). A null or empty value removes the key, which keeps links short.
export function write(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value == null || value === '') params.delete(key);
    else params.set(key, String(value));
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 150);
}

// The address of the current view, with any pending changes included.
export function currentLink() {
  if (timer) {
    clearTimeout(timer);
    flush();
  }
  return window.location.href;
}
