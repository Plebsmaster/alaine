// Kleine helpers om FormData in Server Actions te lezen.

export function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function optText(fd: FormData, key: string): string | null {
  return text(fd, key) || null;
}

export function int(fd: FormData, key: string, fallback = 0): number {
  const n = Number.parseInt(text(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function optDate(fd: FormData, key: string): string | null {
  const v = text(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function list(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v).trim()).filter(Boolean);
}

/** "a, b ,c" -> ["a","b","c"] */
export function csv(fd: FormData, key: string): string[] {
  return text(fd, key).split(",").map((s) => s.trim()).filter(Boolean);
}

/** Alleen interne paden, om open redirects te voorkomen. */
export function safeReturn(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
