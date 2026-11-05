import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/kantin/gate-pages";
import { StudentHome } from "@/components/kantin/home-view";
import { Guard } from "@/components/kantin/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PageSkeleton } from "@/components/kantin/bits";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <PageSkeleton />;
  if (!user) return <Landing />;
  return <Guard allow={["student"]}>{(profile) => <StudentHome profile={profile} />}</Guard>;
}
