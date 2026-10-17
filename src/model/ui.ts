import { useSyncExternalStore } from "react";
import { PPQ } from "./types";

export interface SnapOption {
  label: string;
  ticks: number;
}

export const SNAPS: SnapOption[] = [
  { label: "Bar", ticks: 0 }, // resolved against the time signature
  { label: "1/2", ticks: PPQ * 2 },
  { label: "1/4", ticks: PPQ },
  { label: "1/8", ticks: PPQ / 2 },
  { label: "1/16", ticks: PPQ / 4 },
  { label: "1/32", ticks: PPQ / 8 },
  { label: "1/4 triplet", ticks: (PPQ * 2) / 3 },
  { label: "1/8 triplet", ticks: PPQ / 3 },
  { label: "1/16 triplet", ticks: PPQ / 6 },
  { label: "Off", ticks: 1 },
];

export interface UiState {
  selectedTrackId: string | null;
  selectedNoteIds: Set<string>;
  /** Index into SNAPS. */
  snap: number;
  /** Length given to newly drawn notes, in ticks. */
  drawLength: number;
  /** Horizontal zoom, pixels per quarter note. Shared by both timelines. */
  pxPerBeat: number;
  /** Left edge of both timelines, in ticks. */
  scrollTick: number;
  /** Where playback starts and returns to, in ticks. */
  cursorTick: number;
  playing: boolean;
  /** Live playhead, in ticks (only meaningful while playing). */
  playTick: number;
  showGhosts: boolean;
  /** Master volume, 0–1. Saved per browser, not per project. */
  masterVolume: number;
  /** Lanes and piano roll, or the full score. */
  view: "roll" | "score";
  /** Sound source id (see audio/sources). Saved per browser. */
  soundSource: string;
}

const SOUND_KEY = "etude.sound";

function savedSound(): string {
  try {
    return localStorage.getItem(SOUND_KEY) ?? "samples";
  } catch {
    return "samples";
  }
}

const VOLUME_KEY = "etude.volume";

function savedVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) !== null && v >= 0 && v <= 1 ? v : 0.8;
  } catch {
    return 0.8;
  }
}

type Listener = () => void;

class UiStore {
  state: UiState = {
    selectedTrackId: null,
    selectedNoteIds: new Set(),
    snap: 4,
    drawLength: PPQ,
    pxPerBeat: 72,
    scrollTick: 0,
    cursorTick: 0,
    playing: false,
    playTick: 0,
    showGhosts: true,
    masterVolume: savedVolume(),
    view: "roll",
    soundSource: savedSound(),
  };
  private listeners = new Set<Listener>();

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.state;

  set(patch: Partial<UiState>) {
    if (patch.masterVolume !== undefined && patch.masterVolume !== this.state.masterVolume) {
      try {
        localStorage.setItem(VOLUME_KEY, String(patch.masterVolume));
      } catch {
        // Not saved; the slider still works for this visit.
      }
    }
    if (patch.soundSource !== undefined && patch.soundSource !== this.state.soundSource) {
      try {
        localStorage.setItem(SOUND_KEY, patch.soundSource);
      } catch {
        // Not saved; still applies for this visit.
      }
    }
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
}

export const ui = new UiStore();

export function useUi(): UiState {
  return useSyncExternalStore(ui.subscribe, ui.get);
}

/** A single observable value, for state that changes too often to re-render the app. */
export class Signal<T> {
  private listeners = new Set<Listener>();
  constructor(public value: T) {}
  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.value;
  set(v: T) {
    if (v === this.value) return;
    this.value = v;
    for (const fn of this.listeners) fn();
  }
}

export function useSignal<T>(s: Signal<T>): T {
  return useSyncExternalStore(s.subscribe, s.get);
}

/** The pitch and time under the mouse in the piano roll. */
export const hover = new Signal<{ pitch: number; tick: number } | null>(null);
