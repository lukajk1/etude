# Etude

A sketchpad for the building blocks of Western music. Place notes in a piano roll,
spread them across lanes of orchestral instruments, and hear what you wrote.

**Try it: [lukajk1.github.io/etude](https://lukajk1.github.io/etude/)** (runs entirely in
the browser; click anywhere once to allow audio).

```
npm install
npm run dev        # http://localhost:4820
```

## Sound sources

The **Sound** menu picks how instruments are made:

- **Recorded** (default): real instrument samples. Strings, woodwinds, brass and harp come
  from VSCO 2 Community Edition (CC0); piano is the Salamander Grand Piano (CC BY 3.0). See
  [public/samples/CREDITS.md](public/samples/CREDITS.md). About 8 MB, loaded on demand.
- **Synth**: the oscillator-and-filter instruments described below. Instant and light.

Timbres a source can't play (Choir, Percussion and Pure tone have no recordings) use the
synth automatically. The inspector says what's playing the selected lane.

Sources are pluggable. Each implements `SoundSource` (`src/audio/sources/types.ts`): say
which timbres it supports, load what it needs, and build a `Voice` that plays notes. Register
it in `src/audio/sources/index.ts` and it appears in the menu. The engine, export and UI don't
need changes.

## Timbres

The Synth source builds every sound in the browser (Web Audio via Tone.js).

| Timbre     | Stands in for                 | How it's made                                     |
|------------|-------------------------------|---------------------------------------------------|
| Strings    | Violins to basses             | Detuned saws, low-pass, slow attack, vibrato      |
| Woodwinds  | Flute, clarinet               | Mostly odd harmonics, soft attack, vibrato        |
| Brass      | Horns, trumpets, trombones    | Saw through a filter that opens on each attack    |
| Choir      | Voices singing "ah"           | Detuned saw ensemble through vowel formant filters |
| Piano      | Piano                         | Stretched sine partials, hammer click, damper     |
| Harp       | Harp, guitar, celesta         | Plucked: instant attack, long decay               |
| Percussion | Drum kit (General MIDI map)   | Per-hit noise and pitched-sine synthesis          |
| Pure tone  | Nothing: a reference          | A sine wave, so you hear only pitch               |

## Editing

- Click empty space to add a note; keep dragging to place it. New notes take the length of the last note you placed or resized.
- Drag a note to move it, drag its right end to resize, right-click (or right-drag) to delete.
- Shift-drag in the grid to select a box of notes; shift-click to add or remove one.
- Click a key to hear it. Numbers on the keys are scale degrees of the chosen key.
- Ctrl+wheel zooms, Shift+wheel scrolls sideways, wheel scrolls pitch.
- Click the ruler to move the start cursor; shift-drag it to set a loop.

| Key                | Action                         |
|--------------------|--------------------------------|
| Space              | Play / stop                    |
| Ctrl+Z, Ctrl+Y     | Undo, redo                     |
| Ctrl+C / X / V     | Copy, cut, paste at the cursor |
| Ctrl+D             | Duplicate selection after itself |
| Ctrl+A             | Select all notes in the lane   |
| Arrows             | Move by a semitone / snap step (Shift+Up/Down: octave) |
| Delete             | Delete selection               |
| Home               | Cursor to the start            |

## Scrubbing and the score

- The strip under the toolbar shows the whole song. Drag on it to scrub: the cursor follows,
  playback jumps along if it's running, and you hear the notes you pass over if it isn't.
- **Score** (next to the volume) swaps the lanes and piano roll for a full score: one staff per
  lane, stacked like an orchestral score, built live from the notes. Click a bar to move the
  cursor there; the score follows the playhead.
- The score is a reading of the piano roll, not an exact transcription. Notes are snapped to
  a 32nd/triplet grid, small gaps before the next note count as articulation, each staff gets
  at most two voices, and the clef is picked from the lane's range. Engraving uses
  [VexFlow](https://github.com/0xfe/vexflow) (MIT).

## Exercises

**Exercises** in the toolbar opens graded composition exercises. Unit 1 covers counterpoint
essentials in the strict style of Fux's *Gradus ad Parnassum* (1725):

| | Exercise |
|---|---|
| 1.1–1.2 | Write a cantus firmus (C major, D Dorian) |
| 1.3–1.5 | First species, note against note, above and below a given melody (including Fux's own cantus) |
| 1.6–1.7 | Second species, two notes against one, with passing tones |

The given melody sits in a locked lane; you write in your own lane. **Check my work** grades
it: errors (dissonances, parallel fifths and octaves, bad cadences, crossed voices, forbidden
leaps) and style warnings (too few contrary motions, a repeated climax, unrecovered leaps)
are listed by bar, outlined in red or amber on the piano roll, and scored out of 100. Passing
needs no errors and a score of 80 or more. Best scores are saved in the browser.

The rules live in `src/exercises/grade.ts` as plain functions over notes, and exercises are
data in `src/exercises/catalog.ts`. Later units (suspensions, four-part harmony, Romantic
harmony, piano textures, forms, orchestration) are listed in the menu as a roadmap.

## Learning aids

- The key and scale picker shades in-scale rows and numbers the scale degrees on the keyboard.
- Select notes and the inspector names them: a note and its degree, an interval, or a chord with its inversion and Roman numeral.
- The status bar names the chord sounding at the cursor, and follows the playhead during playback.
- "Show other lanes" draws the other lanes' notes faintly behind the one you're editing.

## Demos

The **Demos** menu opens ready-made projects: a building-blocks demo in C, a short
"Ode to Joy" arrangement (Beethoven 9), Mozart's *Eine kleine Nachtmusik*, Beethoven's
*Moonlight* (I and III) and *Pathétique* (II), Rachmaninoff's Prelude in G minor, Bach's
Prelude in C, and Pachelbel's Canon.
The MIDI files come from the Mutopia Project; see [public/demos/CREDITS.md](public/demos/CREDITS.md)
for their typesetters and licenses.

## Files

- **MIDI import**: one lane per MIDI track and channel. General MIDI programs map to the nearest timbre; channel 10 becomes Percussion. Only the first tempo is kept.
- **MIDI export**: format 1, 480 PPQ, one track per lane with a matching GM program.
- **WAV export**: renders the whole song offline at 44.1 kHz.
- Projects autosave in the browser and can be saved and opened as `.etude.json`.

## License

The code is [MIT](LICENSE). The bundled music and recordings keep their own licenses:
demo MIDI files in [public/demos/CREDITS.md](public/demos/CREDITS.md) (public domain,
CC BY 4.0, and CC BY-SA, whose ShareAlike terms cover those files only), and instrument
samples in [public/samples/CREDITS.md](public/samples/CREDITS.md) (CC0 and CC BY 3.0).
