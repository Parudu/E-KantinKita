import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/kantin/bits";
import { LoginForm } from "@/components/kantin/gate-pages";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <PageSkeleton />;
  if (user) return <Navigate to="/" />;
  return <LoginForm />;
}
