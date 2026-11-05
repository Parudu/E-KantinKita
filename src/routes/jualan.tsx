import { createFileRoute } from "@tanstack/react-router";
import { SellerView } from "@/components/kantin/seller-view";
import { Guard } from "@/components/kantin/shell";

export const Route = createFileRoute("/jualan")({
  component: () => (
    <Guard allow={["seller"]}>
      {() => <SellerView />}
    </Guard>
  ),
});
