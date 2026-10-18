import { lazy, Suspense, useEffect } from "react";
import { SoundControls, TransportButtons, ViewToggle } from "../components/Controls";
import { Editor } from "../components/Editor";
import { Overview } from "../components/Overview";
import { StatusBar } from "../components/StatusBar";
import { useEditorShortcuts } from "../lib/shortcuts";
import { preparePiano } from "../audio/live";
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

export function PracticeApp() {
  const route = useRoute();
  useEffect(() => {
    document.title = "Etude Practice Room";
    window.scrollTo(0, 0);
  }, [route]);

  switch (route.kind) {
    case "drill":
      return <DrillScreen key={route.id} id={route.id} />;
    case "exercise":
      return <ExerciseScreen key={route.id} id={route.id} />;
    case "transcribe":
      return <TranscriptionScreen key={route.id} id={route.id} />;
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
