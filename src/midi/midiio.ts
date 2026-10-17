import { Midi } from "@tonejs/midi";
import { makeTrack } from "../model/demo";
import { TIMBRES, timbreForProgram } from "../model/timbres";
import { newId, PPQ, type Project } from "../model/types";

/** Read a Standard MIDI File into a project: one lane per MIDI track and channel. */
export function importMidi(data: ArrayBuffer, title: string, base: Project): { project: Project; notes: string[] } {
  const midi = new Midi(data);
  const scale = PPQ / midi.header.ppq;
  const warnings: string[] = [];

  const tempos = midi.header.tempos;
  const bpm = tempos.length ? Math.round(tempos[0].bpm) : 120;
  const changes = tempos
    .filter((t) => t.ticks > 0)
    .map((t) => ({ tick: Math.round(t.ticks * scale), bpm: Math.round(t.bpm * 10) / 10 }));
  const ts = midi.header.timeSignatures[0]?.timeSignature;

  const tracks = midi.tracks
    .filter((t) => t.notes.length > 0)
    .map((t, i) => {
      const timbre = timbreForProgram(t.instrument.number, t.instrument.percussion);
      const name = t.name.trim() || (t.instrument.percussion ? "Drums" : `${TIMBRES[timbre].name} ${i + 1}`);
      const notes = t.notes.map((n) => ({
        id: newId(),
        pitch: n.midi,
        start: Math.round(n.ticks * scale),
        dur: Math.max(1, Math.round(n.durationTicks * scale)),
        vel: n.velocity,
      }));
      return makeTrack(timbre, name, notes);
    });

  if (tracks.length === 0) throw new Error("This MIDI file has no notes in it.");

  return {
    project: {
      ...base,
      title,
      bpm,
      tempos: changes.length ? changes : undefined,
      timeSig: ts && ts.length === 2 ? [ts[0], ts[1]] : [4, 4],
      loop: { on: false, start: 0, end: PPQ * 16 },
      tracks,
    },
    notes: warnings,
  };
}

/** Write the project as a format-1 MIDI file, one track per lane. */
export function exportMidi(project: Project): Uint8Array {
  const midi = new Midi();
  midi.header.name = project.title;
  midi.header.setTempo(project.bpm);
  for (const c of project.tempos ?? []) if (c.tick > 0) midi.header.tempos.push({ ticks: c.tick, bpm: c.bpm });
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [project.timeSig[0], project.timeSig[1]] });
  midi.header.update();

  let nextChannel = 0;
  for (const lane of project.tracks) {
    const t = midi.addTrack();
    t.name = lane.name;
    if (lane.timbre === "percussion") {
      t.channel = 9;
    } else {
      t.channel = nextChannel;
      nextChannel = (nextChannel + 1) % 16;
      if (nextChannel === 9) nextChannel = 10; // channel 10 (index 9) is reserved for drums
    }
    t.instrument.number = TIMBRES[lane.timbre].gmProgram;
    for (const n of lane.notes) {
      t.addNote({ midi: n.pitch, ticks: n.start, durationTicks: n.dur, velocity: n.vel });
    }
  }
  return midi.toArray();
}
