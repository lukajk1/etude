import { useEffect, useRef } from "react";
import { store } from "../model/store";
import { ui } from "../model/ui";

export type DrawFn = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * A HiDPI canvas that redraws on the next frame whenever the project, the UI state or
 * its size changes, and on every frame while playing. Call `invalidate` for local changes.
 */
export function useCanvas(draw: DrawFn) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const dirty = useRef(true);
  const invalidate = useRef(() => {
    dirty.current = true;
  }).current;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let raf = 0;
    const unsubs = [store.subscribe(invalidate), ui.subscribe(invalidate)];
    const ro = new ResizeObserver(invalidate);
    ro.observe(c);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!dirty.current && !ui.state.playing) return;
      dirty.current = false;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (w === 0 || h === 0) return;
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (c.width !== pw || c.height !== ph) {
        c.width = pw;
        c.height = ph;
      }
      const g = c.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      drawRef.current(g, w, h);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      unsubs.forEach((u) => u());
      ro.disconnect();
    };
  }, [invalidate]);

  return { ref, invalidate };
}

/**
 * Attach a non-passive wheel listener (React's is passive, so it cannot stop the
 * browser from zooming the page on ctrl+wheel). The handler returns true if it used the event.
 */
export function useNativeWheel(
  ref: React.RefObject<HTMLElement | null>,
  handler: (e: WheelEvent, x: number, y: number) => boolean,
) {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      const { x, y } = localPoint(e, el);
      if (h.current(e, x, y)) e.preventDefault();
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, [ref]);
}

/** Pointer position relative to an element. */
export function localPoint(e: { clientX: number; clientY: number }, el: Element) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.roundRect(x, y, w, h, rr);
}

/** Read a CSS custom property from :root. Cached; the palette does not change at runtime. */
const cssCache = new Map<string, string>();
export function cssVar(name: string): string {
  let v = cssCache.get(name);
  if (v === undefined) {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    cssCache.set(name, v);
  }
  return v;
}

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const gg = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${gg}, ${b}, ${alpha})`;
}
