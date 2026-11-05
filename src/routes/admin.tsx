import { createFileRoute } from "@tanstack/react-router";
import { AdminView } from "@/components/kantin/admin-view";
import { Guard } from "@/components/kantin/shell";

export const Route = createFileRoute("/admin")({
  component: () => (
    <Guard allow={["admin"]}>
      {() => <AdminView />}
    </Guard>
  ),
});
