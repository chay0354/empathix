"use client";
import { api } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { getRecording, newId, saveRecording, saveSession } from "@/lib/storage";
import type { Feedback, SessionRecord, Setup } from "@/lib/types";
import { useLang } from "./LangProvider";
import { TopBar } from "./TopBar";
import { Welcome } from "./Welcome";
import { SetupScreen } from "./SetupScreen";
import { Brief } from "./Brief";
import { CallScreen, type CallResult } from "./CallScreen";
import { FeedbackScreen } from "./FeedbackScreen";
import { ReportView, TranscriptView } from "./ReportView";

type Stage = "welcome" | "setup" | "brief" | "call" | "preparing" | "feedback" | "report" | "transcript";

export function App() {
  const { lang, t } = useLang();
  const [stage, setStage] = useState<Stage>("welcome");
  const [mock, setMock] = useState(false);
  const [setup, setSetup] = useState<Setup>({ lang, employee: "experienced", employeeText: "", situation: "performance", situationText: "", voice: "cedar" });
  const [record, setRecord] = useState(true);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [previous, setPrevious] = useState<SessionRecord | null>(null);
  const [rec, setRec] = useState<SessionRecord | null>(null);
  const [coachError, setCoachError] = useState(false);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [callKey, setCallKey] = useState(0);

  useEffect(() => {
    api("/api/config").then((r) => r.json()).then((c) => setMock(!!c.mock)).catch(() => setMock(true));
  }, []);
  useEffect(() => { setSetup((s) => ({ ...s, lang })); }, [lang]);
  useEffect(() => { window.scrollTo(0, 0); }, [stage]);

  const runCoach = useCallback(async (r: SessionRecord) => {
    setCoachError(false);
    setStage("preparing");
    try {
      const res = await api("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          setup: r.setup,
          transcript: r.transcript,
          endedBy: r.endedBy,
          durationSec: r.durationSec,
          previous: previous?.feedback ?? null,
          previousTranscript: previous?.transcript ?? null
        })
      });
      if (!res.ok) throw new Error();
      const { feedback } = (await res.json()) as { feedback: Feedback };
      const done = { ...r, feedback };
      saveSession(done);
      setRec(done);
      setStage("feedback");
    } catch {
      setCoachError(true);
    }
  }, [previous]);

  const onEnded = useCallback(async (res: CallResult) => {
    const id = newId();
    if (res.recording && record) await saveRecording(id, res.recording);
    const r: SessionRecord = {
      id,
      createdAt: new Date().toISOString(),
      setup,
      transcript: res.turns,
      durationSec: res.durationSec,
      endedBy: res.endedBy,
      feedback: null,
      attempt: previous ? previous.attempt + 1 : 1,
      parentId: previous?.id ?? null,
      challenge,
      hasRecording: !!(res.recording && record),
      mock
    };
    saveSession(r);
    setRec(r);
    void runCoach(r);
  }, [setup, previous, challenge, record, mock, runCoach]);

  const startCall = () => { setCallKey((k) => k + 1); setStage("call"); };
  const retry = () => {
    if (!rec?.feedback) return;
    setPrevious(rec);
    setChallenge(rec.feedback.challenge);
    setStage("brief");
  };
  const other = () => { setPrevious(null); setChallenge(null); setRec(null); setStage("setup"); };
  const replay = async () => {
    if (!rec) return;
    const blob = await getRecording(rec.id);
    if (blob) setReplayUrl(URL.createObjectURL(blob));
  };

  return (
    <main className="ex-page">
      <TopBar showLangs={stage === "welcome"} showArea={stage !== "call"} />
      {mock && stage !== "report" && stage !== "transcript" && <div className="ex-banner ex-noprint" role="status">{t("mockBanner")}</div>}

      {stage === "welcome" && <Welcome onStart={() => setStage("setup")} />}
      {stage === "setup" && <SetupScreen setup={setup} onChange={setSetup} onContinue={() => setStage("brief")} />}
      {stage === "brief" && (
        <Brief setup={setup} challenge={challenge} record={record} setRecord={setRecord} mock={mock}
          onBack={() => (challenge ? setStage("feedback") : setStage("setup"))} onStart={startCall} />
      )}
      {stage === "call" && <CallScreen key={callKey} setup={setup} challenge={challenge} mock={mock} record={record} onEnded={onEnded} />}
      {stage === "preparing" && (
        <div className="ex-center">
          {coachError ? (
            <div className="ex-error" role="alert" style={{ maxWidth: 520 }}>
              <span>{t("errCoach")}</span>
              <button className="ex-link" onClick={() => rec && void runCoach(rec)}>{t("tryAgain")}</button>
            </div>
          ) : (
            <div className="ex-loading" role="status"><div className="ex-spinner" /><p className="ex-body ex-muted">{t("preparing")}</p></div>
          )}
        </div>
      )}
      {stage === "feedback" && rec?.feedback && (
        <>
          <FeedbackScreen rec={rec} onRetry={retry} onOther={other} onReport={() => setStage("report")} onTranscript={() => setStage("transcript")}
            onReplay={rec.hasRecording ? () => void replay() : null} />
          {replayUrl && <audio src={replayUrl} controls autoPlay style={{ width: "min(1080px,100%)", margin: "16px auto 0", display: "block" }} />}
        </>
      )}
      {stage === "report" && rec && <ReportView rec={rec} onClose={() => setStage("feedback")} />}
      {stage === "transcript" && rec && <TranscriptView rec={rec} onClose={() => setStage("feedback")} />}
    </main>
  );
}
