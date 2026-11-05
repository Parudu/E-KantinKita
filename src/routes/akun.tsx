import { createFileRoute } from "@tanstack/react-router";
import { AccountView } from "@/components/kantin/account-view";
import { Guard } from "@/components/kantin/shell";

export const Route = createFileRoute("/akun")({
  component: () => <Guard>{(profile) => <AccountView profile={profile} />}</Guard>,
});
