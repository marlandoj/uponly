// Tiny chiptune synth: every sound is synthesized with the Web Audio API — no
// audio files. The AudioContext is created lazily on the first sound, and every
// entry point is a silent no-op when audio is unavailable (SSR, old browsers,
// blocked contexts). Nothing here ever throws.

export const MUTE_KEY = "cq-muted";
/** Master volume for effects — kept low so the juice stays subtle. */
export const MASTER_GAIN = 0.15;
/** Background loop volume — barely-there. */
export const MUSIC_GAIN = 0.04;
export const MUSIC_BPM = 100;

type Wave = OscillatorType;
type Note = { hz: number; at: number; dur: number; wave?: Wave; gain?: number };

/** MIDI note number → frequency in Hz (A4 = 69 = 440Hz). */
export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

// C5 E5 G5 C6 power-up, square lead doubled by a triangle an octave down.
const START_ARP = [72, 76, 79, 84];
export const QUEST_START: Note[] = START_ARP.flatMap((m, i) => [
  { hz: midiHz(m), at: i * 0.07, dur: i === 3 ? 0.3 : 0.09, wave: "square" as const, gain: 0.5 },
  { hz: midiHz(m - 12), at: i * 0.07, dur: i === 3 ? 0.3 : 0.09, wave: "triangle" as const, gain: 0.7 },
]);

// Victory jingle: G4 C5 E5 G5 · E5 G5 — C6 (held), over a little bass walk.
const JINGLE: [number, number, number][] = [
  // [midi, start (beats), length (beats)] at ~0.11s per beat
  [67, 0, 1], [72, 1, 1], [76, 2, 1], [79, 3, 2],
  [76, 5, 1], [79, 6, 1], [84, 7, 3], [83, 10, 1], [84, 11, 5],
];
const BEAT = 0.11;
export const QUEST_COMPLETE: Note[] = [
  ...JINGLE.map(([m, at, len]) => ({ hz: midiHz(m), at: at * BEAT, dur: len * BEAT * 0.9, wave: "square" as const, gain: 0.45 })),
  ...[48, 55, 52, 60].map((m, i) => ({ hz: midiHz(m), at: i * 4 * BEAT, dur: 4 * BEAT * 0.9, wave: "triangle" as const, gain: 0.8 })),
];

// Background loop: A-minor bassline (Am · F · G · Em), one note per eighth,
// with a sparse square arpeggio on top. null = rest.
const BASS = [45, 45, 52, 45, 41, 41, 48, 41, 43, 43, 50, 43, 40, 40, 47, 40];
const ARP: (number | null)[] = [
  69, null, null, 72, null, null, 76, null,
  null, null, 72, null, null, null, null, null,
  67, null, null, 71, null, null, 74, null,
  null, null, 71, null, 64, null, null, null,
];
export const MUSIC_STEPS = ARP.length;
/** Notes on one step of the loop (bass changes chord every 8 steps). */
export function musicStep(step: number): number[] {
  const i = step % MUSIC_STEPS;
  const bass = BASS[Math.floor(i / 8) * 4 + (i % 4)];
  const arp = ARP[i];
  return arp == null ? [bass] : [bass, arp];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let unavailable = false;
let muted: boolean | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicWanted = false;
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (ctx || unavailable) return ctx;
  try {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) {
      unavailable = true;
      return null;
    }
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_GAIN;
    musicBus.connect(ctx.destination);
  } catch {
    unavailable = true;
    ctx = master = musicBus = null;
  }
  return ctx;
}

function play(notes: Note[], bus: "fx" | "music" = "fx") {
  if (isMuted()) return;
  try {
    const ac = audio();
    const out = bus === "fx" ? master : musicBus;
    if (!ac || !out) return;
    if (ac.state === "suspended") void ac.resume().catch(() => {});
    const t0 = ac.currentTime + 0.01;
    for (const n of notes) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      const start = t0 + n.at;
      const end = start + n.dur;
      osc.type = n.wave ?? "square";
      osc.frequency.value = n.hz;
      // Quick attack, exponential tail — no clicks.
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(n.gain ?? 0.5, start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(env).connect(out);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    // Audio is decoration; never let it break a tap.
  }
}

/** UI blip for buttons. */
export function click() {
  play([{ hz: 660, at: 0, dur: 0.06, wave: "square", gain: 0.25 }]);
}

/** Rising power-up arpeggio. */
export function questStart() {
  play(QUEST_START);
}

/** Victory jingle. */
export function questComplete() {
  play(QUEST_COMPLETE);
}

export function isMuted(): boolean {
  if (muted === null) {
    try {
      muted = typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

/** Flips mute, persists it, and stops/starts the background loop to match. */
export function toggleMute(): boolean {
  muted = !isMuted();
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode etc. — mute still applies for this page view.
  }
  if (muted) haltMusic();
  else if (musicWanted) runMusic();
  listeners.forEach((fn) => fn());
  return muted;
}

/** Notified whenever mute changes (for useSyncExternalStore). */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function runMusic() {
  if (musicTimer || isMuted()) return;
  if (!audio()) return;
  let step = 0;
  const stepSec = 60 / MUSIC_BPM / 2; // eighth notes
  const tick = () => {
    const notes = musicStep(step++);
    play(
      notes.map((m, i) => ({
        hz: midiHz(m),
        at: 0,
        dur: i === 0 ? stepSec * 0.9 : stepSec * 0.6,
        wave: i === 0 ? "triangle" : "square",
        gain: i === 0 ? 0.9 : 0.35,
      })),
      "music",
    );
  };
  tick();
  musicTimer = setInterval(tick, stepSec * 1000);
}

function haltMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

/** Start the background loop (call from a user gesture). Respects mute. */
export function startMusic() {
  musicWanted = true;
  runMusic();
}

/** Stop the background loop (e.g. tab hidden). */
export function stopMusic() {
  musicWanted = false;
  haltMusic();
}

export const isMusicPlaying = () => musicTimer !== null;

/** Test hook: forget the cached context and mute state. */
export function _reset() {
  haltMusic();
  try {
    void ctx?.close();
  } catch {}
  ctx = master = musicBus = null;
  unavailable = false;
  muted = null;
  musicWanted = false;
  listeners.clear();
}
