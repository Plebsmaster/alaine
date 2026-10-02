"use client";

import { Button, Notice } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Notice tone="error">Er ging iets mis: {error.message || "onbekende fout"}</Notice>
      <Button onClick={reset}>Opnieuw proberen</Button>
    </div>
  );
}
