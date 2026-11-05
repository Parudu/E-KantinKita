import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getOrder } from "@/lib/kantin/api";
import { ORDER_LABEL, errText, orderCode, payLabel, rupiah, stamp } from "@/lib/kantin/format";
import type { StudentOrder } from "@/lib/kantin/types";

const STEPS = ["incoming", "cooking", "ready", "picked_up"] as const;

export function ReceiptView({ orderId }: { orderId: number }) {
  const [order, setOrder] = useState<StudentOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const load = () => {
      getOrder({ data: { id: orderId } })
        .then((next) => {
          if (live) setOrder(next);
        })
        .catch((err: unknown) => {
          if (live) setError(errText(err));
        });
    };
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [orderId]);

  if (error) return <p className="text-sm text-chili">{error}</p>;
  if (!order) return <p className="text-sm text-muted">Mencetak struk…</p>;
  const step = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link to="/pesanan" className="text-sm text-muted">
        Ke pesanan
      </Link>
      <article className="rounded-3xl border border-line bg-paper p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Struk KantinKita</p>
            <h1 className="mt-1 text-3xl font-semibold">{order.canteenName}</h1>
          </div>
          <span className="rounded-md border-2 border-chili px-2 py-1 text-xs font-bold uppercase tracking-widest text-chili">
            {order.payMethod === "cash" ? "Booking" : "Lunas"}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">{orderCode(order.id)} · {stamp(order.createdAt)}</p>
        {order.isSurprise ? <p className="mt-3 rounded-2xl bg-foam px-3 py-2 text-sm text-chili">Menu surprise kamu: lihat di bawah.</p> : null}
        <ul className="mt-4 space-y-2 border-t border-dashed border-line pt-4 text-sm">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span>
                {item.qty}× {item.name}
              </span>
              <span className="tabular-nums">{rupiah(item.unitPrice * item.qty)}</span>
            </li>
          ))}
        </ul>
        {order.note ? <p className="mt-3 text-sm text-muted">Catatan: {order.note}</p> : null}
        <div className="mt-4 flex items-center justify-between border-t border-dashed border-line pt-4">
          <span className="text-sm">{payLabel(order.payMethod)}</span>
          <span className="text-xl font-semibold tabular-nums">{rupiah(order.total)}</span>
        </div>
        <p className="mt-3 text-sm">Status: {ORDER_LABEL[order.status]}</p>
        {order.status !== "cancelled" ? (
          <ol className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            {STEPS.map((status, index) => (
              <li key={status} className={index <= step ? "font-semibold text-chili" : "text-muted"}>
                {ORDER_LABEL[status]}
              </li>
            ))}
          </ol>
        ) : null}
        <p className="mt-4 text-center text-xs text-muted">Screenshot struk ini sebagai bukti ambil.</p>
      </article>
    </div>
  );
}
