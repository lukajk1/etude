import { newId, PPQ, type Note, type Project, type TimbreId, type Track } from "./types";

const BAR = PPQ * 4;

function note(pitch: number, beat: number, beats: number, vel = 0.75): Note {
  return { id: newId(), pitch, start: Math.round(beat * PPQ), dur: Math.round(beats * PPQ), vel };
}

export function makeTrack(timbre: TimbreId, name: string, notes: Note[] = []): Track {
  return { id: newId("t"), name, timbre, volume: 0, pan: 0, mute: false, solo: false, notes };
}

export function emptyProject(): Project {
  return {
    title: "Untitled",
    bpm: 100,
    timeSig: [4, 4],
    key: 0,
    scale: "major",
    loop: { on: false, start: 0, end: BAR * 4 },
    tracks: [
      makeTrack("strings", "Strings"),
      makeTrack("woodwinds", "Woodwinds"),
      makeTrack("brass", "Brass"),
      makeTrack("harp", "Harp"),
    ],
  };
}

/** Eight bars in C major: I–V–vi–IV, then I–V–IV–I, so there is something to hear right away. */
export function demoProject(): Project {
  const chords: { root: number; third: number }[] = [
    { root: 48, third: 4 }, // C
    { root: 43, third: 4 }, // G
    { root: 45, third: 3 }, // Am
    { root: 41, third: 4 }, // F
    { root: 48, third: 4 }, // C
    { root: 43, third: 4 }, // G
    { root: 41, third: 4 }, // F
    { root: 48, third: 4 }, // C
  ];
  // Close-position triads around middle C, voice-led.
  const voicings = [
    [60, 64, 67], [59, 62, 67], [60, 64, 69], [60, 65, 69],
    [60, 64, 67], [59, 62, 67], [60, 65, 69], [60, 64, 67],
  ];

  const strings: Note[] = [];
  const brass: Note[] = [];
  const harp: Note[] = [];
  chords.forEach((c, bar) => {
    for (const p of voicings[bar]) strings.push(note(p, bar * 4, 4, 0.55));
    brass.push(note(c.root, bar * 4, 2, 0.6), note(c.root + 7 - 12, bar * 4 + 2, 2, 0.5));
    const r = c.root;
    const pattern = [r, r + 7, r + 12, r + 12 + c.third, r + 19, r + 12 + c.third, r + 12, r + 7];
    pattern.forEach((p, i) => harp.push(note(p, bar * 4 + i * 0.5, 0.5, i === 0 ? 0.7 : 0.5)));
  });

  // [pitch, beat, length]
  const melody: [number, number, number][] = [
    [76, 0, 1], [74, 1, 0.5], [72, 1.5, 0.5], [74, 2, 1], [76, 3, 1],
    [74, 4, 1.5], [71, 5.5, 0.5], [67, 6, 2],
    [72, 8, 1], [76, 9, 1], [81, 10, 1], [79, 11, 1],
    [77, 12, 1], [76, 13, 0.5], [74, 13.5, 0.5], [72, 14, 2],
    [76, 16, 1], [74, 17, 0.5], [72, 17.5, 0.5], [74, 18, 1], [76, 19, 1],
    [74, 20, 1], [71, 21, 1], [74, 22, 1], [79, 23, 1],
    [81, 24, 1], [79, 25, 0.5], [77, 25.5, 0.5], [76, 26, 1], [74, 27, 1],
    [72, 28, 4],
  ];
  const winds = melody.map(([p, b, l]) => note(p, b, l, 0.8));

  return {
    title: "Demo in C",
    bpm: 96,
    timeSig: [4, 4],
    key: 0,
    scale: "major",
    loop: { on: false, start: 0, end: BAR * 8 },
    tracks: [
      makeTrack("woodwinds", "Melody", winds),
      makeTrack("strings", "Chords", strings),
      makeTrack("harp", "Arpeggio", harp),
      makeTrack("brass", "Bass", brass),
    ],
  };
}
