import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { SETTINGS_ICON } from "./nav-links";

// Basiscomponenten volgens docs/design/README.md ("Basiscomponenten"). Alleen tokens, geen hexkleuren.

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent font-bold text-accent-text hover:opacity-90",
  secondary: "border border-border-strong bg-surface text-text hover:bg-surface-2",
  ghost: "text-text-2 hover:bg-surface-2",
  danger: "text-danger hover:bg-surface-2",
};

export function buttonClass(variant: Variant = "secondary", extra = "") {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-[15px] font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Panel({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-border bg-surface p-5 md:p-6 ${className}`} {...props} />;
}

/** Ronde instellingenknop rechtsboven in de paginakop (alleen telefoon; op laptop zit hij in de bovenbalk). */
export function SettingsButton() {
  return (
    <Link
      data-shell
      href="/instellingen"
      aria-label="Instellingen"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-2 md:hidden"
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden>
        <path d={SETTINGS_ICON} />
      </svg>
    </Link>
  );
}

export function PageHeader({
  title,
  children,
  settings = true,
}: {
  title: string;
  children?: ReactNode;
  /** Instellingenknop op de telefoon tonen (niet op Instellingen zelf en niet in de focusmodus). */
  settings?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-[32px] font-medium leading-[1.1] md:text-[34px]">{title}</h1>
        {settings ? <SettingsButton /> : null}
      </div>
      {children}
    </div>
  );
}

/** Kleine kop in hoofdletters boven een titel of sectie. */
export function Eyebrow({ className = "", ...props }: ComponentProps<"p">) {
  return <p className={`text-xs font-bold uppercase tracking-[.08em] text-muted ${className}`} {...props} />;
}

const inputClass =
  "w-full rounded-[10px] border border-border-strong bg-surface px-3.5 text-base text-text placeholder:text-muted focus:border-accent focus:shadow-[inset_0_0_0_1px_var(--accent)]";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-bold md:text-sm">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} min-h-11 py-2 ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={`${inputClass} py-2.5 ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} min-h-11 py-2 ${props.className ?? ""}`} />;
}

type NoticeTone = "info" | "error" | "ok" | "warn";

export function Notice({ tone = "info", children }: { tone?: NoticeTone; children: ReactNode }) {
  const styles: Record<NoticeTone, string> = {
    info: "bg-surface-2 text-text-2",
    error: "border border-danger bg-surface text-danger",
    ok: "border border-accent bg-accent-soft text-accent-strong",
    warn: "bg-warn-bg text-warn-text-strong",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-[10px] px-3.5 py-2.5 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

type BadgeTone = "neutral" | "warn" | "accent";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  const styles: Record<BadgeTone, string> = {
    neutral: "bg-surface-2 text-text-2",
    warn: "bg-warn-bg font-bold text-warn-text",
    accent: "bg-accent-soft text-accent-strong",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs md:text-[13px] ${styles[tone]}`}>
      {children}
    </span>
  );
}

/** Sneltoetslabel. `onPrimary` op een primaire knop. */
export function Kbd({ onPrimary = false, className = "", ...props }: ComponentProps<"kbd"> & { onPrimary?: boolean }) {
  return (
    <kbd
      className={`inline-flex items-center rounded-[5px] border px-1.5 font-sans text-[11px] leading-[18px] ${
        onPrimary ? "border-accent-text/40 text-accent-text/90" : "border-border text-muted"
      } ${className}`}
      {...props}
    />
  );
}

export type SegmentedItem = { key: string; label: ReactNode; href?: string };

/**
 * Keuze uit een paar opties. Met `href` per item: navigatie (links met aria-current),
 * bruikbaar in servercomponenten. Zonder `href`: radiogroep met `onChange`, alleen in
 * clientcomponenten.
 */
export function Segmented({
  items,
  value,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  items: SegmentedItem[];
  value: string;
  onChange?: (key: string) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const track = `grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-2 p-1 ${className}`;
  const item = (active: boolean) =>
    `flex h-[38px] items-center justify-center gap-1.5 rounded-[9px] px-3 ${size === "sm" ? "text-xs" : "text-sm"} transition-colors motion-reduce:transition-none ${
      active ? "bg-surface font-bold text-text shadow-[0_1px_2px_rgb(0_0_0/.06)]" : "text-text-2 hover:text-text"
    }`;

  if (items.every((i) => i.href)) {
    return (
      <nav aria-label={label} className={track}>
        {items.map((i) => (
          <Link key={i.key} href={i.href!} aria-current={i.key === value ? "page" : undefined} className={item(i.key === value)}>
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <div role="radiogroup" aria-label={label} className={track}>
      {items.map((i, index) => (
        <button
          key={i.key}
          type="button"
          role="radio"
          aria-checked={i.key === value}
          tabIndex={i.key === value ? 0 : -1}
          onClick={() => onChange?.(i.key)}
          onKeyDown={(e) => {
            const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
            if (!step) return;
            e.preventDefault();
            const next = (index + step + items.length) % items.length;
            onChange?.(items[next].key);
            (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
          }}
          className={item(i.key === value)}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Voortgang als één segment per kaart: gedaan, huidig, nog te doen. Telefoon iets dunner.
 * Boven 40 segmenten één doorlopende balk.
 */
export function ProgressSegments({
  done,
  total,
  label = "Voortgang",
  className = "",
}: {
  done: number;
  total: number;
  label?: string;
  className?: string;
}) {
  const now = Math.max(0, Math.min(done, total));
  const height = "h-[5px] md:h-1.5";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={now}
      className={`flex flex-1 gap-0.5 md:gap-[3px] ${className}`}
    >
      {total > 40 ? (
        <div className={`${height} w-full overflow-hidden rounded bg-border`}>
          <div className={`${height} bg-accent`} style={{ width: `${total ? (now / total) * 100 : 0}%` }} />
        </div>
      ) : (
        Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`${height} flex-1 rounded-sm ${i < now ? "bg-accent" : i === now ? "bg-accent-mid" : "bg-border"}`}
          />
        ))
      )}
    </div>
  );
}
