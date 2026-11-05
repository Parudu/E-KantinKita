import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Clock, Flame, MapPin, Megaphone, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { getHome } from "@/lib/kantin/api";
import { countdown, errText } from "@/lib/kantin/format";
import { prettyTime } from "@/lib/kantin/hours";
import { flashBuzz, freshFlashIds, pushNotice } from "@/lib/kantin/notify";
import type { HomeData, Profile } from "@/lib/kantin/types";
import { CATEGORIES, TAGS } from "@/lib/kantin/types";
import { Price, Tags, Wordmark, useNow } from "./bits";

const PRICES = [
  { id: "all", label: "Semua harga", max: null as number | null },
  { id: "10", label: "≤ 10rb", max: 10000 },
  { id: "15", label: "≤ 15rb", max: 15000 },
  { id: "25", label: "≤ 25rb", max: 25000 },
];

export function StudentHome({ profile }: { profile: Profile }) {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const now = useNow();

  useEffect(() => {
    let live = true;
    const load = () => {
      getHome()
        .then((next) => {
          if (!live) return;
          setData(next);
          const fresh = freshFlashIds(next.flashes.map((flash) => flash.id));
          if (fresh.length > 0) {
            flashBuzz();
            const first = next.flashes.find((flash) => fresh.includes(flash.id));
            if (first) {
              pushNotice("Flash sale dimulai", `${first.menuName} di ${first.canteenName}`);
              toast("Flash sale baru dibuka", { description: first.menuName });
            }
          }
        })
        .catch((err: unknown) => {
          if (live) setError(errText(err));
        });
    };
    load();
    const id = window.setInterval(load, 12000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  const filtering = query.trim().length > 0 || category !== "Semua" || maxPrice !== null || tags.length > 0;
  const results = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.menus.filter((menu) => {
      if (!menu.available) return false;
      if (q && !`${menu.name} ${menu.canteenName} ${menu.category}`.toLowerCase().includes(q)) return false;
      if (category !== "Semua" && menu.category !== category) return false;
      const price = menu.salePrice ?? menu.price;
      if (maxPrice !== null && price > maxPrice) return false;
      if (tags.some((tag) => !menu.tags.includes(tag))) return false;
      return true;
    });
  }, [data, query, category, maxPrice, tags]);

  if (error) return <p className="text-sm text-chili">{error}</p>;
  if (!data) {
    return (
      <div>
        <Wordmark />
        <p className="mt-4 text-sm text-muted">Membuka etalase kantin…</p>
      </div>
    );
  }

  const open = data.canteens.filter((canteen) => canteen.isOpen);
  const closed = data.canteens.filter((canteen) => !canteen.isOpen);
  const top = data.leaderboard[0]?.orders ?? 1;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <p className="text-sm text-muted">{profile.name.split(" ")[0]}</p>
      </header>
      <div>
        <h1 className="text-4xl font-semibold leading-tight">Lagi lapar?</h1>
        <p className="mt-2 max-w-md text-muted">Pesan dari kantin yang buka. HP-mu bergetar seperti dering telpon kalau pesanan sudah siap.</p>
      </div>

      {data.flashes.map((flash) => (
        <Link
          key={flash.id}
          to="/kantin/$canteenId"
          params={{ canteenId: String(flash.canteenId) }}
          className="flex items-center gap-3 rounded-3xl bg-chili p-4 text-paper"
        >
          <img src={flash.photo} alt="" className="size-20 rounded-2xl object-cover" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest">
              <Flame className="size-4" /> Flash sale
            </span>
            <span className="mt-1 block text-lg font-semibold">{flash.menuName}</span>
            <span className="block text-sm text-foam">{flash.canteenName}</span>
            <span className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="tabular-nums">Sisa {flash.stockLeft} porsi</span>
              <span className="font-semibold tabular-nums">{now ? countdown(flash.endsAt, now) : "—"}</span>
            </span>
          </span>
        </Link>
      ))}

      {data.announcements[0] ? (
        <div className="flex gap-3 rounded-3xl border border-line bg-paper p-4">
          <Megaphone className="mt-0.5 size-5 shrink-0 text-chili" />
          <div>
            <p className="text-sm font-semibold">{data.announcements[0].title}</p>
            <p className="text-sm text-muted">{data.announcements[0].body}</p>
          </div>
        </div>
      ) : null}

      <label className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-paper px-3">
        <Search className="size-4 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nasi goreng, bakso, kantin…"
          className="w-full bg-transparent text-base outline-none"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["Semua", ...CATEGORIES].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`h-10 shrink-0 rounded-full px-3 text-sm ${category === item ? "bg-ink text-paper" : "bg-paper text-ink border border-line"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {PRICES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMaxPrice(item.max)}
            className={`h-10 shrink-0 rounded-full px-3 text-sm ${maxPrice === item.max ? "bg-foam text-chili" : "bg-paper text-muted border border-line"}`}
          >
            {item.label}
          </button>
        ))}
        {TAGS.map((tag) => {
          const on = tags.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => setTags((current) => (on ? current.filter((id) => id !== tag.id) : [...current, tag.id]))}
              className={`h-10 shrink-0 rounded-full px-3 text-sm ${on ? "bg-foam text-chili" : "bg-paper text-muted border border-line"}`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      {filtering ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Menu yang cocok</h2>
          {results.length === 0 ? <p className="text-sm text-muted">Tidak ada menu dengan saringan itu.</p> : null}
          {results.map((menu) => (
            <Link
              key={menu.id}
              to="/kantin/$canteenId"
              params={{ canteenId: String(menu.canteenId) }}
              className="flex gap-3 rounded-3xl border border-line bg-paper p-3"
            >
              <img src={menu.photo} alt="" className="size-20 rounded-2xl object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{menu.name}</span>
                <span className="block text-sm text-muted">{menu.canteenName}</span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <Price price={menu.price} sale={menu.salePrice} />
                  <span className="text-xs text-muted">{menu.isOpen ? "Buka" : "Tutup"}</span>
                </span>
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Sedang buka</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {open.map((canteen) => (
                <CanteenCardLink key={canteen.id} canteen={canteen} />
              ))}
            </div>
            {open.length === 0 ? <p className="text-sm text-muted">Semua kantin sedang tutup.</p> : null}
          </section>
          {closed.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">Lagi tutup</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {closed.map((canteen) => (
                  <CanteenCardLink key={canteen.id} canteen={canteen} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <section className="rounded-3xl border border-line bg-paper p-4">
        <h2 className="text-2xl font-semibold">Kantin terpopuler minggu ini</h2>
        <ol className="mt-4 space-y-3">
          {data.leaderboard.map((row, index) => (
            <li key={row.id} className="flex items-center gap-3">
              <span className={`grid size-8 place-items-center rounded-full text-sm font-semibold ${index === 0 ? "bg-chili text-paper" : "bg-cream text-ink"}`}>
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{row.name}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-cream">
                  <span className="block h-full bg-chili" style={{ width: `${Math.max(8, Math.round((row.orders / top) * 100))}%` }} />
                </span>
              </span>
              <span className="text-sm tabular-nums text-muted">{row.orders}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CanteenCardLink({ canteen }: { canteen: HomeData["canteens"][number] }) {
  return (
    <Link
      to="/kantin/$canteenId"
      params={{ canteenId: String(canteen.id) }}
      data-theme={canteen.theme}
      className="overflow-hidden rounded-3xl border border-line bg-paper"
    >
      <span className="theme-bar block h-1.5" />
      <span className="flex gap-3 p-3">
        {canteen.cover ? (
          <img src={canteen.cover} alt="" className="h-28 w-24 rounded-2xl object-cover" />
        ) : (
          <span className="theme-soft grid h-28 w-24 place-items-center rounded-2xl text-xs">Menu</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold">
            {canteen.name}
            {canteen.verified ? <BadgeCheck className="size-4 text-chili" /> : null}
          </span>
          <span className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" /> {canteen.location}
          </span>
          <span className="mt-1 flex items-center gap-1 text-sm text-muted">
            <Clock className="size-3.5" /> {prettyTime(canteen.openTime)}–{prettyTime(canteen.closeTime)}
          </span>
          <span className="mt-2 flex items-center justify-between gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${canteen.isOpen ? "theme-soft" : "bg-cream text-muted"}`}>
              {canteen.isOpen ? "Buka" : canteen.nextOpenLabel}
            </span>
            {canteen.rating ? (
              <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                <Star className="size-3.5 fill-chili text-chili" /> {canteen.rating.toFixed(1)}
              </span>
            ) : (
              <span className="text-xs text-muted">Baru</span>
            )}
          </span>
        </span>
      </span>
    </Link>
  );
}
