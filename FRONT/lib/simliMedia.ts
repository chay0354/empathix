import type { LogLevel as LogLevelT, SimliClient } from "simli-client";

/** 100ms at 16 kHz. Shorter than Simli's default, so the mouth stays with the voice. */
const MOUTH_SAMPLES = 1600;

export async function createSimli(token: string, video: HTMLVideoElement, audio: HTMLAudioElement, ice: RTCIceServer[]) {
  const { SimliClient, LogLevel } = await import("simli-client");
  const quiet = LogLevel.ERROR as LogLevelT;
  return ice.length
    ? new SimliClient(token, video, audio, ice, quiet, "p2p", "websockets", "wss://api.simli.ai", MOUTH_SAMPLES)
    : new SimliClient(token, video, audio, null, quiet, "livekit", "websockets", "wss://api.simli.ai", MOUTH_SAMPLES);
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
