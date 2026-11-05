import type { ThemeId } from "./types";

const THEMES: readonly ThemeId[] = ["chili", "leaf", "sea", "mango", "ink"];

export function asTheme(value: string): ThemeId {
  return THEMES.includes(value as ThemeId) ? (value as ThemeId) : "chili";
}

export function minutesInJakarta(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function prettyTime(hhmm: string): string {
  return hhmm.slice(0, 5).replace(":", ".");
}

export function parseHHMM(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${match[1]}:${match[2]}`;
}

export function openState(
  openTime: string,
  closeTime: string,
  forceClosed: boolean,
): { isOpen: boolean; nextOpenLabel: string | null } {
  const pretty = prettyTime(openTime);
  const again = `Buka lagi jam ${pretty}`;
  if (forceClosed) return { isOpen: false, nextOpenLabel: again };
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open === null || close === null || close <= open) {
    return { isOpen: false, nextOpenLabel: again };
  }
  const now = minutesInJakarta();
  if (now >= open && now < close) return { isOpen: true, nextOpenLabel: null };
  return { isOpen: false, nextOpenLabel: again };
}

function toMinutes(value: string): number | null {
  const parsed = parseHHMM(value.slice(0, 5));
  if (!parsed) return null;
  const [hour, minute] = parsed.split(":").map(Number);
  return hour * 60 + minute;
}

export function dayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function lastSevenDays(): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  for (let ago = 6; ago >= 0; ago -= 1) {
    const date = new Date(Date.now() - ago * 86_400_000);
    const key = dayKey(date);
    const label = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
    }).format(date);
    days.push({ key, label: label.replace(".", "") });
  }
  return days;
}

export function salePrice(base: number, discountPct: number | null, special: number | null): number {
  if (special && special > 0 && special < base) return special;
  if (discountPct && discountPct > 0 && discountPct < 100) {
    const raw = Math.round((base * (100 - discountPct)) / 100);
    return Math.max(500, Math.round(raw / 500) * 500);
  }
  return base;
}
