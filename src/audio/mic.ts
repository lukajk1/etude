/**
 * The microphone, for the singing stages: the live input and a pitch detector for it. The
 * stream stays open between questions (closing a few seconds after the last user lets go),
 * so a round doesn't reopen it, or flash the browser's recording indicator, every question.
 */

let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
let analyser: AnalyserNode | null = null;
let opening: Promise<AnalyserNode> | null = null;
let users = 0;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

/** Open the microphone (asking permission the first time) and return an analyser on it. */
export async function openMic(): Promise<AnalyserNode> {
  users++;
  clearTimeout(closeTimer);
  if (analyser) return analyser;
  opening ??= (async () => {
    // The browser's voice processing (echo cancelling, noise suppression, gain riding) bends pitch and swallows held notes.
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
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
    if (users > 0) return;
    stream?.getTracks().forEach((t) => t.stop());
    void ctx?.close();
    [stream, ctx, analyser] = [null, null, null];
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
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  if (Math.sqrt(sum / buf.length) < GATE) return null;

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

/** The analyser's current frame, as a pitch. */
export function readPitch(a: AnalyserNode, buf: Float32Array<ArrayBuffer>): number | null {
  a.getFloatTimeDomainData(buf);
  return detectPitch(buf, a.context.sampleRate);
}
