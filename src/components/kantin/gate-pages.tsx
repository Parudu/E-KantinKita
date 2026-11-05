import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Clock, Flame, Smartphone } from "lucide-react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { saveProfile } from "@/lib/kantin/api";
import { errText } from "@/lib/kantin/format";
import type { Profile, Role } from "@/lib/kantin/types";
import { Btn, Field, PageSkeleton, Wordmark } from "./bits";

export function Landing() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-6 pb-16">
        <header className="flex items-center justify-between">
          <Wordmark />
          <Link to="/login" className="inline-flex h-11 items-center rounded-2xl bg-ink px-4 text-sm font-semibold text-paper">
            Masuk
          </Link>
        </header>
        <section className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-chili">Kantin sekolah</p>
            <h1 className="mt-2 text-5xl font-semibold leading-tight">Pesan di kantin. Ambil pas HP-mu bergetar.</h1>
            <p className="mt-4 max-w-md text-muted">
              Lihat kantin yang buka, rebut flash sale, lalu datang ke loket waktu pesanan siap. Booking tunai atau e-wallet.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex h-12 items-center rounded-2xl bg-chili px-4 text-sm font-semibold text-paper">
                Masuk sebagai siswa
              </Link>
              <a href="#cara" className="inline-flex h-12 items-center rounded-2xl border border-line bg-paper px-4 text-sm font-semibold">
                Cara kerjanya
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <img src="/menu/nasi-goreng.jpg" alt="Nasi goreng kampung" className="h-48 w-full rounded-3xl object-cover" />
            <img src="/menu/geprek.jpg" alt="Ayam geprek" className="mt-8 h-48 w-full rounded-3xl object-cover" />
            <img src="/menu/bakso.jpg" alt="Bakso kuah" className="h-40 w-full rounded-3xl object-cover" />
            <img src="/menu/gorengan.jpg" alt="Gorengan campur" className="h-40 w-full rounded-3xl object-cover" />
          </div>
        </section>
        <section id="cara" className="grid gap-3 md:grid-cols-3">
          <Step icon={<Clock className="size-5" />} title="Lihat yang buka" body="Jam operasional nempel di tiap kantin. Di luar jam, tombol pesan terkunci." />
          <Step icon={<Flame className="size-5" />} title="Rebut yang murah" body="Banner merah, hitung mundur, dan stok yang menipis langsung di beranda." />
          <Step icon={<Smartphone className="size-5" />} title="Getar waktu siap" body="Penjual menekan pesanan siap. HP siswa bergetar panjang, plus pengingat 10 menit." />
        </section>
        <section className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="text-2xl font-semibold">Tiga pintu, satu sekolah</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            <li>
              <p className="font-semibold">Siswa</p>
              <p className="text-sm text-muted">Masuk dengan email sekolah atau NIS. Riwayat dan struk tersimpan di akunmu.</p>
            </li>
            <li>
              <p className="font-semibold">Penjual</p>
              <p className="text-sm text-muted">Daftar dengan BPOM, KTP, dan foto booth. Lencana terverifikasi muncul setelah admin setuju.</p>
            </li>
            <li>
              <p className="flex items-center gap-1 font-semibold">
                Admin <BadgeCheck className="size-4 text-chili" />
              </p>
              <p className="text-sm text-muted">Setujui, minta revisi, atau tolak. Pantau kantin dan kirim pengumuman.</p>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Step({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article className="rounded-3xl border border-line bg-paper p-4">
      <span className="grid size-11 place-items-center rounded-2xl bg-foam text-chili">{icon}</span>
      <h2 className="mt-3 font-sans text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </article>
  );
}

export function LoginForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "up") {
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) throw new Error(result.error.message || "Daftar gagal");
        await navigate({ to: "/mulai" });
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message || "Masuk gagal");
        await navigate({ to: "/" });
      }
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <Wordmark />
        <h1 className="text-4xl font-semibold">{mode === "in" ? "Masuk" : "Buat akun"}</h1>
        {authEnabled ? (
          <>
            <form className="space-y-3" onSubmit={(event) => void submit(event)}>
              {mode === "up" ? <Field label="Nama" value={name} onChange={setName} /> : null}
              <Field label="Email sekolah" value={email} onChange={setEmail} type="email" placeholder="nama@sekolah.sch.id" />
              <Field label="Kata sandi" value={password} onChange={setPassword} type="password" />
              {error ? <p className="text-sm text-chili">{error}</p> : null}
              <Btn type="submit" full disabled={busy}>
                {busy ? "Sebentar…" : mode === "in" ? "Masuk" : "Daftar"}
              </Btn>
            </form>
            <button type="button" className="text-sm text-muted" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
            </button>
            <div className="space-y-2">
              {GROK_PROVIDERS.map((provider) => (
                <button
                  key={provider.providerId}
                  type="button"
                  onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
                  className="h-12 w-full rounded-2xl border border-line bg-paper text-sm font-semibold"
                >
                  Lanjut dengan {provider.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Masuk sedang dimatikan.</p>
        )}
      </div>
    </main>
  );
}

export function Onboarding({
  defaultName,
  current,
}: {
  defaultName: string;
  current: Profile | null;
}) {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>(current?.role ?? "student");
  const [name, setName] = useState(current?.name || defaultName);
  const [nis, setNis] = useState(current?.nis ?? "");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-ink">
      <form
        className="mx-auto w-full max-w-md space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          void saveProfile({ data: { role, name, nis, adminCode } })
            .then(() => navigate({ to: "/" }))
            .catch((err: unknown) => setError(errText(err)))
            .finally(() => setBusy(false));
        }}
      >
        <Wordmark />
        <h1 className="text-4xl font-semibold">Kamu yang mana?</h1>
        <Field label="Nama" value={name} onChange={setName} />
        <div className="grid gap-2">
          {(
            [
              ["student", "Siswa"],
              ["seller", "Penjual kantin"],
              ["admin", "Admin sekolah"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setRole(id)} className={`h-14 rounded-2xl border text-left px-4 font-semibold ${role === id ? "border-chili bg-foam" : "border-line bg-paper"}`}>
              {label}
            </button>
          ))}
        </div>
        {role === "student" ? <Field label="NIS" value={nis} onChange={setNis} /> : null}
        {role === "admin" ? <Field label="Kode admin" value={adminCode} onChange={setAdminCode} /> : null}
        {role === "admin" ? <p className="text-xs text-muted">Uji coba: KANTIN-ADMIN</p> : null}
        {error ? <p className="text-sm text-chili">{error}</p> : null}
        <Btn type="submit" full disabled={busy}>
          {busy ? "Menyimpan…" : "Lanjut"}
        </Btn>
      </form>
    </main>
  );
}

export function SessionGate({
  children,
  signedOut,
}: {
  children: ReactNode;
  signedOut: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <PageSkeleton />;
  if (!user) return <>{signedOut}</>;
  return <>{children}</>;
}

export function BounceHome() {
  return <Navigate to="/" />;
}
