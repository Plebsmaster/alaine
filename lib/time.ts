// Dag-grenzen in de tijdzone van de gebruiker, zonder externe bibliotheek.

type YMD = { year: number; month: number; day: number };

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const get = (type: string) =>
    Number(fmt.formatToParts(date).find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Verschil tussen lokale wandkloktijd in `timeZone` en UTC, in ms. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Het UTC-moment waarop het in `timeZone` middernacht is op de gegeven datum. */
function zonedMidnight({ year, month, day }: YMD, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let ts = guess - zoneOffsetMs(new Date(guess), timeZone);
  // Tweede ronde corrigeert voor een zomertijdwissel tussen gok en uitkomst.
  ts = guess - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

export function localDate(now: Date, timeZone: string): YMD {
  const p = partsInZone(now, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

function addDays({ year, month, day }: YMD, n: number): YMD {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Begin (inclusief) en eind (exclusief) van de lokale dag waarin `now` valt. */
export function dayBounds(now: Date, timeZone: string, offsetDays = 0) {
  const today = addDays(localDate(now, timeZone), offsetDays);
  return {
    start: zonedMidnight(today, timeZone),
    end: zonedMidnight(addDays(today, 1), timeZone),
  };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Hele dagen tussen vandaag en een datum (JJJJ-MM-DD), in de tijdzone van de gebruiker. */
export function daysUntil(isoDate: string, now: Date, timeZone: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const today = localDate(now, timeZone);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000,
  );
}
