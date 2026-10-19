# Etude

A sketchpad and practice room for the building blocks of Western music. Two apps share one
codebase:

- **Etude Studio:** place notes in a piano roll, spread them across lanes of orchestral
  instruments, read them back as a score, and hear what you wrote.
  **[lukajk1.github.io/etude](https://lukajk1.github.io/etude/)**
- **Etude Practice Room:** timed drills, spaced-review flashcards, ear training,
  transcription and graded counterpoint exercises for the foundations of tonal music.
  **[lukajk1.github.io/etude/practice](https://lukajk1.github.io/etude/practice/)**

Both run entirely in the browser (click anywhere once to allow audio).

```
npm install
npm run dev        # Studio at http://localhost:4820, Practice Room at /practice/
```

### Code layout

| Folder | What's in it |
|---|---|
| `src/studio/` | Studio only: its toolbar, file menu, demos |
| `src/practice/` | Practice Room only: home page, drills, flashcards, transcription, counterpoint exercises, graders |
| `src/components/` | Shared editor: piano roll, lanes, score, overview, transport and sound controls |
| `src/audio/`, `src/model/`, `src/theory/`, `src/notation/`, `src/midi/`, `src/lib/` | Shared engine: sound sources, project model, theory and spelling, engraving, MIDI |

Each app keeps its own autosaved project (they share the sound and volume settings), so an
exercise in progress never overwrites what you're composing in Studio.

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

## Practice Room

The Practice Room's home page lists every unit with your progress, and suggests what to do
next. Best scores are saved in the browser.

**Unit 0, Foundations** is timed drills for the fundamentals that counterpoint and harmony
rely on. Each round is 20 questions; wrong answers show the reasoning (letter names counted,
half steps compared), and the round is graded against accuracy and speed targets:

| | Drill | To pass |
|---|---|---|
| 0.1 | Read notes (treble and bass clef, ledger lines) | 95%, median 2 s |
| 0.2 | Key signatures, the 18 core keys (up to 4 ♯ or ♭), both directions | 95%, median 3 s |
| 0.3 | Scale degrees in major and the three minor forms | 90%, median 4 s |
| 0.4 | Name intervals on the staff | 90%, median 3 s |
| 0.5 | Build intervals (spell the note above) | 90%, median 4 s |
| 0.6 | Name triads in any inversion | 90%, median 5 s |
| 0.7 | Build triads (spell the 3rd and 5th) | 90%, median 6 s |
| 0.8 | Hear intervals: P4, P5, octave, 3rds | 90% |
| 0.9 | Hear intervals: all within an octave | 80% |
| 0.10 | Hear chord quality | 90% |
| 0.11 | Hear scale degrees after a cadence | 85% |
| 0.12 | Key signatures, all 30 keys, for later | 95%, median 3 s |

Answer by clicking, or with the keyboard: letters for notes, 1–7 for scale degrees, Enter
to continue, R to replay audio. Questions and answers are generated in `src/drills/`,
with spelling handled properly (A♯ and B♭ are different answers).

**Flashcards**, with spaced review in the style of Anki. Every drill has a deck, plus one
for interval sizes in semitones. A card is one fact (a line or space on the staff, a key, a
scale, an interval, a triad, a chord quality by ear), and each showing is a fresh question
about it from the drill's own generator, so a weak fact comes back without the question
repeating:

| Deck | Cards | Smaller pool to start |
|---|---|---|
| 0.1 Read notes | each staff position, treble and bass | on the staff, no ledger lines |
| 0.2 Key signatures | signature → major or minor key, key → signature | up to 4 ♯ or ♭ |
| 0.3 Scales | each scale, a different degree each time | core keys, major first |
| 0.4–0.5 Name and build intervals | each interval, from different notes | major, minor and perfect |
| Intervals in semitones | interval ↔ number of semitones | 3rds, 4th, tritone, 5th, octave |
| 0.6 Name triads | each quality in each position | root position |
| 0.7 Build triads | each root and quality | natural roots |
| 0.8 Hear intervals | each interval by ear; check any set, and the answer buttons are just those | presets: 3rds, 4th and 5th, essentials, all 12 |
| 0.10–0.11 Hear chord quality, scale degrees | each quality, each degree | |

Each deck lets you choose which directions or groups to study. A drill's intro screen links
to its deck. Under
**intelligent review**, each card sits in a level from 0 to 6 (a Leitner box):

- A fast right answer on a card that's due moves it up a level, and its next review moves
  further out: 1 minute, then 1 day, 3, 7, 16 and 35 days. "Fast" follows the drill's speed
  target (2 s for notes, 3 s for keys, up to 6 s for building triads); for ear cards any
  right answer counts. No timer is shown.
- A right but slow answer keeps it at its level, since it isn't automatic yet.
- A miss sends it back to level 0, where it comes back within a few cards.
- The next card is a weighted draw that favors low levels and cards that are due. New cards
  come in a few at a time (no more than five still being learned), and the same card never
  shows twice in a row.

A grid shows every card shaded by level, so you can see which ones to drill. **Random** order
skips the scheduling.

You can answer by picking from buttons, or in **recall** mode, Anki-style: think of the
answer, press Space to reveal it, then grade yourself with 1 (Again) or 2 (Pass). The time
to reveal counts as your answer time.

The scheduler is `src/practice/cards/srs.ts`; decks are in `src/practice/cards/`, listed in
`decks.ts`.

**Saving.** All progress (drill scores, flashcards, transcription stats, the autosaved
projects) is kept in the browser's local storage, which lasts until you clear the site's
data. The app asks the browser to keep it even when disk space runs low. For a second copy,
**Back up to a file** at the bottom of the Practice Room home page saves everything as one
JSON file, and **Restore from a file** loads it back, in this browser or another one. The
local dev server and the live site are separate sites, so each has its own progress.

**Interval trainer** (free practice): choose any intervals and how they're played (up,
down, together, or melodic then together). Answering moves straight to the next interval
(after a moment, if you missed, to see the right one), and a line shows what the last one
was. **Stats** shows your accuracy by register (where the two notes
center: low, middle or high in the trainer's D3–D5 range), split into melodic and played
together, and says whether a register's gap from the middle is likely more than chance.

**Transcription** (melodic dictation): a melody plays, and you write it down by ear in a
piano roll, in C major with the first note given. The seven melodies (Hot Cross Buns, Mary Had
a Little Lamb, Ode to Joy, Twinkle, Jingle Bells, Frère Jacques, Amazing Grace) are ordered so
each adds only an interval or two. Checking lines your notes up with the melody even if you
skip or add one, accepts a version written in another key (it grades the intervals), and
explains each wrong note in interval terms. It also tracks which intervals you miss most and
shows them on the home page. You can reveal the answer in a locked lane to compare.

**Unit 1** covers counterpoint essentials in the strict style of Fux's *Gradus ad
Parnassum* (1725):

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
