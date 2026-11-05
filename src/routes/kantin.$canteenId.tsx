import { createFileRoute } from "@tanstack/react-router";
import { CanteenView } from "@/components/kantin/canteen-view";
import { Guard } from "@/components/kantin/shell";

export const Route = createFileRoute("/kantin/$canteenId")({
  component: Page,
});

function Page() {
  const { canteenId } = Route.useParams();
  const id = Number(canteenId);
  if (!Number.isInteger(id)) return <p className="p-6 text-sm">Kantin tidak ditemukan.</p>;
  return <Guard>{() => <CanteenView canteenId={id} />}</Guard>;
}
