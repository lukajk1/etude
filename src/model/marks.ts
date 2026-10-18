import { Signal } from "./ui";

/**
 * Feedback outlines on notes, shared by the editor and anything that grades work
 * (exercises, transcription). The piano roll draws whatever is here.
 */
export type MarkSeverity = "error" | "warning";

/** Notes to outline, by id. */
export const marks = new Signal<Map<string, MarkSeverity>>(new Map());

/** Notes to draw more strongly: the issue the user is looking at. */
export const focusedNotes = new Signal<string[]>([]);
