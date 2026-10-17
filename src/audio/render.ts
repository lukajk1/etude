import * as Tone from "tone";
import { secondsBetween, songEnd, tempoMap, type Project } from "../model/types";
import { Engine } from "./engine";
import { getSource } from "./sources";

/** Render the whole project offline to a 16-bit stereo WAV. */
export async function renderWav(project: Project, sourceId: string): Promise<Blob> {
  const end = songEnd(project);
  if (end === 0) throw new Error("There are no notes to render yet.");
  await getSource(sourceId).load([...new Set(project.tracks.map((t) => t.timbre))]);
  const seconds = secondsBetween(tempoMap(project), 0, end) + 3; // + room for the reverb tail
  const buffer = await Tone.Offline(({ transport }) => {
    const engine = new Engine(sourceId);
    engine.sync({ ...project, loop: { ...project.loop, on: false } });
    transport.start(0);
  }, seconds, 2, 44100);
  const audio = buffer.get();
  if (!audio) throw new Error("Rendering produced no audio.");
  return encodeWav(audio);
}

function encodeWav(buf: AudioBuffer): Blob {
  const channels = buf.numberOfChannels;
  const frames = buf.length;
  const bytes = 44 + frames * channels * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const ascii = (off: number, s: string) => [...s].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buf.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}
