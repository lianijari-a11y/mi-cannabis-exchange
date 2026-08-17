// Pure, dependency-free POS calculation logic — split out of
// register-panel.tsx (a "use client" component whose other imports pull in
// the server-action chain, which isn't safe to import from a plain test
// runner) so this can be unit tested directly. No behavior change from the
// original inline versions.

export type ThcLineInput = {
  quantity: number;
  unit: string;
  thcPercent: number | null;
  thcMgPerUnit: number | null;
};

const GRAMS_PER_LB = 453.592;

// Approximate — see CLAUDE.md §24. Weight-based products (thcPercent, sold
// by lb) convert via mass; unit-counted products (thcMgPerUnit, e.g.
// edibles/pre-rolls) are already labeled in mg per piece. Liquid concentrate
// (sold by liter) has no mass-based conversion here, so it's left out rather
// than guessed at.
export function thcMgForLine(line: ThcLineInput): number | null {
  if (line.thcMgPerUnit) return line.thcMgPerUnit * line.quantity;
  if (line.thcPercent && line.unit === "lb") {
    const grams = line.quantity * GRAMS_PER_LB;
    return grams * (line.thcPercent / 100) * 1000;
  }
  return null;
}

// Cosmetic touch on the printed receipt — no discount/gameplay logic tied
// to it, just theming, per the "themed receipt / holiday watermarks" ask.
// Each entry is a specific-date holiday with a few days' grace window
// (retail generally themes the days around a holiday, not just the exact
// date); falls back to a broader seasonal line when no holiday is close.
type Holiday = { date: Date; greeting: string; icon: string; graceDays?: number };

// Meeus/Jones/Butcher algorithm — Easter has no fixed date, so it's
// computed rather than hardcoded.
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// 4th Thursday of November.
function thanksgiving(year: number): { month: number; day: number } {
  let count = 0;
  for (let day = 1; day <= 30; day++) {
    if (new Date(year, 10, day).getDay() === 4) {
      count++;
      if (count === 4) return { month: 10, day };
    }
  }
  return { month: 10, day: 22 };
}

function holidaysForYear(year: number): Holiday[] {
  const easter = easterSunday(year);
  const turkey = thanksgiving(year);
  return [
    { date: new Date(year, 0, 1), greeting: "Happy New Year!", icon: "🎉" },
    { date: new Date(year, 1, 14), greeting: "Happy Valentine's Day!", icon: "❤️" },
    { date: new Date(year, 2, 17), greeting: "Happy St. Patrick's Day!", icon: "☘️" },
    { date: new Date(year, easter.month, easter.day), greeting: "Happy Easter!", icon: "🐣" },
    { date: new Date(year, 6, 4), greeting: "Happy 4th of July!", icon: "🎆" },
    { date: new Date(year, 9, 31), greeting: "Happy Halloween!", icon: "🎃" },
    { date: new Date(year, turkey.month, turkey.day), greeting: "Happy Thanksgiving!", icon: "🦃", graceDays: 1 },
    { date: new Date(year, 11, 25), greeting: "Merry Christmas!", icon: "🎄", graceDays: 4 },
    { date: new Date(year, 11, 31), greeting: "Happy New Year's Eve!", icon: "🥂" },
  ];
}

function daysBetween(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.abs(start - end) / 86_400_000;
}

// Adjacent years matter at the boundary — e.g. Jan 1 needs last year's
// Dec 31 New Year's Eve considered too, and Easter/Thanksgiving's dates
// shift enough year to year that only computing the current year could
// miss a nearby one right at a year rollover. Picks the CLOSEST holiday
// within its grace window, not just the first one found — New Year's Eve
// and New Year's Day are only a day apart with overlapping windows, and an
// arbitrary array-order pick would let the wrong one win on the exact date
// of the other.
export function holidayInfo(date: Date): { greeting: string; icon: string } {
  const candidates = [
    ...holidaysForYear(date.getFullYear() - 1),
    ...holidaysForYear(date.getFullYear()),
    ...holidaysForYear(date.getFullYear() + 1),
  ];
  let best: (Holiday & { dist: number }) | null = null;
  for (const h of candidates) {
    const dist = daysBetween(date, h.date);
    if (dist <= (h.graceDays ?? 2) && (!best || dist < best.dist)) {
      best = { ...h, dist };
    }
  }
  if (best) return { greeting: best.greeting, icon: best.icon };
  const month = date.getMonth();
  if (month === 9) return { greeting: "Happy fall!", icon: "🍂" };
  if (month >= 5 && month <= 7) return { greeting: "Enjoy the summer!", icon: "☀️" };
  if (month >= 2 && month <= 4) return { greeting: "Happy spring!", icon: "🌱" };
  return { greeting: "Thanks for stopping in!", icon: "🌿" };
}
