const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 30],
  ["month", 12],
  ["year", Infinity],
];

export function relativeTime(iso: string, now = Date.now()) {
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return iso;

  let value = Math.round((now - parsed) / 1000);
  for (const [unit, step] of UNITS) {
    if (Math.abs(value) < step) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-value, unit);
    }
    value = Math.round(value / step);
  }
  return iso;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** The counter's date die: `04 SEP 2026`, fixed width so the label grid never shifts. */
export function dateStamp(iso: string | number | Date = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "——";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
