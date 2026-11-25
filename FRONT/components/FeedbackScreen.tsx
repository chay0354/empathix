"use client";
import { api } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionRecord } from "@/lib/types";
import { useLang } from "./LangProvider";
import { Face } from "./Avatar";
import { CoachVideo } from "./CoachVideo";
import { Bulb, Check, Chevron, Doc, Headphones, Lines, Retry, Target, Wave } from "./icons";

const BCP = { he: "he-IL", en: "en-GB", fr: "fr-FR" } as const;

function Quote({ text }: { text: string }) {
  const { lang } = useLang();
  const [o, c] = lang === "he" ? ["״", "״"] : lang === "fr" ? ["« ", " »"] : ["“", "”"];
  return <span className="ex-quote" dir="auto">{o}{text}{c}</span>;
}

function Row({ kind, title, summary, open, onToggle, children }: {
  kind: "worked" | "improve" | "next"; title: string; summary: string; open: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  const Icon = kind === "worked" ? Check : kind === "improve" ? Bulb : Target;
  return (
    <div className={`ex-frow${open ? " is-open" : ""}`} onClick={onToggle}>
      <span className={`ex-frow__icon ex-frow__icon--${kind}`}><Icon /></span>
      <div className="ex-frow__body">
        <p className="ex-frow__title">{title}</p>
        <p className="ex-frow__text">{summary}</p>
        {open && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
      </div>
      <button className="ex-frow__toggle" aria-expanded={open} aria-label={title} onClick={(e) => { e.stopPropagation(); onToggle(); }}><Chevron /></button>
    </div>
  );
}

/**
 * Coach voice: server TTS when available, otherwise the browser's speech synthesis.
 * The TTS audio is also copied to a track so the avatar's mouth can follow it.
 * Playback waits until `start` (the face is ready, or it is not coming).
 */
function useCoachVoice(text: string, lang: keyof typeof BCP, mock: boolean, start: boolean, faced: boolean) {
  const [playing, setPlaying] = useState(false);
  const [level, setLevel] = useState(0);
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const delay = useRef<DelayNode | null>(null);
  const lag = useRef(0.47);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  const waited = useRef(false);

  const pulse = (on: boolean) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = on ? setInterval(() => setLevel(0.25 + Math.random() * 0.55), 140) : null;
    if (!on) setLevel(0);
  };

  const speakBrowser = () => {
    if (typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = BCP[lang];
    u.onstart = () => { setPlaying(true); pulse(true); };
    u.onend = u.onerror = () => { setPlaying(false); pulse(false); };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };

  const play = async () => {
    if (mock) return speakBrowser();
    try {
      if (!url.current) {
        const r = await api("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, lang }) });
        if (!alive.current) return;
        if (!r.ok) throw new Error("tts");
        url.current = URL.createObjectURL(await r.blob());
      }
      const a = (audio.current ??= new Audio());
      if (a.src !== url.current) a.src = url.current;
      if (!ctx.current) {
        const context = new AudioContext();
        const src = context.createMediaElementSource(a);
        const dest = context.createMediaStreamDestination();
        // The face gets the voice right away; the speakers get it after the face's lag.
        src.connect(dest);
        const d = context.createDelay(2);
        d.delayTime.value = faced ? lag.current : 0;
        src.connect(d).connect(context.destination);
        delay.current = d;
        ctx.current = context;
        setTrack(dest.stream.getAudioTracks()[0]);
      }
      await ctx.current.resume();
      if (!alive.current) return;
      // Let the face attach to the track before the first word.
      if (!waited.current) {
        waited.current = true;
        await new Promise((r) => setTimeout(r, 180));
      }
      if (!alive.current) return;
      if (a.ended) a.currentTime = 0;
      a.onplay = () => { setPlaying(true); pulse(true); };
      a.onpause = a.onended = () => { setPlaying(false); pulse(false); };
      await a.play();
    } catch {
      if (alive.current) speakBrowser();
    }
  };
  const pause = () => {
    audio.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setPlaying(false); pulse(false);
  };

  useEffect(() => {
    alive.current = true;
    if (!start) return;
    void play();
    return () => {
      alive.current = false;
      pause();
      ctx.current?.close().catch(() => {});
      ctx.current = null;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, start]);

  /** Glide to the measured lag, so speech already playing is not cut. */
  const setLag = useCallback((s: number) => {
    const v = Math.min(1.5, Math.max(0, s));
    lag.current = v;
    const d = delay.current;
    const c = ctx.current;
    if (!d || !c) return;
    d.delayTime.cancelScheduledValues(c.currentTime);
    d.delayTime.setValueAtTime(d.delayTime.value, c.currentTime);
    d.delayTime.linearRampToValueAtTime(v, c.currentTime + 0.5);
  }, []);

  return { playing, level, play, pause, track, setLag };
}

export function FeedbackScreen({ rec, onRetry, onOther, onReport, onTranscript, onReplay }: {
  rec: SessionRecord; onRetry: () => void; onOther: () => void; onReport: () => void; onTranscript: () => void; onReplay: (() => void) | null;
}) {
  const { t, lang } = useLang();
  const fb = rec.feedback!;
  const [open, setOpen] = useState<"worked" | "improve" | "next" | null>("worked");
  const [avatar, setAvatar] = useState<"pending" | "ready" | "unavailable">(rec.mock ? "unavailable" : "pending");
  const onAvatar = useCallback((status: "ready" | "unavailable") => setAvatar(status), []);
  const voice = useCoachVoice(fb.spoken, rec.setup.lang, rec.mock, avatar !== "pending", avatar === "ready");
  const tog = (k: "worked" | "improve" | "next") => setOpen((o) => (o === k ? null : k));

  useEffect(() => {
    if (avatar !== "pending") return;
    const t = setTimeout(() => setAvatar((a) => (a === "pending" ? "unavailable" : a)), 8000);
    return () => clearTimeout(t);
  }, [avatar]);

  return (
    <section className="ex-panel ex-fb" lang={rec.setup.lang} dir={rec.setup.lang === "he" ? "rtl" : "ltr"}>
      <div className="ex-coach">
        {!rec.mock && <CoachVideo track={voice.track} onStatus={onAvatar} onLag={voice.setLag} />}
        {avatar !== "ready" && <Face id="coach" name={t("coachName")} level={voice.level} fallback="/mark.svg" />}
        <button className="ex-namechip" onClick={() => (voice.playing ? voice.pause() : void voice.play())} aria-label={voice.playing ? t("pauseCoach") : t("playCoach")}>
          <Wave />{t("coachName")}
        </button>
      </div>
      <div>
        <h1 className="ex-title">{t("feedbackTitle")}</h1>
        <p className="ex-body ex-muted" style={{ margin: "8px 0 24px" }}>{fb.summary}</p>
        {fb.limited && (
          <p className="ex-note" style={{ marginBottom: 16 }}>{rec.endedBy === "manager" ? t("endedEarly") : t("limitedNote")}</p>
        )}
        <div className="ex-feedback">
          <Row kind="worked" title={t("worked")} summary={fb.worked.headline} open={open === "worked"} onToggle={() => tog("worked")}>
            <p className="ex-frow__detail">{fb.worked.detail}</p>
            {fb.worked.quote && <p className="ex-frow__detail"><Quote text={fb.worked.quote} /></p>}
          </Row>
          <Row kind="improve" title={t("improve")} summary={fb.improve.headline} open={open === "improve"} onToggle={() => tog("improve")}>
            <p className="ex-frow__detail">{fb.improve.detail}</p>
            {fb.improve.quote && <p className="ex-frow__detail"><Quote text={fb.improve.quote} /></p>}
            <div className="ex-alt">
              <p className="ex-small">{t("tryInstead")}</p>
              <p><Quote text={fb.alternative.phrase} /></p>
              <p className="ex-small">{t("why")} {fb.alternative.why}</p>
            </div>
          </Row>
          <Row kind="next" title={t("next")} summary={fb.challenge} open={open === "next"} onToggle={() => tog("next")}>
            {fb.comparison && <p className="ex-frow__detail">{fb.comparison}</p>}
          </Row>
        </div>
        <div className="ex-fb__actions">
          <button className="ex-btn ex-btn--primary" onClick={onRetry}><Retry />{t("retry")}</button>
          <button className="ex-btn ex-btn--secondary" onClick={onOther}>{t("otherSituation")}</button>
        </div>
        <div className="ex-fb__links">
          <button className="ex-link" onClick={onReport}><Doc />{t("fullReport")}</button>
          <button className="ex-link" onClick={onTranscript}><Lines />{t("transcript")}</button>
          {onReplay && <button className="ex-link" onClick={onReplay}><Headphones />{t("replay")}</button>}
        </div>
      </div>
    </section>
  );
}
