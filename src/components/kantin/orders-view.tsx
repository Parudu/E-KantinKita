import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { addReview, myOrders, studentAction } from "@/lib/kantin/api";
import { ORDER_LABEL, errText, orderCode, payLabel, rupiah, stamp } from "@/lib/kantin/format";
import type { StudentOrder } from "@/lib/kantin/types";
import { Btn } from "./bits";

export function OrdersView() {
  const [orders, setOrders] = useState<StudentOrder[] | null>(null);
  const [stars, setStars] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});

  useEffect(() => {
    let live = true;
    const load = () => {
      myOrders()
        .then((next) => {
          if (live) setOrders(next);
        })
        .catch((error: unknown) => {
          if (live) toast.error(errText(error));
        });
    };
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  if (!orders) return <p className="text-sm text-muted">Membuka pesanan…</p>;

  const active = orders.filter((order) => order.status === "incoming" || order.status === "cooking" || order.status === "ready");
  const history = orders.filter((order) => order.status === "picked_up" || order.status === "cancelled");

  async function act(id: number, action: "cancel" | "pickup") {
    try {
      await studentAction({ data: { id, action } });
      setOrders(await myOrders());
    } catch (error) {
      toast.error(errText(error));
    }
  }

  async function review(id: number) {
    try {
      await addReview({ data: { id, stars: stars[id] ?? 5, comment: comments[id] ?? "" } });
      toast.success("Terima kasih, ulasannya masuk");
      setOrders(await myOrders());
    } catch (error) {
      toast.error(errText(error));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold">Pesanan</h1>
      <p className="text-sm text-muted">Kalau status berubah jadi siap, layar ini bergetar seperti dering telpon. Belum diambil 10 menit, getarnya diulang.</p>
      {active.length === 0 ? <p className="rounded-3xl border border-line bg-paper p-4 text-sm text-muted">Belum ada pesanan yang berjalan.</p> : null}
      <div className="space-y-3">
        {active.map((order) => (
          <article key={order.id} data-theme={order.theme} className="rounded-3xl border border-line bg-paper p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">{order.canteenName}</p>
                <h2 className="font-sans text-lg font-semibold">{orderCode(order.id)}</h2>
              </div>
              <span className="theme-soft rounded-full px-2 py-1 text-xs font-semibold">{ORDER_LABEL[order.status]}</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {order.items.map((item, index) => (
                <li key={index}>
                  {item.qty}× {item.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm tabular-nums">{rupiah(order.total)} · {payLabel(order.payMethod)}</p>
            {order.autoKitchen && order.status !== "ready" ? (
              <p className="mt-2 text-xs text-muted">Dapur contoh sedang memasak. Siap sebentar lagi.</p>
            ) : null}
            {order.status === "ready" ? (
              <p className="mt-2 text-sm text-chili">Silakan diambil. Pengingat getar menyala kalau 10 menit belum diambil.</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Link to="/struk/$orderId" params={{ orderId: String(order.id) }} className="inline-flex h-11 items-center rounded-2xl border border-line px-3 text-sm">
                Struk
              </Link>
              {order.status === "incoming" ? (
                <button type="button" className="h-11 rounded-2xl px-3 text-sm text-muted" onClick={() => void act(order.id, "cancel")}>
                  Batalkan
                </button>
              ) : null}
              {order.status === "ready" ? (
                <Btn onClick={() => void act(order.id, "pickup")}>Sudah saya ambil</Btn>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Riwayat</h2>
          {history.map((order) => (
            <article key={order.id} className="rounded-3xl border border-line bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{order.canteenName}</p>
                  <p className="text-sm text-muted">{stamp(order.createdAt)} · {ORDER_LABEL[order.status]}</p>
                </div>
                <span className="tabular-nums">{rupiah(order.total)}</span>
              </div>
              <Link to="/struk/$orderId" params={{ orderId: String(order.id) }} className="mt-2 inline-block text-sm text-chili">
                Lihat struk
              </Link>
              {order.status === "picked_up" && !order.reviewed ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm">Bagaimana pesananmu?</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStars((current) => ({ ...current, [order.id]: value }))}
                        className={`grid size-11 place-items-center rounded-full border ${(stars[order.id] ?? 5) >= value ? "border-chili bg-foam text-chili" : "border-line"}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <input
                    value={comments[order.id] ?? ""}
                    onChange={(event) => setComments((current) => ({ ...current, [order.id]: event.target.value }))}
                    placeholder="Komentar singkat"
                    className="h-12 w-full rounded-2xl border border-line px-3 text-base"
                  />
                  <Btn onClick={() => void review(order.id)}>Kirim ulasan</Btn>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
