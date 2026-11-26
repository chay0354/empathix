"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MockCall, RealtimeCall, type Call, type CallError } from "@/lib/call";
import { employeeOf, situationTitle } from "@/lib/scenarios";
import type { EndedBy, Setup, Turn } from "@/lib/types";
import type { TKey } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import { Face } from "./Avatar";
import { EmployeeVideo } from "./EmployeeVideo";
import { Camera, Keyboard, Mic, MicOff, Phone, Wave } from "./icons";

const SOFT_END_SEC = 390; // 6:30 — ask the employee to steer toward a close
const HARD_END_SEC = 540; // 9:00 — end the call

export interface CallResult { turns: Turn[]; endedBy: EndedBy; durationSec: number; recording: Blob | null }

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function CallScreen({ setup, challenge, mock, record, onEnded }: {
  setup: Setup; challenge: string | null; mock: boolean; record: boolean; onEnded: (r: CallResult) => void;
}) {
  const { t } = useLang();
  const emp = employeeOf(setup);
  const callRef = useRef<Call | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const startedAt = useRef(0);
  const endedRef = useRef(false);
  const softSent = useRef(false);

  const [live, setLive] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [speaking, setSpeaking] = useState<"manager" | "employee" | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [typing, setTyping] = useState(mock);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<CallError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cam, setCam] = useState<MediaStream | null>(null);
  const [remoteTrack, setRemoteTrack] = useState<MediaStreamTrack | null>(null);
  const [faceOn, setFaceOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onFace = useCallback((on: boolean) => {
    // The voice delay is fixed. Turning it on and off with the picture changes the pace of the words.
    if (on) setFaceOn(true);
  }, []);
  const [attempt, setAttempt] = useState(0);

  const end = useCallback(async (by: EndedBy) => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (by === "employee") setNotice(t("employeeEnded"));
    if (by === "time") setNotice(t("timeUp"));
    const recording = (await callRef.current?.stop()) ?? null;
    cam?.getTracks().forEach((tr) => tr.stop());
    const durationSec = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    setTimeout(() => onEnded({ turns: turnsRef.current.filter((x) => x.text.trim()), endedBy: by, durationSec, recording }), by === "manager" ? 0 : 1400);
  }, [cam, onEnded, t]);

  // Start / restart the call
  useEffect(() => {
    endedRef.current = false;
    setError(null);
    setLive(false);
    const ev = {
      onLive: () => { setLive(true); if (!startedAt.current) startedAt.current = Date.now(); },
      onTurns: (ts: Turn[]) => { turnsRef.current = ts; setTurns(ts); },
      onSpeaking: setSpeaking,
      onLevel: setLevel,
      onEnd: (by: EndedBy) => void end(by),
      onError: (e: CallError) => { setError(e); if (e === "mic") setTyping(true); },
      onRemoteAudio: (track: MediaStreamTrack) => setRemoteTrack(track)
    };
    const call: Call = mock ? new MockCall(setup, ev) : new RealtimeCall(setup, challenge, record, ev);
    callRef.current = call;
    void call.start();
    return () => { if (!endedRef.current) void call.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Timer + soft/hard end
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const s = Math.round((Date.now() - startedAt.current) / 1000);
      setElapsed(s);
      if (s >= SOFT_END_SEC && !softSent.current) {
        softSent.current = true;
        callRef.current?.sendSystemNote("Time is almost up. Within the next turn or two, steer toward a natural close, then call end_conversation.");
      }
      if (s >= HARD_END_SEC) void end("time");
    }, 500);
    return () => clearInterval(id);
  }, [live, end]);

  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = cam; }, [cam]);

  const toggleCam = async () => {
    if (cam) { cam.getTracks().forEach((x) => x.stop()); setCam(null); return; }
    try { setCam(await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })); } catch { /* camera is optional */ }
  };
  const toggleMic = () => { const on = !micOn; setMicOn(on); callRef.current?.setMicEnabled(on); };
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !live) return;
    callRef.current?.sendText(text);
    setDraft("");
  };

  const lastEmployee = [...turns].reverse().find((x) => x.role === "employee" && x.text)?.text ?? "";
  const status = !live ? t("connecting") : speaking === "employee" ? `${emp.name} · ${t("speaking")}` : turns.length === 0 ? t("youOpen") : `${emp.name} · ${t("listening")}`;
  const errText: Record<CallError, TKey> = { mic: "errMic", network: "errNetwork", ai: "errAI" };

  return (
    <div className={`ex-callwrap${typing ? " is-typing" : ""}`}>
      <div className="ex-call">
        <div className="ex-call__bar">
          <span className="ex-call__title">{t("practice")}: {situationTitle(setup, (k) => t(k as TKey))}</span>
          <span className="ex-call__timer" aria-label="timer"><Wave />{fmt(elapsed)}</span>
        </div>
        <div className="ex-stage">
          {!mock && <EmployeeVideo key={attempt} employee={setup.employee} enabled remoteTrack={remoteTrack} onReady={onFace} />}
          {!faceOn && (
            <div className="ex-stage__face">
              <Face id={setup.employee} name={emp.name} level={speaking === "employee" ? Math.max(level, 0.25) : 0} />
            </div>
          )}
          <div className="ex-stage__status" aria-live="polite">
            <span className={`ex-dot${speaking === "employee" ? " is-speaking" : live ? " is-live" : ""}`} />{status}
          </div>
          {cam && (
            <div className="ex-stage__self"><video ref={videoRef} autoPlay muted playsInline /></div>
          )}
          <div className="ex-controls">
            <button className="ex-ctrl" aria-label={t("camera")} aria-pressed={!!cam} onClick={toggleCam}><Camera /></button>
            {!mock && (
              <button className={`ex-ctrl${micOn ? "" : " is-off"}`} aria-label={micOn ? t("mic") : t("micOff")} aria-pressed={!micOn} onClick={toggleMic}>
                {micOn ? <Mic /> : <MicOff />}
              </button>
            )}
            <button className="ex-ctrl ex-ctrl--end" aria-label={t("endCall")} onClick={() => void end("manager")}><Phone /></button>
            <button className="ex-ctrl" aria-label={t("typeInstead")} aria-pressed={typing} onClick={() => setTyping((v) => !v)}><Keyboard /></button>
          </div>
        </div>
      </div>

      <p className="ex-caption" aria-live="polite" dir="auto">{notice ?? lastEmployee}</p>

      {typing && (
        <form className="ex-typebar" onSubmit={send}>
          <input className="ex-field__input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("typePh")} aria-label={t("typePh")} autoFocus dir="auto" disabled={!live} />
          <button className="ex-btn ex-btn--primary" type="submit" disabled={!live || !draft.trim()} style={{ minHeight: 50 }}>{t("send")}</button>
        </form>
      )}

      {challenge && <p className="ex-chip"><b>{t("yourChallenge")}:</b> {challenge}</p>}

      {error && (
        <div className="ex-error" role="alert">
          <span>{t(errText[error])}</span>
          {error !== "mic" && <button className="ex-link" onClick={() => setAttempt((a) => a + 1)}>{t("tryAgain")}</button>}
        </div>
      )}
    </div>
  );
}
