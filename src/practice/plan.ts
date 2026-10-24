/**
 * The study plan on the Practice Room home page: the core stages to pass before real pop
 * songs are workable (transcribing them by ear and reading simple lead sheets). The rest
 * of the course is learned alongside songs. The page lists the ones not yet passed, in
 * recommended order (by level, and never before what a stage builds on). Stages are
 * course numbers.
 */

export const PLAN_GOAL = "The core for starting on real pop songs: transcribing them by ear and reading simple lead sheets. Everything else can come alongside songs.";

export const GOAL_STAGES = [
  // Hearing melodies: scale degrees, for melodies and bass lines.
  "0.11a", "0.11b", "0.11c", "0.11d", "0.11e", "0.11f", "0.11g",
  // Hearing harmony: I, IV, V and vi.
  "2.1a", "2.1b", "2.1c",
  // Rhythm: note values, and dictation with quarters and eighths.
  "3.1a", "3.1b", "3.3a", "3.3b",
  // Reading: notes, core key signatures, and the chords of the commonest keys (C, G, F, D).
  "0.1a", "0.1b", "0.1c", "0.2a", "0.2b", "0.6a", "0.6b", "0.6c", "0.6d",
];

/** Units and decks folded away while the focus is fundamentals, pop transcription and reading. */
export const TUCKED_UNITS = ["Counterpoint essentials", "Non-chord tones", "Harmonizing a melody"];
export const TUCKED_DECKS = ["nct", "chord-fit"];
