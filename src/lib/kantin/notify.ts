import type { RingDetail, StudentOrder } from "./types";
import { orderCode } from "./format";

const STATUS_KEY = "kantin-order-status-v1";
const FLASH_KEY = "kantin-seen-flash-v1";
const RING_EVENT = "kantin-ring";

const RING_PATTERN = [900, 400, 900, 400, 900, 400, 1400, 700];
const FLASH_PATTERN = [180, 90, 180, 90, 420];

export function previewRing(detail: RingDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RING_EVENT, { detail }));
}

export function onRing(listener: (detail: RingDetail) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<RingDetail>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(RING_EVENT, handler);
  return () => window.removeEventListener(RING_EVENT, handler);
}

export function ringVibrate(kind: RingDetail["kind"] = "ready"): void {
  const pattern = kind === "preview" || kind === "ready" || kind === "reminder" ? RING_PATTERN : FLASH_PATTERN;
  try {
    navigator.vibrate?.(kind === "ready" || kind === "reminder" || kind === "preview" ? RING_PATTERN : pattern);
  } catch {
    /* vibration unsupported */
  }
}

export function stopVibrate(): void {
  try {
    navigator.vibrate?.(0);
  } catch {
    /* ignore */
  }
}

export function flashBuzz(): void {
  try {
    navigator.vibrate?.(FLASH_PATTERN);
  } catch {
    /* ignore */
  }
}

export async function ensureNotifyPermission(): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

export function pushNotice(title: string, body: string): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.svg" });
  } catch {
    /* ignore */
  }
}

export function setReadyBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (value?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) void nav.setAppBadge?.(count)?.catch(() => undefined);
  else void nav.clearAppBadge?.()?.catch(() => undefined);
}

export function detectReady(orders: StudentOrder[]): RingDetail | null {
  let prev: Record<string, string> = {};
  try {
    prev = JSON.parse(localStorage.getItem(STATUS_KEY) || "{}") as Record<string, string>;
  } catch {
    prev = {};
  }
  const first = localStorage.getItem(`${STATUS_KEY}-init`) !== "1";
  const next: Record<string, string> = {};
  let event: RingDetail | null = null;
  for (const order of orders) {
    const id = String(order.id);
    const token = `${order.status}${order.needsReminder ? ":r" : ""}`;
    next[id] = token;
    if (first) continue;
    const was = prev[id];
    if (!was) continue;
    if (order.status === "ready" && !was.startsWith("ready")) {
      event = ringFrom(order, "ready");
    } else if (order.needsReminder && order.status === "ready" && !was.endsWith(":r")) {
      event = event ?? ringFrom(order, "reminder");
    }
  }
  localStorage.setItem(STATUS_KEY, JSON.stringify(next));
  localStorage.setItem(`${STATUS_KEY}-init`, "1");
  return event;
}

function ringFrom(order: StudentOrder, kind: "ready" | "reminder"): RingDetail {
  const names = order.items.map((item) => `${item.qty}× ${item.name}`).join(", ");
  return {
    kind,
    title: kind === "ready" ? "Pesanan siap diambil" : "Masih menunggu diambil",
    canteen: order.canteenName,
    code: orderCode(order.id),
    subtitle: names || "Langsung ke loket ya.",
  };
}

export function freshFlashIds(ids: number[]): number[] {
  let prev: number[] | null = null;
  try {
    const raw = localStorage.getItem(FLASH_KEY);
    prev = raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    prev = null;
  }
  localStorage.setItem(FLASH_KEY, JSON.stringify(ids));
  if (!prev) return [];
  return ids.filter((id) => !prev.includes(id));
}

export function readyCount(orders: StudentOrder[]): number {
  return orders.filter((order) => order.status === "ready").length;
}
