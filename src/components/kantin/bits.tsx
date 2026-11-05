import { useEffect, useState, type ReactNode } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { errText, rupiah, tagLabel } from "@/lib/kantin/format";
import { fileToJpeg } from "@/lib/kantin/photo";

export function Wordmark() {
  return (
    <span className="font-display text-xl font-semibold tracking-tight text-ink">
      Kantin<span className="text-chili">Kita</span>
    </span>
  );
}

export function Btn({
  children,
  onClick,
  tone = "chili",
  type = "button",
  disabled,
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "chili" | "ink" | "ghost" | "foam";
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
}) {
  const toneClass =
    tone === "ink"
      ? "bg-ink text-paper"
      : tone === "ghost"
        ? "border border-line bg-paper text-ink"
        : tone === "foam"
          ? "bg-foam text-chili"
          : "bg-chili text-paper";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50 ${full ? "w-full" : ""} ${toneClass}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-line bg-paper px-3 text-base text-ink outline-none focus:border-chili"
      />
    </label>
  );
}

export function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5 text-chili" aria-label={`${value} dari 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={`size-4 ${index < full ? "fill-chili" : "fill-transparent"}`} />
      ))}
    </span>
  );
}

export function Price({ price, sale }: { price: number; sale?: number | null }) {
  if (sale && sale < price) {
    return (
      <span className="inline-flex items-baseline gap-2">
        <span className="text-sm text-muted line-through tabular-nums">{rupiah(price)}</span>
        <span className="font-semibold tabular-nums">{rupiah(sale)}</span>
      </span>
    );
  }
  return <span className="font-semibold tabular-nums">{rupiah(price)}</span>;
}

export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-cream px-2 py-0.5 text-xs text-muted">
          {tagLabel(tag)}
        </span>
      ))}
    </span>
  );
}

export function PhotoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <span className="flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-paper">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-sm text-muted">Ketuk untuk unggah foto</span>
        )}
      </span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void fileToJpeg(file).then(onChange).catch((error: unknown) => toast.error(errText(error)));
        }}
      />
    </label>
  );
}

export function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-cream px-4 py-8 text-ink">
      <Wordmark />
      <p className="mt-6 text-sm text-muted">Menyiapkan kantin…</p>
      <div className="mt-6 space-y-3">
        <div className="h-28 animate-pulse rounded-3xl bg-line" />
        <div className="h-28 animate-pulse rounded-3xl bg-line" />
      </div>
    </div>
  );
}
