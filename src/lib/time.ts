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
