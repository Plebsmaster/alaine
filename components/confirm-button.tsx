"use client";

import type { ComponentProps } from "react";
import { Button } from "./ui";

/** Verzendknop die eerst om bevestiging vraagt. */
export function ConfirmButton({
  message,
  ...props
}: ComponentProps<typeof Button> & { message: string }) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}
