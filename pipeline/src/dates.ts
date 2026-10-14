const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date part of an ISO date/timestamp: "2026-09-25T00:00:00" -> "2026-09-25". */
export function toISODate(value: string): string {
  const datePart = value.length >= 10 ? value.slice(0, 10) : value;
  const m = ISO_RE.exec(datePart);
  if (!m) throw new Error(`Not an ISO date: ${JSON.stringify(value)}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`Not an ISO date: ${JSON.stringify(value)}`);
  // Round-trip to reject rollovers like 2026-02-30 or 2026-13-40.
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error(`Not an ISO date: ${JSON.stringify(value)}`);
  }
  // Reject trailing garbage: allow YYYY-MM-DD or YYYY-MM-DD[T ]...
  if (value.length > 10 && value[10] !== 'T' && value[10] !== ' ') {
    throw new Error(`Not an ISO date: ${JSON.stringify(value)}`);
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function toUTC(date: string): Date {
  const [y, m, d] = toISODate(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUTC(dt);
}

/** Same day-of-month `months` earlier, clamped to that month's last day. */
export function minusMonths(date: string, months: number): string {
  const [y, m, d] = toISODate(date).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUTC(target);
}

/** Number of Mon–Fri days after `from`, up to and including `to` (0 if to <= from). */
export function weekdaysAfter(from: string, to: string): number {
  let count = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    const day = toUTC(d).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
