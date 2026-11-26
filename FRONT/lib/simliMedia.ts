import type { LogLevel as LogLevelT, SimliClient } from "simli-client";

/** 100ms at 16 kHz. Shorter than Simli's default, so the mouth stays with the voice. */
const MOUTH_SAMPLES = 1600;

export async function createSimli(token: string, video: HTMLVideoElement, audio: HTMLAudioElement, _ice: RTCIceServer[]) {
  const { SimliClient, LogLevel } = await import("simli-client");
  const quiet = LogLevel.ERROR as LogLevelT;
  // LiveKit is relayed by Simli. A direct peer connection often never paints,
  // and the call then stays on the still photo while the voice keeps going.
  return new SimliClient(token, video, audio, null, quiet, "livekit", "websockets", "wss://api.simli.ai", MOUTH_SAMPLES);
}

/**
 * How far the face runs behind the voice. Simli sends back the audio it lip-synced, in step with the video,
 * so the gap between a phrase starting in the original voice and in Simli's copy is the delay to apply.
 * Reports the median of recent phrases, in seconds.
 */
export function measureLag(voice: MediaStreamTrack, face: MediaStream, onLag: (seconds: number) => void) {
  const ctx = new AudioContext();
  const meter = (stream: MediaStream) => {
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    return () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      return Math.sqrt(sum / buf.length);
    };
  };
  const voiceLevel = meter(new MediaStream([voice]));
  const faceLevel = meter(face);
  const LOUD = 0.02;
  const QUIET_MS = 300;
  const state = { voice: { quietSince: 0, loud: false }, face: { quietSince: 0, loud: false } };
  const voiceOnsets: number[] = [];
  const lags: number[] = [];

  const onset = (s: { quietSince: number; loud: boolean }, level: number, now: number) => {
    if (level >= LOUD) {
      const fresh = !s.loud && now - s.quietSince >= QUIET_MS;
      s.loud = true;
      return fresh;
    }
    if (s.loud) {
      s.loud = false;
      s.quietSince = now;
    }
    return false;
  };

  const timer = setInterval(() => {
    const now = performance.now();
    if (onset(state.voice, voiceLevel(), now)) voiceOnsets.push(now);
    if (onset(state.face, faceLevel(), now)) {
      const match = voiceOnsets.filter((t) => now - t > 0 && now - t < 2000).shift();
      voiceOnsets.length = 0;
      if (match !== undefined) {
        lags.push((now - match) / 1000);
        if (lags.length > 5) lags.shift();
        // One phrase is a noisy guess. Wait for three, then the median stays put.
        if (lags.length < 3) return;
        const sorted = [...lags].sort((a, b) => a - b);
        onLag(sorted[Math.floor(sorted.length / 2)]);
      }
    }
  }, 10);

  return () => {
    clearInterval(timer);
    void ctx.close().catch(() => {});
  };
}

/**
 * Simli replaces the video track when the office background arrives. Treating that
 * swap as "the face ended" hides the live person and leaves the still photo on top.
 * Report live while a frame is actually showing, and only report gone after it stays gone.
 */
export function followVideo(el: HTMLVideoElement, onLive: (live: boolean) => void) {
  let last: boolean | null = null;
  let goneAt = 0;
  const tick = () => {
    const stream = el.srcObject;
    const live = stream instanceof MediaStream
      && stream.getVideoTracks().some((t) => t.readyState === "live")
      && (el.videoWidth > 0 || el.readyState >= 2);
    if (live) {
      goneAt = 0;
      if (last !== true) { last = true; onLive(true); }
      return;
    }
    if (last !== true) return;
    if (!goneAt) goneAt = performance.now();
    if (performance.now() - goneAt >= 800) { last = false; goneAt = 0; onLive(false); }
  };
  const timer = setInterval(tick, 200);
  return () => clearInterval(timer);
}

const open = new Set<SimliClient>();
let closesOnLeave = false;

/**
 * The Simli plan allows one live face at a time. A refresh or closed tab must hand the
 * slot back right away, otherwise the next call is refused until Simli times the old one out.
 */
function closeOnLeave() {
  if (closesOnLeave || typeof window === "undefined") return;
  closesOnLeave = true;
  window.addEventListener("pagehide", () => {
    open.forEach((c) => { void c.stop().catch(() => {}); });
    open.clear();
  });
}

/**
 * Connect a face, waiting for the account's single slot if another session still holds it.
 * Returns null if it never connects, so the caller keeps the still portrait instead of a black frame.
 */
export async function startFace(
  getToken: () => Promise<{ token: string; ice: RTCIceServer[] } | null>,
  video: HTMLVideoElement,
  audio: HTMLAudioElement,
  isStopped: () => boolean
): Promise<SimliClient | null> {
  closeOnLeave();
  for (let attempt = 0; attempt < 12; attempt++) {
    const got = await getToken();
    if (!got || isStopped()) return null;
    const client = await createSimli(got.token, video, audio, got.ice);
    if (isStopped()) { void client.stop().catch(() => {}); return null; }
    client.on("start", () => { if (!isStopped()) void video.play().catch(() => {}); });
    client.on("error", (detail: string) => console.warn("[simli]", detail));
    open.add(client);
    try {
      await client.start();
      ignoreClosingSocket(client);
      return client;
    } catch (e) {
      open.delete(client);
      void client.stop().catch(() => {});
      if (isStopped()) return null;
      const busy = /RATE/i.test(String(e));
      if (!busy && attempt >= 1) { console.warn("[simli] unavailable", e); return null; }
      await new Promise((r) => setTimeout(r, busy ? 3000 : 1500));
    }
  }
  return null;
}

export async function stopFace(client: SimliClient) {
  open.delete(client);
  await client.stop().catch(() => {});
}

let seat: Promise<void> = Promise.resolve();

/**
 * One face at a time. A new call waits until the previous session has actually closed,
 * otherwise Simli keeps the old one and the new screen stays on the still photo.
 */
export function holdFace(run: (stopped: () => boolean) => Promise<(() => Promise<void>) | void>): () => void {
  let stopped = false;
  let open = () => {};
  const untilStop = new Promise<void>((resolve) => { open = resolve; });
  seat = seat.then(async () => {
    if (stopped) return;
    const stop = await run(() => stopped);
    await untilStop;
    if (typeof stop === "function") {
      await Promise.race([
        stop().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
    }
  }).catch(() => {});
  return () => {
    stopped = true;
    open();
  };
}

/** Simli's client throws if a mouth chunk arrives while its socket is closing. */
export function ignoreClosingSocket(client: SimliClient) {
  const sig = (client as unknown as {
    connection?: { signalingConnection?: { sendAudioData?: (data: Uint8Array) => void } };
  }).connection?.signalingConnection;
  if (!sig?.sendAudioData) return;
  const send = sig.sendAudioData.bind(sig);
  sig.sendAudioData = (data) => {
    try { send(data); } catch { /* socket already closing */ }
  };
}

/**
 * Play the avatar's own audio element. That stream is the one locked to the mouth.
 * If the browser blocks it, `onBlocked` receives the stream so the call can play it another way.
 */
export function hearMouth(el: HTMLMediaElement, onPlaying: () => void, onBlocked: (voice: MediaStream) => void) {
  const proto = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "srcObject");
  if (!proto?.get || !proto.set || Object.prototype.hasOwnProperty.call(el, "srcObject")) return;
  const set = proto.set;
  Object.defineProperty(el, "srcObject", {
    configurable: true,
    get() { return proto.get!.call(this); },
    set(value: MediaProvider | null) {
      set.call(el, value);
      if (!(value instanceof MediaStream) || !value.getAudioTracks().length) return;
      const voice = new MediaStream(value.getAudioTracks());
      el.muted = false;
      el.volume = 1;
      void el.play().then(() => onPlaying()).catch(() => onBlocked(voice));
    }
  });
}

/**
 * Simli assigns the spoken stream itself and unmutes it. Keep that speaker off, and never let the video element carry audio.
 * `onStream` still receives what Simli sent, so its audio can be used to measure how late the face is.
 */
export function keepSilent(el: HTMLMediaElement, videoOnly: boolean, onStream?: (stream: MediaStream) => void) {
  const proto = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "srcObject");
  if (proto?.get && proto.set && !Object.prototype.hasOwnProperty.call(el, "srcObject")) {
    const set = proto.set;
    Object.defineProperty(el, "srcObject", {
      configurable: true,
      get() { return proto.get!.call(this); },
      set(value: MediaProvider | null) {
        if (value instanceof MediaStream) onStream?.(value);
        const stream = videoOnly && value instanceof MediaStream ? new MediaStream(value.getVideoTracks()) : value;
        set.call(el, stream);
        el.muted = true;
        el.volume = 0;
        if (videoOnly) void el.play?.().catch(() => {});
      }
    });
  }
  const force = () => {
    if (!el.muted || el.volume !== 0) {
      el.muted = true;
      el.volume = 0;
    }
  };
  el.addEventListener("play", force);
  el.addEventListener("volumechange", force);
  force();
}
