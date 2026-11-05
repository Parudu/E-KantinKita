import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { saveProfile } from "@/lib/kantin/api";
import { errText } from "@/lib/kantin/format";
import { ensureNotifyPermission, previewRing } from "@/lib/kantin/notify";
import type { Profile, Role } from "@/lib/kantin/types";
import { Btn, Field } from "./bits";

export function AccountView({ profile }: { profile: Profile }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>(profile.role);
  const [name, setName] = useState(profile.name);
  const [nis, setNis] = useState(profile.nis ?? "");
  const [adminCode, setAdminCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-semibold">Akun</h1>
      <div className="rounded-3xl border border-line bg-paper p-4">
        <UserButton />
        {user?.primaryEmail ? <p className="mt-2 text-sm text-muted">{user.primaryEmail}</p> : null}
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void saveProfile({ data: { role, name, nis, adminCode } })
            .then(() => navigate({ to: "/" }))
            .catch((error: unknown) => toast.error(errText(error)))
            .finally(() => setBusy(false));
        }}
      >
        <Field label="Nama panggilan" value={name} onChange={setName} />
        <div className="grid gap-2">
          {(
            [
              ["student", "Siswa", "Pesan, bayar, ambil pas HP bergetar"],
              ["seller", "Penjual", "Antrian, menu, flash sale"],
              ["admin", "Admin sekolah", "Verifikasi kantin dan pengumuman"],
            ] as const
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRole(id)}
              className={`rounded-2xl border p-3 text-left ${role === id ? "border-chili bg-foam" : "border-line bg-paper"}`}
            >
              <span className="block font-semibold">{label}</span>
              <span className="text-sm text-muted">{hint}</span>
            </button>
          ))}
        </div>
        {role === "student" ? <Field label="NIS" value={nis} onChange={setNis} placeholder="Nomor induk siswa" /> : null}
        {role === "admin" ? (
          <Field label="Kode admin sekolah" value={adminCode} onChange={setAdminCode} placeholder="Minta ke tata usaha" />
        ) : null}
        {role === "admin" ? <p className="text-xs text-muted">Untuk uji coba di aplikasi ini, kodenya KANTIN-ADMIN.</p> : null}
        <Btn type="submit" full disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan peran"}
        </Btn>
      </form>
      <Btn
        tone="ghost"
        full
        onClick={() => {
          void ensureNotifyPermission();
          previewRing({
            kind: "preview",
            title: "Pesanan siap diambil",
            canteen: "Kantin Nusantara",
            code: "#0042",
            subtitle: "1× Nasi Goreng Kampung",
          });
        }}
      >
        Coba getar dering
      </Btn>
    </div>
  );
}
