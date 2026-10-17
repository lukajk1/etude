import { PPQ, ticksPerBar, type Project } from "../model/types";
import { SNAPS, ui, type UiState } from "../model/ui";

/** Width of the left column: lane headers above, inspector + keyboard below. */
export const LEFT_W = 252;
export const KEYS_W = 64;
export const LANE_H = 60;
export const ROW_H = 14;
export const RULER_H = 26;
export const VEL_H = 64;
/** The velocity strip under the piano roll. Hidden for now; set true to bring it back. */
export const SHOW_VELOCITY = false;

/** Shared, non-reactive view facts that canvases report to each other. */
export const view = {
  timelineWidth: 800,
};

export function tickToX(tick: number, s: UiState = ui.state): number {
  return ((tick - s.scrollTick) / PPQ) * s.pxPerBeat;
}

export function xToTick(x: number, s: UiState = ui.state): number {
  return (x / s.pxPerBeat) * PPQ + s.scrollTick;
}

export function snapSize(project: Project, s: UiState = ui.state): number {
  const opt = SNAPS[s.snap];
  return opt.ticks === 0 ? ticksPerBar(project) : opt.ticks;
}

export function snapFloor(tick: number, size: number): number {
  return Math.floor(tick / size) * size;
}

export function snapRound(tick: number, size: number): number {
  return Math.round(tick / size) * size;
}

/** Zoom both timelines, keeping the tick under `anchorX` where it is. */
export function zoomAt(factor: number, anchorX: number) {
  const s = ui.state;
  const anchorTick = xToTick(anchorX, s);
  const pxPerBeat = Math.min(800, Math.max(12, s.pxPerBeat * factor));
  const scrollTick = Math.max(0, anchorTick - (anchorX / pxPerBeat) * PPQ);
  ui.set({ pxPerBeat, scrollTick });
}

export function scrollBy(dxPixels: number) {
  const s = ui.state;
  ui.set({ scrollTick: Math.max(0, s.scrollTick + (dxPixels / s.pxPerBeat) * PPQ) });
}

/** Handle a wheel event over a timeline: ctrl zooms, shift or a sideways swipe scrolls. Returns true if used. */
export function timelineWheel(e: WheelEvent, x: number): boolean {
  if (e.ctrlKey || e.metaKey) {
    zoomAt(Math.exp(-e.deltaY * 0.0025), x);
    return true;
  }
  if (e.shiftKey) {
    scrollBy(e.deltaY || e.deltaX);
    return true;
  }
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    scrollBy(e.deltaX);
    return true;
  }
  return false;
}
