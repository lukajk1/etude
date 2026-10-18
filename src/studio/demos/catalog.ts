import { importMidi } from "../../midi/midiio";
import { demoProject, emptyProject } from "../../model/demo";
import type { Project, ScaleId, TimbreId } from "../../model/types";
import { odeToJoy } from "./ode";

export interface Demo {
  id: string;
  title: string;
  composer: string;
  /** One line on what to listen for. */
  blurb: string;
  /** Where it came from and under what terms. */
  credit: string;
  load: () => Promise<Project>;
}

interface MidiDemo {
  file: string;
  title: string;
  key: number;
  scale: ScaleId;
  /** Name and timbre for each lane, in the file's track order. */
  lanes: [string, TimbreId][];
  /** Most source files have flat dynamics; give them one sensible level. Omit to keep the file's own. */
  vel?: number;
  /** Override the file's tempo when it's unrealistic. */
  bpm?: number;
}

async function fromMidi(d: MidiDemo): Promise<Project> {
  const res = await fetch(`${import.meta.env.BASE_URL}demos/${d.file}`);
  if (!res.ok) throw new Error(`Couldn't load ${d.file} (${res.status}).`);
  const { project } = importMidi(await res.arrayBuffer(), d.title, emptyProject());
  return {
    ...project,
    key: d.key,
    scale: d.scale,
    bpm: d.bpm ?? project.bpm,
    tracks: project.tracks.map((t, i) => {
      const lane = d.lanes[i];
      return {
        ...t,
        name: lane?.[0] ?? t.name,
        timbre: lane?.[1] ?? t.timbre,
        notes: d.vel === undefined ? t.notes : t.notes.map((n) => ({ ...n, vel: d.vel as number })),
      };
    }),
  };
}

const MUTOPIA = "Typeset for the Mutopia Project";

export const DEMOS: Demo[] = [
  {
    id: "building-blocks",
    title: "Building blocks in C",
    composer: "Etude",
    blurb: "Melody, chords, arpeggio and bass on I–V–vi–IV. Mute lanes to hear each layer.",
    credit: "Written for Etude.",
    load: async () => demoProject(),
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    composer: "Beethoven, Symphony No. 9",
    blurb: "One tune, three times: low strings alone, then winds, then the full orchestra and choir.",
    credit: "Simplified arrangement written for Etude. The music is public domain.",
    load: async () => odeToJoy(),
  },
  {
    id: "nachtmusik",
    title: "Eine kleine Nachtmusik, I",
    composer: "Mozart",
    blurb: "A string quartet. Watch how often the four parts move together, then split apart.",
    credit: `${MUTOPIA} by gnomino (Mutopia-2007/01/01-900). Public domain.`,
    load: () =>
      fromMidi({
        file: "mozart-nachtmusik-1.mid",
        title: "Eine kleine Nachtmusik, I",
        key: 7,
        scale: "major",
        vel: 0.7,
        lanes: [["Violin I", "strings"], ["Violin II", "strings"], ["Viola", "strings"], ["Cello", "strings"]],
      }),
  },
  {
    id: "moonlight-1",
    title: "Moonlight Sonata, I",
    composer: "Beethoven",
    blurb: "Slow triplet arpeggios under a quiet melody. Select a bar of the right hand to name its chord.",
    credit: `${MUTOPIA} by Stewart Holmes (Mutopia-2007/02/11-276). CC BY-SA 2.5.`,
    load: () =>
      fromMidi({
        file: "beethoven-moonlight-1.mid",
        title: "Moonlight Sonata, I",
        key: 1,
        scale: "minor",
        vel: 0.45,
        lanes: [["Right hand", "piano"], ["Left hand", "piano"]],
      }),
  },
  {
    id: "moonlight-3",
    title: "Moonlight Sonata, III",
    composer: "Beethoven",
    blurb: "The same key, now Presto agitato: rising arpeggios that crash into chords.",
    credit: `${MUTOPIA} by Stewart Holmes (Mutopia-2007/02/11-276). CC BY-SA 2.5.`,
    load: () =>
      fromMidi({
        file: "beethoven-moonlight-3.mid",
        title: "Moonlight Sonata, III",
        key: 1,
        scale: "minor",
        vel: 0.55,
        bpm: 160,
        lanes: [["Right hand", "piano"], ["Left hand", "piano"]],
      }),
  },
  {
    id: "pathetique-2",
    title: "Pathétique Sonata, II",
    composer: "Beethoven",
    blurb: "A singing melody in the middle of the texture, with accompaniment above and below it.",
    credit: `${MUTOPIA} by Chris Sawer (Mutopia-2011/10/25-295). Public domain.`,
    load: () =>
      fromMidi({
        file: "beethoven-pathetique-2.mid",
        title: "Pathétique Sonata, II",
        key: 8,
        scale: "major",
        vel: 0.55,
        lanes: [["Right hand", "piano"], ["Left hand", "piano"]],
      }),
  },
  {
    id: "bach-prelude",
    title: "Prelude in C, WTC I",
    composer: "Bach",
    blurb: "Nothing but arpeggios: every bar is one chord spelled out. A good one to analyze bar by bar.",
    credit: `${MUTOPIA} by Tobias Erbsland (Mutopia-2011/09/12-5). Public domain.`,
    load: () =>
      fromMidi({
        file: "bach-prelude-c.mid",
        title: "Prelude in C, WTC I",
        key: 0,
        scale: "major",
        vel: 0.55,
        lanes: [["Left hand", "piano"], ["Right hand", "piano"]],
      }),
  },
  {
    id: "rach-prelude-5",
    title: "Prelude in G minor, Op. 23 No. 5",
    composer: "Rachmaninoff",
    blurb: "A march in G minor around a slow, singing middle section. The file's own dynamics and tempo changes are kept.",
    credit: `${MUTOPIA} by Joram Berger (Mutopia-2015/09/28-2001). CC BY-SA 4.0.`,
    load: () =>
      fromMidi({
        file: "rachmaninoff-prelude-g-minor.mid",
        title: "Prelude in G minor, Op. 23 No. 5",
        key: 7,
        scale: "minor",
        lanes: [["Right hand", "piano"], ["Left hand", "piano"]],
      }),
  },
  {
    id: "canon",
    title: "Canon in D",
    composer: "Pachelbel",
    blurb: "One bass line repeated under three violins playing the same music, each two bars apart.",
    credit: `${MUTOPIA} by Michael Fischer v. Mollard (Mutopia-2015/09/02-2047). CC BY 4.0.`,
    load: () =>
      fromMidi({
        file: "pachelbel-canon.mid",
        title: "Canon in D",
        key: 2,
        scale: "major",
        vel: 0.6,
        lanes: [["Violin I", "strings"], ["Violin II", "strings"], ["Violin III", "strings"], ["Cello", "strings"]],
      }),
  },
];
