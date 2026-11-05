import type { BoothStatus, OrderStatus, PayMethod } from "./types";

export function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function orderCode(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

export function countdown(endsAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((endsAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function stamp(ms: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export const ORDER_LABEL: Record<OrderStatus, string> = {
  incoming: "Masuk",
  cooking: "Dimasak",
  ready: "Siap diambil",
  picked_up: "Selesai",
  cancelled: "Batal",
};

export const BOOTH_LABEL: Record<BoothStatus, string> = {
  draft: "Draf",
  pending: "Menunggu verifikasi",
  revision: "Perlu revisi",
  approved: "Terverifikasi",
  rejected: "Ditolak",
};

export function payLabel(method: PayMethod): string {
  return method === "cash" ? "Booking tunai" : "E-wallet";
}

export function errText(error: unknown): string {
  if (error instanceof Error && error.message) return clean(error.message);
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return clean(message);
  }
  return "Terjadi kendala. Coba lagi.";
}

function clean(message: string): string {
  const line = message.replace(/^Server function error:\s*/i, "").trim();
  if (/unauthorized/i.test(line)) return "Sesi habis. Masuk lagi ya.";
  return line;
}

export function tagLabel(id: string): string {
  if (id === "halal") return "Halal";
  if (id === "pedas") return "Pedas";
  if (id === "bestseller") return "Best seller";
  return id;
}
