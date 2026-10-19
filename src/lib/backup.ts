import { Signal } from "../model/ui";

/**
 * Everything Etude saves lives in this browser's localStorage under "etude." keys. This
 * backs it all up to a file and restores it, and asks the browser not to evict it.
 */

const PREFIX = "etude.";
const LAST_KEY = "etude.backup.last";

function readLast(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** When the last backup file was made, if ever. */
export const lastBackup = new Signal<number | null>(readLast());

/** Ask the browser to keep this site's storage even when disk space runs low. */
export function askPersistentStorage() {
  void navigator.storage?.persist?.().catch(() => {});
}

export function exportProgress() {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && k !== LAST_KEY) data[k] = localStorage.getItem(k) ?? "";
  }
  const now = new Date();
  const file = new Blob([JSON.stringify({ app: "etude", version: 1, saved: now.toISOString(), data }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  a.download = `etude-progress-${day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  try {
    localStorage.setItem(LAST_KEY, String(now.getTime()));
  } catch {
    // The file was still made.
  }
  lastBackup.set(now.getTime());
}

/** Restore a backup file over what's saved now, then reload. Returns an error message, or nothing. */
export async function importProgress(file: File): Promise<string | void> {
  let parsed: { app?: string; data?: Record<string, unknown> };
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return "That file isn't an Etude backup.";
  }
  if (parsed.app !== "etude" || !parsed.data || typeof parsed.data !== "object") return "That file isn't an Etude backup.";
  const entries = Object.entries(parsed.data).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === "string") as [string, string][];
  if (!entries.length) return "That backup is empty.";
  try {
    for (const [k, v] of entries) localStorage.setItem(k, v);
  } catch {
    return "The browser wouldn't save the restored progress.";
  }
  location.reload();
}
