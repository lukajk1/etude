import { useSyncExternalStore } from "react";

/** Practice Room screens, kept in the URL hash so links and the back button work. */
export type Route =
  | { kind: "home" }
  | { kind: "drill"; id: string }
  | { kind: "exercise"; id: string }
  | { kind: "transcribe"; id: string }
  | { kind: "cards"; id: string }
  | { kind: "train"; id: string };

function parse(hash: string): Route {
  const [, kind, id] = hash.replace(/^#/, "").split("/");
  if ((kind === "drill" || kind === "exercise" || kind === "transcribe" || kind === "cards" || kind === "train") && id) return { kind, id: decodeURIComponent(id) };
  return { kind: "home" };
}

let current = parse(location.hash);
const listeners = new Set<() => void>();
window.addEventListener("hashchange", () => {
  current = parse(location.hash);
  for (const fn of listeners) fn();
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

export function go(route: Route) {
  location.hash = route.kind === "home" ? "" : `/${route.kind}/${encodeURIComponent(route.id)}`;
}
