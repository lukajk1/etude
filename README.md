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
rely on. Each topic is split into small checkpoints, narrow first, so you can pass the first
step before the whole thing. Each round is 20 questions; wrong answers show the reasoning
(letter names counted, half steps compared), and the round is graded against accuracy and
speed targets:

| | Checkpoints | To pass |
|---|---|---|
| 0.1 | Read notes: a treble clef, b bass clef, c both with ledger lines | 95%, median 2 s |
| 0.2 | Key signatures, core keys (up to 4 sharps or flats): a major, b major and minor | 95%, median 3 s |
| 0.3 | Scale degrees: a major, b natural minor (core keys), c all four kinds, any key | 90%, median 4 s |
| 0.4 | Name intervals: a major, minor and perfect, b with augmented and diminished | 90%, median 3 s |
| 0.5 | Build intervals: a major, minor and perfect, b with augmented and diminished | 90%, median 4 s |
| 0.6 | Name triads: a major and minor in root position, b all qualities and inversions | 90%, median 5 s |
| 0.7 | Build triads: a major and minor, b all four qualities | 90%, median 6 s |
| 0.8 | Hear the essentials (3rds, 4th, 5th, octave): a ascending, b descending, c together, d mixed | 90% |
| 0.9 | Hear all 12 intervals: a ascending, b descending, c together, d mixed | 80% |
| 0.10 | Hear chord quality: a major or minor, b all four | 90% |
| 0.11 | Hear scale degrees once the key is set: a do mi sol in C over a drone of do, b do mi sol in C, c do mi sol in any key after the same I–IV–V–I, d do mi sol after a different opening each time, e do re mi sol la (the major pentatonic), f do to sol, g all seven; after a wrong answer the note walks home to do by step | 85% |
| 0.12 | Hear melodic fragments by scale degree: a common 3-note patterns, b common 4-note patterns with la and ti, c random 5-note fragments, faster | 85% / 80% / 75% |
| 0.13 | Intervals in context, the one leap in a short melody: a the essentials, b all 12 | 85% / 75% |
| 0.14 | All keys: signatures up to 7 sharps or flats, major and minor (after 0.2b and 0.3a) | 95%, median 3 s |

The last checkpoint of each topic is the original full drill, so earlier passes still count.

Each round favors questions you haven't seen yet (`src/practice/drills/selection.ts`): every
drill counts how often you've answered each distinct question (what's shown and asked, not
the key or register of the audio), and each of the 20 slots takes the least-seen of 12
candidates, never repeating one within the round where it can avoid it.

Stages are shown numbered by level and place: **3.4** is the fourth stage of Level 3, and
**P.1** the first of Preparatory, with a tag for the skill each exercises (Reading, Ear,
Rhythm, Transcription, Harmony, Cadences). The numbers are computed from the level layout in
`src/practice/course.ts`, so adding a stage renumbers the ones after it in its level. The
numbers in the tables here (0.11c, 3.3a, T2) are the stages' internal ids, which don't change.
Each stage also shows a permanent three-character code ("APN"), a hash of its id
(`stageCode` in `course.ts`), for referring to it when the level numbers move.

The home page's **Exercises** section groups every stage by level (`src/practice/levels.ts`): the Royal Conservatory
(RCM) theory levels set the ladder, and ear skills are placed on it by first-year college
aural-skills pacing rather than RCM's ear tests, which are paced for children over a decade of
piano exams (all intervals only around Level 8); each keeps its RCM level as a tag. College
skills RCM doesn't test sit at the level they fit by difficulty. Each stage is tagged with its
unit. It also suggests an order: each stage lists what's worth passing first (for
example scales after major key signatures, intervals after scales, I-or-V after do-mi-sol),
stages within a topic go a, b, c, and no stage is listed below what it builds on. Stages that
aren't ready yet are faded and say what comes first, but stay open. The order is `PREREQS` in
`src/practice/course.ts`.

**Skill trees** (the Exercises header's button, or `#/skills/<skill>`) show each skill as a tree
(`src/practice/SkillTrees.tsx`): stages laid out by level from top to bottom, a branch per
topic, lines to what each builds on that light up in the skill's color once passed, and nodes
filled, tinted, outlined or faded for passed, tried, ready or not yet. Each skill has its own
color, which its tags and deck tiles share.

**Your plan**, at the top of the home page, lists the core stages still to pass before real
pop songs are workable (scale degrees and I, IV, V, vi by ear; note values and simple rhythmic
dictation; notes, core key signatures and triads), in that recommended order. The rest of the
exercises are learned alongside songs. The stages are `GOAL_STAGES` in `src/practice/plan.ts`.

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
| 0.2 Key signatures | signature → major key, minor key, or both at once; key → signature | up to 4 ♯ or ♭ |
| 0.3 Scales | each scale, a different degree each time | core keys, major first |
| 0.4–0.5 Name and build intervals | each interval, from different notes | major, minor and perfect |
| Intervals in semitones | interval ↔ number of semitones | 3rds, 4th, tritone, 5th, octave |
| 0.6 Name triads | each quality in each position | root position |
| 0.7 Build triads | each root and quality | natural roots |
| 0.8 Hear intervals | each interval by ear; check any set, and the answer buttons are just those | presets: 3rds, 4th and 5th, essentials, all 12 |
| 0.10–0.11 Hear chord quality, scale degrees | each quality, each degree | |
| 0.12 Melodic fragments | each common 3- and 4-note pattern, by scale degree | three-note patterns |
| 2.1 Chords in a key | I, ii, IV, V, vi by ear; check any set | presets: I and V, I IV V, add vi, all five |
| 2.2 Progressions | each common four-chord progression | I, IV and V only |
| 3.1 Note values | each note and rest value | plain values first |
| 3.2 Hear the meter | 2/4, 3/4, 4/4 or 6/8 by ear; check any set; pools for accompaniment, melody and bass, melody alone | 2 or 3, with accompaniment |
| 4.1 Cadences | authentic, half, plagal, deceptive by ear; check any set | authentic or half |
| 5.1 Non-chord tones | each kind; check any set | passing or neighbor |
| 6.1 Which chord fits? | which of I, IV and V contain each scale degree | I and V |

Each deck lets you choose which directions or groups to study. A drill's intro screen links
to its deck. Under
**intelligent review**, each card sits in a level from 0 to 6 (a Leitner box):

- A fast right answer on a card that's due moves it up a level, and its next review moves
  further out: 1 minute, then 1 day, 3, 7, 16 and 35 days. "Fast" follows the drill's speed
  target (2 s for notes, 3 s for keys, up to 6 s for building triads); for ear cards any
  right answer counts. No timer is shown.
- A right but slow answer keeps it at its level, since it isn't automatic yet.
- A miss sends it back to level 0, where it comes back within a few cards.
- The next card is a weighted draw that favors low levels and cards that are due, and the
  same card never shows twice in a row.
- New cards come in batches of five, easiest first (for key signatures, fewest accidentals
  first). The next batch opens only once the current one is nearly learned, and while a
  batch is being learned, cards you already know come up only when they're due.

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

**Unit 2, Hearing harmony**: naming chords by their role in a major key, by ear. A chord
progression sets the key, a different one each time (`src/practice/drills/keyContext.ts`:
I–IV–V–I, I–V–I, I–V7–I, ii–V–I, I–vi–IV–V–I or I–IV–I–V7–I, in block, broken or rolled
textures), then one chord plays, voiced as a pianist would (root in the
bass, the rest close above). Scale degrees from 0.11d on and melodic fragments (0.12) set
the key the same varied ways; 0.11a to 0.11c keep one I–IV–V–I cadence (in C for a and b). The checkpoints are 2.1a I or V, b I, IV or V, c adding vi, d
adding ii; then 2.2a four-chord progressions with I, IV and V, and b with vi and ii (the
'50s progression, the pop I–V–vi–IV, ii–V–I and others), naming chords 2 to 4. The
explanations point to the bass line (do, fa, sol, la, re), which gives the chord away. The
voicings and progressions are in `src/practice/drills/harmony.ts`.

**Unit 3, Rhythm and meter**, with the standard exercises from aural-skills courses:
3.1 note values (beats per note, dots and rests, completing a bar), 3.2 hearing the meter
(2, 3 or 4 beats: first over an oom-pah accompaniment, then a melody over one bass note a
bar, then a melody alone with only gentle accents, then simple against compound, 2/4, 3/4
or 6/8, with the eighths at the same speed so only their grouping differs), 3.3 rhythmic dictation (hear a bar
after a count-in, pick its notation from three near-misses) and 3.4 tapping a rhythm in
time (Space or the pad, after a bar of clicks). Each goes from quarters and halves, to
eighths, to dotted rhythms, sixteenths and syncopation. Tapping is graded against the
beat within about ±90 ms, after removing a steady delay from speakers or Bluetooth when
most taps agree on it; explanations use the usual counting, "1 e & a", with held beats in
brackets. The rhythms and counting are in `src/practice/drills/rhythm.ts`.

**Unit 4, Cadences**: four chords play from I and you name how the phrase ends, from
authentic or half, to adding plagal, to adding deceptive (`src/practice/drills/cadences.ts`).

**Unit 5, Non-chord tones**: three chords with a melody on top (shown and played); name
the second melody note by how it moves. 5.1a passing or neighbor, 5.1b adds appoggiatura
and suspension, 5.1c adds escape tone and anticipation. Examples are built from the
textbook definitions in scale degrees, over keyboard voicings of I, IV and V, and checked
so the note really is outside its chord (`src/practice/drills/nct.ts`).

**Unit 6, Harmonizing a melody**: choose I, IV or V for each note of a short melody; each
chord must contain its note, the first is I and the last two make the V–I cadence. Any
chord that fits is accepted, and the explanation lists them. 6.1a I and V, 6.1b I, IV and
V, 6.1c six-note melodies (`src/practice/drills/harmonize.ts`).

**Interval trainer** (free practice): choose any intervals and how they're played (up,
down, together, or melodic then together). Answering moves straight to the next interval
(after a moment, if you missed, to see the right one), and a line shows what the last one
was. **Stats** shows your accuracy by register (where the two notes
center: low, middle or high in the trainer's D3–D5 range), split into melodic and played
together, and says whether a register's gap from the middle is likely more than chance.

**Melodic dictation** (transcription): a new, unfamiliar melody plays, and you write it down
by ear in a piano roll, with the key, meter and first note given. Melodies are generated to
each stage's rules (`src/practice/transcription/generate.ts`): T1 two bars by step from do to
sol in C; T2 skips in the tonic chord, in C, G or F; T3 the whole major scale with dotted
rhythms, up to 2 sharps or flats; T4 minor keys with the raised 7th; T5 six bars with pickups,
syncopation and leaps up to an octave, major or minor up to 4 sharps or flats. Every melody
implies I and V, puts chord tones on downbeats, recovers from leaps by step and ends on do
from re or ti. From T2 the plays are limited (8, 6, 5, then 4, as in a dictation exam);
practice mode lifts the limit, but its checks don't count. Checking lines your notes up with
the melody even if you skip or add one, accepts a version written in another key (it grades
the intervals), and names each wrong note by scale degree ("this note is sol (5); you wrote la
(6)"), with the interval from the note before only as a hint. Once passed or revealed, the
melody is shown in notation (`MelodyStaff.tsx`); revealing also puts it in a locked lane.

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
