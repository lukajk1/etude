import { Signal } from "../model/ui";

/** The drill open in place of the editor, if any. */
export const activeDrill = new Signal<string | null>(null);
