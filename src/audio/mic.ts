/**
 * The microphone, for the singing stages: the live input and a pitch detector for it. The
 * stream stays open between questions (closing a few seconds after the last user lets go),
 * so a round doesn't reopen it, or flash the browser's recording indicator, every question.
 */

let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
let analyser: AnalyserNode | null = null;
/** The device the open stream came from ("" for the system default). */
let openedWith = "";
let opening: Promise<AnalyserNode> | null = null;
let users = 0;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

const MIC_KEY = "etude.mic";

/** The microphone chosen in the sing pad, or "" for the system default. */
export function chosenMic(): string {
  try {
    return localStorage.getItem(MIC_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Use this microphone from now on ("" for the system default); the next `openMic` switches to it. */
export function chooseMic(id: string) {
  try {
    localStorage.setItem(MIC_KEY, id);
  } catch {
    // Remembered for this visit only, through the open stream.
  }
}

/** The microphones the browser knows of. Their names show only once the mic has been allowed. */
export async function listMics(): Promise<{ id: string; label: string }[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
}

/** The device the open stream really comes from (the default when the chosen one was missing), or "" when closed. */
export function currentMic(): string {
  return stream?.getAudioTracks()[0]?.getSettings().deviceId ?? "";
}

function shutDown() {
  stream?.getTracks().forEach((t) => t.stop());
  void ctx?.close();
  [stream, ctx, analyser] = [null, null, null];
}

async function getStream(id: string): Promise<MediaStream> {
  // The browser's voice processing (echo cancelling, noise suppression, gain riding) bends pitch and swallows held notes.
  const voice = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (!id) return navigator.mediaDevices.getUserMedia({ audio: voice });
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { ...voice, deviceId: { exact: id } } });
  } catch (err) {
    // The chosen mic is unplugged or gone: fall back to the default.
    if (err instanceof DOMException && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) return navigator.mediaDevices.getUserMedia({ audio: voice });
    throw err;
  }
}

/** Open the microphone (asking permission the first time) and return an analyser on it. */
export async function openMic(): Promise<AnalyserNode> {
  users++;
  clearTimeout(closeTimer);
  if (analyser && openedWith === chosenMic()) return analyser;
  if (analyser) shutDown();
  opening ??= (async () => {
    const id = chosenMic();
    stream = await getStream(id);
    openedWith = id;
    ctx = new AudioContext();
    const a = ctx.createAnalyser();
    a.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(a);
    analyser = a;
    return a;
  })();
  try {
    return await opening;
  } catch (err) {
    users--;
    throw err;
  } finally {
    opening = null;
  }
}

/** Let go of the microphone; it closes once nobody has used it for a few seconds. */
export function closeMic() {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (users === 0) shutDown();
  }, 4000);
}

/** Lowest and highest pitches sung: a low bass to a high soprano. */
const MIN_HZ = 65;
const MAX_HZ = 1100;
/** Quieter than this (RMS) counts as silence. */
const GATE = 0.006;

/**
 * The pitch in a frame of audio, as a MIDI number with cents (60.25 is C4, a quarter tone
 * sharp), or null when nothing pitched is heard. YIN: the lag at which the signal best
 * matches itself is one period.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  if (levelOf(buf) < GATE) return null;

  const n = Math.floor(buf.length / 2);
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.min(n - 1, Math.ceil(sampleRate / MIN_HZ));
  // The difference at each lag, normalized by its running mean so short lags don't win by default.
  const d = new Float32Array(maxLag + 2);
  let running = 0;
  d[0] = 1;
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const x = buf[i] - buf[i + lag];
      s += x * x;
    }
    running += s;
    d[lag] = running ? (s * lag) / running : 1;
  }
  // The first dip under the threshold, followed down to its bottom.
  let lag = -1;
  for (let l = minLag; l <= maxLag; l++) {
    if (d[l] < 0.12) {
      while (l + 1 <= maxLag && d[l + 1] < d[l]) l++;
      lag = l;
      break;
    }
  }
  if (lag < 0) return null;
  // Fit a parabola through the dip for a lag between samples.
  const [a, b, c] = [d[lag - 1], d[lag], d[lag + 1]];
  const shift = a + c - 2 * b ? (a - c) / (2 * (a + c - 2 * b)) : 0;
  const hz = sampleRate / (lag + shift);
  return 69 + 12 * Math.log2(hz / 440);
}

/** How loud a frame is (RMS, 0 to 1). */
function levelOf(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/** The analyser's current frame: its pitch (null when nothing pitched is heard), and how loud it is, 0 to 1 on a rough dB scale. */
export function readPitch(a: AnalyserNode, buf: Float32Array<ArrayBuffer>): { pitch: number | null; level: number } {
  // A context opened without a click or key press starts suspended, hearing nothing.
  if (a.context.state === "suspended") void (a.context as AudioContext).resume();
  a.getFloatTimeDomainData(buf);
  // -60 dB (a quiet room) to -10 dB (singing close to the mic).
  const db = 20 * Math.log10(levelOf(buf) + 1e-9);
  return { pitch: detectPitch(buf, a.context.sampleRate), level: Math.max(0, Math.min(1, (db + 60) / 50)) };
}
