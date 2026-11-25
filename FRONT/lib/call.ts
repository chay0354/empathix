"use client";
import { api } from "./api";
import { mockEmployeeLine } from "./mock";
import type { EndedBy, Lang, Setup, Turn } from "./types";

export type CallError = "mic" | "network" | "ai";

export interface CallEvents {
  onLive: () => void;
  onTurns: (turns: Turn[]) => void;
  onSpeaking: (who: "manager" | "employee" | null) => void;
  onLevel: (level: number) => void;
  onEnd: (by: EndedBy) => void;
  onError: (e: CallError) => void;
  /** Employee audio from the voice model, before it is played. Used to drive the video avatar. */
  onRemoteAudio?: (track: MediaStreamTrack) => void;
}

export interface Call {
  start(): Promise<void>;
  sendText(text: string): void;
  sendSystemNote(text: string): void;
  setMicEnabled(on: boolean): void;
  /** Hold the employee's voice back by this many seconds, so it lands with the avatar's mouth. */
  setVoiceDelay(seconds: number): void;
  /** Stops everything; resolves with the mixed recording if recording was on. */
  stop(): Promise<Blob | null>;
  readonly voice: boolean;
}

const pickMime = () =>
  ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";

/** Realtime voice call over WebRTC, using a short-lived client secret minted by /api/realtime/session. */
export class RealtimeCall implements Call {
  readonly voice = true;
  private pc?: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private mic?: MediaStream;
  private audioEl?: HTMLAudioElement;
  private delay?: DelayNode;
  private voiceDelay = 0;
  private pendingDelay: number | null = null;
  private micWanted = true;
  private employeeSpeaking = false;
  private releaseMic?: ReturnType<typeof setTimeout>;
  private ctx?: AudioContext;
  private dest?: MediaStreamAudioDestinationNode;
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private turns = new Map<string, Turn>();
  private order: string[] = [];
  private t0 = 0;
  private raf = 0;
  private ended = false;
  private pendingEnd = false;
  private typedN = 0;

  constructor(
    private setup: Setup,
    private challenge: string | null,
    private record: boolean,
    private ev: CallEvents
  ) {}

  private emitTurns() {
    this.ev.onTurns(this.order.map((id) => this.turns.get(id)!).filter(Boolean));
  }
  private add(id: string, role: Turn["role"], text = "", typed = false) {
    if (this.turns.has(id)) return;
    this.turns.set(id, { id, role, text, t: Date.now() - this.t0, typed });
    this.order.push(id);
    this.emitTurns();
  }
  private setText(id: string, role: Turn["role"], text: string, append = false) {
    if (!this.turns.has(id)) this.add(id, role);
    const t = this.turns.get(id)!;
    t.text = append ? t.text + text : text;
    this.emitTurns();
  }

  async start() {
    const r = await api("/api/realtime/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setup: this.setup, challenge: this.challenge })
    }).catch(() => null);
    // stop() may run while start() is still awaiting (e.g. the screen unmounts and remounts).
    // Bail out after every await, or an orphaned second employee keeps talking.
    if (this.ended) return;
    if (!r || !r.ok) return this.ev.onError(r ? "ai" : "network");
    const { value, model } = await r.json();
    if (this.ended) return;

    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
    } catch {
      // No microphone: keep going so the manager can type, and hear the employee.
      this.mic = undefined;
      if (!this.ended) this.ev.onError("mic");
    }
    if (this.ended) {
      this.mic?.getTracks().forEach((t) => t.stop());
      return;
    }

    this.ctx = new AudioContext();
    this.dest = this.ctx.createMediaStreamDestination();
    if (this.mic) this.ctx.createMediaStreamSource(this.mic).connect(this.dest);

    const pc = (this.pc = new RTCPeerConnection());
    // Chrome only pulls a remote WebRTC stream into Web Audio while a media element holds it.
    this.audioEl = new Audio();
    this.audioEl.autoplay = true;
    this.audioEl.muted = true;
    pc.ontrack = (e) => {
      if (this.ended) return;
      const stream = e.streams[0];
      const track = stream.getAudioTracks()[0];
      this.audioEl!.srcObject = stream;
      if (track) this.ev.onRemoteAudio?.(track);
      // The original voice is what the manager hears, played through a delay line so
      // it can wait for the avatar's mouth. The avatar's own speaker stays muted.
      const src = this.ctx!.createMediaStreamSource(stream);
      this.delay = this.ctx!.createDelay(2);
      this.delay.delayTime.value = this.voiceDelay;
      src.connect(this.delay).connect(this.ctx!.destination);
      void this.ctx!.resume().catch(() => {});
      src.connect(this.dest!);
      const an = this.ctx!.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        this.ev.onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    };
    pc.onconnectionstatechange = () => {
      if (!this.ended && (pc.connectionState === "failed" || pc.connectionState === "disconnected")) this.ev.onError("network");
    };
    if (this.mic) this.mic.getTracks().forEach((t) => pc.addTrack(t, this.mic!));
    else pc.addTransceiver("audio", { direction: "recvonly" });

    const dc = (this.dc = pc.createDataChannel("oai-events"));
    dc.onmessage = (m) => { if (!this.ended) this.onEvent(JSON.parse(m.data)); };
    dc.onopen = () => {
      if (this.ended) return;
      this.t0 = Date.now();
      if (this.record) {
        const mime = pickMime();
        try {
          this.rec = new MediaRecorder(this.dest!.stream, mime ? { mimeType: mime } : undefined);
          this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
          this.rec.start(1000);
        } catch {
          /* recording unsupported: continue without it */
        }
      }
      this.ev.onLive();
    };

    try {
      const offer = await pc.createOffer();
      // Ask for a clearer mic encode. The employee's voice is the original track, played as-is.
      if (offer.sdp) offer.sdp = offer.sdp.replace(/useinbandfec=1(?!;maxaveragebitrate)/g, "useinbandfec=1;maxaveragebitrate=128000");
      await pc.setLocalDescription(offer);
      const ans = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${value}`, "Content-Type": "application/sdp" }
      });
      if (!ans.ok) throw new Error(String(ans.status));
      const sdp = await ans.text();
      if (this.ended) return;
      await pc.setRemoteDescription({ type: "answer", sdp });
    } catch {
      if (!this.ended) this.ev.onError("network");
    }
  }

  private onEvent(e: any) {
    switch (e.type) {
      case "input_audio_buffer.speech_started":
        this.ev.onSpeaking("manager");
        break;
      case "input_audio_buffer.speech_stopped":
        this.ev.onSpeaking(null);
        break;
      case "input_audio_buffer.committed":
        this.add(e.item_id, "manager");
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.setText(e.item_id, "manager", (e.transcript || "").trim());
        break;
      case "response.output_item.added":
        if (e.item?.type === "message") this.add(e.item.id, "employee");
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.setText(e.item_id, "employee", e.delta || "", true);
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        this.setText(e.item_id, "employee", (e.transcript || "").trim());
        break;
      case "output_audio_buffer.started": {
        this.holdMic();
        const d = this.voiceDelay * 1000;
        setTimeout(() => { if (!this.ended) this.ev.onSpeaking("employee"); }, d);
        break;
      }
      case "output_audio_buffer.stopped": {
        this.releaseMicSoon();
        const d = this.voiceDelay * 1000;
        setTimeout(() => {
          if (this.ended) return;
          this.ev.onSpeaking(null);
          if (this.pendingEnd) this.finish("employee");
        }, d);
        break;
      }
      case "response.function_call_arguments.done":
        if (e.name === "end_conversation") {
          this.pendingEnd = true;
          setTimeout(() => this.finish("employee"), 6000); // safety if no stop event arrives
        }
        break;
      case "error":
        console.warn("realtime error", e.error);
        break;
    }
  }

  private finish(by: EndedBy) {
    if (this.ended) return;
    this.ended = true;
    this.ev.onEnd(by);
  }

  private send(obj: unknown) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(obj));
  }

  sendText(text: string) {
    const id = `typed_${Date.now().toString(36)}_${this.typedN++}`.slice(0, 32);
    this.add(id, "manager", text, true);
    this.send({ type: "conversation.item.create", item: { id, type: "message", role: "user", content: [{ type: "input_text", text }] } });
    this.send({ type: "response.create" });
  }

  sendSystemNote(text: string) {
    this.send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text }] } });
  }

  setMicEnabled(on: boolean) {
    this.micWanted = on;
    this.applyMic();
  }

  /** Close the mic while the employee is audible, so the speakers are not heard as an interruption. */
  private holdMic() {
    if (!this.ev.onRemoteAudio) return;
    this.employeeSpeaking = true;
    if (this.releaseMic) clearTimeout(this.releaseMic);
    this.applyMic();
  }

  private releaseMicSoon() {
    if (!this.ev.onRemoteAudio) return;
    if (this.releaseMic) clearTimeout(this.releaseMic);
    // The last words are still coming out of the delay line.
    this.releaseMic = setTimeout(() => {
      this.employeeSpeaking = false;
      this.applyMic();
      if (this.pendingDelay !== null) this.applyDelay(this.pendingDelay);
    }, 900 + this.voiceDelay * 1000);
  }

  private applyMic() {
    const on = this.micWanted && !this.employeeSpeaking;
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = on));
  }

  setVoiceDelay(seconds: number) {
    const s = Math.min(1.5, Math.max(0, seconds));
    if (Math.abs(s - this.voiceDelay) < 0.03) return;
    // Moving the delay mid-sentence would stretch or skip words, so wait for a pause.
    if (this.employeeSpeaking) this.pendingDelay = s;
    else this.applyDelay(s);
  }

  private applyDelay(s: number) {
    this.pendingDelay = null;
    this.voiceDelay = s;
    if (this.delay && this.ctx) this.delay.delayTime.setValueAtTime(s, this.ctx.currentTime);
  }

  async stop(): Promise<Blob | null> {
    this.ended = true;
    if (this.releaseMic) clearTimeout(this.releaseMic);
    cancelAnimationFrame(this.raf);
    const blob = await new Promise<Blob | null>((resolve) => {
      if (!this.rec || this.rec.state === "inactive") return resolve(null);
      this.rec.onstop = () => resolve(this.chunks.length ? new Blob(this.chunks, { type: this.rec!.mimeType || "audio/webm" }) : null);
      this.rec.stop();
    });
    this.dc?.close();
    this.pc?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
    }
    this.ctx?.close().catch(() => {});
    return blob;
  }
}

const BCP: Record<Lang, string> = { he: "he-IL", en: "en-GB", fr: "fr-FR" };

/** Scripted call for MOCK mode (no API key): typed manager turns, browser speech synthesis for the employee. */
export class MockCall implements Call {
  readonly voice = false;
  private turns: Turn[] = [];
  private t0 = 0;
  private idx = 0;
  private ended = false;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private setup: Setup, private ev: CallEvents) {}

  async start() {
    this.t0 = Date.now();
    setTimeout(() => this.ev.onLive(), 400);
  }
  sendText(text: string) {
    if (this.ended) return;
    this.turns.push({ id: `m${this.turns.length}`, role: "manager", text, t: Date.now() - this.t0, typed: true });
    this.ev.onTurns([...this.turns]);
    this.timer = setTimeout(() => this.reply(), 900);
  }
  private reply() {
    const { text, last } = mockEmployeeLine(this.setup.lang, this.idx++);
    this.turns.push({ id: `e${this.turns.length}`, role: "employee", text, t: Date.now() - this.t0 });
    this.ev.onTurns([...this.turns]);
    const done = () => {
      this.ev.onSpeaking(null);
      this.ev.onLevel(0);
      if (last && !this.ended) {
        this.ended = true;
        this.ev.onEnd("employee");
      }
    };
    if (typeof speechSynthesis !== "undefined") {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP[this.setup.lang];
      u.onstart = () => this.ev.onSpeaking("employee");
      u.onboundary = () => this.ev.onLevel(0.3 + Math.random() * 0.5);
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
    } else done();
  }
  sendSystemNote() {}
  setMicEnabled() {}
  setVoiceDelay() {}
  async stop() {
    this.ended = true;
    clearTimeout(this.timer);
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    return null;
  }
}
