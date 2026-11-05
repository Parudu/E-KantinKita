import { useEffect, useState } from "react";
import { BadgeCheck, BarChart3 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  createFlash,
  deleteMenu,
  patchBooth,
  placeTestOrder,
  saveDoc,
  saveMenu,
  sellerDash,
  sellerPulse,
  setOrderStatus,
  stopFlash,
  submitBooth,
  toggleMenu,
} from "@/lib/kantin/api";
import { BOOTH_LABEL, ORDER_LABEL, errText, orderCode, rupiah } from "@/lib/kantin/format";
import { prettyTime } from "@/lib/kantin/hours";
import { previewRing } from "@/lib/kantin/notify";
import type { Booth, MenuItem, SellerDash, ThemeId } from "@/lib/kantin/types";
import { CATEGORIES, TAGS, THEMES } from "@/lib/kantin/types";
import { Btn, Field, PhotoField } from "./bits";

type Tab = "queue" | "menu" | "flash" | "hours" | "stats" | "docs";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category: "Nasi",
  tags: [] as string[],
  photo: "",
  surprise: false,
  id: null as number | null,
};

export function SellerView() {
  const [dash, setDash] = useState<SellerDash | null>(null);
  const [tab, setTab] = useState<Tab>("queue");
  const [form, setForm] = useState(emptyForm);
  const [boothForm, setBoothForm] = useState({
    name: "",
    blurb: "",
    location: "",
    theme: "chili" as ThemeId,
    openTime: "07:00",
    closeTime: "14:00",
    forceClosed: false,
  });
  const [docs, setDocs] = useState({ bpom: "", ktp: "", booth: "" });
  const [flash, setFlash] = useState({ menuId: "", mode: "percent" as "percent" | "special", discountPct: "30", specialPrice: "", stock: "10", minutes: 15 });
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const next = await sellerDash();
    setDash(next);
    if (next.canteen) {
      setBoothForm({
        name: next.canteen.name,
        blurb: next.canteen.blurb,
        location: next.canteen.location,
        theme: next.canteen.theme,
        openTime: next.canteen.openTime,
        closeTime: next.canteen.closeTime,
        forceClosed: next.canteen.forceClosed,
      });
      setDocs({
        bpom: next.canteen.docBpom ?? "",
        ktp: next.canteen.docKtp ?? "",
        booth: next.canteen.docBooth ?? "",
      });
    }
  }

  useEffect(() => {
    setMounted(true);
    void reload().catch((error: unknown) => toast.error(errText(error)));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void sellerPulse()
        .then((pulse) => {
          if (!pulse) return;
          setDash((current) =>
            current
              ? {
                  ...current,
                  queue: pulse.queue,
                  doneToday: pulse.doneToday,
                  flashes: pulse.flashes,
                  stats: { ...current.stats, todayOrders: pulse.todayOrders, todayRevenue: pulse.todayRevenue },
                }
              : current,
          );
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  if (!dash) return <p className="text-sm text-muted">Membuka dapur…</p>;
  if (!dash.canteen || dash.canteen.status === "draft") {
    return (
      <Register
        boothForm={boothForm}
        setBoothForm={setBoothForm}
        docs={docs}
        setDocs={setDocs}
        busy={busy}
        onSubmit={async (submit) => {
          setBusy(true);
          try {
            await patchBooth({ data: boothForm });
            if (docs.bpom.startsWith("data:")) await saveDoc({ data: { kind: "bpom", photo: docs.bpom } });
            if (docs.ktp.startsWith("data:")) await saveDoc({ data: { kind: "ktp", photo: docs.ktp } });
            if (docs.booth.startsWith("data:")) await saveDoc({ data: { kind: "booth", photo: docs.booth } });
            if (submit) await submitBooth();
            toast.success(submit ? "Pendaftaran terkirim" : "Draf tersimpan");
            await reload();
          } catch (error) {
            toast.error(errText(error));
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  const canteen = dash.canteen;
  async function mark(id: number, status: "cooking" | "ready" | "picked_up" | "cancelled", orderCodeText: string, subtitle: string) {
    try {
      await setOrderStatus({ data: { id, status } });
      if (status === "ready") {
        previewRing({
          kind: "preview",
          title: "Pesanan siap diambil",
          canteen: canteen.name,
          code: orderCodeText,
          subtitle,
        });
      }
      await reload();
    } catch (error) {
      toast.error(errText(error));
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold">{canteen.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {canteen.isOpen ? "Sedang buka" : canteen.nextOpenLabel} · {prettyTime(canteen.openTime)}–{prettyTime(canteen.closeTime)}
          </p>
        </div>
        {canteen.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-foam px-2 py-1 text-xs font-semibold text-chili">
            <BadgeCheck className="size-4" /> Terverifikasi
          </span>
        ) : (
          <span className="rounded-full bg-cream px-2 py-1 text-xs">{BOOTH_LABEL[canteen.status]}</span>
        )}
      </header>
      {canteen.rejectionReason ? <p className="rounded-2xl bg-foam p-3 text-sm text-chili">{canteen.rejectionReason}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-line bg-paper p-4">
          <p className="text-sm text-muted">Pesanan hari ini</p>
          <p className="text-3xl font-semibold tabular-nums">{dash.stats.todayOrders}</p>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-4">
          <p className="text-sm text-muted">Pemasukan hari ini</p>
          <p className="text-2xl font-semibold tabular-nums">{rupiah(dash.stats.todayRevenue)}</p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {(
          [
            ["queue", "Antrian"],
            ["menu", "Menu"],
            ["flash", "Flash sale"],
            ["hours", "Jam & tema"],
            ["stats", "Rekap"],
            ["docs", "Dokumen"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`h-10 shrink-0 rounded-full px-3 text-sm ${tab === id ? "bg-ink text-paper" : "border border-line bg-paper"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "queue" ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Btn
              tone="ghost"
              onClick={() => {
                void placeTestOrder()
                  .then(() => reload())
                  .catch((error: unknown) => toast.error(errText(error)));
              }}
            >
              Pesanan uji
            </Btn>
            <Btn
              tone="foam"
              onClick={() =>
                previewRing({
                  kind: "preview",
                  title: "Pesanan siap diambil",
                  canteen: canteen.name,
                  code: "#0000",
                  subtitle: "Begini dering yang siswa terima",
                })
              }
            >
              Coba dering
            </Btn>
          </div>
          {dash.queue.length === 0 ? <p className="text-sm text-muted">Antrian kosong. Urutan mengikuti yang paling dulu pesan.</p> : null}
          {dash.queue.map((order) => (
            <article key={order.id} className="rounded-3xl border border-line bg-paper p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted">{orderCode(order.id)} · {ORDER_LABEL[order.status]}</p>
                  <h2 className="font-sans text-lg font-semibold">{order.studentName}</h2>
                  {order.nis ? <p className="text-sm text-muted">NIS {order.nis}</p> : null}
                </div>
                <span className="tabular-nums">{rupiah(order.total)}</span>
              </div>
              <ul className="mt-2 text-sm">
                {order.items.map((item, index) => (
                  <li key={index}>
                    {item.qty}× {item.name}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {order.status === "incoming" ? (
                  <Btn onClick={() => void mark(order.id, "cooking", orderCode(order.id), order.items.map((item) => item.name).join(", "))}>Sedang dimasak</Btn>
                ) : null}
                {order.status === "incoming" || order.status === "cooking" ? (
                  <Btn
                    onClick={() =>
                      void mark(
                        order.id,
                        "ready",
                        orderCode(order.id),
                        order.items.map((item) => `${item.qty}× ${item.name}`).join(", "),
                      )
                    }
                  >
                    Pesanan siap
                  </Btn>
                ) : null}
                {order.status === "ready" ? (
                  <Btn tone="ink" onClick={() => void mark(order.id, "picked_up", orderCode(order.id), "")}>
                    Sudah diambil
                  </Btn>
                ) : null}
                {order.status !== "ready" ? (
                  <button type="button" className="h-12 px-3 text-sm text-muted" onClick={() => void mark(order.id, "cancelled", orderCode(order.id), "")}>
                    Batalkan
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "menu" ? (
        <div className="space-y-4">
          <form
            className="space-y-3 rounded-3xl border border-line bg-paper p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveMenu({
                data: {
                  id: form.id,
                  name: form.name,
                  description: form.description,
                  price: Number(form.price),
                  category: form.category,
                  tags: form.tags,
                  photo: form.photo,
                  available: true,
                  surprise: form.surprise,
                },
              })
                .then(() => {
                  setForm(emptyForm);
                  return reload();
                })
                .catch((error: unknown) => toast.error(errText(error)));
            }}
          >
            <h2 className="font-sans text-lg font-semibold">{form.id ? "Ubah menu" : "Menu baru"}</h2>
            <Field label="Nama" value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <Field label="Deskripsi" value={form.description} onChange={(description) => setForm({ ...form, description })} />
            <Field label="Harga (rupiah)" value={form.price} onChange={(price) => setForm({ ...form, price })} type="number" />
            <label className="block text-sm font-medium">
              Kategori
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 h-12 w-full rounded-2xl border border-line bg-paper px-3 text-base">
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => {
                const on = form.tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        tags: on ? form.tags.filter((id) => id !== tag.id) : [...form.tags, tag.id],
                      })
                    }
                    className={`h-10 rounded-full px-3 text-sm ${on ? "bg-foam text-chili" : "border border-line"}`}
                  >
                    {tag.label}
                  </button>
                );
              })}
              <button type="button" onClick={() => setForm({ ...form, surprise: !form.surprise })} className={`h-10 rounded-full px-3 text-sm ${form.surprise ? "bg-foam text-chili" : "border border-line"}`}>
                Masuk surprise
              </button>
            </div>
            <PhotoField label="Foto menu" value={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
            <Btn type="submit">Simpan menu</Btn>
          </form>
          {dash.menus.map((menu) => (
            <MenuRow
              key={menu.id}
              menu={menu}
              onEdit={() =>
                setForm({
                  id: menu.id,
                  name: menu.name,
                  description: menu.description,
                  price: String(menu.price),
                  category: menu.category,
                  tags: menu.tags,
                  photo: menu.photo,
                  surprise: menu.surprise,
                })
              }
              onToggle={(available) => {
                void toggleMenu({ data: { id: menu.id, available } })
                  .then(reload)
                  .catch((error: unknown) => toast.error(errText(error)));
              }}
              onDelete={() => {
                void deleteMenu({ data: { id: menu.id } })
                  .then(reload)
                  .catch((error: unknown) => toast.error(errText(error)));
              }}
            />
          ))}
        </div>
      ) : null}

      {tab === "flash" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createFlash({
              data: {
                menuId: Number(flash.menuId),
                mode: flash.mode,
                discountPct: Number(flash.discountPct),
                specialPrice: Number(flash.specialPrice),
                stock: Number(flash.stock),
                minutes: flash.minutes,
              },
            })
              .then(() => {
                toast.success("Flash sale tayang. Siswa dapat getar singkat.");
                return reload();
              })
              .catch((error: unknown) => toast.error(errText(error)));
          }}
        >
          <label className="block text-sm font-medium">
            Menu
            <select value={flash.menuId} onChange={(event) => setFlash({ ...flash, menuId: event.target.value })} className="mt-1 h-12 w-full rounded-2xl border border-line bg-paper px-3 text-base">
              <option value="">Pilih menu</option>
              {dash.menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFlash({ ...flash, mode: "percent" })} className={`h-12 rounded-2xl border ${flash.mode === "percent" ? "border-chili bg-foam" : "border-line"}`}>
              Diskon %
            </button>
            <button type="button" onClick={() => setFlash({ ...flash, mode: "special" })} className={`h-12 rounded-2xl border ${flash.mode === "special" ? "border-chili bg-foam" : "border-line"}`}>
              Harga spesial
            </button>
          </div>
          {flash.mode === "percent" ? (
            <Field label="Diskon persen" value={flash.discountPct} onChange={(discountPct) => setFlash({ ...flash, discountPct })} type="number" />
          ) : (
            <Field label="Harga spesial" value={flash.specialPrice} onChange={(specialPrice) => setFlash({ ...flash, specialPrice })} type="number" />
          )}
          <Field label="Stok terbatas" value={flash.stock} onChange={(stock) => setFlash({ ...flash, stock })} type="number" />
          <div className="flex gap-2">
            {[15, 30, 45, 60].map((minutes) => (
              <button key={minutes} type="button" onClick={() => setFlash({ ...flash, minutes })} className={`h-11 flex-1 rounded-2xl text-sm ${flash.minutes === minutes ? "bg-ink text-paper" : "border border-line bg-paper"}`}>
                {minutes} mnt
              </button>
            ))}
          </div>
          <Btn type="submit">Tayangkan flash sale</Btn>
          {dash.flashes.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-line bg-paper p-3 text-sm">
              <span>
                {item.menuName} · sisa {item.stockLeft}/{item.stockTotal}
              </span>
              <button type="button" className="text-chili" onClick={() => void stopFlash({ data: { id: item.id } }).then(reload)}>
                Hentikan
              </button>
            </div>
          ))}
        </form>
      ) : null}

      {tab === "hours" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void patchBooth({ data: { ...boothForm, theme: boothForm.theme as Booth["theme"] } })
              .then(() => {
                toast.success("Jam operasional diperbarui");
                return reload();
              })
              .catch((error: unknown) => toast.error(errText(error)));
          }}
        >
          <Field label="Nama kantin" value={boothForm.name} onChange={(name) => setBoothForm({ ...boothForm, name })} />
          <Field label="Lokasi" value={boothForm.location} onChange={(location) => setBoothForm({ ...boothForm, location })} />
          <Field label="Cerita singkat" value={boothForm.blurb} onChange={(blurb) => setBoothForm({ ...boothForm, blurb })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Buka" type="time" value={boothForm.openTime} onChange={(openTime) => setBoothForm({ ...boothForm, openTime })} />
            <Field label="Tutup" type="time" value={boothForm.closeTime} onChange={(closeTime) => setBoothForm({ ...boothForm, closeTime })} />
          </div>
          <div className="flex gap-2">
            {THEMES.map((theme) => (
              <button key={theme.id} type="button" data-theme={theme.id} aria-pressed={boothForm.theme === theme.id} className="swatch size-11 rounded-full" onClick={() => setBoothForm({ ...boothForm, theme: theme.id })} aria-label={theme.label} />
            ))}
          </div>
          <button type="button" onClick={() => setBoothForm({ ...boothForm, forceClosed: !boothForm.forceClosed })} className={`h-12 w-full rounded-2xl border text-sm ${boothForm.forceClosed ? "border-chili bg-foam text-chili" : "border-line"}`}>
            {boothForm.forceClosed ? "Tutup darurat menyala" : "Tutup darurat"}
          </button>
          <Btn type="submit">Simpan jam & tema</Btn>
        </form>
      ) : null}

      {tab === "stats" ? (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 font-sans text-lg font-semibold">
            <BarChart3 className="size-5" /> 7 hari terakhir
          </h2>
          <div className="h-48 w-full rounded-3xl border border-line bg-paper p-3">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dash.stats.byDay}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="var(--color-chili)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          <h2 className="font-sans text-lg font-semibold">Jam ramai hari ini</h2>
          {dash.stats.byHour.length === 0 ? <p className="text-sm text-muted">Belum ada penjualan hari ini.</p> : null}
          {dash.stats.byHour.map((row) => (
            <p key={row.hour} className="flex justify-between text-sm">
              <span>{row.hour}</span>
              <span className="tabular-nums">{row.orders} pesanan</span>
            </p>
          ))}
          <h2 className="font-sans text-lg font-semibold">Menu terlaris minggu ini</h2>
          {dash.stats.topMenus.length === 0 ? <p className="text-sm text-muted">Belum ada menu yang laku minggu ini.</p> : null}
          {dash.stats.topMenus.map((row) => (
            <p key={row.name} className="flex justify-between text-sm">
              <span>{row.name}</span>
              <span className="tabular-nums">{row.qty}</span>
            </p>
          ))}
        </div>
      ) : null}

      {tab === "docs" ? (
        <DocsPanel
          canteen={canteen}
          docs={docs}
          setDocs={setDocs}
          onSave={async () => {
            try {
              if (docs.bpom.startsWith("data:")) await saveDoc({ data: { kind: "bpom", photo: docs.bpom } });
              if (docs.ktp.startsWith("data:")) await saveDoc({ data: { kind: "ktp", photo: docs.ktp } });
              if (docs.booth.startsWith("data:")) await saveDoc({ data: { kind: "booth", photo: docs.booth } });
              if (canteen.status === "revision" || canteen.status === "rejected") await submitBooth();
              toast.success("Dokumen diperbarui");
              await reload();
            } catch (error) {
              toast.error(errText(error));
            }
          }}
        />
      ) : null}
    </div>
  );
}

function MenuRow({
  menu,
  onEdit,
  onToggle,
  onDelete,
}: {
  menu: MenuItem;
  onEdit: () => void;
  onToggle: (available: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex gap-3 rounded-3xl border border-line bg-paper p-3">
      <img src={menu.photo} alt="" className="size-16 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{menu.name}</p>
        <p className="text-sm tabular-nums text-muted">{rupiah(menu.price)}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => onToggle(!menu.available)} className="text-chili">
            {menu.available ? "Tandai habis" : "Tandai ada"}
          </button>
          <button type="button" onClick={onEdit}>
            Ubah
          </button>
          <button type="button" onClick={onDelete} className="text-muted">
            Hapus
          </button>
        </div>
      </div>
    </article>
  );
}

function Register({
  boothForm,
  setBoothForm,
  docs,
  setDocs,
  busy,
  onSubmit,
}: {
  boothForm: { name: string; blurb: string; location: string; theme: ThemeId; openTime: string; closeTime: string; forceClosed: boolean };
  setBoothForm: (value: { name: string; blurb: string; location: string; theme: ThemeId; openTime: string; closeTime: string; forceClosed: boolean }) => void;
  docs: { bpom: string; ktp: string; booth: string };
  setDocs: (value: { bpom: string; ktp: string; booth: string }) => void;
  busy: boolean;
  onSubmit: (submit: boolean) => Promise<void>;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(true);
      }}
    >
      <h1 className="text-4xl font-semibold">Daftarkan kantin</h1>
      <p className="text-sm text-muted">Unggah BPOM, KTP, dan foto booth. Admin sekolah yang menyetujui sebelum siswa bisa memesan.</p>
      <Field label="Nama kantin" value={boothForm.name} onChange={(name) => setBoothForm({ ...boothForm, name })} />
      <Field label="Lokasi" value={boothForm.location} onChange={(location) => setBoothForm({ ...boothForm, location })} />
      <Field label="Cerita singkat" value={boothForm.blurb} onChange={(blurb) => setBoothForm({ ...boothForm, blurb })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Buka" type="time" value={boothForm.openTime} onChange={(openTime) => setBoothForm({ ...boothForm, openTime })} />
        <Field label="Tutup" type="time" value={boothForm.closeTime} onChange={(closeTime) => setBoothForm({ ...boothForm, closeTime })} />
      </div>
      <div className="flex gap-2">
        {THEMES.map((theme) => (
          <button key={theme.id} type="button" data-theme={theme.id} aria-pressed={boothForm.theme === theme.id} className="swatch size-11 rounded-full" onClick={() => setBoothForm({ ...boothForm, theme: theme.id })} aria-label={theme.label} />
        ))}
      </div>
      <PhotoField label="Dokumen BPOM" value={docs.bpom} onChange={(bpom) => setDocs({ ...docs, bpom })} />
      <PhotoField label="KTP penanggung jawab" value={docs.ktp} onChange={(ktp) => setDocs({ ...docs, ktp })} />
      <PhotoField label="Foto booth" value={docs.booth} onChange={(booth) => setDocs({ ...docs, booth })} />
      <Btn type="submit" full disabled={busy}>
        {busy ? "Mengirim…" : "Kirim pendaftaran"}
      </Btn>
      <button type="button" className="h-12 w-full text-sm text-muted" disabled={busy} onClick={() => void onSubmit(false)}>
        Simpan draf
      </button>
    </form>
  );
}

function DocsPanel({
  canteen,
  docs,
  setDocs,
  onSave,
}: {
  canteen: Booth;
  docs: { bpom: string; ktp: string; booth: string };
  setDocs: (value: { bpom: string; ktp: string; booth: string }) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Status: {BOOTH_LABEL[canteen.status]}</p>
      <PhotoField label="BPOM" value={docs.bpom.startsWith("ada") ? "" : docs.bpom} onChange={(bpom) => setDocs({ ...docs, bpom })} />
      <PhotoField label="KTP" value={docs.ktp.startsWith("ada") ? "" : docs.ktp} onChange={(ktp) => setDocs({ ...docs, ktp })} />
      <PhotoField label="Foto booth" value={docs.booth.startsWith("ada") ? "" : docs.booth} onChange={(booth) => setDocs({ ...docs, booth })} />
      <Btn onClick={() => void onSave()}>{canteen.status === "revision" || canteen.status === "rejected" ? "Kirim ulang" : "Simpan dokumen"}</Btn>
    </div>
  );
}
