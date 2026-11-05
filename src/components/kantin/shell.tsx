import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { ChefHat, CircleUser, ClipboardList, House, PhoneCall, School } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile } from "@/lib/kantin/api";
import { myOrders } from "@/lib/kantin/api";
import {
  detectReady,
  onRing,
  pushNotice,
  readyCount,
  ringVibrate,
  setReadyBadge,
  stopVibrate,
} from "@/lib/kantin/notify";
import type { Profile, RingDetail, Role } from "@/lib/kantin/types";
import { PageSkeleton } from "./bits";

function homeFor(role: Role): "/" | "/jualan" | "/admin" {
  if (role === "seller") return "/jualan";
  if (role === "admin") return "/admin";
  return "/";
}

export function Guard({
  allow,
  children,
}: {
  allow?: Role[];
  children: (profile: Profile) => ReactNode;
}) {
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
  if (!profile) return <Navigate to="/mulai" />;
  if (allow && !allow.includes(profile.role)) return <Navigate to={homeFor(profile.role)} />;
  return <AuthedShell role={profile.role}>{children(profile)}</AuthedShell>;
}

function RingOverlay({ detail, onClose }: { detail: RingDetail; onClose: () => void }) {
  useEffect(() => {
    ringVibrate(detail.kind);
    pushNotice(detail.title, `${detail.canteen} · ${detail.code}`);
    const id = window.setInterval(() => ringVibrate(detail.kind), 4800);
    return () => {
      window.clearInterval(id);
      stopVibrate();
    };
  }, [detail]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink px-6 text-paper" role="alertdialog">
      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <span className="ring-pulse absolute size-36 rounded-full border border-chili" />
        <span className="ring-pulse ring-pulse-2 absolute size-36 rounded-full border border-chili" />
        <span className="ring-pulse ring-pulse-3 absolute size-36 rounded-full border border-chili" />
        <span className="relative grid size-24 place-items-center rounded-full bg-chili text-paper">
          <PhoneCall className="size-10" />
        </span>
        <p className="relative mt-10 text-sm uppercase tracking-widest text-foam">{detail.kind === "reminder" ? "Pengingat" : "Dering kantin"}</p>
        <h2 className="relative mt-2 text-3xl font-semibold text-paper">{detail.title}</h2>
        <p className="relative mt-3 text-lg">{detail.canteen}</p>
        <p className="relative mt-1 font-semibold tabular-nums">{detail.code}</p>
        <p className="relative mt-3 text-sm text-foam">{detail.subtitle}</p>
        <button
          type="button"
          onClick={onClose}
          className="relative mt-8 h-12 w-full rounded-2xl bg-paper text-sm font-semibold text-ink"
        >
          Saya berangkat
        </button>
      </div>
    </div>
  );
}

function Watcher({
  enabled,
  onCount,
  onRingDetail,
}: {
  enabled: boolean;
  onCount: (count: number) => void;
  onRingDetail: (detail: RingDetail) => void;
}) {
  useEffect(() => onRing(onRingDetail), [onRingDetail]);
  useEffect(() => {
    if (!enabled) {
      onCount(0);
      setReadyBadge(0);
      return;
    }
    let live = true;
    const tick = async () => {
      try {
        const orders = await myOrders();
        if (!live) return;
        const count = readyCount(orders);
        onCount(count);
        setReadyBadge(count);
        const event = detectReady(orders);
        if (event) onRingDetail(event);
      } catch {
        /* signed out or profile missing */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [enabled, onCount, onRingDetail]);
  return null;
}

function BottomNav({ role, readyCount: count }: { role: Role; readyCount: number }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const items =
    role === "seller"
      ? [
          { to: "/jualan" as const, label: "Dapur", icon: ChefHat },
          { to: "/akun" as const, label: "Akun", icon: CircleUser },
        ]
      : role === "admin"
        ? [
            { to: "/admin" as const, label: "Sekolah", icon: School },
            { to: "/akun" as const, label: "Akun", icon: CircleUser },
          ]
        : [
            { to: "/" as const, label: "Beranda", icon: House },
            { to: "/pesanan" as const, label: "Pesanan", icon: ClipboardList, badge: count },
            { to: "/akun" as const, label: "Akun", icon: CircleUser },
          ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper">
      <div className="mx-auto flex max-w-3xl">
        {items.map((item) => {
          const active = path === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs ${active ? "font-semibold text-chili" : "text-muted"}`}
            >
              <Icon className="size-5" />
              {item.label}
              {"badge" in item && item.badge ? (
                <span className="absolute right-1/4 top-2 grid min-w-5 place-items-center rounded-full bg-chili px-1 text-xs font-semibold text-paper">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AuthedShell({ role, children }: { role: Role; children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [detail, setDetail] = useState<RingDetail | null>(null);
  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5">{children}</div>
      <BottomNav role={role} readyCount={count} />
      <Watcher enabled={role === "student"} onCount={setCount} onRingDetail={setDetail} />
      {detail ? <RingOverlay detail={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
