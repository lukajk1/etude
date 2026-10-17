import * as Tone from "tone";
import type { TimbreId } from "../../model/types";
import type { SoundSource, Voice } from "./types";

/**
 * Recorded instruments: VSCO 2 Community Edition (CC0) for the orchestra and the
 * Salamander Grand Piano (CC BY 3.0) for piano. The files and the note each one was
 * recorded at are listed in public/samples/manifest.json; notes in between are
 * re-pitched from the nearest recording.
 */

interface Manifest {
  version: 1;
  timbres: Partial<Record<TimbreId, Record<string, string>>>;
}

interface Playback {
  attack: number;
  /** Fade after the note ends. Long for instruments that ring on (harp). */
  release: number;
  /** Trim relative to the other timbres. */
  gainDb: number;
}

const PLAYBACK: Partial<Record<TimbreId, Playback>> = {
  // Gains bring the (individually leveled) recordings in line with the synth timbres
  // that still play choir, pure tone and percussion.
  strings: { attack: 0.02, release: 0.45, gainDb: 3.5 },
  woodwinds: { attack: 0.01, release: 0.22, gainDb: 4 },
  brass: { attack: 0.01, release: 0.28, gainDb: 3.5 },
  harp: { attack: 0, release: 2.2, gainDb: 3 },
  piano: { attack: 0, release: 0.7, gainDb: 2.5 },
};

const CREDITS: Partial<Record<TimbreId, string>> = {
  strings: "Samples: VSCO 2 Community Edition (string sections and solo bass), CC0.",
  woodwinds: "Samples: VSCO 2 Community Edition (bassoon, clarinet, flute), CC0.",
  brass: "Samples: VSCO 2 Community Edition (tuba, trombone, horn, trumpet), CC0.",
  harp: "Samples: VSCO 2 Community Edition, CC0.",
  piano: "Samples: Salamander Grand Piano by Alexander Holm, CC BY 3.0.",
};

const base = import.meta.env.BASE_URL;
let manifest: Promise<Manifest> | null = null;
const buffers = new Map<TimbreId, Map<number, Tone.ToneAudioBuffer>>();
const loading = new Map<TimbreId, Promise<void>>();

function getManifest(): Promise<Manifest> {
  manifest ??= fetch(`${base}samples/manifest.json`).then((r) => {
    if (!r.ok) throw new Error(`Couldn't load the sample list (${r.status}).`);
    return r.json() as Promise<Manifest>;
  });
  return manifest;
}

function loadTimbre(timbre: TimbreId, tick: () => void): Promise<void> {
  let p = loading.get(timbre);
  if (!p) {
    p = (async () => {
      const files = (await getManifest()).timbres[timbre] ?? {};
      const map = new Map<number, Tone.ToneAudioBuffer>();
      await Promise.all(
        Object.entries(files).map(async ([pitch, file]) => {
          map.set(Number(pitch), await Tone.ToneAudioBuffer.fromUrl(`${base}samples/${file}`));
          tick();
        }),
      );
      buffers.set(timbre, map);
    })();
    // Let a failed load be retried later.
    p.catch(() => loading.delete(timbre));
    loading.set(timbre, p);
  }
  return p;
}

class SampledVoice implements Voice {
  readonly output: Tone.Gain;
  private sampler: Tone.Sampler;

  constructor(timbre: TimbreId) {
    const pb = PLAYBACK[timbre]!;
    this.output = new Tone.Gain(Tone.dbToGain(pb.gainDb));
    const urls: Record<number, Tone.ToneAudioBuffer> = {};
    for (const [pitch, buf] of buffers.get(timbre) ?? []) urls[pitch] = buf;
    this.sampler = new Tone.Sampler({ urls, attack: pb.attack, release: pb.release, curve: "exponential" }).connect(this.output);
  }

  play(pitch: number, time: number, dur: number, vel: number) {
    // Recordings are at one dynamic; shape loudness so soft notes really are softer.
    const gain = Math.pow(Math.max(0.02, vel), 1.4);
    this.sampler.triggerAttackRelease(Tone.mtof(pitch as Tone.Unit.MidiNote), Math.max(0.03, dur), time, gain);
  }

  releaseAll() {
    this.sampler.releaseAll();
  }

  dispose() {
    this.sampler.dispose();
    this.output.dispose();
  }
}

export const samplesSource: SoundSource = {
  id: "samples",
  name: "Recorded",
  description: "Real instruments: VSCO 2 orchestral samples and the Salamander grand piano.",
  supports: (timbre) => timbre in PLAYBACK,
  isReady: (timbre) => buffers.has(timbre),
  async load(timbres, onProgress) {
    const wanted = timbres.filter((t) => t in PLAYBACK && !buffers.has(t));
    if (wanted.length === 0) return;
    const m = await getManifest();
    const total = wanted.reduce((n, t) => n + Object.keys(m.timbres[t] ?? {}).length, 0);
    let done = 0;
    const tick = () => onProgress?.(++done / Math.max(1, total));
    await Promise.all(wanted.map((t) => loadTimbre(t, tick)));
  },
  createVoice: (timbre) => new SampledVoice(timbre),
  credit: (timbre) => CREDITS[timbre] ?? null,
};
