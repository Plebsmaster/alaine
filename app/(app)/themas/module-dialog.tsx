"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui";

/** Knop die de bestaande formulieren (bewerken, thema toevoegen, verwijderen) in een dialoog opent. */
export function ModuleDialog({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        aria-label={title}
        // Na verzenden sluiten; de pagina toont daarna de nieuwe stand.
        onSubmit={() => ref.current?.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-[640px] rounded-2xl border border-border bg-surface p-5 text-text backdrop:bg-black/30 md:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl font-medium">{title}</h2>
          <Button type="button" variant="ghost" onClick={() => ref.current?.close()} aria-label="Sluiten">
            ×
          </Button>
        </div>
        {children}
      </dialog>
    </>
  );
}
