"use client";

import { useTransition } from "react";
import { clearAll } from "@/lib/offline/idb";

/** Uitloggen: eerst de offline opslag op dit apparaat wissen (wachtrij en bewaarde pagina's). */
export function LogoutButton({ signOut, className }: { signOut: () => Promise<void>; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          await clearAll();
          if ("caches" in window) for (const key of await caches.keys()) await caches.delete(key);
          await signOut();
        })
      }
    >
      Uitloggen
    </button>
  );
}
