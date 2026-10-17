import type { TimbreId } from "../../model/types";
import { samplesSource } from "./samples";
import { synthSource } from "./synth";
import type { SoundSource } from "./types";

export type { SoundSource, Voice } from "./types";

/** Every way the app can make sound. Add new approaches here. */
export const SOURCES: SoundSource[] = [samplesSource, synthSource];

export const DEFAULT_SOURCE = samplesSource.id;

export function getSource(id: string): SoundSource {
  return SOURCES.find((s) => s.id === id) ?? synthSource;
}

/** The source that will actually play a timbre: the chosen one if it can, else the synth. */
export function sourceFor(id: string, timbre: TimbreId): SoundSource {
  const s = getSource(id);
  return s.supports(timbre) && s.isReady(timbre) ? s : synthSource;
}
