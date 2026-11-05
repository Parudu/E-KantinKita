import { createFileRoute } from "@tanstack/react-router";
import { OrdersView } from "@/components/kantin/orders-view";
import { Guard } from "@/components/kantin/shell";

export const Route = createFileRoute("/pesanan")({
  component: () => (
    <Guard allow={["student"]}>
      {() => <OrdersView />}
    </Guard>
  ),
});
