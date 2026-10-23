import * as Tone from "tone";
import { store } from "../model/store";
import { PPQ, songEnd } from "../model/types";
import { ui } from "../model/ui";
import { view } from "../lib/geom";
import { Engine } from "./engine";
import { getSource } from "./sources";
import { Signal } from "../model/ui";

/** The engine that plays through the speakers. */
export const engine = new Engine(ui.state.soundSource);
engine.sync(store.project);

/** Progress of loading the current sound source, 0–1; null when nothing is loading. */
export const soundLoading = new Signal<number | null>(null);
export const soundError = new Signal<string>("");

/**
 * Make sure the chosen source has what the project's timbres need. Lanes play with the
 * synth until their sounds arrive, then switch over.
 */
async function prepareSound() {
  const source = getSource(ui.state.soundSource);
  const timbres = [...new Set(store.project.tracks.map((t) => t.timbre))].filter((t) => source.supports(t) && !source.isReady(t));
  if (timbres.length === 0) return;
  soundLoading.set(0);
  try {
    await source.load(timbres, (f) => soundLoading.set(f));
    soundError.set("");
  } catch (err) {
    soundError.set(`Couldn't load ${source.name.toLowerCase()} sounds: ${err instanceof Error ? err.message : err}`);
  }
  soundLoading.set(null);
  if (getSource(ui.state.soundSource) === source) engine.sync(store.project);
}

store.subscribe(() => {
  engine.sync(store.project);
  void prepareSound();
});
let lastSource = ui.state.soundSource;
ui.subscribe(() => {
  if (ui.state.soundSource === lastSource) return;
  lastSource = ui.state.soundSource;
  engine.setSource(lastSource);
  engine.sync(store.project);
  void prepareSound();
});
void prepareSound();
engine.setMasterVolume(ui.state.masterVolume);
let lastVolume = ui.state.masterVolume;
ui.subscribe(() => {
  if (ui.state.masterVolume !== lastVolume) {
    lastVolume = ui.state.masterVolume;
    engine.setMasterVolume(lastVolume);
  }
});

/** Browsers only allow audio after a click or key press, so unlock it on the first one. */
export async function ensureAudio() {
  if (Tone.getContext().state !== "running") await Tone.start();
}
window.addEventListener("pointerdown", () => void ensureAudio(), { capture: true });
window.addEventListener("keydown", () => void ensureAudio(), { capture: true });

type PreviewEvent = { pitches: number[]; at: number; dur: number; vel?: number };

/** Bumped by `stopAll`, so a play that was waiting (on a delay or the audio unlock) is dropped. */
let generation = 0;
const pending = new Set<ReturnType<typeof setTimeout>>();

/** Whether ear-training notes are sounding now, for play/stop buttons. */
export const previewPlaying = new Signal<boolean>(false);
let previewTimer: ReturnType<typeof setTimeout> | undefined;

/** Play notes outside the project (ear training), on piano. */
export async function playNotes(events: PreviewEvent[]) {
  const gen = generation;
  await ensureAudio();
  if (gen !== generation) return;
  if (ui.state.playing) stop();
  engine.preview("piano", events);
  const end = events.reduce((m, e) => Math.max(m, e.at + e.dur), 0);
  previewPlaying.set(true);
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => previewPlaying.set(false), (end + 0.15) * 1000);
}

/** Play notes after a delay, unless `stopAll` comes first. */
export function playNotesLater(events: PreviewEvent[], ms: number) {
  const t = setTimeout(() => {
    pending.delete(t);
    void playNotes(events);
  }, ms);
  pending.add(t);
}

/** Silence everything: previews, delayed previews and project playback. For leaving a screen or the page. */
export function stopAll() {
  generation++;
  for (const t of pending) clearTimeout(t);
  pending.clear();
  engine.stopPreview();
  clearTimeout(previewTimer);
  previewPlaying.set(false);
  if (ui.state.playing) stop();
}
window.addEventListener("pagehide", stopAll);

/** Make sure the piano is loaded for the current sound source (for ear training). */
export function preparePiano() {
  void getSource(ui.state.soundSource).load(["piano"]);
}

export function playheadTick(): number {
  return ui.state.playing ? engine.ticks : ui.state.cursorTick;
}

let raf = 0;

export async function play() {
  await ensureAudio();
  const p = store.project;
  let from = ui.state.cursorTick;
  if (p.loop.on && (from < p.loop.start || from >= p.loop.end)) from = p.loop.start;
  engine.play(from);
  ui.set({ playing: true });
  cancelAnimationFrame(raf);
  const tick = () => {
    if (!ui.state.playing) return;
    const now = engine.ticks;
    const proj = store.project;
    if (!proj.loop.on && now > songEnd(proj) + PPQ * 2) {
      stop();
      return;
    }
    // Page the view along with the playhead.
    const visibleTicks = (view.timelineWidth / ui.state.pxPerBeat) * PPQ;
    if (now > ui.state.scrollTick + visibleTicks * 0.92 || now < ui.state.scrollTick) {
      ui.set({ scrollTick: Math.max(0, now - visibleTicks * 0.08) });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Jump playback to a tick if playing; otherwise just move the cursor. */
export function seek(tick: number) {
  ui.set({ cursorTick: Math.max(0, tick) });
  if (ui.state.playing) engine.play(Math.max(0, tick));
}

export function stop() {
  engine.stop();
  cancelAnimationFrame(raf);
  ui.set({ playing: false });
}

export function togglePlay() {
  if (ui.state.playing) stop();
  else void play();
}
