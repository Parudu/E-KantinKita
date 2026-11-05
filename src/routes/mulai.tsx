import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageSkeleton } from "@/components/kantin/bits";
import { Onboarding } from "@/components/kantin/gate-pages";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile } from "@/lib/kantin/api";
import type { Profile } from "@/lib/kantin/types";

export const Route = createFileRoute("/mulai")({
  validateSearch: (search: Record<string, unknown>) => ({
    ganti: search.ganti === "1" || search.ganti === 1 || search.ganti === true || search.ganti === "true",
  }),
  component: MulaiPage,
});

function MulaiPage() {
  const { ganti } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let live = true;
    getMyProfile()
      .then((next) => {
        if (live) setProfile(next);
      })
      .catch(() => {
        if (live) setProfile(null);
      });
    return () => {
      live = false;
    };
  }, [user?.id]);

  if (isPending || (user && profile === undefined)) return <PageSkeleton />;
  if (!user) return <RedirectToSignIn />;
  if (profile && !ganti) return <Navigate to="/" />;
  return <Onboarding defaultName={user.displayName ?? ""} current={profile} />;
}
