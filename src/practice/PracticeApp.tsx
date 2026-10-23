import { lazy, Suspense, useEffect } from "react";
import { SoundControls, TransportButtons, ViewToggle } from "../components/Controls";
import { Editor } from "../components/Editor";
import { Overview } from "../components/Overview";
import { StatusBar } from "../components/StatusBar";
import { useEditorShortcuts } from "../lib/shortcuts";
import { preparePiano, stopAll } from "../audio/live";
import { getDeck } from "./cards/decks";
import { DRILLS } from "./drills/catalog";
import { getExercise } from "./exercises/catalog";
import { currentExercise, openExercise } from "./exercises/state";
import { ExercisePanel } from "./ExercisePanel";
import { Home } from "./Home";
import { go, useRoute } from "./route";
import { getMelody } from "./transcription/melodies";
import { openTranscription } from "./transcription/state";
import { TranscriptionPanel } from "./TranscriptionPanel";
import { useProject } from "../model/store";

const DrillView = lazy(() => import("./DrillView"));
const CardsView = lazy(() => import("./CardsView"));
const IntervalTrainer = lazy(() => import("./IntervalTrainer"));

function Header({ title, editor = false }: { title?: string; editor?: boolean }) {
  return (
    <header className="toolbar">
      <a className="brand brand-link" href="#" onClick={(e) => (e.preventDefault(), go({ kind: "home" }))} title="Practice Room home">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="22" height="22" />
        <span>Etude Practice Room</span>
      </a>
      {title && <span className="pr-crumb">{title}</span>}
      {editor && (
        <>
          <TransportButtons />
          <ViewToggle />
        </>
      )}
      <SoundControls />
      <a className="btn pr-studio-link" href={import.meta.env.BASE_URL}>
        Open Studio
      </a>
    </header>
  );
}

function ExerciseScreen({ id }: { id: string }) {
  useEditorShortcuts();
  const ex = getExercise(id);
  useEffect(() => {
    if (ex) openExercise(ex);
    else go({ kind: "home" });
  }, [ex]);
  const project = useProject();
  if (!ex || currentExercise(project)?.id !== id) return null;
  return (
    <div className="app" style={{ gridTemplateRows: "auto auto 1fr auto" }}>
      <Header title={`${ex.number} ${ex.title}`} editor />
      <Overview />
      <div className="main">
        <Editor />
        <ExercisePanel ex={ex} />
      </div>
      <StatusBar />
    </div>
  );
}

function TranscriptionScreen({ id }: { id: string }) {
  useEditorShortcuts();
  const melody = getMelody(id);
  useEffect(() => {
    if (melody) {
      openTranscription(melody);
      preparePiano();
    } else go({ kind: "home" });
  }, [melody]);
  const project = useProject();
  if (!melody || project.exercise?.id !== id) return null;
  return (
    <div className="app" style={{ gridTemplateRows: "auto 1fr auto" }}>
      <Header title={`${melody.number} ${melody.title}`} editor />
      <div className="main">
        <Editor lanesHeight={96} />
        <TranscriptionPanel melody={melody} />
      </div>
      <StatusBar />
    </div>
  );
}

function DrillScreen({ id }: { id: string }) {
  const drill = DRILLS.find((d) => d.id === id);
  useEffect(() => {
    if (!drill) go({ kind: "home" });
  }, [drill]);
  if (!drill) return null;
  return (
    <div className="app" style={{ gridTemplateRows: "auto 1fr" }}>
      <Header title={`${drill.number} ${drill.title}`} />
      <div className="main">
        <Suspense fallback={<div className="drill">Loading…</div>}>
          <DrillView id={id} />
        </Suspense>
      </div>
    </div>
  );
}

function CardsScreen({ id }: { id: string }) {
  const deck = getDeck(id);
  useEffect(() => {
    if (!deck) go({ kind: "home" });
  }, [deck]);
  if (!deck) return null;
  return (
    <div className="app" style={{ gridTemplateRows: "auto 1fr" }}>
      <Header title={`${deck.title} flashcards`} />
      <div className="main">
        <Suspense fallback={<div className="drill">Loading…</div>}>
          <CardsView def={deck} />
        </Suspense>
      </div>
    </div>
  );
}

function TrainerScreen({ id }: { id: string }) {
  useEffect(() => {
    if (id !== "intervals") go({ kind: "home" });
  }, [id]);
  if (id !== "intervals") return null;
  return (
    <div className="app" style={{ gridTemplateRows: "auto 1fr" }}>
      <Header title="Interval trainer" />
      <div className="main">
        <Suspense fallback={<div className="drill">Loading…</div>}>
          <IntervalTrainer />
        </Suspense>
      </div>
    </div>
  );
}

export function PracticeApp() {
  const route = useRoute();
  useEffect(() => {
    document.title = "Etude Practice Room";
    window.scrollTo(0, 0);
    // Leaving a screen silences it, including anything it scheduled to play later.
    return stopAll;
  }, [route]);
  // Nothing here is worth hearing from a background tab.
  useEffect(() => {
    const onHide = () => document.hidden && stopAll();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  switch (route.kind) {
    case "drill":
      return <DrillScreen key={route.id} id={route.id} />;
    case "exercise":
      return <ExerciseScreen key={route.id} id={route.id} />;
    case "transcribe":
      return <TranscriptionScreen key={route.id} id={route.id} />;
    case "cards":
      return <CardsScreen key={route.id} id={route.id} />;
    case "train":
      return <TrainerScreen key={route.id} id={route.id} />;
    default:
      return (
        <div className="app pr-app" style={{ gridTemplateRows: "auto 1fr" }}>
          <Header />
          <div className="pr-scroll">
            <Home />
          </div>
        </div>
      );
  }
}
