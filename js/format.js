// Number and text formatting shared by the whole site.

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const int0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DASH = '—';

// $410,000
export function usd(value) {
  return value == null ? DASH : usd0.format(value);
}

// $410K, $1.2M: for chart axes, where full numbers would not fit.
export function usdShort(value) {
  if (value == null) return DASH;
  const abs = Math.abs(value);
  if (abs >= 1e6) return `$${trimZero((value / 1e6).toFixed(abs >= 1e7 ? 0 : 1))}M`;
  if (abs >= 1e3) return `$${Math.round(value / 1e3)}K`;
  return `$${Math.round(value)}`;
}

function trimZero(text) {
  return text.replace(/\.0$/, '');
}

// 35,442
export function int(value) {
  return value == null ? DASH : int0.format(value);
}

// 7.6
export function one(value) {
  return value == null ? DASH : dec1.format(value);
}

// 7.6%
export function pct(value) {
  return value == null ? DASH : `${dec1.format(value)}%`;
}

// 1.93% (property tax rates are small, so two decimals)
export function pct2(value) {
  return value == null ? DASH : `${dec2.format(value)}%`;
}

// +7.6% or -4.6% (with a real minus sign)
export function signedPct(value) {
  if (value == null) return DASH;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${dec1.format(Math.abs(value))}%`;
}

// 7 days, 23.5 days, 1 day
export function days(value) {
  if (value == null) return DASH;
  const text = Number.isInteger(value) ? int0.format(value) : dec1.format(value);
  return `${text} ${value === 1 ? 'day' : 'days'}`;
}

// 3.4 miles
export function miles(value) {
  if (value == null) return DASH;
  return `${dec1.format(value)} ${value === 1 ? 'mile' : 'miles'}`;
}

// 1,204 sales, 1 sale
export function sales(n) {
  return `${int0.format(n)} ${n === 1 ? 'sale' : 'sales'}`;
}

// "A", "A and B", "A, B and C"
export function listJoin(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Bold, escaped text for written answers.
export function strong(text) {
  return `<strong>${escapeHtml(text)}</strong>`;
}
