import { createFileRoute } from "@tanstack/react-router";
import { ReceiptView } from "@/components/kantin/receipt-view";
import { Guard } from "@/components/kantin/shell";

export const Route = createFileRoute("/struk/$orderId")({
  component: Page,
});

function Page() {
  const { orderId } = Route.useParams();
  const id = Number(orderId);
  if (!Number.isInteger(id)) return <p className="p-6 text-sm">Struk tidak ditemukan.</p>;
  return <Guard>{() => <ReceiptView orderId={id} />}</Guard>;
}
