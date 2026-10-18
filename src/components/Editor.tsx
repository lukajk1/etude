import { lazy, Suspense, useRef, useState } from "react";
import { useUi } from "../model/ui";
import { Lanes } from "./Lanes";
import { PianoRoll } from "./PianoRoll";

const Score = lazy(() => import("./Score"));

/** Drag handle between the lanes and the piano roll. */
function useSplit(initial: number) {
  const [top, setTop] = useState(initial);
  const drag = useRef<{ y: number; top: number } | null>(null);
  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { y: e.clientY, top };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current) return;
      const next = drag.current.top + e.clientY - drag.current.y;
      setTop(Math.max(90, Math.min(Math.max(150, window.innerHeight - 260), next)));
    },
    onPointerUp: () => {
      drag.current = null;
    },
  };
  return { top, handle };
}

/**
 * The note editor: lanes above the piano roll, or the full score, depending on the
 * view. Used by Studio and by Practice Room exercises.
 */
export function Editor({ lanesHeight }: { lanesHeight?: number }) {
  const { view } = useUi();
  const { top, handle } = useSplit(lanesHeight ?? Math.max(150, Math.round(window.innerHeight * 0.3)));

  if (view === "score") {
    return (
      <Suspense fallback={<div className="score score-loading">Loading the score…</div>}>
        <Score />
      </Suspense>
    );
  }
  return (
    <div className="workspace" style={{ gridTemplateRows: `${top}px 6px 1fr` }}>
      <Lanes />
      <div className="splitter" role="separator" aria-orientation="horizontal" {...handle} />
      <PianoRoll />
    </div>
  );
}
