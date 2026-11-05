import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminDash, adminDecide, deleteAnnouncement, postAnnouncement } from "@/lib/kantin/api";
import { BOOTH_LABEL, errText, rupiah } from "@/lib/kantin/format";
import { prettyTime } from "@/lib/kantin/hours";
import type { AdminDash } from "@/lib/kantin/types";
import { Btn, Field } from "./bits";

export function AdminView() {
  const [dash, setDash] = useState<AdminDash | null>(null);
  const [tab, setTab] = useState<"review" | "watch" | "news">("review");
  const [reason, setReason] = useState<Record<number, string>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function reload() {
    setDash(await adminDash());
  }

  useEffect(() => {
    void reload().catch((error: unknown) => toast.error(errText(error)));
    const id = window.setInterval(() => {
      void reload().catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(id);
  }, []);

  if (!dash) return <p className="text-sm text-muted">Membuka panel sekolah…</p>;
  const queue = dash.canteens.filter((canteen) => !canteen.ownerCatalog && canteen.status !== "approved");
  const live = dash.canteens.filter((canteen) => canteen.status === "approved");

  async function decide(id: number, decision: "approved" | "rejected" | "revision") {
    try {
      await adminDecide({ data: { id, decision, reason: reason[id] ?? "" } });
      toast.success(decision === "approved" ? "Kantin disetujui" : "Keputusan tersimpan");
      await reload();
    } catch (error) {
      toast.error(errText(error));
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-semibold">Panel sekolah</h1>
      <div className="flex gap-2">
        {(
          [
            ["review", "Pendaftaran"],
            ["watch", "Pantau"],
            ["news", "Pengumuman"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`h-10 rounded-full px-3 text-sm ${tab === id ? "bg-ink text-paper" : "border border-line bg-paper"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "review" ? (
        <div className="space-y-3">
          {queue.length === 0 ? <p className="text-sm text-muted">Tidak ada pendaftaran yang menunggu.</p> : null}
          {queue.map((canteen) => (
            <article key={canteen.id} className="space-y-3 rounded-3xl border border-line bg-paper p-4">
              <div>
                <p className="text-xs text-muted">{BOOTH_LABEL[canteen.status]}</p>
                <h2 className="font-sans text-lg font-semibold">{canteen.name}</h2>
                <p className="text-sm text-muted">{canteen.location}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Doc label="BPOM" src={canteen.docBpom} />
                <Doc label="KTP" src={canteen.docKtp} />
                <Doc label="Booth" src={canteen.docBooth} />
              </div>
              <textarea
                value={reason[canteen.id] ?? ""}
                onChange={(event) => setReason((current) => ({ ...current, [canteen.id]: event.target.value }))}
                placeholder="Alasan, wajib kalau ditolak atau minta revisi"
                className="h-24 w-full rounded-2xl border border-line p-3 text-base"
              />
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => void decide(canteen.id, "approved")}>Setujui</Btn>
                <Btn tone="ghost" onClick={() => void decide(canteen.id, "revision")}>
                  Perlu revisi
                </Btn>
                <Btn tone="ink" onClick={() => void decide(canteen.id, "rejected")}>
                  Tolak
                </Btn>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "watch" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {live.map((canteen) => (
            <article key={canteen.id} data-theme={canteen.theme} className="rounded-3xl border border-line bg-paper p-4">
              <span className="theme-bar mb-3 block h-1.5 w-12 rounded-full" />
              <h2 className="font-sans text-lg font-semibold">{canteen.name}</h2>
              <p className="text-sm text-muted">{canteen.location}</p>
              <p className="mt-1 text-sm">{canteen.isOpen ? "Buka" : canteen.nextOpenLabel}</p>
              <p className="text-sm text-muted">
                {prettyTime(canteen.openTime)}–{prettyTime(canteen.closeTime)}
              </p>
              <p className="mt-3 text-sm tabular-nums">
                {canteen.todayOrders} pesanan · {rupiah(canteen.todayRevenue)}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "news" ? (
        <div className="space-y-3">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void postAnnouncement({ data: { title, body } })
                .then(() => {
                  setTitle("");
                  setBody("");
                  return reload();
                })
                .catch((error: unknown) => toast.error(errText(error)));
            }}
          >
            <Field label="Judul" value={title} onChange={setTitle} />
            <label className="block text-sm font-medium">
              Isi
              <textarea value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 h-28 w-full rounded-2xl border border-line p-3 text-base" />
            </label>
            <Btn type="submit">Tayangkan ke semua</Btn>
          </form>
          {dash.announcements.map((item) => (
            <article key={item.id} className="rounded-2xl border border-line bg-paper p-3">
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-muted">{item.body}</p>
              <button type="button" className="mt-2 text-sm text-chili" onClick={() => void deleteAnnouncement({ data: { id: item.id } }).then(reload)}>
                Hapus
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Doc({ label, src }: { label: string; src: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      {src ? <img src={src} alt={label} className="h-20 w-full rounded-xl object-cover" /> : <div className="grid h-20 place-items-center rounded-xl bg-cream text-xs text-muted">Kosong</div>}
    </div>
  );
}
