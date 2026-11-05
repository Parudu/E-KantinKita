import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Clock, MapPin, Minus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { createOrder, getCanteen } from "@/lib/kantin/api";
import { countdown, errText, rupiah } from "@/lib/kantin/format";
import { prettyTime } from "@/lib/kantin/hours";
import { ensureNotifyPermission } from "@/lib/kantin/notify";
import type { CanteenDetail, MenuItem, PayMethod } from "@/lib/kantin/types";
import { Btn, Price, Stars, Tags, useNow } from "./bits";

export function CanteenView({ canteenId }: { canteenId: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<CanteenDetail | null>(null);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [pay, setPay] = useState<PayMethod>("cash");
  const [sheet, setSheet] = useState<"cart" | "qr" | "surprise" | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  useEffect(() => {
    let live = true;
    getCanteen({ data: { id: canteenId } })
      .then((next) => {
        if (live) setData(next);
      })
      .catch((err: unknown) => {
        if (live) setError(errText(err));
      });
    return () => {
      live = false;
    };
  }, [canteenId]);

  if (error) return <p className="text-sm text-chili">{error}</p>;
  if (!data) return <p className="text-sm text-muted">Membuka menu…</p>;

  const lines = data.menus
    .map((menu) => ({ menu, qty: cart[menu.id] ?? 0 }))
    .filter((line) => line.qty > 0);
  const total = lines.reduce((sum, line) => sum + (line.menu.salePrice ?? line.menu.price) * line.qty, 0);
  const count = lines.reduce((sum, line) => sum + line.qty, 0);

  function add(menu: MenuItem, delta: number) {
    setCart((current) => {
      const next = Math.max(0, (current[menu.id] ?? 0) + delta);
      if (menu.stockLeft != null && next > menu.stockLeft) {
        toast.error(`Flash sale tinggal ${menu.stockLeft} porsi`);
        return current;
      }
      return { ...current, [menu.id]: next };
    });
  }

  async function submit(surprise: boolean) {
    setBusy(true);
    try {
      await ensureNotifyPermission();
      const result = await createOrder({
        data: {
          canteenId,
          payMethod: pay,
          note,
          surprise,
          lines: lines.map((line) => ({ menuId: line.menu.id, qty: line.qty })),
        },
      });
      toast.success(surprise ? "Menu surprise sudah diundi" : "Pesanan masuk dapur");
      await navigate({ to: "/struk/$orderId", params: { orderId: String(result.orderId) } });
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const canteen = data.canteen;
  return (
    <div className="space-y-5" data-theme={canteen.theme}>
      <Link to="/" className="text-sm text-muted">
        Kembali
      </Link>
      <header>
        <span className="theme-bar mb-3 block h-1.5 w-16 rounded-full" />
        <h1 className="flex items-center gap-2 text-4xl font-semibold">
          {canteen.name}
          {canteen.verified ? <BadgeCheck className="size-6 text-chili" /> : null}
        </h1>
        <p className="mt-2 text-muted">{canteen.blurb}</p>
        <p className="mt-2 flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-4" /> {canteen.location}
        </p>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
          <Clock className="size-4" /> {prettyTime(canteen.openTime)}–{prettyTime(canteen.closeTime)}
        </p>
        {canteen.rating ? (
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Stars value={canteen.rating} />
            <span className="tabular-nums">{canteen.rating.toFixed(1)}</span>
            <span className="text-muted">({canteen.reviewCount})</span>
          </p>
        ) : null}
      </header>

      {!canteen.isOpen ? (
        <p className="rounded-2xl bg-foam px-4 py-3 text-sm font-medium text-chili">{canteen.nextOpenLabel}. Pemesanan dikunci di luar jam operasional.</p>
      ) : null}
      {canteen.autoKitchen ? (
        <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-muted">
          Dapur contoh ini menandai pesanan siap sendiri dalam beberapa detik, supaya dering HP bisa kamu coba.
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canteen.isOpen}
        onClick={() => setSheet("surprise")}
        className="flex w-full items-center gap-3 rounded-3xl border border-line bg-paper p-4 text-left disabled:opacity-50"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-foam text-chili">
          <Sparkles className="size-5" />
        </span>
        <span>
          <span className="block font-semibold">Menu surprise</span>
          <span className="text-sm text-muted">Satu menu acak, diskon 30%. Buat sisa stok dapur.</span>
        </span>
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.menus.map((menu) => (
          <article key={menu.id} className="overflow-hidden rounded-3xl border border-line bg-paper">
            <img src={menu.photo} alt={menu.name} className="h-40 w-full object-cover" />
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-sans text-base font-semibold">{menu.name}</h2>
                {menu.endsAt && now ? (
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-chili">{countdown(menu.endsAt, now)}</span>
                ) : null}
              </div>
              <p className="text-sm text-muted">{menu.description}</p>
              <Tags tags={menu.tags} />
              <div className="flex items-center justify-between gap-2">
                <Price price={menu.price} sale={menu.salePrice} />
                {menu.stockLeft != null ? <span className="text-xs text-chili">Sisa {menu.stockLeft}</span> : null}
              </div>
              {!menu.available ? (
                <p className="text-sm text-muted">Habis</p>
              ) : (
                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="grid size-11 place-items-center rounded-full border border-line" onClick={() => add(menu, -1)} aria-label="Kurangi">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-6 text-center tabular-nums">{cart[menu.id] ?? 0}</span>
                  <button type="button" className="grid size-11 place-items-center rounded-full bg-chili text-paper" onClick={() => add(menu, 1)} aria-label="Tambah" disabled={!canteen.isOpen}>
                    <Plus className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {data.reviews.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Ulasan</h2>
          {data.reviews.map((review, index) => (
            <article key={index} className="rounded-2xl border border-line bg-paper p-3">
              <Stars value={review.stars} />
              {review.comment ? <p className="mt-2 text-sm">{review.comment}</p> : null}
            </article>
          ))}
        </section>
      ) : null}

      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-20 mx-auto w-full max-w-3xl px-4">
          <button type="button" onClick={() => setSheet("cart")} className="flex h-14 w-full items-center justify-between rounded-2xl bg-ink px-4 text-paper">
            <span>{count} item</span>
            <span className="font-semibold tabular-nums">{rupiah(total)}</span>
          </button>
        </div>
      ) : null}

      {sheet ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={() => setSheet(null)}>
          <div className="max-h-screen w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-paper p-4 pb-8" onClick={(event) => event.stopPropagation()}>
            {sheet === "surprise" ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Menu surprise</h2>
                <p className="text-sm text-muted">Dapur mengundi satu menu yang masih ada, lalu memotong 30%. Namanya baru kebuka di struk.</p>
                <PayPicker pay={pay} onChange={setPay} totalLabel="Harga mengikuti menu yang keluar" />
                {pay === "ewallet" ? <QrBox payload={`kantinkita://surprise/${canteenId}`} /> : null}
                <Btn full disabled={busy || !canteen.isOpen} onClick={() => void submit(true)}>
                  {busy ? "Memesan…" : "Undi dan pesan"}
                </Btn>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Pesananmu</h2>
                {lines.map((line) => (
                  <div key={line.menu.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {line.qty}× {line.menu.name}
                    </span>
                    <span className="tabular-nums">{rupiah((line.menu.salePrice ?? line.menu.price) * line.qty)}</span>
                  </div>
                ))}
                <label className="block text-sm">
                  Catatan
                  <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base" placeholder="Tanpa es, pedas sedang…" />
                </label>
                <PayPicker pay={pay} onChange={setPay} totalLabel={rupiah(total)} />
                {pay === "ewallet" ? <QrBox payload={`kantinkita://bayar/${canteenId}/${total}`} /> : (
                  <p className="text-sm text-muted">Booking tunai. Bayar pas ambil di loket.</p>
                )}
                <Btn full disabled={busy} onClick={() => void submit(false)}>
                  {busy ? "Mengirim…" : pay === "ewallet" ? "Sudah bayar, kunci pesanan" : "Booking sekarang"}
                </Btn>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PayPicker({
  pay,
  onChange,
  totalLabel,
}: {
  pay: PayMethod;
  onChange: (pay: PayMethod) => void;
  totalLabel: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => onChange("cash")} className={`h-16 rounded-2xl border px-3 text-left text-sm ${pay === "cash" ? "border-chili bg-foam" : "border-line"}`}>
        <span className="block font-semibold">Booking tunai</span>
        <span className="text-muted">{totalLabel}</span>
      </button>
      <button type="button" onClick={() => onChange("ewallet")} className={`h-16 rounded-2xl border px-3 text-left text-sm ${pay === "ewallet" ? "border-chili bg-foam" : "border-line"}`}>
        <span className="block font-semibold">E-wallet</span>
        <span className="text-muted">Scan QR</span>
      </button>
    </div>
  );
}

function QrBox({ payload }: { payload: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(payload, { type: "svg", margin: 1, color: { dark: "#1f1a17", light: "#fffdf8" } })
      .then((next) => {
        if (live) setSvg(next);
      })
      .catch(() => {
        if (live) setSvg("");
      });
    return () => {
      live = false;
    };
  }, [payload]);
  return (
    <div className="rounded-2xl border border-line p-3 text-center">
      <p className="mb-2 text-sm text-muted">Scan di e-wallet sekolah, lalu konfirmasi di bawah.</p>
      {svg ? <div className="mx-auto w-44" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="text-sm">{payload}</p>}
    </div>
  );
}
